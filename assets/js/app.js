

import { auth, onAuthStateChanged, signOut, db, ref, get, child, set, update, remove, onValue, push, query, orderByChild, equalTo, limitToLast } from './firebase-config.js';
import './chatbot.js'; // Import Chatbot Widget
import './voice-assistant.js'; // Import Dedicated Voice Assistant

// Make Firebase functions available globally for Chatbot (since chatbot.js is a module and needs access)
window.db = db;
window.ref = ref;
window.get = get;
window.child = child;
window.auth = auth;

// Global State
let currentUser = null;
let userProfile = null;
let productsCache = {}; // Cache products to avoid repeated fetches
let isPlacingOrder = false; // Flag to prevent cart listener race condition during checkout

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Medico SaaS App Initializing...');

    // 1. Load Header and Footer
    await loadIncludes();

    // 2. Initialize Auth Listener
    initAuthListener();

    // 3. Initialize Page Specific Logic
    initPageLogic();

    // 4. Update Year in Footer
    updateYear();

    // 5. Global Event Listeners
    initGlobalEventListeners();
});

async function loadIncludes() {
    try {
        const headerRes = await fetch('includes/header.html');
        const headerHtml = await headerRes.text();
        document.getElementById('header-container').innerHTML = headerHtml;

        const footerRes = await fetch('includes/footer.html');
        const footerHtml = await footerRes.text();
        document.getElementById('footer-container').innerHTML = footerHtml;

        // Re-initialize Bootstrap components after injection
        initBootstrapComponents();

        // Sticky Header Logic
        initStickyHeader();

        // Location Picker Logic
        const locPicker = document.querySelector('.location-picker');
        if (locPicker) {
            // Remove inline onclick if exists to avoid double alert, or just add listener
            // unique listener
            locPicker.onclick = null; // Clean inline
            locPicker.addEventListener('click', () => {
                alert('Only Kolhapur is currently available. Other cities coming soon.');
            });
        }

    } catch (error) {
        console.error('Error loading includes:', error);
    }
}

function initBootstrapComponents() {
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));
}

function initStickyHeader() {
    const navbar = document.getElementById('stickyHeader');
    const headerTop = document.querySelector('.header-top');

    if (navbar && headerTop) {
        // Calculate the threshold (height of top bar)
        // We use a small buffer or exact height
        const stickyPoint = headerTop.offsetHeight;

        window.addEventListener('scroll', () => {
            if (window.scrollY >= stickyPoint) {
                if (!navbar.classList.contains('navbar-fixed')) {
                    navbar.classList.add('navbar-fixed');
                    // Add padding to body to prevent content jump
                    document.body.style.paddingTop = navbar.offsetHeight + 'px';
                }
            } else {
                if (navbar.classList.contains('navbar-fixed')) {
                    navbar.classList.remove('navbar-fixed');
                    document.body.style.paddingTop = '0';
                }
            }
        });
    }
}

// Auth Promise for robust waiting
let authResolve;
const authReady = new Promise(resolve => authResolve = resolve);

async function waitForAuth() {
    await authReady;
    return currentUser;
}

function initAuthListener() {
    onAuthStateChanged(auth, async (user) => {
        currentUser = user;
        if (user) {
            console.log('User logged in:', user.uid);
            // Fetch User Profile from Realtime DB
            try {
                const snapshot = await get(child(ref(db), `users/${user.uid}`));
                if (snapshot.exists()) {
                    userProfile = snapshot.val();
                    updateHeaderAuthUI(user, userProfile);
                } else {
                    console.log("No user data available");
                    updateHeaderAuthUI(user, { fullname: user.email }); // Fallback
                }

                // Initialize Cart Listener
                initCartListener(user.uid);

            } catch (error) {
                console.error("Error fetching user data:", error);
            }
        } else {
            console.log('User logged out');
            userProfile = null;
            updateHeaderAuthUI(null, null);
            updateCartBadge(0);
        }

        // Resolve the auth promise (happens on first load whether logged in or not)
        if (authResolve) {
            authResolve(user);
            authResolve = null; // Ensure only called once if needed, though onAuthStateChanged fires multiple times
        }
    });
}

async function loadCheckout() {
    const container = document.getElementById('checkout-container');
    if (!container) return;

    // Wait for Auth to Initialize
    await waitForAuth();

    if (!currentUser) {
        window.location.href = 'login.html?redirect=checkout.html';
        return;
    }

    try {
        const cartRef = child(ref(db), `users/${currentUser.uid}/cart`);
        const snapshot = await get(cartRef);

        if (!snapshot.exists()) {
            window.location.href = 'products.html';
            return;
        }

        const cartData = snapshot.val();
        let finalPay = 0;
        let items = [];

        const productIds = Object.keys(cartData);
        // Fetch products (this function already correctly handles cache)
        const products = await fetchProductsByIds(productIds);

        products.forEach(p => {
            const qty = cartData[p.id].qty;
            finalPay += p.price * qty;
            items.push({ ...p, qty, id: p.id });
        });

        const shipping = (finalPay > 500 || finalPay === 0) ? 0 : 50;
        const platformFee = 3;
        const totalAmount = finalPay + shipping + platformFee;

        renderCheckoutUI(container, { finalPay, shipping, platformFee, totalAmount }, items);

    } catch (e) {
        console.error(e);
        container.innerHTML = '<div class="alert alert-danger">Error loading checkout.</div>';
    }
}

function renderCheckoutUI(container, totals, items) {
    const userProfile = window.userProfile || {};

    // Generate Items HTML
    let itemsHtml = '';
    items.forEach(item => {
        const imgSrc = item.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name)}&background=random&color=fff&size=60`;
        itemsHtml += `
            <div class="d-flex align-items-center gap-3 mb-3 border-bottom pb-3 last-border-0">
                <div class="position-relative">
                    <img src="${imgSrc}" class="rounded-3 border" width="60" height="60" style="object-fit: cover;">
                    <span class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-secondary text-white small" style="font-size: 0.65rem;">${item.qty}</span>
                </div>
                <div class="flex-grow-1">
                    <h6 class="fw-bold mb-0 small text-truncate" style="max-width: 180px;">${item.name}</h6>
                    <small class="text-muted">₹${item.price} x ${item.qty}</small>
                </div>
                <div class="text-end">
                    <h6 class="fw-bold mb-0 small">₹${item.price * item.qty}</h6>
                </div>
            </div>
        `;
    });

    container.innerHTML = `
        <div class="col-lg-8">
            <!-- Items In Cart (New Section) -->
            <div class="card border-0 shadow-sm rounded-4 mb-4">
                 <div class="card-header bg-white border-bottom p-4">
                    <div class="d-flex align-items-center">
                        <div class="bg-secondary text-white rounded-circle d-flex align-items-center justify-content-center me-3 fs-6" style="width: 28px; height: 28px;">1</div>
                        <h5 class="fw-bold mb-0 text-dark">Order Items (${items.length})</h5>
                    </div>
                </div>
                <div class="card-body p-4">
                    ${itemsHtml}
                </div>
            </div>

            <!-- Delivery Address -->
            <div class="card border-0 shadow-sm rounded-4 mb-4">
                <div class="card-header bg-white border-bottom p-4">
                    <div class="d-flex align-items-center">
                        <div class="bg-primary-custom text-white rounded-circle d-flex align-items-center justify-content-center me-3 fs-6" style="width: 28px; height: 28px;">2</div>
                        <h5 class="fw-bold mb-0 text-dark">Delivery Address</h5>
                    </div>
                </div>
                <div class="card-body p-4">
                    <form id="checkout-form">
                        <div class="row g-3">
                            <div class="col-md-6">
                                <label class="form-label small fw-bold text-muted text-uppercase">Full Name</label>
                                <input type="text" id="full_name" class="form-control" required value="${userProfile.fullname || ''}">
                            </div>
                            <div class="col-md-6">
                                <label class="form-label small fw-bold text-muted text-uppercase">Mobile</label>
                                <input type="text" id="mobile" class="form-control" required value="${userProfile.phone || ''}">
                            </div>
                            <div class="col-12">
                                <label class="form-label small fw-bold text-muted text-uppercase">Address Line 1</label>
                                <input type="text" id="address_line1" class="form-control" required placeholder="House No, Building, Street">
                            </div>
                            <div class="col-12">
                                <label class="form-label small fw-bold text-muted text-uppercase">Address Line 2</label>
                                <input type="text" id="address_line2" class="form-control" required placeholder="Area, Colony, Landmark">
                            </div>
                            <div class="col-md-6">
                                <label class="form-label small fw-bold text-muted text-uppercase">City</label>
                                <input type="text" id="city" class="form-control" required value="Kolhapur">
                            </div>
                             <div class="col-md-6">
                                <label class="form-label small fw-bold text-muted text-uppercase">Pincode</label>
                                <input type="text" id="pincode" class="form-control" required>
                            </div>
                            <div class="col-12 mt-4">
                                <button type="submit" class="btn btn-primary-custom w-100 py-3 fw-bold shadow-sm">
                                    PLACE ORDER & PAY ₹${Math.round(totals.totalAmount)}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </div>
        <div class="col-lg-4">
            <div class="card border-0 shadow-sm rounded-4 sticky-top-custom" style="top: 100px;">
                <div class="card-header bg-white border-bottom p-4">
                    <h6 class="fw-bold mb-0 text-dark text-uppercase small">Order Summary</h6>
                </div>
                <div class="card-body p-4">
                    <div class="d-flex justify-content-between mb-2"><span class="text-muted small">Cart Value</span><span class="fw-bold small">₹${Math.round(totals.finalPay)}</span></div>
                    <div class="d-flex justify-content-between mb-2"><span class="text-muted small">Shipping</span><span class="fw-bold small text-success">${totals.shipping === 0 ? 'FREE' : '₹' + totals.shipping}</span></div>
                    <div class="d-flex justify-content-between mb-2"><span class="text-muted small">Platform Fee</span><span class="fw-bold small">₹${totals.platformFee}</span></div>
                    <hr>
                    <div class="d-flex justify-content-between mb-3"><span class="fw-bold fs-5">Total</span><span class="fw-bold fs-5 text-primary-custom">₹${Math.round(totals.totalAmount)}</span></div>

                    <div class="border rounded-3 p-3 bg-light mb-2">
                        <div class="fw-bold small text-uppercase text-muted mb-2">Payment Method</div>
                        <div class="form-check mb-1">
                            <input class="form-check-input" type="radio" name="payment_method" id="pay_upi" value="UPI_QR" checked>
                            <label class="form-check-label small" for="pay_upi">
                                UPI / QR Code Payment
                            </label>
                        </div>
                        <div class="form-check">
                            <input class="form-check-input" type="radio" name="payment_method" id="pay_cod" value="COD">
                            <label class="form-check-label small" for="pay_cod">
                                Cash on Delivery
                            </label>
                        </div>
                    </div>

                    <div class="mt-2 text-center">
                        <div class="small text-muted mb-2">Scan to pay (for online payments)</div>
                        <img src="assets/images/payment-qr.png" alt="Payment QR Code" style="max-width:140px;" class="img-fluid border rounded-3 bg-white p-1">
                    </div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('checkout-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        const originalText = btn.innerHTML;

        try {
            // Set flag to prevent cart listener from re-calling loadCheckout
            isPlacingOrder = true;
            btn.disabled = true;
            btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status"></span>Processing Order...`;

            const paymentRadio = document.querySelector('input[name="payment_method"]:checked');
            const paymentMethod = paymentRadio ? paymentRadio.value : 'COD';

            const orderData = {
                userId: currentUser.uid,
                items: items,
                shippingAddress: {
                    fullname: document.getElementById('full_name').value,
                    phone: document.getElementById('mobile').value,
                    address: document.getElementById('address_line1').value + ' ' + document.getElementById('address_line2').value,
                    city: document.getElementById('city').value,
                    zip: document.getElementById('pincode').value
                },
                status: 'Pending',
                totalAmount: totals.totalAmount,
                paymentMethod,
                createdAt: new Date().toISOString()
            };

            const newOrderRef = await push(child(ref(db), 'orders'), orderData);
            await set(child(ref(db), `users/${currentUser.uid}/cart`), null);

            // Show success state on button before redirect
            btn.innerHTML = `<i class="fas fa-check-circle me-2"></i>Order Placed! Redirecting...`;
            btn.classList.remove('btn-primary-custom');
            btn.classList.add('btn-success');

            // Redirect after brief delay for animation
            setTimeout(() => {
                window.location.href = `order_success.html?id=${newOrderRef.key}`;
            }, 800);
        } catch (err) {
            console.error(err);
            isPlacingOrder = false;
            alert('Failed to place order. Please try again.');
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    });
}

function updateHeaderAuthUI(user, profile) {
    const authSection = document.getElementById('auth-section');
    const mobileAuthHeader = document.getElementById('mobile-auth-header');
    const mobileUserLinks = document.getElementById('mobile-user-links');

    if (user && profile) {
        // Desktop Header
        const firstName = profile.fullname ? profile.fullname.split(' ')[0] : 'User';
        if (authSection) {
            authSection.innerHTML = `
                <div class="dropdown">
                    <a href="#" class="text-dark text-decoration-none d-flex align-items-center" data-bs-toggle="dropdown">
                        <div class="text-end me-3 d-none d-lg-block">
                            <span class="d-block text-muted text-uppercase fw-bold" style="font-size: 0.75rem; letter-spacing: 0.5px;">Hello,</span>
                            <span class="fw-bold text-dark" style="font-size: 1rem;">${firstName}</span>
                        </div>
                        <i class="fas fa-user-circle fa-2x text-primary-custom"></i>
                    </a>
                    <ul class="dropdown-menu dropdown-menu-end shadow border-0">
                        ${profile.role === 'admin' || profile.role === 'manager' ? '<li><a class="dropdown-item" href="admin/index.php">Dashboard</a></li>' : ''}
                        <li><a class="dropdown-item" href="my_orders.html">My Orders</a></li>
                        <li><a class="dropdown-item" href="profile.html">My Profile</a></li>
                        <li><hr class="dropdown-divider"></li>
                        <li><a class="dropdown-item text-danger" href="#" id="logout-btn">Logout</a></li>
                    </ul>
                </div>
            `;
        }

        // Mobile Header
        if (mobileAuthHeader) {
            mobileAuthHeader.innerHTML = `
                <div class="me-3">
                    <div class="bg-white rounded-circle d-flex align-items-center justify-content-center text-primary-custom fw-bold" style="width: 40px; height: 40px;">
                        ${firstName.charAt(0).toUpperCase()}
                    </div>
                </div>
                <div>
                    <h6 class="offcanvas-title mb-0" id="mobileMenuLabel">Hello, ${firstName}</h6>
                    <small class="opacity-75">Welcome back!</small>
                </div>
            `;
        }
        if (mobileUserLinks) mobileUserLinks.classList.remove('d-none');

        // Attach Logout Listeners
        document.getElementById('logout-btn')?.addEventListener('click', handleLogout);
        document.getElementById('mobile-logout-btn')?.addEventListener('click', handleLogout);

    } else {
        // Logged Out State
        if (authSection) {
            authSection.innerHTML = `
                <a href="login.html" class="text-dark text-decoration-none d-flex align-items-center">
                    <i class="far fa-user fa-lg me-2"></i>
                    <span class="d-none d-lg-inline fw-medium">Login</span>
                </a>
            `;
        }

        if (mobileAuthHeader) {
            mobileAuthHeader.innerHTML = `
                <div class="me-3">
                    <div class="bg-white rounded-circle d-flex align-items-center justify-content-center text-primary-custom fw-bold" style="width: 40px; height: 40px;">
                        <i class="fas fa-user"></i>
                    </div>
                </div>
                <div>
                    <h6 class="offcanvas-title mb-0" id="mobileMenuLabel">Welcome</h6>
                    <a href="login.html" class="text-white text-decoration-underline small">Login / Register</a>
                </div>
             `;
        }
        if (mobileUserLinks) mobileUserLinks.classList.add('d-none');
    }
}

async function handleLogout(e) {
    e.preventDefault();
    try {
        await signOut(auth);
        window.location.href = 'index.html';
    } catch (error) {
        console.error("Logout Error:", error);
    }
}

function updateYear() {
    const yearSpan = document.getElementById('current-year');
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }
}

function initGlobalEventListeners() {
    // Add to Cart Buttons
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.add-to-cart-btn');
        if (btn) {
            e.preventDefault();
            e.stopPropagation();
            const productId = btn.dataset.id;
            addToCart(productId);
        }
    });

    // Cart Item Controls
    document.addEventListener('click', (e) => {
        if (e.target.closest('.cart-qty-plus')) {
            const btn = e.target.closest('.cart-qty-plus');
            updateCartQty(btn.dataset.id, 1);
        }
        if (e.target.closest('.cart-qty-minus')) {
            const btn = e.target.closest('.cart-qty-minus');
            updateCartQty(btn.dataset.id, -1);
        }
        if (e.target.closest('.cart-remove')) {
            const btn = e.target.closest('.cart-remove');
            removeFromCart(btn.dataset.id);
        }
    });

    // Toggle Chatbot & Voice Assistant on Cart Open/Close
    const cartOffcanvas = document.getElementById('cartOffcanvas');
    if (cartOffcanvas) {
        cartOffcanvas.addEventListener('show.bs.offcanvas', () => {
            const chatbot = document.querySelector('.chatbot-container');
            const voiceFab = document.getElementById('voice-assistant-fab');
            if (chatbot) chatbot.style.display = 'none';
            if (voiceFab) voiceFab.style.display = 'none';
        });

        cartOffcanvas.addEventListener('hidden.bs.offcanvas', () => {
            const chatbot = document.querySelector('.chatbot-container');
            const voiceFab = document.getElementById('voice-assistant-fab');
            if (chatbot) chatbot.style.display = '';
            if (voiceFab) voiceFab.style.display = '';
        });
    }
}
/* --- Cart Logic --- */

function initCartListener(uid) {
    const cartRef = child(ref(db), `users/${uid}/cart`);
    onValue(cartRef, (snapshot) => {
        const cartData = snapshot.val() || {};
        const count = Object.keys(cartData).length;

        // Update Badge
        updateCartBadge(count);

        // Update Side Cart UI
        updateSideCartUI(cartData);

        // If on Cart Page, update main cart UI
        if (window.location.pathname.includes('cart.html')) {
            loadCartMainUI(cartData);
        }
        // If on Checkout Page (but not while placing order)
        if (window.location.pathname.includes('checkout.html') && !isPlacingOrder) {
            loadCheckout(); // Reload checkout to reflect changes
        }
    });
}

function updateCartBadge(count) {
    const badge = document.getElementById('cart-count-badge');
    if (badge) {
        badge.innerText = count;
        if (count > 0) badge.classList.remove('d-none');
        else badge.classList.add('d-none');
    }
}

async function addToCart(productId) {
    if (!currentUser) {
        alert("Please login to add items to cart.");
        window.location.href = 'login.html';
        return;
    }

    try {
        const itemRef = child(ref(db), `users/${currentUser.uid}/cart/${productId}`);
        const snapshot = await get(itemRef);

        if (snapshot.exists()) {
            // Increment
            const currentQty = snapshot.val().qty;
            await update(itemRef, { qty: currentQty + 1 });
            showToast("Quantity updated in cart!");
        } else {
            // Add new
            await set(itemRef, { qty: 1, addedAt: Date.now() });
            showToast("Item added to cart!");

            // Open Cart Offcanvas
            const cartOffcanvas = document.getElementById('cartOffcanvas');
            if (cartOffcanvas) {
                const bsOffcanvas = new bootstrap.Offcanvas(cartOffcanvas);
                bsOffcanvas.show();
            }
        }
    } catch (error) {
        console.error("Error adding to cart:", error);
        alert("Failed to add item to cart.");
    }
}

async function updateCartQty(productId, change) {
    if (!currentUser) return;

    try {
        const itemRef = child(ref(db), `users/${currentUser.uid}/cart/${productId}`);
        const snapshot = await get(itemRef);

        if (snapshot.exists()) {
            const currentQty = snapshot.val().qty;
            const newQty = currentQty + change;

            if (newQty <= 0) {
                removeFromCart(productId);
            } else {
                await update(itemRef, { qty: newQty });
            }
        }
    } catch (e) {
        console.error("Error updating cart:", e);
    }
}

async function removeFromCart(productId) {
    if (!currentUser) return;
    try {
        await remove(child(ref(db), `users/${currentUser.uid}/cart/${productId}`));
    } catch (e) {
        console.error("Error removing from cart:", e);
    }
}

// Fetch product details for a list of IDs
async function fetchProductsByIds(productIds) {
    const products = [];
    const promises = productIds.map(async (id) => {
        if (productsCache[id]) {
            products.push({ id, ...productsCache[id] });
        } else {
            const snap = await get(child(ref(db), `products/${id}`));
            if (snap.exists()) {
                const p = snap.val();
                productsCache[id] = p;
                products.push({ id, ...p });
            }
        }
    });
    await Promise.all(promises);
    return products;
}

async function updateSideCartUI(cartData) {
    const container = document.getElementById('cartOffcanvasBody');
    if (!container) return; // Might not be injected yet

    const productIds = Object.keys(cartData);
    if (productIds.length === 0) {
        container.innerHTML = `
            <div class="h-100 d-flex flex-column align-items-center justify-content-center text-center p-4">
                <i class="fas fa-shopping-basket fa-4x text-muted mb-3 opacity-25"></i>
                <h6 class="fw-bold text-muted">Your cart is empty</h6>
                <button class="btn btn-primary-custom mt-3 btn-sm" data-bs-dismiss="offcanvas">Start Shopping</button>
            </div>
        `;
        return;
    }

    container.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary-custom"></div></div>';

    const products = await fetchProductsByIds(productIds);
    let total = 0;

    let html = '<div class="p-3 bg-light overflow-auto flex-grow-1" style="max-height: calc(100vh - 200px);">';

    products.forEach(p => {
        const qty = cartData[p.id].qty;
        const price = p.price;
        total += price * qty;
        const imgSrc = p.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}&background=random&color=fff&size=60`;

        html += `
            <div class="card border-0 shadow-sm mb-3">
                <div class="card-body p-2 d-flex gap-3 align-items-center">
                    <img src="${imgSrc}" class="rounded-3" width="60" height="60" style="object-fit: cover;">
                    <div class="flex-grow-1">
                        <h6 class="fw-bold mb-0 text-truncate" style="max-width: 150px;">${p.name}</h6>
                        <small class="text-muted">₹${price} x ${qty}</small>
                    </div>
                    <div class="d-flex flex-column align-items-end">
                        <span class="fw-bold text-primary-custom">₹${price * qty}</span>
                         <div class="btn-group btn-group-sm mt-1">
                            <button class="btn btn-outline-secondary cart-qty-minus" data-id="${p.id}">-</button>
                            <button class="btn btn-outline-secondary cart-qty-plus" data-id="${p.id}">+</button>
                        </div>
                    </div>
                    <button class="btn btn-link text-danger p-0 ms-2 cart-remove" data-id="${p.id}"><i class="fas fa-trash-alt"></i></button>
                </div>
            </div>
        `;
    });

    html += '</div>';

    // Footer with Total and Checkout
    html += `
        <div class="p-3 border-top bg-white mt-auto">
             <div class="d-flex justify-content-between mb-3">
                <span class="fw-bold text-muted">Total Amount</span>
                <span class="fw-bold fs-5">₹${total}</span>
            </div>
            <a href="checkout.html" class="btn btn-primary-custom w-100 fw-bold py-2 shadow-sm">Proceed to Checkout</a>
            <a href="cart.html" class="btn btn-outline-secondary w-100 fw-bold py-2 mt-2">View Cart</a>
        </div>
    `;

    container.innerHTML = html;
}

// Functions involved in initialPageLogic
function initPageLogic() {
    // If on index.php, load products
    const path = window.location.pathname;
    const urlParams = new URLSearchParams(window.location.search);

    if (path.endsWith('index.html') || path.endsWith('/')) {
        loadTrendingProducts();
        loadNewArrivals();
    } else if (path.includes('product_details.html')) {
        const productId = urlParams.get('id');
        if (productId) {
            loadProductDetails(productId);
        } else {
            document.getElementById('product-details-container').innerHTML = '<div class="alert alert-danger">Product ID not found.</div>';
        }
    } else if (path.includes('cart.html')) {
        // Handled by initCartListener but we can trigger a manual check or UI init
    } else if (path.includes('checkout.html')) {
        loadCheckout();
    } else if (path.includes('my_orders.html')) {
        loadMyOrders();
    } else if (path.includes('products.html')) {
        loadProducts();
    } else if (path.includes('profile.html')) {
        loadProfile();
    } else if (path.includes('order_details.html')) {
        const orderId = urlParams.get('id');
        if (orderId) loadOrderDetails(orderId);
        else window.location.href = 'my_orders.html';
    } else if (path.includes('prescription.html')) {
        initPrescriptionLogic();
    } else if (path.includes('blogs.html')) {
        loadBlogs();
    } else if (path.includes('blog_details.html')) {
        const blogId = urlParams.get('id');
        if (blogId) loadBlogDetails(blogId);
        else window.location.href = 'blogs.html';
    }

    // Always try to load homepage blogs if element exists (for index or wherever included)
    if (document.getElementById('homepage-blog-list')) {
        loadHomepageBlogs();
    }
}

// Rest of the functions (loadTrendingProducts, loadProducts, etc)
// I need to include them or the file will be incomplete.
// I will copy them from the previous file content and insert them here.

async function loadTrendingProducts() {
    const container = document.getElementById('trending-products-container');
    if (!container) return;

    try {
        const snapshot = await get(ref(db, 'products'));
        if (snapshot.exists()) {
            const products = [];
            snapshot.forEach(childSnapshot => {
                products.push({ id: childSnapshot.key, ...childSnapshot.val() });
            });
            // Cache them
            products.forEach(p => productsCache[p.id] = p);

            // Render products (Limit to 6)
            renderProducts(products.slice(0, 6), container);
        } else {
            container.innerHTML = '<div class="col-12 text-center py-5"><p class="text-muted">No products found in database.</p></div>';
        }
    } catch (error) {
        console.error("Error loading products:", error);
        container.innerHTML = '<div class="col-12 text-center py-5"><p class="text-muted">Error loading products.</p></div>';
    }
}

async function loadNewArrivals() {
    const container = document.getElementById('new-arrivals-container');
    if (!container) return;

    try {
        // For now, fetching all and taking the last 4 (as "newest")
        // Ideally, use orderByChild('createdAt') if available
        const snapshot = await get(query(ref(db, 'products'), limitToLast(8))); // Get last 8
        if (snapshot.exists()) {
            let products = [];
            snapshot.forEach(childSnapshot => {
                products.push({ id: childSnapshot.key, ...childSnapshot.val() });
            });

            // Reverse to show newest first
            products.reverse();

            // Cache them
            products.forEach(p => productsCache[p.id] = p);

            // Render
            renderProducts(products.slice(0, 8), container);
        } else {
            container.innerHTML = '<div class="col-12 text-center py-5"><p class="text-muted">No new arrivals found.</p></div>';
        }
    } catch (error) {
        console.error("Error loading new arrivals:", error);
        container.innerHTML = '<div class="col-12 text-center py-5"><p class="text-muted">Error loading new arrivals.</p></div>';
    }
}

function renderProducts(products, container) {
    let html = '';
    products.forEach(tp => {
        try {
            const imgSrc = tp.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(tp.name || 'Product')}&background=random&color=fff&size=150`;
            const price = Number(tp.price) || 0;
            const discount = Number(tp.discount) || 0;
            const mrp = discount > 0 ? price * (1 + (discount / 100)) : price;

            html += `
            <div class="col-6 col-md-4 col-lg-2">
                <div class="card h-100 border-0 shadow-sm product-card-premium overflow-hidden">
                    <a href="product_details.html?id=${tp.id}" class="text-decoration-none text-dark">
                        ${discount > 0 ? `<div class="position-absolute top-0 start-0 m-2 z-1"><span class="badge bg-danger">${discount}% OFF</span></div>` : ''}
                        
                        <div class="card-img-top bg-white d-flex align-items-center justify-content-center" style="height: 200px;">
                            <img src="${imgSrc}" class="w-100 h-100 object-fit-cover" alt="${tp.name}" loading="lazy" onerror="this.src='https://placehold.co/150'">
                        </div>
                        
                        <div class="card-body p-3 pb-0 d-flex flex-column">
                            <small class="text-muted mb-1">${tp.category || 'General'}</small>
                            <h6 class="card-title fw-bold mb-1 text-truncate">${tp.name || 'Unnamed Product'}</h6>
                            <small class="text-muted mb-2">${tp.pack_size || '1 Unit'}</small>
                        </div>
                    </a>
                    
                    <div class="p-3 pt-0 mt-auto">
                        <div class="d-flex flex-column gap-2 mb-2">
                            <div class="d-flex align-items-baseline">
                                <span class="fw-bold text-dark fs-5">₹${price}</span>
                                ${discount > 0 ? `<span class="text-decoration-line-through text-muted small ms-2">₹${Math.round(mrp)}</span>` : ''}
                            </div>
                        </div>
                        <button class="btn btn-primary-custom w-100 fw-bold py-2 shadow-sm hover-lift add-to-cart-btn" data-id="${tp.id}">
                            <i class="fas fa-shopping-cart me-2"></i> Add to Cart
                        </button>
                    </div>
                </div>
            </div>
            `;
        } catch (err) {
            console.error("Skipping malformed product:", tp, err);
        }
    });
    container.innerHTML = html;
}

// ... Additional Functions to Restore ...
async function loadCartMainUI(cartData) {
    const container = document.getElementById('cart-items-container');
    const summaryContainer = document.getElementById('cart-summary-container');
    if (!container || !summaryContainer) return;

    const productIds = Object.keys(cartData);
    if (productIds.length === 0) {
        container.innerHTML = `
            <div class="text-center py-5">
                <i class="fas fa-shopping-cart fa-4x text-muted mb-3 opacity-25"></i>
                <h5>Your cart is empty</h5>
                <a href="products.html" class="btn btn-primary-custom mt-3">Continue Shopping</a>
            </div>
        `;
        summaryContainer.innerHTML = '';
        return;
    }

    const products = await fetchProductsByIds(productIds);
    let total = 0;

    let html = '';
    products.forEach(p => {
        const qty = cartData[p.id].qty;
        const price = p.price;
        total += price * qty;
        const imgSrc = p.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}&background=random&color=fff&size=100`;

        html += `
            <div class="p-3 border-bottom d-flex gap-3 align-items-center">
                 <img src="${imgSrc}" class="rounded-3 border" width="100" height="100" style="object-fit:cover;">
                 <div class="flex-grow-1">
                     <h5 class="fw-bold mb-1">${p.name}</h5>
                     <p class="text-muted small mb-2">${p.pack_size || '1 Unit'} | ₹${price}</p>
                     
                     <div class="d-flex align-items-center">
                         <div class="input-group input-group-sm" style="width: 120px;">
                             <button class="btn btn-outline-secondary cart-qty-minus" data-id="${p.id}">-</button>
                             <input type="text" class="form-control text-center bg-white" readonly value="${qty}">
                             <button class="btn btn-outline-secondary cart-qty-plus" data-id="${p.id}">+</button>
                         </div>
                         <button class="btn btn-link text-danger text-decoration-none ms-3 cart-remove" data-id="${p.id}">Remove</button>
                     </div>
                 </div>
                 <div class="text-end">
                     <h5 class="fw-bold">₹${price * qty}</h5>
                 </div>
            </div>
         `;
    });
    container.innerHTML = html;

    // Summary
    const shipping = total > 500 ? 0 : 50;
    const finalTotal = total + shipping;

    summaryContainer.innerHTML = `
        <h5 class="fw-bold mb-4">Order Summary</h5>
        <div class="d-flex justify-content-between mb-2">
            <span class="text-muted">Cart Total</span>
            <span class="fw-bold">₹${total}</span>
        </div>
        <div class="d-flex justify-content-between mb-2">
            <span class="text-muted">Shipping Charges</span>
            <span class="fw-bold text-success">${shipping === 0 ? 'FREE' : '₹' + shipping}</span>
        </div>
        <hr>
        <div class="d-flex justify-content-between mb-4">
            <span class="fw-bold fs-5">Total Payble</span>
            <span class="fw-bold fs-5 text-primary-custom">₹${finalTotal}</span>
        </div>
        
        <a href="checkout.html" class="btn btn-primary-custom w-100 py-3 fw-bold shadow-sm">Proceed to Checkout</a>
        <div class="text-center mt-3">
            <span class="text-muted small"><i class="fas fa-shield-alt me-1"></i> Safe & Secure Payments</span>
        </div>
    `;
}


// ... Rest of the helper functions from original file ...
async function loadMyOrders() {
    const container = document.getElementById('orders-container');
    const header = document.getElementById('profile-sidebar-header');

    if (!container) return;

    // Wait for Auth
    await waitForAuth();

    if (!currentUser) {
        window.location.href = 'login.html';
        return;
    }

    // Ensure userProfile is loaded for the sidebar
    if (!userProfile) {
        try {
            const snapshot = await get(child(ref(db), `users/${currentUser.uid}`));
            if (snapshot.exists()) {
                userProfile = snapshot.val();
                updateUI();
            }
        } catch (e) {
            console.error("Error fetching profile for orders page:", e);
        }
    }

    // Update Sidebar Header
    if (header && userProfile) {
        header.innerHTML = `
            <div class="bg-white rounded-circle d-inline-flex align-items-center justify-content-center mb-3 text-primary-custom" style="width: 80px; height: 80px; font-weight:bold; font-size:2rem;">
                ${userProfile.fullname.charAt(0).toUpperCase()}
            </div>
            <h5 class="fw-bold mb-0">${userProfile.fullname}</h5>
            <small class="text-white-50">${userProfile.role || 'Member'}</small>
        `;
        document.getElementById('sidebar-logout')?.addEventListener('click', handleLogout);
    }

    try {
        // Fetch all orders and filter client-side to avoid "Index not defined" error
        // const ordersQuery = query(ref(db, 'orders'), orderByChild('userId'), equalTo(currentUser.uid));
        const snapshot = await get(ref(db, 'orders'));

        if (snapshot.exists()) {
            const orders = [];
            snapshot.forEach(child => {
                const order = { id: child.key, ...child.val() };
                if (order.userId === currentUser.uid) {
                    orders.push(order);
                }
            });

            // Sort by date desc
            orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            if (orders.length > 0) {
                renderOrdersList(orders, container);
            } else {
                container.innerHTML = `
                <div class="text-center py-5">
                    <i class="fas fa-shopping-basket fa-4x text-muted mb-3 opacity-25"></i>
                    <h5>No orders found</h5>
                    <p class="text-muted">You haven't placed any orders yet.</p>
                    <a href="products.html" class="btn btn-primary-custom">Start Shopping</a>
                </div>`;
            }
        } else {
            container.innerHTML = `
                <div class="text-center py-5">
                    <i class="fas fa-shopping-basket fa-4x text-muted mb-3 opacity-25"></i>
                    <h5>No orders found</h5>
                    <p class="text-muted">You haven't placed any orders yet.</p>
                    <a href="products.html" class="btn btn-primary-custom">Start Shopping</a>
                </div>`;
        }
    } catch (e) {
        console.error("Error loading orders:", e);
        container.innerHTML = '<div class="alert alert-danger">Error loading orders.</div>';
    }
}


function renderOrdersList(orders, container) {
    let html = '';
    orders.forEach(order => {
        const date = new Date(order.createdAt).toLocaleDateString();
        const firstItem = order.items[0];
        const count = order.items.length;
        const imgSrc = firstItem.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(firstItem.name)}&background=random&color=fff&size=60`;

        const status = (order.status || 'Pending').toLowerCase();
        let badgeClass = 'bg-secondary';
        if (status === 'completed' || status === 'delivered') badgeClass = 'bg-success';
        if (status === 'processing') badgeClass = 'bg-warning text-dark';
        if (status === 'shipped') badgeClass = 'bg-info';
        if (status === 'cancelled') badgeClass = 'bg-danger';
        if (status === 'returned') badgeClass = 'bg-dark';

        // Action buttons based on status
        let actionBtns = '';
        if (status === 'pending' || status === 'processing') {
            actionBtns = `<button class="btn btn-outline-danger btn-sm cancel-order-btn" data-id="${order.id}"><i class="fas fa-times-circle me-1"></i>Cancel</button>`;
        } else if (status === 'delivered' || status === 'completed') {
            actionBtns = `<button class="btn btn-outline-warning btn-sm return-order-btn" data-id="${order.id}"><i class="fas fa-undo me-1"></i>Return</button>`;
        }

        html += `
        <div class="border rounded-3 p-4 mb-3 order-card" style="cursor: pointer; transition: box-shadow 0.2s;" onmouseover="this.style.boxShadow='0 4px 15px rgba(0,0,0,0.1)'" onmouseout="this.style.boxShadow='none'">
            <div class="d-flex justify-content-between align-items-center mb-3 border-bottom pb-3">
                <div>
                    <span class="badge ${badgeClass} mb-2">${(order.status || 'Pending').toUpperCase()}</span>
                    <h6 class="fw-bold mb-0">Order #${order.id.substring(0, 6)}</h6>
                    <small class="text-muted">Placed on ${date}</small>
                </div>
                <div class="text-end">
                    <h5 class="fw-bold mb-0">₹${Math.round(order.totalAmount)}</h5>
                </div>
            </div>
            <div class="d-flex align-items-center gap-4">
                <div class="position-relative">
                    <img src="${imgSrc}" class="rounded-3 border" width="60" height="60" style="object-fit: cover;">
                    ${count > 1 ? `<span class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-dark border">+${count - 1}</span>` : ''}
                </div>
                <div class="flex-grow-1">
                    <p class="mb-0 fw-medium">${firstItem.name} ${count > 1 ? '...' : ''}</p>
                    <small class="text-muted">${count} item${count > 1 ? 's' : ''} · ${order.paymentMethod || 'COD'}</small>
                </div>
                <div class="d-flex flex-column gap-2 align-items-end">
                    <a href="order_details.html?id=${order.id}" class="btn btn-sm btn-outline-primary"><i class="fas fa-eye me-1"></i>Details</a>
                    ${actionBtns}
                </div>
            </div>
        </div>
        `;
    });
    container.innerHTML = html;

    // Attach cancel handlers
    container.querySelectorAll('.cancel-order-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const oid = btn.dataset.id;
            if (!confirm('Are you sure you want to cancel this order?')) return;
            try {
                btn.disabled = true;
                btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
                await update(ref(db, `orders/${oid}`), { status: 'Cancelled', updatedAt: new Date().toISOString() });
                showToast('Order cancelled successfully.');
                loadMyOrders();
            } catch (err) {
                console.error(err);
                alert('Failed to cancel order.');
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-times-circle me-1"></i>Cancel';
            }
        });
    });

    // Attach return handlers
    container.querySelectorAll('.return-order-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const oid = btn.dataset.id;
            if (!confirm('Are you sure you want to return this order?')) return;
            try {
                btn.disabled = true;
                btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
                await update(ref(db, `orders/${oid}`), { status: 'Returned', updatedAt: new Date().toISOString() });
                showToast('Return request submitted.');
                loadMyOrders();
            } catch (err) {
                console.error(err);
                alert('Failed to return order.');
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-undo me-1"></i>Return';
            }
        });
    });
}

async function loadProducts() {
    const container = document.getElementById('products-container');
    const catFilter = document.getElementById('category-filter');
    const sortFilter = document.getElementById('sort-filter');

    if (!container) return;

    // Get URL Params for initial state
    const urlParams = new URLSearchParams(window.location.search);
    const initialCat = urlParams.get('cat');
    const initialQuery = urlParams.get('q');

    // We'll track if we've initialized the dropdown to avoid resetting it on re-renders/sorts
    let categoriesInitialized = false;

    async function fetchAndRender() {
        container.innerHTML = '<div class="col-12 text-center py-5"><div class="spinner-border text-primary-custom" role="status"></div></div>';

        try {
            const snapshot = await get(ref(db, 'products'));
            if (snapshot.exists()) {
                let products = [];
                snapshot.forEach(child => {
                    try {
                        products.push({ id: child.key, ...child.val() });
                    } catch (e) {
                        console.error("Error parsing product:", child.key, e);
                    }
                });

                // 1. Dynamic Category Population (Run Once)
                if (!categoriesInitialized && catFilter) {
                    const uniqueCategories = [...new Set(products.map(p => p.category).filter(c => c))].sort();

                    catFilter.innerHTML = '<option value="">All Categories</option>';
                    uniqueCategories.forEach(c => {
                        const opt = document.createElement('option');
                        opt.value = c;
                        opt.textContent = c;
                        catFilter.appendChild(opt);
                    });

                    // Set Initial Value from URL (Case Insensitive Match)
                    if (initialCat) {
                        const match = uniqueCategories.find(c => c.toLowerCase() === initialCat.toLowerCase());
                        if (match) {
                            catFilter.value = match;
                        }
                    }
                    categoriesInitialized = true;
                }

                // 2. Filtering
                // Get current filter value (could be from URL init or User Change)
                const cat = catFilter ? catFilter.value : null;
                const search = initialQuery ? initialQuery.toLowerCase() : null;

                if (cat) {
                    // Case-insensitive filtering
                    products = products.filter(p => p.category && p.category.toLowerCase() === cat.toLowerCase());
                }

                if (search) {
                    products = products.filter(p => p.name.toLowerCase().includes(search) || (p.description && p.description.toLowerCase().includes(search)));
                }

                // 3. Sorting
                const sort = sortFilter ? sortFilter.value : 'default';
                if (sort === 'price_low') {
                    products.sort((a, b) => Number(a.price) - Number(b.price));
                } else if (sort === 'price_high') {
                    products.sort((a, b) => Number(b.price) - Number(a.price));
                } else if (sort === 'newest') {
                    // Assuming products have createdAt or similar, or just relying on order if available.
                    // If not, we can't strictly sort by newest unless we have timestamp.
                    // For now, let's reverse the array as a proxy for 'newest' if they entered chronologically
                    products.reverse();
                }

                // Cache
                products.forEach(p => productsCache[p.id] = p);

                if (products.length > 0) {
                    renderProducts(products, container);
                } else {
                    container.innerHTML = '<div class="col-12 text-center py-5"><p class="text-muted">No products found matching your criteria.</p></div>';
                }

            } else {
                container.innerHTML = '<div class="col-12 text-center py-5"><p class="text-muted">No products found in database.</p></div>';
            }
        } catch (error) {
            console.error("Error in fetchAndRender:", error);
            container.innerHTML = '<div class="col-12 text-center py-5"><p class="text-muted">Error loading products.</p></div>';
        }
    }

    if (catFilter) catFilter.addEventListener('change', fetchAndRender);
    if (sortFilter) sortFilter.addEventListener('change', fetchAndRender);

    // Check for 'sort' param in URL (e.g. New Arrivals "View All")
    const initialSort = urlParams.get('sort');
    if (initialSort && sortFilter) {
        if (sortFilter.querySelector(`option[value="${initialSort}"]`)) {
            sortFilter.value = initialSort;
        } else if (initialSort === 'newest') {
            // Add Newest option if not exists
            const opt = document.createElement('option');
            opt.value = 'newest';
            opt.textContent = 'Newest First';
            sortFilter.appendChild(opt);
            sortFilter.value = 'newest';
        }
    }

    fetchAndRender();
}

async function loadProfile() {
    // Wait for Auth
    await waitForAuth();

    if (!currentUser) {
        window.location.href = 'login.html';
        return;
    }

    const container = document.getElementById('profile-container');
    if (!container) return;

    if (!userProfile && currentUser) {
        // Fetch profile if not ready
        try {
            const snapshot = await get(child(ref(db), `users/${currentUser.uid}`));
            if (snapshot.exists()) {
                userProfile = snapshot.val();
                updateUI(); // Update header etc
            }
        } catch (e) {
            console.error("Error fetching profile:", e);
        }
    }

    if (userProfile) {
        // Render Profile
        container.innerHTML = `
            <div class="col-lg-3 mb-4">
                <div class="card border-0 shadow-sm rounded-4 overflow-hidden">
                    <div class="card-body p-0">
                        <div class="bg-primary-custom p-4 text-white text-center">
                            <div class="bg-white rounded-circle d-inline-flex align-items-center justify-content-center mb-3 text-primary-custom display-4 fw-bold" style="width: 80px; height: 80px;">
                                ${userProfile.fullname.charAt(0).toUpperCase()}
                            </div>
                            <h5 class="fw-bold mb-0">${userProfile.fullname}</h5>
                            <small class="text-white-50">${userProfile.role || 'Member'}</small>
                        </div>
                        <div class="list-group list-group-flush py-2">
                             <a href="profile.html" class="list-group-item list-group-item-action border-0 px-4 py-3 fw-medium active bg-light text-primary-custom fw-bold">
                                <i class="fas fa-user-circle me-3"></i> My Profile
                            </a>
                            <a href="my_orders.html" class="list-group-item list-group-item-action border-0 px-4 py-3 fw-medium">
                                <i class="fas fa-box-open me-3 text-muted"></i> My Orders
                            </a>
                            <a href="#" id="profile-logout-btn" class="list-group-item list-group-item-action border-0 px-4 py-3 fw-medium text-danger">
                                <i class="fas fa-sign-out-alt me-3"></i> Logout
                            </a>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="col-lg-9">
                <div class="card border-0 shadow-sm rounded-4 mb-4">
                    <div class="card-header bg-white border-0 p-4 pb-0 d-flex justify-content-between align-items-center">
                        <h5 class="fw-bold mb-0">Personal Information</h5>
                        <button class="btn btn-sm btn-outline-primary fw-bold" data-bs-toggle="modal" data-bs-target="#editProfileModal">Edit</button>
                    </div>
                    <div class="card-body p-4">
                        <div class="row g-3">
                            <div class="col-md-6">
                                <label class="form-label text-muted small fw-bold text-uppercase">Full Name</label>
                                <p class="fw-bold fs-5 text-dark">${userProfile.fullname}</p>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label text-muted small fw-bold text-uppercase">Email Address</label>
                                <p class="fw-bold fs-5 text-dark">${userProfile.email}</p>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label text-muted small fw-bold text-uppercase">Phone Number</label>
                                <p class="fw-bold fs-5 text-dark">${userProfile.phone || 'Not Set'}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('profile-logout-btn').addEventListener('click', handleLogout);

        // Pre-fill Edit Modal
        const editName = document.getElementById('edit-fullname');
        if (editName) editName.value = userProfile.fullname;
        const editPhone = document.getElementById('edit-phone');
        if (editPhone) editPhone.value = userProfile.phone || '';

        // Handle Edit Form
        const editForm = document.getElementById('editProfileForm');
        if (editForm) {
            editForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const newName = document.getElementById('edit-fullname').value;
                const newPhone = document.getElementById('edit-phone').value;
                const btn = e.target.querySelector('button');

                try {
                    btn.disabled = true;
                    btn.innerText = 'Saving...';

                    await update(ref(db, 'users/' + currentUser.uid), {
                        fullname: newName,
                        phone: newPhone
                    });

                    alert('Profile Updated!');
                    window.location.reload();
                } catch (error) {
                    console.error(error);
                    alert('Update Failed');
                    btn.disabled = false;
                    btn.innerText = 'Save Changes';
                }
            });
        }

        // --- Address Management ---
        const addressContainer = document.querySelector('.col-lg-9');
        if (addressContainer) {
            // Fetch Addresses
            const addrSnapshot = await get(child(ref(db), `users/${currentUser.uid}/addresses`));
            let addressesHtml = '';

            if (addrSnapshot.exists()) {
                const addresses = addrSnapshot.val();
                Object.keys(addresses).forEach(key => {
                    const addr = addresses[key];
                    addressesHtml += `
                        <div class="col-md-6 mb-3">
                            <div class="card h-100 border rounded-4 shadow-sm">
                                <div class="card-body p-4 position-relative">
                                    <h6 class="fw-bold mb-2"><i class="fas fa-map-marker-alt text-primary-custom me-2"></i>${addr.title}</h6>
                                    <p class="text-muted small mb-0">${addr.text}</p>
                                    <p class="text-muted small mb-0">${addr.city} - ${addr.zip}</p>
                                    <button class="btn btn-link text-danger p-0 position-absolute top-0 end-0 m-3 btn-sm delete-addr-btn" data-id="${key}">
                                        <i class="fas fa-trash-alt"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
                });
            } else {
                addressesHtml = '<div class="col-12 text-center text-muted py-3">No addresses found. Add one below.</div>';
            }

            // Append Addresses Section
            const addrSection = document.createElement('div');
            addrSection.innerHTML = `
                <div class="card border-0 shadow-sm rounded-4 mb-4" id="address-section">
                    <div class="card-header bg-white border-0 p-4 pb-0 d-flex justify-content-between align-items-center">
                        <h5 class="fw-bold mb-0">Saved Addresses</h5>
                        <button class="btn btn-sm btn-primary-custom fw-bold" data-bs-toggle="modal" data-bs-target="#addAddressModal">
                            <i class="fas fa-plus me-1"></i> Add New
                        </button>
                    </div>
                    <div class="card-body p-4">
                        <div class="row" id="address-list">
                            ${addressesHtml}
                        </div>
                    </div>
                </div>
            `;
            addressContainer.appendChild(addrSection);

            // Handle Add Address
            const addAddrForm = document.getElementById('addAddressForm');
            if (addAddrForm) {
                // Remove old listeners to prevent duplicates if function re-runs
                const newForm = addAddrForm.cloneNode(true);
                addAddrForm.parentNode.replaceChild(newForm, addAddrForm);

                newForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const title = document.getElementById('addr-title').value;
                    const text = document.getElementById('addr-text').value;
                    const city = document.getElementById('addr-city').value;
                    const zip = document.getElementById('addr-zip').value;
                    const btn = e.target.querySelector('button');

                    try {
                        btn.disabled = true;
                        btn.innerText = 'Saving...';
                        await push(child(ref(db), `users/${currentUser.uid}/addresses`), {
                            title, text, city, zip
                        });
                        alert('Address Added!');
                        window.location.reload();
                    } catch (err) {
                        console.error(err);
                        alert('Failed to add address');
                        btn.disabled = false;
                        btn.innerText = 'Save Address';
                    }
                });
            }

            // Handle Delete Address
            document.querySelectorAll('.delete-addr-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    if (confirm("Delete this address?")) {
                        const id = e.target.closest('button').dataset.id;
                        await remove(child(ref(db), `users/${currentUser.uid}/addresses/${id}`));
                        e.target.closest('.col-md-6').remove();
                    }
                });
            });
        }
    }
}

async function loadProductDetails(productId) {
    const container = document.getElementById('product-details-container');
    if (!container) return;

    try {
        const snapshot = await get(child(ref(db), `products/${productId}`));
        if (snapshot.exists()) {
            const p = snapshot.val();

            const imgSrc = p.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}&background=random&color=fff&size=400`;
            const mrp = p.discount > 0 ? p.price * (1 + (p.discount / 100)) : p.price;

            container.innerHTML = `
                <div class="row">
                    <div class="col-md-5 mb-4 mb-md-0">
                        <div class="card border-0 shadow-sm rounded-4 overflow-hidden">
                             <div class="card-body p-5 d-flex align-items-center justify-content-center bg-white">
                                <img src="${imgSrc}" class="img-fluid" alt="${p.name}" style="max-height: 400px;">
                            </div>
                        </div>
                    </div>
                    <div class="col-md-7">
                        <div class="ps-lg-4">
                            <span class="badge bg-primary-custom bg-opacity-10 text-primary-custom mb-3 px-3 py-2 rounded-pill">${p.category}</span>
                            <h2 class="fw-bold mb-2">${p.name}</h2>
                            <p class="text-muted mb-4">${p.description || 'No description available.'}</p>
                            
                            <div class="d-flex align-items-center mb-4">
                                <h2 class="fw-bold text-primary-custom mb-0 me-3">₹${p.price}</h2>
                                ${p.discount > 0 ? `<span class="text-decoration-line-through text-muted fs-5">₹${Math.round(mrp)}</span><span class="badge bg-danger ms-3">${p.discount}% OFF</span>` : ''}
                            </div>
                            
                            <div class="d-flex gap-3 mb-4">
                                <button class="btn btn-primary-custom px-5 py-3 fw-bold shadow-sm flex-grow-1 add-to-cart-btn" data-id="${productId}">
                                    <i class="fas fa-shopping-cart me-2"></i> Add to Cart
                                </button>
                                <button class="btn btn-outline-secondary px-4 py-3"><i class="far fa-heart"></i></button>
                            </div>
                            
                            <div class="card bg-light border-0 rounded-4">
                                <div class="card-body">
                                    <div class="d-flex gap-4">
                                        <div class="d-flex align-items-center">
                                            <i class="fas fa-shipping-fast text-primary-custom me-2"></i>
                                            <small class="fw-bold">Fast Delivery</small>
                                        </div>
                                        <div class="d-flex align-items-center">
                                            <i class="fas fa-shield-alt text-primary-custom me-2"></i>
                                            <small class="fw-bold">100% Genuine</small>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } else {
            container.innerHTML = '<div class="alert alert-danger">Product not found.</div>';
        }
    } catch (error) {
        console.error("Error loading product details:", error);
    }
}

async function loadOrderDetails(orderId) {
    // Wait for Auth
    await waitForAuth();

    if (!currentUser) {
        window.location.href = 'login.html';
        return;
    }

    const container = document.getElementById('order-details-container');
    if (!container) return;

    try {
        const snapshot = await get(child(ref(db), `orders/${orderId}`));
        if (snapshot.exists()) {
            const order = snapshot.val();
            if (order.userId !== currentUser.uid) {
                container.innerHTML = '<div class="alert alert-danger">Access Denied</div>';
                return;
            }

            let itemsHtml = '';
            order.items.forEach(item => {
                itemsHtml += `
                    <div class="d-flex align-items-center gap-4 mb-3 pb-3 border-bottom last-border-0">
                        <img src="${item.image || 'https://via.placeholder.com/80'}" class="rounded-3 border" width="80" height="80" style="object-fit: cover;">
                        <div class="flex-grow-1">
                            <h6 class="fw-bold mb-1">${item.name}</h6>
                            <small class="text-muted">Quantity: ${item.qty}</small>
                        </div>
                        <div class="text-end">
                            <h6 class="fw-bold mb-0">₹${item.price}</h6>
                        </div>
                    </div>
                 `;
            });

            const statusClass = order.status === 'completed' ? 'bg-success' : (order.status === 'cancelled' ? 'bg-danger' : 'bg-warning text-dark');

            const status = (order.status || 'Pending').toLowerCase();
            let orderActionCard = '';
            if (status === 'pending' || status === 'processing') {
                orderActionCard = `
                    <div class="card border-0 shadow-sm rounded-4 border-danger border-opacity-25 mt-3">
                        <div class="card-body p-4 text-center">
                            <p class="mb-3 text-muted">Need to change your mind?</p>
                            <button class="btn btn-outline-danger w-100 fw-bold py-2" id="detail-cancel-btn">
                                <i class="fas fa-times-circle me-2"></i>Cancel Order
                            </button>
                        </div>
                    </div>
                `;
            } else if (status === 'delivered' || status === 'completed') {
                orderActionCard = `
                    <div class="card border-0 shadow-sm rounded-4 border-warning border-opacity-50 mt-3">
                        <div class="card-body p-4 text-center">
                            <p class="mb-3 text-muted">Issue with your order?</p>
                            <button class="btn btn-outline-warning w-100 fw-bold py-2 text-dark" id="detail-return-btn">
                                <i class="fas fa-undo me-2"></i>Return Order
                            </button>
                        </div>
                    </div>
                `;
            }

            container.innerHTML = `
                <!-- Breadcrumb -->
                <nav aria-label="breadcrumb" class="mb-4">
                    <ol class="breadcrumb">
                        <li class="breadcrumb-item"><a href="index.html" class="text-decoration-none text-muted">Home</a></li>
                        <li class="breadcrumb-item"><a href="my_orders.html" class="text-decoration-none text-muted">My Orders</a></li>
                        <li class="breadcrumb-item active text-primary-custom fw-bold" aria-current="page">Order #${orderId.substring(0, 8)}</li>
                    </ol>
                </nav>

                <div class="row">
                    <div class="col-lg-8">
                        <div class="card border-0 shadow-sm rounded-4 mb-4">
                            <div class="card-body p-4">
                                <div class="d-flex justify-content-between align-items-center mb-4">
                                    <h5 class="fw-bold mb-0">Order Status</h5>
                                    <span class="badge ${statusClass} fs-6 px-3 py-2">${order.status.toUpperCase()}</span>
                                </div>
                            </div>
                        </div>

                        <div class="card border-0 shadow-sm rounded-4 mb-4">
                            <div class="card-header bg-white border-bottom p-4">
                                <h5 class="fw-bold mb-0">Order Items (${order.items.length})</h5>
                            </div>
                            <div class="card-body p-4">
                                ${itemsHtml}
                            </div>
                        </div>
                    </div>

                    <div class="col-lg-4">
                        <div class="card border-0 shadow-sm rounded-4 mb-4">
                            <div class="card-header bg-white border-bottom p-4">
                                <h5 class="fw-bold mb-0">Shipping Details</h5>
                            </div>
                            <div class="card-body p-4">
                                <h6 class="fw-bold">${order.shippingAddress.fullname}</h6>
                                <p class="text-muted mb-0">
                                    ${order.shippingAddress.address}, ${order.shippingAddress.city} - ${order.shippingAddress.zip}
                                </p>
                                <div class="mt-3 pt-3 border-top">
                                    <small class="text-muted d-block fw-bold">Phone Number</small>
                                    <span>${order.shippingAddress.phone}</span>
                                </div>
                            </div>
                        </div>

                        <div class="card border-0 shadow-sm rounded-4 mb-4">
                            <div class="card-header bg-white border-bottom p-4">
                                <h5 class="fw-bold mb-0">Order Summary</h5>
                            </div>
                            <div class="card-body p-4">
                                <div class="d-flex justify-content-between mb-2">
                                    <span class="text-muted">Payment Method</span>
                                    <span class="fw-bold">${order.paymentMethod || 'COD'}</span>
                                </div>
                                <div class="d-flex justify-content-between mb-2">
                                    <span class="text-muted">Order Date</span>
                                    <span class="fw-bold">${new Date(order.createdAt).toLocaleDateString()}</span>
                                </div>
                                <div class="d-flex justify-content-between border-top pt-3 mt-3">
                                    <h5 class="fw-bold">Total</h5>
                                    <h5 class="fw-bold text-primary-custom">₹${Math.round(order.totalAmount)}</h5>
                                </div>
                            </div>
                        </div>

                        ${orderActionCard}
                    </div>
                </div>
             `;

            // Attach action handlers
            const cancelBtn = document.getElementById('detail-cancel-btn');
            if (cancelBtn) {
                cancelBtn.addEventListener('click', async () => {
                    if (!confirm('Are you sure you want to cancel this order?')) return;
                    try {
                        cancelBtn.disabled = true;
                        cancelBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Cancelling...';
                        await update(ref(db, `orders/${orderId}`), { status: 'Cancelled', updatedAt: new Date().toISOString() });
                        showToast('Order cancelled successfully.');
                        loadOrderDetails(orderId);
                    } catch (err) {
                        console.error(err);
                        alert('Failed to cancel order.');
                    }
                });
            }

            const returnBtn = document.getElementById('detail-return-btn');
            if (returnBtn) {
                returnBtn.addEventListener('click', async () => {
                    if (!confirm('Are you sure you want to return this order?')) return;
                    try {
                        returnBtn.disabled = true;
                        returnBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Processing...';
                        await update(ref(db, `orders/${orderId}`), { status: 'Returned', updatedAt: new Date().toISOString() });
                        showToast('Return request submitted.');
                        loadOrderDetails(orderId);
                    } catch (err) {
                        console.error(err);
                        alert('Failed to return order.');
                    }
                });
            }

        } else {
            container.innerHTML = '<div class="alert alert-danger">Order not found.</div>';
        }
    } catch (e) {
        console.error(e);
        container.innerHTML = '<div class="alert alert-danger">Error loading order.</div>';
    }
}

function showToast(message) {
    // Simple toast implementation or use Bootstrap's
    const toastContainer = document.getElementById('toast-container') || createToastContainer();
    const toastEl = document.createElement('div');
    toastEl.className = 'toast align-items-center text-white bg-primaryBorder border-0 show';
    toastEl.style.backgroundColor = 'var(--dark-color)';
    toastEl.setAttribute('role', 'alert');
    toastEl.setAttribute('aria-live', 'assertive');
    toastEl.setAttribute('aria-atomic', 'true');

    toastEl.innerHTML = `
      <div class="d-flex">
        <div class="toast-body">
          ${message}
        </div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
    `;

    toastContainer.appendChild(toastEl);

    setTimeout(() => {
        toastEl.remove();
    }, 3000);
}

function createToastContainer() {
    const div = document.createElement('div');
    div.id = 'toast-container';
    div.className = 'toast-container position-fixed bottom-0 end-0 p-3';
    div.style.zIndex = '1090';
    document.body.appendChild(div);
    return div;
}


function initPrescriptionLogic() {
    const input = document.getElementById('prescription-input');
    const uploadSection = document.getElementById('upload-section');
    const previewSection = document.getElementById('preview-section');
    const resultsSection = document.getElementById('results-section');
    const previewImage = document.getElementById('preview-image');
    const scanningLine = document.getElementById('scanning-line');
    const scanProgress = document.getElementById('scan-progress');
    const statusText = document.getElementById('scan-status-text');
    const resultsContainer = document.getElementById('detected-products-container');

    if (!input) return;

    input.addEventListener('change', async (e) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];

            // Show Preview
            const reader = new FileReader();
            reader.onload = function (e) {
                previewImage.src = e.target.result;
                uploadSection.classList.add('d-none');
                previewSection.classList.remove('d-none');
                scanningLine.style.display = 'block';

                // Start Real OCR
                performOCR(file);
            }
            reader.readAsDataURL(file);
        }
    });

    async function performOCR(file) {
        console.log("Starting OCR Process...");
        statusText.innerText = "Initializing OCR Engine...";
        scanProgress.style.width = "10%";

        try {
            const worker = await Tesseract.createWorker('eng', 1, {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        statusText.innerText = `Recognizing Text... ${Math.round(m.progress * 100)}%`;
                        scanProgress.style.width = `${30 + (m.progress * 60)}%`;
                    }
                }
            });

            console.log("Tesseract Worker created.");

            const ret = await worker.recognize(file);
            console.log("OCR COMPLETE. Raw Text:", ret.data.text);

            statusText.innerText = "Analyzing Medicines...";
            scanProgress.style.width = "100%";

            await worker.terminate();

            scanningLine.style.display = 'none';

            setTimeout(() => {
                showResults(ret.data.text);
            }, 500);

        } catch (error) {
            console.error("OCR Error:", error);
            statusText.innerText = "Error scanning image. Please try again.";
            statusText.classList.add('text-danger');
            scanningLine.style.display = 'none';
        }
    }

    // Helper: Levenshtein Distance for Fuzzy Matching
    function levenshteinDistance(a, b) {
        const matrix = [];
        for (let i = 0; i <= b.length; i++) matrix[i] = [i];
        for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1, // substitution
                        Math.min(matrix[i][j - 1] + 1, // insertion
                            matrix[i - 1][j] + 1) // deletion
                    );
                }
            }
        }
        return matrix[b.length][a.length];
    }

    async function showResults(ocrText) {
        previewSection.classList.add('d-none');
        resultsSection.classList.remove('d-none');

        resultsContainer.innerHTML = '<div class="col-12 text-center py-5"><div class="spinner-border text-primary-custom"></div><p class="mt-2 text-muted">Searching database with Smart Matching...</p></div>';

        try {
            console.log("Fetching products from database...");
            const snapshot = await get(ref(db, 'products'));
            if (snapshot.exists()) {
                const allProducts = [];
                snapshot.forEach(child => {
                    try {
                        allProducts.push({ id: child.key, ...child.val() });
                    } catch (e) {
                        console.error("Error parsing product in OCR:", child.key, e);
                    }
                });
                console.log(`Loaded ${allProducts.length} products from DB.`);
                console.log("Product IDs loaded:", allProducts.map(p => p.id));

                const detected = [];
                // Clean Text: keep simple alphanumeric and spaces
                const cleanText = ocrText.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
                const words = cleanText.split(/\s+/);
                console.log("Cleaned Words:", words);

                // Stop Words
                const STOP_WORDS = [
                    'tablet', 'tablets', 'capsule', 'capsules', 'syrup', 'injection', 'cream', 'gel', 'ointment', 'drops', 'solution',
                    'mg', 'ml', 'g', 'kg', 'mcg',
                    'take', 'one', 'two', 'three', 'four', 'daily', 'every', 'hours', 'times', 'day', 'night', 'morning', 'evening',
                    'food', 'water', 'milk', 'after', 'before', 'with',
                    'dispense', 'refill', 'qty', 'quantity', 'sig', 'rx', 'dr', 'doctor', 'patient', 'name', 'date', 'signature',
                    'pharmacy', 'hospital', 'clinic', 'medication', 'medicine', 'prescribed', 'substitution', 'permitted',
                    'chewable', 'oral', 'mouth', 'allergy', 'allergies', 'heartburn', 'acid'
                ];

                // Filter Search Terms
                const uniqueTerms = [...new Set(words)].filter(word =>
                    word.length > 2 && !STOP_WORDS.includes(word)
                );

                console.log("Final Keywords for matching:", uniqueTerms);

                // Matching Logic with Fuzzy Search
                allProducts.forEach(product => {
                    const pName = (product.name || '').toLowerCase();
                    const pNameWords = pName.split(/\s+/);

                    // Compare each OCR keyword against Product Name
                    const isMatch = uniqueTerms.some(term => {
                        // 1. Exact Match (Substring)
                        if (pName.includes(term)) {
                            console.log(`EXACT MATCH: "${term}" in "${pName}"`);
                            return true;
                        }

                        // 2. Fuzzy Match
                        return pNameWords.some(pWord => {
                            if (Math.abs(pWord.length - term.length) > 3) return false;

                            const dist = levenshteinDistance(term, pWord);
                            const maxLen = Math.max(term.length, pWord.length);
                            const similarity = 1 - (dist / maxLen);

                            // Threshold: 0.7 means 70% similarity required.
                            // "South" vs "Cough": Dist 2, Len 5, Sim 0.6 -> Rejected
                            // "Paracitamol" vs "Paracetamol": Dist 1, Len 11, Sim 0.9 -> Accepted
                            if (similarity > 0.7) {
                                console.log(`FUZZY MATCH: "${term}" ~= "${pWord}" (${Math.round(similarity * 100)}%)`);
                                return true;
                            }
                            return false;
                        });
                    });

                    if (isMatch) {
                        if (!detected.find(d => d.id === product.id)) {
                            detected.push(product);
                        }
                    }
                });

                if (detected.length > 0) {
                    console.log("Total detected products:", detected.length);
                    renderProducts(detected, resultsContainer);

                    // Add badges
                    const cards = resultsContainer.querySelectorAll('.product-card-premium');
                    cards.forEach(card => {
                        const badge = document.createElement('div');
                        badge.innerHTML = '<span class="badge bg-success position-absolute top-0 end-0 m-2"><i class="fas fa-check-circle me-1"></i> Match Found</span>';
                        card.style.position = 'relative';
                        card.appendChild(badge);
                    });

                } else {
                    console.log("No matching products found in DB.");
                    resultsContainer.innerHTML = `
                        <div class="col-12 text-center py-5">
                            <i class="fas fa-file-medical-alt fa-3x text-muted mb-3 opacity-25"></i>
                            <h5>No exact medicines found</h5>
                            <p class="text-muted">We extracted: <br> <span class="fw-bold text-dark">"${uniqueTerms.join(', ')}"</span></p>
                            <p class="small text-muted">Try searching manually for close matches.</p>
                            
                            <div class="row justify-content-center">
                                <div class="col-md-6">
                                    <form action="products.html" method="GET" class="d-flex gap-2">
                                        <input type="text" name="q" class="form-control" placeholder="Search..." value="${uniqueTerms[0] || ''}">
                                        <button type="submit" class="btn btn-primary-custom">Search</button>
                                    </form>
                                </div>
                            </div>
                            
                            <div class="mt-4">
                                <button class="btn btn-outline-secondary btn-sm" onclick="window.location.reload()">Scan Another Image</button>
                            </div>
                        </div>
                    `;
                }

            } else {
                console.log("Product database is empty.");
                resultsContainer.innerHTML = '<div class="col-12 text-center"><p>Product database is empty.</p></div>';
            }
        } catch (e) {
            console.error(e);
            resultsContainer.innerHTML = '<div class="alert alert-danger">Error processing results.</div>';
        }
    }
}

// --- Blog Logic ---

async function loadBlogs() {
    const container = document.getElementById('blog-list');
    if (!container) return;

    container.innerHTML = '<div class="col-12 text-center py-5"><div class="spinner-border text-primary-custom" role="status"></div></div>';

    try {
        const snapshot = await get(ref(db, 'blogs'));
        if (snapshot.exists()) {
            const blogs = [];
            snapshot.forEach(c => blogs.push({ id: c.key, ...c.val() }));

            // Sort by date desc
            blogs.sort((a, b) => new Date(b.date) - new Date(a.date));

            if (blogs.length === 0) {
                container.innerHTML = '<div class="col-12 text-center py-5"><p class="text-muted">No articles found.</p></div>';
                return;
            }

            let html = '';
            blogs.forEach(b => {
                const img = b.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(b.title)}&background=random&color=fff&size=400`;
                const date = new Date(b.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

                html += `
                    <div class="col-md-6 col-lg-4">
                        <div class="card h-100 border-0 shadow-sm rounded-4 overflow-hidden blog-card">
                            <a href="blog_details.html?id=${b.id}">
                                <div class="card-img-top position-relative" style="height: 220px;">
                                    <img src="${img}" class="w-100 h-100 object-fit-cover" alt="${b.title}">
                                    <div class="position-absolute bottom-0 start-0 bg-white px-3 py-1 m-3 rounded-pill shadow-sm small fw-bold text-primary-custom">
                                        ${b.category}
                                    </div>
                                </div>
                            </a>
                            <div class="card-body p-4 d-flex flex-column">
                                <div class="d-flex align-items-center text-muted small mb-3">
                                    <i class="far fa-calendar-alt me-2"></i> ${date}
                                    <span class="mx-2">•</span>
                                    <i class="far fa-user me-2"></i> ${b.author}
                                </div>
                                <h5 class="card-title fw-bold mb-3">
                                    <a href="blog_details.html?id=${b.id}" class="text-dark text-decoration-none hover-primary text-truncate-2">${b.title}</a>
                                </h5>
                                <p class="card-text text-muted mb-4 flex-grow-1" style="display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">
                                    ${b.content.replace(/<[^>]*>?/gm, '')}
                                </p>
                                <a href="blog_details.html?id=${b.id}" class="fw-bold text-primary-custom text-decoration-none mt-auto">
                                    Read Article <i class="fas fa-arrow-right ms-2"></i>
                                </a>
                            </div>
                        </div>
                    </div>
                 `;
            });
            container.innerHTML = html;

        } else {
            container.innerHTML = '<div class="col-12 text-center py-5"><p class="text-muted">No articles published yet.</p></div>';
        }
    } catch (e) {
        console.error(e);
        container.innerHTML = '<div class="col-12 text-center py-5 text-danger">Error loading blogs.</div>';
    }
}

async function loadBlogDetails(id) {
    const container = document.getElementById('blog-details-container');
    const titleEl = document.getElementById('breadcrumb-title');
    if (!container) return;

    try {
        const snapshot = await get(child(ref(db), `blogs/${id}`));
        if (snapshot.exists()) {
            const b = snapshot.val();
            const img = b.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(b.title)}&background=random&color=fff&size=800`;
            const date = new Date(b.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

            if (titleEl) titleEl.innerText = b.title;

            container.innerHTML = `
                <div class="col-lg-8">
                     <div class="mb-4">
                        <span class="badge bg-primary-custom bg-opacity-10 text-primary-custom px-3 py-2 rounded-pill mb-3">${b.category}</span>
                        <h1 class="fw-bold display-5 mb-3">${b.title}</h1>
                        <div class="d-flex align-items-center text-muted mb-4">
                            <div class="d-flex align-items-center me-4">
                                <div class="bg-light rounded-circle d-flex align-items-center justify-content-center me-2" style="width: 40px; height: 40px;">
                                    <i class="fas fa-user text-secondary"></i>
                                </div>
                                <div>
                                    <small class="d-block text-uppercase" style="font-size: 0.7rem;">Author</small>
                                    <span class="fw-bold text-dark">${b.author}</span>
                                </div>
                            </div>
                            <div class="d-flex align-items-center">
                                <div class="bg-light rounded-circle d-flex align-items-center justify-content-center me-2" style="width: 40px; height: 40px;">
                                    <i class="fas fa-calendar-alt text-secondary"></i>
                                </div>
                                <div>
                                    <small class="d-block text-uppercase" style="font-size: 0.7rem;">Published</small>
                                    <span class="fw-bold text-dark">${date}</span>
                                </div>
                            </div>
                        </div>
                     </div>

                     <div class="mb-5 rounded-4 overflow-hidden shadow-sm">
                        <img src="${img}" class="w-100" alt="${b.title}">
                     </div>

                     <div class="blog-content text-dark" style="font-size: 1.1rem; line-height: 1.8;">
                        ${b.content.replace(/\n/g, '<br>')}
                     </div>
                     
                     <hr class="my-5">
                     
                     <div class="d-flex justify-content-between align-items-center">
                        <a href="blogs.html" class="btn btn-outline-secondary rounded-pill px-4"><i class="fas fa-arrow-left me-2"></i> Back to Blogs</a>
                     </div>
                </div>
             `;
        } else {
            container.innerHTML = '<div class="alert alert-danger">Article not found.</div>';
        }
    } catch (e) {
        console.error(e);
        container.innerHTML = '<div class="alert alert-danger">Error loading article.</div>';
    }
}

async function loadHomepageBlogs() {
    const container = document.getElementById('homepage-blog-list');
    if (!container) return;

    try {
        const snap = await get(ref(db, 'blogs'));
        if (snap.exists()) {
            const blogs = [];
            snap.forEach(c => blogs.push({ id: c.key, ...c.val() }));
            blogs.sort((a, b) => new Date(b.date) - new Date(a.date));
            const recent = blogs.slice(0, 3);

            let html = '';
            recent.forEach(b => {
                const img = b.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(b.title)}&background=random&color=fff&size=300`;
                const date = new Date(b.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

                html += `
                    <div class="col-md-4">
                        <div class="card h-100 border-0 shadow-sm rounded-4 overflow-hidden blog-card">
                             <a href="blog_details.html?id=${b.id}">
                                <div class="card-img-top position-relative" style="height: 200px;">
                                    <img src="${img}" class="w-100 h-100 object-fit-cover" alt="${b.title}">
                                    <div class="position-absolute bottom-0 start-0 bg-white px-3 py-1 m-3 rounded-pill shadow-sm small fw-bold text-primary-custom">
                                        ${b.category}
                                    </div>
                                </div>
                            </a>
                            <div class="card-body p-4 d-flex flex-column">
                                <h5 class="card-title fw-bold mb-3">
                                    <a href="blog_details.html?id=${b.id}" class="text-dark text-decoration-none hover-primary text-truncate-2">${b.title}</a>
                                </h5>
                                <p class="card-text text-muted mb-4 small flex-grow-1" style="display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">
                                    ${b.content.replace(/<[^>]*>?/gm, '')}
                                </p>
                                <a href="blog_details.html?id=${b.id}" class="fw-bold text-primary-custom text-decoration-none mt-auto">
                                    Read More <i class="fas fa-arrow-right ms-2"></i>
                                </a>
                            </div>
                        </div>
                    </div>
                 `;
            });

            container.innerHTML = html;
        } else {
            container.innerHTML = '<div class="col-12 text-center py-5"><p class="text-muted">No articles found.</p></div>';
        }
    } catch (e) {
        console.error(e);
        container.innerHTML = '<div class="col-12 text-center py-5"><p class="text-muted">Error loading articles.</p></div>';
    }
}
