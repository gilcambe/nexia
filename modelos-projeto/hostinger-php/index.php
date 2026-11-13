<?php
$dados = [
    'nome' => 'Meu Negócio',
    'titulo' => 'Página Inicial',
    'cor' => '#0d9488',
    'whatsapp' => '5511999999999',
];

$arquivoModelo = __DIR__ . '/modelo.json';
if (file_exists($arquivoModelo)) {
    $conteudoModelo = json_decode(file_get_contents($arquivoModelo), true);
    if (is_array($conteudoModelo)) {
        if (isset($conteudoModelo['variaveis']) && is_array($conteudoModelo['variaveis'])) {
            $dados = array_merge($dados, $conteudoModelo['variaveis']);
        }
        foreach ($conteudoModelo as $chave => $valor) {
            if (is_string($valor) || is_numeric($valor)) {
                $dados[$chave] = (string)$valor;
            }
        }
    }
}

ob_start();
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{titulo}}</title>
    <link rel="stylesheet" href="estilo.css">
    <style>
        :root {
            --cor-primaria: {{cor}};
        }
    </style>
</head>
<body>
<?php include __DIR__ . '/topo.php'; ?>

<main class="principal">
    <section class="destaque">
        <div class="container">
            <h1>{{titulo}}</h1>
            <p>Bem-vindo ao site de {{nome}}.</p>
        </div>
    </section>
</main>

<?php include __DIR__ . '/rodape.php'; ?>
</body>
</html>
<?php
$html = ob_get_clean();

$substituicoes = [];
foreach ($dados as $chave => $valor) {
    if (is_string($valor) || is_numeric($valor)) {
        $substituicoes['{{' . $chave . '}}'] = htmlspecialchars((string)$valor, ENT_QUOTES, 'UTF-8');
    }
}

$html = str_replace(array_keys($substituicoes), array_values($substituicoes), $html);
$html = preg_replace('/\{\{[^}]+\}\}/', '', $html);

echo $html;
