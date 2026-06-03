// Vercel serverless function — runs on the server, keeps your API key secret.
// It receives the product info, asks Gemini to optimize the listing, and returns JSON.

const MARKET_GUIDANCE = {
  Etsy: 'Etsy title: max ~140 characters, front-load the most-searched keywords, natural language. Provide exactly 13 tags, each max 20 characters, all lowercase, focused on what buyers actually search. Description: scannable, warm, mention materials/size/use/gift potential.',
  Amazon: 'Amazon title: max ~200 characters, format as Brand + Product + key features + size/quantity. Provide 8-10 backend search keyword phrases (no repeats from title). Description: benefit-driven, can use a short paragraph plus implied bullet points.',
  eBay: 'eBay title: max 80 characters, pack in the most-searched keywords (brand, model, type, size, color, condition), no filler words. Provide 10-12 item-specific keyword tags. Description: clear, factual, scannable, builds buyer trust.'
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server is missing GEMINI_API_KEY. Add it in your Vercel project settings.' });
  }

  try {
    const { product, details, tone, keyword, market } = req.body || {};

    if (!product || !product.trim()) {
      return res.status(400).json({ error: 'Please provide what you are selling.' });
    }

    const mkt = MARKET_GUIDANCE[market] ? market : 'Etsy';

    const prompt = `You are an expert ${mkt} listing copywriter and SEO specialist. Optimize the following product into a high-converting, search-optimized listing.

Marketplace rules: ${MARKET_GUIDANCE[mkt]}

Product: ${product}
Details: ${details && details.trim() ? details : '(none provided — infer sensible details)'}
Desired tone: ${tone || 'Warm & friendly'}
${keyword && keyword.trim() ? 'Must include this keyword naturally: ' + keyword : ''}

Respond with ONLY a valid JSON object in exactly this shape:
{
  "title": "the optimized listing title",
  "tags": ["tag1", "tag2"],
  "description": "the full optimized description, ready to paste",
  "why": "one short sentence on the single biggest improvement you made"
}`;

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const geminiRes = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.7
        }
      })
    });

    const data = await geminiRes.json();

    if (!geminiRes.ok) {
      const msg = (data && data.error && data.error.message) || 'Gemini API request failed.';
      return res.status(502).json({ error: msg });
    }

    const text =
      data &&
      data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts[0] &&
      data.candidates[0].content.parts[0].text;

    if (!text) {
      return res.status(502).json({ error: 'Gemini returned an empty response. Try again.' });
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      // Fallback: strip any code fences and retry
      const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(clean);
    }

    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Unexpected server error.' });
  }
};
