// Testadores do app Android (teste fechado do Google Play). Troque os links aqui se mudarem.
import { chatApi } from './chat';

export const TESTADOR = {
  grupo: 'https://groups.google.com/g/nexia-bodycoach-testes',
  ativarTeste: 'https://play.google.com/apps/testing/app.nexia.bodycoach',
  instalar: 'https://play.google.com/store/apps/details?id=app.nexia.bodycoach',
  convite: 'https://nexiabodycoach.pages.dev/body-coach/testador',
  diasPremium: 30,
  diasInstalado: 14,
};

export const CHAVE_TESTADOR_OK = 'bc_testador_ok';
const CHAVE_BANNER_FECHADO = 'bc_testador_banner_fechado';

const ler = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const gravar = (k: string) => { try { localStorage.setItem(k, '1'); } catch { /* ok */ } };

export const marcarTestadorOk = () => gravar(CHAVE_TESTADOR_OK);
export const fecharBannerTestador = () => gravar(CHAVE_BANNER_FECHADO);

// Banner no Hoje: só no navegador do Android, fora do app instalado, e só para quem ainda não ganhou nem fechou.
export function mostrarBannerTestador(): boolean {
  if (typeof navigator === 'undefined' || !/Android/i.test(navigator.userAgent)) return false;
  try { if (window.matchMedia('(display-mode: standalone)').matches) return false; } catch { /* ok */ }
  return !ler(CHAVE_TESTADOR_OK) && !ler(CHAVE_BANNER_FECHADO);
}

export interface PremioTestador { ok: boolean; jaGanhou: boolean; dias?: number; pagoAte?: number; em?: number }
export const pedirPremioTestador = () => chatApi<PremioTestador>({ acao: 'acesso_testador' });

export interface Testador { uid: string; email: string; nome: string; em: number }
export const listarTestadores = () => chatApi<{ testadores: Testador[] }>({ acao: 'acesso_testadores' });
