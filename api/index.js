// /api/index.js
// Chaya AI — Combined Vercel Serverless Function (single backend endpoint).
//
// WHY COMBINED: Vercel's free (Hobby) plan allows a limited number of
// serverless functions per project. Instead of one file per integration
// (gemini.js, market.js, tts.js, status.js = 4 functions), everything is
// routed through ONE function using a `?action=` query parameter. This
// keeps the project at 1 function total, leaving room to add many more
// features later without hitting the limit.
//
// Frontend calls:
//   GET  /api/index?action=status
//   POST /api/index?action=gemini   body: { systemPrompt, groundedContext, userQuestion }
//   GET  /api/index?action=market   query: district, state
//   POST /api/index?action=tts      body: { text }
//
// All API keys stay server-side (Vercel Environment Variables) — never
// sent to the browser.

module.exports = async (req, res) => {
  const action = req.query?.action;

  switch (action) {
    case 'status':
      return handleStatus(req, res);
    case 'gemini':
      return handleGemini(req, res);
    case 'market':
      return handleMarket(req, res);
    case 'tts':
      return handleTts(req, res);
    default:
      return res.status(400).json({ error: 'unknown_action', hint: 'use ?action=status|gemini|market|tts' });
  }
};

// ---------------------------------------------------------------------
// STATUS — tells the frontend which integrations are configured.
// Never returns the actual key values, only true/false flags.
// ---------------------------------------------------------------------
async function handleStatus(req, res) {
  return res.status(200).json({
    gemini: !!process.env.GEMINI_API_KEY,
    market: !!process.env.MARKET_API_KEY,
    tts: !!process.env.ELEVENLABS_API_KEY
  });
}

// ---------------------------------------------------------------------
// GEMINI — Google Gemini proxy.
// ---------------------------------------------------------------------
async function handleGemini(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(200).json({ error: 'not_configured' });
  }

  try {
    const { systemPrompt, groundedContext, userQuestion } = req.body || {};

    if (!groundedContext) {
      return res.status(400).json({ error: 'missing_context' });
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const payload = {
      contents: [
        {
          role: 'user',
          parts: [{
            text: `${systemPrompt || ''}\n\nडेटा:\n${groundedContext}\n\nशेतकऱ्याचा प्रश्न: ${userQuestion || ''}\n\nथेट संक्षिप्त मराठी सल्ला:`
          }]
        }
      ],
      generationConfig: { temperature: 0.3, maxOutputTokens: 800 }
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Gemini status: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error('empty_response');
    }

    return res.status(200).json({ text });
  } catch (e) {
    console.error('Gemini proxy error:', e.message);
    return res.status(200).json({ error: 'gemini_failed' });
  }
}

// ---------------------------------------------------------------------
// MARKET — Live APMC/Mandi price proxy (data.gov.in Agmarknet).
// ---------------------------------------------------------------------
async function handleMarket(req, res) {
  const apiKey = process.env.MARKET_API_KEY;
  const resourceId = process.env.MARKET_RESOURCE_ID || '9ef84268-d588-465a-a308-a864a43d0070';

  const district = req.query?.district || 'Nanded';
  const state = req.query?.state || 'Maharashtra';

  if (!apiKey) {
    return res.status(200).json({ source: 'not_configured', rates: [] });
  }

  try {
    const url = `https://api.data.gov.in/resource/${resourceId}?api-key=${apiKey}&format=json&limit=50&filters[state]=${encodeURIComponent(state)}&filters[district]=${encodeURIComponent(district)}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Market API status: ${response.status}`);
    }

    const data = await response.json();

    if (!data.records || !data.records.length) {
      throw new Error('empty_records');
    }

    const rates = data.records.map(r => ({
      commodity: r.commodity,
      market: r.market,
      modal_price: Number(r.modal_price),
      max_price: Number(r.max_price),
      min_price: Number(r.min_price),
      date: r.arrival_date
    }));

    return res.status(200).json({ source: 'live', rates });
  } catch (e) {
    console.error('Market proxy error:', e.message);
    return res.status(200).json({ source: 'error', rates: [] });
  }
}

// ---------------------------------------------------------------------
// TTS — ElevenLabs Text-to-Speech proxy.
// ---------------------------------------------------------------------
async function handleTts(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';

  if (!apiKey) {
    return res.status(200).json({ error: 'not_configured', detail: 'ELEVENLABS_API_KEY Vercel Environment Variables मध्ये set नाही (किंवा redeploy बाकी आहे)' });
  }

  try {
    const { text } = req.body || {};
    const cleanText = (text || '').replace(/[*_#`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 2000);

    if (!cleanText) {
      return res.status(400).json({ error: 'missing_text' });
    }

    const endpoint = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey
      },
      body: JSON.stringify({
        text: cleanText,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 }
      })
    });

    if (!response.ok) {
      // Surface ElevenLabs' actual error body (invalid key, invalid voice id,
      // quota exceeded, etc.) instead of a generic message.
      let detail = '';
      try { detail = await response.text(); } catch (_) {}
      console.error(`ElevenLabs error ${response.status}:`, detail);
      return res.status(502).json({
        error: 'elevenlabs_request_failed',
        status: response.status,
        detail: detail.slice(0, 500)
      });
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(buffer);
  } catch (e) {
    console.error('TTS proxy error:', e.message);
    return res.status(500).json({ error: 'tts_failed', detail: e.message });
  }
}
