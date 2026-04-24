export const config = { maxDuration: 300 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ success: false, error: 'API key não configurada.' });
  }

  try {
    const { name, birthdate, theme, state, question, level, cosmicMode, gender } = req.body;
    const firstName = name ? name.trim().split(/\s+/)[0] : name;

    // ── Idade ──
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
        ageText = `IDADE ATUAL: ${age} anos`;
      }
    }

    // ── Gênero ──
    let genderInstructions = '';
    if (gender === 'Masculino') {
      genderInstructions = `IMPORTANTE: Trate o consulente no masculino. Use APENAS o primeiro nome "${firstName}".`;
    } else if (gender === 'Feminino') {
      genderInstructions = `IMPORTANTE: Trate a consulente no feminino. Use APENAS o primeiro nome "${firstName}".`;
    } else {
      genderInstructions = `IMPORTANTE: Use linguagem neutra. Use APENAS "${firstName}" ao se referir à pessoa.`;
    }

    const systemPrompts = {
      espirita: `Você é um CONSELHEIRO ESPIRITUAL fundamentado em princípios de evolução da alma.
NUNCA CITE: nomes de autores, títulos de livros, termos técnicos específicos.
USE LINGUAGEM UNIVERSAL: "A lei espiritual nos mostra...", "Segundo princípios de evolução da alma..."
TEMAS: Lei de causa e efeito, reencarnação, evolução espiritual, reforma interior, caridade, intuição, propósito.`,

      cristao: `Você é um CONSELHEIRO ESPIRITUAL fundamentado em sabedoria cristã contemplativa.
NUNCA CITE: livros bíblicos, versículos, nomes de santos.
USE LINGUAGEM UNIVERSAL: "Os ensinamentos espirituais nos mostram...", "A sabedoria antiga revela..."
TEMAS: Graça divina, transformação interior, perdão, amor incondicional, fé e esperança.`,

      cientifico: `Você é um PSICÓLOGO/NEUROCIENTISTA. Analise padrões humanos via Jung, Frankl, neurociência.
Fale sobre: padrões comportamentais, traumas, bloqueios, neuroplasticidade, propósito. Base em ciência.`,

      historico: `Você é um HISTORIADOR/FILÓSOFO. Enxergue padrões via civilizações antigas, filosofia oriental.
Fale sobre: lições históricas, padrões cíclicos, filosofia prática. Foque no que a história ensina.`,

      futurista: `Você é um FUTURISTA/ANALISTA DE TENDÊNCIAS. Projete cenários via tendências sociais e tecnológicas.
Fale sobre: tendências futuras, mudanças, adaptação. Foque em padrões de longo prazo (2+ anos).`
    };

    const currentYear = new Date().getFullYear();

    const baseSystemPrompt = `${genderInstructions}

REGRAS CRÍTICAS DE PERSONALIZAÇÃO:
1. Use APENAS o primeiro nome "${firstName}" — NUNCA o nome completo
2. Mencione "${firstName}" pelo menos 3-5 vezes
3. Conecte DIRETAMENTE com a pergunta: "${question}"
4. Integre o tema: "${theme}" em toda a resposta
5. Adapte o tom ao estado emocional: "${state}"
${age ? `6. Mencione ${age} anos quando relevante` : ''}

REGRA ABSOLUTA DE DATAS: JAMAIS mencione o ano ${currentYear} ou anteriores.
Use SEMPRE expressões relativas: "nos próximos meses", "em breve", "no futuro próximo".

TAMANHO: Mínimo 300-500 palavras. Parágrafos longos e desenvolvidos.
IDIOMA: Português do Brasil correto com todos os acentos.
PROIBIDO: "arquétipo", "arquétipos". NUNCA cite autores ou livros por nome.`;

    const consultantInfo = `CONSULENTE: ${firstName}
DATA DE NASCIMENTO: ${birthdate || 'Não informada'}
${ageText}
SEXO: ${gender || 'Não informado'}
TEMA: ${theme}
ESTADO EMOCIONAL: ${state}
PERGUNTA: ${question}`;

    // ── Perspectivas aleatórias ──
    const mainPerspectives = ['cientifico', 'historico', 'futurista'].sort(() => Math.random() - 0.5);
    const primary = mainPerspectives[0];
    const secondary = mainPerspectives[1];
    const spiritualComplement = ['espirita', 'cristao'][Math.floor(Math.random() * 2)];
    console.log(`🎯 ${primary} + ${secondary} | ${spiritualComplement}`);

    // ── FASES 1 e 2: paralelas (idênticas ao original) ──
    const callAPI = async (systemExtra, label) => {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 12000,
          system: systemExtra + '\n\n' + baseSystemPrompt,
          messages: [{ role: 'user', content: consultantInfo + '\n\nFaça uma leitura profunda e personalizada.' }]
        })
      });
      if (!resp.ok) throw new Error(`API ${resp.status} (${label})`);
      const data = await resp.json();
      return data?.content?.[0]?.text?.trim() || '';
    };

    const [reading1, reading2] = await Promise.all([
      callAPI(systemPrompts[primary], primary),
      callAPI(systemPrompts[secondary], secondary)
    ]);

    console.log('✅ Fases 1+2 concluídas — iniciando 6 seções em paralelo');

    // ── FASE 3: 6 seções em paralelo, cada uma com stream próprio ──
    //
    // Protocolo de saída (newline-delimited JSON):
    //   chunk de texto:  {"s":"chave","t":"texto"}\n
    //   seção concluída: {"s":"chave","done":true}\n
    //   erro de seção:   {"s":"chave","error":"msg"}\n
    //   erro global:     {"error":"msg"}\n

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') res.flushHeaders();

    const context = `PERSPECTIVA ${primary.toUpperCase()} (principal — 70% do conteúdo):
${reading1}

PERSPECTIVA ${secondary.toUpperCase()} (secundária — 30% do conteúdo):
${reading2}

COMPLEMENTO ESPIRITUAL: ${spiritualComplement === 'cristao' ? 'sabedoria cristã contemplativa' : 'princípios espíritas de evolução da alma'}
Integre naturalmente ao longo do texto — sem separar em seção, sem citar fontes por nome.

${consultantInfo}`;

    const sectionInstructions = {
      revelation: `Escreva a REVELAÇÃO PRINCIPAL desta leitura akáshica para ${firstName}.
Esta é a seção mais importante — a revelação central sobre a situação atual.
Revele padrões profundos, bloqueios, forças ocultas e o que os registros mostram sobre este momento.
Responda diretamente à pergunta "${question}" sobre o tema "${theme}".
Inicie diretamente com "${firstName}" sem introduções. Tom: profundo, revelador, empático.`,

      earthFuture: `Escreva a seção FUTURO para ${firstName}.
Projete o futuro com base nos padrões atuais e no tema "${theme}".
Mostre os caminhos que se abrem, possibilidades concretas e transformações que virão.
Responda: qual é o futuro de ${firstName} em relação a "${question}"?
Use expressões temporais relativas (próximos meses, próximos anos). Tom: visionário mas realista.`,

      otherCivilizations: `Escreva a seção MENTORES para ${firstName}.
Fale sobre as forças mentoras, guias, sabedorias ancestrais e influências elevadas na jornada de ${firstName}.
Que ensinamentos e perspectivas profundas se aplicam ao tema "${theme}" e à pergunta "${question}"?
Tom: elevado, sábio, conectado com tradições e conhecimentos profundos.`,

      technologyFuture: `Escreva a seção COEXISTÊNCIA para ${firstName}.
Aborde como ${firstName} se relaciona com o coletivo, o mundo, as mudanças sociais e evolutivas.
Como o tema "${theme}" se conecta com as transformações do mundo e como ${firstName} navega isso?
Responda em relação a "${question}". Tom: expansivo, integrador, conectado com o todo.`,

      warning: `Escreva a seção ADVERTÊNCIA para ${firstName}.
Com cuidado e compaixão, aponte os padrões de atenção, riscos e pontos cegos a observar.
O que precisa ser observado ou transformado em relação ao tema "${theme}" e à pergunta "${question}"?
Tom: compassivo e direto, sem alarmismo — foco em crescimento e discernimento.`,

      action: `Escreva a seção AÇÃO para ${firstName}.
Ofereça orientações práticas, concretas e aplicáveis.
O que ${firstName} pode fazer agora, nos próximos dias e no próximo ciclo em relação a "${theme}"?
Responda diretamente à pergunta "${question}". Tom: prático, encorajador, acionável.`
    };

    const streamSection = async (sectionKey) => {
      try {
        const resp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 2500,
            system: baseSystemPrompt,
            messages: [{
              role: 'user',
              content: `${context}\n\n---\n${sectionInstructions[sectionKey]}\n\nEscreva APENAS o texto da seção — sem títulos, sem JSON, sem marcadores de seção.`
            }],
            stream: true
          })
        });

        if (!resp.ok) {
          const errText = await resp.text().catch(() => resp.statusText);
          res.write(JSON.stringify({ s: sectionKey, error: `Erro ${resp.status}` }) + '\n');
          return;
        }

        const reader = resp.body.getReader();
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
                res.write(JSON.stringify({ s: sectionKey, t: ev.delta.text }) + '\n');
              }
            } catch {}
          }
        }
        res.write(JSON.stringify({ s: sectionKey, done: true }) + '\n');
      } catch (err) {
        try { res.write(JSON.stringify({ s: sectionKey, error: err.message }) + '\n'); } catch {}
      }
    };

    // Todas as 6 seções começam ao mesmo tempo
    await Promise.all(Object.keys(sectionInstructions).map(key => streamSection(key)));

    console.log('✅ 6 seções concluídas');
    res.end();

  } catch (error) {
    console.error('❌ Erro:', error.message);
    if (!res.headersSent) {
      return res.status(500).json({ success: false, error: error.message });
    }
    try { res.write(JSON.stringify({ error: error.message }) + '\n'); res.end(); } catch {}
  }
}
