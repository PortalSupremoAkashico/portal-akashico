export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { to, subject, body, fileName, fileData, mimeType } = req.body;
    
    // URL do Google Apps Script (mesmo script que salva emails na planilha)
    const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxjgmWDoG6LB0_1LQGGZM4kyxdpZmP2igtNhuES1ET2n35Tz7IkHzVPxKjXIL88-1cw/exec';
    
    // Monta o payload — inclui campos de PDF só se existirem
    const payload = { to, subject, body };
    if (fileData) {
      payload.fileName = fileName;
      payload.fileData = fileData;
      payload.mimeType = mimeType;
    }

    // Chamar o Google Apps Script do servidor (sem problema de CORS!)
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      throw new Error(`Google Script error: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.message || 'Erro no envio');
    }
    
    return res.status(200).json({ success: true });
    
  } catch (error) {
    console.error('Erro ao enviar e-mail:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}
