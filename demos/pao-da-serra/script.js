document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('contact-form');
  const feedback = document.getElementById('form-feedback');

  form.addEventListener('submit', function(e) {
    e.preventDefault();
    feedback.textContent = '';
    const name = form.name.value.trim();
    const email = form.email.value.trim();
    const message = form.message.value.trim();
    let valid = true;
    if (!name) {
      valid = false;
      feedback.textContent = 'Por favor, informe seu nome.';
      form.name.focus();
      return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      valid = false;
      feedback.textContent = 'Por favor, informe um e‑mail válido.';
      form.email.focus();
      return;
    }
    if (!message) {
      valid = false;
      feedback.textContent = 'Por favor, escreva sua mensagem.';
      form.message.focus();
      return;
    }
    if (valid) {
      feedback.style.color = 'green';
      feedback.textContent = 'Mensagem enviada com sucesso!';
      form.reset();
    }
  });
});