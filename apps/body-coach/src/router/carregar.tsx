import { Suspense, lazy, type ComponentType } from 'react';

// Depois de uma atualização, o celular pode pedir um pedaço antigo do app que já não existe.
// Nesse caso recarrega a página uma vez (vem a versão nova); se falhar de novo, mostra o erro.
const CHAVE = 'bc_recarregou_pedaco';

function importarComRecarga<T>(importar: () => Promise<T>): Promise<T> {
  return importar()
    .then((m) => {
      try { sessionStorage.removeItem(CHAVE); } catch { /* sem armazenamento */ }
      return m;
    })
    .catch((erro) => {
      let jaTentou = false;
      try { jaTentou = sessionStorage.getItem(CHAVE) === '1'; sessionStorage.setItem(CHAVE, '1'); } catch { /* sem armazenamento */ }
      if (!jaTentou) {
        location.reload();
        return new Promise<T>(() => {});
      }
      throw erro;
    });
}

export function Carregando() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center" role="status" aria-label="Carregando">
      <i className="ri-loader-4-line animate-spin text-3xl text-primary-500"></i>
    </div>
  );
}

export function carregar<P extends object>(importar: () => Promise<{ default: ComponentType<P> }>) {
  const Tela = lazy(() => importarComRecarga(importar));
  return function TelaCarregada(props: P) {
    return (
      <Suspense fallback={<Carregando />}>
        <Tela {...props} />
      </Suspense>
    );
  };
}
