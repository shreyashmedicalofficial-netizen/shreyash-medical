import { db, ref, get } from '../../../assets/js/firebase-config.js';

export function initChatbot() {
    // 1. Inject HTML
    const chatbotHTML = `
        <div id="adminChatbot" class="admin-chatbot-widget">
            <button id="chatbotToggle" class="chatbot-toggle-btn shadow-lg">
                <i class="fas fa-robot"></i>
            </button>
            <div id="chatbotWindow" class="chatbot-window shadow-lg d-none">
                <div class="chatbot-header">
                    <div class="d-flex align-items-center gap-2">
                        <div class="bg-white text-primary rounded-circle p-1 d-flex align-items-center justify-content-center" style="width: 32px; height: 32px;">
                            <i class="fas fa-robot"></i>
                        </div>
                        <h6 class="mb-0 fw-bold text-white">Admin Assistant</h6>
                    </div>
                    <button id="chatbotClose" class="btn btn-sm text-white-50 p-0"><i class="fas fa-times"></i></button>
                </div>
                <div id="chatbotMessages" class="chatbot-messages p-3">
                    <div class="chat-message bot">
                        <div class="message-content">
                            Hello Admin! 👋 How can I help you manage the store today?
                        </div>
                    </div>
                </div>
                <div class="chatbot-input-area p-3 border-top bg-light">
                    <div class="input-group">
                        <input type="text" id="chatInput" class="form-control border-0 shadow-sm" placeholder="Ask me something..." autocomplete="off">
                        <button id="chatSendBtn" class="btn btn-primary-custom shadow-sm"><i class="fas fa-paper-plane"></i></button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', chatbotHTML);

    // 2. Event Listeners
    const toggleBtn = document.getElementById('chatbotToggle');
    const closeBtn = document.getElementById('chatbotClose');
    const windowEl = document.getElementById('chatbotWindow');
    const sendBtn = document.getElementById('chatSendBtn');
    const inputEl = document.getElementById('chatInput');
    const messagesEl = document.getElementById('chatbotMessages');

    function toggleChat() {
        windowEl.classList.toggle('d-none');
        if (!windowEl.classList.contains('d-none')) {
            inputEl.focus();
        }
    }

    toggleBtn.addEventListener('click', toggleChat);
    closeBtn.addEventListener('click', toggleChat);

    async function handleUserMessage() {
        const text = inputEl.value.trim();
        if (!text) return;

        // User Message
        appendMessage('user', text);
        inputEl.value = '';

        // Bot Logic
        showTyping();
        const response = await processCommand(text);
        hideTyping();
        appendMessage('bot', response);
    }

    sendBtn.addEventListener('click', handleUserMessage);
    inputEl.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleUserMessage();
    });

    function appendMessage(sender, text) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `chat-message ${sender} mb-3`;
        msgDiv.innerHTML = `<div class="message-content shadow-sm">${text}</div>`;
        messagesEl.appendChild(msgDiv);
        messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function showTyping() {
        const typingDiv = document.createElement('div');
        typingDiv.id = 'typingIndicator';
        typingDiv.className = 'chat-message bot mb-3';
        typingDiv.innerHTML = `<div class="message-content text-muted small"><i class="fas fa-circle-notch fa-spin me-1"></i> Thinking...</div>`;
        messagesEl.appendChild(typingDiv);
        messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function hideTyping() {
        const el = document.getElementById('typingIndicator');
        if (el) el.remove();
    }
}

// 3. Logic Processor
async function processCommand(text) {
    const lowerText = text.toLowerCase();

    // Navigation
    if (lowerText.includes('order') || lowerText.includes('sales')) {
        if (lowerText.includes('go') || lowerText.includes('show') || lowerText.includes('open')) {
            setTimeout(() => window.location.href = 'orders.html', 1000);
            return "Navigating to Orders page... 🚀";
        }
        return "You can manage orders in the <a href='orders.html'>Orders Section</a>.";
    }

    if (lowerText.includes('inventory') || lowerText.includes('product') || lowerText.includes('stock')) {
        if (lowerText.includes('go') || lowerText.includes('show') || lowerText.includes('open')) {
            setTimeout(() => window.location.href = 'inventory.html', 1000);
            return "Opening Inventory... 📦";
        }
        return "Check out your <a href='inventory.html'>Inventory here</a>.";
    }

    if (lowerText.includes('dashboard') || lowerText.includes('home')) {
        setTimeout(() => window.location.href = 'index.html', 1000);
        return "Going back to Dashboard... 🏠";
    }

    if (lowerText.includes('blog') || lowerText.includes('news')) {
        setTimeout(() => window.location.href = 'blogs.html', 1000);
        return "Opening Blog Management... ✍️";
    }

    // Stats (Real Data Fetch)
    if (lowerText.includes('how many orders') || lowerText.includes('total orders')) {
        try {
            const snapshot = await get(ref(db, 'orders'));
            const count = snapshot.exists() ? Object.keys(snapshot.val()).length : 0;
            return `We have a total of <b>${count} orders</b> in the system. 📊`;
        } catch (e) { return "I couldn't fetch that data right now."; }
    }

    if (lowerText.includes('how many products') || lowerText.includes('total products')) {
        try {
            const snapshot = await get(ref(db, 'products'));
            const count = snapshot.exists() ? Object.keys(snapshot.val()).length : 0;
            return `There are currently <b>${count} products</b> in your inventory. 💊`;
        } catch (e) { return "I couldn't fetch the product count."; }
    }

    if (lowerText.includes('revenue') || lowerText.includes('sales')) {
        // Simple visual response, real calculation is heavier
        return "You can see the detailed revenue breakdown on the <a href='reports.html'>Reports Page</a>. 📈";
    }

    // Greeting / General
    if (lowerText.includes('hello') || lowerText.includes('hi') || lowerText.includes('hey')) {
        return "Hello! I am your Admin Assistant. You can ask me to navigate pages or show simple stats.";
    }

    if (lowerText.includes('help')) {
        return `
        <b>Try asking:</b><br>
        - "Go to orders"<br>
        - "Show me inventory"<br>
        - "How many products?"<br>
        - "Total orders?"<br>
        - "Go to dashboard"
        `;
    }

    return "I'm not sure about that. Try asking for 'help' or say 'Go to orders'.";
}
