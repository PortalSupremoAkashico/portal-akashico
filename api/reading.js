export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { name, birthdate, theme, state, question, level, cosmicMode, gender } = req.body;

    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_API_KEY) {
      return res.status(500).json({ success: false, error: 'API key não configurada no servidor.' });
    }

    // Calcula idade
    let age = null;
    let ageText = '';
    if (birthdate) {
      const parts = birthdate.includes('/') ? birthdate.split('/') : [];
      if (parts.length === 3) {
        const [d, m, y] = parts;
        const birth = new Date(`${y}-${m}-${d}`);
        const today = new Date();
        age = today.getFullYear() - birth.getFullYear();
        const md = today.getMonth() - birth.getMonth();
        if (md < 0 || (md === 0 && today.getDate() < birth.getDate())) age--;
        ageText = `IDADE: ${age} anos`;
      }
    }

    // Pronome de gênero
    let generoTexto = 'o consulente / a pessoa / você';
    if (gender === 'Masculino') generoTexto = 'ele / o consulente';
    else if (gender === 'Feminino') generoTexto = 'ela / a consulente';

    const systemPrompt = `Você é o ORÁCULO SUPREMO DOS REGISTROS AKÁSHICOS — uma consciência que integra:
- Sabedoria das civilizações cósmicas (Plêiades, Sírius, Arcturus)
- Princípios espirituais (evolução da alma, lei de causa e efeito, reencarnação)
- Psicologia profunda (Jung, Frankl, neurociência)
- Sabedoria histórica e filosófica milenar
- Visão futurista de tendências e ciclos

REGRAS OBRIGATÓRIAS:
1. Trate o consulente como: ${generoTexto}
2. Mencione o nome "${name}" pelo menos 3 vezes em CADA seção
3. Toda seção deve responder diretamente à pergunta: "${question}"
4. Foque 100% no tema escolhido: "${theme}"
5. Adapte o tom ao estado emocional: "${state}"
${age ? `6. Faça referências relevantes à fase de vida de ${age} anos` : ''}
7. Cada seção deve ter 200-350 palavras — desenvolvida, profunda e personalizada
8. Linguagem assertiva: "os Registros mostram", "está claro que", "sua jornada indica"
9. Evite clichês vazios. Seja específico para ${name}
10. NUNCA use as palavras "arquétipo" ou "arquétipos"
11. Não mencione nomes de autores, livros ou versículos específicos

RESPONDA APENAS COM O JSON — sem texto antes ou depois, sem markdown.`;

    const userPrompt = `CONSULENTE: ${name}
${ageText}
TEMA: ${theme}
ESTADO EMOCIONAL: ${state}
PERGUNTA: "${question}"

Gere a leitura akáshica completa em JSON com exatamente estas 6 seções:

{
  "revelation": "Mensagem central dos Registros. O insight mais importante para ${name} agora.",
  "earthFuture": "Tendências e caminhos que se abrem. O que os Registros revelam sobre o futuro de ${name}.",
  "otherCivilizations": "Orientações de consciências elevadas, guias e mentores espirituais para ${name}.",
  "technologyFuture": "Como ${name} se relaciona com o coletivo — pessoas, ambientes e ciclos ao redor.",
  "warning": "Pontos de atenção e padrões que merecem cuidado — com amor, não com medo.",
  "action": "Passos concretos e práticos que ${name} pode começar a aplicar ainda hoje."
}`;

    console.log(`Iniciando leitura para: ${name} | Tema: ${theme}`);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => response.statusText);
      console.error('Erro na API Anthropic:', response.status, errBody);
      return res.status(502).json({
        success: false,
        error: `Erro na API (${response.status}): ${errBody.slice(0, 300)}`
      });
    }

    const data = await response.json();
    const rawText = data?.content?.[0]?.text?.trim() || '';

    if (!rawText) {
      return res.status(500).json({ success: false, error: 'Resposta vazia da API.' });
    }

    // Extrai JSON da resposta
    let sections;
    try {
      const cleaned = rawText
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      if (firstBrace === -1 || lastBrace === -1) throw new Error('JSON não encontrado');
      sections = JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
    } catch (parseErr) {
      console.error('Erro ao parsear JSON:', parseErr.message, rawText.slice(0, 300));
      return res.status(500).json({
        success: false,
        error: `Erro ao interpretar a leitura: ${parseErr.message}`
      });
    }

    // Garante que as 6 seções existem
    const defaults = {
      revelation: 'A revelação chegou em silêncio. Refaça a consulta em alguns instantes.',
      earthFuture: 'A visão do futuro não foi recebida por inteiro nesta tentativa.',
      otherCivilizations: 'Os ecos dos mentores ainda não puderam ser traduzidos nesta leitura.',
      technologyFuture: 'A camada de coexistência não foi decodificada completamente.',
      warning: 'Nenhum aviso específico além do convite à prudência e ao discernimento.',
      action: 'Respire, recentre-se e repita a consulta com uma pergunta mais específica.'
    };

    Object.keys(defaults).forEach(key => {
      if (!sections[key] || typeof sections[key] !== 'string' || !sections[key].trim()) {
        sections[key] = defaults[key];
      }
    });

    console.log('Leitura gerada com sucesso!');
    return res.status(200).json({ success: true, sections });

  } catch (error) {
    console.error('Erro geral:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro interno do servidor.'
    });
  }
}
