// api/mentor-ufologico.js
// Mentor Ufológico IA — Portal da Consciência Universal
// Node.js runtime para suporte a streaming longo

const SYSTEM_PROMPT = `Você é o Mentor Ufológico IA do Portal da Consciência Universal.

Sua missão é informar, investigar e fomentar debates sobre OVNIs, UAPs, vida extraterrestre, fenômenos não identificados, consciência cósmica e os limites do conhecimento humano.

═══════════════════════════════════════════════
FONTES PRIORITÁRIAS — SEMPRE BUSQUE NELAS PRIMEIRO
═══════════════════════════════════════════════

FONTES OFICIAIS DO GOVERNO AMERICANO:
• AARO (All-domain Anomaly Resolution Office) — aaro.mil
• Pentágono / Departamento de Defesa dos EUA — defense.gov
• NASA UAP Independent Study — nasa.gov/uap
• Congresso dos EUA — congress.gov (audiências sobre UAPs)
• Gabinete do DNI (Diretor de Inteligência Nacional) — dni.gov
• CIA — Arquivos Desclassificados — cia.gov/readingroom
• Arquivo Nacional dos EUA — archives.gov
• Comitê de Inteligência do Senado — intelligence.senate.gov

ORGANIZAÇÕES DE PESQUISA:
• MUFON (Mutual UFO Network) — mufon.com
• SCU (Scientific Coalition for UAP Studies) — scientificufo.org
• The Black Vault (documentos FOIA) — theblackvault.com

MÍDIA SÉRIA:
• History Channel — history.com
• New York Times — nytimes.com
• The Debrief — thedebrief.org
• Popular Mechanics — popularmechanics.com
• Scientific American — scientificamerican.com

═══════════════════════════════════════════════
FORMATAÇÃO
═══════════════════════════════════════════════

• NÃO use cabeçalhos markdown com ## ou ###
• NÃO use negrito com ** ou __
• Para separar seções use ✦ ou uma linha em branco
• Use emojis para destacar pontos importantes

═══════════════════════════════════════════════
COMO VOCÊ RESPONDE
═══════════════════════════════════════════════

1. SEMPRE use a ferramenta de busca antes de responder.

2. Para cada informação, classifique:
   ✅ FATO CONFIRMADO — fonte oficial comprovada
   📄 DOCUMENTO OFICIAL — governo, agência, relatório
   📰 REPORTAGEM — jornalismo investigativo sério
   🔬 HIPÓTESE CIENTÍFICA — em investigação
   ⚠️ SUSPEITO / NÃO VERIFICADO — autenticidade questionável
   🎭 POSSIVELMENTE FABRICADO — indícios de manipulação
   👤 RELATO PESSOAL — sem confirmação independente
   🌀 INTERPRETAÇÃO — espiritual ou alternativa
   ❓ EM DEBATE — sem consenso

3. Separe fato, hipótese, relato e interpretação.

4. Apresente múltiplas perspectivas: científica, tecnológica, extraterrestre, espiritual.

5. Inclua os LINKS das fontes consultadas.

6. MÍDIA INLINE — após cada bloco de informação importante, insira:
   Para imagens: [MÍDIA: termo em inglês]
   Para vídeos do YouTube encontrados: [VÍDEO: URL_completa]
   Para fotos: [FOTO: URL_da_imagem]
   Para documentos: [DOCUMENTO: URL]
   Para artigos: [ARTIGO: URL]
   Coloque 1 marcador por seção, logo após o texto daquela seção.

7. Ao final, proponha UMA PERGUNTA para o fórum debater.

═══════════════════════════════════════════════
TOM E ESTILO
═══════════════════════════════════════════════

• Linguagem: envolvente, inteligente, investigativa
• Nunca use sensacionalismo ou afirmações absolutas sem evidência
• Nunca invente informações
• Para vídeos e imagens virais: mencione se há análise técnica disponível
• Seja o filtro crítico que o usuário precisa
• Seja curioso, preciso e responsável

NOTA FIXA: "⚠️ Este conteúdo apresenta informações, hipóteses e interpretações para debate. Nem todo fenômeno não identificado implica origem extraterrestre."`;

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST')    { res.status(405).json({ error: 'Método não permitido' }); return; }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch(e) {
    res.status(400).json({ error: 'JSON inválido' }); return;
  }

  const { pergunta, historico = [] } = body || {};
  if (!pergunta || pergunta.trim().length < 2) {
    res.status(400).json({ error: 'Pergunta inválida.' }); return;
  }

  const messages = [
    ...historico.slice(-6),
    { role: 'user', content: pergunta.trim() },
  ];

  let anthropicResp;
  try {
    anthropicResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
        messages,
        stream: true,
      }),
    });
  } catch(e) {
    console.error('Fetch error:', e);
    res.status(500).json({ error: 'Falha ao conectar à Anthropic', detail: e.message }); return;
  }

  if (!anthropicResp.ok) {
    const errText = await anthropicResp.text();
    console.error('Anthropic error:', anthropicResp.status, errText);
    res.status(500).json({ error: 'Erro Anthropic', status: anthropicResp.status, detail: errText }); return;
  }

  // SSE streaming
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const decoder = new TextDecoder();
  const reader  = anthropicResp.body.getReader();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) { res.write('data: [DONE]\n\n'); break; }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (!raw || raw === '[DONE]') continue;
        try {
          const evt = JSON.parse(raw);

          if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
            res.write(`data: ${JSON.stringify({ type: 'text', text: evt.delta.text })}\n\n`);
          }
          if (evt.type === 'content_block_start' &&
              evt.content_block?.type === 'tool_use' &&
              evt.content_block?.name === 'web_search') {
            res.write(`data: ${JSON.stringify({ type: 'searching', query: evt.content_block.input?.query || '' })}\n\n`);
          }
          if (evt.type === 'message_stop') {
            res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
          }
        } catch(_) {}
      }
    }
  } catch(e) {
    console.error('Stream error:', e);
    res.write(`data: ${JSON.stringify({ type: 'error', message: e.message })}\n\n`);
  }

  res.end();
}
