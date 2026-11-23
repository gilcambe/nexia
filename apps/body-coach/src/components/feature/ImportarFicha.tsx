import { useRef, useState } from 'react';
import { perguntar } from '@/lib/coachAI';
import { fichaDoJson } from '@/lib/coach/importarFicha';
import type { FichaCoach } from '@/lib/coach/fichaCoach';

// Sobe a ficha feita fora do app (PDF, foto ou texto): lê o arquivo, a IA monta a ficha e ela abre no editor.
// Nada é salvo aqui: quem usa o componente mostra a ficha para conferir antes de salvar.
export default function ImportarFicha({ onFicha }: { onFicha: (f: FichaCoach) => void }) {
  const entrada = useRef<HTMLInputElement>(null);
  const [passo, setPasso] = useState('');
  const [erro, setErro] = useState('');

  const ler = async (arquivo: File) => {
    setErro('');
    try {
      setPasso('Lendo o arquivo…');
      const { textoDoArquivo } = await import('@/lib/avaliacao/lerArquivo');
      const texto = (await textoDoArquivo(arquivo, setPasso)).trim();
      if (texto.replace(/[^a-zA-ZÀ-ÿ]/g, '').length < 20) { setErro('Não consegui ler esse arquivo. Tente uma foto mais nítida ou o PDF original.'); return; }
      setPasso('Montando a ficha…');
      const resposta = await perguntar('personal', texto.slice(0, 12000), {}, undefined, undefined, 'ficha');
      const ficha = fichaDoJson(resposta);
      if (!ficha) { setErro('Não encontrei exercícios nesse arquivo.'); return; }
      onFicha(ficha);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui ler esse arquivo agora. Tente de novo.');
    } finally {
      setPasso('');
      if (entrada.current) entrada.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      {/* Sem filtro "accept": Android/iPhone escondem arquivos quando há filtro. */}
      <input ref={entrada} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void ler(f); }} />
      <button type="button" disabled={!!passo} onClick={() => entrada.current?.click()} className="w-full rounded-xl border border-dashed border-primary-300 px-4 py-3 text-sm font-semibold text-primary-600 disabled:opacity-60">
        <i className={passo ? 'ri-loader-4-line mr-1 animate-spin' : 'ri-file-upload-line mr-1'}></i>{passo || 'Importar ficha (PDF, foto ou texto)'}
      </button>
      {erro && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{erro}</p>}
    </div>
  );
}
