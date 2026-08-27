/**
 * Chaya AI (छाया AI) - Agricultural Knowledge Retrieval & AI Synthesis Engine
 * Hyper-localized with Nanded District Field Survey & Patil Biotech Crop Schedules.
 */

class ChayaAIEngine {
  constructor() {
    this.knowledgeBase = {
      crops: [],
      soilClimate: {},
      nandedSurvey: {},
      fertilizersAndSchemes: {},
      marketPrices: {},
      pestsAndDiseases: []
    };
    this.isLoaded = false;
    // NOTE: ElevenLabs key is intentionally NOT stored here anymore.
    // Keys must live only in Vercel Environment Variables (ELEVENLABS_API_KEY),
    // used server-side by /api/index?action=tts. Never put real keys in
    // frontend JS — anyone can read this file via View Source / DevTools.
    this.elevenLabsApiKey = null;
    this.elevenLabsVoiceId = null;
    this.lastTtsErrorDetail = null;
    this.backendStatus = { groq: false, market: false, tts: false, checked: false };
  }

  async checkBackendStatus() {
    try {
      const res = await fetch('/api/index?action=status');
      if (res.ok) {
        const data = await res.json();
        this.backendStatus = { ...data, checked: true };
      }
    } catch (e) {
      console.warn('Backend status check failed (running without /api backend?):', e);
      this.backendStatus = { groq: false, market: false, tts: false, checked: true };
    }
    return this.backendStatus;
  }

  // ---------------------------------------------------------------------
  // 🌦️ LIVE WEATHER DETECTION (Open-Meteo — free, no API key required)
  // ---------------------------------------------------------------------
  async fetchLiveWeather(lat, lon, lang = 'en') {
    // Default fallback coordinates: Nanded district center
    const latitude = lat || 19.15;
    const longitude = lon || 77.31;

    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,precipitation,rain,weather_code,wind_speed_10m&daily=precipitation_probability_max,temperature_2m_max,temperature_2m_min&timezone=auto`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Weather API status: ${res.status}`);
      const data = await res.json();

      const code = data.current?.weather_code ?? 0;
      const condMr = this._weatherCodeToMarathi(code);
      const condEn = this._weatherCodeToEnglish(code);

      return {
        source: 'open-meteo',
        temperature: data.current?.temperature_2m,
        humidity: data.current?.relative_humidity_2m,
        rain_now_mm: data.current?.rain ?? data.current?.precipitation ?? 0,
        wind_kmh: data.current?.wind_speed_10m,
        rain_chance_today: data.daily?.precipitation_probability_max?.[0] ?? null,
        temp_max: data.daily?.temperature_2m_max?.[0],
        temp_min: data.daily?.temperature_2m_min?.[0],
        condition_mr: condMr.text,
        condition_en: condEn.text,
        condition: lang === 'mr' ? condMr.text : condEn.text,
        icon: condEn.icon,
        sprayAdvice_mr: this._sprayAdviceFromWeather(data, 'mr'),
        sprayAdvice_en: this._sprayAdviceFromWeather(data, 'en'),
        sprayAdvice: this._sprayAdviceFromWeather(data, lang)
      };
    } catch (e) {
      console.warn('Weather fetch failed, using fallback estimate:', e);
      return {
        source: 'fallback_estimate',
        temperature: 29,
        humidity: 55,
        rain_now_mm: 0,
        wind_kmh: 8,
        rain_chance_today: null,
        condition_mr: 'हवामान माहिती अनुपलब्ध',
        condition_en: 'Clear Sky / Mild Sunshine',
        condition: lang === 'mr' ? 'हवामान माहिती अनुपलब्ध' : 'Clear Sky / Mild Sunshine',
        icon: '⛅',
        sprayAdvice_mr: 'लाईव्ह हवामान डेटा उपलब्ध नाही — फवारणीपूर्वी स्थानिक अंदाज तपासा.',
        sprayAdvice_en: 'Live weather estimate — check local forecast before spraying.',
        sprayAdvice: lang === 'mr' ? 'लाईव्ह हवामान डेटा उपलब्ध नाही — फवारणीपूर्वी स्थानिक अंदाज तपासा.' : 'Live weather estimate — check local forecast before spraying.'
      };
    }
  }

  _weatherCodeToEnglish(code) {
    const map = {
      0: { text: 'Clear Sky', icon: '☀️' },
      1: { text: 'Mainly Clear', icon: '🌤️' },
      2: { text: 'Partly Cloudy', icon: '⛅' },
      3: { text: 'Overcast', icon: '☁️' },
      45: { text: 'Foggy', icon: '🌫️' },
      48: { text: 'Dense Fog', icon: '🌫️' },
      51: { text: 'Light Drizzle', icon: '🌦️' },
      61: { text: 'Slight Rain', icon: '🌧️' },
      63: { text: 'Moderate Rain', icon: '🌧️' },
      65: { text: 'Heavy Rain', icon: '⛈️' },
      80: { text: 'Rain Showers', icon: '🌦️' },
      95: { text: 'Thunderstorm', icon: '⛈️' }
    };
    return map[code] || { text: 'Normal Weather', icon: '🌥️' };
  }

  _weatherCodeToMarathi(code) {
    // WMO Weather interpretation codes (simplified, Open-Meteo standard)
    const map = {
      0: { text: 'निरभ्र आकाश (Clear Sky)', icon: '☀️' },
      1: { text: 'बऱ्यापैकी निरभ्र', icon: '🌤️' },
      2: { text: 'अंशतः ढगाळ', icon: '⛅' },
      3: { text: 'ढगाळ वातावरण', icon: '☁️' },
      45: { text: 'धुके', icon: '🌫️' },
      48: { text: 'दाट धुके', icon: '🌫️' },
      51: { text: 'हलकी रिमझिम', icon: '🌦️' },
      61: { text: 'हलका पाऊस', icon: '🌧️' },
      63: { text: 'मध्यम पाऊस', icon: '🌧️' },
      65: { text: 'जोरदार पाऊस', icon: '⛈️' },
      80: { text: 'सरी (Showers)', icon: '🌦️' },
      95: { text: 'गडगडाटी वादळ', icon: '⛈️' }
    };
    return map[code] || { text: 'सामान्य हवामान', icon: '🌥️' };
  }

  _sprayAdviceFromWeather(data, lang = 'en') {
    const rain = data.current?.precipitation ?? 0;
    const rainChance = data.daily?.precipitation_probability_max?.[0] ?? 0;
    const wind = data.current?.wind_speed_10m ?? 0;

    if (rain > 0 || rainChance > 60) {
      return lang === 'mr'
        ? '🚫 पावसाची शक्यता जास्त आहे — आज फवारणी टाळा, औषध वाहून जाईल.'
        : '🚫 High chance of rain — Avoid spraying today to prevent chemical wash-off.';
    }
    if (wind > 20) {
      return lang === 'mr'
        ? '⚠️ जोरदार वारा आहे — फवारणी औषध वाया जाऊ शकते, सकाळी लवकर किंवा संध्याकाळी फवारणी करा.'
        : '⚠️ High wind speed — Spray early in the morning or evening to avoid spray drift.';
    }
    return lang === 'mr'
      ? '✅ फवारणीसाठी हवामान अनुकूल आहे.'
      : '✅ Weather is favorable for foliar spraying.';
  }

  // ---------------------------------------------------------------------
  // 💹 LIVE APMC MARKET PRICING — via /api/index?action=market backend proxy
  // ---------------------------------------------------------------------
  async fetchLiveMarketPrices(district = 'Nanded', state = 'Maharashtra') {
    try {
      const url = `/api/index?action=market&district=${encodeURIComponent(district)}&state=${encodeURIComponent(state)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Market proxy status: ${res.status}`);
      const data = await res.json();

      if (data.rates && data.rates.length) {
        const normalized = data.rates.map(r => ({
          commodity: r.commodity || r.crop_name_mr || r.crop || 'कृषी पीक',
          market: r.market || 'APMC Nanded',
          modal_price: Number(r.modal_price ?? r.modal_rate ?? r.avg_price ?? 0),
          max_price: Number(r.max_price ?? r.max_rate ?? 0),
          min_price: Number(r.min_price ?? r.min_rate ?? 0),
          trend: r.trend || 'stable',
          date: r.date || new Date().toISOString().slice(0, 10)
        }));
        return { source: data.source || 'live', rates: normalized };
      }

      // Backend not configured or empty -> use locally bundled JSON
      const localRates = (this.knowledgeBase.marketPrices?.rates || []).map(r => ({
        commodity: r.commodity || r.crop_name_mr,
        market: r.market || 'नांदेड मोंढा',
        modal_price: Number(r.modal_price || r.modal_rate || 0),
        max_price: Number(r.max_price || r.max_rate || 0),
        min_price: Number(r.min_price || r.min_rate || 0),
        trend: r.trend || 'stable',
        date: this.knowledgeBase.marketPrices?.last_updated || new Date().toISOString().slice(0, 10)
      }));
      return { source: 'local_cache', rates: localRates };
    } catch (e) {
      console.warn('Live market price fetch failed, falling back to local data:', e);
      const localRates = (this.knowledgeBase.marketPrices?.rates || []).map(r => ({
        commodity: r.commodity || r.crop_name_mr,
        market: r.market || 'नांदेड मोंढा',
        modal_price: Number(r.modal_price || r.modal_rate || 0),
        max_price: Number(r.max_price || r.max_rate || 0),
        min_price: Number(r.min_price || r.min_rate || 0),
        trend: r.trend || 'stable',
        date: this.knowledgeBase.marketPrices?.last_updated || new Date().toISOString().slice(0, 10)
      }));
      return { source: 'local_cache_fallback', rates: localRates };
    }
  }

  // ---------------------------------------------------------------------
  // 🔊 TEXT-TO-SPEECH — via /api/index?action=tts backend proxy (ElevenLabs key stays server-side)
  // Falls back to the browser's built-in voice if the backend isn't configured.
  // ---------------------------------------------------------------------
  async speak(text, { lang = 'en', onStart, onEnd, onError } = {}) {
    const cleanText = (text || '').replace(/[*_#`]/g, '').replace(/\s+/g, ' ').trim();
    if (!cleanText) return;

    let usedElevenLabs = false;
    this.lastTtsErrorDetail = null;

    // 1. Try serverless backend proxy (/api/index?action=tts) — the ONLY
    //    place a real ElevenLabs key should ever be used (server-side).
    try {
      if (onStart) onStart();
      const response = await fetch('/api/index?action=tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleanText, lang })
      });

      const contentType = response.headers.get('content-type') || '';

      if (response.ok && contentType.includes('audio')) {
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audio.onended = () => { onEnd && onEnd(); URL.revokeObjectURL(audioUrl); };
        audio.onerror = () => { onError && onError('audio_playback_failed'); };
        await audio.play();
        usedElevenLabs = true;
        return;
      } else {
        // Capture the REAL reason (invalid key, quota exceeded, bad voice id, etc.)
        let bodyJson = null;
        try { bodyJson = await response.json(); } catch (_) {}
        this.lastTtsErrorDetail = bodyJson
          ? `[${response.status}] ${bodyJson.error || ''} ${bodyJson.detail || ''}`.trim()
          : `[${response.status}] backend returned no audio`;
        console.error('[Chaya TTS] Backend proxy did not return audio:', this.lastTtsErrorDetail);
      }
    } catch (e) {
      this.lastTtsErrorDetail = `network_error: ${e.message}`;
      console.warn('[Chaya TTS] Backend not reachable (e.g. running on local static server):', e);
    }

    // 2. Fallback: built-in browser speech synthesis (English or Marathi voice depending on selected language)
    if (!usedElevenLabs) {
      if ('speechSynthesis' in window) {
        if (onStart) onStart();
        const utter = new SpeechSynthesisUtterance(cleanText);
        utter.lang = lang === 'mr' ? 'mr-IN' : 'en-IN';
        utter.onend = () => onEnd && onEnd();
        utter.onerror = (ev) => {
          this.lastTtsErrorDetail = (this.lastTtsErrorDetail ? this.lastTtsErrorDetail + ' | ' : '') +
            `browser_tts_failed: ${ev?.error || 'unknown'}`;
          onError && onError('speech_synthesis_failed');
        };
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utter);
      } else if (onError) {
        onError('tts_unavailable');
      }
    }
  }

  async loadKnowledgeBase() {
    try {
      const [cropsRes, soilRes, fertRes, marketRes, pestsRes, surveyRes] = await Promise.all([
        fetch('data/crops_database.json').then(r => r.json()).catch(() => null),
        fetch('data/soil_and_climate.json').then(r => r.json()).catch(() => null),
        fetch('data/fertilizers_and_schemes.json').then(r => r.json()).catch(() => null),
        fetch('data/market_prices.json').then(r => r.json()).catch(() => null),
        fetch('data/pests_and_diseases.json').then(r => r.json()).catch(() => null),
        fetch('data/nanded_survey_data.json').then(r => r.json()).catch(() => null)
      ]);

      if (cropsRes && cropsRes.crops) this.knowledgeBase.crops = cropsRes.crops;
      if (soilRes && soilRes.talukas) this.knowledgeBase.soilClimate = soilRes.talukas;
      if (fertRes) this.knowledgeBase.fertilizersAndSchemes = fertRes;
      if (marketRes && marketRes.rates) this.knowledgeBase.marketPrices = marketRes;
      if (pestsRes && pestsRes.diagnostic_guide) this.knowledgeBase.pestsAndDiseases = pestsRes.diagnostic_guide;
      if (surveyRes && surveyRes.taluka_survey_insights) this.knowledgeBase.nandedSurvey = surveyRes.taluka_survey_insights;

      this.isLoaded = true;
      return true;
    } catch (e) {
      console.warn('Using local knowledge base:', e);
      this.isLoaded = true;
      return true;
    }
  }

  getTalukaProfile(talukaId) {
    if (this.knowledgeBase.soilClimate && this.knowledgeBase.soilClimate[talukaId]) {
      return this.knowledgeBase.soilClimate[talukaId];
    }
    return {
      name_mr: talukaId || 'नांदेड परिसर',
      soil_type: 'काळी व मध्यम जमीन',
      soil_category: 'black_medium',
      ph: 7.2,
      organic_carbon: '0.58%',
      available_nitrogen: 'मध्यम',
      water_table: 'मध्यम'
    };
  }

  getNandedSurveyData(talukaId) {
    if (this.knowledgeBase.nandedSurvey && this.knowledgeBase.nandedSurvey[talukaId]) {
      return this.knowledgeBase.nandedSurvey[talukaId];
    }
    return {
      taluka_name: talukaId || 'नांदेड',
      cluster_zone: 'मराठवाडा बागायती पट्टा',
      ground_survey_findings: [
        'माती परीक्षणात सेंद्रिय कर्ब वाढवणे आणि सूक्ष्म अन्नद्रव्ये (झिंक/लोह) देणे अत्यंत गरजेचे आढळले आहे.',
        'ठिबक सिंचन व रुंद वरंबा (BBF) पद्धतीमुळे पिकांचे उत्पादन 25% जास्त भरते.'
      ],
      local_success_formula: 'पिकांची फेरपालट करा व जैविक खतांचा (ट्रायकोडर्मा, जीवामृत) वापर वाढवा.',
      mandi_selling_pattern: 'नांदेड मोंढ्यात प्रतवारी करून विक्री करावी.'
    };
  }

  evaluateCropsOffline(userInput) {
    const { taluka, soilType, water, land, season } = userInput;
    const landSize = parseFloat(land) || 1;
    const talukaProfile = this.getTalukaProfile(taluka);
    const userSeason = (season || 'kharif').toLowerCase();

    const scoredCrops = (this.knowledgeBase.crops || []).map(crop => {
      let score = 50; // base score
      const reasons_mr = [];
      const reasons_en = [];

      // 1. Season Match
      const cropSeasons = (crop.season || []).map(s => s.toLowerCase());
      if (cropSeasons.includes(userSeason) || cropSeasons.includes('annual')) {
        score += 25;
        const sNameMr = userSeason === 'kharif' ? 'खरीप' : userSeason === 'rabi' ? 'रब्बी' : userSeason === 'summer' ? 'उन्हाळी' : 'वार्षिक';
        const sNameEn = userSeason === 'kharif' ? 'Kharif' : userSeason === 'rabi' ? 'Rabi' : userSeason === 'summer' ? 'Summer' : 'Annual';
        reasons_mr.push(`${sNameMr} हंगामासाठी अत्यंत अनुकूल`);
        reasons_en.push(`Highly suitable for ${sNameEn} season`);
      } else {
        score -= 20;
      }

      // 2. Water Match
      if (water === 'abundant') {
        if (crop.water_requirement === 'abundant') {
          score += 20;
          reasons_mr.push('मुबलक पाण्यासाठी सर्वोत्तम नफा देणारे पीक');
          reasons_en.push('Top profit yielding crop for abundant water supply');
        } else if (crop.water_requirement === 'moderate') {
          score += 15;
          reasons_mr.push('ठिबक सिंचनावर भरघोस उत्पादन');
          reasons_en.push('High yield potential with drip irrigation');
        } else {
          score += 10;
        }
      } else if (water === 'moderate') {
        if (crop.water_requirement === 'moderate') {
          score += 20;
          reasons_mr.push('मध्यम पाणी व ठिबकवर आदर्श उत्पादन');
          reasons_en.push('Ideal crop yield with moderate water and drip');
        } else if (crop.water_requirement === 'low') {
          score += 15;
          reasons_mr.push('कमी पाण्याचा योग्य वापर');
          reasons_en.push('Optimal utilization under limited water supply');
        } else {
          score -= 5;
        }
      } else {
        // low water
        if (crop.water_requirement === 'low') {
          score += 25;
          reasons_mr.push('कमी पाण्यात हमखास उत्पन्न (कोरडवाहूसाठी उत्तम)');
          reasons_en.push('Guaranteed returns with minimal water (ideal for dryland)');
        } else if (crop.water_requirement === 'moderate') {
          score += 10;
        } else {
          score -= 20;
        }
      }

      // 3. Taluka / Soil Match
      const t = (taluka || '').toLowerCase();
      if (['ardhapur', 'mudkhed', 'nanded', 'biloli'].includes(t)) {
        if (['turmeric', 'banana', 'cabbage_cauliflower', 'soybean', 'jowar'].includes(crop.id)) {
          score += 15;
          reasons_mr.push('तालुक्यातील काळ्या सुपीक जमिनीसाठी शिफारसीत');
          reasons_en.push('Recommended for rich black fertile soils of the taluka');
        }
      } else if (['bhokar', 'kinwat', 'mahur', 'himayatnagar'].includes(t)) {
        if (['cotton', 'soybean', 'jowar', 'pigeon_pea', 'turmeric'].includes(crop.id)) {
          score += 15;
          reasons_mr.push('परिसरातील माती व हवामानास अत्यंत पोषक');
          reasons_en.push('Well adapted to local soil profile and agro-climate');
        }
      } else {
        if (['soybean', 'jowar', 'chickpea', 'cabbage_cauliflower', 'cotton', 'onion'].includes(crop.id)) {
          score += 15;
          reasons_mr.push('स्थानिक मोंढ्यात उत्तम मागणी असलेले पीक');
          reasons_en.push('Strong market demand in local APMC Mandis');
        }
      }

      // Financial calculations scaled to acreage
      const yieldMin = crop.yield_per_acre_qtl ? (crop.yield_per_acre_qtl.min * landSize).toFixed(1) : '10';
      const yieldMax = crop.yield_per_acre_qtl ? (crop.yield_per_acre_qtl.max * landSize).toFixed(1) : '15';
      const totalCost = Math.round(crop.estimated_cost_per_acre * landSize);
      const totalRevenue = Math.round(crop.estimated_revenue_per_acre * landSize);
      const netProfit = Math.round(crop.net_profit_per_acre * landSize);

      return {
        ...crop,
        matchScore: Math.min(Math.max(score, 60), 99),
        reasons_mr,
        reasons_en,
        reasons: reasons_mr,
        landSize,
        totalYieldRange_mr: `${yieldMin} ते ${yieldMax} क्विंटल`,
        totalYieldRange_en: `${yieldMin} to ${yieldMax} Quintals`,
        totalYieldRange: `${yieldMin} - ${yieldMax} Quintals`,
        totalCost,
        totalRevenue,
        netProfit
      };
    });

    scoredCrops.sort((a, b) => b.matchScore - a.matchScore || b.netProfit - a.netProfit);
    return scoredCrops.slice(0, 4);
  }

  buildGroundedContext(userInput, topCrops, lang = 'en') {
    const surveyInfo = this.getNandedSurveyData(userInput.taluka);
    const topCrop = topCrops[0] || {};
    const cropName = lang === 'en' ? (topCrop.name_en || topCrop.name_mr) : topCrop.name_mr;

    return `
【📍 Farm Background】: Taluka: ${surveyInfo.taluka_name}, Land: ${userInput.land} Acres, Water: ${userInput.waterText || userInput.water}.
【🎯 Top Recommended Crop】: ${cropName} (Duration: ${topCrop.duration_days})
- Expected Yield (${userInput.land} Acres): ${lang === 'en' ? topCrop.totalYieldRange_en : topCrop.totalYieldRange_mr}
- Estimated Cost: ₹${topCrop.totalCost?.toLocaleString('en-IN')}, Net Profit: ₹${topCrop.netProfit?.toLocaleString('en-IN')}
- Varieties: ${(topCrop.recommended_varieties || []).map(v => v.name).join(', ')}
- Fertilizer & Spray: ${(topCrop.stage_spray_schedule || []).map(s => s.stage + ': ' + s.spray).join(' | ')}
- Critical Pest Remedy: ${(topCrop.critical_pest_remedies || []).map(p => p.pest + ' -> ' + p.remedy).join('; ')}
`;
  }

  async generateGroundedAdvice(userInput, topCrops, lang = 'en') {
    const offlineEvaluation = topCrops || this.evaluateCropsOffline(userInput);

    try {
      const groundedContext = this.buildGroundedContext(userInput, offlineEvaluation, lang);
      const defaultQ = lang === 'en' 
        ? 'Provide high-yield practices, fertilizer dosages, and pest control.' 
        : 'पिकाचे महत्त्वाचे मुद्दे व फवारणी सांगा.';
      const userQuestion = userInput.question ? userInput.question.trim() : defaultQ;

      const systemPrompt = lang === 'en' ? `
You are 'Chaya AI' — an expert agricultural advisor for Maharashtra farmers.
Crucial Rule: Farmers prefer concise, direct, bulleted, and actionable advice.

Respond strictly in English with these 4 clear points:
1. 🌾 **Recommended Variety & Sowing Technique**
2. 📦 **${userInput.land} Acres Expected Yield & Net Profit**
3. 🧪 **Key Fertilizer & Spray Dosage (Current Stage)**
4. 🚨 **Critical Pest Alert & Rapid Chemical/Bio Remedy**
` : `
तुम्ही 'छाया AI' चे कृषी सल्लागार आहात.
महत्त्वाचा नियम: शेतकऱ्यांना लांबलचक परिच्छेद वाचायला आवडत नाहीत.
त्यामुळे तुमचे उत्तर **अत्यंत संक्षिप्त, ठळक, मुद्देसूद आणि थेट कृती करता येणारे (Actionable)** असावे.

खालील 4 मुद्यांमध्येच उत्तर द्या:
1. 🌾 **सर्वोत्तम वाण व पेरणी पद्धत**
2. 📦 **${userInput.land} एकर क्षेत्राचे उत्पादन व निव्वळ नफा**
3. 🧪 **महत्त्वाचा खत व फवारणी डोस (चालू स्टेज)**
4. 🚨 **धोक्याची कीड व झटपट फवारणी औषध**
`;

      const response = await fetch('/api/index?action=groq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemPrompt, groundedContext, userQuestion, language: lang })
      });

      if (!response.ok) throw new Error(`Groq proxy status: ${response.status}`);
      const result = await response.json();

      if (result.text) {
        return { source: 'groq_grounded', text: result.text, rankedCrops: offlineEvaluation };
      } else {
        throw new Error(result.error || 'empty_response');
      }
    } catch (e) {
      console.warn('Groq backend unavailable, using offline engine:', e);
      return this.generateOfflineAIResponse(userInput, offlineEvaluation, lang);
    }
  }

  generateOfflineAIResponse(userInput, scoredCrops, lang = 'en') {
    const top = scoredCrops[0] || {};
    const land = parseFloat(userInput.land) || 1;
    const survey = this.getNandedSurveyData(userInput.taluka);
    const topVar = (top.recommended_varieties && top.recommended_varieties[0]) ? top.recommended_varieties[0].name : (lang === 'en' ? 'Improved Hybrid Variety' : 'सुधारित वाण');
    const topSpray = (top.stage_spray_schedule && top.stage_spray_schedule[0]) ? top.stage_spray_schedule[0].spray : '19:19:19 + Pesticide Foliar Spray';
    const topPest = (top.critical_pest_remedies && top.critical_pest_remedies[0]) ? top.critical_pest_remedies[0] : { pest: 'Pest Control', remedy: 'Timely preventive foliar spray' };

    let text = '';
    if (lang === 'en') {
      text += `⚡ **Farmer Fast-Track Advisory (${survey.taluka_name || 'Nanded'} Region):**\n\n`;
      text += `🌾 **Recommended Crop & Variety:** **${top.name_en || top.name_mr}** | Variety: **${topVar}**\n`;
      text += `📦 **Expected Total Yield (${land} Acres):** **${top.totalYieldRange_en || top.totalYieldRange}** | Net Profit: **₹${top.netProfit?.toLocaleString('en-IN')}**\n`;
      text += `🧪 **Early Stage Fertilizer / Spray Dosage:** ${topSpray}\n`;
      text += `🚨 **Key Pest Alert & Immediate Solution:** If ${topPest.pest} appears -> **${topPest.remedy}**\n\n`;
      text += `📍 *Regional Agronomic Guideline:* Use Broad Bed Furrow (BBF) with drip irrigation for 25% higher yield.`;
    } else {
      text += `⚡ **शेतकरी फास्ट-ट्रॅक सल्ला (${survey.taluka_name} परिसर):**\n\n`;
      text += `🌾 **शिफारसीत पीक व वाण:** **${top.name_mr}** | वाण: **${topVar}**\n`;
      text += `📦 **अपेक्षित उत्पादन (${land} एकर):** **${top.totalYieldRange_mr || top.totalYieldRange}** | निव्वळ नफा: **₹${top.netProfit?.toLocaleString('en-IN')}**\n`;
      text += `🧪 **सुरुवातीचा खत/फवारणी डोस:** ${topSpray}\n`;
      text += `🚨 **धोक्याची कीड व झटपट उपाय:** ${topPest.pest} आल्यास -> **${topPest.remedy}**\n\n`;
      text += `📍 *नांदेड सर्वेक्षण सूत्र:* ${survey.local_success_formula}`;
    }

    return {
      source: 'offline_knowledge_engine',
      text: text,
      rankedCrops: scoredCrops
    };
  }

  async handleChatMessage(message, farmContext, lang = 'en') {
    const q = message.trim().toLowerCase();
    if (!q) return lang === 'en' ? 'Please ask a question.' : 'कृपया प्रश्न विचारा.';

    const topCrops = this.knowledgeBase.crops || [];
    
    // Quick search for soybean/turmeric pests from the PDFs
    for (const crop of topCrops) {
      if (crop.critical_pest_remedies) {
        for (const r of crop.critical_pest_remedies) {
          const cName = lang === 'en' ? (crop.name_en || crop.name_mr) : crop.name_mr;
          if (q.includes(r.pest.toLowerCase()) || q.includes('करपा') || q.includes('चक्री') || q.includes('अळी') || q.includes('खोड') || q.includes('कुज') || q.includes('leaf spot') || q.includes('stem borer') || q.includes('rot') || q.includes('caterpillar')) {
            return lang === 'en'
              ? `🚨 **${cName} - ${r.pest} Remedy:**\n\n👉 **Recommended Dose & Spray:** ${r.remedy}`
              : `🚨 **${crop.name_mr} - ${r.pest} वर तातडीचा उपाय:**\n\n👉 **औषध व मात्रा:** ${r.remedy}`;
          }
        }
      }
    }

    if (q.includes('fertilizer') || q.includes('spray') || q.includes('dose') || q.includes('खत') || q.includes('डोस') || q.includes('फवारणी')) {
      return lang === 'en'
        ? `🧪 **Fertilizer & Spray Guidance:** Initially spray 19:19:19 (100g) + Alika 15ml per 15L pump. During flowering stage, apply 12:61:00 or 00:52:34 for strong root and bud development.`
        : `🧪 **खत व फवारणी सल्ला:** सुरुवातीला 19:19:19 (100g) + अलिका 15ml प्रति 15L पंप फवारा. फुलधारणेच्या वेळी 12:61:00 किंवा 00:52:34 चा वापर करा.`;
    }

    if (q.includes('variety') || q.includes('seed') || q.includes('वाण') || q.includes('बियाणे')) {
      return lang === 'en'
        ? `🌾 **Top Recommended Varieties:**\n• **Soybean:** Phule Sangam (KDS-726), Phule Kimaya, Phule Durva\n• **Turmeric:** Salem, Phule Swaroopa (Curcumin 5.19%)\n• **Cotton:** Bt Cotton Ajeet-155 / RCH-659`
        : `🌾 **उत्कृष्ट वाण:**\n• **सोयाबीन:** फुले संगम (KDS-726), फुले किमया, फुले दुर्वा\n• **हळद:** सेलम, फुले स्वरूपा (क्युरकुमिन 5.19%)`;
    }

    return lang === 'en'
      ? `🌾 **Chaya AI Advice:** For optimum plant health, adopt Broad Bed Furrow (BBF) with drip fertigation and apply preventive insecticidal spray during the first 20 days.`
      : `🌾 **छाया AI सल्ला:** पिकाच्या चांगल्या वाढीसाठी गादी वाफ्यावर (BBF) टोकण पद्धतीने लागवड करा आणि सुरुवातीच्या 20 दिवसांत चक्रीभुंग्यासाठी अलिकाची फवारणी घ्या.`;
  }
}

// Attach globally
window.chayaAI = new ChayaAIEngine();
