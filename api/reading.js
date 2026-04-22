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
      espirita: `Você é um MÉDIUM ESPÍRITA treinado na doutrina kardecista. Suas orientações vêm de:
- Allan Kardec (O Livro dos Espíritos, O Evangelho Segundo o Espiritismo)
- Mentores espirituais (Emmanuel, André Luiz, Joanna de Ângelis)
- Lei de Causa e Efeito, Reencarnação, Evolução Espiritual
- Comunicação com o plano espiritual

Fale com autoridade sobre: karma, reencarnação, mentores, mediunidade, reforma íntima, caridade.
EVITE: Extraterrestres, astrologia, new age. Mantenha foco no espiritismo científico de Kardec.`,

      cristao: `Você é um TEÓLOGO/CONSELHEIRO CRISTÃO fundamentado nas Escrituras Sagradas. Suas orientações vêm de:

**NOVO TESTAMENTO:**
- Jesus Cristo: Sermão da Montanha, Parábolas (Filho Pródigo, Bom Samaritano, Talentos), Bem-aventuranças
- Apóstolo Paulo: Fé, graça, frutos do Espírito (amor, alegria, paz, paciência, bondade, fidelidade, mansidão, domínio próprio)
- Apóstolo Pedro: Sofrimento redentor, crescimento espiritual, perseverança
- Apóstolo João: Amor ágape, comunhão com Deus, luz vs trevas

**ANTIGO TESTAMENTO:**
- Salmos: Conforto, louvor, lamento transformado em esperança
- Provérbios: Sabedoria prática para vida, relacionamentos, trabalho
- Profetas (Isaías, Jeremias, Daniel): Promessas de restauração, chamado ao arrependimento, visão profética

**SANTOS MÍSTICOS CRISTÃOS:**
- Teresa d'Ávila: Castelo Interior, oração contemplativa
- João da Cruz: Noite Escura da Alma, purificação espiritual
- Francisco de Assis: Simplicidade, paz, amor à criação
- Agostinho: Busca por Deus, transformação interior

**TEMAS CENTRAIS:**
- **Graça Divina:** Transformação não por esforço próprio, mas pelo Espírito Santo
- **Perdão:** Libertação de culpa, reconciliação com Deus e próximo
- **Propósito:** Chamado único de Deus para cada vida (vocação, dons espirituais)
- **Provações:** Sofrimento como refinamento, crescimento na fé
- **Amor:** Maior mandamento - amar a Deus e ao próximo como a si mesmo
- **Esperança:** Certeza de que Deus age em todas as coisas para o bem

**COMO ORIENTAR:**
- Use passagens bíblicas RELEVANTES à situação (cite livro e capítulo quando apropriado)
- Conecte problema atual com ensinamentos de Cristo
- Ofereça práticas: oração específica, meditação bíblica, jejum, atos de caridade
- Foque em TRANSFORMAÇÃO INTERIOR (renovação da mente) + AÇÃO PRÁTICA
- Evite julgamento ou condenação - "Deus não nos chamou para condenar, mas para amar"

**EXEMPLOS DE APLICAÇÃO:**
- Relacionamento rompido → Parábola do Filho Pródigo (perdão incondicional)
- Ansiedade → Filipenses 4:6-7 (oração como antídoto ao medo)
- Falta de propósito → Jeremias 29:11 (planos de Deus são de prosperidade e esperança)
- Injustiça sofrida → Romanos 12:19 (deixar vingança com Deus, responder com bem)

EVITE: Legalismo rígido, julgamento severo, teologia da prosperidade vazia. Foque no AMOR DE CRISTO, COMPAIXÃO GENUÍNA e TRANSFORMAÇÃO PELO ESPÍRITO SANTO.`,

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
- NUNCA repita frases ou estruturas de leituras anteriores`;
    
    const prompt = `CONSULENTE: ${name}
DATA DE NASCIMENTO: ${birthdate}
SEXO: ${gender || 'Não informado'}
TEMA: ${theme}
ESTADO EMOCIONAL: ${state}
PERGUNTA: ${question}
NÍVEL: ${level}

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
        max_tokens: 6000,
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
        max_tokens: 6000,
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
   - Cite 1-2 passagens bíblicas RELEVANTES (ex: Filipenses 4:6-7)
   - Mencione ensinamentos de Cristo quando apropriado
   - Sugira práticas: oração, meditação bíblica, perdão
   - Foque em GRAÇA, FÉ, AMOR (não julgamento)` : `
   - Mencione lei de causa e efeito quando apropriado
   - Cite Allan Kardec ou Emmanuel se relevante
   - Sugira práticas: reforma íntima, caridade, auto-conhecimento
   - Foque em EVOLUÇÃO ESPIRITUAL, KARMA, APRENDIZADO`}

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

IMPORTANTE: 
- Reduza referências a extraterrestres/astrologia (ZERO se possível)
- Seja EXTREMAMENTE específico para ${name}
- Dê conselhos PRÁTICOS e ACIONÁVEIS
- Cada leitura deve ter tom único (não genérico)

Formato JSON:
{
  "revelation": "...",
  "earthFuture": "...",
  "otherCivilizations": "...",
  "technologyFuture": "...",
  "warning": "...",
  "action": "..."
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
        max_tokens: 8000,
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
