/**
 * Chaya AI - Floating Interactive Agricultural Chatbot & Voice Assistant Widget
 * Farmer-friendly, bilingual (Marathi / English), voice input (STT) and spoken responses (TTS).
 */

class ChayaChatWidget {
  constructor() {
    this.isOpen = false;
    this.messages = [];
    this.autoSpeak = localStorage.getItem('chaya_auto_speak') === 'true';
    this.isListening = false;
    this.isSpeaking = false;
    this.currentSpeakingBtn = null;
    this.recognition = null;
    this.lang = localStorage.getItem('chaya_lang') || 'en';
    this.init();
  }

  getTranslations() {
    return {
      en: {
        launcher: "Chat with Chaya 🎤",
        headerTitle: "Chaya — Farm Assistant",
        headerSub: "24/7 Smart Agro Voice Advisor",
        autoSpeakLabel: "Auto-Speak",
        stopVoiceLabel: "Stop Audio",
        presets: [
          { label: "🌿 Turmeric Leaf Spot & Rot", query: "How to control leaf spot and rhizome rot in turmeric crop?" },
          { label: "🍌 Banana Drip Schedule", query: "How to schedule drip fertilizer and irrigation for banana crop?" },
          { label: "🌱 Soybean Pests", query: "What is the best pesticide remedy for soybean girdle beetle and stem fly?" },
          { label: "☁️ Cotton Bollworm", query: "How to control pink bollworm in cotton?" },
          { label: "🏛️ Drip 80% Subsidy", query: "Give details and documents for government drip irrigation subsidy scheme" },
          { label: "📊 Mandi Prices", query: "What are today's APMC mandi market rates in Nanded?" }
        ],
        welcome: "<b>Namaste Farmer Friend! 🙏</b><br>I am <b>Chaya</b> — your trusted agricultural companion. You can type your query in English or tap the microphone 🎤 to speak.",
        placeholder: "Type your query or tap mic to speak...",
        micTitle: "Tap to speak (Voice Input)",
        micListening: "🎤 Listening... Speak now",
        thinking: "🌱 Chaya is preparing your solution in English...",
        voiceUnsupported: "Voice input is not supported in this browser. Please type your query.",
        clearChat: "Clear Chat"
      },
      mr: {
        launcher: "छाया सोबत बोला 🎤",
        headerTitle: "छाया — कृषी मार्गदर्शक",
        headerSub: "२४/७ डिजिटल शेती व व्हॉइस सल्लागार",
        autoSpeakLabel: "आपोआप ऑडिओ",
        stopVoiceLabel: "बोलणे थांबवा",
        presets: [
          { label: "🌿 हळद करपा व कंदकुज", query: "हळदीवरील करपा व कंदकुज रोगावर काय फवारावे?" },
          { label: "🍌 केळी खत नियोजन", query: "केळीला ठिबक सिंचनाने खते कशी द्यावीत?" },
          { label: "🌱 सोयाबीन चक्रीभुंगा", query: "सोयाबीनवरील चक्रीभुंगा व खोडमाशीवर काय उपाय करावा?" },
          { label: "☁️ कापूस बोंडअळी", query: "कापसावरील गुलाबी बोंडअळी नियंत्रण उपाय" },
          { label: "🏛️ ठिबक ८०% अनुदान", query: "मागेल त्याला ठिबक योजनेची माहिती व अनुदान" },
          { label: "📊 चालू बाजारभाव", query: "नांदेड व मराठवाड्यातील चालू बाजारभाव काय आहेत?" }
        ],
        welcome: "<b>नमस्कार शेतकरी मित्रहो! 🙏</b><br>मी <b>छाया</b> — तुमची डिजिटल कृषी मार्गदर्शक. आपण खाली टाईप करू शकता किंवा <b>माईक (🎤)</b> वर क्लिक करून थेट मराठीत बोलून प्रश्न विचारू शकता.",
        placeholder: "येथे प्रश्न विचारा किंवा माईक दाबून बोला...",
        micTitle: "मराठीत बोला (व्हॉइस इनपुट)",
        micListening: "🎤 ऐकत आहे... मराठीत बोला",
        thinking: "🌱 छाया सल्ला तयार करत आहे...",
        voiceUnsupported: "तुमच्या ब्राउझरमध्ये व्हॉइस इनपुट उपलब्ध नाही. कृपया लिहून प्रश्न विचारा.",
        clearChat: "चॅट साफ करा"
      }
    };
  }

  setLanguage(lang) {
    this.lang = lang || localStorage.getItem('chaya_lang') || 'en';
    const t = this.getTranslations()[this.lang] || this.getTranslations().en;

    const launcherLabel = document.querySelector('.chat-launcher .chat-label');
    if (launcherLabel) launcherLabel.innerText = t.launcher;

    const headerTitle = document.querySelector('.chat-header-title');
    if (headerTitle) headerTitle.innerText = t.headerTitle;

    const headerSub = document.querySelector('.chat-header-sub');
    if (headerSub) headerSub.innerText = t.headerSub;

    const autoSpeakText = document.getElementById('chat-auto-speak-text');
    if (autoSpeakText) autoSpeakText.innerText = t.autoSpeakLabel;

    const stopAudioBtn = document.getElementById('chat-stop-audio-btn');
    if (stopAudioBtn) stopAudioBtn.title = t.stopVoiceLabel;

    const input = document.getElementById('chat-user-input');
    if (input && !this.isListening) input.placeholder = t.placeholder;

    const micBtn = document.getElementById('chat-mic-btn');
    if (micBtn) micBtn.title = t.micTitle;

    const clearBtn = document.getElementById('chat-clear-btn');
    if (clearBtn) clearBtn.title = t.clearChat;

    const quickTags = document.querySelector('.chat-quick-tags');
    if (quickTags) {
      quickTags.innerHTML = t.presets.map(p => `
        <button class="quick-chip" onclick="window.chayaChat.sendPreset('${p.query.replace(/'/g, "\\'")}')">${p.label}</button>
      `).join('');
    }

    if (this.messages.length === 0) {
      const welcomeBubble = document.querySelector('#chat-messages .chat-msg.bot .msg-bubble');
      if (welcomeBubble) {
        welcomeBubble.innerHTML = t.welcome;
      }
    }
  }

  init() {
    const t = this.getTranslations()[this.lang];

    const widgetHtml = `
      <div id="chaya-chat-launcher" class="chat-launcher" onclick="window.chayaChat.toggle()">
        <span class="chat-icon">🌿</span>
        <span class="chat-label">${t.launcher}</span>
        <span class="chat-badge-pulse"></span>
      </div>

      <div id="chaya-chat-drawer" class="chat-drawer">
        <div class="chat-header">
          <div style="display:flex; align-items:center; gap:10px;">
            <div class="chat-avatar-ring">
              <span style="font-size:1.3rem;">👨‍🌾</span>
            </div>
            <div>
              <div class="chat-header-title" style="font-weight:800; font-size:0.95rem; color:#ffffff; line-height:1.2;">${t.headerTitle}</div>
              <div class="chat-header-sub" style="font-size:0.72rem; color:#a7f3d0; margin-top:2px;">${t.headerSub}</div>
            </div>
          </div>
          
          <div style="display:flex; align-items:center; gap:6px;">
            <!-- Auto-Speak toggle -->
            <button id="chat-auto-speak-toggle" class="chat-ctrl-btn ${this.autoSpeak ? 'active' : ''}" onclick="window.chayaChat.toggleAutoSpeak()" title="${t.autoSpeakLabel}">
              <span id="chat-auto-speak-icon">🔊</span>
              <span id="chat-auto-speak-text" style="font-size:0.68rem; font-weight:700;">${t.autoSpeakLabel}</span>
            </button>

            <!-- Stop audio button (visible when speaking) -->
            <button id="chat-stop-audio-btn" class="chat-ctrl-btn stop-audio-btn" style="display:none;" onclick="window.chayaChat.stopAllSpeech()" title="${t.stopVoiceLabel}">
              ⏹️
            </button>

            <!-- Clear history -->
            <button id="chat-clear-btn" class="chat-ctrl-btn" onclick="window.chayaChat.clearHistory()" title="${t.clearChat}">
              🗑️
            </button>

            <!-- Close drawer -->
            <button class="chat-close-btn" onclick="window.chayaChat.toggle()" title="Close">✕</button>
          </div>
        </div>

        <div class="chat-quick-tags">
          ${t.presets.map(p => `
            <button class="quick-chip" onclick="window.chayaChat.sendPreset('${p.query.replace(/'/g, "\\'")}')">${p.label}</button>
          `).join('')}
        </div>

        <div id="chat-messages" class="chat-messages">
          <div class="chat-msg bot">
            <div class="msg-bubble">
              ${t.welcome}
            </div>
          </div>
        </div>

        <!-- Live Listening Indicator -->
        <div id="chat-voice-status-bar" class="voice-status-bar" style="display:none;">
          <span class="voice-wave-dot"></span>
          <span class="voice-wave-dot"></span>
          <span class="voice-wave-dot"></span>
          <span id="chat-voice-status-text" style="font-size:0.8rem; font-weight:600; color:#065f46;">${t.micListening}</span>
        </div>

        <div class="chat-input-area">
          <input type="text" id="chat-user-input" placeholder="${t.placeholder}" onkeypress="window.chayaChat.handleKey(event)" />
          <button id="chat-mic-btn" class="chat-action-btn mic-btn" title="${t.micTitle}" onclick="window.chayaChat.startVoiceInput()">
            <span class="mic-icon">🎤</span>
          </button>
          <button id="chat-send-btn" class="chat-action-btn send-btn" onclick="window.chayaChat.sendMessage()" title="Send">
            <span>➔</span>
          </button>
        </div>
      </div>
    `;

    const container = document.createElement('div');
    container.id = 'chaya-chat-container';
    container.innerHTML = widgetHtml;
    document.body.appendChild(container);

    this.injectStyles();
  }

  injectStyles() {
    const style = document.createElement('style');
    style.innerHTML = `
      .chat-launcher {
        position: fixed;
        bottom: 24px;
        right: 24px;
        background: linear-gradient(135deg, #059669, #047857);
        color: #ffffff;
        padding: 12px 20px;
        border-radius: 9999px;
        box-shadow: 0 10px 25px -5px rgba(5, 150, 105, 0.5), 0 8px 10px -6px rgba(5, 150, 105, 0.4);
        display: flex;
        align-items: center;
        gap: 10px;
        cursor: pointer;
        z-index: 999;
        font-weight: 700;
        font-size: 0.95rem;
        transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        border: 2px solid rgba(255, 255, 255, 0.3);
      }
      .chat-launcher:hover {
        transform: translateY(-3px) scale(1.03);
        box-shadow: 0 16px 30px -5px rgba(5, 150, 105, 0.6);
        background: linear-gradient(135deg, #10b981, #059669);
      }
      .chat-launcher .chat-icon {
        font-size: 1.35rem;
      }
      .chat-badge-pulse {
        width: 10px;
        height: 10px;
        background-color: #34d399;
        border-radius: 50%;
        box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.7);
        animation: pulse-ring 2s infinite;
      }
      @keyframes pulse-ring {
        0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.7); }
        70% { transform: scale(1); box-shadow: 0 0 0 8px rgba(52, 211, 153, 0); }
        100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(52, 211, 153, 0); }
      }

      .chat-drawer {
        position: fixed;
        bottom: 88px;
        right: 24px;
        width: 410px;
        max-width: calc(100vw - 32px);
        height: 560px;
        max-height: calc(100vh - 120px);
        background: #ffffff;
        border-radius: 20px;
        box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.25), 0 0 0 1px rgba(15, 23, 42, 0.08);
        display: flex;
        flex-direction: column;
        z-index: 1000;
        overflow: hidden;
        transform: translateY(20px) scale(0.96);
        opacity: 0;
        pointer-events: none;
        transition: all 0.28s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .chat-drawer.open {
        transform: translateY(0) scale(1);
        opacity: 1;
        pointer-events: auto;
      }

      .chat-header {
        background: linear-gradient(135deg, #065f46 0%, #047857 100%);
        padding: 14px 16px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        color: white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      }
      .chat-avatar-ring {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: rgba(255,255,255,0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1.5px solid rgba(255,255,255,0.4);
      }
      .chat-ctrl-btn {
        background: rgba(255,255,255,0.15);
        border: 1px solid rgba(255,255,255,0.25);
        color: white;
        border-radius: 12px;
        padding: 5px 9px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 4px;
        transition: all 0.2s ease;
      }
      .chat-ctrl-btn:hover {
        background: rgba(255,255,255,0.28);
      }
      .chat-ctrl-btn.active {
        background: #10b981;
        border-color: #34d399;
        box-shadow: 0 0 10px rgba(16, 185, 129, 0.5);
      }
      .stop-audio-btn {
        background: #dc2626 !important;
        border-color: #ef4444 !important;
        animation: pulse-red 1.5s infinite;
      }
      @keyframes pulse-red {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.08); }
      }
      .chat-close-btn {
        background: transparent;
        border: none;
        color: white;
        font-size: 1.1rem;
        cursor: pointer;
        width: 32px;
        height: 32px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s ease;
      }
      .chat-close-btn:hover {
        background: rgba(255,255,255,0.2);
      }

      .chat-quick-tags {
        display: flex;
        gap: 6px;
        padding: 10px 14px;
        background: #f8fafc;
        overflow-x: auto;
        white-space: nowrap;
        border-bottom: 1px solid #e2e8f0;
        scrollbar-width: none;
      }
      .chat-quick-tags::-webkit-scrollbar {
        display: none;
      }
      .quick-chip {
        background: #ffffff;
        border: 1px solid #cbd5e1;
        color: #1e293b;
        font-size: 0.74rem;
        font-weight: 600;
        padding: 5px 10px;
        border-radius: 9999px;
        cursor: pointer;
        transition: all 0.2s ease;
        flex-shrink: 0;
      }
      .quick-chip:hover {
        background: #ecfdf5;
        border-color: #10b981;
        color: #065f46;
        transform: translateY(-1px);
      }

      .chat-messages {
        flex: 1;
        padding: 14px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 12px;
        background: #fdfbf7;
        font-size: 0.88rem;
      }
      .chat-msg {
        display: flex;
        flex-direction: column;
        max-width: 88%;
        animation: fadeInMsg 0.2s ease-out;
      }
      @keyframes fadeInMsg {
        from { opacity: 0; transform: translateY(6px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .chat-msg.user {
        align-self: flex-end;
      }
      .chat-msg.bot {
        align-self: flex-start;
      }
      .chat-msg.user .msg-bubble {
        background: linear-gradient(135deg, #059669, #047857);
        color: #ffffff;
        border-radius: 16px 16px 2px 16px;
        padding: 10px 14px;
        box-shadow: 0 2px 5px rgba(5,150,105,0.25);
        line-height: 1.45;
      }
      .chat-msg.bot .msg-bubble {
        background: #ffffff;
        color: #0f172a;
        border-radius: 16px 16px 16px 2px;
        padding: 12px 14px;
        border: 1px solid #e2e8f0;
        box-shadow: 0 2px 6px rgba(0,0,0,0.04);
        position: relative;
        line-height: 1.55;
      }
      .msg-actions {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 8px;
        padding-top: 6px;
        border-top: 1px dashed #e2e8f0;
      }
      .msg-speak-btn {
        background: #f1f5f9;
        border: 1px solid #cbd5e1;
        border-radius: 9999px;
        color: #334155;
        font-size: 0.72rem;
        font-weight: 700;
        padding: 3px 10px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        transition: all 0.2s ease;
      }
      .msg-speak-btn:hover {
        background: #ecfdf5;
        border-color: #10b981;
        color: #065f46;
      }
      .msg-speak-btn.speaking {
        background: #10b981;
        color: white;
        border-color: #059669;
        animation: pulse-speak 1.2s infinite;
      }
      @keyframes pulse-speak {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.05); }
      }

      .voice-status-bar {
        background: #ecfdf5;
        border-top: 1px solid #a7f3d0;
        padding: 8px 14px;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .voice-wave-dot {
        width: 8px;
        height: 8px;
        background: #059669;
        border-radius: 50%;
        animation: dotWave 1.2s infinite ease-in-out;
      }
      .voice-wave-dot:nth-child(2) { animation-delay: 0.2s; }
      .voice-wave-dot:nth-child(3) { animation-delay: 0.4s; }
      @keyframes dotWave {
        0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; }
        40% { transform: scale(1.2); opacity: 1; }
      }

      .chat-input-area {
        padding: 10px 12px;
        background: #ffffff;
        border-top: 1px solid #e2e8f0;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .chat-input-area input {
        flex: 1;
        border: 1.5px solid #cbd5e1;
        border-radius: 12px;
        padding: 10px 14px;
        font-size: 0.9rem;
        outline: none;
        transition: border-color 0.2s ease;
      }
      .chat-input-area input:focus {
        border-color: #059669;
        box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.15);
      }
      .chat-action-btn {
        width: 42px;
        height: 42px;
        border-radius: 12px;
        border: none;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-size: 1.1rem;
        transition: all 0.2s ease;
        flex-shrink: 0;
      }
      .mic-btn {
        background: #f1f5f9;
        color: #334155;
        border: 1.5px solid #cbd5e1;
      }
      .mic-btn:hover {
        background: #e2e8f0;
        color: #0f172a;
      }
      .mic-btn.listening {
        background: #fee2e2;
        color: #dc2626;
        border-color: #ef4444;
        animation: pulse-mic 1s infinite;
      }
      @keyframes pulse-mic {
        0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
        50% { transform: scale(1.08); box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
      }
      .send-btn {
        background: #059669;
        color: white;
      }
      .send-btn:hover {
        background: #047857;
        transform: scale(1.05);
      }
      .send-btn:active {
        transform: scale(0.95);
      }
    `;
    document.head.appendChild(style);
  }

  toggle() {
    this.isOpen = !this.isOpen;
    const drawer = document.getElementById('chaya-chat-drawer');
    if (drawer) {
      if (this.isOpen) {
        drawer.classList.add('open');
        setTimeout(() => {
          const input = document.getElementById('chat-user-input');
          if (input) input.focus();
        }, 150);
      } else {
        drawer.classList.remove('open');
        this.stopAllSpeech();
        if (this.recognition && this.isListening) {
          try { this.recognition.stop(); } catch (_) {}
        }
      }
    }
  }

  toggleAutoSpeak() {
    this.autoSpeak = !this.autoSpeak;
    localStorage.setItem('chaya_auto_speak', this.autoSpeak ? 'true' : 'false');
    const toggleBtn = document.getElementById('chat-auto-speak-toggle');
    if (toggleBtn) {
      if (this.autoSpeak) {
        toggleBtn.classList.add('active');
      } else {
        toggleBtn.classList.remove('active');
        this.stopAllSpeech();
      }
    }
  }

  stopAllSpeech() {
    if (window.chayaAI && typeof window.chayaAI.stopSpeaking === 'function') {
      window.chayaAI.stopSpeaking();
    }
    this.isSpeaking = false;
    const stopAudioBtn = document.getElementById('chat-stop-audio-btn');
    if (stopAudioBtn) stopAudioBtn.style.display = 'none';

    document.querySelectorAll('.msg-speak-btn.speaking').forEach(btn => {
      btn.classList.remove('speaking');
      btn.innerHTML = '🔊 ' + (this.lang === 'mr' ? 'ऐका' : 'Listen');
    });
  }

  clearHistory() {
    this.messages = [];
    const messagesBox = document.getElementById('chat-messages');
    const t = this.getTranslations()[this.lang];
    if (messagesBox) {
      messagesBox.innerHTML = `
        <div class="chat-msg bot">
          <div class="msg-bubble">
            ${t.welcome}
          </div>
        </div>
      `;
    }
    this.stopAllSpeech();
  }

  handleKey(e) {
    if (e.key === 'Enter') {
      this.sendMessage();
    }
  }

  sendPreset(query) {
    const input = document.getElementById('chat-user-input');
    if (input) {
      input.value = query;
      this.sendMessage();
    }
  }

  async sendMessage() {
    const input = document.getElementById('chat-user-input');
    const text = input.value.trim();
    if (!text) return;

    // Refresh active language
    this.lang = localStorage.getItem('chaya_lang') || this.lang || 'en';

    this.stopAllSpeech();
    this.appendMessage('user', text);
    this.messages.push({ sender: 'user', text });
    input.value = '';

    const messagesBox = document.getElementById('chat-messages');
    const t = this.getTranslations()[this.lang] || this.getTranslations().en;

    // Add typing indicator
    const typingElem = document.createElement('div');
    typingElem.className = 'chat-msg bot typing-ind';
    typingElem.innerHTML = `<div class="msg-bubble" style="font-style:italic; color:#6b7280;">${t.thinking}</div>`;
    messagesBox.appendChild(typingElem);
    messagesBox.scrollTop = messagesBox.scrollHeight;

    // Get current farm context from localStorage if available
    let farmContext = null;
    try {
      const savedData = localStorage.getItem('chayaFormData');
      if (savedData) farmContext = JSON.parse(savedData);
    } catch (_) {}

    if (!window.chayaAI.isLoaded) {
      await window.chayaAI.loadKnowledgeBase();
    }

    const reply = await window.chayaAI.handleChatMessage(text, farmContext, this.lang, this.messages);

    typingElem.remove();
    this.messages.push({ sender: 'bot', text: reply });
    const botMsgBubble = this.appendMessage('bot', reply);

    // Auto speak if enabled
    if (this.autoSpeak && botMsgBubble) {
      const speakBtn = botMsgBubble.querySelector('.msg-speak-btn');
      if (speakBtn) {
        this.speakMessage(speakBtn, reply);
      }
    }
  }

  appendMessage(sender, text) {
    const messagesBox = document.getElementById('chat-messages');
    const msgElem = document.createElement('div');
    msgElem.className = `chat-msg ${sender}`;

    // Format bold, bullet points, line breaks
    let formatted = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>')
      .replace(/• /g, '👉 ')
      .replace(/👉 /g, '<span style="color:#059669; font-weight:bold;">• </span>');

    const speakBtnLabel = this.lang === 'mr' ? 'ऐका' : 'Listen';
    const escapedText = encodeURIComponent(text);

    const speakBtnHtml = sender === 'bot'
      ? `<div class="msg-actions">
           <button class="msg-speak-btn" onclick="window.chayaChat.speakMessage(this, decodeURIComponent('${escapedText}'))">
             🔊 ${speakBtnLabel}
           </button>
         </div>`
      : '';

    msgElem.innerHTML = `<div class="msg-bubble">${formatted}${speakBtnHtml}</div>`;
    messagesBox.appendChild(msgElem);
    messagesBox.scrollTop = messagesBox.scrollHeight;
    return msgElem;
  }

  speakMessage(btnEl, text) {
    this.stopAllSpeech();

    const stopAudioBtn = document.getElementById('chat-stop-audio-btn');
    if (stopAudioBtn) stopAudioBtn.style.display = 'flex';

    if (btnEl) {
      btnEl.classList.add('speaking');
      btnEl.innerHTML = '🔊 ' + (this.lang === 'mr' ? 'बोलत आहे...' : 'Speaking...');
    }

    this.isSpeaking = true;
    window.chayaAI.speak(text, {
      lang: this.lang,
      onStart: () => {
        this.isSpeaking = true;
        if (stopAudioBtn) stopAudioBtn.style.display = 'flex';
      },
      onEnd: () => {
        this.isSpeaking = false;
        if (btnEl) {
          btnEl.classList.remove('speaking');
          btnEl.innerHTML = '🔊 ' + (this.lang === 'mr' ? 'ऐका' : 'Listen');
        }
        if (stopAudioBtn) stopAudioBtn.style.display = 'none';
      },
      onError: () => {
        this.isSpeaking = false;
        if (btnEl) {
          btnEl.classList.remove('speaking');
          btnEl.innerHTML = '🔊 ' + (this.lang === 'mr' ? 'ऐका' : 'Listen');
        }
        if (stopAudioBtn) stopAudioBtn.style.display = 'none';
      }
    });
  }

  startVoiceInput() {
    const micBtn = document.getElementById('chat-mic-btn');
    const input = document.getElementById('chat-user-input');
    const statusBar = document.getElementById('chat-voice-status-bar');
    const statusText = document.getElementById('chat-voice-status-text');
    const t = this.getTranslations()[this.lang];

    // If currently listening, stop it
    if (this.isListening && this.recognition) {
      try { this.recognition.stop(); } catch (_) {}
      this.isListening = false;
      if (micBtn) micBtn.classList.remove('listening');
      if (statusBar) statusBar.style.display = 'none';
      return;
    }

    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert(t.voiceUnsupported);
      return;
    }

    this.stopAllSpeech();

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    this.recognition = recognition;
    recognition.lang = this.lang === 'mr' ? 'mr-IN' : 'en-IN';
    recognition.continuous = false;
    recognition.interimResults = true;

    this.isListening = true;
    if (micBtn) micBtn.classList.add('listening');
    if (statusBar) {
      statusBar.style.display = 'flex';
      if (statusText) statusText.innerText = t.micListening;
    }

    recognition.onresult = (event) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          input.value = event.results[i][0].transcript;
        }
      }

      if (finalTranscript) {
        input.value = finalTranscript;
        this.isListening = false;
        if (micBtn) micBtn.classList.remove('listening');
        if (statusBar) statusBar.style.display = 'none';
        this.sendMessage();
      }
    };

    recognition.onerror = (e) => {
      console.warn('Speech recognition notice:', e.error);
      this.isListening = false;
      if (micBtn) micBtn.classList.remove('listening');
      if (statusBar) statusBar.style.display = 'none';
    };

    recognition.onend = () => {
      this.isListening = false;
      if (micBtn) micBtn.classList.remove('listening');
      if (statusBar) statusBar.style.display = 'none';
    };

    try {
      recognition.start();
    } catch (e) {
      console.warn('Speech recognition start failed:', e);
      this.isListening = false;
      if (micBtn) micBtn.classList.remove('listening');
      if (statusBar) statusBar.style.display = 'none';
    }
  }
}

// Auto instantiate when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (!window.chayaChat) window.chayaChat = new ChayaChatWidget();
  });
} else {
  if (!window.chayaChat) window.chayaChat = new ChayaChatWidget();
}
