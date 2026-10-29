import { cortexRepository } from '../repositories/cortexRepository';

export async function iniciarConversa(uid: string, contexto: string) {
  const conversa = await cortexRepository.criarConversa(uid, contexto);
  return conversa;
}

export async function recuperarConversas(uid: string) {
  const conversas = await cortexRepository.obterConversas(uid);
  return conversas;
}
