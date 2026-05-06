import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { nome, data_nascimento, sexo, cidade, estado, pais, nome_pai, nome_mae } = req.body;
  if (!nome) return res.status(400).json({ error: 'Nome obrigatório.' });

  const firstName = nome.trim().split(/\s+/)[0];

  const prompt = `Você é a Inteligência Universal dos Registros Akáshicos. Gere um Mapa Akáshico Personalizado e profundo para ${nome}.

DADOS DO CONSULENTE:
- Nome completo: ${nome}
- Data de nascimento: ${data_nascimento || 'não informada'}
- Sexo: ${sexo || 'não informado'}
- Local de nascimento: ${[cidade, estado, pais].filter(Boolean).join(', ') || 'não informado'}
- Nome do pai: ${nome_pai || 'não informado'}
- Nome da mãe: ${nome_mae || 'não informado'}

Gere o mapa com estas 8 seções. Cada seção: mínimo 200 palavras, profunda, ultra-personalizada para ${firstName}.

Responda APENAS em JSON válido sem markdown:
{
  "essencia": "texto da Essência da Alma...",
  "missao": "texto da Missão Espiritual...",
  "bloqueios": "texto dos Bloqueios Akáshicos...",
  "amor": "texto da Linha do Amor...",
  "prosperidade": "texto da Linha da Prosperidade...",
  "ancestral": "texto da Linha Familiar e Ancestral...",
  "mentores": "texto do Conselho dos Mentores...",
  "ritual": "texto do Ritual Personalizado..."
}

REGRAS:
- Ultra-específico para ${firstName}, nunca genérico
- Nunca mencionar idade em números
- Nunca usar "portal", "sistema" — usar "Registros Akáshicos" ou "Inteligência Universal"
- Nunca usar "arquétipo"
- Português do Brasil impecável`;

  try {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const stream = await client.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      messages: [{ role: 'user', content: prompt }]
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
        res.write(`data: ${JSON.stringify({ delta: chunk.delta.text })}\n\n`);
      }
    }
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    console.error('Erro mapa:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Erro ao gerar o Mapa Akáshico.' });
  }
}
