// api/index.js
// Chaya AI — Combined Serverless Function & Express API Route Handler.
const { GoogleGenAI } = require('@google/genai');

module.exports = async (req, res) => {
  const action = req.query?.action;

  switch (action) {
    case 'status':
      return handleStatus(req, res);
    case 'chat':
      return handleChat(req, res);
    case 'groq':
      return handleGroq(req, res);
    case 'market':
      return handleMarket(req, res);
    case 'tts':
      return handleTts(req, res);
    default:
      return res.status(400).json({ error: 'unknown_action', hint: 'use ?action=status|chat|groq|market|tts' });
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
// CHAT — Direct conversational AI assistant for farmers with Gemini & Groq
// ---------------------------------------------------------------------
async function handleChat(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const { message, language = 'mr', farmContext, conversationHistory = [] } = req.body || {};
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'missing_message' });
  }

  const groqApiKey = process.env.GROQ_API_KEY;
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const isEn = language === 'en';

  const systemPrompt = isEn
    ? `You are "Chaya" (छाया), a trusted, friendly, and expert smart agricultural assistant for farmers in Maharashtra (specifically Nanded district).
Your name is simply "Chaya" (छाया). Always introduce and refer to yourself as "Chaya" (छाया) — never use "Chaya AI" or "Chaya Aai".

LANGUAGE REQUIREMENT:
- The user has chosen English. You MUST respond 100% in English. Do not reply in Marathi or Devanagari script.
- Translate all local farming terms, crop diseases, fertilizer recommendations, and remedies into clear, plain English.

Your goals:
1. Explain agricultural topics simply, clearly, and accurately in English.
2. Provide specific, actionable solutions (e.g., exact medicine/fertilizer dosage per 15L water spray pump, best seed varieties, drip irrigation timings, disease diagnosis, organic alternatives).
3. Keep the tone respectful, direct, and farmer-friendly.
4. Structure the answer with short, readable bullet points so it is easy to read on mobile and natural to listen to via text-to-speech.`
    : `तुमचे नाव "छाया" (Chaya) आहे — महाराष्ट्रातील (विशेषतः नांदेड व मराठवाडा) शेतकऱ्यांचे अत्यंत विश्वासू, अनुभवी आणि सोप्या भाषेत मार्गदर्शन करणारे डिजिटल कृषी मित्र.
महत्त्वाचे: स्वतःचा उल्लेख नेहमी फक्त "छाया" असाच करा ("छाया AI" किंवा "छाया आई" असा उल्लेख अजिबात करू नका).

भाषेचा नियम:
- शेतकऱ्याला संपूर्ण उत्तर स्पष्ट, साध्या आणि समजण्यास सुलभ मराठी भाषेत द्या.

तुमची उद्दिष्टे:
१. शेतकऱ्यांच्या प्रश्नांना अत्यंत सोप्या, साध्या आणि अचूक मराठीत उत्तरे द्या.
२. थेट कृती करता येणारे उपाय सांगा (उदा. प्रति १५ लिटर पंपासाठी औषधाची/खताची अचूक मात्रा, सर्वोत्तम वाण, कीड-रोग नियंत्रण, ठिबकचे वेळापत्रक, चालू बाजारभाव).
३. भाषा आदरयुक्त, नम्र आणि शेतकरी बंधूंना सहज समजेल अशी असावी.
४. उत्तर मुद्देसूद व सुटसुटीत ठेवा, जेणेकरून मोबाईलवर वाचायला आणि ऑडिओ ऐकायला सोपे जाईल.
५. बुरशीनाशके, कीटकनाशके आणि टॉनिक यांची योग्य नावे व प्रमाण मराठीत स्पष्ट सांगा.`;

  const contextStr = farmContext
    ? `Farm Context: Taluka: ${farmContext.taluka || 'Nanded'}, Land: ${farmContext.land || '2'} Acres, Water: ${farmContext.water || 'Normal'}, Soil NPK/pH: N:${farmContext.n || 'Medium'} P:${farmContext.p || 'Medium'} K:${farmContext.k || 'Medium'}`
    : `General Maharashtra Agro Profile`;

  const formattedPrompt = isEn
    ? `${systemPrompt}\n\n${contextStr}\n\nFarmer Question (in English): ${message}\n\nCRITICAL: Answer entirely in English now:`
    : `${systemPrompt}\n\n${contextStr}\n\nशेतकऱ्याचा प्रश्न: ${message}\n\nमराठीत उत्तर द्या:`;

  // 1. Try Gemini API first with resilient multi-model failover
  if (geminiApiKey) {
    const geminiModels = [
      'gemini-3.5-flash-lite',
      'gemini-3.5-flash',
      'gemini-3.6-flash',
      'gemini-3.7-flash',
      'gemini-flash-lite-latest',
      'gemini-flash-latest'
    ];
    for (const model of geminiModels) {
      try {
        const ai = new GoogleGenAI({ apiKey: geminiApiKey });
        const response = await ai.models.generateContent({
          model,
          contents: formattedPrompt,
        });

        if (response && response.text) {
          return res.status(200).json({ text: response.text, provider: 'gemini', model });
        }
      } catch (geminiErr) {
        console.warn(`Gemini (${model}) status notice:`, geminiErr.message || geminiErr);
      }
    }
  }

  // 2. Try Groq API
  if (groqApiKey) {
    try {
      const endpoint = 'https://api.groq.com/openai/v1/chat/completions';
      const messages = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory.slice(-4).map(h => ({
          role: h.sender === 'bot' ? 'assistant' : 'user',
          content: h.text
        })),
        { role: 'user', content: isEn ? `${contextStr}\n\nFarmer Question: ${message}\n(Respond strictly and entirely in English)` : `${contextStr}\n\nशेतकऱ्याचा प्रश्न: ${message}\n(मराठीत उत्तर द्या)` }
      ];

      const groqModels = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'];
      for (const model of groqModels) {
        try {
          const resp = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${groqApiKey}`
            },
            body: JSON.stringify({
              model,
              messages,
              temperature: 0.4,
              max_completion_tokens: 800
            })
          });

          if (resp.ok) {
            const data = await resp.json();
            const text = data.choices?.[0]?.message?.content;
            if (text) {
              return res.status(200).json({ text, provider: 'groq', model });
            }
          }
        } catch (e) {
          // try next model
        }
      }
    } catch (groqErr) {
      console.warn('Groq chat error:', groqErr.message);
    }
  }

  return res.status(200).json({ fallback: true, error: 'ai_backend_offline' });
}

// ---------------------------------------------------------------------
// GROQ / GEMINI — AI proxy for grounded crop evaluations
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

    // Try Gemini first with resilient multi-model failover
    if (geminiApiKey) {
      const geminiModels = [
        'gemini-3.5-flash-lite',
        'gemini-3.5-flash',
        'gemini-3.6-flash',
        'gemini-3.7-flash',
        'gemini-flash-lite-latest',
        'gemini-flash-latest'
      ];
      for (const model of geminiModels) {
        try {
          const ai = new GoogleGenAI({ apiKey: geminiApiKey });
          const prompt = `${systemPrompt || defaultSystemPrompt}\n\n${userPromptContent}`;
          
          const response = await ai.models.generateContent({
            model,
            contents: prompt,
          });

          if (response && response.text) {
            return res.status(200).json({ text: response.text, model });
          }
        } catch (geminiErr) {
          console.warn(`Gemini (${model}) status notice:`, geminiErr.message || geminiErr);
        }
      }
    }

    // Try Groq if configured
    if (groqApiKey) {
      try {
        const endpoint = 'https://api.groq.com/openai/v1/chat/completions';
        const payload = {
          model: 'llama-3.3-70b-versatile',
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
        console.warn('Groq fetch failed:', e.message);
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
      crop_id: r.crop_id,
      commodity: r.crop_name_en || r.crop_name_mr || 'Crop',
      crop_name_en: r.crop_name_en || r.crop_name_mr,
      crop_name_mr: r.crop_name_mr || r.crop_name_en,
      market: r.market_en || r.market_mr || 'Nanded Mondha APMC',
      market_en: r.market_en || r.market_mr || 'Nanded Mondha APMC',
      market_mr: r.market_mr || r.market_en || 'नांदेड मोंढा APMC',
      modal_price: Number(r.modal_price ?? r.modal_rate ?? 0),
      max_price: Number(r.max_price ?? r.max_rate ?? 0),
      min_price: Number(r.min_price ?? r.min_rate ?? 0),
      date: parsed.last_updated || new Date().toISOString().slice(0, 10)
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
  // Default to standard premade voice '21m00Tcm4TlvDq8ikWAM' (Rachel) which works on all free and paid tiers
  const primaryVoiceId = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
  const STANDARD_PREMADE_VOICE = '21m00Tcm4TlvDq8ikWAM';

  if (!apiKey) {
    return res.status(200).json({ error: 'not_configured', detail: 'ELEVENLABS_API_KEY is not configured.' });
  }

  const { text } = req.body || {};
  const cleanText = (text || '').replace(/[*_#`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 2000);

  if (!cleanText) {
    return res.status(400).json({ error: 'missing_text' });
  }

  async function callElevenLabs(targetVoiceId, modelId) {
    const endpoint = `https://api.elevenlabs.io/v1/text-to-speech/${targetVoiceId}`;
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
    // Attempt 1: primary voice with eleven_multilingual_v2 (best for Indic/Marathi & English)
    let usedModel = 'eleven_multilingual_v2';
    let response = await callElevenLabs(primaryVoiceId, usedModel);

    // If 402 (paid plan required for library voice) or 404/400 and custom voice was used, retry with standard premade voice
    if (!response.ok && (response.status === 402 || response.status === 400 || response.status === 404 || response.status === 422)) {
      if (primaryVoiceId !== STANDARD_PREMADE_VOICE) {
        console.warn(`ElevenLabs voice ${primaryVoiceId} returned ${response.status}. Retrying with premade voice ${STANDARD_PREMADE_VOICE}...`);
        response = await callElevenLabs(STANDARD_PREMADE_VOICE, 'eleven_multilingual_v2');
      }
    }

    // Attempt fallback with eleven_v3 if multilingual failed on 400
    if (!response.ok && (response.status === 400 || response.status === 404)) {
      response = await callElevenLabs(STANDARD_PREMADE_VOICE, 'eleven_v3');
      usedModel = 'eleven_v3';
    }

    if (!response.ok) {
      let detail = '';
      try { detail = await response.text(); } catch (_) {}
      console.warn(`ElevenLabs notice ${response.status} (model: ${usedModel}):`, detail.slice(0, 300));
      return res.status(200).json({
        error: 'elevenlabs_request_failed',
        status: response.status,
        model: usedModel,
        fallback_to_browser: true,
        detail: detail.slice(0, 300)
      });
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Chaya-TTS-Model', usedModel);
    return res.status(200).send(buffer);
  } catch (e) {
    console.warn('TTS proxy notice:', e.message);
    return res.status(200).json({ error: 'tts_failed', fallback_to_browser: true, detail: e.message });
  }
}
