const SUPABASE_URL = 'https://opykejeaxehvzogrrwto.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Verifica se a chave está configurada
  if (!SUPABASE_KEY) {
    console.error('SUPABASE_ANON_KEY não configurada nas variáveis de ambiente');
    return res.status(500).json({ error: 'Configuração do servidor incompleta. Contate o administrador.' });
  }

  const { action, nome, email, senha_hash, data_nascimento, sexo } = req.body;

  if (!action || !email) {
    return res.status(400).json({ error: 'Dados obrigatórios ausentes' });
  }

  // ── CADASTRO ──
  if (action === 'cadastro') {
    if (!nome) return res.status(400).json({ error: 'Nome obrigatório' });

    // Verifica se já existe
    const check = await supabaseFetch(
      `/consulentes?email=eq.${encodeURIComponent(email)}&select=id`,
      { method: 'GET' }
    );
    if (check.ok && Array.isArray(check.data) && check.data.length > 0) {
      return res.status(409).json({ error: 'E-mail já cadastrado. Faça login.' });
    }

    // Insere novo consulente
    const insert = await supabaseFetch('/consulentes', {
      method: 'POST',
      body: JSON.stringify({ nome, email, senha_hash, data_nascimento, sexo })
    });

    if (!insert.ok) {
      console.error('Supabase insert error:', insert.data);
      return res.status(500).json({ error: 'Erro ao criar conta. Tente novamente.' });
    }

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

    if (user.senha_hash !== senha_hash) {
      return res.status(401).json({ error: 'Senha incorreta.' });
    }

    // Atualiza last_login
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
    const update = await supabaseFetch(
      `/consulentes?email=eq.${encodeURIComponent(email)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ senha_hash })
      }
    );
    if (!update.ok) return res.status(500).json({ error: 'Erro ao redefinir senha.' });
    return res.status(200).json({ success: true });
  }

  return res.status(400).json({ error: 'Ação desconhecida' });
}
 
