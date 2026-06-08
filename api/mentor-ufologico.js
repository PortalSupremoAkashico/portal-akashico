// api/mentor-ufologico.js — versão diagnóstico (sem web_search)

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST')    { res.status(405).json({ error: 'Método não permitido' }); return; }

  const { pergunta } = req.body || {};
  if (!pergunta) { res.status(400).json({ error: 'Sem pergunta' }); return; }

  // Testa conexão com Anthropic SEM web_search
  let resp;
  try {
    resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'Responda apenas: OK' }],
      }),
    });
  } catch(e) {
    res.status(500).json({ step: 'fetch', error: e.message });
    return;
  }

  if (!resp.ok) {
    const txt = await resp.text();
    res.status(500).json({ step: 'anthropic_http', status: resp.status, detail: txt });
    return;
  }

  const data = await resp.json();
  res.status(200).json({ step: 'ok', model: data.model, content: data.content?.[0]?.text });
};
