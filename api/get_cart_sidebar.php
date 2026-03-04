<?php
session_start();
include '../config/db.php';

// Mock Products for display (same as other files for consistency)
$mock_products = [
    1 => ['id' => 1, 'name' => 'Paracetamol 650mg Tablet', 'price' => 30.00, 'mrp' => 37.50, 'pack_size' => 'Strip of 15', 'image' => 'https://img.freepik.com/free-photo/medicine-capsules-global-health-care-concept_53876-133185.jpg'],
    2 => ['id' => 2, 'name' => 'Vitamin C 500mg Chewable', 'price' => 350.00, 'mrp' => 350.00, 'image' => 'https://img.freepik.com/free-photo/bottle-full-vitamins_23-2148118742.jpg', 'pack_size' => 'Bottle of 30 Tablets'],
    3 => ['id' => 3, 'name' => 'Dr. Morepen Digital Thermometer', 'price' => 250.00, 'mrp' => 300.00, 'image' => 'https://img.freepik.com/free-photo/top-view-thermometers-with-copy-space_23-2148523315.jpg', 'pack_size' => '1 Unit'],
];

$cart_items = $_SESSION['cart'] ?? [];
$total_price = 0;
$item_count = 0;

if (empty($cart_items)) {
    echo '<div class="d-flex flex-column align-items-center justify-content-center h-100 text-muted p-4">
            <i class="fas fa-shopping-basket fa-3x mb-3 text-secondary opacity-50"></i>
            <h6 class="fw-bold">Your cart is empty</h6>
            <a href="products.php" class="btn btn-sm btn-primary-custom mt-3 px-4 rounded-pill">Start Shopping</a>
          </div>';
    exit;
}
?>

<div class="flex-grow-1 overflow-auto p-3">
    <?php foreach ($cart_items as $pid => $qty): 
        if (!isset($mock_products[$pid])) continue;
        $p = $mock_products[$pid];
        $line_total = $p['price'] * $qty;
        $total_price += $line_total;
        $item_count += $qty;
    ?>
    <div class="card border-0 shadow-sm mb-3">
        <div class="card-body p-2 d-flex align-items-center gap-3">
            <div class="bg-light rounded p-2 flex-shrink-0" style="width: 60px; height: 60px;">
                <img src="<?php echo $p['image']; ?>" class="w-100 h-100 object-fit-contain">
            </div>
            <div class="flex-grow-1">
                <h6 class="fw-bold fs-6 mb-1 text-truncate" style="max-width: 150px;"><?php echo $p['name']; ?></h6>
                <div class="d-flex justify-content-between align-items-center">
                    <small class="text-muted"><?php echo $qty; ?> x ₹<?php echo $p['price']; ?></small>
                    <span class="fw-bold text-primary-custom">₹<?php echo number_format($line_total, 0); ?></span>
                </div>
            </div>
             <a href="api/cart.php?action=remove&id=<?php echo $pid; ?>" class="text-secondary opacity-50 hover-danger"><i class="fas fa-times-circle"></i></a>
        </div>
    </div>
    <?php endforeach; ?>
</div>

<div class="p-3 border-top bg-light mt-auto">
    <div class="d-flex justify-content-between align-items-center mb-3">
        <span class="text-muted small fw-bold text-uppercase">Subtotal</span>
        <span class="fw-bold fs-5">₹<?php echo number_format($total_price, 2); ?></span>
    </div>
    <div class="d-grid gap-2">
        <a href="cart.php" class="btn btn-outline-dark fw-bold">View Cart</a>
        <a href="checkout.php" class="btn btn-primary-custom fw-bold">Checkout</a>
    </div>
</div>
