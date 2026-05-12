import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

// emails.js — unifica email.js (envio) e save-email.js (captura de leads)
// POST com acao=enviar  → envia email via Google Apps Script
// POST com acao=salvar  → salva lead na planilha
// GET                   → lista emails capturados

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxjgmWDoG6LB0_1LQGGZM4kyxdpZmP2igtNhuES1ET2n35Tz7IkHzVPxKjXIL88-1cw/exec';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET → lista leads
  if (req.method === 'GET') {
    try {
      const response = await fetch(GOOGLE_SCRIPT_URL);
      const data = await response.json();
      return res.status(200).json(data);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method !== 'POST') return res.status(405).end();

  const { acao, to, subject, body, fileName, fileData, mimeType, email, nome, fonte } = req.body || {};

  // POST acao=enviar → envia email
  if (acao === 'enviar' || to) {
    try {
      const payload = { to, subject, body };
      if (fileData) { payload.fileName = fileName; payload.fileData = fileData; payload.mimeType = mimeType; }
      const response = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      return res.status(200).json(data);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // POST acao=salvar → salva lead
  if (acao === 'salvar' || email) {
    try {
      const payload = { acao: 'salvar', email, nome: nome || '', fonte: fonte || 'portal', timestamp: new Date().toISOString() };
      const response = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      return res.status(200).json({ success: true, ...data });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(400).json({ error: 'Ação não reconhecida.' });
}
