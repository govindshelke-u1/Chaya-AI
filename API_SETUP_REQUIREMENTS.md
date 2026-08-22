# 🌿 छाया AI — API व सेटअप आवश्यकता (Setup Requirements)

> ⚠️ **महत्त्वाचा बदल**: आता सर्व API Keys **फक्त बॅकएंडवर (Vercel Environment Variables)** ठेवल्या जातात. ब्राउझर/फ्रंटएंड मध्ये कुठेही Key दिसत/साठवली जात नाही — त्यामुळे कोणीही Developer Tools उघडून Key चोरू शकत नाही. खाली दिलेल्या पायऱ्या फॉलो करा.

हा दस्तऐवज सांगतो की **AI functions आणि API functions पूर्णपणे काम करण्यासाठी** तुम्हाला कोणकोणत्या गोष्टींची गरज आहे. सध्या साईट **ऑफलाइन नॉलेज इंजिनवर** चालते (कोणतीही key नसतानाही काम करते), पण खाली दिलेल्या Key Vercel वर टाकल्यास सर्व फीचर्स पूर्ण क्षमतेने (live/AI mode) चालतील.

---

## 🚀 Vercel वर Environment Variables कशा टाकायच्या (सर्वात महत्त्वाचे स्टेप्स)

1. https://vercel.com वर लॉगिन करा → तुमचा **chaya-ai** प्रोजेक्ट उघडा.
2. वरच्या टॅबमधून **Settings** → डाव्या बाजूला **Environment Variables** वर क्लिक करा.
3. खालील प्रत्येक Key साठी "Add New" करून **Name** व **Value** भरा (खाली टेबलमध्ये सर्व नावं दिली आहेत), आणि Environment म्हणून **Production, Preview, Development** तिन्ही निवडा.
4. सर्व Keys सेव्ह झाल्यावर, **Deployments** टॅबमध्ये जाऊन शेवटच्या deployment वर "..." → **Redeploy** करा (नवीन env vars लागू होण्यासाठी redeploy गरजेचे आहे — नुसती key add केल्याने जुनं deployment अपडेट होत नाही).
5. काही मिनिटांत नवीन deployment live होईल आणि साईटवर ⚙️ बटणात "✅ कनेक्टेड" दिसू लागेल.

| # | Environment Variable Name | कुठून मिळेल | Required/Optional |
|---|---|---|---|
| 1 | `GEMINI_API_KEY` | https://aistudio.google.com/app/apikey | Optional (नसेल तर ऑफलाइन इंजिन चालते) |
| 2 | `MARKET_API_KEY` | https://data.gov.in (sign up → My Account → API Key) | Optional (नसेल तर local JSON data दाखवतो) |
| 3 | `MARKET_RESOURCE_ID` | data.gov.in dataset page वरून (डीफॉल्ट आधीच कोडमध्ये सेट आहे) | Optional |
| 4 | `ELEVENLABS_API_KEY` | https://elevenlabs.io (Profile → API Keys) | Optional (नसेल तर ब्राउझरचा साधा आवाज वापरतो) |
| 5 | `ELEVENLABS_VOICE_ID` | ElevenLabs Voice Library मधून | Optional (डीफॉल्ट voice आधीच सेट आहे) |

**Local (तुमच्या कॉम्प्युटरवर) टेस्ट करायचे असेल तर:**
- प्रोजेक्ट फोल्डरमध्ये `.env.example` ची कॉपी करून `.env.local` नावाने ठेवा, त्यात खऱ्या keys टाका.
- `vercel dev` कमांडने लोकल सर्व्हर चालवा (साधा `python server.py` वापरल्यास `/api` functions चालणार नाहीत, कारण त्या Vercel serverless आहेत).
- `.env.local` कधीही GitHub वर push होणार नाही (`.gitignore` मध्ये आधीच वगळलेली आहे) — ही सुरक्षेसाठी महत्त्वाची गोष्ट आहे.

---

## 📁 बॅकएंड फाईल्सची रचना (Combined — 1 Function मध्ये सर्व)

```
chaya-ai/
├── api/
│   └── index.js                # 🔒 एकच Vercel Serverless Function — सर्व routes याच्यातून चालतात
├── .env.example                # कोणकोणत्या keys लागतात याचे reference (यात खरी key नाही)
├── .gitignore                  # .env.local कधीही GitHub वर जाणार नाही याची खात्री
└── package.json                # Vercel साठी Node runtime माहिती
```

⚠️ **महत्त्वाचा बदल (Function-count Optimization)**: Vercel च्या Free (Hobby) प्लॅनवर प्रोजेक्टसाठी serverless functions ची संख्या मर्यादित असते. आधी 4 वेगळ्या फाईल्स होत्या (`gemini.js`, `market.js`, `tts.js`, `status.js`) — त्या आता **एकाच `api/index.js` फाईलमध्ये** एकत्र केल्या आहेत, आणि `?action=` query parameter वरून योग्य फंक्शनकडे पाठवल्या जातात:

| Route | Method | उपयोग |
|---|---|---|
| `/api/index?action=status` | GET | कोणते integrations configured आहेत ते सांगते |
| `/api/index?action=gemini` | POST | Gemini AI ला call करते (GEMINI_API_KEY वापरून) |
| `/api/index?action=market` | GET | Live बाजारभाव आणते (MARKET_API_KEY वापरून) |
| `/api/index?action=tts` | POST | ElevenLabs आवाज तयार करते (ELEVENLABS_API_KEY वापरून) |

यामुळे प्रोजेक्ट आता **फक्त 1 serverless function** वापरतो (आधी 4 होते) — म्हणजे भविष्यात नवीन फीचर्स (फोटो क्वालिटी चेक, नवीन API, इ.) जोडण्यासाठी भरपूर जागा शिल्लक राहते.

**फ्रंटएंड (`js/ai-engine.js`) आता थेट Google/ElevenLabs/data.gov.in ला call करत नाही** — तो फक्त तुमच्याच साईटच्या `/api/index?action=...` ला call करतो, आणि तिथून पुढे बॅकएंड खऱ्या सेवांना key सहित call करतो. यालाच **"backend proxy pattern"** म्हणतात — हीच खरी आणि सुरक्षित पद्धत आहे.

---

## 1️⃣ Google Gemini AI (मुख्य संवादात्मक सल्ला)

| तपशील | माहिती |
|---|---|
| **कशासाठी** | शेतकऱ्याच्या प्रश्नाला सविस्तर, नैसर्गिक मराठीत उत्तर देण्यासाठी |
| **कुठे मिळेल** | https://aistudio.google.com/app/apikey (Google खाते लागते) |
| **खर्च** | Free tier उपलब्ध (मर्यादित रोजचे requests); जास्त वापरासाठी paid billing लागेल |
| **कुठे टाकायचे** | Vercel → Settings → Environment Variables → `GEMINI_API_KEY` |
| **सद्यस्थिती** | ✅ बॅकएंड कोड तयार आहे (`api/index.js` → `action=gemini`), फक्त Vercel वर Key टाकून redeploy करायची गरज |
| **स्टेटस दाखवते** | Key टाकल्यावर हेडरमधील ⚙️ बटणात "Gemini AI कनेक्टेड 🟢" व मोडलमध्ये "✅ कनेक्टेड" दिसेल |

⚠️ **सुरक्षा टीप**: आता Key फक्त Vercel सर्व्हरवर (Environment Variable म्हणून) राहते — ब्राउझरमध्ये कधीही पाठवली जात नाही. हीच production-safe पद्धत आहे.

---

## 2️⃣ हवामान माहिती (Weather Detection) ✅ आधीच जोडलेले — Key लागत नाही

| तपशील | माहिती |
|---|---|
| **सेवा** | [Open-Meteo](https://open-meteo.com) — पूर्णपणे मोफत, API Key आवश्यक नाही |
| **कसे काम करते** | Browser च्या Location Permission वरून lat/long घेतले जाते → तापमान, आर्द्रता, वारा, पावसाची शक्यता दाखवते → फवारणीसाठी सल्ला (उदा. "पाऊस येण्याची शक्यता आहे, फवारणी टाळा") |
| **Location परवानगी नाकारली तर** | नांदेड जिल्ह्याचे डीफॉल्ट coordinates (19.15, 77.31) वापरले जातात |
| **वैकल्पिक सुधारणा** | अधिक अचूक hyperlocal (गाव-पातळी) हवामानासाठी [OpenWeatherMap](https://openweathermap.org/api) किंवा [IMD API](https://mausam.imd.gov.in/) जोडता येईल — त्यासाठी स्वतंत्र free/paid API key लागेल |

---

## 3️⃣ थेट बाजारभाव (Live APMC/Mandi Pricing)

| तपशील | माहिती |
|---|---|
| **कशासाठी** | नांदेड/मराठवाडा मोंढ्यातील खरा, आजचा बाजारभाव आलेखावर (chart) दाखवण्यासाठी |
| **कुठे मिळेल** | https://data.gov.in वर मोफत खाते करून **Agmarknet — Variety-wise Daily Market Prices** dataset साठी API key मागवा |
| **आवश्यक स्टेप्स** | 1. data.gov.in वर sign up करा → 2. "My Account → API Key" मधून key कॉपी करा → 3. Resource ID शोधा (Maharashtra/Nanded साठी योग्य dataset निवडा) |
| **कोडमधील स्थिती** | `api/index.js` (→ `action=market`) मध्ये `MARKET_API_KEY` व `MARKET_RESOURCE_ID` वापरले जातात — डीफॉल्ट resource ID कोडमध्ये आधीच सेट आहे, तुमच्या dataset नुसार बदलावे लागू शकते |
| **Key नसेल तर काय होते** | आपोआप `data/market_prices.json` मधील स्थानिक (local) डेटा दाखवला जातो — साईट कधीही तुटत नाही |
| **कुठे टाकायचे** | Vercel → Settings → Environment Variables → `MARKET_API_KEY` (व ऐच्छिक `MARKET_RESOURCE_ID`) |
| **मर्यादा** | data.gov.in API चे rate-limit असते (साधारण काही हजार calls/day free); जास्त रहदारीसाठी caching करावी लागेल |

---

## 4️⃣ ElevenLabs Text-to-Speech (आवाजातील सल्ला)

| तपशील | माहिती |
|---|---|
| **कशासाठी** | AI चा सल्ला/उत्तर शेतकऱ्याला **आवाजात ऐकवण्यासाठी** (विशेषतः जे वाचू शकत नाहीत त्यांच्यासाठी उपयुक्त) |
| **कुठे मिळेल** | https://elevenlabs.io वर sign up करून Profile → API Keys मधून key घ्या |
| **Voice ID कशी मिळेल** | ElevenLabs च्या "Voice Library" मधून मराठी/हिंदी उच्चारासाठी योग्य आवाज निवडा (किंवा स्वतःचा आवाज clone करा) → त्या आवाजाचा Voice ID कॉपी करा |
| **खर्च** | Free tier मध्ये दरमहा मर्यादित characters (साधारण 10,000); जास्त वापरासाठी paid plan लागेल |
| **कोडमधील स्थिती** | `api/index.js` (→ `action=tts`) मध्ये `ELEVENLABS_API_KEY` वापरून आवाज तयार होतो — Key नसेल तर आपोआप ब्राउझरचा built-in आवाज (Web Speech API) वापरला जातो, त्यामुळे फीचर कधीही पूर्ण बंद पडत नाही |
| **कुठे टाकायचे** | Vercel → Settings → Environment Variables → `ELEVENLABS_API_KEY` व `ELEVENLABS_VOICE_ID` |
| **कुठे दिसेल/ऐकू येईल** | `result.html` वरील "🔊 सल्ला ऐका" बटण, आणि चॅटबॉटमधील प्रत्येक उत्तराशेजारी 🔊 आयकॉन |
| **मराठी उच्चार** | ElevenLabs चे `eleven_multilingual_v2` मॉडेल कोडमध्ये आधीच सेट केले आहे, जे हिंदी/मराठीसारख्या भाषांना बऱ्यापैकी सपोर्ट करते — पूर्ण अस्खलित मराठीसाठी योग्य Voice निवडणे महत्त्वाचे |

---

## 5️⃣ Hosting व तांत्रिक आवश्यकता (सर्व फीचर्स नीट चालण्यासाठी)

1. **GitHub वर कधीही खरी Key commit करू नका** — फक्त कोड push करा (`api/*.js`, `.env.example`, `.gitignore`). खऱ्या keys फक्त Vercel Dashboard मध्येच टाका. चुकून जुनी कोणतीही key GitHub वर push झाली असेल, तर ती लगेच त्या सेवेच्या (Google/data.gov.in/ElevenLabs) डॅशबोर्डवरून revoke/regenerate करा.
2. **साईट खऱ्या सर्व्हरवर चालवा** — `file:///index.html` असे थेट उघडल्यास `fetch()` (data/*.json), Geolocation आणि Microphone हे काही ब्राउझरमध्ये ब्लॉक होऊ शकतात. GitHub → Vercel वरून deploy केलेली साईट आधीच HTTPS वर असते, त्यामुळे हे व्यवस्थित चालेल.
3. **CORS**: Open-Meteo (हवामान) थेट ब्राउझरमधून call होतो. Gemini, data.gov.in, ElevenLabs आता तुमच्याच डोमेनवरील `/api/*` मार्गे call होतात — त्यामुळे CORS चा प्रश्नच येत नाही.
4. **मोबाइल व्हॉइस इनपुट**: Marathi Speech-to-Text (🎤 बटण) हे Chrome/Edge सारख्या ब्राउझरमध्ये उत्तम चालते; Safari/iOS वर मर्यादित सपोर्ट आहे.

---

## 6️⃣ सध्या तयार असलेले (या अपडेटमध्ये जोडलेले) फीचर्स

- ✅ Mobile + Laptop responsive डिझाईन (सर्व स्क्रीन साईझसाठी breakpoints)
- ✅ Live हवामान widget (Open-Meteo, Key शिवाय)
- ✅ **बॅकएंड आर्किटेक्चर (`/api` फोल्डर)** — Gemini, Live बाजारभाव, ElevenLabs — तिन्हीच्या Keys आता फक्त Vercel Environment Variables मध्ये, ब्राउझरमध्ये कधीही नाही
- ✅ Live बाजारभाव fetch लॉजिक + local fallback (data.gov.in Key ऐच्छिक)
- ✅ ElevenLabs Text-to-Speech + Browser Voice fallback
- ✅ Settings मोडल आता फक्त स्टेटस दाखवतो (✅ कनेक्टेड / ⚪ कॉन्फिगर नाही) — Key टाकायचा पर्याय काढला, कारण ती आता backend वर आहे

## 7️⃣ पुढे नंतर जोडायच्या गोष्टी (User ने सांगितल्याप्रमाणे — सध्या pending)

- 🔜 फोटोवरून पीक/रोग ओळखण्यासाठी **Image Quality / फाईल क्वालिटी चेक** (उदा. अपलोड केलेला फोटो धूसर आहे का, योग्य आहे का हे तपासणे)
- 🔜 इतर कोणतेही नवीन फीचर्स जे पुढे सांगाल

---

### 📌 थोडक्यात — किमान किती Key लागतील?

| फीचर | Key शिवाय चालते का? |
|---|---|
| ऑफलाइन कृषी सल्ला | ✅ हो (पूर्ण काम करते) |
| हवामान | ✅ हो (Open-Meteo मोफत) |
| Gemini संवादात्मक AI | ❌ Key आवश्यक |
| Live बाजारभाव | ❌ Key आवश्यक (नाहीतर local data दाखवतो) |
| आवाजातील सल्ला (ElevenLabs दर्जा) | ❌ Key आवश्यक (नाहीतर ब्राउझरचा साधा आवाज वापरतो) |
