import { cortexRepository } from '../repositories/cortexRepository';

export async function registrarChamada(uid: string) {
  await cortexRepository.incrementarUso(uid);
}

export async function obterUso(uid: string): Promise<number> {
  return await cortexRepository.obterUso(uid);
}
