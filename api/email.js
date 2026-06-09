// api/email.js — proxy para o Google Apps Script de email
// Chamado pelo login.html no fluxo de recuperação de senha

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxjgmWDoG6LB0_1LQGGZM4kyxdpZmP2igtNhuES1ET2n35Tz7IkHzVPxKjXIL88-1cw/exec';

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const { to, subject, body } = req.body || {};
  if (!to || !subject || !body) {
    return res.status(400).json({ error: 'Campos obrigatórios: to, subject, body' });
  }

  try {
    const resp = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, body })
    });
    const data = await resp.json().catch(() => ({}));
    console.log('[email] GAS status:', resp.status, JSON.stringify(data).slice(0, 100));
    return res.status(200).json({ success: true, ...data });
  } catch (e) {
    console.error('[email] erro:', e.message);
    return res.status(500).json({ error: e.message });
  }
}
