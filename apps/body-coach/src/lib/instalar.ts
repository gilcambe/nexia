// Página "Instalar o app" (/instalar): diz o caminho certo para cada aparelho.
// Android: instalar pela Play Store (o app da loja abre sem a barra de endereço; o atalho do Chrome mostra a URL).
// iPhone: Compartilhar > Adicionar à Tela de Início. Computador: instalar pelo navegador ou abrir no celular.
import { TESTADOR } from './testador';

export type Aparelho = 'instalado' | 'android' | 'iphone' | 'computador';
export const LINK_PLAY = TESTADOR.instalar;
export const LINK_APP = 'https://nexiabodycoach.pages.dev/body-coach/';

export function qualAparelho(ua: string, standalone = false, toque = 0, plataforma = ''): Aparelho {
  if (standalone) return 'instalado';
  if (/android/i.test(ua)) return 'android';
  if (/iphone|ipad|ipod/i.test(ua) || (plataforma === 'MacIntel' && toque > 1)) return 'iphone';
  return 'computador';
}
