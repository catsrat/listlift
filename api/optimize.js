// Vercel serverless function — runs on the server, keeps your API key secret.
// Hardened: tries a lighter model first, retries on temporary overload (503/429),
// and falls back to a second model so a busy Google server doesn't break the tool.

const MARKET_GUIDANCE = {
  Etsy: 'Etsy title: max ~140 characters, front-load the most-searched keywords, natural language. Provide exactly 13 tags, each max 20 characters, all lowercase, focused on what buyers actually search. Description: scannable, warm, mention materials/size/use/gift potential.',
  Amazon: 'Amazon title: max ~200 characters, format as Brand + Product + key features + size/quantity. Provide 8-10 backend search keyword phrases (no repeats from title). Description: benefit-driven, can use a short paragraph plus implied bullet points.',
  eBay: 'eBay title: max 80 characters, pack in the most-searched keywords (brand, model, type, size, color, condition), no filler words. Provide 10-12 item-specific keyword tags. Description: clear, factual, scannable, builds buyer trust.'
};

// Lighter model first (more free-tier headroom, recovers fastest), heavier as fallback.
const MODELS = ['gemini-2.5-flash-lite', 'gemini-2.5-flash'];
const TRANSIENT = [429, 500, 503];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function callGemini(model, apiKey, prompt) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.7 }
    })
  });
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

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

    let lastError = 'The service is busy right now.';

    // Try each model; retry once on a temporary (transient) error before moving on.
    for (const model of MODELS) {
      for (let attempt = 0; attempt < 2; attempt++) {
        if (attempt > 0) await sleep(800); // brief backoff before a retry

        const { ok, status, data } = await callGemini(model, apiKey, prompt);

        if (ok) {
          const text =
            data &&
            data.candidates &&
            data.candidates[0] &&
            data.candidates[0].content &&
            data.candidates[0].content.parts &&
            data.candidates[0].content.parts[0] &&
            data.candidates[0].content.parts[0].text;

          if (!text) { lastError = 'Empty response from the model.'; continue; }

          let parsed;
          try {
            parsed = JSON.parse(text);
          } catch (e) {
            const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
            parsed = JSON.parse(clean);
          }
          return res.status(200).json(parsed);
        }

        lastError = (data && data.error && data.error.message) || `HTTP ${status}`;

        // Bad key / bad request — retrying or switching models won't help.
        if (status === 400 || status === 403) {
          return res.status(status).json({ error: lastError });
        }
        // Model not found — stop retrying this model, try the next one.
        if (status === 404) break;
        // Non-transient and not handled above — try next model.
        if (!TRANSIENT.includes(status)) break;
        // Transient: loop will retry once, then move to the next model.
      }
    }

    return res.status(503).json({
      error: 'Google\u2019s AI servers are temporarily overloaded (this affects everyone, not your account). It usually clears within a few minutes \u2014 please try again shortly.'
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Unexpected server error.' });
  }
};
