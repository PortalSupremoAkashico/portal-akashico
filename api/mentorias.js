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
  if (!res.ok) console.error(`Supabase ${res.status} em ${path}:`, JSON.stringify(data).slice(0, 300));
  return { ok: res.ok, status: res.status, data };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!SUPABASE_KEY) {
    return res.status(500).json({ error: 'Configuração do servidor incompleta.' });
  }

  // ── SALVAR MENSAGEM ──
  if (req.method === 'POST') {
    const { action, email, messages, consulta_tema, consulta_pergunta } = req.body;

    if (action === 'salvar' && email && messages?.length) {
      // Salva todas as mensagens de uma sessão
      const rows = messages.map(m => ({
        email,
        role:              m.role,
        content:           m.content,
        consulta_tema:     consulta_tema  || null,
        consulta_pergunta: consulta_pergunta || null
      }));

      const insert = await supabaseFetch('/mentorias', {
        method: 'POST',
        headers: { 'Prefer': 'return=minimal' },
        body: JSON.stringify(rows)
      });

      if (!insert.ok) return res.status(500).json({ error: 'Erro ao salvar mentoria.' });
      return res.status(200).json({ success: true });
    }

    // ── APAGAR SESSÃO POR PERGUNTA ──
    if (action === 'apagar_sessao' && email && consulta_pergunta) {
      const del = await supabaseFetch(
        `/mentorias?email=eq.${encodeURIComponent(email)}&consulta_pergunta=eq.${encodeURIComponent(consulta_pergunta)}`,
        { method: 'DELETE' }
      );
      return res.status(del.ok ? 200 : 500).json(del.ok ? { success: true } : { error: 'Erro ao apagar sessão.' });
    }

    // ── APAGAR TODAS AS MENSAGENS DE UM EMAIL ──
    if (action === 'apagar' && email) {
      const del = await supabaseFetch(
        `/mentorias?email=eq.${encodeURIComponent(email)}`,
        { method: 'DELETE' }
      );
      return res.status(del.ok ? 200 : 500).json(del.ok ? { success: true } : { error: 'Erro ao apagar.' });
    }
  }

  // ── BUSCAR HISTÓRICO ──
  if (req.method === 'GET') {
    const { email, tema, pergunta } = req.query;
    if (!email) return res.status(400).json({ error: 'Email obrigatório.' });

    let path = `/mentorias?email=eq.${encodeURIComponent(email)}&order=created_at.asc&select=id,role,content,consulta_tema,consulta_pergunta,created_at`;

    // Filtro opcional por consulta específica
    if (tema)    path += `&consulta_tema=eq.${encodeURIComponent(tema)}`;
    if (pergunta) path += `&consulta_pergunta=eq.${encodeURIComponent(pergunta)}`;

    const result = await supabaseFetch(path, { method: 'GET' });

    if (!result.ok) return res.status(500).json({ error: 'Erro ao buscar mentorias.' });
    return res.status(200).json({ success: true, messages: result.data });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
 
