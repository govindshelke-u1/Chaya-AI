// api/index.js
// Chaya AI — Combined Serverless Function & Express API Route Handler.
const { GoogleGenAI } = require('@google/genai');

module.exports = async (req, res) => {
  const action = req.query?.action;

  switch (action) {
    case 'status':
      return handleStatus(req, res);
    case 'groq':
      return handleGroq(req, res);
    case 'market':
      return handleMarket(req, res);
    case 'tts':
      return handleTts(req, res);
    default:
      return res.status(400).json({ error: 'unknown_action', hint: 'use ?action=status|groq|market|tts' });
  }
};

// ---------------------------------------------------------------------
// STATUS — tells the frontend which integrations are configured.
// Never returns actual key values, only boolean availability flags.
// ---------------------------------------------------------------------
async function handleStatus(req, res) {
  return res.status(200).json({
    groq: !!process.env.GROQ_API_KEY,
    market: !!process.env.MARKET_API_KEY,
    tts: !!process.env.ELEVENLABS_API_KEY,
    gemini: !!process.env.GEMINI_API_KEY
  });
}

// ---------------------------------------------------------------------
// GROQ / GEMINI — AI proxy (Groq with Gemini fallback)
// ---------------------------------------------------------------------
async function handleGroq(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const groqApiKey = process.env.GROQ_API_KEY;
  const geminiApiKey = process.env.GEMINI_API_KEY;

  if (!groqApiKey && !geminiApiKey) {
    return res.status(200).json({ error: 'not_configured' });
  }

  try {
    const { systemPrompt, groundedContext, userQuestion, language } = req.body || {};
    const isEn = language === 'en';

    if (!groundedContext) {
      return res.status(400).json({ error: 'missing_context' });
    }

    const defaultSystemPrompt = isEn
      ? 'You are Chaya AI, an expert agricultural advisor for Maharashtra farmers. Provide crisp, structured, practical advice in English.'
      : 'तुम्ही छाया AI आहात, महाराष्ट्रातील शेतकऱ्यांचे कृषी सल्लागार. संक्षिप्त, ठळक, थेट कृती करता येणारा मराठी सल्ला द्या.';

    const userPromptContent = isEn
      ? `Data & Context:\n${groundedContext}\n\nFarmer's Question: ${userQuestion || 'Provide key recommendations'}\n\nDirect, concise, and actionable English advice:`
      : `डेटा:\n${groundedContext}\n\nशेतकऱ्याचा प्रश्न: ${userQuestion || ''}\n\nथेट संक्षिप्त मराठी सल्ला:`;

    // Try Groq if configured
    if (groqApiKey) {
      try {
        const endpoint = 'https://api.groq.com/openai/v1/chat/completions';
        const payload = {
          model: 'openai/gpt-oss-120b',
          messages: [
            { role: 'system', content: systemPrompt || defaultSystemPrompt },
            { role: 'user', content: userPromptContent }
          ],
          temperature: 0.3,
          max_completion_tokens: 800
        };

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${groqApiKey}`
          },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          const data = await response.json();
          const text = data.choices?.[0]?.message?.content;
          if (text) {
            return res.status(200).json({ text });
          }
        }
      } catch (e) {
        console.warn('Groq fetch failed, attempting Gemini fallback if available:', e.message);
      }
    }

    // Fallback to Gemini if configured
    if (geminiApiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey: geminiApiKey });
        const prompt = `${systemPrompt || defaultSystemPrompt}\n\n${userPromptContent}`;
        
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
        });

        if (response && response.text) {
          return res.status(200).json({ text: response.text });
        }
      } catch (geminiErr) {
        console.error('Gemini fallback error:', geminiErr.message);
      }
    }

    return res.status(200).json({ error: 'groq_failed' });
  } catch (e) {
    console.error('AI proxy error:', e.message);
    return res.status(200).json({ error: 'groq_failed' });
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

  if (apiKey) {
    try {
      const url = `https://api.data.gov.in/resource/${resourceId}?api-key=${apiKey}&format=json&limit=50&filters[state]=${encodeURIComponent(state)}&filters[district]=${encodeURIComponent(district)}`;
      const response = await fetch(url);

      if (response.ok) {
        const data = await response.json();
        if (data.records && data.records.length) {
          const rates = data.records.map(r => ({
            commodity: r.commodity,
            market: r.market,
            modal_price: Number(r.modal_price),
            max_price: Number(r.max_price),
            min_price: Number(r.min_price),
            date: r.arrival_date
          }));
          return res.status(200).json({ source: 'live', rates });
        }
      }
    } catch (e) {
      console.warn('Live Agmarknet fetch failed, falling back to APMC local data:', e.message);
    }
  }

  try {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const filePath = path.join(process.cwd(), 'data', 'market_prices.json');
    const content = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    const rates = (parsed.rates || []).map(r => ({
      commodity: r.commodity || r.crop_name_mr,
      market: r.market || 'APMC Nanded',
      modal_price: Number(r.modal_price || r.modal_rate),
      max_price: Number(r.max_price || r.max_rate),
      min_price: Number(r.min_price || r.min_rate),
      date: parsed.last_updated || new Date().toISOString().slice(0, 10),
      trend: r.trend
    }));

    return res.status(200).json({ source: 'apmc_market_data', rates });
  } catch (e) {
    console.error('Market local fallback error:', e.message);
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
  const voiceId = process.env.ELEVENLABS_VOICE_ID || 'k2intd1ORm0YUH8etnXg';

  if (!apiKey) {
    return res.status(200).json({ error: 'not_configured', detail: 'ELEVENLABS_API_KEY is not configured.' });
  }

  const { text } = req.body || {};
  const cleanText = (text || '').replace(/[*_#`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 2000);

  if (!cleanText) {
    return res.status(400).json({ error: 'missing_text' });
  }

  const endpoint = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

  async function callElevenLabs(modelId) {
    return fetch(endpoint, {
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
  }

  try {
    let response = await callElevenLabs('eleven_v3');
    let usedModel = 'eleven_v3';

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
