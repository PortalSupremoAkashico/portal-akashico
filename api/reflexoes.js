export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const prompt = `Você é um curador de sabedoria universal. Selecione 5 reflexões profundas e inspiradoras de diferentes mestres, filósofos e pensadores da humanidade.

REGRAS:
- Escolha 5 autores DIFERENTES entre si, de tradições e épocas variadas
- Varie sempre: filósofos gregos, místicos orientais, líderes espirituais, cientistas, poetas, sábios medievais, pensadores modernos
- Exemplos possíveis (não se limite): Sócrates, Platão, Aristóteles, Marco Aurélio, Lao Tsé, Confúcio, Buda, Jesus Cristo, Rumi, Ibn Arabi, Kahlil Gibran, Gandhi, Madre Teresa, Martin Luther King, Nelson Mandela, Albert Einstein, Carl Jung, Viktor Frankl, Dostoiévski, Nietzsche, Schopenhauer, Tagore, Heráclito, Epicteto, Sêneca, Pitágoras, Leonardo da Vinci, Tolstói, Fernando Pessoa, Clarice Lispector, Osho, Krishnamurti, Alan Watts, Joseph Campbell, Carl Sagan, Marie Curie, Nikola Tesla, Paramahansa Yogananda, Teilhard de Chardin, Thomas Merton, Simone Weil, Meister Eckhart, Santa Teresa de Ávila, São Francisco de Assis
- A reflexão deve ser genuína, profunda e relevante para a vida interior
- Varie os temas a cada chamada: amor, propósito, superação, sabedoria, alma, universo, silêncio, tempo, liberdade, transformação, morte, beleza, coragem, presença, gratidão
- Cada reflexão com estilo e perspectiva diferentes
- Escreva em português do Brasil fluente

Responda APENAS em JSON válido, sem markdown:
{
  "reflexoes": [
    { "autor": "Nome", "origem": "Tradição/Época", "reflexao": "Texto..." },
    { "autor": "Nome", "origem": "Tradição/Época", "reflexao": "Texto..." },
    { "autor": "Nome", "origem": "Tradição/Época", "reflexao": "Texto..." },
    { "autor": "Nome", "origem": "Tradição/Época", "reflexao": "Texto..." },
    { "autor": "Nome", "origem": "Tradição/Época", "reflexao": "Texto..." }
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
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!resp.ok) return res.status(500).json({ error: 'Erro na API.' });

    const data = await resp.json();
    const text = data.content?.[0]?.text || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return res.status(500).json({ error: 'Resposta inválida.' });

    const parsed = JSON.parse(match[0]);
    return res.status(200).json({ success: true, reflexoes: parsed.reflexoes });

  } catch (err) {
    console.error('Erro reflexoes:', err.message);
    return res.status(500).json({ error: 'Erro ao buscar reflexões.' });
  }
}
