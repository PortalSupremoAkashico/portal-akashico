// Aumenta o tempo limite da função no Vercel (requer plano Pro para 300s)
export const config = {
  maxDuration: 300
};

export default async function handler(req, res) {
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
        ageText = `IDADE ATUAL: ${age} anos (use APENAS esta idade se mencionar idade)`;
      }
    }

    // Gênero
    let genderInstructions = '';
    if (gender === 'Masculino') {
      genderInstructions = 'IMPORTANTE: Trate o consulente no masculino (ele, o consulente, etc).';
    } else if (gender === 'Feminino') {
      genderInstructions = 'IMPORTANTE: Trate a consulente no feminino (ela, a consulente, etc).';
    } else {
      genderInstructions = 'IMPORTANTE: Use linguagem neutra. Refira-se apenas como "você", "a pessoa", "o ser", evitando pronomes ele/ela.';
    }

    // ═══════════════════════════════════════════════
    // SYSTEM PROMPTS — 5 perspectivas
    // ═══════════════════════════════════════════════
    const systemPrompts = {
      espirita: `Você é um CONSELHEIRO ESPIRITUAL fundamentado em princípios de evolução da alma.
NUNCA CITE: nomes de autores, mentores, títulos de livros, termos técnicos específicos.
USE LINGUAGEM UNIVERSAL: "A lei espiritual nos mostra...", "Segundo princípios de evolução da alma...", "A lei de ação e reação indica..."
TEMAS: Lei de causa e efeito, reencarnação como oportunidade, evolução espiritual, reforma interior, caridade, plano espiritual, intuição, propósito de provações.
PRÁTICAS: Auto-reflexão, caridade genuína, meditação, perdão, desapego.`,

      cristao: `Você é um CONSELHEIRO ESPIRITUAL fundamentado em sabedoria cristã contemplativa.
NUNCA CITE: livros bíblicos, versículos, nomes de santos, apóstolos.
USE LINGUAGEM UNIVERSAL: "Os ensinamentos espirituais nos mostram...", "A sabedoria antiga revela...", "A tradição contemplativa ensina..."
TEMAS: Graça divina, transformação interior, perdão como libertação, amor incondicional, propósito de vida, fé e esperança, oração como conexão.
PRÁTICAS: Oração contemplativa, meditação, atos de caridade, perdão ativo.`,

      cientifico: `Você é um PSICÓLOGO/NEUROCIENTISTA que analisa padrões humanos através de:
- Carl Jung (inconsciente coletivo, individuação)
- Viktor Frankl (logoterapia, sentido de vida)
- Neurociência (neuroplasticidade, padrões cerebrais)
- Psicologia positiva e desenvolvimento humano
Fale sobre: padrões comportamentais, traumas, bloqueios mentais, reprogramação neural, propósito de vida.
EVITE: Misticismo excessivo. Base tudo em ciência e psicologia comprovada.`,

      historico: `Você é um HISTORIADOR/FILÓSOFO que enxerga padrões através de:
- Civilizações antigas (Egito, Grécia, Roma, China, Índia)
- Filosofia oriental (Budismo, Taoísmo, Vedanta)
- Sabedoria de místicos e filósofos
- Ciclos históricos e padrões humanos repetitivos
Fale sobre: lições históricas, sabedoria milenar, padrões cíclicos, filosofia prática.
EVITE: Futurismo ou tecnologia. Foque no que a história ensina.`,

      futurista: `Você é um FUTURISTA/ANALISTA DE TENDÊNCIAS que projeta cenários através de:
- Análise de tendências sociais, tecnológicas, econômicas
- Padrões emergentes em comportamento coletivo
- Evolução da consciência humana
Fale sobre: tendências futuras, mudanças tecnológicas/sociais, adaptação, inovação.
EVITE: Previsões de curto prazo. Foque em padrões de longo prazo (2+ anos).`
    };

    // ═══════════════════════════════════════════════
    // BASE PROMPT — personalização máxima
    // ═══════════════════════════════════════════════
    const baseSystemPrompt = `${genderInstructions}

REGRAS CRÍTICAS DE PERSONALIZAÇÃO (MÁXIMA PRIORIDADE):
1. USE TODOS OS DADOS — Nome: ${name}, ${age ? `Idade: ${age} anos` : ''}, Tema: ${theme}, Estado: ${state}
2. MENCIONE O NOME "${name}" repetidamente — "${name}, você está..." / "Para você, ${name}..."
3. CONECTE COM A PERGUNTA EXATA — Responda DIRETAMENTE: "${question}"
4. INTEGRE O TEMA — Se tema é "${theme}", TODA a leitura deve focar nisso
5. RECONHEÇA O ESTADO EMOCIONAL — Se está "${state}", adapte o tom e abordagem
${age ? `6. USE A IDADE — ${age} anos é uma fase específica, mencione de forma relevante` : ''}
7. SEJA ULTRA-ESPECÍFICO — Cada frase deve ser PARA ${name} especificamente
8. CREDIBILIDADE — O consulente deve sentir: "Isso é EXATAMENTE para mim"

REGRAS DE TAMANHO E PROFUNDIDADE (CRÍTICO):
- Cada seção JSON deve ter MÍNIMO 300-500 palavras
- Desenvolva COMPLETAMENTE cada ideia com parágrafos longos
- Use múltiplos exemplos e analogias concretas
- Conte uma HISTÓRIA rica e envolvente
- TEXTOS COMPLETOS, jamais resumos superficiais

PALAVRAS PROIBIDAS: "arquétipo", "arquétipos"
NUNCA cite autores, livros, versículos ou fontes específicas por nome.`;

    const prompt = `CONSULENTE: ${name}
DATA DE NASCIMENTO: ${birthdate || 'Não informada'}
${ageText}
SEXO: ${gender || 'Não informado'}
TEMA: ${theme}
ESTADO EMOCIONAL: ${state}
PERGUNTA: ${question}

Forneça uma leitura profunda e personalizada em formato JSON com estas seções:
{
  "revelation": "...",
  "earthFuture": "...",
  "otherCivilizations": "...",
  "technologyFuture": "...",
  "warning": "...",
  "action": "..."
}`;

    // ═══════════════════════════════════════════════
    // SELEÇÃO ALEATÓRIA DE PERSPECTIVAS
    // ═══════════════════════════════════════════════
    const mainPerspectives = ['cientifico', 'historico', 'futurista'].sort(() => Math.random() - 0.5);
    const primary = mainPerspectives[0];
    const secondary = mainPerspectives[1];
    const spiritualComplement = ['espirita', 'cristao'][Math.floor(Math.random() * 2)];

    console.log(`🎯 Perspectivas: ${primary.toUpperCase()} + ${secondary.toUpperCase()} | Espiritual: ${spiritualComplement.toUpperCase()}`);

    // ═══════════════════════════════════════════════
    // FASE 1 + FASE 2 — PARALELAS (economiza ~40s)
    // ═══════════════════════════════════════════════
    console.log('🔵 Fases 1 e 2 iniciando em paralelo...');

    const callAPI = async (systemExtra, label) => {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 12000,
          system: systemExtra + '\n\n' + baseSystemPrompt,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      if (!resp.ok) {
        const errBody = await resp.text().catch(() => resp.statusText);
        throw new Error(`API error ${resp.status} (${label}): ${errBody.slice(0, 200)}`);
      }

      const data = await resp.json();
      return data?.content?.[0]?.text?.trim() || '';
    };

    const [reading1, reading2] = await Promise.all([
      callAPI(systemPrompts[primary], primary),
      callAPI(systemPrompts[secondary], secondary)
    ]);

    console.log('✅ Fases 1 e 2 concluídas');

    // ═══════════════════════════════════════════════
    // FASE 3 — SÍNTESE FINAL
    // ═══════════════════════════════════════════════
    console.log('🔵 Fase 3: Síntese final...');

    const synthesisPrompt = `Você recebeu duas perspectivas PRINCIPAIS sobre a mesma consulta:

PERSPECTIVA ${primary.toUpperCase()} (FOCO PRINCIPAL):
${reading1}

PERSPECTIVA ${secondary.toUpperCase()} (FOCO SECUNDÁRIO):
${reading2}

INSTRUÇÃO CRÍTICA — SINTETIZE em UMA leitura coesa:

1. FOCO PRINCIPAL (70%): Base em ${primary.toUpperCase()} + ${secondary.toUpperCase()}
   - Mantenha linguagem ${primary === 'cientifico' ? 'científica/psicológica' : primary === 'historico' ? 'histórica/filosófica' : 'futurista/analítica'} como PRIORIDADE
   - Use dados, fatos, padrões observáveis
   - Seja extremamente REALISTA e CRÍVEL

2. COMPLEMENTO ESPIRITUAL (30%): Adicione elementos de ${spiritualComplement === 'cristao' ? 'SABEDORIA ESPIRITUAL CRISTÃ CONTEMPLATIVA' : 'PRINCÍPIOS ESPÍRITAS DE EVOLUÇÃO DA ALMA'}
   - Use linguagem universal SEM citar fontes, autores ou versículos
   - Sugira práticas concretas
   - Integre NATURALMENTE, não como seção separada

3. INTEGRAÇÃO:
   - NÃO separe "parte científica" e "parte espiritual"
   - MISTURE naturalmente ao longo do texto
   - Tom maduro, sóbrio e confiável

4. PERSONALIZAÇÃO EXTREMA (OBRIGATÓRIO):
   - CONSULENTE: ${name}
   ${age ? `- IDADE: ${age} anos (SEMPRE relevante!)` : ''}
   - TEMA: ${theme} (FOQUE 100% nisso!)
   - ESTADO EMOCIONAL: ${state} (ADAPTE o tom!)
   - PERGUNTA EXATA: "${question}" (RESPONDA diretamente!)
   - Mencione "${name}" pelo menos 3-5 vezes em CADA seção
   - Consulente deve sentir: "ISSO FOI ESCRITO PARA MIM!"

5. TAMANHO (CRÍTICO):
   - Cada seção: MÍNIMO 300-500 palavras
   - Parágrafos LONGOS e DESENVOLVIDOS
   - Múltiplos exemplos e analogias
   - TEXTOS COMPLETOS, jamais superficiais

PALAVRAS PROIBIDAS: "arquétipo", "arquétipos"
NUNCA cite autores, livros ou versículos por nome.
RESPONDA APENAS COM O JSON — sem texto antes ou depois.

Formato JSON:
{
  "revelation": "...",
  "earthFuture": "...",
  "otherCivilizations": "...",
  "technologyFuture": "...",
  "warning": "...",
  "action": "..."
}`;

    const resp3 = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 16000,
        system: baseSystemPrompt,
        messages: [{ role: 'user', content: synthesisPrompt }]
      })
    });

    if (!resp3.ok) {
      const errBody = await resp3.text().catch(() => resp3.statusText);
      throw new Error(`API error ${resp3.status} (fase3): ${errBody.slice(0, 200)}`);
    }

    const data3 = await resp3.json();
    const refinedText = data3?.content?.[0]?.text?.trim() || reading1;

    console.log('✅ Fase 3 concluída');

    // ═══════════════════════════════════════════════
    // EXTRAI E VALIDA O JSON
    // ═══════════════════════════════════════════════
    let sections;
    try {
      const cleaned = refinedText
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/```\s*$/i, '')
        .replace(/[""]/g, '"')
        .replace(/['']/g, "'")
        .replace(/,\s*([}\]])/g, '$1')
        .trim();

      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      if (firstBrace === -1 || lastBrace === -1) throw new Error('JSON não encontrado');
      sections = JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
    } catch (parseErr) {
      // Fallback: tenta extrair do reading1
      try {
        const fb = reading1.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
        const f1 = fb.indexOf('{'), l1 = fb.lastIndexOf('}');
        sections = JSON.parse(fb.slice(f1, l1 + 1));
      } catch {
        throw new Error(`Não foi possível interpretar a leitura: ${parseErr.message}`);
      }
    }

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

    console.log('✅ Leitura completa gerada com sucesso!');
    return res.status(200).json({ success: true, sections });

  } catch (error) {
    console.error('❌ Erro geral:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro interno do servidor.'
    });
  }
}
