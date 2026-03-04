<?php
session_start();
include '../config/db.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';

    if ($action !== 'create_admin') {
        header('Location: ../admin/create-admin.html?error=' . urlencode('Invalid request'));
        exit;
    }

    $fullname = trim($_POST['fullname'] ?? '');
    $email = trim($_POST['email'] ?? '');
    $phone = trim($_POST['phone'] ?? '');
    $role = trim($_POST['role'] ?? 'admin');
    $password = $_POST['password'] ?? '';
    $confirm_password = $_POST['confirm_password'] ?? '';

    // Validate role
    if (!in_array($role, ['admin', 'manager'])) {
        $role = 'admin';
    }

    // Basic validation
    if ($fullname === '' || $email === '' || $password === '' || $confirm_password === '') {
        header('Location: ../admin/create-admin.html?error=' . urlencode('All required fields must be filled.'));
        exit;
    }

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        header('Location: ../admin/create-admin.html?error=' . urlencode('Please enter a valid email address.'));
        exit;
    }

    if (strlen($password) < 6) {
        header('Location: ../admin/create-admin.html?error=' . urlencode('Password must be at least 6 characters.'));
        exit;
    }

    if ($password !== $confirm_password) {
        header('Location: ../admin/create-admin.html?error=' . urlencode('Passwords do not match.'));
        exit;
    }

    // Check if email already exists
    try {
        $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
        $stmt->execute([$email]);
        if ($stmt->fetch()) {
            header('Location: ../admin/create-admin.html?error=' . urlencode('Email is already in use.'));
            exit;
        }

        $hashed_password = password_hash($password, PASSWORD_DEFAULT);

        $insert = $pdo->prepare("INSERT INTO users (fullname, email, phone, password, role) VALUES (?, ?, ?, ?, ?)");
        $insert->execute([$fullname, $email, $phone, $hashed_password, $role]);

        // Redirect to admin login page after successful creation
        header('Location: ../admin/login.html?success=' . urlencode('Admin user created successfully. Please login.'));
        exit;
    } catch (PDOException $e) {
        header('Location: ../admin/create-admin.html?error=' . urlencode('Failed to create admin: ' . $e->getMessage()));
        exit;
    }
}

header('Location: ../admin/create-admin.html');
exit;

