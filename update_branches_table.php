<?php
include 'config/db.php';

try {
    // Check if columns exist, if not add them
    $columns = [
        'address' => "ALTER TABLE branches ADD COLUMN address TEXT",
        'phone' => "ALTER TABLE branches ADD COLUMN phone VARCHAR(20)",
        'email' => "ALTER TABLE branches ADD COLUMN email VARCHAR(100)",
        'is_active' => "ALTER TABLE branches ADD COLUMN is_active TINYINT(1) DEFAULT 1"
    ];

    foreach ($columns as $col => $sql) {
        try {
            $pdo->exec($sql);
            echo "Added column: $col<br>";
        } catch (PDOException $e) {
            // Column likely exists
            echo "Column $col likely exists or error: " . $e->getMessage() . "<br>";
        }
    }
    echo "Branches table schema check complete.";
} catch (PDOException $e) {
    echo "Error: " . $e->getMessage();
}
?>
