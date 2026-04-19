import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // GET: Retorna lista de e-mails (para admin)
  if (req.method === 'GET') {
    try {
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
      
      const filePath = '/tmp/email-list.csv';
      const timestamp = new Date().toISOString();
      const newLine = `${email},${nome || 'Não informado'},${timestamp}\n`;
      
      // Se arquivo não existe, criar com cabeçalho
      if (!existsSync(filePath)) {
        await writeFile(filePath, 'email,nome,data\n' + newLine);
      } else {
        // Verificar se e-mail já existe
        const existingData = await readFile(filePath, 'utf-8');
        if (existingData.includes(email)) {
          return res.status(200).json({ 
            success: true, 
            message: 'E-mail já cadastrado',
            duplicate: true
          });
        }
        
        // Adicionar nova linha
        await writeFile(filePath, existingData + newLine);
      }
      
      return res.status(200).json({ 
        success: true,
        message: 'E-mail salvo com sucesso',
        duplicate: false
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

