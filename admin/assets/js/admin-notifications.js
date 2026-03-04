import { db, ref, onChildAdded, onValue, query, limitToLast } from '../../../assets/js/firebase-config.js';

export function initNotifications() {
    const notifDot = document.querySelector('.notification-dot');
    const notifList = document.querySelector('.dropdown-menu ul'); // Adjust selector based on actual structure
    // Actually the structure in index.html is:
    // <ul class="dropdown-menu ..."> <li><h6>...</h6></li> <li><div class="dropdown-item ...">No new notifications</div></li> </ul>
    // We need to target the container for items. Let's assume we can find the list or add an ID.
    // For now, let's use a robust selector.

    // Safe Selector for Dropdown Menu
    const bellIcon = document.querySelector('.fa-bell');
    if (!bellIcon) return;

    const dropdownWrapper = bellIcon.closest('.dropdown');
    if (!dropdownWrapper) return;

    const dropdownMenu = dropdownWrapper.querySelector('.dropdown-menu');
    if (!dropdownMenu) return;

    let notificationCount = 0;
    const maxNotifications = 10;

    // Helper to add notification
    function addNotification(title, message, time, icon = 'fa-info-circle', color = 'primary') {
        // Remove "No new notifications" if exists
        const emptyMsg = dropdownMenu.querySelector('.text-muted.text-center');
        if (emptyMsg) emptyMsg.parentElement.remove();

        const li = document.createElement('li');
        li.innerHTML = `
            <a href="#" class="dropdown-item p-3 border-bottom">
                <div class="d-flex align-items-center">
                    <div class="bg-${color}-subtle text-${color} rounded-circle p-2 me-3 d-flex align-items-center justify-content-center" style="width: 36px; height: 36px;">
                        <i class="fas ${icon}"></i>
                    </div>
                    <div class="flex-grow-1">
                        <h6 class="mb-0 small fw-bold text-dark">${title}</h6>
                        <small class="text-muted d-block text-truncate" style="max-width: 200px;">${message}</small>
                        <small class="text-muted" style="font-size: 0.7rem;">${time}</small>
                    </div>
                </div>
            </a>
        `;

        // Insert after header
        const header = dropdownMenu.querySelector('.dropdown-header');
        if (header && header.parentElement) {
            header.parentElement.after(li);
        } else {
            dropdownMenu.prepend(li);
        }

        // Limit count
        const items = dropdownMenu.querySelectorAll('li a.dropdown-item');
        if (items.length > maxNotifications) {
            items[items.length - 1].closest('li').remove();
        }

        updateCount(1);
        showPopup(title, message);
    }

    function updateCount(change) {
        notificationCount = Math.max(0, notificationCount + change);
        if (notificationCount > 0) {
            notifDot.classList.remove('d-none');
            // We could add a number inside the dot if we want
        } else {
            notifDot.classList.add('d-none');
        }
    }

    function playNotificationSound() {
        // Optional: Play a subtle sound
        // const audio = new Audio('/assets/sounds/notification.mp3');
        // audio.play().catch(e => {}); // Ignore interaction errors
    }

    function showPopup(title, message) {
        let container = document.getElementById('admin-popup-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'admin-popup-container';
            container.style.position = 'fixed';
            container.style.top = '1rem';
            container.style.right = '1rem';
            container.style.zIndex = '2000';
            container.style.display = 'flex';
            container.style.flexDirection = 'column';
            container.style.gap = '0.5rem';
            document.body.appendChild(container);
        }

        const popup = document.createElement('div');
        popup.className = 'shadow-lg rounded-3 bg-white border-start border-4 border-success px-3 py-2';
        popup.style.minWidth = '260px';
        popup.innerHTML = `
            <div class="d-flex align-items-start">
                <div class="me-2 text-success"><i class="fas fa-bell"></i></div>
                <div class="flex-grow-1">
                    <div class="fw-bold small mb-1">${title}</div>
                    <div class="small text-muted">${message}</div>
                </div>
            </div>
        `;

        container.appendChild(popup);

        setTimeout(() => {
            popup.classList.add('fade');
            popup.style.opacity = '0';
            setTimeout(() => popup.remove(), 300);
        }, 4000);
    }

    // 1. Listen for New Orders (Real-time)
    // We only want NEW orders since page load. timestamp > now.
    // Or simpler: listen to limitToLast(1) and check if it's new.
    // However, onChildAdded on limitToLast(1) will fire for the existing last item first.
    // Strategy: Get current latest ID or timestamp, then listen.
    // SIMPLER STRATEGY for Demo: Just listen to last 1 and ignore the initial load if possible, 
    // OR just allow the last order to show up as a notification "Recent Order".

    // Better: Timestamp check.
    const now = Date.now();
    const ordersRef = query(ref(db, 'orders'), limitToLast(1));

    let initialLoad = true;
    onChildAdded(ordersRef, (snapshot) => {
        if (initialLoad) {
            initialLoad = false;
            return;
        }
        const order = snapshot.val();
        if (order && new Date(order.createdAt).getTime() > now) {
            addNotification(
                'New Order Received',
                `Order #${String(snapshot.key).slice(-6).toUpperCase()} - ₹${order.totalAmount || order.total || 0}`,
                'Just Now',
                'fa-shopping-bag',
                'success'
            );
        }
    });

    // 2. Low Stock Alerts
    const productsRef = query(ref(db, 'products'));

    onValue(productsRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        let lowStockItems = [];
        Object.values(data).forEach(p => {
            if (parseInt(p.total_stock || 0) < 10) {
                lowStockItems.push(p.name);
            }
        });

        if (lowStockItems.length > 0) {
            // Only add one summary notification to avoid spam
            // Check if we already have a low stock notification
            const existing = Array.from(dropdownMenu.querySelectorAll('h6')).find(el => el.textContent === 'Low Stock Alert');

            if (!existing) {
                const count = lowStockItems.length;
                const msg = count === 1 ? `${lowStockItems[0]} is low on stock.` : `${count} products are low on stock.`;
                addNotification(
                    'Low Stock Alert',
                    msg,
                    'Urgent',
                    'fa-exclamation-triangle',
                    'warning'
                );
            }
        }
    });
}
