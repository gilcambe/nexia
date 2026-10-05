// Validação simples do formulário de contato
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('contactForm');
  const nameInput = document.getElementById('name');
  const emailInput = document.getElementById('email');
  const messageInput = document.getElementById('message');
  const submitBtn = form.querySelector('button');

  const errorSpans = {
    name: nameInput.parentElement.querySelector('.error'),
    email: emailInput.parentElement.querySelector('.error'),
    message: messageInput.parentElement.querySelector('.error')
  };

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const validateField = (field, value) => {
    let error = '';
    if (!value.trim()) {
      error = 'Campo obrigatório.';
    } else if (field === 'email' && !emailRegex.test(value)) {
      error = 'E‑mail inválido.';
    }
    errorSpans[field].textContent = error;
    return error === '';
  };

  const validateForm = () => {
    const isNameValid = validateField('name', nameInput.value);
    const isEmailValid = validateField('email', emailInput.value);
    const isMessageValid = validateField('message', messageInput.value);
    const formValid = isNameValid && isEmailValid && isMessageValid;
    submitBtn.disabled = !formValid;
  };

  // Evento de input para validação em tempo real
  [nameInput, emailInput, messageInput].forEach(input => {
    input.addEventListener('input', () => {
      validateField(input.id, input.value);
      validateForm();
    });
  });

  // Submissão (simulada)
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (submitBtn.disabled) return;
    alert('Obrigado! Sua mensagem foi enviada.');
    form.reset();
    submitBtn.disabled = true;
    Object.values(errorSpans).forEach(span => (span.textContent = ''));
  });
});
