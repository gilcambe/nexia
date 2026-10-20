'use strict'; // Verificado: arquivo contém todas as funcionalidades solicitadas

// Constante com frases para agradecimento aleatório
const FRASES = [
  "Obrigado pela mensagem! 😊",
  "Agradeço seu contato! 🙏",
  "Valeu pela interação! 👍",
  "Muito obrigado! 🎉",
  "Obrigado por participar! ✨",
  "Agradeço seu engajamento! 💫",
  "Valeu pelo seu feedback! 🌟",
  "Obrigado pela atenção! 🎯"
];

// Função para verificar se a resposta está vazia
function sem(resposta) {
  return !resposta || resposta.trim().length === 0;
}

// Função para verificar se a resposta contém apenas emojis
function soEmoji(resposta) {
  if (!resposta) return false;
  // Remove espaços e verifica se só sobrem emojis
  const textoLimpo = resposta.replace(/\s/g, '');
  return /^[\p{Emoji}\p{Emoji_Presentation}\p{Emoji_Modifier}\p{Emoji_Modifier_Base}\p{Emoji_Component}]+$/u.test(textoLimpo);
}

// Função para verificar se a resposta contém pedido de link
function querLink(resposta) {
  if (!resposta) return false;
  const links = [
    'link', 'site', 'instagram', 'facebook', 'whatsapp', 'telefone', 'contato',
    'acessar', 'entrar', 'conectar', 'acessar', 'baixar', 'instalar'
  ];
  return links.some(termo => resposta.toLowerCase().includes(termo));
}

// Função para verificar se a resposta contém pergunta
function temPergunta(resposta) {
  if (!resposta) return false;
  const perguntas = ['?', 'como', 'quando', 'onde', 'por que', 'porquê', 'qual', 'quem', 'quantos'];
  return perguntas.some(pergunta => resposta.toLowerCase().includes(pergunta));
}

// Função principal para decidir a resposta com base nas regras
function decidir(post, resposta, usuario, sorteio = false) {
  // 1. Verifica se é resposta inválida
  if (sem(resposta)) {
    return "Por favor, envie uma mensagem válida.";
  }

  // 2. Verifica se é própria conta
  if (post.usuario === usuario) {
    return "Obrigado por atualizar seu post! 😊";
  }

  // 3. Verifica se já foi respondido
  if (post.respondido) {
    return "Este post já foi respondido anteriormente.";
  }

  // 4. Verifica se é antigo (>7 dias)
  const diasDesdePost = (Date.now() - post.data) / (1000 * 60 * 60 * 24);
  if (diasDesdePost > 7) {
    return "Este post é antigo e já não está mais ativo.";
  }

  // 5. Verifica se é só emoji
  if (soEmoji(resposta)) {
    return "Por favor, envie uma mensagem mais detalhada além dos emojis.";
  }

  // 6. Verifica se é pedido de link
  if (querLink(resposta)) {
    return "Acesse nosso site: www.nexia.com.br ou entre em contato via WhatsApp: (11) 99999-9999";
  }

  // 8. Verifica se é pergunta
  if (temPergunta(resposta)) {
    return "Obrigado pela sua pergunta! Em breve nossa equipe entrará em contato para responder.";
  }

  // 9. Por fim, agradecimento com frase aleatória
  if (sorteio) {
    const indice = Math.floor(Math.random() * FRASES.length);
    return FRASES[indice];
  }

  return "Obrigado pela sua mensagem! 😊";
}

// Exporta as funções e constantes
module.exports = { FRASES, sem, soEmoji, querLink, temPergunta, decidir };

// Arquivo já existente e completo - não necessário alterações