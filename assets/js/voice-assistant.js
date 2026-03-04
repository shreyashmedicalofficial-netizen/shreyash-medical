import { db, ref, get, child, auth, push, update } from './firebase-config.js';

class VoiceAssistant {
    constructor() {
        this.overlay = null;
        this.fab = null;
        this.recognition = null;
        this.synth = window.speechSynthesis;
        this.isListening = false;
        this.transcriptEl = null;
        this.statusEl = null;

        this.init();
    }

    init() {
        this.injectStyles();
        this.createUI();
        this.setupSpeechDocs();

        // Auto-close overlay on Click Outside (optional, but good UX)
        // this.overlay.addEventListener('click', (e) => {
        //    if (e.target === this.overlay) this.closeOverlay();
        // });
    }

    injectStyles() {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        let cssPath = 'assets/css/voice-assistant.css';
        if (window.location.pathname.includes('/admin/')) {
            cssPath = '../assets/css/voice-assistant.css';
        }
        link.href = cssPath;
        document.head.appendChild(link);
    }

    createUI() {
        // 1. Create Floating Action Button
        this.fab = document.createElement('div');
        this.fab.id = 'voice-assistant-fab';
        this.fab.innerHTML = '<i class="fas fa-microphone"></i>';
        this.fab.onclick = () => this.openOverlay();
        document.body.appendChild(this.fab);

        // 2. Create Overlay
        this.overlay = document.createElement('div');
        this.overlay.className = 'voice-overlay';
        this.overlay.innerHTML = `
            <button class="voice-close-btn"><i class="fas fa-times"></i></button>
            <div class="voice-status">Ready to listen</div>
            
            <div class="voice-visualizer">
                <i class="fas fa-microphone"></i>
            </div>
            
            <div class="voice-transcript">Tap microphone to start</div>
            
            <div id="voice-result-container"></div>
        `;
        document.body.appendChild(this.overlay);

        // References
        this.transcriptEl = this.overlay.querySelector('.voice-transcript');
        this.statusEl = this.overlay.querySelector('.voice-status');
        this.visualizer = this.overlay.querySelector('.voice-visualizer');
        this.resultContainer = this.overlay.querySelector('#voice-result-container');

        // Listeners
        this.overlay.querySelector('.voice-close-btn').onclick = () => this.closeOverlay();
        this.visualizer.onclick = () => this.toggleListening();
    }

    setupSpeechDocs() {
        if ('webkitSpeechRecognition' in window) {
            this.recognition = new webkitSpeechRecognition();
            this.recognition.continuous = false;
            this.recognition.lang = 'en-US';
            this.recognition.interimResults = true;

            this.recognition.onstart = () => {
                this.isListening = true;
                this.updateUIState('listening');
            };

            this.recognition.onend = () => {
                this.isListening = false;
                this.updateUIState('idle');
            };

            this.recognition.onresult = (event) => {
                let finalTranscript = '';
                let interimTranscript = '';

                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript;
                    } else {
                        interimTranscript += event.results[i][0].transcript;
                    }
                }

                if (interimTranscript) {
                    this.transcriptEl.textContent = interimTranscript;
                }

                if (finalTranscript) {
                    this.transcriptEl.textContent = finalTranscript;
                    this.processCommand(finalTranscript);
                }
            };

            this.recognition.onerror = (event) => {
                console.error("Voice Error", event.error);

                // Handle common "no-speech" case more gracefully so the user
                // just sees a friendly prompt instead of a hard error.
                if (event.error === 'no-speech') {
                    this.statusEl.textContent = "I didn't hear anything. Please speak clearly near the mic.";
                    this.updateUIState('idle');
                    // Keep the overlay open and let the user tap the mic again.
                    return;
                }

                this.statusEl.textContent = "Error: " + event.error;
                this.updateUIState('idle');
            };
        } else {
            console.warn("Web Speech API not supported");
            this.fab.style.display = 'none';
        }
    }

    openOverlay() {
        this.overlay.classList.add('active');
        this.startListening();
    }

    closeOverlay() {
        this.overlay.classList.remove('active');
        this.stopListening();
        this.resetUI();
    }

    toggleListening() {
        if (this.isListening) {
            this.stopListening();
        } else {
            this.startListening();
        }
    }

    startListening() {
        if (this.recognition) {
            this.resultContainer.innerHTML = ''; // Clear previous results
            this.recognition.start();
        }
    }

    stopListening() {
        if (this.recognition) {
            this.recognition.stop();
        }
    }

    updateUIState(state) {
        if (state === 'listening') {
            this.visualizer.classList.add('listening');
            this.visualizer.classList.remove('processing');
            this.visualizer.innerHTML = '<i class="fas fa-microphone-alt"></i>';
            this.statusEl.textContent = "Listening...";
        } else if (state === 'processing') {
            this.visualizer.classList.remove('listening');
            this.visualizer.classList.add('processing');
            this.visualizer.innerHTML = '<i class="fas fa-cog"></i>';
            this.statusEl.textContent = "Processing...";
        } else {
            this.visualizer.classList.remove('listening');
            this.visualizer.classList.remove('processing');
            this.visualizer.innerHTML = '<i class="fas fa-microphone"></i>';
            // Status might be set by processCommand
        }
    }

    resetUI() {
        this.transcriptEl.textContent = "Tap microphone to start";
        this.statusEl.textContent = "Ready";
        this.resultContainer.innerHTML = '';
    }

    speak(text) {
        if (this.synth) {
            this.synth.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            const voices = this.synth.getVoices();
            const preferred = voices.find(v => v.name.includes('Google US English') || v.name.includes('Samantha'));
            if (preferred) utterance.voice = preferred;
            this.synth.speak(utterance);
        }
    }

    async processCommand(text) {
        this.updateUIState('processing');
        const lower = text.toLowerCase();

        // 1. PRICE CHECK
        if (lower.includes('price') || lower.includes('cost') || lower.includes('how much')) {
            const query = lower.replace(/\b(what|is|the|price|cost|of|check|for|how|much)\b/g, '').trim().replace(/\s+/g, ' ');
            if (query) {
                await this.handlePriceCheck(query);
                return;
            }
        }

        // 3. PLACE ORDER (Put this before Add to Cart so "place order" works without product)
        if (lower.match(/\b(place order|checkout)\b/)) {
            this.speak("Proceeding to checkout.");
            this.statusEl.textContent = "Redirecting...";
            setTimeout(() => window.location.href = 'checkout.html', 1500);
            return;
        }

        // 2. ADD TO CART
        if (lower.includes('add') || lower.includes('buy') || lower.includes('cart')) {
            const query = lower.replace(/\b(add|to|my|cart|the|please|buy|order|i|want|some)\b/g, '').trim().replace(/\s+/g, ' ');
            if (query) {
                await this.handleAddToCart(query);
                return;
            }
        }

        // 4. NAVIGATION
        if (lower.includes('go to') || lower.includes('open')) {
            if (lower.includes('orders')) {
                this.speak("Opening your orders.");
                window.location.href = 'my_orders.html';
                return;
            }
            if (lower.includes('profile')) {
                this.speak("Opening your profile.");
                window.location.href = 'profile.html';
                return;
            }
            if (lower.includes('home')) {
                this.speak("Going home.");
                window.location.href = 'index.html';
                return;
            }
        }

        // 5. SEARCH INTENT
        if (lower.includes('search') || lower.includes('find') || lower.includes('looking for')) {
            const query = lower.replace(/\b(search|for|find|i|am|looking)\b/g, '').trim().replace(/\s+/g, ' ');
            if (query) {
                await this.handlePriceCheck(query);
                return;
            }
        }

        // DEFAULT FALLBACK: Try finding the product directly even if no action word was used
        const product = await this.findProduct(lower);
        if (product) {
            this.updateUIState('idle');
            this.speak(`Here is ${product.name}. It costs ${product.price} rupees.`);
            this.statusEl.textContent = "Here is what I found:";
            this.renderResultCard(product);
            return;
        }

        // NO MATCH FOUND AT ALL
        this.speak("I didn't quite catch that. Try asking for a price, adding to cart, or saying a medicine name.");
        this.statusEl.textContent = "Command not recognized.";
        this.updateUIState('idle');
    }

    async handlePriceCheck(query) {
        const product = await this.findProduct(query);
        this.updateUIState('idle');

        if (product) {
            this.speak(`${product.name} is available for ${product.price} rupees.`);
            this.statusEl.textContent = "Here is what I found:";
            this.renderResultCard(product);
        } else {
            this.speak(`Sorry, I couldn't find any product named ${query}.`);
            this.statusEl.textContent = "Not found.";
        }
    }

    async handleAddToCart(query) {
        this.statusEl.textContent = "Searching...";
        const product = await this.findProduct(query);

        if (product) {
            this.updateUIState('idle');
            // Check Auth
            const user = auth.currentUser;
            if (!user) {
                this.speak("Please login to add items to cart.");
                this.statusEl.textContent = "Login Required";
                return;
            }

            // Add to DB
            const cartRef = child(ref(db), `users/${user.uid}/cart/${product.id}`);
            const snapshot = await get(cartRef);
            let currentQty = 0;
            if (snapshot.exists()) currentQty = snapshot.val().quantity;

            await update(cartRef, {
                quantity: currentQty + 1,
                ...product // cache product details
            });

            this.speak(`Added ${product.name} to your cart.`);
            this.statusEl.textContent = "Added to Cart";
            this.renderResultCard(product, true); // Show "Added" state

        } else {
            this.updateUIState('idle');
            this.speak(`Could not find ${query} to add.`);
            this.statusEl.textContent = "Product not found.";
        }
    }

    async findProduct(query) {
        try {
            const snapshot = await get(ref(db, 'products'));
            if (!snapshot.exists()) {
                console.warn('VoiceAssistant: no products found in Firebase "products" node.');
                return null;
            }

            const products = [];
            snapshot.forEach(child => products.push({ id: child.key, ...child.val() }));

            const normalizedQuery = query.toLowerCase().trim();
            if (!normalizedQuery) return null;

            // ALIGNMENT WITH products.html SEARCH:
            // products.html (via app.js loadProducts) filters as:
            // p.name.toLowerCase().includes(search) || p.description.toLowerCase().includes(search)
            // We'll mirror that logic here so voice results match the catalogue.

            const q = normalizedQuery;

            // 1. Try full-string match on name or description
            const directMatches = products.filter(p => {
                const name = (p.name || '').toLowerCase();
                const desc = (p.description || '').toLowerCase();
                return name.includes(q) || desc.includes(q);
            });
            if (directMatches.length > 0) {
                return directMatches[0];
            }

            // 2. If nothing matched, try individual words (excluding very short ones)
            const words = q
                .replace(/[^a-z0-9\s]+/g, ' ')
                .split(/\s+/)
                .filter(w => w.length >= 3);

            for (const word of words) {
                const wMatches = products.filter(p => {
                    const name = (p.name || '').toLowerCase();
                    const desc = (p.description || '').toLowerCase();
                    return name.includes(word) || desc.includes(word);
                });
                if (wMatches.length > 0) {
                    return wMatches[0];
                }
            }

            return null;
        } catch (e) {
            console.error("DB Error", e);
            return null;
        }
    }

    renderResultCard(product, added = false) {
        const card = document.createElement('div');
        card.className = 'voice-result-card';
        card.innerHTML = `
            <img src="${product.image || 'https://via.placeholder.com/80'}" class="voice-product-img">
            <div class="voice-product-info">
                <h3>${product.name}</h3>
                <span class="voice-product-price">₹${product.price}</span>
                ${added ? '<span class="badge bg-success">Added to Cart <i class="fas fa-check"></i></span>' :
                `<button class="voice-action-btn" onclick="window.location.href='product_details.html?id=${product.id}'">View Details</button>`}
            </div>
        `;
        this.resultContainer.innerHTML = '';
        this.resultContainer.appendChild(card);

        // Trigger animation
        setTimeout(() => card.classList.add('show'), 100);
    }
}

// Initialize
if (document.body) {
    new VoiceAssistant();
} else {
    document.addEventListener('DOMContentLoaded', () => {
        new VoiceAssistant();
    });
}
