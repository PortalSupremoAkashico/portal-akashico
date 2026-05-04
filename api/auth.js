import { hash, verify } from '@node-rs/argon2';

const SUPABASE_URL = 'https://opykejeaxehvzogrrwto.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

// Argon2id params seguindo OWASP 2024:
// memory=64MB, iterations=3, parallelism=4
const ARGON2_OPTS = { memoryCost: 65536, timeCost: 3, parallelism: 4 };

async function supabaseFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...(options.headers || {})
    }
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) console.error(`Supabase ${res.status} em ${path}:`, typeof data === 'string' ? data.slice(0,200) : JSON.stringify(data).slice(0,200));
  return { ok: res.ok, status: res.status, data };
}

// Detecta se o hash armazenado é SHA-256 legado (64 hex chars)
function isSha256Hash(h) {
  return typeof h === 'string' && /^[a-f0-9]{64}$/i.test(h);
}

// SHA-256 no servidor para verificar hashes legados durante migração
async function sha256Server(text) {
  const buf = Buffer.from(text, 'utf8');
  const crypto = await import('node:crypto');
  return crypto.createHash('sha256').update(buf).digest('hex');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!SUPABASE_KEY) {
    console.error('SUPABASE_ANON_KEY não configurada');
    return res.status(500).json({ error: 'Configuração do servidor incompleta.' });
  }

  const { action, nome, email, senha, senha_hash, data_nascimento, sexo } = req.body;

  // Aceita tanto 'senha' (novo) quanto 'senha_hash' (legado SHA-256 do cliente)
  const senhaInput = senha || null;
  const legacyHash  = senha_hash || null;

  if (!action || !email) {
    return res.status(400).json({ error: 'Dados obrigatórios ausentes' });
  }

  // ── CADASTRO ──
  if (action === 'cadastro') {
    if (!nome) return res.status(400).json({ error: 'Nome obrigatório' });
    if (!senhaInput) return res.status(400).json({ error: 'Senha obrigatória' });
    if (senhaInput.length < 8) return res.status(400).json({ error: 'A senha deve ter pelo menos 8 caracteres.' });
    if (senhaInput.length > 72) return res.status(400).json({ error: 'A senha não pode ter mais de 72 caracteres.' });

    const check = await supabaseFetch(
      `/consulentes?email=eq.${encodeURIComponent(email)}&select=id`,
      { method: 'GET' }
    );
    if (check.ok && Array.isArray(check.data) && check.data.length > 0) {
      return res.status(409).json({ error: 'E-mail já cadastrado. Faça login.' });
    }

    const novoHash = await hash(senhaInput, ARGON2_OPTS);

    const insert = await supabaseFetch('/consulentes', {
      method: 'POST',
      body: JSON.stringify({ nome, email, senha_hash: novoHash, data_nascimento, sexo })
    });

    if (!insert.ok) return res.status(500).json({ error: 'Erro ao criar conta. Tente novamente.' });

    const user = Array.isArray(insert.data) ? insert.data[0] : insert.data;
    return res.status(200).json({
      success: true,
      user: { id: user.id, nome: user.nome, email: user.email, data: user.data_nascimento, sexo: user.sexo }
    });
  }

  // ── LOGIN ──
  if (action === 'login') {
    const result = await supabaseFetch(
      `/consulentes?email=eq.${encodeURIComponent(email)}&select=id,nome,email,senha_hash,data_nascimento,sexo`,
      { method: 'GET' }
    );

    if (!result.ok || !Array.isArray(result.data) || result.data.length === 0) {
      return res.status(401).json({ error: 'E-mail não encontrado. Verifique ou cadastre-se.' });
    }

    const user = result.data[0];
    const stored = user.senha_hash;
    let ok = false;

    if (isSha256Hash(stored)) {
      // Hash legado SHA-256 — o cliente enviou o hash ou a senha em texto
      if (senhaInput) {
        // Novo cliente envia senha em texto — compara SHA-256 do input com stored
        const clientSha = await sha256Server(senhaInput);
        ok = clientSha === stored;
      } else if (legacyHash) {
        // Cliente antigo enviou SHA-256 — compara direto
        ok = legacyHash === stored;
      }
      // Se autenticou com hash legado, migra para Argon2id
      if (ok && senhaInput) {
        const novoHash = await hash(senhaInput, ARGON2_OPTS);
        await supabaseFetch(`/consulentes?id=eq.${user.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ senha_hash: novoHash })
        });
      }
    } else {
      // Hash Argon2id — verifica normalmente
      if (senhaInput) {
        try { ok = await verify(stored, senhaInput); } catch { ok = false; }
      }
    }

    if (!ok) return res.status(401).json({ error: 'Senha incorreta.' });

    await supabaseFetch(`/consulentes?id=eq.${user.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ last_login: new Date().toISOString() })
    });

    return res.status(200).json({
      success: true,
      user: { id: user.id, nome: user.nome, email: user.email, data: user.data_nascimento, sexo: user.sexo }
    });
  }

  // ── VERIFICAR EMAIL ──
  if (action === 'check_email') {
    const result = await supabaseFetch(
      `/consulentes?email=eq.${encodeURIComponent(email)}&select=id,nome`,
      { method: 'GET' }
    );
    const exists = result.ok && Array.isArray(result.data) && result.data.length > 0;
    return res.status(200).json({ exists, nome: exists ? result.data[0].nome : null });
  }

  // ── REDEFINIR SENHA ──
  if (action === 'reset_senha') {
    if (!senhaInput) return res.status(400).json({ error: 'Senha obrigatória.' });
    if (senhaInput.length < 8) return res.status(400).json({ error: 'A senha deve ter pelo menos 8 caracteres.' });

    const novoHash = await hash(senhaInput, ARGON2_OPTS);
    const update = await supabaseFetch(
      `/consulentes?email=eq.${encodeURIComponent(email)}`,
      { method: 'PATCH', body: JSON.stringify({ senha_hash: novoHash }) }
    );
    if (!update.ok) return res.status(500).json({ error: 'Erro ao redefinir senha.' });
    return res.status(200).json({ success: true });
  }

  return res.status(400).json({ error: 'Ação desconhecida' });
}
