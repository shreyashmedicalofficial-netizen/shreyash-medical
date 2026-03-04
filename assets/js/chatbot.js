import { db, ref, get, child, set, update, auth } from './firebase-config.js';

class MedicoChatbot {
    constructor() {
        this.isOpen = false;
        this.container = null;
        this.messagesContainer = null;
        this.init();
    }

    init() {
        this.injectStyles();
        this.createUI();
        this.attachListeners();
        // Say hello after a brief delay if first visit
        setTimeout(() => {
            if (this.messagesContainer.children.length === 0) {
                this.addBotMessage("Hi there! 👋 I'm your Medico Assistant. How can I help you today?");
                this.showQuickActions();
            }
        }, 1000);
    }

    injectStyles() {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        // Robust header path
        let cssPath = 'assets/css/chatbot.css';
        if (window.location.pathname.includes('/admin/')) {
            cssPath = '../assets/css/chatbot.css';
        }
        link.href = cssPath;
        document.head.appendChild(link);
    }

    createUI() {
        this.container = document.createElement('div');
        this.container.className = 'chatbot-container';

        this.container.innerHTML = `
            <div class="chatbot-window">
                <div class="chatbot-header">
                    <div class="bot-info">
                        <div class="bot-avatar"><i class="fas fa-robot"></i></div>
                        <div>
                            <div class="fw-bold">Medico AI</div>
                            <div class="bot-status"><div class="status-dot"></div> Online</div>
                        </div>
                    </div>
                    <button class="btn btn-sm text-white" id="close-chat"><i class="fas fa-times"></i></button>
                </div>
                <div class="chatbot-messages"></div>
                <div class="chatbot-input-area">
                    <input type="text" class="chatbot-input" placeholder="Type a message...">
                    <button class="chatbot-send-btn"><i class="fas fa-paper-plane"></i></button>
                </div>
            </div>

            <div class="chatbot-launcher">
                <i class="fas fa-comment-dots"></i>
            </div>
        `;

        document.body.appendChild(this.container);
        this.messagesContainer = this.container.querySelector('.chatbot-messages');
    }

    attachListeners() {
        const launcher = this.container.querySelector('.chatbot-launcher');
        const closeBtn = this.container.querySelector('#close-chat');
        const sendBtn = this.container.querySelector('.chatbot-send-btn');
        const input = this.container.querySelector('.chatbot-input');
        const window = this.container.querySelector('.chatbot-window');

        // Toggle Chat
        const toggleChat = (forceOpen = false) => {
            if (forceOpen) {
                this.isOpen = true;
            } else {
                this.isOpen = !this.isOpen;
            }
            window.classList.toggle('active', this.isOpen);
            launcher.style.transform = this.isOpen ? 'scale(0)' : 'scale(1)';
        };

        this.toggleChat = toggleChat;

        launcher.addEventListener('click', () => toggleChat());
        closeBtn.addEventListener('click', () => toggleChat());

        // Send Message
        const sendMessage = () => {
            const text = input.value.trim();
            if (text) {
                this.addUserMessage(text);
                input.value = '';
                this.processInput(text);
            }
        };

        sendBtn.addEventListener('click', sendMessage);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
    }

    addUserMessage(text) {
        const div = document.createElement('div');
        div.className = 'message user';
        div.textContent = text;
        this.messagesContainer.appendChild(div);
        this.scrollToBottom();
    }

    addBotMessage(htmlContent, isThinking = false) {
        const div = document.createElement('div');
        div.className = 'message bot';

        if (isThinking) {
            div.innerHTML = `
                <div class="typing-indicator">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
            `;
            div.id = 'thinking-bubble';
        } else {
            div.innerHTML = htmlContent;
        }

        this.messagesContainer.appendChild(div);
        this.scrollToBottom();
        return div;
    }

    removeThinking() {
        const bubble = this.messagesContainer.querySelector('#thinking-bubble');
        if (bubble) bubble.remove();
    }

    scrollToBottom() {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    showQuickActions() {
        const div = document.createElement('div');
        div.className = 'quick-actions message bot bg-transparent p-0';
        div.innerHTML = `
            <span class="action-chip" data-action="track_order">📦 Track Order</span>
            <span class="action-chip" data-action="upload_rx">📄 Upload RX</span>
            <span class="action-chip" data-action="browse_products">💊 Browse</span>
        `;
        this.messagesContainer.appendChild(div);

        div.querySelectorAll('.action-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const action = chip.dataset.action;
                if (action === 'track_order') this.handleTrackOrder();
                if (action === 'upload_rx') window.location.href = 'prescription.html';
                if (action === 'browse_products') window.location.href = 'products.html';
            });
        });

        this.scrollToBottom();
    }

    async processInput(text) {
        this.addBotMessage(null, true);
        await new Promise(r => setTimeout(r, 600));
        this.removeThinking();

        const lowerText = text.toLowerCase();

        // 1. GREETINGS
        if (lowerText.match(/hi|hello|hey|start/)) {
            this.addBotMessage("Hello! How can I assist you today?");
            this.showQuickActions();
            return;
        }

        // 2. SEARCH & PRICE
        if (lowerText.includes('search') || lowerText.includes('find') || lowerText.includes('buy') || lowerText.includes('have') || lowerText.includes('price') || lowerText.includes('cost')) {
            const query = lowerText.replace(/search|find|buy|do you have|for|what is the|price of|cost of/g, '').trim();
            if (query.length > 2) {
                await this.searchProduct(query);
            } else {
                this.addBotMessage("Please tell me the name of the medicine you are looking for.");
            }
            return;
        }

        // 3. TRACK ORDER
        if (lowerText.includes('order') || lowerText.includes('track') || lowerText.includes('status')) {
            await this.handleTrackOrder();
            return;
        }

        // 4. PRESCRIPTION
        if (lowerText.includes('prescription') || lowerText.includes('upload')) {
            this.addBotMessage(`You can upload your prescription <a href="prescription.html" class="fw-bold">here</a>.`);
            return;
        }

        // 5. CONTACT
        if (lowerText.includes('contact') || lowerText.includes('support') || lowerText.includes('call')) {
            this.addBotMessage(`You can reach our support team at <a href="tel:+917385057922">+91 73850 57922</a>.`);
            return;
        }

        // Default
        this.addBotMessage("I'm not sure I understand. Try asking for a medicine (e.g., 'Search Paracetamol').");
    }

    async searchProduct(query) {
        try {
            const snapshot = await get(ref(db, 'products'));
            if (snapshot.exists()) {
                const products = [];
                snapshot.forEach(child => products.push({ id: child.key, ...child.val() }));

                const matches = products.filter(p => p.name.toLowerCase().includes(query));

                if (matches.length > 0) {
                    const count = matches.length;

                    this.addBotMessage(`I found ${count} matches for "<b>${query}</b>":`);

                    matches.slice(0, 3).forEach(p => {
                        const card = document.createElement('div');
                        card.className = 'chat-product-card';
                        card.innerHTML = `
                            <img src="${p.image || 'https://via.placeholder.com/50'}" class="chat-product-img">
                            <div class="chat-product-info">
                                <h6>${p.name}</h6>
                                <span>₹${p.price}</span>
                            </div>
                        `;
                        card.onclick = () => window.location.href = `product_details.html?id=${p.id}`;
                        this.messagesContainer.appendChild(card);
                    });
                    this.scrollToBottom();

                    if (matches.length > 3) {
                        this.addBotMessage(`<a href="products.html?q=${query}">View all ${matches.length} results</a>`);
                    }
                } else {
                    const msg = `Sorry, I couldn't find any products matching "${query}".`;
                    this.addBotMessage(msg);
                }
            }
        } catch (e) {
            console.error("Chatbot Search Error", e);
            this.addBotMessage("I'm having trouble connecting to the store.");
        }
    }

    async handleTrackOrder() {
        const user = auth.currentUser;
        if (!user) {
            this.addBotMessage("Please <a href='login.html'>login</a> to track your orders.");
            return;
        }
        this.addBotMessage("You can view your full order history <a href='my_orders.html'>here</a>.");
    }
}

// Robust Initialization
if (document.body) {
    new MedicoChatbot();
} else {
    document.addEventListener('DOMContentLoaded', () => {
        new MedicoChatbot();
    });
}
