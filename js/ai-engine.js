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
    this.apiKey = localStorage.getItem('gemini_api_key') || '';
  }

  setApiKey(key) {
    this.apiKey = (key || '').trim();
    if (this.apiKey) {
      localStorage.setItem('gemini_api_key', this.apiKey);
    } else {
      localStorage.removeItem('gemini_api_key');
    }
  }

  hasApiKey() {
    return !!this.apiKey;
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
    
    if (!this.apiKey) {
      return this.generateOfflineAIResponse(userInput, offlineEvaluation);
    }

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

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.apiKey}`;
      const payload = {
        contents: [
          {
            role: 'user',
            parts: [{ text: `${systemPrompt}\n\nडेटा:\n${groundedContext}\n\nशेतकऱ्याचा प्रश्न: ${userQuestion}\n\nथेट संक्षिप्त मराठी सल्ला:` }]
          }
        ],
        generationConfig: { temperature: 0.3, maxOutputTokens: 800 }
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error(`Gemini status: ${response.status}`);
      const result = await response.json();
      const aiText = result.candidates?.[0]?.content?.parts?.[0]?.text;

      if (aiText) {
        return { source: 'gemini_grounded', text: aiText, rankedCrops: offlineEvaluation };
      } else {
        throw new Error('Empty response');
      }
    } catch (e) {
      console.warn('Gemini fallback:', e);
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
