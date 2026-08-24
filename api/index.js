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
//
// भाषा (Language) टीप:
//   eleven_multilingual_v2 अधिकृतपणे हिंदी सपोर्ट करतो, पण मराठी नाही
//   (ElevenLabs च्या 29-भाषा यादीत मराठीचा समावेश नाही) — म्हणूनच मराठी
//   मजकूर वाचताना उच्चार "हिंदी सारखा" / चुकीचा वाटतो. eleven_v3 मॉडेल
//   मराठीला (mar) अधिकृत सपोर्ट करतो, त्यामुळे आधी v3 वापरून बघतो आणि
//   जर ते account वर उपलब्ध नसेल (Free tier वर बंद असू शकते) तर आपोआप
//   multilingual_v2 वर परत जातो, जेणेकरून आवाज पूर्ण बंद पडणार नाही.
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

  const { text } = req.body || {};
  const cleanText = (text || '').replace(/[*_#`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 2000);

  if (!cleanText) {
    return res.status(400).json({ error: 'missing_text' });
  }

  const endpoint = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

  async function callElevenLabs(modelId) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey
      },
      body: JSON.stringify({
        text: cleanText,
        model_id: modelId,
        voice_settings: { stability: 0.65, similarity_boost: 0.8, style: 0.25, use_speaker_boost: true }
      })
    });
    return response;
  }

  try {
    // 1st try: eleven_v3 — supports Marathi (mar) + Hindi (hin) properly.
    let response = await callElevenLabs('eleven_v3');
    let usedModel = 'eleven_v3';

    // eleven_v3 not on this account/plan (free tier often 403/400s it) ->
    // fall back to multilingual_v2 (proper Hindi, best-effort Marathi).
    if (!response.ok && (response.status === 400 || response.status === 401 || response.status === 403)) {
      response = await callElevenLabs('eleven_multilingual_v2');
      usedModel = 'eleven_multilingual_v2';
    }

    if (!response.ok) {
      let detail = '';
      try { detail = await response.text(); } catch (_) {}
      console.error(`ElevenLabs error ${response.status} (model: ${usedModel}):`, detail);
      return res.status(502).json({
        error: 'elevenlabs_request_failed',
        status: response.status,
        model: usedModel,
        detail: detail.slice(0, 500)
      });
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Chaya-TTS-Model', usedModel);
    return res.status(200).send(buffer);
  } catch (e) {
    console.error('TTS proxy error:', e.message);
    return res.status(500).json({ error: 'tts_failed', detail: e.message });
  }
}
