<?php
// Topo comum de todas as páginas. $pagina = título da página atual (opcional).
$pagina = isset($pagina) ? $pagina : '';
?><!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><?php echo $pagina !== '' ? htmlspecialchars($pagina, ENT_QUOTES, 'UTF-8') . ' — ' : ''; ?>{{titulo}}</title>
  <link rel="stylesheet" href="estilo.css">
</head>
<body>
  <header class="topo">
    <a class="marca" href="index.php">{{nome}}</a>
    <nav><a href="index.php">Início</a><a href="contato.php">Contato</a></nav>
  </header>
  <main class="caixa">
