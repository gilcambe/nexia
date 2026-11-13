<?php $pagina = ''; include __DIR__ . '/topo.php'; ?>
    <section class="destaque">
      <h1>{{titulo}}</h1>
      <p>Bem-vindo ao site de {{nome}}. Fale com a gente pelo WhatsApp ou deixe sua mensagem.</p>
      <div class="acoes">
        <a class="botao" href="https://wa.me/{{whatsapp}}" target="_blank" rel="noopener">Chamar no WhatsApp</a>
        <a class="botao leve" href="contato.php">Enviar mensagem</a>
      </div>
    </section>
<?php include __DIR__ . '/rodape.php'; ?>
