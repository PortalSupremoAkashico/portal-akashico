import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

// URL do Google Apps Script - HARDCODED (não depende de variável de ambiente)
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
      console.log('📥 GET request recebido para listar e-mails');
      
      // Tentar do Google Apps Script primeiro (persistente)
      if (GOOGLE_APPS_SCRIPT_URL) {
        console.log('🔵 Tentando buscar e-mails do Google Sheets...');
        const response = await fetch(GOOGLE_APPS_SCRIPT_URL);
        const data = await response.json();
        console.log('✅ E-mails recuperados do Google Sheets:', data.count || 0);
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
      console.error('❌ Erro ao ler e-mails:', error);
      return res.status(500).json({ error: error.message });
    }
  }
  
  // POST: Salva novo e-mail (cadastro)
  if (req.method === 'POST') {
    try {
      const { email, nome, data_nascimento, sexo } = req.body;
      
      console.log('📨 POST request recebido para salvar cadastro:', email);
      
      if (!email) {
        console.error('❌ E-mail não fornecido');
        return res.status(400).json({ error: 'E-mail obrigatório' });
      }
      
      // SALVAR NO GOOGLE APPS SCRIPT (PERMANENTE!)
      if (GOOGLE_APPS_SCRIPT_URL) {
        console.log('🔵 URL do Apps Script configurada:', GOOGLE_APPS_SCRIPT_URL);
        try {
          console.log('🔵 Iniciando chamada ao Google Apps Script...');
          console.log('🔵 Dados enviados:', { action: 'saveEmail', email, nome: nome || 'Não informado', data_nascimento: data_nascimento || '', sexo: sexo || '' });
          
          const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              action: 'saveEmail',
              email: email,
              nome: nome || 'Não informado',
              data_nascimento: data_nascimento || '',
              sexo: sexo || ''
            })
          });
          
          console.log('🔵 Resposta recebida. Status:', response.status);
          console.log('🔵 Headers da resposta:', JSON.stringify(Object.fromEntries(response.headers.entries())));
          
          const responseText = await response.text();
          console.log('🔵 Resposta (texto):', responseText.substring(0, 500)); // Primeiros 500 chars
          
          let result;
          try {
            result = JSON.parse(responseText);
            console.log('🔵 Resultado (parsed):', JSON.stringify(result));
          } catch (parseErr) {
            console.error('❌ Erro ao fazer parse do JSON:', parseErr.message);
            console.error('❌ Resposta original:', responseText.substring(0, 1000));
            throw new Error('Resposta inválida do Apps Script: ' + responseText.substring(0, 200));
          }
          
          if (result.success) {
            console.log('✅ E-mail salvo no Google Sheets (PERMANENTE)');
            console.log('✅ Total de e-mails na planilha:', result.total || 'desconhecido');
            return res.status(200).json(result);
          } else {
            console.error('❌ Apps Script retornou success=false:', result.message);
            throw new Error(result.message || 'Erro desconhecido do Apps Script');
          }
        } catch (err) {
          console.error('❌ ERRO ao salvar no Google Sheets:', err.message);
          console.error('❌ Stack:', err.stack);
          console.error('❌ Nome do erro:', err.name);
          // Continua para salvar localmente como fallback
        }
      } else {
        console.error('❌ GOOGLE_APPS_SCRIPT_URL não está configurada ou está vazia!');
        console.error('❌ Valor atual:', GOOGLE_APPS_SCRIPT_URL);
      }
      
      // FALLBACK: Salvar localmente (temporário)
      console.log('⚠️ Salvando localmente em /tmp (fallback)');
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
      console.error('❌ Erro geral ao salvar e-mail:', error);
      return res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }
  
  return res.status(405).json({ error: 'Method not allowed' });
}
