<?php
/**
 * NEXIA Viajante Pro — Funções de Auxílio de Sessão e Autenticação
 */

function validarTokenAdmin($pdo, $slug, $token) {
    if (!$token) return false;
    $tokenHash = hash('sha256', $token);
    $stmt = $pdo->prepare("SELECT * FROM sessoes WHERE slug = ? AND token_hash = ? AND expira_em > NOW()");
    $stmt->execute([$slug, $tokenHash]);
    return (bool)$stmt->fetch();
}
