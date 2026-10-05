// script.js – validação simples do formulário de contato
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('contact-form');
  if (!form) return;

  const nameInput = form.elements.namedItem('name');
  const emailInput = form.elements.namedItem('email');
  const messageInput = form.elements.namedItem('message');

  const showError = (input, message) => {
    const errorEl = input.parentElement.querySelector('.error');
    if (errorEl) errorEl.textContent = message;
    input.setAttribute('aria-invalid', 'true');
  };
  const clearError = (input) => {
    const errorEl = input.parentElement.querySelector('.error');
    if (errorEl) errorEl.textContent = '';
    input.removeAttribute('aria-invalid');
  };

  const validateName = () => {
    const value = nameInput.value.trim();
    if (value === '') {
      showError(nameInput, 'Por favor, informe seu nome.');
      return false;
    }
    clearError(nameInput);
    return true;
  };

  const validateEmail = () => {
    const value = emailInput.value.trim();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(value)) {
      showError(emailInput, 'Informe um e‑mail válido.');
      return false;
    }
    clearError(emailInput);
    return true;
  };

  const validateMessage = () => {
    const value = messageInput.value.trim();
    if (value.length < 10) {
      showError(messageInput, 'A mensagem deve ter ao menos 10 caracteres.');
      return false;
    }
    clearError(messageInput);
    return true;
  };

  // listeners para validação ao sair do campo
  nameInput.addEventListener('blur', validateName);
  emailInput.addEventListener('blur', validateEmail);
  messageInput.addEventListener('blur', validateMessage);

  form.addEventListener('submit', (e) => {
    const isNameValid = validateName();
    const isEmailValid = validateEmail();
    const isMessageValid = validateMessage();
    if (!isNameValid || !isEmailValid || !isMessageValid) {
      e.preventDefault();
    }
  });

  // Menu toggle para dispositivos móveis
  const navToggle = document.querySelector('.nav-toggle');
  const navList = document.getElementById('menu');
  if (navToggle && navList) {
    navToggle.addEventListener('click', () => {
      const expanded = navToggle.getAttribute('aria-expanded') === 'true' || false;
      navToggle.setAttribute('aria-expanded', !expanded);
      navList.classList.toggle('is-open', !expanded);
    });
  }
});
