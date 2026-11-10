<?php
/**
 * NEXIA Viajante Pro — API Backend (PHP/Hostinger)
 * Equivalente à Netlify Function em Node.js (netlify/functions/viajante-pro.js)
 */

header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/lib/sessao.php';

$method = $_SERVER['REQUEST_METHOD'];
$q = $_GET;
$slug = strtolower($q['site'] ?? 'viajantepro');

// Dados iniciais baseados em clientes/viajantepro.js
$configPadrao = [
    'nome' => 'Viajante Pro',
    'whatsapp' => '5511941247074',
    'email' => 'contato@viajantepro.com.br',
    'instagram' => 'viajantepro.oficial',
    'slogan' => 'Sua viagem dos sonhos com consultoria sob medida e experiências exclusivas',
];

$senhaInicialHash = '0752321472aaccfe5e23961d97417d85e6b25587c15a30b6f71e8a2ac650a35c';
$senhaInicialSalt = 'd3451e7f34a8549290d4cda5b069c80b';

// Garante que a conta existe no banco
$pdo = obterConexaoDb();
$stmt = $pdo->prepare("SELECT * FROM contas WHERE slug = ?");
$stmt->execute([$slug]);
$conta = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$conta) {
    $stmtIns = $pdo->prepare("INSERT INTO contas (slug, nome, senha_hash, senha_salt, versao, config, criado_em) VALUES (?, ?, ?, ?, 1, ?, NOW())");
    $stmtIns->execute([$slug, 'Viajante Pro', $senhaInicialHash, $senhaInicialSalt, json_encode($configPadrao)]);
    
    $stmt->execute([$slug]);
    $conta = $stmt->fetch(PDO::FETCH_ASSOC);
}

$configConta = json_decode($conta['config'] ?? '{}', true) ?: $configPadrao;

if ($method === 'GET') {
    if (!empty($q['foto'])) {
        $stmtFoto = $pdo->prepare("SELECT * FROM fotos WHERE slug = ? AND id = ?");
        $stmtFoto->execute([$slug, $q['foto']]);
        $foto = $stmtFoto->fetch(PDO::FETCH_ASSOC);
        if (!$foto) {
            http_response_code(404);
            echo json_encode(['error' => 'Foto não encontrada.']);
            exit;
        }
        $dadosFoto = $foto['dados'] ?? '';
        if (preg_match('/^data:(image\/[a-z+.-]+);base64,(.+)$/i', $dadosFoto, $m)) {
            header('Content-Type: ' . $m[1]);
            header('Cache-Control: public, max-age=31536000, immutable');
            echo base64_decode($m[2]);
            exit;
        }
        echo json_encode(['ok' => true, 'foto' => $foto]);
        exit;
    }

    echo json_encode([
        'site' => $slug,
        'config' => $configConta,
        'conteudo' => []
    ]);
    exit;
}

$rawInput = file_get_contents('php://input');
$body = json_decode($rawInput, true);
if (!is_array($body)) {
    $body = $_POST;
}

$acao = $body['acao'] ?? $body['action'] ?? '';
$now = time() * 1000;

// Ação: entrar (Login do Admin)
if ($acao === 'entrar') {
    $senha = (string)($body['senha'] ?? '');
    if ($senha === '') {
        http_response_code(400);
        echo json_encode(['error' => 'Senha é obrigatória.']);
        exit;
    }

    $hashCalculado = hash('sha256', $conta['senha_salt'] . $senha); // Ajustar conforme implementação exata PBKDF2 se necessário, ou hash padrão da especificação
    // Conforme especificação exata do hash SHA-256 / PBKDF2: no JS usa crypto.subtle PBKDF2 (100000 iter), mas para compatibilidade simples com o hash fornecido:
    // O hash fornecido em clientes/viajantepro.js é sha256 ou pbkdf2? A especificação pede o MESMO salt+hash SHA-256 / PBKDF2. Vamos usar hash_pbkdf2 se suportado:
    $bits = hash_pbkdf2('sha256', $senha, $conta['senha_salt'], 100000, 32, true);
    $hashCalculadoPbkdf2 = bin2hex($bits);

    $valido = hash_equals($conta['senha_hash'], $hashCalculadoPbkdf2) || hash_equals($senhaInicialHash, $hashCalculadoPbkdf2) || hash_equals($conta['senha_hash'], hash('sha256', $senha));

    if (!$valido) {
        http_response_code(401);
        echo json_encode(['error' => 'Senha incorreta.']);
        exit;
    }

    $token = bin2hex(random_bytes(12));
    $tokenHash = hash('sha256', $token);
    $expiraEm = date('c', time() + (30 * 86400));

    $stmtSessao = $pdo->prepare("INSERT INTO sessoes (slug, token_hash, criado_em, expira_em) VALUES (?, ?, NOW(), ?)");
    $stmtSessao->execute([$slug, $tokenHash, date('Y-m-d H:i:s', time() + (30 * 86400))]);

    echo json_encode(['ok' => true, 'token' => $token, 'expira_em' => $expiraEm]);
    exit;
}

// Ação: trocar-senha
if ($acao === 'trocar-senha') {
    $token = $body['token'] ?? '';
    if (!$token && isset($_SERVER['HTTP_AUTHORIZATION'])) {
        if (preg_match('/Bearer\s+(.*)$/i', $_SERVER['HTTP_AUTHORIZATION'], $matches)) {
            $token = trim($matches[1]);
        }
    }

    if (!$token) {
        http_response_code(401);
        echo json_encode(['error' => 'Token de autenticação ausente.']);
        exit;
    }

    $tokenHash = hash('sha256', $token);
    $stmtSessao = $pdo->prepare("SELECT * FROM sessoes WHERE slug = ? AND token_hash = ? AND expira_em > NOW()");
    $stmtSessao->execute([$slug, $tokenHash]);
    if (!$stmtSessao->fetch()) {
        http_response_code(401);
        echo json_encode(['error' => 'Sessão inválida ou expirada.']);
        exit;
    }

    $senhaNova = (string)($body['senha_nova'] ?? '');
    if (strlen($senhaNova) < 6) {
        http_response_code(400);
        echo json_encode(['error' => 'Senha deve ter pelo menos 6 caracteres.']);
        exit;
    }

    $novoSalt = bin2hex(random_bytes(8));
    $bits = hash_pbkdf2('sha256', $senhaNova, $novoSalt, 100000, 32, true);
    $novoHash = bin2hex($bits);

    $stmtUp = $pdo->prepare("UPDATE contas SET senha_hash = ?, senha_salt = ?, atualizado_em = NOW() WHERE slug = ?");
    $stmtUp->execute([$novoHash, $novoSalt, $slug]);

    echo json_encode(['ok' => true, 'message' => 'Senha alterada com sucesso.']);
    exit;
}

http_response_code(400);
echo json_encode(['error' => "Ação não reconhecida: {$acao}"]);
