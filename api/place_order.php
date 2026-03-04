<?php
session_start();
include '../config/db.php';

// Validate User Login
if (!isset($_SESSION['user_id'])) {
    header("Location: ../login.php");
    exit;
}

// Validate Cart
if (empty($_SESSION['cart'])) {
    header("Location: ../products.php");
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $user_id = $_SESSION['user_id'];
    
    // Address Details
    $full_name = htmlspecialchars($_POST['full_name']);
    $mobile = htmlspecialchars($_POST['mobile']);
    $address = htmlspecialchars($_POST['address_line1'] . ', ' . $_POST['address_line2'] . ', ' . $_POST['city'] . ' - ' . $_POST['pincode']);
    
    try {
        $pdo->beginTransaction();

        // 1. Calculate Total Amount
        $total_amount = 0;
        $cart_items = [];
        
        $ids = implode(',', array_keys($_SESSION['cart']));
        $stmt = $pdo->query("SELECT * FROM products WHERE id IN ($ids)");
        $products = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($products as $product) {
            $qty = $_SESSION['cart'][$product['id']];
            $price = $product['price'];
            $total_amount += $price * $qty;
            
            $cart_items[] = [
                'product_id' => $product['id'],
                'quantity' => $qty,
                'price' => $price
            ];
        }
        
        // Add platform fee
        $platform_fee = 3;
        $final_total = $total_amount + $platform_fee;

        // 2. Insert into Orders Table
        $stmt = $pdo->prepare("INSERT INTO orders (user_id, total_amount, status, shipping_address) VALUES (?, ?, 'pending', ?)");
        $stmt->execute([$user_id, $final_total, $address]);
        $order_id = $pdo->lastInsertId();

        // 3. Insert into Order Items Table
        $stmt = $pdo->prepare("INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)");
        foreach ($cart_items as $item) {
            $stmt->execute([$order_id, $item['product_id'], $item['quantity'], $item['price']]);
        }

        // 4. Create Admin Notification
        $notif_msg = "New order #$order_id received from " . $full_name . " (₹" . $final_total . ")";
        $stmt = $pdo->prepare("INSERT INTO notifications (message, type, created_at) VALUES (?, 'order', NOW())");
        $stmt->execute([$notif_msg]);

        $pdo->commit();

        // 4. Clear Cart & Set Success Session
        unset($_SESSION['cart']);
        
        // Calculate estimated delivery
        $delivery_date = date('d M, Y', strtotime('+2 days'));

        $_SESSION['last_order'] = [
            'id' => $order_id,
            'amount' => $final_total,
            'delivery_date' => $delivery_date
        ];

        header("Location: ../order_success.php");
        exit;

    } catch (Exception $e) {
        $pdo->rollBack();
        error_log("Order Placement Error: " . $e->getMessage());
        // Redirect back with error (In a real app, show error message)
        header("Location: ../checkout.php?error=1");
        exit;
    }
}
?>
