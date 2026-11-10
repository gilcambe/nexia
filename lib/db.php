<?php
/**
 * NEXIA Viajante Pro — Conexão PDO com o Banco de Dados MySQL
 */

function obterConexaoDb() {
    $host = getenv('DB_HOST') ?: 'localhost';
    $dbname = getenv('DB_NAME') ?: 'viajantepro';
    $user = getenv('DB_USER') ?: 'root';
    $pass = getenv('DB_PASS') ?: '';

    try {
        $dsn = "mysql:host={$host};dbname={$dbname};charset=utf8mb4";
        $pdo = new PDO($dsn, $user, $pass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        return $pdo;
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Erro de conexão com o banco de dados.']);
        exit;
    }
}
