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
    this.backendStatus = { gemini: false, market: false, tts: false, checked: false };
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
      this.backendStatus = { gemini: false, market: false, tts: false, checked: true };
    }
    return this.backendStatus;
  }

  // ---------------------------------------------------------------------
  // 🌦️ LIVE WEATHER DETECTION (Open-Meteo — free, no API key required)
  // ---------------------------------------------------------------------
  async fetchLiveWeather(lat, lon) {
    // Default fallback coordinates: Nanded district center
    const latitude = lat || 19.15;
    const longitude = lon || 77.31;

    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,precipitation,rain,weather_code,wind_speed_10m&daily=precipitation_probability_max,temperature_2m_max,temperature_2m_min&timezone=auto`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Weather API status: ${res.status}`);
      const data = await res.json();

      const code = data.current?.weather_code ?? 0;
      const condition = this._weatherCodeToMarathi(code);

      return {
        source: 'open-meteo',
        temperature: data.current?.temperature_2m,
        humidity: data.current?.relative_humidity_2m,
        rain_now_mm: data.current?.rain ?? data.current?.precipitation ?? 0,
        wind_kmh: data.current?.wind_speed_10m,
        rain_chance_today: data.daily?.precipitation_probability_max?.[0] ?? null,
        temp_max: data.daily?.temperature_2m_max?.[0],
        temp_min: data.daily?.temperature_2m_min?.[0],
        condition_mr: condition.text,
        icon: condition.icon,
        sprayAdvice: this._sprayAdviceFromWeather(data)
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
        icon: '⛅',
        sprayAdvice: 'लाईव्ह हवामान डेटा उपलब्ध नाही — फवारणीपूर्वी स्थानिक अंदाज तपासा.'
      };
    }
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

  _sprayAdviceFromWeather(data) {
    const rain = data.current?.precipitation ?? 0;
    const rainChance = data.daily?.precipitation_probability_max?.[0] ?? 0;
    const wind = data.current?.wind_speed_10m ?? 0;

    if (rain > 0 || rainChance > 60) {
      return '🚫 पावसाची शक्यता जास्त आहे — आज फवारणी टाळा, औषध वाहून जाईल.';
    }
    if (wind > 20) {
      return '⚠️ जोरदार वारा आहे — फवारणी औषध वाया जाऊ शकते, सकाळी लवकर किंवा संध्याकाळी फवारणी करा.';
    }
    return '✅ फवारणीसाठी हवामान अनुकूल आहे.';
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

      if (data.source === 'live' && data.rates && data.rates.length) {
        return { source: 'data_gov_in_live', rates: data.rates };
      }
      // Backend not configured, or fetch failed there -> use locally bundled JSON
      return { source: 'local_cache', rates: this.knowledgeBase.marketPrices?.rates || null };
    } catch (e) {
      console.warn('Live market price fetch failed, falling back to local data:', e);
      return { source: 'local_cache_fallback', rates: this.knowledgeBase.marketPrices?.rates || null };
    }
  }

  // ---------------------------------------------------------------------
  // 🔊 TEXT-TO-SPEECH — via /api/index?action=tts backend proxy (ElevenLabs key stays server-side)
  // Falls back to the browser's built-in voice if the backend isn't configured.
  // ---------------------------------------------------------------------
  async speak(text, { onStart, onEnd, onError } = {}) {
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
        body: JSON.stringify({ text: cleanText })
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

    // 2. Fallback: built-in browser speech synthesis (Marathi/Hindi voice if available)
    if (!usedElevenLabs) {
      if ('speechSynthesis' in window) {
        if (onStart) onStart();
        const utter = new SpeechSynthesisUtterance(cleanText);
        utter.lang = 'mr-IN';
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

    const scoredCrops = (this.knowledgeBase.crops || []).map(crop => {
      let score = 0;
      const reasons = [];

      // Water Match
      if (water === 'abundant') {
        if (crop.water_requirement === 'abundant') {
          score += 35;
          reasons.push('मुबलक पाण्यासाठी सर्वोत्तम (High Yield)');
        } else {
          score += 25;
        }
      } else if (water === 'moderate') {
        if (crop.water_requirement === 'moderate') {
          score += 35;
          reasons.push('मध्यम पाणी व ठिबकवर उत्तम उत्पादन');
        } else {
          score += 20;
        }
      } else {
        if (crop.water_requirement === 'low') {
          score += 35;
          reasons.push('कमी पाण्यात हमखास उत्पन्न (कोरडवाहू)');
        } else {
          score += 10;
        }
      }

      // Taluka Match
      if (taluka === 'ardhapur' || taluka === 'mudkhed' || taluka === 'nanded') {
        if (crop.id === 'turmeric' || crop.id === 'soybean') score += 30;
      } else {
        if (crop.id === 'soybean' || crop.id === 'cotton') score += 30;
      }

      // Financial calculations scaled to acreage
      const yieldMin = crop.yield_per_acre_qtl ? (crop.yield_per_acre_qtl.min * landSize).toFixed(1) : '10';
      const yieldMax = crop.yield_per_acre_qtl ? (crop.yield_per_acre_qtl.max * landSize).toFixed(1) : '15';
      const totalCost = Math.round(crop.estimated_cost_per_acre * landSize);
      const totalRevenue = Math.round(crop.estimated_revenue_per_acre * landSize);
      const netProfit = Math.round(crop.net_profit_per_acre * landSize);

      return {
        ...crop,
        matchScore: Math.min(score + 30, 99),
        reasons,
        landSize,
        totalYieldRange: `${yieldMin} ते ${yieldMax} क्विंटल`,
        totalCost,
        totalRevenue,
        netProfit
      };
    });

    scoredCrops.sort((a, b) => b.matchScore - a.matchScore || b.netProfit - a.netProfit);
    return scoredCrops;
  }

  buildGroundedContext(userInput, topCrops) {
    const surveyInfo = this.getNandedSurveyData(userInput.taluka);
    const topCrop = topCrops[0] || {};

    return `
【📍 शेती पार्श्वभूमी】: तालुका: ${surveyInfo.taluka_name}, जमीन: ${userInput.land} एकर, पाणी: ${userInput.waterText || userInput.water}.
【🎯 मुख्य शिफारसीत पीक】: ${topCrop.name_mr} (कालावधी: ${topCrop.duration_days})
- अपेक्षित उत्पादन (${userInput.land} एकर): ${topCrop.totalYieldRange}
- अंदाजे खर्च: ₹${topCrop.totalCost?.toLocaleString('en-IN')}, निव्वळ नफा: ₹${topCrop.netProfit?.toLocaleString('en-IN')}
- सुधारित वाण: ${(topCrop.recommended_varieties || []).map(v => v.name).join(', ')}
- खत व फवारणी: ${(topCrop.stage_spray_schedule || []).map(s => s.stage + ': ' + s.spray).join(' | ')}
- महत्त्वाची कीड उपाय: ${(topCrop.critical_pest_remedies || []).map(p => p.pest + ' -> ' + p.remedy).join('; ')}
`;
  }

  async generateGroundedAdvice(userInput, topCrops) {
    const offlineEvaluation = topCrops || this.evaluateCropsOffline(userInput);

    try {
      const groundedContext = this.buildGroundedContext(userInput, offlineEvaluation);
      const userQuestion = userInput.question ? userInput.question.trim() : 'पिकाचे महत्त्वाचे मुद्दे व फवारणी सांगा.';

      const systemPrompt = `
तुम्ही 'छाया AI' चे कृषी सल्लागार आहात.
महत्त्वाचा नियम: शेतकऱ्यांना लांबलचक परिच्छेद वाचायला आवडत नाहीत.
त्यामुळे तुमचे उत्तर **अत्यंत संक्षिप्त, ठळक, मुद्देसूद आणि थेट कृती करता येणारे (Actionable)** असावे.

खालील 4 मुद्यांमध्येच उत्तर द्या:
1. 🌾 **सर्वोत्तम वाण व पेरणी पद्धत**
2. 📦 **${userInput.land} एकर क्षेत्राचे उत्पादन व निव्वळ नफा**
3. 🧪 **महत्त्वाचा खत व फवारणी डोस (चालू स्टेज)**
4. 🚨 **धोक्याची कीड व झटपट फवारणी औषध**
`;

      const response = await fetch('/api/index?action=gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemPrompt, groundedContext, userQuestion })
      });

      if (!response.ok) throw new Error(`Gemini proxy status: ${response.status}`);
      const result = await response.json();

      if (result.text) {
        return { source: 'gemini_grounded', text: result.text, rankedCrops: offlineEvaluation };
      } else {
        throw new Error(result.error || 'empty_response');
      }
    } catch (e) {
      console.warn('Gemini backend unavailable, using offline engine:', e);
      return this.generateOfflineAIResponse(userInput, offlineEvaluation);
    }
  }

  generateOfflineAIResponse(userInput, scoredCrops) {
    const top = scoredCrops[0] || {};
    const land = parseFloat(userInput.land) || 1;
    const survey = this.getNandedSurveyData(userInput.taluka);
    const topVar = (top.recommended_varieties && top.recommended_varieties[0]) ? top.recommended_varieties[0].name : 'सुधारित वाण';
    const topSpray = (top.stage_spray_schedule && top.stage_spray_schedule[0]) ? top.stage_spray_schedule[0].spray : '19:19:19 + कीटकनाशक फवारणी';
    const topPest = (top.critical_pest_remedies && top.critical_pest_remedies[0]) ? top.critical_pest_remedies[0] : { pest: 'कीड नियंत्रण', remedy: 'वेळेवर फवारणी करा' };

    let text = `⚡ **शेतकरी फास्ट-ट्रॅक सल्ला (${survey.taluka_name} परिसर):**\n\n`;
    text += `🌾 **शिफारसीत पीक व वाण:** **${top.name_mr}** | वाण: **${topVar}**\n`;
    text += `📦 **अपेक्षित उत्पादन (${land} एकर):** **${top.totalYieldRange}** | निव्वळ नफा: **₹${top.netProfit?.toLocaleString('en-IN')}**\n`;
    text += `🧪 **सुरुवातीचा खत/फवारणी डोस:** ${topSpray}\n`;
    text += `🚨 **धोक्याची कीड व झटपट उपाय:** ${topPest.pest} आल्यास -> **${topPest.remedy}**\n\n`;
    text += `📍 *नांदेड सर्वेक्षण सूत्र:* ${survey.local_success_formula}`;

    return {
      source: 'offline_knowledge_engine',
      text: text,
      rankedCrops: scoredCrops
    };
  }

  async handleChatMessage(message, farmContext) {
    const q = message.trim().toLowerCase();
    if (!q) return 'कृपया प्रश्न विचारा.';

    const topCrops = this.knowledgeBase.crops || [];
    
    // Quick search for soybean/turmeric pests from the PDFs
    for (const crop of topCrops) {
      if (crop.critical_pest_remedies) {
        for (const r of crop.critical_pest_remedies) {
          if (q.includes(r.pest.toLowerCase()) || q.includes('करपा') || q.includes('चक्री') || q.includes('अळी') || q.includes('खोड') || q.includes('कुज')) {
            return `🚨 **${crop.name_mr} - ${r.pest} वर तातडीचा उपाय:**\n\n👉 **औषध व मात्रा:** ${r.remedy}`;
          }
        }
      }
    }

    if (q.includes('खत') || q.includes('डोस') || q.includes('फवारणी')) {
      return `🧪 **खत व फवारणी सल्ला:** सुरुवातीला 19:19:19 (100g) + अलिका 15ml प्रति 15L पंप फवारा. फुलधारणेच्या वेळी 12:61:00 किंवा 00:52:34 चा वापर करा.`;
    }

    if (q.includes('वाण') || q.includes('बियाणे')) {
      return `🌾 **उत्कृष्ट वाण:**\n• **सोयाबीन:** फुले संगम (KDS-726), फुले किमया, फुले दुर्वा\n• **हळद:** सेलम, फुले स्वरूपा (क्युरकुमिन 5.19%)`;
    }

    return `🌾 **छाया AI सल्ला:** पिकाच्या चांगल्या वाढीसाठी गादी वाफ्यावर (BBF) टोकण पद्धतीने लागवड करा आणि सुरुवातीच्या 20 दिवसांत चक्रीभुंग्यासाठी अलिकाची फवारणी घ्या.`;
  }
}

// Attach globally
window.chayaAI = new ChayaAIEngine();
