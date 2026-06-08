// api/mentor-ufologico.js
const https = require('https');

const SYSTEM_PROMPT = `Você é o Mentor Ufológico IA do Portal da Consciência Universal.
Sua missão é informar e debater sobre OVNIs, UAPs e vida extraterrestre.
Fontes: AARO (aaro.mil), Pentágono (defense.gov), NASA, Congresso dos EUA, MUFON, CIA, The Debrief, History Channel.
Não use ## ou ** — use ✦ para separar seções.
Classifique: ✅ FATO | 📄 DOCUMENTO | 📰 REPORTAGEM | 🔬 HIPÓTESE | ⚠️ SUSPEITO | 👤 RELATO | ❓ EM DEBATE
Após cada caso, coloque: [VÍDEO: URL] [FOTO: URL] [DOCUMENTO: URL] [ARTIGO: URL]
Ao final, proponha UMA PERGUNTA para debate.`;

function anthropicStream(apiKey, body, onData, onEnd, onError) {
  const payload = JSON.stringify(body);
  const options = {
    hostname: 'api.anthropic.com',
    path: '/v1/messages',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
      'anthropic-version': '2023-06-01',
      'x-api-key': apiKey,
    },
  };

  const req = https.request(options, (resp) => {
    if (resp.statusCode !== 200) {
      let errBody = '';
      resp.on('data', d => errBody += d);
      resp.on('end', () => onError(resp.statusCode, errBody));
      return;
    }
    let buf = '';
    resp.on('data', chunk => {
      buf += chunk.toString();
      const lines = buf.split('\n');
      buf = lines.pop() || '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (!raw || raw === '[DONE]') continue;
        try { onData(JSON.parse(raw)); } catch(_) {}
      }
    });
    resp.on('end', onEnd);
  });

  req.on('error', e => onError(0, e.message));
  req.write(payload);
  req.end();
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST')    { res.status(405).json({ error: 'Método não permitido' }); return; }

  const { pergunta, historico = [] } = req.body || {};
  if (!pergunta || String(pergunta).trim().length < 2) {
    res.status(400).json({ error: 'Pergunta inválida.' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY || '';
  const messages = [
    ...historico.slice(-6),
    { role: 'user', content: String(pergunta).trim() },
  ];

  const body = {
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
    messages,
    stream: true,
  };

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  anthropicStream(
    apiKey,
    body,
    (evt) => {
      try {
        if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
          res.write(`data: ${JSON.stringify({ type: 'text', text: evt.delta.text })}\n\n`);
        }
        if (evt.type === 'content_block_start' && evt.content_block?.name === 'web_search') {
          res.write(`data: ${JSON.stringify({ type: 'searching', query: evt.content_block.input?.query || '...' })}\n\n`);
        }
        if (evt.type === 'message_stop') {
          res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
        }
      } catch(_) {}
    },
    () => { try { res.write('data: [DONE]\n\n'); res.end(); } catch(_) {} },
    (status, detail) => {
      console.error('[mentor] error:', status, detail);
      try {
        res.write(`data: ${JSON.stringify({ type: 'error', message: 'Erro ' + status + ': ' + detail.slice(0, 200) })}\n\n`);
        res.end();
      } catch(_) {}
    }
  );
};
