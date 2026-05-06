import { createHash } from 'node:crypto';

const SUPABASE_URL = 'https://opykejeaxehvzogrrwto.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

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
  if (!res.ok) console.error(`Supabase ${res.status}:`, JSON.stringify(data).slice(0,200));
  return { ok: res.ok, status: res.status, data };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET — lista mapas do consulente
  if (req.method === 'GET') {
    const email = req.query?.email;
    if (!email) return res.status(400).json({ error: 'Email obrigatório.' });
    const result = await supabaseFetch(
      `/mapas?email=eq.${encodeURIComponent(email)}&order=created_at.desc&select=*`
    );
    if (!result.ok) return res.status(500).json({ error: 'Erro ao buscar mapas.' });
    return res.status(200).json({ success: true, mapas: result.data || [] });
  }

  // POST — salvar ou apagar
  if (req.method === 'POST') {
    const { action, email, dados } = req.body;

    if (action === 'salvar') {
      if (!email || !dados) return res.status(400).json({ error: 'Dados obrigatórios.' });
      const insert = await supabaseFetch('/mapas', {
        method: 'POST',
        body: JSON.stringify({ email, dados })
      });
      if (!insert.ok) return res.status(500).json({ error: 'Erro ao salvar mapa.' });
      return res.status(200).json({ success: true });
    }

    if (action === 'apagar') {
      if (!email) return res.status(400).json({ error: 'Email obrigatório.' });
      const del = await supabaseFetch(
        `/mapas?email=eq.${encodeURIComponent(email)}`,
        { method: 'DELETE' }
      );
      return res.status(del.ok ? 200 : 500).json(del.ok ? { success: true } : { error: 'Erro ao apagar.' });
    }

    if (action === 'apagar_um') {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: 'ID obrigatório.' });
      const del = await supabaseFetch(
        `/mapas?id=eq.${id}&email=eq.${encodeURIComponent(email)}`,
        { method: 'DELETE' }
      );
      return res.status(del.ok ? 200 : 500).json(del.ok ? { success: true } : { error: 'Erro ao apagar.' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
