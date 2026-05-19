export const config = { maxDuration: 120 };

const SUPABASE_URL = 'https://opykejeaxehvzogrrwto.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

async function sbSalvarTaro(email, dados) {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/leituras_taro`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ email, dados: JSON.stringify(dados) })
    });
    if (!r.ok) {
      const err = await r.text();
      console.error('Supabase taro save error:', r.status, err.slice(0,200));
    }
  } catch(e) {
    console.error('sbSalvarTaro error:', e.message);
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { nome, sexo, cartas, tiragem, pergunta, email } = req.body || {};
  if (!cartas || !cartas.length) return res.status(400).json({ error: 'Cartas obrigatórias.' });

  const firstName = (nome || 'Alma').trim().split(/\s+/)[0];
  const perguntaReal = pergunta || 'leitura livre';

  const cartasTexto = cartas.map((c, i) =>
    `${i+1}. Posição "${c.posicao}": ${c.nome}${c.invertida ? ' (INVERTIDA)' : ''}`
  ).join('\n');

  const prompt = `Você é um Tarólogo Akáshico de elite. Faça uma leitura profunda e transformadora para ${firstName}.

NAIPES: CHAMAS=Fogo/ação/propósito | CÁLICES=Água/emoção/amor | CRISTAIS=Ar/mente/conflito | ESTRELAS=Terra/trabalho/dinheiro | ARCANOS MAIORES=Karma/missão de alma

CONSULENTE: ${firstName}
PERGUNTA: "${perguntaReal}"

CARTAS:
${cartasTexto}

REGRAS:
- Cada INTERPRETACAO: 3 parágrafos corridos (sem subtítulos, sem numeração):
  § 1: Simbolismo profundo desta carta e o que ela revela nos Registros Akáshicos
  § 2: Como esta energia afeta ${firstName} nesta posição em relação a "${perguntaReal}"
  § 3: Mensagem direta dos Guardiões para ${firstName} — orientação concreta e amorosa
- Use o nome ${firstName} em cada carta — a leitura deve ser EXCLUSIVAMENTE para ${firstName}
- SINTESE: 3 parágrafos corridos — padrão geral | verdade central | caminho indicado
- NUNCA use subtítulos, marcadores, asteriscos ou numeração dentro das interpretações
- Escreva em português do Brasil fluente e profundo

FORMATO EXATO (siga à risca):

TITULO: [título poético para esta leitura]

${cartas.map((c, i) => `CARTA_${i+1}
POSICAO: ${c.posicao}
NOME: ${c.nome}${c.invertida ? ' (INVERTIDA)' : ''}
INTERPRETACAO: [3 parágrafos corridos separados por linha em branco]`).join('\n\n')}

SINTESE: [3 parágrafos corridos]

ACAO: [1-2 frases com ação concreta para ${firstName} nos próximos 7 dias]`;

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 8000,
        stream: true,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!anthropicRes.ok) {
      const err = await anthropicRes.text();
      console.error('Anthropic error:', anthropicRes.status, err.slice(0, 200));
      return res.status(500).json({ error: 'Erro na API Anthropic.', status: anthropicRes.status });
    }

    // Coleta o stream completo antes de parsear o JSON estruturado
    const reader = anthropicRes.body.getReader();
    const decoder = new TextDecoder();
    let sseBuffer = '', texto = '';
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
          if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') texto += ev.delta.text;
        } catch {}
      }
    }

    if (!texto) return res.status(500).json({ error: 'Resposta vazia da API.' });

    // Parsear o formato de texto simples
    const result = parsearLeitura(texto, cartas);

    // Salvar no Supabase
    if (email) {
      const dadosParaSalvar = {
        titulo: result.titulo,
        tiragem: tiragem || 'Leitura Livre',
        pergunta: pergunta || '',
        cartas: result.cartas,
        sintese: result.sintese,
      };
      await sbSalvarTaro(email, dadosParaSalvar);
    }

    return res.status(200).json({ success: true, leitura: result });

  } catch (err) {
    console.error('taro-leitura error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

function parsearLeitura(texto, cartas) {
  const linhas = texto.split('\n');

  let titulo = '';
  const cartasParsed = [];
  let sintese = '';
  let acao = '';

  let cartaAtual = null;
  let interpretacaoLines = [];
  let sinteseLines = [];
  let acaoLines = [];
  let modo = '';

  for (const linha of linhas) {
    const trim = linha.trim();

    if (trim.startsWith('TITULO:')) {
      titulo = trim.replace('TITULO:', '').trim();
      modo = '';
    } else if (/^CARTA_\d+$/.test(trim)) {
      if (cartaAtual && interpretacaoLines.length) {
        cartaAtual.interpretacao = interpretacaoLines.join('\n').trim();
        cartasParsed.push(cartaAtual);
      }
      cartaAtual = { posicao: '', carta: '', invertida: false, interpretacao: '' };
      interpretacaoLines = [];
      modo = 'carta';
    } else if (trim.startsWith('POSICAO:') && cartaAtual) {
      cartaAtual.posicao = trim.replace('POSICAO:', '').trim();
    } else if (trim.startsWith('NOME:') && cartaAtual) {
      const nomeCompleto = trim.replace('NOME:', '').trim();
      cartaAtual.invertida = nomeCompleto.includes('(INVERTIDA)');
      cartaAtual.carta = nomeCompleto.replace('(INVERTIDA)', '').trim();
    } else if (trim.startsWith('INTERPRETACAO:') && cartaAtual) {
      const resto = trim.replace('INTERPRETACAO:', '').trim();
      if (resto) interpretacaoLines.push(resto);
      modo = 'interpretacao';
    } else if (trim.startsWith('SINTESE:')) {
      if (cartaAtual && interpretacaoLines.length) {
        cartaAtual.interpretacao = interpretacaoLines.join('\n').trim();
        cartasParsed.push(cartaAtual);
        cartaAtual = null;
      }
      const resto = trim.replace('SINTESE:', '').trim();
      if (resto) sinteseLines.push(resto);
      modo = 'sintese';
    } else if (trim.startsWith('ACAO:')) {
      const resto = trim.replace('ACAO:', '').trim();
      if (resto) acaoLines.push(resto);
      modo = 'acao';
    } else if (trim) {
      if (modo === 'interpretacao' && cartaAtual) interpretacaoLines.push(trim);
      else if (modo === 'sintese') sinteseLines.push(trim);
      else if (modo === 'acao') acaoLines.push(trim);
    } else if (!trim) {
      // Linha vazia = quebra de parágrafo — preserva em interpretação e síntese
      if (modo === 'interpretacao' && cartaAtual && interpretacaoLines.length) interpretacaoLines.push('');
      else if (modo === 'sintese' && sinteseLines.length) sinteseLines.push('');
    }
  }

  // Finalizar última carta
  if (cartaAtual && interpretacaoLines.length) {
    cartaAtual.interpretacao = interpretacaoLines.join('\n').trim();
    cartasParsed.push(cartaAtual);
  }

  sintese = sinteseLines.join('\n').trim();
  acao = acaoLines.join('\n').trim();

  // Fallback: usar dados originais das cartas se parsear falhou
  const cartasFinais = cartas.map((c, i) => {
    const parsed = cartasParsed[i];
    return {
      posicao: c.posicao,
      carta: parsed?.carta || c.nome,
      invertida: c.invertida,
      interpretacao: parsed?.interpretacao || c.nome
    };
  });

  return {
    titulo: titulo || 'Leitura Akáshica',
    cartas: cartasFinais,
    sintese: sintese || '',
    acao_sagrada: acao || ''
  };
}
