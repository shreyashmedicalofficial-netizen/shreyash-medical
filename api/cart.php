<?php
session_start();
include '../config/db.php';

// Initialize cart if not exists
if (!isset($_SESSION['cart'])) {
    $_SESSION['cart'] = [];
}

$action = $_POST['action'] ?? $_GET['action'] ?? '';

if ($action === 'add') {
    $product_id = intval($_POST['product_id']);
    $qty = intval($_POST['qty']);
    
    if ($product_id > 0 && $qty > 0) {
        if (isset($_SESSION['cart'][$product_id])) {
            $_SESSION['cart'][$product_id] += $qty;
        } else {
            $_SESSION['cart'][$product_id] = $qty;
        }
    }
    
    // Redirect back to referring page or cart
    $referer = $_SERVER['HTTP_REFERER'] ?? '../cart.php';
    header("Location: $referer");
    exit;
}

if ($action === 'remove') {
    $product_id = intval($_GET['id']);
    if (isset($_SESSION['cart'][$product_id])) {
        unset($_SESSION['cart'][$product_id]);
    }
    header("Location: ../cart.php");
    exit;
}

if ($action === 'update') {
    $product_id = intval($_POST['product_id']);
    $qty = intval($_POST['qty']);
    
    if ($qty > 0) {
        $_SESSION['cart'][$product_id] = $qty;
    } else {
        unset($_SESSION['cart'][$product_id]);
    }
    header("Location: ../cart.php");
    exit;
}

if ($action === 'clear') {
    $_SESSION['cart'] = [];
    header("Location: ../cart.php");
    exit;
}

// If no action, redirect to cart
header("Location: ../cart.php");
exit;
