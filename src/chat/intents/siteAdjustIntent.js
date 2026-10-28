import { siteSpecUpdater } from '../../ai/siteSpecUpdater';

export async function siteAdjustIntent({ message, user, siteId }) {
  const adjustments = parseAdjustment(message);
  if (!adjustments) {
    return { reply: "Não entendi o ajuste. Por favor, tente novamente." };
  }

  const updatedSpec = await siteSpecUpdater(siteId, adjustments);
  if (!updatedSpec) {
    return { reply: "Não foi possível atualizar o site. Por favor, tente novamente." };
  }

  return {
    reply: "Site atualizado com sucesso!",
    reloadPreview: true,
  };
}

function parseAdjustment(message) {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('troque a cor para')) {
    const colorMatch = lowerMessage.match(/troque a cor para ([\w#]+)/);
    if (colorMatch) {
      return { primaryColor: colorMatch[1] };
    }
  }

  if (lowerMessage.includes('adicione whatsapp')) {
    const whatsappMatch = lowerMessage.match(/adicione whatsapp (\d+)/);
    if (whatsappMatch) {
      return { whatsapp: whatsappMatch[1] };
    }
  }

  return null;
}
