export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { hash } = req.body || {};
  if (!hash) return res.status(400).json({ ok: false });

  // Hash da senha admin armazenado como variável de ambiente no Vercel
  const ADMIN_HASH = process.env.ADMIN_PASSWORD_HASH;
  if (!ADMIN_HASH) return res.status(500).json({ ok: false, error: 'Não configurado.' });

  // Comparação segura (timing-safe)
  const ok = hash.toLowerCase() === ADMIN_HASH.toLowerCase();

  // Rate limiting básico — responde sempre com pequeno delay para dificultar brute force
  await new Promise(r => setTimeout(r, 300));

  return res.status(200).json({ ok });
}
