<?php
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
// Cart count placeholder
$cart_count = 0; 
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Shreyash Pharmacy - Trusted Online Store</title>
    
    <!-- Google Fonts -->
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
    
    <!-- Bootstrap 5 CSS -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    
    <!-- FontAwesome -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    
    <!-- Custom CSS -->
    <link rel="stylesheet" href="assets/css/style.css">
</head>
<body>

<!-- 1. Top Bar -->
<div class="header-top">
    <div class="container">
        <div class="d-none d-md-block">
             <div id="topBarCarousel" class="carousel slide carousel-fade" data-bs-ride="carousel" data-bs-interval="3000">
                <div class="carousel-inner">
                    <div class="carousel-item active">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <span class="me-3"><i class="fas fa-shipping-fast me-1"></i> Free Shipping on orders above ₹500</span>
                                <span><i class="fas fa-check-circle me-1"></i> 100% Genuine Products</span>
                            </div>
                             <div class="ms-auto">
                                <a href="#" class="text-white text-decoration-none me-3"><i class="fas fa-mobile-alt me-1"></i> Download App</a>
                                <a href="contact.php" class="text-white text-decoration-none border-start ps-3">Support</a>
                            </div>
                        </div>
                    </div>
                    <div class="carousel-item">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <span class="me-3"><i class="fas fa-clock me-1"></i> 24/7 Customer Support Available</span>
                                <span><i class="fas fa-prescription me-1"></i> Upload Prescription for Fast Order</span>
                            </div>
                             <div class="ms-auto">
                                <a href="#" class="text-white text-decoration-none me-3"><i class="fas fa-mobile-alt me-1"></i> Download App</a>
                                <a href="contact.php" class="text-white text-decoration-none border-start ps-3">Support</a>
                            </div>
                        </div>
                    </div>
                     <div class="carousel-item">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <span class="me-3"><i class="fas fa-percent me-1"></i> Flat 15% Off on First Order</span>
                                <span><i class="fas fa-user-md me-1"></i> Expert Pharmacist Consultation</span>
                            </div>
                             <div class="ms-auto">
                                <a href="#" class="text-white text-decoration-none me-3"><i class="fas fa-mobile-alt me-1"></i> Download App</a>
                                <a href="contact.php" class="text-white text-decoration-none border-start ps-3">Support</a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <!-- Mobile Top Bar Content -->
        <div class="d-md-none text-center small">
            <span><i class="fas fa-shipping-fast me-1"></i> Free Shipping on orders above ₹500</span>
        </div>
    </div>
</div>

<!-- Sticky Wrapper -->
<div id="stickyHeader" class="sticky-top-custom">
    <!-- 2. Main Header (Logo, Search, Actions) -->
    <div class="header-main border-bottom">
        <div class="container">
            <div class="row align-items-center">
                <!-- Logo & Mobile Toggle -->
                <div class="col-md-3 col-6 d-flex align-items-center">
                    <button class="btn btn-link text-dark me-2 d-md-none p-0 border-0" type="button" data-bs-toggle="offcanvas" data-bs-target="#mobileMenu" aria-controls="mobileMenu">
                        <i class="fas fa-bars fa-lg"></i>
                    </button>
                    <a class="navbar-brand d-flex align-items-center" href="index.php">
                        <i class="fas fa-heartbeat fa-2x text-primary-custom me-2"></i>
                        <div>
                            <span class="d-block fw-bold text-dark lh-1" style="font-size: 1.5rem;">Shreyash</span>
                            <span class="d-block text-secondary-custom small lh-1 fw-bold" style="letter-spacing: 1px;">PHARMACY</span>
                        </div>
                    </a>
                </div>

                <!-- Search Bar (Desktop) -->
                <div class="col-md-6 d-none d-md-block">
                    <form action="products.php" method="GET" class="w-100">
                        <div class="search-bar-container">
                            <button class="location-picker" type="button">
                                <i class="fas fa-map-marker-alt text-danger me-1"></i> Kolhapur <i class="fas fa-caret-down text-muted ms-1"></i>
                            </button>
                            <input type="text" name="q" class="search-input" placeholder="Search for medicines, health products..." value="<?php echo isset($_GET['q']) ? htmlspecialchars($_GET['q']) : ''; ?>">
                            <button type="submit" class="search-btn"><i class="fas fa-search"></i></button>
                        </div>
                    </form>
                </div>

                <!-- Actions -->
                <div class="col-md-3 col-6 text-end">
                    <div class="d-flex align-items-center justify-content-end gap-3">
                        <?php if(isset($_SESSION['user_id'])): ?>
                             <div class="dropdown">
                                <a href="#" class="text-dark text-decoration-none d-flex align-items-center" data-bs-toggle="dropdown">
                                    <div class="text-end me-3 d-none d-lg-block">
                                        <span class="d-block text-muted text-uppercase fw-bold" style="font-size: 0.75rem; letter-spacing: 0.5px;">Hello,</span>
                                        <span class="fw-bold text-dark" style="font-size: 1rem;"><?php echo explode(' ', $_SESSION['fullname'])[0]; ?></span>
                                    </div>
                                    <i class="fas fa-user-circle fa-2x text-primary-custom"></i>
                                </a>
                                <ul class="dropdown-menu dropdown-menu-end shadow border-0">
                                    <?php if($_SESSION['role'] === 'admin' || $_SESSION['role'] === 'manager'): ?>
                                        <li><a class="dropdown-item" href="admin/index.php">Dashboard</a></li>
                                    <?php endif; ?>
                                    <li><a class="dropdown-item" href="my_orders.php">My Orders</a></li>
                                    <li><a class="dropdown-item" href="#">Prescriptions</a></li>
                                    <li><hr class="dropdown-divider"></li>
                                    <li><a class="dropdown-item text-danger" href="logout.php">Logout</a></li>
                                </ul>
                            </div>
                        <?php else: ?>
                            <a href="login.php" class="text-dark text-decoration-none d-flex align-items-center">
                                <i class="far fa-user fa-lg me-2"></i>
                                <span class="d-none d-lg-inline fw-medium">Login</span>
                            </a>
                        <?php endif; ?>

                        <a href="cart.php" class="text-dark text-decoration-none position-relative">
                            <i class="fas fa-shopping-cart fa-lg"></i>
                            <?php if($cart_count > 0): ?>
                                <span class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" style="font-size: 0.6rem;">
                                    <?php echo $cart_count; ?>
                                </span>
                            <?php endif; ?>
                            <span class="d-none d-lg-inline ms-1 fw-medium">Cart</span>
                        </a>
                    </div>
                </div>
            </div>
            
            <!-- Mobile Search (Visible only on mobile) -->
            <div class="d-md-none mt-3">
                 <form action="products.php" method="GET" class="w-100">
                     <div class="search-bar-container">
                        <input type="text" name="q" class="search-input" placeholder="Search..." value="<?php echo isset($_GET['q']) ? htmlspecialchars($_GET['q']) : ''; ?>">
                        <button type="submit" class="search-btn"><i class="fas fa-search"></i></button>
                    </div>
                </form>
            </div>
        </div>
    </div>

    <!-- 3. Navigation Bar -->
    <div class="header-bottom d-none d-md-block border-bottom">
        <div class="container">
            <nav class="d-flex justify-content-between">
                <div>
                    <a href="products.php" class="nav-category-link">Medicines</a>
                    <a href="products.php?cat=healthcare" class="nav-category-link">Healthcare</a>
                    <a href="products.php?cat=baby" class="nav-category-link">Mom & Baby</a>
                    <a href="products.php?cat=devices" class="nav-category-link">Health Devices</a>
                    <a href="stores.php" class="nav-category-link">Stores</a>
                    <a href="services.php" class="nav-category-link">Services</a>
                </div>
                <div>
                    <a href="#" class="nav-category-link text-primary-custom"><i class="fas fa-percent me-1"></i> Offers</a>
                </div>
            </nav>
        </div>


    </div>
</div>

<!-- Mobile Menu Offcanvas -->
<div class="offcanvas offcanvas-start" tabindex="-1" id="mobileMenu" aria-labelledby="mobileMenuLabel">
    <div class="offcanvas-header border-bottom bg-primary-custom text-white">
        <div class="d-flex align-items-center">
            <?php if(isset($_SESSION['user_id'])): ?>
                <div class="me-3">
                    <div class="bg-white rounded-circle d-flex align-items-center justify-content-center text-primary-custom fw-bold" style="width: 40px; height: 40px;">
                        <?php echo strtoupper(substr($_SESSION['fullname'], 0, 1)); ?>
                    </div>
                </div>
                <div>
                    <h6 class="offcanvas-title mb-0" id="mobileMenuLabel">Hello, <?php echo explode(' ', $_SESSION['fullname'])[0]; ?></h6>
                    <small class="opacity-75">Welcome back!</small>
                </div>
            <?php else: ?>
                 <div class="me-3">
                    <div class="bg-white rounded-circle d-flex align-items-center justify-content-center text-primary-custom fw-bold" style="width: 40px; height: 40px;">
                        <i class="fas fa-user"></i>
                    </div>
                </div>
                <div>
                    <h6 class="offcanvas-title mb-0" id="mobileMenuLabel">Welcome</h6>
                    <a href="login.php" class="text-white text-decoration-underline small">Login / Register</a>
                </div>
            <?php endif; ?>
        </div>
        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="offcanvas" aria-label="Close"></button>
    </div>
    <div class="offcanvas-body p-0">
        <div class="list-group list-group-flush">
            <a href="index.php" class="list-group-item list-group-item-action py-3 border-bottom"><i class="fas fa-home me-3 text-secondary"></i> Home</a>
            <a href="products.php" class="list-group-item list-group-item-action py-3 border-bottom"><i class="fas fa-pills me-3 text-secondary"></i> All Medicines</a>
            <a href="products.php?cat=healthcare" class="list-group-item list-group-item-action py-3 border-bottom"><i class="fas fa-heartbeat me-3 text-secondary"></i> Healthcare Products</a>
             <a href="products.php?cat=baby" class="list-group-item list-group-item-action py-3 border-bottom"><i class="fas fa-baby me-3 text-secondary"></i> Mom & Baby</a>
            <a href="stores.php" class="list-group-item list-group-item-action py-3 border-bottom"><i class="fas fa-store me-3 text-secondary"></i> Find Stores</a>
            <a href="services.php" class="list-group-item list-group-item-action py-3 border-bottom"><i class="fas fa-concierge-bell me-3 text-secondary"></i> Our Services</a>
            
            <?php if(isset($_SESSION['user_id'])): ?>
                <div class="p-3 bg-light fw-bold small text-uppercase text-muted mt-2">My Account</div>
                <?php if($_SESSION['role'] === 'admin' || $_SESSION['role'] === 'manager'): ?>
                    <a href="admin/index.php" class="list-group-item list-group-item-action py-3 border-bottom"><i class="fas fa-tachometer-alt me-3 text-secondary"></i> Dashboard</a>
                <?php endif; ?>
                <a href="my_orders.php" class="list-group-item list-group-item-action py-3 border-bottom"><i class="fas fa-box me-3 text-secondary"></i> My Orders</a>
                <a href="profile.php" class="list-group-item list-group-item-action py-3 border-bottom"><i class="fas fa-user me-3 text-secondary"></i> My Profile</a>
                <a href="logout.php" class="list-group-item list-group-item-action py-3 border-bottom text-danger"><i class="fas fa-sign-out-alt me-3"></i> Logout</a>
            <?php endif; ?>
            
            <div class="p-3 bg-light fw-bold small text-uppercase text-muted mt-2">Support</div>
            <a href="contact.php" class="list-group-item list-group-item-action py-3 border-bottom"><i class="fas fa-headset me-3 text-secondary"></i> Customer Support</a>
             <a href="faq.php" class="list-group-item list-group-item-action py-3 border-bottom"><i class="fas fa-question-circle me-3 text-secondary"></i> FAQs</a>
        </div>
    </div>
</div>

<!-- Side Cart Offcanvas -->
<div class="offcanvas offcanvas-end" tabindex="-1" id="cartOffcanvas" aria-labelledby="cartOffcanvasLabel">
    <div class="offcanvas-header border-bottom">
        <h5 class="offcanvas-title fw-bold" id="cartOffcanvasLabel">Your Cart</h5>
        <button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Close"></button>
    </div>
    <div class="offcanvas-body p-0 d-flex flex-column" id="cartOffcanvasBody">
        <!-- Cart Items will be loaded here via AJAX -->
        <div class="d-flex align-items-center justify-content-center h-100 text-muted">
            <div class="text-center">
                 <div class="spinner-border text-primary-custom" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
            </div>
        </div>
    </div>
</div>

<script>
    // Add shadow to sticky header on scroll
    window.addEventListener('scroll', function() {
        const header = document.getElementById('stickyHeader');
        if (window.scrollY > 10) {
            header.classList.add('sticky-shadow');
        } else {
            header.classList.remove('sticky-shadow');
        }
    });
</script>
