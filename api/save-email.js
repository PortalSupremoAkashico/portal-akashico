import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

// URL do Google Apps Script (o mesmo que envia e-mails!)
// COLE A URL AQUI: https://script.google.com/macros/s/ABC.../exec
const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxjgmWDoG6LB0_1LQGGZM4kyxdpZmP2igtNhuES1ET2n35Tz7IkHzVPxKjXIL88-1cw/exec';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // GET: Retorna lista de e-mails
  if (req.method === 'GET') {
    try {
      // Tentar do Google Apps Script primeiro (persistente)
      if (GOOGLE_APPS_SCRIPT_URL) {
        const response = await fetch(GOOGLE_APPS_SCRIPT_URL);
        const data = await response.json();
        return res.status(200).json(data);
      }
      
      // Fallback: arquivo local (temporário)
      const filePath = '/tmp/email-list.csv';
      
      if (!existsSync(filePath)) {
        return res.status(200).json({ 
          emails: [],
          count: 0,
          csv: 'email,nome,data\n'
        });
      }
      
      const csvData = await readFile(filePath, 'utf-8');
      const lines = csvData.trim().split('\n');
      const emails = lines.slice(1).map(line => {
        const [email, nome, data] = line.split(',');
        return { email, nome, data };
      });
      
      return res.status(200).json({ 
        emails,
        count: emails.length,
        csv: csvData
      });
    } catch (error) {
      console.error('Erro ao ler e-mails:', error);
      return res.status(500).json({ error: error.message });
    }
  }
  
  // POST: Salva novo e-mail
  if (req.method === 'POST') {
    try {
      const { email, nome } = req.body;
      
      if (!email) {
        return res.status(400).json({ error: 'E-mail obrigatório' });
      }
      
      // SALVAR NO GOOGLE APPS SCRIPT (PERMANENTE!)
      if (GOOGLE_APPS_SCRIPT_URL) {
        try {
          const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'saveEmail',
              email: email,
              nome: nome || 'Não informado'
            })
          });
          
          const result = await response.json();
          
          if (result.success) {
            console.log('✅ E-mail salvo no Google Sheets (PERMANENTE)');
            return res.status(200).json(result);
          }
        } catch (err) {
          console.warn('⚠️ Erro ao salvar no Google Sheets:', err);
          // Continua para salvar localmente como fallback
        }
      }
      
      // FALLBACK: Salvar localmente (temporário)
      const filePath = '/tmp/email-list.csv';
      const timestamp = new Date().toISOString();
      const newLine = `${email},${nome || 'Não informado'},${timestamp}\n`;
      
      if (!existsSync(filePath)) {
        await writeFile(filePath, 'email,nome,data\n' + newLine);
      } else {
        const existingData = await readFile(filePath, 'utf-8');
        if (existingData.includes(email)) {
          return res.status(200).json({ 
            success: true, 
            message: 'E-mail já cadastrado',
            duplicate: true
          });
        }
        await writeFile(filePath, existingData + newLine);
      }
      
      console.log('⚠️ E-mail salvo apenas localmente (será perdido no próximo deploy)');
      
      return res.status(200).json({ 
        success: true,
        message: 'E-mail salvo (local - temporário)',
        duplicate: false,
        warning: 'Configure GOOGLE_APPS_SCRIPT_URL para backup permanente'
      });
      
    } catch (error) {
      console.error('Erro ao salvar e-mail:', error);
      return res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }
  
  return res.status(405).json({ error: 'Method not allowed' });
}
