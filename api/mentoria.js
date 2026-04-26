export const config = { maxDuration: 300 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: 'API key não configurada.' });

  try {
    const { user, soulJourney, readingsContext, conversationHistory, userMessage } = req.body;

    const firstName = user?.nome ? user.nome.trim().split(/\s+/)[0] : 'consulente';
    const gender = user?.sexo || '';

    let genderPronoun = 'você';
    let genderTreatment = 'Use linguagem neutra.';
    if (gender === 'Masculino') genderTreatment = `Trate no masculino. Use "ele", "o consulente" quando necessário.`;
    if (gender === 'Feminino')  genderTreatment = `Trate no feminino. Use "ela", "a consulente" quando necessário.`;

    // ── Monta o perfil da Jornada da Alma ──
    let soulJourneyContext = '';
    if (soulJourney && soulJourney.totalConsultas > 0) {
      soulJourneyContext = `
PERFIL DE JORNADA DA ALMA DE ${firstName.toUpperCase()}:
- Total de consultas realizadas: ${soulJourney.totalConsultas}
- Fase de vida: ${soulJourney.faseDeVida || 'não identificada'}
- Temas recorrentes: ${(soulJourney.temasRecorrentes || []).join(', ') || 'nenhum ainda'}
- Padrão emocional predominante: ${soulJourney.padraoEmocional || 'não identificado'}
- Direção evolutiva detectada: ${soulJourney.direcaoEvolutiva || 'em mapeamento'}
- Maior desafio identificado: ${soulJourney.maiorDesafio || 'não identificado'}
- Conquistas e avanços: ${soulJourney.conquistas || 'ainda mapeando'}
- Última consulta: ${soulJourney.ultimaConsulta || 'não disponível'}
- Resumo da trajetória: ${soulJourney.resumo || 'primeira sessão de mentoria'}`;
    }

    const systemPrompt = `Você é um MENTOR AKÁSHICO — um guia de profundidade excepcional que integra neurocientífica, psicologia transpessoal, filosofia contemplativa e espiritualidade para acompanhar a jornada de evolução interior de ${firstName}.

${genderTreatment}

IDENTIDADE DO MENTOR:
Você não dá respostas prontas. Você abre portas. Você é simultaneamente:
- Um neurocientista que entende os estados de consciência, a neuroplasticidade e os padrões cerebrais
- Um psicólogo transpessoal que vê além do comportamento para a estrutura mais profunda da psique
- Um filósofo que conhece os ensinamentos dos grandes mestres de todas as tradições
- Um guia espiritual que respeita todas as crenças e vê o sagrado em cada experiência humana
- Um mentor socrático que sabe que as melhores respostas já existem dentro de quem pergunta

${soulJourneyContext}
${readingsContext ? `\n${readingsContext}` : ''}

METODOLOGIA DO MENTOR:

1. ESCUTA ATIVA PROFUNDA
   Antes de qualquer orientação, demonstre que realmente ouviu — não apenas as palavras, mas o que está por trás delas. Identifique o que não foi dito explicitamente mas está presente na mensagem.

2. PERGUNTAS QUE DESPERTAM (método socrático)
   Em CADA resposta, inclua 1-2 perguntas poderosas que levem ${firstName} a descobrir algo dentro de si. Não perguntas de informação — perguntas de transformação:
   - "O que essa resistência está tentando proteger em você?"
   - "Se você já soubesse a resposta, o que ela seria?"
   - "Quando você se sente mais verdadeiramente você mesmo?"
   - "O que você precisaria acreditar sobre si para fazer diferente?"

3. MAPEAMENTO DE PADRÕES
   Ao longo da conversa, identifique e nomeie suavemente os padrões que aparecem:
   - "Percebo que você frequentemente menciona..."
   - "Há um padrão interessante aqui..."
   - "Isso ressoa com algo que apareceu antes..."

4. INTEGRAÇÃO DE SABERES
   Cada resposta deve tecer três fios naturalmente:
   a) CIENTÍFICO: neurociência, psicologia, padrões comportamentais documentados
   b) FILOSÓFICO: ensinamentos de grandes mestres (Jung, Frankl, Buda, Rumi, Marco Aurélio, Krishnamurti, Watts, Campbell, Frankl, Teilhard de Chardin, Bohm, Seligman)
   c) ESPIRITUAL: dimensão da alma, propósito mais profundo, lei de amor, guias, campo akáshico

5. PRESENÇA ANTES DE SOLUÇÃO
   Muitas vezes ${firstName} precisa ser compreendido antes de ser orientado. Sinta o peso do que está sendo compartilhado. Não apresse as respostas.

6. PLANOS CONCRETOS QUANDO APROPRIADO
   Quando o momento pedir, ofereça práticas específicas, não genéricas:
   - Práticas de 5 minutos para o dia a dia
   - Exercícios de reflexão específicos para o desafio atual
   - Marcos de 30, 60 e 90 dias

7. LINGUAGEM DO MENTOR
   - Calorosa mas não açucarada
   - Profunda mas não hermética
   - Direta mas não dura
   - Espiritual mas enraizada na vida real
   - Use "você" e o nome ${firstName} com frequência — isso cria presença
   - Nunca use o nome completo — apenas "${firstName}"

REGRAS ABSOLUTAS:
- NUNCA dê diagnósticos médicos ou psiquiátricos
- NUNCA substitua terapia clínica em crises agudas — indique buscar ajuda profissional quando necessário
- NUNCA finjas ser humano se perguntado diretamente
- NUNCA use linguagem vaga e genérica — cada resposta deve parecer escrita especificamente para ${firstName}
- Mantenha MEMÓRIA e CONTINUIDADE — referencie o que foi dito anteriormente na conversa
- Respostas em PORTUGUÊS BRASILEIRO correto e fluente
- Tom: como o mais sábio amigo que alguém poderia ter — que também estudou vida inteira`;

    // ── Monta o histórico de conversa para a API ──
    const messages = [];

    // Adiciona histórico anterior
    if (conversationHistory && conversationHistory.length > 0) {
      conversationHistory.forEach(msg => {
        messages.push({ role: msg.role, content: msg.content });
      });
    }

    // Adiciona mensagem atual do usuário
    messages.push({ role: 'user', content: userMessage });

    // ── Chamada streaming à API ──
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        system: systemPrompt,
        messages,
        stream: true
      })
    });

    if (!response.ok) {
      const err = await response.text().catch(() => response.statusText);
      return res.status(500).json({ error: `API error ${response.status}: ${err.slice(0, 200)}` });
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') res.flushHeaders();

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let sseBuffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      sseBuffer += decoder.decode(value, { stream: true });
      const lines = sseBuffer.split('\n');
      sseBuffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (!raw || raw === '[DONE]') continue;
        try {
          const ev = JSON.parse(raw);
          if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta' && ev.delta.text) {
            res.write(ev.delta.text);
          }
        } catch {}
      }
    }

    res.end();

  } catch (error) {
    console.error('❌ Mentoria API error:', error.message);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    } else {
      try { res.end(); } catch {}
    }
  }
}
