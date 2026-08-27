/**
 * Chaya AI - Floating Interactive Agricultural Chatbot Widget
 */

class ChayaChatWidget {
  constructor() {
    this.isOpen = false;
    this.messages = [];
    this.lang = localStorage.getItem('chaya_lang') || 'en';
    this.init();
  }

  getTranslations() {
    return {
      en: {
        launcher: "Chat with Chaya AI",
        headerTitle: "Chaya AI Farm Assistant",
        headerSub: "Online Agro Expert (Knowledge-Grounded)",
        presets: [
          { label: "🌿 Turmeric Leaf Spot", query: "How to control leaf spot disease in turmeric?" },
          { label: "🍌 Banana Drip Schedule", query: "How to schedule drip fertilizer for banana crop?" },
          { label: "🌱 Soybean Pests", query: "What is the best pesticide for soybean pests?" },
          { label: "🏛️ Drip Subsidy", query: "Give details about government drip irrigation scheme" }
        ],
        welcome: "<b>Hello Farmer Friend! 🙏</b><br>I am <b>Chaya AI</b> - your smart agricultural advisor. Feel free to ask any question regarding crop selection, fertilizer scheduling, disease management, or mandi market prices.",
        placeholder: "Ask your question or tap mic to speak...",
        micTitle: "Tap to speak in English",
        thinking: "🌱 Chaya AI is thinking...",
        voiceUnsupported: "Voice input is not supported in your browser. Please type your query."
      },
      mr: {
        launcher: "छाया AI शी बोला",
        headerTitle: "छाया AI संवाद सहाय्यक",
        headerSub: "ऑनलाइन कृषी तज्ज्ञ (Knowledge-Grounded)",
        presets: [
          { label: "🌿 हळद करपा", query: "हळदीवरील करपा रोगावर काय फवारावे?" },
          { label: "🍌 केळी खत नियोजन", query: "केळीला ठिबक सिंचनाने खते कशी द्यावीत?" },
          { label: "🌱 सोयाबीन कीड", query: "सोयाबीनसाठी सर्वोत्तम कीडनाशक कोणते?" },
          { label: "🏛️ ठिबक अनुदान", query: "मागेल त्याला ठिबक योजनेची माहिती द्या" }
        ],
        welcome: "<b>नमस्कार शेतकरी मित्रहो! 🙏</b><br>मी <b>छाया AI</b> - तुमचा डिजिटल कृषी मित्र. आपण आपल्या शेतातील पीक, खते, रोग-कीड किंवा बाजारभावाबद्दल कोणताही प्रश्न मराठीत विचारू शकता.",
        placeholder: "येथे प्रश्न विचारा किंवा बोला...",
        micTitle: "मराठीत बोला (Voice)",
        thinking: "🌱 छाया AI विचार करत आहे...",
        voiceUnsupported: "तुमच्या ब्राउझरमध्ये व्हॉइस इनपुट सपोर्ट उपलब्ध नाही. कृपया टाइप करा."
      }
    };
  }

  setLanguage(lang) {
    this.lang = lang || 'en';
    const t = this.getTranslations()[this.lang];
    
    const launcherLabel = document.querySelector('.chat-launcher .chat-label');
    if (launcherLabel) launcherLabel.innerText = t.launcher;

    const headerTitle = document.querySelector('.chat-header-title');
    if (headerTitle) headerTitle.innerText = t.headerTitle;

    const headerSub = document.querySelector('.chat-header-sub');
    if (headerSub) headerSub.innerText = t.headerSub;

    const input = document.getElementById('chat-user-input');
    if (input) input.placeholder = t.placeholder;

    const micBtn = document.getElementById('chat-mic-btn');
    if (micBtn) micBtn.title = t.micTitle;

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

    // Inject Chat Widget HTML into the document
    const widgetHtml = `
      <div id="chaya-chat-launcher" class="chat-launcher" onclick="window.chayaChat.toggle()">
        <span class="chat-icon">💬</span>
        <span class="chat-label">${t.launcher}</span>
      </div>

      <div id="chaya-chat-drawer" class="chat-drawer">
        <div class="chat-header">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:1.4rem;">🌿</span>
            <div>
              <div class="chat-header-title" style="font-weight:800; font-size:1rem;">${t.headerTitle}</div>
              <div class="chat-header-sub" style="font-size:0.75rem; color:#d1fae5;">${t.headerSub}</div>
            </div>
          </div>
          <button class="chat-close-btn" onclick="window.chayaChat.toggle()">✕</button>
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

        <div class="chat-input-area">
          <input type="text" id="chat-user-input" placeholder="${t.placeholder}" onkeypress="window.chayaChat.handleKey(event)" />
          <button id="chat-mic-btn" class="chat-action-btn mic-btn" title="${t.micTitle}" onclick="window.chayaChat.startVoiceInput()">🎤</button>
          <button id="chat-send-btn" class="chat-action-btn send-btn" onclick="window.chayaChat.sendMessage()">➔</button>
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
        background: linear-gradient(135deg, #10b981, #065f46);
        color: white;
        padding: 12px 20px;
        border-radius: 30px;
        box-shadow: 0 8px 24px rgba(6, 78, 59, 0.4);
        display: flex;
        align-items: center;
        gap: 10px;
        cursor: pointer;
        z-index: 1000;
        font-weight: 700;
        transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        border: 2px solid rgba(255,255,255,0.4);
      }
      .chat-launcher:hover {
        transform: scale(1.05) translateY(-2px);
        box-shadow: 0 12px 28px rgba(6, 78, 59, 0.5);
      }
      .chat-launcher .chat-icon {
        font-size: 1.3rem;
      }
      .chat-drawer {
        position: fixed;
        bottom: 90px;
        right: 24px;
        width: 380px;
        max-width: calc(100vw - 32px);
        height: 520px;
        max-height: calc(100vh - 120px);
        background: rgba(255, 255, 255, 0.96);
        backdrop-filter: blur(16px);
        border-radius: 20px;
        border: 1px solid rgba(16, 185, 129, 0.3);
        box-shadow: 0 16px 40px rgba(0, 0, 0, 0.2);
        display: none;
        flex-direction: column;
        z-index: 1000;
        overflow: hidden;
        animation: chatSlideIn 0.3s ease-out;
      }
      @keyframes chatSlideIn {
        from { opacity: 0; transform: translateY(20px) scale(0.95); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      .chat-header {
        background: linear-gradient(135deg, #064e3b, #10b981);
        color: white;
        padding: 14px 18px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .chat-close-btn {
        background: rgba(255,255,255,0.2);
        border: none;
        color: white;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        cursor: pointer;
        font-weight: bold;
      }
      .chat-quick-tags {
        display: flex;
        gap: 6px;
        padding: 8px 12px;
        background: #f0fdf4;
        border-bottom: 1px solid #dcfce7;
        overflow-x: auto;
        white-space: nowrap;
        scrollbar-width: thin;
      }
      .quick-chip {
        background: white;
        border: 1px solid #86efac;
        color: #065f46;
        padding: 4px 10px;
        border-radius: 12px;
        font-size: 0.78rem;
        font-weight: 600;
        cursor: pointer;
        flex-shrink: 0;
        transition: all 0.2s ease;
      }
      .quick-chip:hover {
        background: #10b981;
        color: white;
      }
      .chat-messages {
        flex: 1;
        padding: 14px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 12px;
        font-size: 0.9rem;
      }
      .chat-msg {
        display: flex;
        max-width: 85%;
      }
      .chat-msg.bot {
        align-self: flex-start;
      }
      .chat-msg.user {
        align-self: flex-end;
      }
      .msg-bubble {
        padding: 10px 14px;
        border-radius: 14px;
        line-height: 1.45;
        word-break: break-word;
        position: relative;
      }
      .msg-speak-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 22px;
        height: 22px;
        margin-left: 6px;
        border: none;
        background: rgba(16, 185, 129, 0.15);
        border-radius: 50%;
        cursor: pointer;
        font-size: 0.75rem;
        vertical-align: middle;
      }
      .msg-speak-btn.listening {
        background: #10b981;
        animation: pulseRecord 1s infinite alternate;
      }
      @media (max-width: 600px) {
        .chat-drawer {
          width: calc(100vw - 20px);
          right: 10px;
          bottom: 80px;
          height: 70vh;
        }
        .chat-launcher {
          right: 14px;
          bottom: 14px;
          padding: 10px 16px;
        }
        .chat-launcher .chat-label { display: none; }
      }
      .chat-msg.bot .msg-bubble {
        background: #f3f4f6;
        color: #1f2937;
        border-bottom-left-radius: 4px;
        border: 1px solid #e5e7eb;
      }
      .chat-msg.user .msg-bubble {
        background: #10b981;
        color: white;
        border-bottom-right-radius: 4px;
      }
      .chat-input-area {
        display: flex;
        padding: 10px 12px;
        background: white;
        border-top: 1px solid #e5e7eb;
        gap: 8px;
        align-items: center;
      }
      #chat-user-input {
        flex: 1;
        padding: 10px 14px;
        border: 1.5px solid #d1d5db;
        border-radius: 20px;
        font-size: 0.9rem;
        outline: none;
      }
      #chat-user-input:focus {
        border-color: #10b981;
      }
      .chat-action-btn {
        width: 38px;
        height: 38px;
        border-radius: 50%;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1rem;
        transition: transform 0.2s ease;
      }
      .chat-action-btn:hover {
        transform: scale(1.08);
      }
      .mic-btn {
        background: #fef2f2;
        color: #ef4444;
        border: 1px solid #fca5a5;
      }
      .mic-btn.listening {
        background: #ef4444;
        color: white;
        animation: pulseRecord 1s infinite alternate;
      }
      @keyframes pulseRecord {
        from { transform: scale(1); }
        to { transform: scale(1.15); }
      }
      .send-btn {
        background: #10b981;
        color: white;
      }
    `;
    document.head.appendChild(style);
  }

  toggle() {
    this.isOpen = !this.isOpen;
    const drawer = document.getElementById('chaya-chat-drawer');
    drawer.style.display = this.isOpen ? 'flex' : 'none';
    if (this.isOpen) {
      document.getElementById('chat-user-input').focus();
    }
  }

  handleKey(e) {
    if (e.key === 'Enter') {
      this.sendMessage();
    }
  }

  sendPreset(text) {
    document.getElementById('chat-user-input').value = text;
    this.sendMessage();
  }

  async sendMessage() {
    const input = document.getElementById('chat-user-input');
    const text = input.value.trim();
    if (!text) return;

    this.appendMessage('user', text);
    input.value = '';

    const messagesBox = document.getElementById('chat-messages');
    const t = this.getTranslations()[this.lang];
    
    // Add typing indicator
    const typingElem = document.createElement('div');
    typingElem.className = 'chat-msg bot typing-ind';
    typingElem.innerHTML = `<div class="msg-bubble" style="font-style:italic; color:#6b7280;">${t.thinking}</div>`;
    messagesBox.appendChild(typingElem);
    messagesBox.scrollTop = messagesBox.scrollHeight;

    // Get current farm context from localStorage
    const savedData = localStorage.getItem('chayaFormData');
    const farmContext = savedData ? JSON.parse(savedData) : {
      taluka: 'ardhapur',
      water: 'मुबलक पाणी',
      land: '2'
    };

    if (!window.chayaAI.isLoaded) {
      await window.chayaAI.loadKnowledgeBase();
    }

    const reply = await window.chayaAI.handleChatMessage(text, farmContext, this.lang);
    
    typingElem.remove();
    this.appendMessage('bot', reply);
  }

  appendMessage(sender, text) {
    const messagesBox = document.getElementById('chat-messages');
    const msgElem = document.createElement('div');
    msgElem.className = `chat-msg ${sender}`;

    // Format markdown bold, lists and line breaks
    let formatted = text
      .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
      .replace(/\n/g, '<br>')
      .replace(/- /g, '• ');

    const speakBtnHtml = sender === 'bot'
      ? `<button class="msg-speak-btn" onclick="window.chayaChat.speakMessage(this, ${JSON.stringify(text).replace(/"/g, '&quot;')})">🔊</button>`
      : '';

    msgElem.innerHTML = `<div class="msg-bubble">${formatted}${speakBtnHtml}</div>`;
    messagesBox.appendChild(msgElem);
    messagesBox.scrollTop = messagesBox.scrollHeight;
  }

  speakMessage(btnEl, text) {
    btnEl.classList.add('listening');
    window.chayaAI.speak(text, {
      lang: this.lang,
      onEnd: () => btnEl.classList.remove('listening'),
      onError: () => btnEl.classList.remove('listening')
    });
  }

  startVoiceInput() {
    const micBtn = document.getElementById('chat-mic-btn');
    const input = document.getElementById('chat-user-input');
    const t = this.getTranslations()[this.lang];

    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert(t.voiceUnsupported);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = this.lang === 'mr' ? 'mr-IN' : 'en-IN';
    recognition.continuous = false;
    recognition.interimResults = false;

    micBtn.classList.add('listening');

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      input.value = transcript;
      micBtn.classList.remove('listening');
      this.sendMessage();
    };

    recognition.onerror = () => {
      micBtn.classList.remove('listening');
    };

    recognition.onend = () => {
      micBtn.classList.remove('listening');
    };

    recognition.start();
  }
}

// Auto instantiate when page loads
document.addEventListener('DOMContentLoaded', () => {
  window.chayaChat = new ChayaChatWidget();
});
