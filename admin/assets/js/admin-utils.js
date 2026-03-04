import { auth, onAuthStateChanged, signOut, db, ref, get } from '../../../assets/js/firebase-config.js';
import { initNotifications } from './admin-notifications.js';

// Authentication Check
function checkAuth() {
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            // Check if we are already on the login page
            if (!window.location.href.includes('login.html')) {
                window.location.href = 'login.html';
            }
        } else {
            // User is signed in
            console.log('User is signed in:', user.email);

            // Initialize Notifications
            initNotifications();

            // Check Role from DB (only allow admin / manager)
            try {
                const usersRef = ref(db, 'users');
                const snapshot = await get(usersRef);
                if (snapshot.exists()) {
                    const data = snapshot.val();
                    const dbUser = Object.values(data).find(u => u.email && u.email.toLowerCase() === user.email.toLowerCase());

                    if (dbUser) {
                        const role = (dbUser.role || '').toLowerCase();
                        const isAllowed = role === 'admin' || role === 'manager';

                        if (!isAllowed) {
                            // BLOCK ACCESS for non-admin/manager roles (e.g. customer)
                            await signOut(auth);
                            alert("Access Denied: Only admin or manager accounts can access this panel.");
                            window.location.href = 'login.html';
                            return;
                        }

                        // Update UI with role
                        updateUserProfile(user, dbUser.role, dbUser.branch);

                        // Hide Super Admin elements for managers
                        if (role === 'manager') {
                            document.querySelectorAll('.admin-only').forEach(el => {
                                el.style.display = 'none';
                            });

                            // Update the topbar badge if present
                            const topbarBadge = document.querySelector('.topbar .badge');
                            if (topbarBadge && topbarBadge.textContent.includes('Super Admin')) {
                                topbarBadge.innerHTML = `<i class="fas fa-store me-1"></i> ${dbUser.branch || 'Branch Manager'}`;
                                topbarBadge.className = 'badge bg-info-subtle text-info ms-3 border border-info-subtle';
                            }
                        }

                        // If on login page, redirect based on role
                        if (window.location.href.includes('login.html')) {
                            if (role === 'manager' && dbUser.branchId) {
                                window.location.href = `index.html?branch=${dbUser.branchId}`;
                            } else {
                                window.location.href = 'index.html';
                            }
                            return;
                        }
                    } else {
                        // Email not present in admin users table
                        await signOut(auth);
                        alert("Access Denied: Your account is not registered as an admin/manager in the system.");
                        window.location.href = 'login.html';
                        return;
                    }
                } else {
                    console.warn("Admin role check: 'users' node not found in Realtime DB.");
                }
            } catch (error) {
                console.error("Error checking role:", error);
            }
        }
    });
}

function updateUserProfile(user, role = 'Admin', branch = '') {
    // Topbar Profile
    const avatarEls = document.querySelectorAll('.user-avatar'); // Select All avatars (Sidebar + Topbar)

    avatarEls.forEach(el => {
        const name = user.displayName || user.email || 'A';
        if (name) el.textContent = name.charAt(0).toUpperCase();
    });

    // Sidebar Info
    const userNameElement = document.querySelector('.user-info .fw-bold');
    const userRoleElement = document.querySelector('.user-info small');

    if (userNameElement) {
        userNameElement.textContent = user.displayName || user.email.split('@')[0];
    }

    if (userRoleElement) {
        const niceRole = role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Admin';
        const roleLabel = (niceRole.toLowerCase() === 'manager' && branch) ? `Manager - ${branch}` : niceRole;
        userRoleElement.textContent = roleLabel;
    }
}

// Logout Function
function handleLogout() {
    signOut(auth).then(() => {
        window.location.href = 'login.html';
    }).catch((error) => {
        console.error('Sign out error', error);
        alert('Error signing out. Please try again.');
    });
}

import { initChatbot } from './admin-chatbot.js';

// Initialize Chatbot when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChatbot);
} else {
    initChatbot();
}

// Sidebar Toggle (Mobile)
function toggleSidebar() {
    const sidebar = document.getElementById('adminSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar && overlay) {
        sidebar.classList.toggle('active');
        overlay.classList.toggle('show');
    }
}

// Make functions globally available for inline onclick attributes if needed
window.toggleSidebar = toggleSidebar;
window.handleLogout = handleLogout; // Expose for logout button

// Initialize
document.addEventListener('DOMContentLoaded', () => {

    // Helper to wait for Bootstrap
    const waitForBootstrap = setInterval(() => {
        if (window.bootstrap) {
            clearInterval(waitForBootstrap);
            console.log("Bootstrap found, initializing dropdowns...");

            // 1. Initialize Bootstrap Dropdowns Manually (Fix for unclickable icons)
            const dropdownElementList = document.querySelectorAll('.dropdown-toggle');
            [...dropdownElementList].map(dropdownToggleEl => {
                return new window.bootstrap.Dropdown(dropdownToggleEl, {
                    autoClose: true
                });
            });
        }
    }, 100);

    // Stop waiting after 5 seconds to avoid infinite loop
    setTimeout(() => clearInterval(waitForBootstrap), 5000);

    // 2. Attach logout listener
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            handleLogout();
        });
    }

    // 3. Check Auth & Notifications
    checkAuth();

    // Safety check: if admin-notifications had error, it might not run, so we wrap in try-catch in checkAuth or here.
});

export { checkAuth, updateUserProfile, handleLogout, toggleSidebar };
