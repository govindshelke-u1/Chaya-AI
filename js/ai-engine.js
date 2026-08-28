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
          crop_id: r.crop_id,
          commodity: r.commodity || r.crop_name_en || r.crop_name_mr || 'Crop',
          crop_name_en: r.crop_name_en || r.commodity || 'Crop',
          crop_name_mr: r.crop_name_mr || r.commodity || 'पीक',
          market: r.market || r.market_en || 'Nanded Mandi',
          market_en: r.market_en || r.market || 'Nanded Mandi',
          market_mr: r.market_mr || r.market || 'नांदेड बाजार समिती',
          modal_price: Number(r.modal_price ?? r.modal_rate ?? r.avg_price ?? 0),
          max_price: Number(r.max_price ?? r.max_rate ?? 0),
          min_price: Number(r.min_price ?? r.min_rate ?? 0),
          date: r.date || new Date().toISOString().slice(0, 10)
        }));
        return { source: data.source || 'live', rates: normalized };
      }

      // Backend not configured or empty -> use locally bundled JSON
      const localRates = (this.knowledgeBase.marketPrices?.rates || []).map(r => ({
        crop_id: r.crop_id,
        commodity: r.crop_name_en || r.crop_name_mr || 'Crop',
        crop_name_en: r.crop_name_en || 'Crop',
        crop_name_mr: r.crop_name_mr || 'पीक',
        market: r.market_en || r.market_mr || 'Nanded Mondha APMC',
        market_en: r.market_en || 'Nanded Mondha APMC',
        market_mr: r.market_mr || 'नांदेड मोंढा APMC',
        modal_price: Number(r.modal_price ?? r.modal_rate ?? 0),
        max_price: Number(r.max_price ?? r.max_rate ?? 0),
        min_price: Number(r.min_price ?? r.min_rate ?? 0),
        date: this.knowledgeBase.marketPrices?.last_updated || new Date().toISOString().slice(0, 10)
      }));
      return { source: 'local_cache', rates: localRates };
    } catch (e) {
      console.warn('Live market price fetch failed, falling back to local data:', e);
      const localRates = (this.knowledgeBase.marketPrices?.rates || []).map(r => ({
        crop_id: r.crop_id,
        commodity: r.crop_name_en || r.crop_name_mr || 'Crop',
        crop_name_en: r.crop_name_en || 'Crop',
        crop_name_mr: r.crop_name_mr || 'पीक',
        market: r.market_en || r.market_mr || 'Nanded Mondha APMC',
        market_en: r.market_en || 'Nanded Mondha APMC',
        market_mr: r.market_mr || 'नांदेड मोंढा APMC',
        modal_price: Number(r.modal_price ?? r.modal_rate ?? 0),
        max_price: Number(r.max_price ?? r.max_rate ?? 0),
        min_price: Number(r.min_price ?? r.min_rate ?? 0),
        date: this.knowledgeBase.marketPrices?.last_updated || new Date().toISOString().slice(0, 10)
      }));
      return { source: 'local_cache_fallback', rates: localRates };
    }
  }

  // ---------------------------------------------------------------------
  // 🔊 TEXT-TO-SPEECH — with Voice Auto-Selection & Chrome Speech Resilience
  // ---------------------------------------------------------------------
  stopSpeaking() {
    if (this._ttsKeepAliveTimer) {
      clearInterval(this._ttsKeepAliveTimer);
      this._ttsKeepAliveTimer = null;
    }
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch (_) {}
      this.currentAudio = null;
    }
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (_) {}
    }
  }

  getBestVoice(lang = 'en') {
    if (!('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices() || [];
    if (!voices.length) return null;

    if (lang === 'mr') {
      return (
        voices.find(v => v.lang && v.lang.toLowerCase().startsWith('mr')) ||
        voices.find(v => v.name && v.name.toLowerCase().includes('marathi')) ||
        voices.find(v => v.lang && v.lang.toLowerCase().startsWith('hi')) ||
        voices.find(v => v.name && v.name.toLowerCase().includes('hindi')) ||
        voices.find(v => v.lang && v.lang.toLowerCase().includes('in')) ||
        voices[0]
      );
    } else {
      return (
        voices.find(v => v.lang && (v.lang.toLowerCase() === 'en-in' || v.lang.toLowerCase().startsWith('en-in'))) ||
        voices.find(v => v.name && v.name.toLowerCase().includes('india')) ||
        voices.find(v => v.lang && v.lang.toLowerCase().startsWith('en')) ||
        voices[0]
      );
    }
  }

  cleanTextForSpeech(text, lang = 'en') {
    if (!text) return '';
    let t = text
      .replace(/[*_#`~>]/g, '') // remove markdown symbols
      .replace(/•/g, '')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/\(.*?\)/g, '') // remove bracketed text to make voice concise
      .replace(/\s+/g, ' ')
      .trim();

    // Ensure the voice always says simply "Chaya" or "छाया" instead of "Chaya AI" or "छाया आई"
    t = t
      .replace(/छाया\s*(?:AI|एआय|ए\.आय\.|आई)/gi, 'छाया')
      .replace(/Chaya\s*AI/gi, 'Chaya')
      .replace(/\bAI\b/gi, '');

    if (lang === 'mr') {
      t = t
        .replace(/(\d+)\s*:\s*(\d+)\s*:\s*(\d+)/g, '$1 $2 $3 खत')
        .replace(/(\d+)\s*L\b/gi, '$1 लिटर')
        .replace(/(\d+)\s*ml\b/gi, '$1 मिली')
        .replace(/(\d+)\s*gm?\b/gi, '$1 ग्रॅम')
        .replace(/(\d+)\s*kg\b/gi, '$1 किलो')
        .replace(/₹\s*(\d+)/g, '$1 रुपये')
        .replace(/BBF/gi, 'गादी वाफा पद्धत')
        .replace(/NPK/gi, 'नत्र स्फुरद पालाश')
        .replace(/APMC/gi, 'बाजार समिती');
    }
    return t;
  }

  async speak(text, { lang = 'en', onStart, onEnd, onError } = {}) {
    this.stopSpeaking();
    const cleanText = this.cleanTextForSpeech(text, lang);
    if (!cleanText) return;

    // 1. Primary: High-speed, responsive browser SpeechSynthesis
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        window.speechSynthesis.resume();

        const utter = new SpeechSynthesisUtterance(cleanText);
        utter.lang = lang === 'mr' ? 'mr-IN' : 'en-IN';
        utter.rate = lang === 'mr' ? 1.05 : 1.10;
        utter.pitch = 1.0;

        const matchedVoice = this.getBestVoice(lang);
        if (matchedVoice) {
          utter.voice = matchedVoice;
        }

        let hasStarted = false;
        utter.onstart = () => {
          hasStarted = true;
          if (onStart) onStart();
        };

        utter.onend = () => {
          if (this._ttsKeepAliveTimer) {
            clearInterval(this._ttsKeepAliveTimer);
            this._ttsKeepAliveTimer = null;
          }
          if (onEnd) onEnd();
        };

        utter.onerror = (ev) => {
          console.warn('[Chaya Voice] SpeechSynthesis event error:', ev);
          if (this._ttsKeepAliveTimer) {
            clearInterval(this._ttsKeepAliveTimer);
            this._ttsKeepAliveTimer = null;
          }
          // Fallback to audio endpoint if available
          this.speakViaAudioFallback(cleanText, lang, onStart, onEnd, onError);
        };

        // Chromium keepalive timer
        this._ttsKeepAliveTimer = setInterval(() => {
          if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
            window.speechSynthesis.pause();
            window.speechSynthesis.resume();
          }
        }, 3500);

        // Safe tick delay before speak to avoid cancel collision in Chrome
        setTimeout(() => {
          try {
            window.speechSynthesis.resume();
            window.speechSynthesis.speak(utter);
            if (!hasStarted && onStart) onStart();
          } catch (speakErr) {
            console.warn('[Chaya Voice] speak error:', speakErr);
            this.speakViaAudioFallback(cleanText, lang, onStart, onEnd, onError);
          }
        }, 60);
        return;
      } catch (err) {
        console.warn('[Chaya Voice] SpeechSynthesis initialization error:', err);
      }
    }

    // 2. Fallback: Audio endpoint / Google Translate Web Audio
    this.speakViaAudioFallback(cleanText, lang, onStart, onEnd, onError);
  }

  async speakViaAudioFallback(cleanText, lang, onStart, onEnd, onError) {
    try {
      const audioUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${lang === 'mr' ? 'mr' : 'en'}&q=${encodeURIComponent(cleanText.slice(0, 200))}`;
      const audio = new Audio(audioUrl);
      audio.playbackRate = 1.08;
      this.currentAudio = audio;

      audio.onplay = () => { if (onStart) onStart(); };
      audio.onended = () => {
        this.currentAudio = null;
        if (onEnd) onEnd();
      };
      audio.onerror = () => {
        this.currentAudio = null;
        if (onError) onError('audio_failed');
      };

      await audio.play();
    } catch (e) {
      console.warn('[Chaya Voice] Audio playback failed:', e);
      if (onError) onError(e.message || 'playback_error');
    }
  }

  async loadKnowledgeBase() {
    try {
      const [cropsRes, soilRes, fertRes, marketRes, pestsRes, surveyRes] = await Promise.all([
        fetch('/data/crops_database.json').then(r => r.json()).catch(() => null),
        fetch('/data/soil_and_climate.json').then(r => r.json()).catch(() => null),
        fetch('/data/fertilizers_and_schemes.json').then(r => r.json()).catch(() => null),
        fetch('/data/market_prices.json').then(r => r.json()).catch(() => null),
        fetch('/data/pests_and_diseases.json').then(r => r.json()).catch(() => null),
        fetch('/data/nanded_survey_data.json').then(r => r.json()).catch(() => null)
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
      ph: 7.3,
      n_default: 220,
      p_default: 17,
      k_default: 320,
      ph_default: 7.3,
      oc_default: 0.58,
      organic_carbon: '0.58%',
      available_nitrogen: 'मध्यम (220 kg/ha)',
      available_phosphorus: 'मध्यम (17 kg/ha)',
      available_potassium: 'उत्तम (320 kg/ha)',
      water_table: 'मध्यम'
    };
  }

  getPrecisionSoilHealthAnalysis(userInput = {}) {
    const talukaProfile = this.getTalukaProfile(userInput?.taluka);
    
    // Parse user inputs or fall back to taluka defaults
    const hasCustomN = Boolean(userInput?.nutrientN && !isNaN(parseFloat(userInput.nutrientN)));
    const hasCustomP = Boolean(userInput?.nutrientP && !isNaN(parseFloat(userInput.nutrientP)));
    const hasCustomK = Boolean(userInput?.nutrientK && !isNaN(parseFloat(userInput.nutrientK)));
    const hasCustomPh = Boolean(userInput?.soilPh && !isNaN(parseFloat(userInput.soilPh)));
    const hasCustomOc = Boolean(userInput?.organicCarbon && !isNaN(parseFloat(userInput.organicCarbon)));

    const userN = hasCustomN ? parseFloat(userInput.nutrientN) : (talukaProfile.n_default || 220);
    const userP = hasCustomP ? parseFloat(userInput.nutrientP) : (talukaProfile.p_default || 17);
    const userK = hasCustomK ? parseFloat(userInput.nutrientK) : (talukaProfile.k_default || 320);
    const userPh = hasCustomPh ? parseFloat(userInput.soilPh) : (talukaProfile.ph_default || talukaProfile.ph || 7.3);
    const userOc = hasCustomOc ? parseFloat(userInput.organicCarbon) : (talukaProfile.oc_default || 0.58);
    const isCustomInput = hasCustomN || hasCustomP || hasCustomK || hasCustomPh || hasCustomOc;

    // Benchmarking (ICAR / MPKV Rahuri standard ratings)
    // N: <140 Low, 140-280 Medium, >280 High (kg/ha)
    const nRating = userN < 140 ? 'low' : (userN <= 280 ? 'medium' : 'high');
    // P: <14 Low, 14-28 Medium, >28 High (kg/ha)
    const pRating = userP < 14 ? 'low' : (userP <= 28 ? 'medium' : 'high');
    // K: <150 Low, 150-300 Medium, >300 High (kg/ha)
    const kRating = userK < 150 ? 'low' : (userK <= 300 ? 'medium' : 'high');
    // pH: <6.5 Acidic, 6.5-7.8 Optimal, >7.8 Alkaline
    const phRating = userPh < 6.5 ? 'acidic' : (userPh <= 7.8 ? 'optimal' : 'alkaline');

    const ratings = {
      n: {
        val: userN,
        rating: nRating,
        mr: nRating === 'low' ? 'कमी (Deficit)' : (nRating === 'high' ? 'मुबलक (High)' : 'मध्यम (Medium)'),
        en: nRating === 'low' ? 'Low (Deficit)' : (nRating === 'high' ? 'High' : 'Medium (Optimal)')
      },
      p: {
        val: userP,
        rating: pRating,
        mr: pRating === 'low' ? 'कमी (Deficit)' : (pRating === 'high' ? 'मुबलक (High)' : 'मध्यम (Medium)'),
        en: pRating === 'low' ? 'Low (Deficit)' : (pRating === 'high' ? 'High' : 'Medium (Optimal)')
      },
      k: {
        val: userK,
        rating: kRating,
        mr: kRating === 'low' ? 'कमी (Deficit)' : (kRating === 'high' ? 'मुबलक (Rich)' : 'मध्यम (Medium)'),
        en: kRating === 'low' ? 'Low (Deficit)' : (kRating === 'high' ? 'High (Rich)' : 'Medium (Optimal)')
      },
      ph: {
        val: userPh,
        rating: phRating,
        mr: phRating === 'acidic' ? 'आम्लधर्मी (Acidic)' : (phRating === 'alkaline' ? 'अल्कलाईन/चुनखडी (Alkaline)' : 'उत्कृष्ट सामू (Optimal)'),
        en: phRating === 'acidic' ? 'Acidic' : (phRating === 'alkaline' ? 'Alkaline' : 'Optimal')
      }
    };

    const fertilizerAdjustments = {
      n_mr: nRating === 'low' 
        ? 'नत्र (N) कमतरता: बेसल डोसमध्ये 25 kg युरिया किंवा 50 kg DAP वाढवा व पेरणीवेळी अझोटोबॅक्टर जिवाणू वापरा.'
        : (nRating === 'high' 
            ? 'नत्र (N) मुबलक: रासायनिक युरियाचा मारा 25% कमी करा, अन्यथा रसशोषक कीड व पानावरील बुरशी वाढू शकते.' 
            : 'नत्र (N) संतुलित: शिफारशीनुसार विभागून (Split Doses) खत द्या.'),
      n_en: nRating === 'low'
        ? 'Nitrogen Deficit: Increase basal DAP/Urea by 20% and inoculate seeds with Azotobacter biofertilizer.'
        : (nRating === 'high'
            ? 'Nitrogen Surplus: Reduce synthetic Urea by 25% to prevent succulent vegetative growth and sucking pest surges.'
            : 'Nitrogen Balanced: Apply standard nitrogen doses in 2-3 split stages.'),
      p_mr: pRating === 'low'
        ? 'स्फुरद (P) कमतरता: बेसल डोसमध्ये 50-100 kg सिंगल सुपर फॉस्फेट (SSP) + 2 kg PSB जिवाणू संवर्धक वापरा.'
        : (pRating === 'high'
            ? 'स्फुरद (P) पुरेसे: अतिरिक्त 12:61:00 चा अनावश्यक खर्च टाळून बचत करा.'
            : 'स्फुरद (P) समाधानकारक: मुळांची जोमदार वाढ व फुटवे फुटण्यासाठी अनुकूल.'),
      p_en: pRating === 'low'
        ? 'Phosphorus Deficit: Apply Single Super Phosphate (SSP 100 kg/acre) + PSB biofertilizer during seedbed preparation.'
        : (pRating === 'high'
            ? 'Phosphorus Rich: Avoid redundant water-soluble 12:61:00 applications to save input expenses.'
            : 'Phosphorus Optimal: Ensures vigorous early root establishment and strong tiller growth.'),
      k_mr: kRating === 'high'
        ? 'पालाश (K) मुबलक: जमिनीत नैसर्गिक पालाश भरपूर असल्याने अतिरिक्त 00:00:50 वर होणारा ₹1,200/एकर खर्च वाचवा!'
        : (kRating === 'low'
            ? 'पालाश (K) कमतरता: फळ/कंद फुगवणीच्या काळात MOP (म्युरेट ऑफ पोटॅश) किंवा 00:00:50 ची आळवणी अवश्य करा.'
            : 'पालाश (K) मध्यम: पिकाची रोगप्रतिकारशक्ती व दाण्यांच्या वजनासाठी ठिबकद्वारे नियमित मात्रा द्या.'),
      k_en: kRating === 'high'
        ? 'Potassium Rich: High native soil Potash saves ~₹1,200/acre by eliminating unnecessary 00:00:50 foliar sprays!'
        : (kRating === 'low'
            ? 'Potassium Deficit: Supply Muriate of Potash (MOP) or drip 00:00:50 during fruit/tuber bulking stage.'
            : 'Potassium Medium: Maintain steady potassium fertigation for optimal grain filling and disease resistance.'),
      ph_mr: phRating === 'alkaline'
        ? 'जमीन चुनखडीयुक्त/अल्कलाईन (pH > 7.8): एकरी 50 kg सल्फर (गंधक) वापरा आणि सूक्ष्म अन्नद्रव्ये चिलेटेड स्वरूपात फवारा.'
        : (phRating === 'acidic'
            ? 'जमीन आम्लधर्मी (pH < 6.5): पेरणीपूर्व शेतात एकरी 100 kg कृषी चुना (Agricultural Lime) मिसळा.'
            : 'सामू (pH) आदर्श (6.5 - 7.8): अन्नद्रव्यांचे शोषण मुळांद्वारे वेगाने होते.'),
      ph_en: phRating === 'alkaline'
        ? 'Alkaline/Calcareous Soil (pH > 7.8): Apply 50 kg agricultural Sulphur/acre and spray chelated micronutrients.'
        : (phRating === 'acidic'
            ? 'Acidic Soil (pH < 6.5): Incorporate 100 kg Agricultural Lime per acre before sowing.'
            : 'Optimal Soil pH (6.5 - 7.8): Peak bioavailability for all essential micro & macronutrients.')
    };

    const actionableAdvice_mr = [
      fertilizerAdjustments.n_mr,
      fertilizerAdjustments.p_mr,
      fertilizerAdjustments.k_mr,
      fertilizerAdjustments.ph_mr
    ];

    const actionableAdvice_en = [
      fertilizerAdjustments.n_en,
      fertilizerAdjustments.p_en,
      fertilizerAdjustments.k_en,
      fertilizerAdjustments.ph_en
    ];

    return {
      isCustomInput,
      hasCustomN,
      hasCustomP,
      hasCustomK,
      hasCustomPh,
      hasCustomOc,
      n: userN,
      p: userP,
      k: userK,
      ph: userPh,
      oc: userOc,
      ratings,
      fertilizerAdjustments,
      actionableAdvice_mr,
      actionableAdvice_en
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

  evaluateCropsOffline(userInput = {}) {
    const { taluka, soilType, water, land, season } = userInput;
    const landSize = parseFloat(land) || 1;
    const talukaProfile = this.getTalukaProfile(taluka);
    const userSeason = (season || 'kharif').toLowerCase();

    // Check custom NPK inputs safely
    const soilHealth = this.getPrecisionSoilHealthAnalysis(userInput);
    const userN = typeof soilHealth.n === 'object' ? (soilHealth.n?.val ?? 220) : (soilHealth.n ?? 220);
    const userP = typeof soilHealth.p === 'object' ? (soilHealth.p?.val ?? 17) : (soilHealth.p ?? 17);
    const userK = typeof soilHealth.k === 'object' ? (soilHealth.k?.val ?? 320) : (soilHealth.k ?? 320);
    const userPh = typeof soilHealth.ph === 'object' ? (soilHealth.ph?.val ?? 7.3) : (soilHealth.ph ?? 7.3);

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

      // 4. Precision Nutrients (N, P, K & pH) Ground Match
      // Potassium Affinity: heavy feeders like Turmeric, Banana, Cabbage thrive in high K
      if (userK >= 300 && ['turmeric', 'banana', 'cabbage_cauliflower', 'sugarcane', 'onion'].includes(crop.id)) {
        score += 10;
        reasons_mr.push(`जमिनीत पालाश (K: ${userK} kg/ha) मुबलक असल्याने कंद/फळ फुगवणीसाठी अतिशय अनुकूल`);
        reasons_en.push(`High soil Potassium (${userK} kg/ha) provides superior bulb & fruit development`);
      }

      // Nitrogen Dynamics: Legumes (Soybean, Tur, Chickpea) fix atmospheric nitrogen
      if (userN < 210 && ['soybean', 'pigeon_pea', 'chickpea'].includes(crop.id)) {
        score += 10;
        reasons_mr.push(`कमी नत्र (N: ${userN} kg/ha) स्थितीतही मुळांवरील गाठींद्वारे हवेतील नत्र शोषून खताचा खर्च वाचवते`);
        reasons_en.push(`Biological nitrogen fixation saves input costs under low soil Nitrogen (${userN} kg/ha)`);
      } else if (userN >= 220 && ['banana', 'sugarcane', 'cabbage_cauliflower'].includes(crop.id)) {
        score += 8;
        reasons_mr.push(`उपलब्ध नत्र (N: ${userN} kg/ha) पिकाच्या जोमदार शाकीय वाढीसाठी उत्तम`);
        reasons_en.push(`Good available Nitrogen (${userN} kg/ha) accelerates vegetative biomass growth`);
      }

      // Phosphorus responsiveness for root development & pod filling
      if (userP >= 16 && ['soybean', 'cotton', 'turmeric', 'chickpea'].includes(crop.id)) {
        score += 6;
        reasons_mr.push(`उपलब्ध स्फुरद (P: ${userP} kg/ha) मुळांची जोमदार वाढ व फुलोऱ्यासाठी पोषक`);
        reasons_en.push(`Optimal available Phosphorus (${userP} kg/ha) promotes prolific flowering & pod set`);
      }

      // Soil pH Range Check
      if (crop.soil_ph_range && Array.isArray(crop.soil_ph_range)) {
        const [minPh, maxPh] = crop.soil_ph_range;
        if (userPh >= minPh && userPh <= maxPh) {
          score += 5;
          reasons_mr.push(`मातीचा सामू (pH ${userPh}) पिकाच्या आदर्श मर्यादेत (${minPh}-${maxPh})`);
          reasons_en.push(`Soil pH (${userPh}) matches optimal range (${minPh}-${maxPh})`);
        } else if (userPh > maxPh + 0.4 || userPh < minPh - 0.4) {
          score -= 6;
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
    const soilHealth = this.getPrecisionSoilHealthAnalysis(userInput);
    const topCrop = topCrops[0] || {};
    const cropName = lang === 'en' ? (topCrop.name_en || topCrop.name_mr) : topCrop.name_mr;

    const nVal = typeof soilHealth.n === 'object' ? (soilHealth.n?.val ?? 220) : (soilHealth.n ?? 220);
    const pVal = typeof soilHealth.p === 'object' ? (soilHealth.p?.val ?? 17) : (soilHealth.p ?? 17);
    const kVal = typeof soilHealth.k === 'object' ? (soilHealth.k?.val ?? 320) : (soilHealth.k ?? 320);
    const phVal = typeof soilHealth.ph === 'object' ? (soilHealth.ph?.val ?? 7.3) : (soilHealth.ph ?? 7.3);
    const nRating = soilHealth.ratings?.n?.rating || 'medium';
    const pRating = soilHealth.ratings?.p?.rating || 'medium';
    const kRating = soilHealth.ratings?.k?.rating || 'medium';

    const npkContext = `N: ${nVal} kg/ha (${nRating}), P: ${pVal} kg/ha (${pRating}), K: ${kVal} kg/ha (${kRating}), pH: ${phVal}`;

    return `
【📍 Farm Background】: Taluka: ${surveyInfo.taluka_name}, Land: ${userInput.land} Acres, Water: ${userInput.waterText || userInput.water}.
【🧪 Soil Health & NPK Values】: ${npkContext} (Custom Report: ${soilHealth.isCustomInput ? 'YES' : 'Taluka Regional Baseline'}).
【🎯 Top Recommended Crop】: ${cropName} (Duration: ${topCrop.duration_days})
- Expected Yield (${userInput.land} Acres): ${lang === 'en' ? topCrop.totalYieldRange_en : topCrop.totalYieldRange_mr}
- Estimated Cost: ₹${topCrop.totalCost?.toLocaleString('en-IN')}, Net Profit: ₹${topCrop.netProfit?.toLocaleString('en-IN')}
- Varieties: ${(topCrop.recommended_varieties || []).map(v => v.name).join(', ')}
- Fertilizer & Spray: ${(topCrop.stage_spray_schedule || []).map(s => s.stage + ': ' + s.spray).join(' | ')}
- Critical Pest Remedy: ${(topCrop.critical_pest_remedies || []).map(p => p.pest + ' -> ' + p.remedy).join('; ')}
- Precision NPK Advice: ${lang === 'en' ? (soilHealth.fertilizerAdjustments.n_en + ' ' + soilHealth.fertilizerAdjustments.p_en + ' ' + soilHealth.fertilizerAdjustments.k_en) : (soilHealth.fertilizerAdjustments.n_mr + ' ' + soilHealth.fertilizerAdjustments.p_mr + ' ' + soilHealth.fertilizerAdjustments.k_mr)}
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

  async handleChatMessage(message, farmContext, lang = 'en', conversationHistory = []) {
    const q = (message || '').trim().toLowerCase();
    const isMr = lang === 'mr';
    if (!q) return isMr ? 'कृपया आपला शेतीविषयक प्रश्न विचारा.' : 'Please ask your farming query.';

    // 1. Try Live AI Backend first (Gemini 2.5 Flash / Groq)
    try {
      const response = await fetch('/api/index?action=chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          language: lang,
          farmContext,
          conversationHistory
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data && data.text) {
          return data.text;
        }
      }
    } catch (e) {
      console.warn('Live AI chat endpoint unavailable, activating local intelligent agro engine:', e);
    }

    // 2. Comprehensive Local Expert Agro Engine
    const crops = this.knowledgeBase.crops || [];
    const diagGuide = this.knowledgeBase.pestsAndDiseases || [];
    const schemes = this.knowledgeBase.fertilizersAndSchemes || {};

    // A. Specific Diagnostic Guide Search (Pests & Diseases)
    for (const d of diagGuide) {
      const pMr = (d.problem_mr || '').toLowerCase();
      const pEn = (d.problem_en || '').toLowerCase();

      const matchedProblem = (pMr && q.includes(pMr.split(' ')[0])) ||
        (q.includes('करपा') && pMr.includes('करपा')) ||
        (q.includes('कंदकुज') && pMr.includes('कुज')) ||
        (q.includes('खोडकिडा') && pMr.includes('खोड')) ||
        (q.includes('dbm') && pEn.includes('dbm')) ||
        (q.includes('चक्रीभुंगा') && pMr.includes('चक्रीभुंगा')) ||
        (q.includes('खोडमाशी') && pMr.includes('खोडमाशी')) ||
        (q.includes('बोंडअळी') && pMr.includes('बोंडअळी')) ||
        (q.includes('घाटे अळी') && pMr.includes('घाटे')) ||
        (q.includes('सिगाटोका') && pMr.includes('सिगाटोका')) ||
        (q.includes('rot') && pEn.includes('rot')) ||
        (q.includes('leaf spot') && pEn.includes('leaf spot'));

      if (matchedProblem) {
        if (isMr) {
          return `🚨 **${d.crop_mr} — ${d.problem_mr}:**\n\n` +
            `🔍 **लक्षणे:** ${d.symptoms_mr}\n` +
            `🧪 **रासायनिक उपाय (प्रति १५L पंप):** ${d.chemical_solution_mr}\n` +
            `🌿 **जैविक/नैसर्गिक उपाय:** ${d.organic_solution_mr}`;
        } else {
          return `🚨 **${d.crop_en} — ${d.problem_en}:**\n\n` +
            `🔍 **Symptoms:** ${d.symptoms_en}\n` +
            `🧪 **Chemical Remedy (Per 15L Pump):** ${d.chemical_solution_en}\n` +
            `🌿 **Bio / Organic Remedy:** ${d.organic_solution_en}`;
        }
      }
    }

    // B. Horticultural & Field Crops (Tomato, Chilli, Ginger, Garlic, Pomegranate, Sugarcane, Brinjal, Bhendi, Papaya, Watermelon, Wheat, Maize)
    
    // 1. Tomato (टोमॅटो / टमाटा / टमाट्याची / टमाटर)
    if (q.includes('tomato') || q.includes('टोमॅटो') || q.includes('टमाट') || q.includes('टमाटर') || q.includes('tamatar') || q.includes('tamata')) {
      if (q.includes('रोग') || q.includes('कीड') || q.includes('pest') || q.includes('disease') || q.includes('करपा') || q.includes('चुरडा') || q.includes('अळी')) {
        return isMr
          ? `🚨 **टोमॅटो प्रमुख कीड-रोग व तातडीचे उपाय:**\n\n` +
            `• **पांढरी माशी व चुरडा-मुरडा (Leaf Curl):** पेगासस (१५ ग्रॅम) किंवा अलिका (१२ मिली) + निंबोळी तेल (३० मिली) प्रति १५L पंप फवारा.\n` +
            `• **करपा (Early/Late Blight):** रिडोमिल गोल्ड (३५ ग्रॅम) किंवा नॅटिव्हो (१० ग्रॅम) किंवा कस्टोडिया (२० मिली) प्रति १५L पंप.\n` +
            `• **फळ पोखरणारी अळी (Fruit Borer):** कोराजन (६ मिली) किंवा फेम (५ मिली) प्रति १५L पंप.\n` +
            `• **फुलगळ व फळगळ:** प्लॅनोफिक्स (४ मिली) + बोरॉन (२० ग्रॅम) प्रति १५L पंप फवारा.`
          : `🚨 **Tomato Disease & Pest Management:**\n\n` +
            `• **Whiteflies & Leaf Curl Virus:** Spray Pegasus (15g) or Alika (12ml) + Neem Oil (30ml) per 15L pump.\n` +
            `• **Early & Late Blight (Karpa):** Spray Ridomil Gold (35g) or Nativo (10g) or Custodia (20ml) per 15L pump.\n` +
            `• **Fruit Borer Caterpillars:** Spray Coragen (6ml) or Fame (5ml) or Proclaim (8g) per 15L pump.\n` +
            `• **Flower Drop Prevention:** Spray Planofix (4ml) + Chelated Boron (20g) per 15L pump during peak bloom.`;
      }
      if (q.includes('खत') || q.includes('डोस') || q.includes('ठिबक') || q.includes('fertilizer') || q.includes('drip') || q.includes('dose')) {
        return isMr
          ? `🧪 **टोमॅटो खत व ठिबक फर्टीगेशन वेळापत्रक (प्रति एकर):**\n\n` +
            `1. **लागवड ते ३० दिवस (शाकीय वाढ):** १९:१९:१९ (३ किलो) आठवड्यातून दोनदा + ह्युमिक अ‍ॅसिड ५०० ग्रॅम.\n` +
            `2. **३० ते ६० दिवस (फुलधारणा व फळधारणा):** १२:६१:०० (३ किलो) + कॅल्शियम नायट्रेट (२.५ किलो) + बोरॉन (५०० ग्रॅम).\n` +
            `3. **६० दिवस पुढे (फळ फुगवण व तोडणी):** ००:५२:३४ (३ किलो) आणि ००:००:५० (४ किलो) आठवड्यातून एकदा.`
          : `🧪 **Tomato Drip Fertigation Schedule (Per Acre):**\n\n` +
            `1. **Day 1-30 (Vegetative):** 19:19:19 (3 kg twice weekly) + Humic Acid (500g).\n` +
            `2. **Day 31-60 (Flowering & Fruit Set):** 12:61:00 (3 kg) + Calcium Nitrate (2.5 kg) + Boron (500g).\n` +
            `3. **Day 60+ (Sizing & Harvesting):** 00:52:34 (3 kg) and 00:00:50 (4 kg) once weekly.`;
      }
      // General Cultivation & Complete Guide (टोमॅटो/टमाटा शेती कशी करावी / माहिती)
      return isMr
        ? `🍅 **टोमॅटो (टमाटा) आधुनिक सुधारित शेती तंत्रज्ञान:**\n\n` +
          `1. **गादी वाफा व अंतर (Spacing):** ३.५ ते ४ फूट रुंद गादी वाफ्यावर **४x१.५ फूट** किंवा ५x२ फूट अंतरावर नागमोडी पद्धतीने रोपे लावा.\n` +
          `2. **रोपवाटिका व बीजप्रक्रिया:** २५ ते ३० दिवसांची सशक्त रोपे वापरा. मुळे ट्रायकोडर्मा (५ ग्रॅम/लिटर) + ह्युमिक अ‍ॅसिड (२ मिली/लिटर) द्रावणात बुडवून लावा.\n` +
          `3. **उत्कृष्ट वाण (Varieties):** सिजेंटा अभिनव, US-440, आर्यमान, साहो (Seminis), फुले राजा.\n` +
          `4. **मल्चिंग व ठिबक:** २५-३० मायक्रॉन सिल्व्हर-ब्लॅक मल्चिंग पेपर व १६ मिमी इनलाईन ठिबक वापरा.\n` +
          `5. **बांबू-तार बांधणी (Staking):** लागवडीनंतर २५-३० दिवसांनी बांबू व तारेच्या साहाय्याने झाडे बांधा, ज्यामुळे फळे डागमुक्त व दर्जेदार मिळतात.\n` +
          `6. **खत नियोजन (ठिबकद्वारे):** सुरुवातीला १९:१९:१९ (३ किलो), फुलधारणेत १२:६१:०० व कॅल्शियम, फळ फुगवणीत ००:००:५० खत द्यावे.\n` +
          `7. **कीड नियंत्रण:** पांढरी माशी व चुरड्यासाठी पेगासस (१५ ग्रॅम) आणि फळ पोखरणार्‍या अळीसाठी कोराजन (६ मिली) फवारा.`
        : `🍅 **High-Yield Commercial Tomato Cultivation Guide:**\n\n` +
          `1. **Bed Preparation & Spacing:** Prepare 3.5 to 4 ft raised beds with 16mm inline drip. Transplant at **4 x 1.5 ft** (single row) or **5 x 2 ft** spacing with 25-30 micron silver-black mulching sheet.\n` +
          `2. **Seedlings & Root Treatment:** Use **25 to 30-day-old** healthy nursery seedlings. Dip seedling roots in *Trichoderma viride* (5g/L) + Humic Acid (2ml/L) for 15 minutes before planting to prevent damping-off.\n` +
          `3. **Top Recommended Varieties:** Syngenta Abhinav, US-440, Aryaman, Saho (TO-1057), Phule Raja.\n` +
          `4. **Trellising / Staking:** Install bamboo stakes and wire trellising 25-30 days after transplanting to keep foliage and fruits off the ground, maximizing Grade-A export yield.\n` +
          `5. **Fertigation Schedule (via Drip):**\n` +
          `   • **Day 1-30 (Vegetative):** 19:19:19 (3 kg/acre twice a week)\n` +
          `   • **Day 31-60 (Flowering & Fruit Set):** 12:61:00 (3 kg) + Calcium Nitrate (2.5 kg) + Boron (500g)\n` +
          `   • **Day 60+ (Harvesting & Sizing):** 00:52:34 and 00:00:50 (4 kg/acre)\n` +
          `6. **Key Pest Protection:** For leaf curl virus and whiteflies, spray Pegasus (15g) or Alika (12ml/15L pump); for fruit borer, spray Coragen (6ml/15L).`;
    }

    // 2. Chilli / Mirchi (मिरची / मिरचीची)
    if (q.includes('chilli') || q.includes('chili') || q.includes('मिरच') || q.includes('mirchi')) {
      if (q.includes('रोग') || q.includes('कीड') || q.includes('बोकड्या') || q.includes('चुरडा') || q.includes('थ्रिप्स') || q.includes('pest')) {
        return isMr
          ? `🌶️ **मिरची बोकड्या (चुरडा-मुरडा) व थ्रिप्स नियंत्रण:**\n\n` +
            `• **पहिली फवारणी (थ्रिप्स व कोळी):** डेलिगेट (१८ मिली) + ओमाईट (२५ मिली) प्रति १५L पंप.\n` +
            `• **दुसरी फवारणी (पांढरी माशी व मावा):** पेगासस (१८ ग्रॅम) किंवा अलिका (१२ मिली) + निंबोळी अर्क ५० मिली.\n` +
            `• **फुलगळ थांबवण्यासाठी:** प्लॅनोफिक्स ४ मिली + चिलेटेड बोरॉन २० ग्रॅम फवारा.`
          : `🌶️ **Chilli Leaf Curl & Thrips/Mites Control:**\n\n` +
            `• **Spray 1:** Delegate (18ml) + Omite (25ml) per 15L pump for thrips and mites.\n` +
            `• **Spray 2:** Pegasus (18g) + Neem Oil (30ml) per 15L pump for whitefly.\n` +
            `• **Flower Setting:** Planofix (4ml) + Chelated Boron (20g) per 15L pump.`;
      }
      return isMr
        ? `🌶️ **मिरची सुधारित लागवड व भरघोस उत्पादन तंत्रज्ञान:**\n\n` +
          `1. **गादी वाफा व अंतर:** ४ x १.५ फूट अंतरावर गादी वाफ्यावर २५ मायक्रॉन सिल्व्हर मल्चिंगवर लागवड करा.\n` +
          `2. **उत्कृष्ट वाण:** सितारा, तेजा-४, बुलेट, यूएस-७०२, नवतेज.\n` +
          `3. **रोपांची प्रक्रिया:** लागवडीपूर्वी मुळे ट्रायकोडर्मा (५ ग्रॅम/लिटर) व इमिडाक्लोप्रिड (१ मिली/लिटर) द्रावणात बुडवा.\n` +
          `4. **खत व्यवस्थापन:**\n` +
          `   • वाढीच्या काळात: १९:१९:१९ (३ किलो/एकर आठवड्यातून दोनदा)\n` +
          `   • फुलधारणेत: १२:६१:०० (३ किलो) + १३:००:४५ (३ किलो)\n` +
          `   • तोडणीच्या वेळी: ००:००:५० (४ किलो) ठिबकद्वारे द्या.`
        : `🌶️ **High-Yield Chilli Cultivation & Crop Schedule:**\n\n` +
          `1. **Spacing & Mulching:** Plant at **4 x 1.5 ft** on raised beds with 25-micron silver mulching and inline drip.\n` +
          `2. **Top Varieties:** Sitara, Teja-4, Bullet, US-702, Navtej.\n` +
          `3. **Seedling Treatment:** Dip seedling roots in *Trichoderma viride* (5g/L) + Imidacloprid (1ml/L) before transplanting.\n` +
          `4. **Fertigation:** Drip feed 19:19:19 during vegetative growth, 12:61:00 during flowering, and 13:00:45 / 00:00:50 during harvest flushes.`;
    }

    // 3. Ginger / Adrak (आले / अद्रक / आलं)
    if (q.includes('ginger') || q.includes('आल') || q.includes('अद्रक') || q.includes('adrak')) {
      return isMr
        ? `🫚 **आले (अद्रक) कंदकुज नियंत्रण व सुधारित लागवड:**\n\n` +
          `1. **लागवड अंतर:** ४ फूट रुंद गादी वाफ्यावर दोन ओळींत ९x९ इंच अंतरावर निरोगी बेणे टोचावे.\n` +
          `2. **कंदकुज प्रतिबंधक आळवणी (Drenching):**\n` +
          `   • जैविक: ट्रायकोडर्मा व्हिरिडी (२ किलो) + ५०० किलो शेणखतात मिसळून एकरी द्या.\n` +
          `   • रासायनिक आळवणी: रिडोमिल गोल्ड (३ ग्रॅम/लिटर) किंवा अलिएट (२.५ ग्रॅम/लिटर) + क्लोरोपायरिफॉस २०% ठिबकद्वारे सोडावे.\n` +
          `3. **खत व भरणी:** लागवडीनंतर ६० व ९० दिवसांनी मोठी भरणी करून १०:२६:२६ (२ पोती) + सूक्ष्म अन्नद्रव्ये द्यावीत.`
        : `🫚 **Ginger (Adrak) Rhizome Rot Management & High-Yield Guide:**\n\n` +
          `1. **Raised Bed Spacing:** 4 ft wide raised beds with 9x9 inch seed rhizome spacing.\n` +
          `2. **Rhizome Rot (Kandkuj) Drenching Protocol:**\n` +
          `   • Biological: Soil application of *Trichoderma* (2 kg/acre) mixed with FYM.\n` +
          `   • Chemical Drenching: Drip drench Ridomil Gold (3g/L) or Aliette (2.5g/L) + Chlorpyrifos.\n` +
          `3. **Earthing Up:** Perform thorough earthing up at 60 and 90 days with 10:26:26 (100kg/acre).`;
    }

    // 4. Garlic / Lasun (लसूण / लसणाची)
    if (q.includes('garlic') || q.includes('लसूण') || q.includes('लसण') || q.includes('lasun')) {
      return isMr
        ? `🧄 **लसूण सुधारित लागवड व खत नियोजन:**\n\n` +
          `1. **उत्कृष्ट वाण:** जी-४१, जी-२८२, भीमा ओंकार, गोदावरी.\n` +
          `2. **पेरणी अंतर:** गादी वाफ्यावर १५ x १० सेमी अंतरावर कांडी लावा.\n` +
          `3. **खत व्यवस्थापन:**\n` +
          `   • पेरणीवेळी: १०:२६:२६ (२ पोती) + गंधक (सल्फर) १० किलो/एकर.\n` +
          `   • ३० दिवसांनी: १९:१९:१९ व सूक्ष्म अन्नद्रव्ये.\n` +
          `   • ६० दिवसांनंतर: ००:५२:३४ (३ किलो) आणि ००:००:५० (४ किलो) कंद फुगवणीसाठी द्या.`
        : `🧄 **Garlic High-Yield Commercial Cultivation Guide:**\n\n` +
          `1. **Top Varieties:** G-41, G-282, Bhima Omkar, Godavari.\n` +
          `2. **Sowing Spacing:** 15 x 10 cm on raised beds (BBF).\n` +
          `3. **Fertilizer:** Basal 10:26:26 (100kg) + Sulphur (10kg/acre). Drip fertigate 00:52:34 and 00:00:50 after 60 days for bold clove size.`;
    }

    // 5. Pomegranate / Dalimb (डाळिंब / डाळिंबाची)
    if (q.includes('pomegranate') || q.includes('डाळिंब') || q.includes('dalimb')) {
      return isMr
        ? `🪴 **डाळिंब — तेल्या रोग प्रतिबंध व बहार व्यवस्थापन:**\n\n` +
          `1. **उत्कृष्ट वाण:** भगवा (Bhagwa).\n` +
          `2. **तेल्या रोग (Bacterial Blight) नियंत्रण:**\n` +
          `   • ०.५% बोर्डो मिश्रण (१ किलो चुना + १ किलो मोरचूद १००L पाण्यात) नियमित फवारा.\n` +
          `   • स्ट्रेप्टोसायक्लिन (६ ग्रॅम) + कॉपर ऑक्सिक्लोराईड (३० ग्रॅम) प्रति १५L पंप फवारा.\n` +
          `3. **फळ तडकणे रोखण्यासाठी:** बोरॉन (२० ग्रॅम) + चिलेटेड कॅल्शियम (१५ ग्रॅम) फवारणी करा.`
        : `🪴 **Pomegranate Bacterial Blight (Telya) & Orchard Care:**\n\n` +
          `1. **Top Variety:** Bhagwa.\n` +
          `2. **Telya (Bacterial Blight) Control:**\n` +
          `   • Spray 0.5% fresh Bordeaux mixture regularly during monsoon.\n` +
          `   • Spray Streptocycline (6g) + Copper Oxychloride (30g) per 15L pump.\n` +
          `3. **Fruit Cracking Prevention:** Apply Chelated Calcium (15g) + Boron (20g) foliar spray during sizing.`;
    }

    // 6. Sugarcane / Oos (ऊस / उसाची / उसावर)
    if (q.includes('sugarcane') || q.includes('ऊस') || q.includes('उसा') || q.includes('oos')) {
      return isMr
        ? `🎋 **ऊस सुधारित लागवड व खत नियोजन:**\n\n` +
          `1. **वाण:** को-८६०३२ (निरा), कोएम-०२६५ (फुले २६५).\n` +
          `2. **लागवड अंतर:** मध्यम ते भारी जमिनीत ४.५ ते ५ फूट पट्टा पद्धत वापरा.\n` +
          `3. **मोठी बांधणी (Earthing Up):** लागवडीनंतर १०० ते १२० दिवसांनी १०:२६:२६ (२ पोती) + युरिया (१ पोते) + पोटॅश (१ पोते) देऊन मातीची भर लावा.\n` +
          `4. **पाचट आच्छादन:** उसाचे पाचट शेतात ठेवल्याने पाण्याचे ५०% बाष्पीभवन थांबते व सेंद्रिय कर्ब वाढतो.`
        : `🎋 **Sugarcane Advanced Planting & Nutrition Schedule:**\n\n` +
          `1. **Recommended Varieties:** Co-86032 (Nira), CoM-0265 (Phule 265).\n` +
          `2. **Row Spacing:** 4.5 to 5.0 ft wide furrows for maximum sunlight and mechanized weeding.\n` +
          `3. **Earthing Up (100-120 Days):** Apply 10:26:26 (100kg) + Urea (50kg) + MOP (50kg) per acre before earthing up.\n` +
          `4. **Trash Mulching:** Retain dry sugarcane trash on soil surface to conserve 50% soil moisture and build organic carbon.`;
    }

    // 7. Brinjal / Eggplant (वांगी / वांगे / वांग्याची)
    if (q.includes('brinjal') || q.includes('eggplant') || q.includes('वांग') || q.includes('वांगे')) {
      return isMr
        ? `🍆 **वांगी सुधारित लागवड व शेंडा-फळ पोखरणारी अळी नियंत्रण:**\n\n` +
          `1. **लागवड अंतर:** ४ x २.५ फूट अंतरावर गादी वाफ्यावर रोपे लावा.\n` +
          `2. **शेंडा व फळ पोखरणारी अळी नियंत्रण:**\n` +
          `   • कोराजन (६ मिली) किंवा अँप्लिगो (१० मिली) किंवा फेम (५ मिली) प्रति १५L पंप फवारा.\n` +
          `   • शेतात एकरी ५ कामगंध सापळे (Pheromone Traps) लावा.\n` +
          `3. **खत नियोजन:** १९:१९:१९ व १२:६१:०० ठिबकद्वारे द्यावे.`
        : `🍆 **Brinjal Cultivation & Shoot/Fruit Borer Control:**\n\n` +
          `1. **Spacing:** 4 x 2.5 ft on raised beds with drip irrigation.\n` +
          `2. **Shoot & Fruit Borer Control:** Spray Coragen (6ml) or Ampligo (10ml) or Fame (5ml) per 15L pump. Install 5 pheromone traps per acre.\n` +
          `3. **Fertigation:** Drip fertigate 19:19:19 and 12:61:00 during growth and flowering.`;
    }

    // 8. Okra / Bhendi (भेंडी / भेंडीची)
    if (q.includes('okra') || q.includes('bhendi') || q.includes('भेंड')) {
      return isMr
        ? `🌱 **भेंडी लागवड व पिवळा शिरा (Yellow Vein Mosaic) नियंत्रण:**\n\n` +
          `1. **उत्कृष्ट वाण:** राधिका (Advanta Radhika), सिंघम, सम्राट.\n` +
          `2. **पेरणी अंतर:** २ x ०.७५ फूट किंवा गादी वाफ्यावर २ ओळीत.\n` +
          `3. **पांढरी माशी (रोग प्रसारक) नियंत्रण:** अलिका (१२ मिली) किंवा पेगासस (१५ ग्रॅम) + निंबोळी तेल ३० मिली फवारा.`
        : `🌱 **Okra (Bhendi) Cultivation & Yellow Vein Mosaic Protection:**\n\n` +
          `1. **Top Resistant Varieties:** Advanta Radhika, Singham, Samrat.\n` +
          `2. **Spacing:** 2 x 0.75 ft on raised beds.\n` +
          `3. **Vector Control (Whiteflies):** Spray Alika (12ml) or Pegasus (15g) + Neem Oil (30ml) per 15L pump.`;
    }

    // 9. Papaya (पपई / पपईची)
    if (q.includes('papaya') || q.includes('पपई') || q.includes('papai')) {
      return isMr
        ? `🍈 **पपई लागवड व रिंगस्पॉट व्हायरस नियंत्रण:**\n\n` +
          `1. **उत्कृष्ट वाण:** तैवान ७८६ (Red Lady 786).\n` +
          `2. **लागवड अंतर:** ७ x ७ फूट किंवा ८ x ६ फूट.\n` +
          `3. **व्हायरस नियंत्रण:** मावा व तुडतुडे नियंत्रणासाठी अलिका (१२ मिली) नियमित फवारा व शेताभोवती मका लावा.`
        : `🍈 **Papaya Cultivation & Ring Spot Virus Management:**\n\n` +
          `1. **Top Variety:** Taiwan 786 (Red Lady).\n` +
          `2. **Spacing:** 7 x 7 ft or 8 x 6 ft with drip irrigation.\n` +
          `3. **Virus Protection:** Control aphid vectors using Alika (12ml/15L pump) and plant border rows of maize.`;
    }

    // 10. Watermelon / Tarbooj (कलिंगड / टरबूज)
    if (q.includes('watermelon') || q.includes('कलिंगड') || q.includes('टरबूज') || q.includes('खरबूज')) {
      return isMr
        ? `🍉 **कलिंगड (टरबूज) सुधारित मल्चिंग शेती तंत्रज्ञान:**\n\n` +
          `1. **गादी वाफा व अंतर:** ६ ते ७ फूट अंतरावर गादी वाफे, ठिबक व २५ मायक्रॉन मल्चिंगवर १.५ फूट अंतरावर टोकण करा.\n` +
          `2. **उत्कृष्ट वाण:** सागर किंग, शुगर क्वीन, मॅक्स, कावेरी.\n` +
          `3. **फळ फुगवण खत:** ५० दिवसानंतर ००:००:५० (४ किलो/एकर) + मॅग्नेशियम सल्फेट व बोरॉन ठिबकद्वारे द्या.`
        : `🍉 **Watermelon High-Yield Mulch Cultivation:**\n\n` +
          `1. **Bed Spacing:** 6-7 ft bed-to-bed with 1.5 ft plant-to-plant on 25-micron silver mulching.\n` +
          `2. **Top Varieties:** Sagar King, Sugar Queen, Max.\n` +
          `3. **Fruit Sizing Fertigation:** Apply 00:00:50 (4 kg/acre) + Magnesium Sulphate & Boron at fruit swell stage.`;
    }

    // 11. Wheat / Gahu (गहू / गव्हाची)
    if (q.includes('wheat') || q.includes('गहू') || q.includes('गव्हा') || q.includes('gahu')) {
      return isMr
        ? `🌾 **गहू सुधारित पेरणी व पाणी व्यवस्थापन:**\n\n` +
          `1. **उत्कृष्ट वाण:** समाधान (NIAW-1994), लोकवन, नेत्रावती, फुले समाधानी.\n` +
          `2. **पेरणी वेळ व अंतर:** नोव्हेंबर पहिला पंधरवडा, २२.५ सेमी अंतरावर पेरणी करा. बियाणे ४० किलो/एकर.\n` +
          `3. **महत्त्वाच्या पाण्याच्या पाळ्या:** २१ व्या दिवशी (मुकुट मुळे फुटताना - CRI Stage), ४५ व्या दिवशी व ६५ व्या दिवशी (पोटरी अवस्था).`
        : `🌾 **Wheat Sowing & Critical Irrigation Schedule:**\n\n` +
          `1. **Top Varieties:** Samadhan (NIAW-1994), Lokwan, Netravati.\n` +
          `2. **Sowing Time & Spacing:** Nov 1-15, 22.5 cm row spacing, 40 kg seed per acre.\n` +
          `3. **Critical Irrigations:** Day 21 (CRI stage), Day 45 (Tillering), Day 65 (Booting/Grain filling).`;
    }

    // 12. Maize / Maka (मका / मक्याची)
    if (q.includes('maize') || q.includes('corn') || q.includes('मका') || q.includes('मक्या') || q.includes('maka')) {
      return isMr
        ? `🌽 **मका लागवड व लष्करी अळी (Fall Armyworm) नियंत्रण:**\n\n` +
          `1. **उत्कृष्ट वाण:** पायोनियर P-3396, सिजेंटा NK-6240, डिकॅलब 9108.\n` +
          `2. **लागवड अंतर:** २ x १ फूट किंवा ७५ x २० सेमी.\n` +
          `3. **लष्करी अळी नियंत्रण:** कोराजन (६ मिली) किंवा प्रोक्लेम (८ ग्रॅम) मक्याच्या पोंग्यात पडेल असे फवारा.`
        : `🌽 **Maize Cultivation & Fall Armyworm Management:**\n\n` +
          `1. **Top Varieties:** Pioneer P-3396, Syngenta NK-6240, Dekalb 9108.\n` +
          `2. **Spacing:** 2 x 1 ft or 75 x 20 cm.\n` +
          `3. **Fall Armyworm Control:** Spray Coragen (6ml) or Proclaim (8g) directed right into the whorl.`;
    }

    // C. Crop Specific Queries from Database (Turmeric, Banana, Soybean, Cotton, Chickpea, Jowar, Onion, Cabbage, Pigeon Pea)
    for (const crop of crops) {
      const cId = crop.id || '';
      const cMr = (crop.name_mr || '').toLowerCase();
      const cEn = (crop.name_en || '').toLowerCase();

      if (q.includes(cId) || q.includes(cMr) || q.includes(cEn) ||
          (cId === 'turmeric' && (q.includes('हळद') || q.includes('हळदी') || q.includes('turmeric') || q.includes('halad') || q.includes('haldi'))) ||
          (cId === 'banana' && (q.includes('केळी') || q.includes('केळ') || q.includes('banana') || q.includes('keli'))) ||
          (cId === 'soybean' && (q.includes('सोयाबीन') || q.includes('सोयाबिन') || q.includes('soybean') || q.includes('soyabean'))) ||
          (cId === 'cotton' && (q.includes('कापूस') || q.includes('कापसा') || q.includes('कपाशी') || q.includes('cotton') || q.includes('kapas'))) ||
          (cId === 'onion' && (q.includes('कांदा') || q.includes('कांदे') || q.includes('कांद्या') || q.includes('onion') || q.includes('kanda'))) ||
          (cId === 'pigeon_pea' && (q.includes('तूर') || q.includes('तुरी') || q.includes('arhar') || q.includes('toor') || q.includes('pigeon pea'))) ||
          (cId === 'chickpea' && (q.includes('हरभरा') || q.includes('हरभऱ्या') || q.includes('chickpea') || q.includes('चना') || q.includes('चणा')))) {

        // If asking for fertilizer/spray for this crop
        if (q.includes('खत') || q.includes('डोस') || q.includes('फवारणी') || q.includes('टॉनिक') || q.includes('fertilizer') || q.includes('spray') || q.includes('dose') || q.includes('tonic')) {
          const sprays = (crop.stage_spray_schedule || []).map(s => `• **${s.stage}:** ${s.spray}`).join('\n');
          return isMr
            ? `🧪 **${crop.name_mr} — टप्प्याटप्प्याने खत व फवारणी वेळापत्रक:**\n\n${sprays}\n\n💡 *टीप:* फवारणीसोबत स्टिकर (Silicon Spreader) ५ मिली अवश्य वापरा.`
            : `🧪 **${crop.name_en || crop.name_mr} — Growth Stage Fertilizer & Spray Schedule:**\n\n${sprays}\n\n💡 *Tip:* Always add 5ml silicon spreader per spray pump.`;
        }

        // If asking for varieties for this crop
        if (q.includes('वाण') || q.includes('बियाणे') || q.includes('बेणे') || q.includes('variety') || q.includes('seed')) {
          const vars = (crop.recommended_varieties || []).map(v => `• **${v.name}:** ${v.features}`).join('\n');
          return isMr
            ? `🌾 **${crop.name_mr} — शिफारसीत उच्च उत्पादन देणारे वाण:**\n\n${vars}`
            : `🌾 **${crop.name_en || crop.name_mr} — Recommended High-Yield Varieties:**\n\n${vars}`;
        }

        // If asking for pest remedy for this crop
        if (q.includes('रोग') || q.includes('कीड') || q.includes('pest') || q.includes('disease') || q.includes('उपाय') || q.includes('करपा') || q.includes('अळी') || q.includes('कुज')) {
          const remedies = (crop.critical_pest_remedies || []).map(p => `• **${p.pest}:** ${p.remedy}`).join('\n');
          return isMr
            ? `🚨 **${crop.name_mr} — प्रमुख कीड-रोग व तातडीचे उपाय:**\n\n${remedies}`
            : `🚨 **${crop.name_en || crop.name_mr} — Key Pests & Rapid Remedies:**\n\n${remedies}`;
        }

        // Comprehensive Cultivation, Sowing & Best Practice Guide
        const topVars = (crop.recommended_varieties || []).slice(0, 3).map(v => v.name).join(', ');
        const sprayTips = (crop.stage_spray_schedule || []).slice(0, 2).map(s => `   • **${s.stage}:** ${s.spray}`).join('\n');
        return isMr
          ? `🌱 **${crop.name_mr} सुधारित आधुनिक शेती तंत्रज्ञान:**\n\n` +
            `1. **लागवड पद्धत व अंतर:** ${crop.sowing_method_mr || 'गादी वाफा / रुंद वरंबा-सरी (BBF) टोकण पद्धत'}\n` +
            `2. **कालावधी व उत्पादन:** ${crop.duration_days || '120-150'} दिवस | अपेक्षित उत्पादन: **${crop.expected_yield_range || 'दर्जेदार भरघोस उत्पादन'}**\n` +
            `3. **उत्कृष्ट शिफारसीत वाण:** ${topVars || 'फुले वाण'}\n` +
            `4. **पाणी व ठिबक व्यवस्थापन:** ठिबक सिंचनाचा वापर करून वाफसा स्थितीत पाणी द्यावे.\n` +
            `5. **प्रमुख खत व फवारणी अवस्था:**\n${sprayTips}`
          : `🌱 **${crop.name_en || crop.name_mr} Modern High-Yield Cultivation Guide:**\n\n` +
            `1. **Sowing Method & Spacing:** ${crop.sowing_method_en || 'Raised bed / BBF token system'}\n` +
            `2. **Duration & Yield:** ${crop.duration_days || '120-150'} days | Expected Yield: **${crop.expected_yield_range || 'High commercial yield'}**\n` +
            `3. **Top Recommended Varieties:** ${topVars || 'University certified'}\n` +
            `4. **Irrigation:** Maintain field capacity using inline drip fertigation.\n` +
            `5. **Stage Spray Schedule:**\n${sprayTips}`;
      }
    }

    // D. Flower Drop & Fruit Setting (फुलगळ, सेटिंग, फळगळ, flower drop)
    if (q.includes('फुलगळ') || q.includes('फळगळ') || q.includes('सेटिंग') || q.includes('flower drop') || q.includes('fruit drop') || q.includes('flowering')) {
      return isMr
        ? `🌸 **फुलगळ व फळगळ प्रतिबंधक फवारणी फॉर्म्युला:**\n\n` +
          `1. **प्लॅनोफिक्स (Planofix):** ४ मिली प्रति १५L पंप (प्रमाण जास्त करू नका).\n` +
          `2. **बोरॉन २०% (Boron):** २० ग्रॅम प्रति १५L पंप (फुलांचे फळात रूपांतर होण्यासाठी).\n` +
          `3. **००:५२:३४ (Mono Potassium Phosphate):** ७५ ग्रॅम प्रति १५L पंप.\n` +
          `4. **इसाबियन किंवा सिंजेंटा क्वांटिस:** ३० मिली प्रति पंप (टॉनिक म्हणून).\n` +
          `💡 *टीप:* फुलधारणेच्या अवस्थेत पिकाला पाण्याचा ताण किंवा अतिरिक्त पाणी बसू देऊ नका.`
        : `🌸 **Flower Drop Prevention & Fruit Setting Formula:**\n\n` +
          `1. **Planofix (Alpha NAA):** 4 ml per 15L spray pump (Do not overdose).\n` +
          `2. **Chelated Boron 20%:** 20g per 15L pump (Ensures efficient pollen germination & fruit set).\n` +
          `3. **00:52:34 (MKP):** 75g per 15L pump.\n` +
          `4. **Biostimulant (Isabion / Quantis):** 30ml per 15L pump.\n` +
          `💡 *Tip:* Maintain uniform soil moisture; avoid severe water stress or over-irrigation during bloom.`;
    }

    // E. Organic Farming & Jeevamrut (सेंद्रिय शेती, जीवामृत, दशपर्णी)
    if (q.includes('जीवामृत') || q.includes('सेंद्रिय') || q.includes('organic') || q.includes('jeevamrut') || q.includes('दशपर्णी') || q.includes('dashaparni')) {
      return isMr
        ? `🌿 **सेंद्रिय शेती — देशी गाईचे जीवामृत तयार करण्याची सोपी पद्धत:**\n\n` +
          `• **साहित्य (१ एकरासाठी २००L बॅरलमध्ये):**\n` +
          `  - १० किलो ताजे देशी गाईचे शेण + १० लिटर गोमूत्र\n` +
          `  - २ किलो काळा गूळ + २ किलो बेसण (डाळीचे पीठ)\n` +
          `  - मूठभर बांधाची / वडाच्या झाडाखालील जिवाणूयुक्त माती\n` +
          `• **कृती:** २०० लिटर पाण्यात सर्व घटक एकत्र मिसळा. सावलीत ठेवून दररोज सकाळी व संध्याकाळी लाकडी काठीने घड्याळाच्या दिशेने २ मिनिटे ढवळा. ४ ते ६ दिवसांत जीवामृत तयार होते.\n` +
          `• **वापर:** ठिबकद्वारे किंवा पाटाच्या पाण्यातून एका एकरासाठी २०० लिटर सोडा.`
        : `🌿 **Organic Farming — Homemade Jeevamrut Preparation:**\n\n` +
          `• **Ingredients (For 1 Acre in 200L Drum):**\n` +
          `  - 10 kg fresh indigenous cow dung + 10 Litres cow urine\n` +
          `  - 2 kg organic jaggery + 2 kg gram flour (Besan)\n` +
          `  - Handful of fertile farm bund soil (rich in native microbes)\n` +
          `• **Method:** Mix thoroughly in 200L clean water under shade. Stir clockwise for 2 minutes every morning and evening. Ferments in 4 to 6 days.\n` +
          `• **Application:** Apply 200 Litres per acre via drip irrigation or flood water channel every 15-21 days.`;
    }

    // F. Yellowing of Leaves (पाने पिवळी पडणे, yellow leaves)
    if (q.includes('पिवळी') || q.includes('yellow') || q.includes('chlorosis')) {
      return isMr
        ? `🍂 **झाडांची पाने पिवळी पडण्याची कारणे व उपाय:**\n\n` +
          `1. **लोहाची (Iron) कमतरता (शेंड्याची पाने पिवळी पण शिरा हिरव्या):** चिलेटेड फेरस (Fe-EDTA १२%) १५ ग्रॅम प्रति १५L पंप फवारा किंवा फेरस सल्फेट ५ किलो/एकर ठिबकमधून द्या.\n` +
          `2. **नत्राची (Nitrogen) कमतरता (खालची जुनी पाने पिवळी):** १९:१९:१९ १०० ग्रॅम फवारा किंवा युरिया द्या.\n` +
          `3. **अतिरिक्त पाणी/दलदल:** मुळांना हवा न मिळाल्याने पाने पिवळी पडतात. पाणी देणे त्वरित थांबवा व वाफसा स्थिती आणा.`
        : `🍂 **Causes and Remedies for Yellowing Leaves:**\n\n` +
          `1. **Iron Chlorosis (Young top leaves turn yellow while veins remain green):** Spray Chelated Iron (Fe-EDTA 12%) @ 15g per 15L pump or apply Ferrous Sulphate (5 kg/acre) through drip.\n` +
          `2. **Nitrogen Deficiency (Older bottom leaves turn pale yellow):** Foliar spray of 19:19:19 (100g/15L pump) or light top-dressing of Urea.\n` +
          `3. **Waterlogging:** Excessive water asphyxiates root respiration. Pause irrigation immediately until proper aeration (Vapsa) is restored.`;
    }

    // G. Government Schemes & Subsidies (ठिबक, शेततळे, पीएम किसान, योजना)
    if (q.includes('योजना') || q.includes('अनुदान') || q.includes('ठिबक') || q.includes('शेततळे') || q.includes('subsidy') || q.includes('scheme') || q.includes('drip') || q.includes('pm kisan')) {
      if (q.includes('ठिबक') || q.includes('drip')) {
        return isMr
          ? `🏛️ **मागेल त्याला ठिबक सिंचन योजना (MahaDBT):**\n\n• **अनुदान:** अल्प व अत्यल्प भूधारक शेतकऱ्यांना **८०% पर्यंत**, तर इतर शेतकऱ्यांना **७०% पर्यंत** अनुदान.\n• **आवश्यक कागदपत्रे:** ७/१२, ८-अ, आधार कार्ड, बँक पासबुक, विहीर/पाणी दाखला, वीज बिल.\n• **अर्ज कसा करावा:** mahadbt.maharashtra.gov.in या पोर्टलवर ऑनलाइन नोंदणी करा.`
          : `🏛️ **Magel Tyala Drip Irrigation Scheme (MahaDBT):**\n\n• **Subsidy:** Up to **80% subsidy** for small & marginal farmers, 70% for other farmers.\n• **Required Documents:** 7/12 & 8-A extracts, Aadhaar card, bank passbook, electricity bill.\n• **How to Apply:** Register online at mahadbt.maharashtra.gov.in portal.`;
      }
      return isMr
        ? `🏛️ **शेतकऱ्यांसाठी महत्त्वाच्या शासकीय योजना:**\n\n1. **मागेल त्याला ठिबक सिंचन:** ७०% ते ८०% अनुदान.\n2. **मागेल त्याला शेततळे:** ₹७५,००० पर्यंत थेट आर्थिक साहाय्य.\n3. **पीएम किसान सन्मान निधी:** दरवर्षी ₹६,००० (३ हप्त्यांत) + नमो शेतकरी महासन्मान निधी ₹६,०००.\n4. **अर्ज संकेतस्थळ:** mahadbt.maharashtra.gov.in`
        : `🏛️ **Major Government Agriculture Schemes:**\n\n1. **Drip Irrigation Subsidy:** Up to 80% on micro-irrigation systems.\n2. **Farm Pond Scheme:** Financial assistance up to ₹75,000.\n3. **PM-Kisan & Namo Shetkari:** ₹12,000 total annual income support.\n4. **Apply via:** mahadbt.maharashtra.gov.in`;
    }

    // H. Mandi / Market Rates (बाजारभाव, भाव, दर, market, price, rate)
    if (q.includes('बाजारभाव') || q.includes('भाव') || q.includes('दर') || q.includes('price') || q.includes('rate') || q.includes('mandi') || q.includes('market')) {
      return isMr
        ? `📊 **नांदेड व मराठवाडा चालू बाजारभाव अंदाज (प्रति क्विंटल):**\n\n• **हळद (Turmeric):** ₹१२,५०० - ₹१६,२००\n• **सोयाबीन (Soybean):** ₹४,२०० - ₹४,७५०\n• **कापूस (Cotton):** ₹६,८०० - ₹७,४००\n• **हरभरा (Gram):** ₹५,५०० - ₹६,१००\n• **केळी (Banana):** ₹१,४०० - ₹१,८५०\n\n💡 *टीप:* बाजारात चांगला भाव मिळवण्यासाठी शेतमाल प्रतवारी (Grading) करून विका.`
        : `📊 **Nanded APMC Mandi Price Overview (Per Quintal):**\n\n• **Turmeric:** ₹12,500 - ₹16,200\n• **Soybean:** ₹4,200 - ₹4,750\n• **Cotton:** ₹6,800 - ₹7,400\n• **Gram (Chana):** ₹5,500 - ₹6,100\n• **Banana:** ₹1,400 - ₹1,850\n\n💡 *Tip:* Grade your produce properly before bringing to mandi for premium prices.`;
    }

    // I. General Sowing / Planting questions
    if (q.includes('plant') || q.includes('sow') || q.includes('grow') || q.includes('लागवड') || q.includes('पेरणी')) {
      return isMr
        ? `🌱 **आधुनिक पीक लागवड व पेरणी मार्गदर्शक सूत्र:**\n\n` +
          `1. **जमीन तयार करणे:** खोल नांगरट करून ५ टन चांगले कुजलेले शेणखत मिसळा.\n` +
          `2. **बीजप्रक्रिया:** बियाण्याला ट्रायकोडर्मा (५ ग्रॅम/किलो) + रायझोबियम/PSB (२५ ग्रॅम/किलो) चोळावे.\n` +
          `3. **गादी वाफा (BBF):** गादी वाफ्यावर लागवड केल्याने मुळांना भरपूर हवा मिळते व उत्पादनात २५% वाढ होते.\n` +
          `4. **मल्चिंग व ठिबक:** भाजीपाला व फळपिकांसाठी सिल्व्हर-ब्लॅक मल्चिंग व ठिबक सिंचनाचा वापर करा.`
        : `🌱 **Modern Planting & Crop Sowing Golden Rules:**\n\n` +
          `1. **Land Preparation:** Deep ploughing followed by rotavator, incorporating 5 tonnes well-decomposed FYM/compost per acre.\n` +
          `2. **Seed / Seedling Treatment:** Treat seeds with *Trichoderma viride* (5g/kg) + Rhizobium/PSB (25g/kg) before sowing.\n` +
          `3. **Broad Bed Furrow (BBF) / Raised Beds:** Raised beds ensure superior root aeration, eliminate waterlogging, and boost yield by 20-30%.\n` +
          `4. **Drip Fertigation & Mulching:** Use inline drip with silver-black mulch for vegetable and commercial crops to save 50% water and stop weeds.`;
    }

    // J. General Spray & Fertilizer Rule of Thumb
    if (q.includes('खत') || q.includes('फवारणी') || q.includes('टॉनिक') || q.includes('fertilizer') || q.includes('spray') || q.includes('tonic')) {
      return isMr
        ? `🧪 **सर्वसाधारण फवारणी व खत मार्गदर्शक सूत्र:**\n\n1. **वाढीची अवस्था (१५-३० दिवस):** १९:१९:१९ (१०० ग्रॅम) + अलिका (१५ मिली) प्रति १५L पंप.\n2. **फुलधारणा अवस्था (४०-५५ दिवस):** १२:६१:०० (१०० ग्रॅम) किंवा ००:५२:३४ + बोरॉन (२० ग्रॅम).\n3. **कंद/दाणे फुगवण अवस्था:** ००:००:५० (१०० ग्रॅम) + पोटॅशियम शोनाईट.\n4. **टीप:** फवारणी नेहमी सकाळी ९ ते ११ किंवा दुपारी ४ नंतरच करावी.`
        : `🧪 **Standard Crop Spray & Nutrition Formula:**\n\n1. **Vegetative Stage (15-30 days):** 19:19:19 (100g) + Alika (15ml) per 15L pump.\n2. **Flowering Stage (40-55 days):** 12:61:00 (100g) or 00:52:34 + Boron (20g).\n3. **Fruiting/Bulb Stage:** 00:00:50 (100g) for premium weight and shine.\n4. **Tip:** Spray during cool morning hours (9-11 AM) or late afternoon.`;
    }

    // K. Seed Varieties (वाण, बियाणे, varieties)
    if (q.includes('वाण') || q.includes('बियाणे') || q.includes('variety') || q.includes('seed')) {
      return isMr
        ? `🌾 **नांदेड व मराठवाड्यासाठी सर्वोत्तम शिफारसीत वाण:**\n\n• **सोयाबीन:** फुले संगम (KDS-726), फुले किमया, जेएस-335\n• **हळद:** सेलम, फुले स्वरूपा, राजापुरी\n• **कापूस:** अजित-155, राशी-659, कावेरी मनीमेकर\n• **हरभरा:** दिग्विजय, फुले विक्रम, जाकी 9218\n• **केळी:** ग्रँड नैन (G-9)\n• **टोमॅटो:** सिजेंटा अभिनव, US-440, आर्यमान`
        : `🌾 **Top Recommended Varieties for Marathwada Region:**\n\n• **Soybean:** Phule Sangam (KDS-726), Phule Kimaya, JS-335\n• **Turmeric:** Salem, Phule Swaroopa, Rajapuri\n• **Cotton:** Ajeet-155, Rasi-659\n• **Gram (Chana):** Digvijay, Phule Vikram, JAKI 9218\n• **Banana:** Grand Naine (G-9)\n• **Tomato:** Syngenta Abhinav, US-440, Aryaman`;
    }

    // Default friendly response
    return isMr
      ? `🌾 **छाया — शेती सल्लागार:**\n\nआपण विचारलेला प्रश्न समजला. आपल्या शेतात दर्जेदार उत्पादन मिळवण्यासाठी गादी वाफा पद्धत (BBF) आणि ठिबक सिंचनाचा वापर करा. आपण टोमॅटो, हळद, केळी, सोयाबीन, कापूस, खत नियोजन, कीड नियंत्रण किंवा बाजारभावाबद्दल विशिष्ट प्रश्न विचारू शकता.`
      : `🌾 **Chaya — Farm Advisor:**\n\nFor top crop productivity, adopt Broad Bed Furrow (BBF) with drip fertigation and maintain balanced NPK nutrition. Feel free to ask specific questions about tomato cultivation, turmeric, banana, crop disease, fertilizer doses, spray schedules, seeds, or live mandi prices.`;
  }
}

// Attach globally
window.chayaAI = new ChayaAIEngine();
