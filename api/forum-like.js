const SUPABASE_URL = 'https://opykejeaxehvzogrrwto.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!SUPABASE_KEY) return res.status(500).json({ error: 'Chave Supabase não configurada.' });

  try {
    const { id, type, newCount } = req.body;

    if (!id || typeof newCount !== 'number') {
      return res.status(400).json({ error: 'Parâmetros inválidos.' });
    }

    // type: 'post' (forum_ufologico) ou 'comment' (comentarios_forum)
    const table = type === 'comment' ? 'comentarios_forum' : 'forum_ufologico';

    const resp = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ likes: Math.max(0, newCount) })
    });

    if (!resp.ok) {
      const err = await resp.text();
      console.error('[forum-like] Supabase error:', resp.status, err.slice(0, 200));
      return res.status(500).json({ error: 'Erro ao salvar curtida.' });
    }

    return res.status(200).json({ success: true, likes: Math.max(0, newCount) });

  } catch (err) {
    console.error('[forum-like] Erro:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
