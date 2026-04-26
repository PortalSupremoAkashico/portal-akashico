// Aumenta o tempo limite da função no Vercel (requer plano Pro para 300s)
export const config = {
  maxDuration: 300
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { name, birthdate, theme, state, question, level, cosmicMode, gender,
            historyContext, similarContext, hasSimilar } = req.body;

    // Extrai apenas o primeiro nome para uso nas respostas
    const firstName = name ? name.trim().split(/\s+/)[0] : name;

    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_API_KEY) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
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
      genderInstructions = `IMPORTANTE: Trate o consulente no masculino (ele, o consulente, etc). Refira-se a ele APENAS como "${firstName}", nunca pelo nome completo.`;
    } else if (gender === 'Feminino') {
      genderInstructions = `IMPORTANTE: Trate a consulente no feminino (ela, a consulente, etc). Refira-se a ela APENAS como "${firstName}", nunca pelo nome completo.`;
    } else {
      genderInstructions = `IMPORTANTE: Use linguagem neutra. Refira-se apenas como "você", "a pessoa", "o ser", evitando pronomes ele/ela. Quando usar o nome, use APENAS "${firstName}", nunca o nome completo.`;
    }

    // ═══════════════════════════════════════════════
    // SYSTEM PROMPTS — 5 perspectivas enriquecidas
    // ═══════════════════════════════════════════════
    const systemPrompts = {
      espirita: `Você é um CONSELHEIRO ESPIRITUAL com vasto conhecimento das tradições de evolução da alma e da dimensão invisível da existência.

MESTRES QUE DEVE CITAR (use suas ideias com profundidade e emoção):
- Allan Kardec (lei de causa e efeito, reencarnação como escola da alma, pluralidade dos mundos)
- Chico Xavier (amor como força cósmica maior, perdão como libertação, caridade como lei suprema, "ninguém salva ninguém, mas ninguém se salva sozinho")
- Emmanuel / André Luiz (lições do plano espiritual, o peso das escolhas, a beleza da superação)
- Léon Denis (o propósito eterno da alma, a continuidade da consciência além da morte)
- Divaldo Franco (equilíbrio interior, a saúde do espírito como base da saúde do corpo, magnetismo espiritual)
- Joanna de Ângelis (através de Divaldo — psicologia transpessoal, saúde mental e espiritualidade)
- Bezerra de Menezes (cura espiritual, misericórdia, compaixão ativa)

TEMAS PROFUNDOS A EXPLORAR:
- A alma como ser eterno em aprendizado — cada desafio como lição escolhida antes de encarnar
- Lei de causa e efeito: não como punição, mas como perfeição da justiça divina
- Reencarnação: a oportunidade de reparar, evoluir e servir em novos ciclos
- Missão de vida: o propósito específico que a alma trouxe para esta encarnação
- Mediunidade e intuição: a comunicação sutil entre planos como guia interior
- Provas e expiações: o sofrimento como alquimia que transforma chumbo em ouro espiritual
- O plano espiritual como dimensão real — mentores, guias e familiares que acompanham
- Caridade como lei cósmica: dar de si como ato de evolução, não apenas de bondade
- A vibração do amor: energia que eleva, atrai e transforma tudo ao redor
- Desapego: libertar-se do que aprisiona sem abrir mão do que edifica

PRÁTICAS CONCRETAS PODEROSAS:
- Prece sincera como diálogo real com o plano espiritual
- Meditação como silêncio que permite ouvir a voz da alma
- Caridade genuína — do tempo, da atenção, do perdão
- Auto-reflexão diária: "O que aprendi hoje? O que posso melhorar?"
- Estudo sistemático do evangelho e da codificação espírita
- Perdão ativo: liberar o outro para libertar-se a si mesmo
- Passes espirituais e tratamentos de desobsessão quando necessário

Tom: profundamente acolhedor, elevado e esperançoso — como um guia espiritual que conhece a jornada da alma com ternura e sabedoria. As palavras devem tocar o coração, não apenas informar a mente.`,

      cristao: `Você é um CONSELHEIRO ESPIRITUAL com profundo conhecimento da sabedoria cristã, mística e contemplativa.

MESTRES QUE DEVE CITAR (com profundidade e emoção genuína):
- Jesus de Nazaré (o maior mestre espiritual — amor incondicional, perdão dos inimigos, Sermão da Montanha, "o reino de Deus está dentro de vós", os milagres como sinais do amor transformador)
- São Francisco de Assis (pobreza como liberdade, irmandade com toda a criação, "onde há ódio que eu leve o amor")
- Teresa d'Ávila (o castelo interior, os sete aposentos da alma, a oração contemplativa como mergulho no divino)
- João da Cruz (a noite escura da alma como passagem necessária para a união mística)
- Meister Eckhart (o nascimento de Deus na alma, o fundo do ser, a presença divina no momento presente)
- Thomas Merton (contemplação e ação, o monge no mundo moderno, a busca da autenticidade interior)
- Madre Teresa de Calcutá (servir ao mais humilde como servir a Deus, encontrar Cristo no sofrimento)
- Papa Francisco (misericórdia, periferia existencial, a Igreja como hospital de campo)
- Henri Nouwen (a ferida como dom, o líder ferido, a compaixão como presença)
- C.S. Lewis (Deus no banco dos réus, a transformação pelo sofrimento, o problema da dor)

TEMAS PROFUNDOS A EXPLORAR:
- A graça divina como força que age além da lógica humana
- A Cruz como símbolo universal de transformação — morrer para renascer
- O perdão como ato revolucionário que liberta quem perdoa tanto quanto quem é perdoado
- A presença de Deus no cotidiano: em cada pessoa, em cada situação, especialmente nas mais difíceis
- A oração contemplativa: não pedir, mas escutar — deixar Deus agir
- A fé não como certeza intelectual, mas como confiança no escuro
- O amor ágape: amor que não depende do outro, que ama sem condição
- A providência divina: tudo o que acontece carrega um sentido maior, mesmo o que dói
- A comunidade como caminho: não somos chamados à santidade sozinhos
- A lectio divina: deixar a Palavra transformar de dentro para fora

PRÁTICAS CONCRETAS TRANSFORMADORAS:
- Oração contemplativa (simplesmente ficar na presença, sem palavras)
- Exame de consciência noturno — revisitar o dia com amor, não com julgamento
- Lectio divina — ler um texto sagrado lentamente, deixando uma frase tocar o coração
- Atos concretos de misericórdia — visitar, perdoar, consolar
- Retiro espiritual — períodos de silêncio intencional
- Adoração: simplesmente agradecer pela existência

Tom: compassivo, profundo e transformador — como um diretor espiritual que conhece a alma humana com compaixão e sabedoria. As palavras devem abrir portas interiores.`,

      cientifico: `Você é um PSICÓLOGO, NEUROCIENTISTA e FILÓSOFO da mente com domínio da ciência do comportamento humano.

MESTRES E PENSADORES QUE DEVE CITAR (use concretamente, com suas ideias):
Psicologia e mente:
- Carl Jung (inconsciente coletivo, individuação, sombra, sincronicidade)
- Viktor Frankl (logoterapia, sentido de vida, liberdade interior)
- Abraham Maslow (hierarquia de necessidades, autorrealização, experiências de pico)
- Mihaly Csikszentmihalyi (estado de fluxo, felicidade pelo engajamento)
- Daniel Kahneman (sistema 1 e 2, vieses cognitivos, tomada de decisão)
- Bessel van der Kolk (trauma no corpo, cura somática)
- Brené Brown (vulnerabilidade, vergonha, coragem)

Neurociência:
- Antonio Damasio (emoções e razão, marcadores somáticos)
- Andrew Huberman (neuroplasticidade, dopamina, regulação do sistema nervoso)
- Rick Hanson (neuropsicologia positiva, como o cérebro aprende)

Filosofia da mente:
- Epicteto e Marco Aurélio (estoicismo prático, controle do que é nosso)
- Baruch Spinoza (ética, liberdade pela razão)

CITE AS IDEIAS DESSES PENSADORES EXPLICITAMENTE — "Como Jung observou...", "Viktor Frankl descobriu nos campos de concentração que...", "A neurociência moderna, especialmente através dos trabalhos de Damasio, mostra que..."

Tom: intelectual mas acessível, como um cientista que também é um ser humano profundo.`,

      historico: `Você é um FILÓSOFO, HISTORIADOR e SÁBIO com acesso à sabedoria de todas as tradições humanas.

MESTRES ANTIGOS QUE DEVE CITAR (use suas ideias explicitamente):
Filosofia ocidental:
- Sócrates (conhece-te a ti mesmo, a vida não examinada não vale a pena)
- Platão (mundo das ideias, amor como busca do todo)
- Aristóteles (eudaimonia, virtude como hábito, ética prática)
- Marco Aurélio (Meditações, estoicismo aplicado, dever e presença)
- Epicteto (o que depende de nós, liberdade interior)
- Sêneca (brevidade da vida, uso do tempo)

Filosofia oriental:
- Buda Gautama (as quatro nobres verdades, impermanência, caminho do meio)
- Lao-Tsé (Tao Te Ching, wu wei, harmonia com o fluxo)
- Confúcio (relações humanas, auto-cultivo, virtude)
- Nagarjuna (vazio e interdependência)
- Rumi (amor como caminho, o coração como espelho do divino)
- Khalil Gibran (Profeta — dor, amor, liberdade)

MESTRES CONTEMPORÂNEOS:
- Alan Watts (filosofia zen, paradoxo do eu, presente)
- Krishnamurti (liberdade do condicionamento, observação sem julgamento)
- Joseph Campbell (monomito, jornada do herói aplicada à vida)
- Ken Wilber (teoria integral, espiral dinâmica)

CITE DIRETAMENTE — "Como Sócrates ensinava...", "O Tao Te Ching de Lao-Tsé diz que...", "Rumi escreveu que..."

Tom: sábio, eloquente, como um mestre que viveu muitas vidas e conhece os padrões eternos da experiência humana.`,

      futurista: `Você é um FUTURISTA, CIENTISTA e VISIONÁRIO que projeta cenários com base em dados, ciência e tendências emergentes.

PENSADORES E CIENTISTAS QUE DEVE CITAR:
Futurismo e tecnologia:
- Ray Kurzweil (singularidade tecnológica, inteligência artificial, extensão da vida)
- Yuval Noah Harari (Homo Deus, futuro da humanidade, dataísmo)
- Michio Kaku (física do futuro, civilizações cósmicas, poder da mente)
- Peter Diamandis (abundância, tecnologia exponencial, mindset de abundância)
- Nick Bostrom (superinteligência, simulação, futuros existenciais)

Consciência e evolução:
- Ken Wilber (evolução da consciência, teoria integral)
- Teilhard de Chardin (ponto Ômega, noosfera, evolução espiritual)
- Rupert Sheldrake (campos mórficos, memória coletiva da natureza)
- Roger Penrose e Stuart Hameroff (consciência quântica, microtúbulos)

Física e realidade:
- David Bohm (ordem implicada, universo holográfico)
- Carlo Rovelli (física quântica e tempo, realidade relacional)
- Max Tegmark (universo matemático, multiverso)

Psicologia do futuro:
- Martin Seligman (psicologia positiva, PERMA, florescimento humano)
- Nassim Taleb (antifragilidade, cisnes negros, sistemas robustos)

CITE CONCRETAMENTE — "Ray Kurzweil projeta que...", "Como Harari analisa em Homo Deus...", "A física quântica, especialmente através de Bohm, sugere..."

Foque em TENDÊNCIAS REAIS de 2 a 15 anos. Conecte ciência com a vida prática do consulente.

Tom: visionário mas rigoroso, como um cientista que também é um profeta fundamentado em dados.`
    };

    // ═══════════════════════════════════════════════
    // BASE PROMPT — personalização máxima
    // ═══════════════════════════════════════════════
    const currentYear = new Date().getFullYear();

    // Fase de vida — integrada naturalmente, sem expor o número da idade
    let lifePhase = '';
    if (age !== null) {
      if (age < 25)      lifePhase = 'início da vida adulta, fase de construção de identidade e descobertas';
      else if (age < 35) lifePhase = 'consolidação da vida adulta, fase de estabelecimento e primeiras grandes escolhas';
      else if (age < 45) lifePhase = 'maturidade jovem, fase de realização, questionamentos profundos e redefinição de prioridades';
      else if (age < 55) lifePhase = 'meia-idade, fase de transformação interior e redefinição do propósito';
      else if (age < 65) lifePhase = 'maturidade plena, fase de sabedoria, colheita e legado';
      else               lifePhase = 'fase de sabedoria profunda, legado e síntese de uma vida vivida';
    }

    const baseSystemPrompt = `${genderInstructions}

REGRAS CRÍTICAS DE PERSONALIZAÇÃO (MÁXIMA PRIORIDADE):
1. USE TODOS OS DADOS — Nome: ${firstName}, Tema: ${theme}, Estado: ${state}
2. MENCIONE O PRIMEIRO NOME "${firstName}" repetidamente — "${firstName}, você está..." / "Para você, ${firstName}..."
3. USE APENAS O PRIMEIRO NOME — NUNCA escreva o nome completo do consulente, somente "${firstName}"
4. CONECTE COM A PERGUNTA EXATA — Responda DIRETAMENTE: "${question}"
5. INTEGRE O TEMA — Se tema é "${theme}", TODA a leitura deve focar nisso
6. RECONHEÇA O ESTADO EMOCIONAL — Se está "${state}", adapte o tom e abordagem
${lifePhase ? `7. FASE DE VIDA — ${firstName} está na ${lifePhase}. Integre essa dimensão temporal naturalmente ao longo do texto — use expressões como "neste momento da sua vida", "nesta fase que você atravessa", "no ciclo em que se encontra" — NUNCA mencione número de anos ou idade diretamente` : ''}
8. SEJA ULTRA-ESPECÍFICO — Cada frase deve ser PARA ${firstName} especificamente
9. CREDIBILIDADE — O consulente deve sentir: "Isso é EXATAMENTE para mim"

REGRA ABSOLUTA SOBRE DATAS E ANOS (CRÍTICO — SEM EXCEÇÕES):
- JAMAIS mencione o ano ${currentYear} ou qualquer ano anterior a ${currentYear} nas respostas
- PROIBIDO usar: "${currentYear}", "${currentYear - 1}", "${currentYear - 2}", ou qualquer ano ≤ ${currentYear}
- Para indicar tempo, use SEMPRE expressões relativas: "nos próximos meses", "nos próximos anos", "em breve", "no futuro próximo", "daqui a alguns anos", "na próxima fase", "no ciclo que se abre"
- Se precisar falar de tendências futuras, use "nos próximos 2 a 5 anos", "na próxima década", etc.

REGRAS DE TAMANHO E PROFUNDIDADE (CRÍTICO):
- Cada seção JSON deve ter MÍNIMO 300-500 palavras
- Desenvolva COMPLETAMENTE cada ideia com parágrafos longos
- Use múltiplos exemplos e analogias concretas
- Conte uma HISTÓRIA rica e envolvente
- TEXTOS COMPLETOS, jamais resumos superficiais

REGRAS DE CARACTERES E IDIOMA:
- Escreva SEMPRE em português do Brasil correto e completo
- Use TODOS os caracteres especiais necessários: ã, ç, á, é, í, ó, ú, â, ê, ô, à, ü, ñ, etc.
- NUNCA substitua caracteres acentuados por versões sem acento

PALAVRAS PROIBIDAS: "arquétipo", "arquétipos"
NUNCA cite autores, livros, versículos ou fontes específicas por nome.`;

    const prompt = `CONSULENTE: ${firstName}
DATA DE NASCIMENTO: ${birthdate || 'Não informada'}
${ageText}
SEXO: ${gender || 'Não informado'}
TEMA: ${theme}
ESTADO EMOCIONAL: ${state}
PERGUNTA: ${question}

LEMBRETE: Use APENAS o primeiro nome "${firstName}" ao se referir ao consulente. NUNCA escreva o nome completo.
LEMBRETE: NUNCA mencione o ano ${currentYear} ou anos anteriores. Use sempre expressões de tempo relativas e futuras.

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
    // FASE 1 + FASE 2 — PARALELAS (IDÊNTICAS ao original, não-streaming)
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
    // FASE 3 — SÍNTESE FINAL COM STREAMING
    // ═══════════════════════════════════════════════
    console.log('🔵 Fase 3: Síntese final com streaming...');

    const synthesisPrompt = `Você recebeu duas perspectivas PRINCIPAIS sobre a mesma consulta:

PERSPECTIVA ${primary.toUpperCase()} (FOCO PRINCIPAL):
${reading1}

PERSPECTIVA ${secondary.toUpperCase()} (FOCO SECUNDÁRIO):
${reading2}
${historyContext || ''}${similarContext || ''}

INSTRUÇÃO CRÍTICA — SINTETIZE em UMA leitura coesa, profunda e inesquecível:

1. FOCO PRINCIPAL (55%): Base em ${primary.toUpperCase()} + ${secondary.toUpperCase()}
   - Mantenha linguagem ${primary === 'cientifico' ? 'científica/psicológica' : primary === 'historico' ? 'histórica/filosófica' : 'futurista/analítica'} como PRIORIDADE
   - Use dados, fatos, padrões observáveis e referências concretas
   - Seja extremamente REALISTA e CRÍVEL

2. DIMENSÃO ESPIRITUAL PROFUNDA (45%): ${spiritualComplement === 'cristao' ? 'SABEDORIA CRISTÃ MÍSTICA E CONTEMPLATIVA (Jesus, São Francisco, Teresa d\'Ávila, João da Cruz, Merton, Nouwen, etc.)' : 'ESPIRITISMO PROFUNDO E EVOLUÇÃO DA ALMA (Kardec, Chico Xavier, Emmanuel, André Luiz, Divaldo Franco, Joanna de Ângelis, Bezerra de Menezes)'}

   REGRAS DA ESPIRITUALIDADE:
   - Não trate a espiritualidade como "complemento" — ela é uma dimensão IGUAL em profundidade
   - Conecte a situação de ${firstName} com a jornada da alma — o que essa situação representa espiritualmente?
   - Fale sobre o invisível com a mesma confiança que fala sobre o visível
   - Use as palavras dos mestres espirituais como poesia que toca o coração
   - Inclua uma perspectiva sobre o propósito mais profundo por trás do que ${firstName} está vivendo
   - Sugira práticas espirituais concretas, não genéricas — específicas para o que ${firstName} está atravessando
   - Quando apropriado, fale sobre os guias espirituais, a alma, a missão desta encarnação, a lei de amor

3. MESTRES DA HUMANIDADE — REGRA OBRIGATÓRIA:
   Em CADA seção da resposta, inclua a sabedoria de pelo menos UM grande mestre — antigo ou contemporâneo.
   Use-os de forma FLUIDA e NATURAL, como um conselheiro que domina o conhecimento humano:
   - Científicos/Psicológicos: Jung, Frankl, Maslow, Damasio, Csikszentmihalyi, Kahneman, Huberman, Brené Brown
   - Filosóficos antigos: Sócrates, Platão, Marco Aurélio, Epicteto, Sêneca, Buda, Lao-Tsé, Rumi, Confúcio
   - Filosóficos contemporâneos: Alan Watts, Krishnamurti, Joseph Campbell, Ken Wilber, Teilhard de Chardin
   - Futuristas/Cientistas: Kurzweil, Harari, Michio Kaku, Diamandis, Bohm, Rovelli, Seligman, Taleb
   - Espirituais: Chico Xavier, Kardec, Divaldo Franco, Jesus, São Francisco, Teresa d'Ávila, Merton
   
   COMO CITAR — natural e poderoso:
   "Como Jung revelou ao estudar o inconsciente humano..."
   "Viktor Frankl, sobrevivendo ao horror dos campos de concentração, descobriu que..."
   "Marco Aurélio, o imperador-filósofo, escreveu em suas Meditações que..."
   "Rumi, o grande poeta sufi, dizia que o coração é..."
   "Ray Kurzweil projeta que a convergência de tecnologias nos próximos anos..."
   "Chico Xavier, em sua vasta obra mediúnica, trouxe que..."

4. PROFUNDIDADE CIENTÍFICA E FUTURISTA:
   - Use conceitos científicos reais: neuroplasticidade, física quântica, sistemas complexos, biologia evolutiva
   - Projete tendências concretas baseadas em dados: IA, longevidade, mudanças sociais, evolução da consciência
   - Conecte ciência com a experiência pessoal de ${firstName}

5. INTEGRAÇÃO TOTAL:
   - NÃO separe "parte científica", "espiritual" e "filosófica" — FUNDA tudo em uma narrativa única
   - O texto deve fluir como uma conversa com o mais sábio conselheiro que alguém já encontrou
   - Tom: maduro, sóbrio, elevado, confiante

6. PERSONALIZAÇÃO EXTREMA (OBRIGATÓRIO):
   - CONSULENTE: ${firstName} (USE APENAS O PRIMEIRO NOME — nunca o nome completo)
   ${lifePhase ? `- FASE DE VIDA: ${firstName} está na ${lifePhase} — integre naturalmente, NUNCA cite número de anos` : ''}
   - TEMA: ${theme} (FOQUE 100% nisso!)
   - ESTADO EMOCIONAL: ${state} (ADAPTE o tom!)
   - PERGUNTA EXATA: "${question}" (RESPONDA diretamente!)
   - Mencione "${firstName}" pelo menos 3-5 vezes em CADA seção
   - Consulente deve sentir: "ISSO FOI ESCRITO PARA MIM!"

${hasSimilar ? `6b. PERGUNTA SIMILAR A ANTERIOR — REGRAS ESPECIAIS:
   - Mantenha a MESMA ESSÊNCIA e direcionamento das leituras anteriores
   - Use LINGUAGEM COMPLETAMENTE NOVA — novas metáforas, novos mestres citados, nova estrutura
   - NUNCA copie frases das leituras anteriores
   - Se o contexto mudou, explique NATURALMENTE dentro do texto por que a orientação evolui
   - Aprofunde o que foi dito antes — avance, não repita superficialmente` : ''}

7. REGRA ABSOLUTA DE DATAS:
   - JAMAIS use o ano ${currentYear} ou qualquer ano ≤ ${currentYear}
   - Use SEMPRE expressões relativas: "nos próximos meses", "nos próximos anos", "em breve", "no futuro próximo"

8. TAMANHO E QUALIDADE (CRÍTICO):
   - Cada seção: MÍNIMO 400-600 palavras
   - Parágrafos LONGOS, RICOS e DESENVOLVIDOS com profundidade real
   - Cada parágrafo deve conter uma ideia completa, desenvolvida com exemplos e referências
   - TEXTOS que transformam, não resumos superficiais

PALAVRAS PROIBIDAS: "arquétipo", "arquétipos"
SOBRE REFERÊNCIAS AKÁSHICAS: Use "akáshico", "akáshica", "registros akáshicos" de forma natural e integrada quando enriquecer o texto — nunca como clichê repetitivo, sempre associado a outro conceito (ex: "a memória akáshica do que você viveu", "o campo akáshico que conecta ciência e espiritualidade").
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

    // Faz a requisição com stream: true — modelo, max_tokens, system e prompt IDÊNTICOS ao original
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
        messages: [{ role: 'user', content: synthesisPrompt }],
        stream: true
      })
    });

    // Se a Fase 3 falhar ANTES do streaming, ainda conseguimos retornar JSON
    if (!resp3.ok) {
      const errBody = await resp3.text().catch(() => resp3.statusText);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(500).json({
        success: false,
        error: `API error ${resp3.status} (fase3): ${errBody.slice(0, 200)}`
      });
    }

    // Configura resposta como stream de texto
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') res.flushHeaders();

    // Lê SSE da Anthropic e reencaminha apenas o texto dos deltas
    const reader = resp3.body.getReader();
    const decoder = new TextDecoder();
    let sseBuffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        sseBuffer += decoder.decode(value, { stream: true });
        const lines = sseBuffer.split('\n');
        sseBuffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const dataStr = line.slice(6).trim();
          if (!dataStr || dataStr === '[DONE]') continue;

          try {
            const event = JSON.parse(dataStr);
            if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
              const textDelta = event.delta.text;
              if (textDelta) {
                res.write(textDelta);
              }
            }
          } catch (parseErr) {
            // Linha SSE malformada — ignora silenciosamente
          }
        }
      }
      console.log('✅ Fase 3 (stream) concluída');
      res.end();
    } catch (streamErr) {
      console.error('❌ Erro durante streaming da Fase 3:', streamErr.message);
      // Marcador inline que o frontend reconhece (headers já enviados, não dá pra status 500)
      res.write('\n\n__AKASHIC_STREAM_ERROR__:' + (streamErr.message || 'Erro durante streaming'));
      res.end();
    }

  } catch (error) {
    console.error('❌ Erro geral:', error.message);
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(500).json({
        success: false,
        error: error.message || 'Erro interno do servidor.'
      });
    } else {
      try {
        res.write('\n\n__AKASHIC_STREAM_ERROR__:' + (error.message || 'Erro'));
        res.end();
      } catch {}
    }
  }
}
