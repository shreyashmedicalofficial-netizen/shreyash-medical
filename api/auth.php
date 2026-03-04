<?php
session_start();
include '../config/db.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';

    if ($action === 'register') {
        $fullname = trim($_POST['fullname']);
        $email = trim($_POST['email']);
        $phone = trim($_POST['phone']);
        $password = $_POST['password'];

        if (empty($fullname) || empty($email) || empty($password)) {
            header("Location: ../register.php?error=All fields are required");
            exit;
        }

        // Check if email exists
        $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
        $stmt->execute([$email]);
        if ($stmt->fetch()) {
            header("Location: ../register.php?error=Email already exists");
            exit;
        }

        // Hash password
        $hashed_password = password_hash($password, PASSWORD_DEFAULT);

        try {
            $stmt = $pdo->prepare("INSERT INTO users (fullname, email, phone, password, role) VALUES (?, ?, ?, ?, 'customer')");
            $stmt->execute([$fullname, $email, $phone, $hashed_password]);
            header("Location: ../login.php?success=Registration successful! Please login.");
            exit;
        } catch (PDOException $e) {
            header("Location: ../register.php?error=Registration failed: " . $e->getMessage());
            exit;
        }

    } elseif ($action === 'login') {
        $email = trim($_POST['email']);
        $password = $_POST['password'];
        $source = $_POST['source'] ?? '';
        $loginPage = ($source === 'admin') ? '../admin/login.html' : '../login.php';

        if (empty($email) || empty($password)) {
            header("Location: " . $loginPage . "?error=" . urlencode("All fields are required"));
            exit;
        }

        // Join with branches table to get branch name
        $stmt = $pdo->prepare("SELECT u.*, b.name as branch_name FROM users u LEFT JOIN branches b ON u.branch_id = b.id WHERE u.email = ?");
        $stmt->execute([$email]);
        $user = $stmt->fetch();

        if ($user && password_verify($password, $user['password'])) {
            $_SESSION['user_id'] = $user['id'];
            $_SESSION['fullname'] = $user['fullname'];
            $_SESSION['role'] = $user['role'];
            $_SESSION['branch_id'] = $user['branch_id'];
            $_SESSION['branch_name'] = $user['branch_name'] ?? null;

            // Redirect based on role
            if ($user['role'] === 'admin' || $user['role'] === 'manager') {
                header("Location: ../admin/index.html");
            } else {
                header("Location: ../index.php");
            }
            exit;
        } else {
            header("Location: " . $loginPage . "?error=" . urlencode("Invalid email or password"));
            exit;
        }
    }
}
?>
