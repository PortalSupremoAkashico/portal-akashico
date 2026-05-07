export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { autores_usados = [] } = req.body || {};

  const exclusao = autores_usados.length > 0
    ? `AUTORES JA USADOS NOS ULTIMOS 7 DIAS (NAO REPITA NENHUM DESTES): ${autores_usados.join(', ')}.`
    : '';

  const prompt = `Você é um curador de sabedoria universal. Selecione 3 reflexões profundas e inspiradoras de diferentes mestres, filósofos e pensadores da humanidade.

${exclusao}

REGRAS:
- Escolha 3 autores COMPLETAMENTE DIFERENTES entre si, de tradições e épocas variadas
- Seja ALEATÓRIO — escolha autores inesperados a cada chamada
- Varie entre: filósofos gregos, místicos orientais, líderes espirituais, cientistas, poetas, sábios medievais, pensadores modernos, escritores, psicólogos, artistas
- Exemplos (não se limite): Sócrates, Platão, Aristóteles, Marco Aurélio, Lao Tsé, Confúcio, Buda, Jesus Cristo, Rumi, Ibn Arabi, Kahlil Gibran, Gandhi, Madre Teresa, Martin Luther King, Nelson Mandela, Albert Einstein, Carl Jung, Viktor Frankl, Dostoiévski, Nietzsche, Schopenhauer, Tagore, Heráclito, Epicteto, Sêneca, Pitágoras, Leonardo da Vinci, Tolstói, Fernando Pessoa, Clarice Lispector, Osho, Krishnamurti, Alan Watts, Joseph Campbell, Carl Sagan, Marie Curie, Nikola Tesla, Paramahansa Yogananda, Teilhard de Chardin, Thomas Merton, Simone Weil, Meister Eckhart, Santa Teresa de Ávila, São Francisco de Assis, Confúcio, Zhuangzi, Nagarjuna, Ramana Maharshi, Sri Aurobindo, Jiddu Krishnamurti, Simone de Beauvoir, Hannah Arendt, Albert Camus, Jean-Paul Sartre, Friedrich Hölderlin, Rainer Maria Rilke, Pablo Neruda, Jorge Luis Borges, Umberto Eco, Antoine de Saint-Exupéry
- Reflexão genuína, profunda e relevante para a vida interior
- Varie os temas: amor, propósito, superação, sabedoria, alma, universo, silêncio, tempo, liberdade, transformação, morte, beleza, coragem, presença, gratidão, fé, escuridão, luz, criação
- Escreva em português do Brasil fluente
- A reflexão deve ser impactante e memorável

Responda APENAS em JSON válido, sem markdown, sem blocos de código:
{
  "reflexoes": [
    { "autor": "Nome", "origem": "Tradição/Época", "reflexao": "Texto da reflexão..." },
    { "autor": "Nome", "origem": "Tradição/Época", "reflexao": "Texto da reflexão..." },
    { "autor": "Nome", "origem": "Tradição/Época", "reflexao": "Texto da reflexão..." }
  ]
}`;

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!resp.ok) return res.status(500).json({ error: 'Erro na API.' });

    const data = await resp.json();
    const text = data.content?.[0]?.text || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return res.status(500).json({ error: 'Resposta invalida.' });

    const parsed = JSON.parse(match[0]);
    return res.status(200).json({ success: true, reflexoes: parsed.reflexoes });

  } catch (err) {
    console.error('Erro reflexoes:', err.message);
    return res.status(500).json({ error: 'Erro ao buscar reflexoes.' });
  }
}
