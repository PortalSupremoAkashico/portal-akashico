export const config = { maxDuration: 300 };

// espiritualidade.js — unifica Meditação Guiada e Sonho Akáshico
// POST com tipo=meditacao → gera meditação guiada
// POST com tipo=sonho     → interpreta sonho akáshico

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const body = req.body || {};
  const { tipo, nome, sexo, tema, intencao, sonho, emocao } = body;
  console.log('espiritualidade recebeu:', { tipo, nome, sexo, tema });
  if (!nome) return res.status(400).json({ error: 'Dados obrigatórios.', recebido: body });

  const firstName = nome.trim().split(/\s+/)[0];
  let prompt = '';

  if (tipo === 'meditacao') {
    prompt = `Você é um Guia Akáshico de meditação. Crie uma meditação guiada profunda, personalizada e transformadora para ${firstName}.

DADOS:
- Nome: ${firstName}
- Tema escolhido: ${tema || 'Paz Interior'}
- Intenção pessoal: ${intencao || 'não informada'}
- Sexo: ${sexo || 'não informado'}

ESTRUTURA DA MEDITAÇÃO (siga exatamente):
1. **Preparação** (2-3 parágrafos) — convide ${firstName} a se acomodar, respirar e soltar o dia
2. **Descida** (3-4 parágrafos) — conduza por uma jornada sensorial para um lugar sagrado
3. **O Encontro** (4-5 parágrafos) — o núcleo da meditação, conectado ao tema e à intenção
4. **A Mensagem** (2-3 parágrafos) — uma mensagem dos Guardiões especificamente para ${firstName}
5. **O Retorno** (2-3 parágrafos) — traga suavemente de volta, integrando a experiência

ESTILO:
- Use o nome ${firstName} com frequência
- Linguagem suave, lenta, contemplativa
- Inclua elementos sensoriais: luz, cores, texturas, sons, aromas
- Profundo mas acessível
- Português do Brasil impecável
- Mínimo 800 palavras

Responda APENAS em JSON válido sem markdown:
{
  "titulo": "Título poético da meditação",
  "duracao": "X minutos",
  "preparacao": "texto...",
  "descida": "texto...",
  "encontro": "texto...",
  "mensagem": "texto...",
  "retorno": "texto..."
}`;
  } else if (tipo === 'sonho') {
    if (!sonho) return res.status(400).json({ error: 'Descrição do sonho obrigatória.' });
    prompt = `Você é um Intérprete Akáshico de sonhos — um ser que acessa os Registros para revelar o significado profundo das imagens oníricas.

DADOS DO CONSULENTE:
- Nome: ${firstName}
- Sexo: ${sexo || 'não informado'}
- O sonho: "${sonho}"
- Emoção ao acordar: ${emocao || 'não informada'}

Interprete este sonho através dos Registros Akáshicos com profundidade, precisão e sensibilidade.

Responda APENAS em JSON válido sem markdown:
{
  "titulo": "Título poético para este sonho",
  "revelacao": "A mensagem principal do sonho para ${firstName} — 3-4 parágrafos profundos",
  "simbolos": "Interpretação dos principais símbolos presentes no sonho — 3-4 parágrafos",
  "karma": "Conexão com padrões kármicos, vidas anteriores ou lições da alma — 2-3 parágrafos",
  "mensagem": "Mensagem direta dos Guardiões para ${firstName} — 2 parágrafos íntimos",
  "acao": "Uma ação concreta que ${firstName} deve realizar após este sonho — 1-2 parágrafos"
}

ESTILO: Use ${firstName} frequentemente. Nunca genérico. Português do Brasil impecável.`;
  } else {
    return res.status(400).json({ error: 'Tipo inválido. Use meditacao ou sonho.' });
  }

  try {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        stream: true,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!anthropicRes.ok) return res.status(500).json({ error: 'Erro na API.' });

    const reader = anthropicRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            res.write(`data: ${JSON.stringify({ delta: parsed.delta.text })}\n\n`);
          }
        } catch {}
      }
    }
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
}
