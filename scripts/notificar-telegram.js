// Manda um aviso ao Telegram do dono (grátis). Usa só segredos do GitHub:
//   TELEGRAM_BOT_TOKEN  (token do bot, criado no @BotFather)
//   TELEGRAM_CHAT_ID    (número da conversa com o bot)
// Texto: variável MENSAGEM. Sem os segredos, não faz nada e sai sem erro (a conexão ainda não foi ligada).
const token = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
const chat = String(process.env.TELEGRAM_CHAT_ID || '').trim();
const texto = String(process.env.MENSAGEM || '').trim().slice(0, 3500);

async function main() {
  if (!token || !chat) {
    console.log('Telegram ainda não conectado (faltam TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID). Nada enviado.');
    return;
  }
  if (!texto) throw new Error('Sem texto para enviar (MENSAGEM vazia).');
  const r = await fetch(`https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, text: texto, disable_web_page_preview: true }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok) throw new Error(`Telegram recusou (${r.status}): ${String(j.description || '').slice(0, 120)}`);
  console.log('Aviso enviado ao Telegram.');
}

main().catch((e) => { console.error('ERRO:', e && e.message); process.exit(1); });
