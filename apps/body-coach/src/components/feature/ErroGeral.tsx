import { Component, type ErrorInfo, type ReactNode } from 'react';
import { recuperarApp, recuperouAgora } from '../../lib/recuperar';

// Se alguma tela quebrar, o aluno vê um aviso com botão (nunca a tela branca).
// Erro de arquivo antigo do app (depois de atualização): recupera sozinho uma vez.
const ERRO_DE_ARQUIVO = /Loading chunk|dynamically imported module|Importing a module script failed|error loading dynamically|Failed to fetch/i;

export default class ErroGeral extends Component<{ children: ReactNode }, { erro: boolean }> {
  state = { erro: false };

  static getDerivedStateFromError() {
    return { erro: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Body Coach] tela quebrou', error, info.componentStack);
    if (ERRO_DE_ARQUIVO.test(String(error?.message)) && !recuperouAgora()) void recuperarApp();
  }

  render() {
    if (!this.state.erro) return this.props.children;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background-50 p-6 text-center">
        <i className="ri-refresh-line text-4xl text-primary-500"></i>
        <p className="text-lg font-bold text-foreground-950">Algo não abriu direito</p>
        <p className="max-w-xs text-sm text-foreground-600">Seus dados estão salvos. Toque abaixo para abrir o app de novo.</p>
        <button type="button" onClick={() => void recuperarApp()} className="rounded-2xl bg-primary-500 px-6 py-3 text-base font-bold text-white">
          Abrir de novo
        </button>
      </div>
    );
  }
}
