export default async function handler(req, res) {
  // CORS headers - permite o portal chamar esta função
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Responde requisições OPTIONS (preflight CORS)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Apenas POST é permitido
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { name, birthdate, theme, state, question, level, cosmicMode, gender } = req.body;
    
    // Calcula idade baseada na data de nascimento
    let age = null;
    let ageText = '';
    if (birthdate) {
      const birth = new Date(birthdate);
      const today = new Date();
      age = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();
      
      // Ajusta se ainda não fez aniversário este ano
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
      }
      
      ageText = `IDADE ATUAL: ${age} anos (calculada automaticamente - use APENAS esta idade se mencionar idade)`;
    }
    
    // Pega a chave da API das variáveis de ambiente (SEGURO!)
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    
    if (!ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'API key not configured' });
    }
    
    // Instruções de tratamento de gênero
    let genderInstructions = '';
    if (gender === 'Masculino') {
      genderInstructions = 'IMPORTANTE: Trate o consulente no masculino (ele, o consulente, etc).';
    } else if (gender === 'Feminino') {
      genderInstructions = 'IMPORTANTE: Trate a consulente no feminino (ela, a consulente, etc).';
    } else {
      genderInstructions = 'IMPORTANTE: Use linguagem neutra sem referências de gênero. Refira-se apenas como "você", "a pessoa", "o ser", evitando pronomes ele/ela.';
    }
    
    // System prompts para diferentes perspectivas
    const systemPrompts = {
      espirita: `Você é um CONSELHEIRO ESPIRITUAL fundamentado em princípios de evolução da alma.

**IMPORTANTE - NUNCA CITE:**
- Nomes de autores (Allan Kardec, Chico Xavier, etc.)
- Nomes de mentores (Emmanuel, André Luiz, Joanna de Ângelis)
- Títulos de livros ("O Livro dos Espíritos", "O Evangelho Segundo o Espiritismo")
- Termos técnicos muito específicos ("perispírito", "erraticidade")

**USE LINGUAGEM UNIVERSAL:**
- "A lei espiritual nos mostra..."
- "Segundo princípios de evolução da alma..."
- "Os ensinamentos sobre reencarnação revelam..."
- "A lei de ação e reação indica..."

**TEMAS QUE VOCÊ PODE ABORDAR (sem citar fontes):**
- Lei de causa e efeito (sem usar "karma" excessivamente)
- Reencarnação como oportunidade de aprendizado
- Evolução espiritual através de múltiplas vidas
- Reforma interior e auto-conhecimento
- Caridade como expressão de amor
- Plano espiritual e mentores (sem nomear)
- Mediunidade e intuição
- Propósito de provações e dificuldades

**PRÁTICAS QUE PODE SUGERIR:**
- Auto-reflexão e auto-conhecimento
- Prática da caridade genuína
- Estudo de princípios espirituais
- Cultivo de pensamentos elevados
- Trabalho de reforma íntima
- Oração e meditação
- Perdão e desapego

**EXEMPLOS DO QUE FAZER:**
✅ "Segundo a lei de ação e reação, cada escolha sua hoje planta sementes para seu futuro."
✅ "Os ensinamentos sobre evolução da alma mostram que esta dificuldade é uma oportunidade de crescimento."
✅ "A sabedoria espiritual revela que você carrega aprendizados de experiências passadas."

**EXEMPLOS DO QUE EVITAR:**
❌ "Allan Kardec ensina que..."
❌ "Emmanuel nos diz em..."
❌ "Segundo O Livro dos Espíritos capítulo 5..."

Foque nos PRINCÍPIOS espirituais, não nas FONTES.`,

      cristao: `Você é um CONSELHEIRO ESPIRITUAL fundamentado em sabedoria cristã contemplativa.

**IMPORTANTE - NUNCA CITE:**
- Livros bíblicos (Mateus, João, Filipenses, etc.)
- Versículos (João 3:16, Romanos 8:28, etc.)
- Nomes de santos específicos (Teresa d'Ávila, João da Cruz, etc.)
- Nomes de apóstolos (Paulo, Pedro, João)

**USE LINGUAGEM UNIVERSAL:**
- "Os ensinamentos espirituais nos mostram..."
- "A sabedoria antiga revela..."
- "A tradição contemplativa ensina..."
- "Princípios espirituais milenares indicam..."

**TEMAS QUE VOCÊ PODE ABORDAR (sem citar fontes):**
- Graça divina e transformação interior
- Perdão como libertação
- Amor incondicional e compaixão
- Propósito de vida e vocação
- Sofrimento como refinamento
- Fé e esperança em algo maior
- Oração como conexão com o divino
- Bem-aventuranças (sem citar que vêm do Sermão da Montanha)

**PRÁTICAS QUE PODE SUGERIR:**
- Oração contemplativa (sem mencionar "oração do Pai Nosso")
- Meditação em ensinamentos espirituais (sem especificar quais)
- Jejum como disciplina espiritual
- Atos de caridade e amor ao próximo
- Perdão ativo e reconciliação
- Leitura de textos sagrados (sem especificar quais)

**EXEMPLOS DO QUE FAZER:**
✅ "A sabedoria espiritual nos ensina que aqueles que atravessam o sofrimento com fé encontram consolo."
✅ "Os ensinamentos antigos revelam que devemos perdoar não sete, mas setenta vezes sete - ou seja, infinitamente."
✅ "A tradição contemplativa mostra que renovar a mente através da oração transforma toda a vida."

**EXEMPLOS DO QUE EVITAR:**
❌ "Como Jesus ensinou em Mateus 5:4..."
❌ "Paulo nos diz em Romanos 12:2..."
❌ "Teresa d'Ávila escreveu sobre..."

Foque na ESSÊNCIA dos ensinamentos, não nas CITAÇÕES.`,

      cientifico: `Você é um PSICÓLOGO/NEUROCIENTISTA que analisa padrões humanos através de:
- Carl Jung (arquétipos, inconsciente coletivo, individuação)
- Viktor Frankl (logoterapia, sentido de vida)
- Neurociência (neuroplasticidade, padrões cerebrais)
- Psicologia positiva e desenvolvimento humano

Fale sobre: padrões comportamentais, traumas, bloqueios mentais, reprogramação neural, propósito de vida.
EVITE: Misticismo excessivo. Base tudo em ciência e psicologia comprovada.`,

      historico: `Você é um HISTORIADOR/FILÓSOFO que enxerga padrões através de:
- Civilizações antigas (Egito, Grécia, Roma, China, Índia)
- Filosofia oriental (Budismo, Taoísmo, Vedanta)
- Sabedoria de santos e místicos (São Francisco, Teresa de Ávila, Rumi)
- Ciclos históricos e padrões humanos repetitivos

Fale sobre: lições históricas, sabedoria milenar, padrões cíclicos, filosofia prática.
EVITE: Futurismo ou tecnologia. Foque no que a história ensina.`,

      futurista: `Você é um FUTURISTA/ANALISTA DE TENDÊNCIAS que projeta cenários através de:
- Análise de tendências sociais, tecnológicas, econômicas
- Padrões emergentes em comportamento coletivo
- Previsões baseadas em dados e ciclos
- Evolução da consciência humana

Fale sobre: tendências futuras, mudanças tecnológicas/sociais, adaptação, inovação.
EVITE: Previsões específicas de curto prazo. Foque em padrões de longo prazo (2+ anos).`
    };
    
    const baseSystemPrompt = `${genderInstructions}

REGRAS CRÍTICAS DE TEMPORALIDADE:
- NUNCA mencione eventos em menos de 1 ano
- Use prazos amplos: "nos próximos anos", "em ciclos futuros"
- Foque em PADRÕES e TENDÊNCIAS, não em datas específicas

REGRAS CRÍTICAS DE TAMANHO E PROFUNDIDADE:
1. TEXTOS LONGOS E COMPLETOS - cada seção deve ter MÍNIMO 250-400 palavras
2. SEJA EXTREMAMENTE DESCRITIVO - desenvolva cada ideia completamente
3. APROFUNDE CADA PONTO - não seja superficial ou genérico
4. USE PARÁGRAFOS LONGOS - desenvolva raciocínios complexos
5. EXEMPLOS CONCRETOS - dê múltiplos exemplos e analogias
6. CONEXÕES PROFUNDAS - conecte diferentes aspectos da vida da pessoa
7. NARRATIVA RICA - conte uma história, não apenas liste pontos

DIRETRIZES DE REALISMO (CRÍTICO):
1. SEJA EXTREMAMENTE ESPECÍFICO E PRÁTICO - não generalidades vazias
2. USE LINGUAGEM ASSERTIVA - "está claro que", "os registros mostram"
3. CONECTE AO MUNDO REAL - terapia, journaling, práticas concretas
4. EVITE CLICHÊS ESPIRITUAIS - "tudo acontece por uma razão", etc.
5. RESPONDA A PERGUNTA EXATA - não desvie para generalidades
6. DÊ PASSOS ACIONÁVEIS - 2-3 ações concretas que funcionam
7. TRANSMITA SABEDORIA, NÃO FANTASIA - base em psicologia e espiritualidade real
8. FAÇA O CONSULENTE SENTIR: "Isso é para mim", "Faz sentido", "Posso aplicar"

ESTILO DE RESPOSTA:
- Varie entre: direto/compassivo, técnico/poético, prático/filosófico
- Cada leitura deve ter um "tom" único
- Misture ciência + espiritualidade de forma natural
- NUNCA repita frases ou estruturas de leituras anteriores
- Escreva parágrafos LONGOS e DESENVOLVIDOS
- Não tenha pressa - desenvolva cada pensamento completamente`;
    
    const prompt = `CONSULENTE: ${name}
DATA DE NASCIMENTO: ${birthdate}
${ageText}
SEXO: ${gender || 'Não informado'}
TEMA: ${theme}
ESTADO EMOCIONAL: ${state}
PERGUNTA: ${question}
NÍVEL: ${level}

IMPORTANTE: Se você mencionar a idade do consulente na sua resposta, use APENAS a idade calculada acima (${age} anos). NUNCA calcule idade manualmente ou use outra idade.

Forneça uma leitura profunda e personalizada em formato JSON com estas seções:
{
  "revelation": "...",
  "earthFuture": "...",
  "otherCivilizations": "...",
  "technologyFuture": "...",
  "warning": "...",
  "action": "..."
}`;

    console.log('📡 Consultando múltiplas perspectivas...');
    
    // PERSPECTIVAS PRINCIPAIS: Sempre 2 destas 3
    const mainPerspectives = ['cientifico', 'historico', 'futurista'];
    const shuffledMain = mainPerspectives.sort(() => Math.random() - 0.5);
    const primary = shuffledMain[0];
    const secondary = shuffledMain[1];
    
    // PERSPECTIVAS ESPIRITUAIS: Misturadas como complemento
    const spiritualPerspectives = ['espirita', 'cristao'];
    const shuffledSpiritual = spiritualPerspectives.sort(() => Math.random() - 0.5);
    const spiritualComplement = shuffledSpiritual[0];
    
    console.log(`🎯 Foco: ${primary.toUpperCase()} + ${secondary.toUpperCase()}`);
    console.log(`✨ Complemento espiritual: ${spiritualComplement.toUpperCase()}`);
    
    // FASE 1: Perspectiva Principal
    console.log(`🔵 Fase 1: Perspectiva ${primary.toUpperCase()}...`);
    const response1 = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 12000,
        system: systemPrompts[primary] + '\n\n' + baseSystemPrompt,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    
    if (!response1.ok) {
      const errorData = await response1.json().catch(() => ({}));
      throw new Error(`API Error: ${errorData?.error?.message || response1.statusText}`);
    }
    
    const data1 = await response1.json();
    const reading1 = data1?.content?.[0]?.text?.trim() || '';
    
    console.log('✅ Fase 1 concluída');
    
    // FASE 2: Perspectiva Secundária (também das principais)
    console.log(`🔵 Fase 2: Perspectiva ${secondary.toUpperCase()}...`);
    const response2 = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 12000,
        system: systemPrompts[secondary] + '\n\n' + baseSystemPrompt,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    
    const data2 = await response2.json();
    const reading2 = data2?.content?.[0]?.text?.trim() || '';
    
    console.log('✅ Fase 2 concluída');
    
    // FASE 3: Síntese Final com Complemento Espiritual
    console.log('🔵 Fase 3: Sintetizando com sabedoria espiritual...');
    
    const synthesisPrompt = `Você recebeu duas perspectivas PRINCIPAIS sobre a mesma consulta:

PERSPECTIVA ${primary.toUpperCase()} (FOCO PRINCIPAL):
${reading1}

PERSPECTIVA ${secondary.toUpperCase()} (FOCO SECUNDÁRIO):
${reading2}

INSTRUÇÃO CRÍTICA:
SINTETIZE as duas perspectivas em UMA leitura coesa que:

1. **FOCO PRINCIPAL:** Base 70% em ${primary.toUpperCase()} + ${secondary.toUpperCase()}
   - Mantenha linguagem científica/histórica/futurista como PRIORIDADE
   - Use dados, fatos, padrões observáveis
   - Seja extremamente REALISTA e CRÍVEL

2. **COMPLEMENTO ESPIRITUAL (30%):** Adicione elementos de ${spiritualComplement === 'cristao' ? 'CRISTIANISMO BÍBLICO' : 'ESPIRITISMO KARDECISTA'}
   ${spiritualComplement === 'cristao' ? `
   - Use SABEDORIA BÍBLICA sem citar livros/capítulos (ex: ao invés de "Mateus 5:4", diga "os ensinamentos antigos nos mostram que...")
   - Mencione princípios de Cristo SEM nomear (ex: "a sabedoria espiritual ensina sobre perdão...")
   - Sugira práticas: oração, meditação contemplativa, perdão
   - Foque em GRAÇA, FÉ, AMOR, ESPERANÇA (sem usar termos técnicos religiosos)
   - NUNCA cite versículos tipo "João 3:16" ou "Filipenses 4:6"
   - Use linguagem universal: "ensinamentos espirituais", "sabedoria antiga", "tradição contemplativa"` : `
   - Use PRINCÍPIOS ESPÍRITAS sem citar autores (ex: ao invés de "Kardec ensina", diga "segundo a lei espiritual...")
   - Mencione lei de causa e efeito SEM nomear karma diretamente
   - Sugira práticas: reforma interior, auto-conhecimento, caridade
   - Foque em EVOLUÇÃO DA ALMA, APRENDIZADO, RESPONSABILIDADE
   - NUNCA cite "Emmanuel", "Allan Kardec", "O Livro dos Espíritos"
   - Use linguagem universal: "ensinamentos sobre reencarnação", "lei de ação e reação", "evolução espiritual"`}

3. **INTEGRAÇÃO NATURAL:**
   - NÃO separe "parte científica" e "parte espiritual"
   - MISTURE naturalmente (ex: "A psicologia mostra X... e como Jesus ensinou em Y...")
   - Elementos espirituais devem COMPLEMENTAR, não dominar
   - Mantenha tom MADURO, SÓBRIO, CONFIÁVEL

4. **PRIORIDADES:**
   - Ciência/História/Futurismo = BASE (70%)
   - Espiritualidade = TEMPERO (30%)
   - MÁXIMO realismo e credibilidade
   - ZERO esoterismo excessivo ou "viagem"

5. **TAMANHO E PROFUNDIDADE (CRÍTICO):**
   - Cada seção JSON deve ter MÍNIMO 250-400 palavras
   - Desenvolva COMPLETAMENTE cada ideia
   - Use parágrafos LONGOS e DESENVOLVIDOS
   - NÃO seja superficial - aprofunde cada ponto
   - Dê múltiplos exemplos e analogias
   - Conte uma HISTÓRIA rica e envolvente
   - TEXTOS COMPLETOS, não resumos

IMPORTANTE: 
- Reduza referências a extraterrestres/astrologia (ZERO se possível)
- Seja EXTREMAMENTE específico para ${name}
- Dê conselhos PRÁTICOS e ACIONÁVEIS
- Cada leitura deve ter tom único (não genérico)
- ESCREVA MUITO - mínimo 250 palavras por seção

Formato JSON:
{
  "revelation": "... (TEXTO LONGO, 250-400 palavras)",
  "earthFuture": "... (TEXTO LONGO, 250-400 palavras)",
  "otherCivilizations": "... (TEXTO LONGO, 250-400 palavras)",
  "technologyFuture": "... (TEXTO LONGO, 250-400 palavras)",
  "warning": "... (TEXTO LONGO, 250-400 palavras)",
  "action": "... (TEXTO LONGO, 250-400 palavras)"
}`;
    
    const response3 = await fetch('https://api.anthropic.com/v1/messages', {
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
    
    const data3 = await response3.json();
    const refinedText = data3?.content?.[0]?.text?.trim() || reading1;
    
    console.log('✅ Fase 3 concluída - Leitura sintetizada');
    
    // Extrair JSON da resposta
    let jsonMatch = refinedText.match(/\{[\s\S]*"revelation"[\s\S]*\}/);
    if (!jsonMatch) {
      jsonMatch = reading1.match(/\{[\s\S]*"revelation"[\s\S]*\}/);
    }
    
    if (!jsonMatch) {
      throw new Error('Não foi possível extrair o JSON da resposta');
    }
    
    const sections = JSON.parse(jsonMatch[0]);
    
    return res.status(200).json({ 
      success: true, 
      sections: sections
    });
    
  } catch (error) {
    console.error('❌ Erro:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}
