<?php
// Contato sem banco: confere os campos e monta o link do WhatsApp com a mensagem pronta. Nada é gravado.
$pagina = 'Contato';
$erros = [];
$link = '';
$nomeCampo = '';
$mensagem = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $nomeCampo = trim((string)($_POST['nome'] ?? ''));
  $mensagem = trim((string)($_POST['mensagem'] ?? ''));
  if ($nomeCampo === '' || mb_strlen($nomeCampo) > 80) $erros[] = 'Escreva seu nome (até 80 letras).';
  if ($mensagem === '' || mb_strlen($mensagem) > 600) $erros[] = 'Escreva a mensagem (até 600 letras).';
  if (!$erros) $link = 'https://wa.me/{{whatsapp}}?text=' . rawurlencode('Olá! Sou ' . $nomeCampo . '. ' . $mensagem);
}
$h = function ($s) { return htmlspecialchars($s, ENT_QUOTES, 'UTF-8'); };
include __DIR__ . '/topo.php';
?>
    <section class="cartao">
      <h1>Contato</h1>
      <?php if ($link): ?>
        <p>Pronto! Toque no botão para enviar sua mensagem pelo WhatsApp.</p>
        <a class="botao" href="<?php echo $h($link); ?>" target="_blank" rel="noopener">Enviar no WhatsApp</a>
      <?php else: ?>
        <?php foreach ($erros as $e): ?><p class="erro"><?php echo $h($e); ?></p><?php endforeach; ?>
        <form method="post" action="contato.php">
          <label>Seu nome<input name="nome" maxlength="80" required value="<?php echo $h($nomeCampo); ?>"></label>
          <label>Mensagem<textarea name="mensagem" maxlength="600" rows="4" required><?php echo $h($mensagem); ?></textarea></label>
          <button class="botao" type="submit">Continuar</button>
        </form>
      <?php endif; ?>
    </section>
<?php include __DIR__ . '/rodape.php'; ?>
