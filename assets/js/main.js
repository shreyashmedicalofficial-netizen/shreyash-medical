// Main JS file for Shreyash Pharmacy
document.addEventListener('DOMContentLoaded', function () {
    console.log('Shreyash Front-end Loaded');

    // Sticky Header Shadow
    const navbar = document.getElementById('stickyHeader');
    if (navbar) {
        window.addEventListener('scroll', function () {
            if (window.scrollY > 10) {
                navbar.classList.add('sticky-shadow');
            } else {
                navbar.classList.remove('sticky-shadow');
            }
        });
    }

    // Side Cart Logic
    const cartOffcanvas = document.getElementById('cartOffcanvas');
    if (cartOffcanvas) {
        const bsOffcanvas = new bootstrap.Offcanvas(cartOffcanvas);

        // Function to refresh cart
        window.refreshSideCart = function () {
            fetch('api/get_cart_sidebar.php')
                .then(response => response.text())
                .then(html => {
                    document.getElementById('cartOffcanvasBody').innerHTML = html;
                });
        };

        // Handle Add to Cart Forms
        document.body.addEventListener('submit', function (e) {
            if (e.target.matches('form[action="api/cart.php"]')) {
                e.preventDefault(); // Stop normal submission

                const formData = new FormData(e.target);

                // Show loading state on button
                const btn = e.submitter || e.target.querySelector('button[type="submit"]') || e.target.querySelector('button');
                if (!btn) return; // specific safety check

                const originalText = btn.innerHTML;
                btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Adding...';
                btn.disabled = true;

                fetch('api/cart.php', {
                    method: 'POST',
                    body: formData
                })
                    .then(response => {
                        // Update Cart Count (reload page or fetch count - for now just open sidebar)
                        window.refreshSideCart();
                        bsOffcanvas.show();

                        // Reset button
                        btn.innerHTML = '<i class="fas fa-check me-1"></i> Added';
                        setTimeout(() => {
                            btn.innerHTML = originalText;
                            btn.disabled = false;
                        }, 2000);
                    })
                    .catch(err => {
                        console.error('Error adding to cart:', err);
                        btn.innerHTML = originalText;
                        btn.disabled = false;
                    });
            }
        });

        // Load cart on open
        cartOffcanvas.addEventListener('show.bs.offcanvas', function () {
            window.refreshSideCart();
        });
    }
});
