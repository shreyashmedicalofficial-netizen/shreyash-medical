<?php
require 'config/db.php';

try {
    $sql = "ALTER TABLE orders ADD COLUMN branch_id INT DEFAULT NULL; 
            ALTER TABLE orders ADD FOREIGN KEY (branch_id) REFERENCES branches(id);";
    $pdo->exec($sql);
    echo "Database updated successfully.";
} catch (PDOException $e) {
    if (strpos($e->getMessage(), "Duplicate column name") !== false) {
        echo "Column already exists. Skipping.";
    } else {
        echo "Error updating database: " . $e->getMessage();
        exit(1);
    }
}
?>
