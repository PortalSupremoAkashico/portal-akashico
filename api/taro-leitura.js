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

  const prompt = `Você é um Tarólogo Akáshico de elite — um canal entre os Registros Akáshicos e ${firstName}. Cada carta é uma janela para a alma. Cada palavra deve tocar fundo.

SISTEMA DE NAIPES AKÁSHICO:
- CHAMAS (Paus/Varinha): Fogo, ação, criatividade, vontade, expansão, propósito
- CÁLICES (Copas): Água, emoções, amor, intuição, sonhos, vínculos, cura
- CRISTAIS (Espadas): Ar, mente, conflitos, decisões, verdades, clareza, dor
- ESTRELAS (Ouros/Pentáculos): Terra, trabalho, dinheiro, corpo, saúde, manifestação
- ARCANOS MAIORES: Karma, missão de alma, lições cósmicas, portais de transformação

CONSULENTE: ${firstName}
PERGUNTA CENTRAL: "${perguntaReal}"

CARTAS REVELADAS:
${cartasTexto}

DIRETRIZES DE PROFUNDIDADE (OBRIGATÓRIAS):
- Cada interpretação: mínimo 4 parágrafos ricos, não 1 parágrafo curto
- PARTE 1: O arquétipo e simbolismo profundo desta carta — o que ela representa na tradição do Tarô e nos Registros Akáshicos
- PARTE 2: Como esta energia se manifesta ESPECIFICAMENTE na vida de ${firstName} nesta posição, em relação à pergunta "${perguntaReal}"
- PARTE 3: Padrões de alma, lições kármicas ou dons que esta carta revela para ${firstName}
- PARTE 4: Mensagem direta dos Guardiões dos Registros — orientação concreta e amorosa
- Use o nome ${firstName} com frequência — a leitura deve soar como feita EXCLUSIVAMENTE para ${firstName}
- NUNCA seja genérico — cada palavra deve ser específica para esta combinação de cartas e pergunta
- Síntese: 3 parágrafos mostrando o padrão geral, a verdade central e o caminho indicado

FORMATO (siga exatamente, sem markdown):

TITULO: [título poético que capture a essência desta leitura para ${firstName}]

${cartas.map((c, i) => `CARTA_${i+1}
POSICAO: ${c.posicao}
NOME: ${c.nome}${c.invertida ? ' (INVERTIDA)' : ''}
INTERPRETACAO: [4 parágrafos profundos conforme diretrizes acima]`).join('\n\n')}

SINTESE: [3 parágrafos: padrão geral das cartas | verdade central para ${firstName} | caminho e próximos passos indicados pelos Registros]

ACAO: [1-2 frases com ação sagrada concreta que ${firstName} deve realizar nos próximos 7 dias]`;

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
        max_tokens: 5000,
        stream: false,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!anthropicRes.ok) {
      const err = await anthropicRes.text();
      console.error('Anthropic error:', anthropicRes.status, err.slice(0, 200));
      return res.status(500).json({ error: 'Erro na API Anthropic.', status: anthropicRes.status });
    }

    const data = await anthropicRes.json();
    const texto = data.content?.[0]?.text || '';

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
