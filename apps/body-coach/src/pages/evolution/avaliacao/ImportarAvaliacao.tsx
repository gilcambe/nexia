import { useRef, useState, type ChangeEvent } from 'react';
import { CAMPO_POR_KEY } from '@/lib/avaliacao/campos';
import { calcular, dataBr, type Avaliacao } from '@/lib/avaliacao/calculos';
import { completar, salvarAvaliacao, avaliacaoDoRegistro, type PerfilAvaliacao } from '@/lib/avaliacao/dados';
import { ACEITOS, lerArquivos } from '@/lib/avaliacao/lerArquivo';
import { setUserDoc } from '@/lib/userData';
import type { ProgressEntry } from '@/hooks/useProgressData';
import AvaliacaoForm from './AvaliacaoForm';

// Envia o PDF da balança, o relatório do nutricionista (página salva), uma planilha ou a foto
// de um laudo: o app lê, mostra o que achou em cada campo e salva no histórico certo (pela data).
export default function ImportarAvaliacao({
  uid,
  perfil,
  existentes,
  onSalvo,
}: {
  uid: string | undefined;
  perfil: PerfilAvaliacao;
  existentes: ProgressEntry[];
  onSalvo: (msg: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [lendo, setLendo] = useState<string | null>(null);
  const [lista, setLista] = useState<Avaliacao[]>([]);
  const [marcadas, setMarcadas] = useState<Set<number>>(new Set());
  const [avisos, setAvisos] = useState<string[]>([]);
  const [formato, setFormato] = useState('');
  const [editando, setEditando] = useState<number | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const datasExistentes = new Set(existentes.map((e) => avaliacaoDoRegistro(e).data));

  const escolher = async (e: ChangeEvent<HTMLInputElement>) => {
    const arquivos = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!arquivos.length) return;
    setErro(null);
    setLista([]);
    setLendo('Lendo o arquivo...');
    try {
      const r = await lerArquivos(arquivos, setLendo);
      const avs = r.avaliacoes.map((a) => completar(a, perfil));
      setLista(avs);
      setMarcadas(new Set(avs.map((_, i) => i)));
      setAvisos(r.avisos);
      setFormato(r.formato);
      setEditando(avs.length === 1 ? 0 : null);
      if (!avs.length) setErro('Não encontrei medidas nesse arquivo. Tente o PDF original da balança, a página do relatório salva no celular (.mht) ou uma foto bem nítida do laudo.');
    } catch (err) {
      setErro(`Não consegui ler o arquivo: ${err instanceof Error ? err.message : 'erro'}`);
    } finally {
      setLendo(null);
    }
  };

  const salvar = async (quais: Avaliacao[]) => {
    if (!uid) return;
    setSalvando(true);
    setErro(null);
    try {
      for (const av of quais) await salvarAvaliacao(uid, av, { existentes });
      const sexo = quais.find((a) => a.sexo)?.sexo;
      if (sexo && !perfil.sexo) void setUserDoc(uid, 'profile', 'main', { sexo }, true).catch(() => {});
      setLista([]);
      setEditando(null);
      onSalvo(quais.length === 1 ? `Avaliação de ${dataBr(quais[0].data)} salva.` : `${quais.length} avaliações salvas no seu histórico.`);
    } catch (err) {
      setErro(`Não consegui salvar: ${err instanceof Error ? err.message : 'erro'}`);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={!!lendo}
        className="flex w-full items-center gap-3 rounded-xl border-2 border-dashed border-primary-300 bg-primary-50/50 p-4 text-left transition hover:bg-primary-50 disabled:opacity-60"
      >
        <i className={`${lendo ? 'ri-loader-4-line animate-spin' : 'ri-file-upload-line'} text-2xl text-primary-600`}></i>
        <span>
          <span className="block text-sm font-semibold text-foreground-950">{lendo ?? 'Importar avaliação'}</span>
          <span className="block text-xs text-foreground-600">
            PDF da balança (Tanita, InBody...), relatório do nutricionista (.mht/.html), planilha (.csv) ou foto do laudo.
            Pode mandar mais de um arquivo.
          </span>
        </span>
      </button>
      <input ref={ref} type="file" multiple accept={ACEITOS} className="hidden" onChange={escolher} data-testid="importar-arquivo" />

      {erro && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{erro}</p>}
      {avisos.map((a) => <p key={a} className="mt-2 rounded-lg bg-secondary-50 px-3 py-2 text-xs text-secondary-800">{a}</p>)}

      {lista.length > 0 && editando != null && (
        <div className="mt-4 rounded-xl border border-primary-200 p-3">
          <p className="mb-3 text-xs text-foreground-600">
            Li <b>{formato}</b>. Confira os campos (dá para corrigir qualquer número) e salve.
          </p>
          <AvaliacaoForm
            key={editando}
            inicial={lista[editando]}
            salvando={salvando}
            onCancelar={() => (lista.length === 1 ? setLista([]) : setEditando(null))}
            onSalvar={(av) => {
              if (lista.length === 1) void salvar([av]);
              else {
                setLista((l) => l.map((x, i) => (i === editando ? av : x)));
                setEditando(null);
              }
            }}
          />
        </div>
      )}

      {lista.length > 1 && editando == null && (
        <div className="mt-4 space-y-2">
          <p className="text-sm text-foreground-700">
            Encontrei <b>{lista.length} avaliações</b> em {formato}. Marque as que quer guardar:
          </p>
          {lista.map((av, i) => {
            const r = calcular(av);
            const qtd = Object.keys(av.valores).filter((k) => CAMPO_POR_KEY[k] && !k.endsWith('_laudo')).length;
            return (
              <div key={av.data} className="flex items-center gap-3 rounded-xl border border-background-200 p-3">
                <input
                  type="checkbox"
                  aria-label={`Guardar avaliação de ${dataBr(av.data)}`}
                  checked={marcadas.has(i)}
                  onChange={() => setMarcadas((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; })}
                  className="h-5 w-5 accent-primary-500"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground-950">
                    {dataBr(av.data)}
                    {datasExistentes.has(av.data) && <span className="ml-2 rounded-full bg-background-100 px-2 py-0.5 text-[10px] font-medium text-foreground-600">junta com a que já existe</span>}
                  </p>
                  <p className="truncate text-xs text-foreground-500">
                    {qtd} medidas · {av.valores.peso ? `${av.valores.peso} kg` : 'sem peso'}{r.gordura != null ? ` · ${r.gordura}% gordura` : ''}
                  </p>
                </div>
                <button type="button" onClick={() => setEditando(i)} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-primary-600 hover:bg-primary-50">
                  Conferir
                </button>
              </div>
            );
          })}
          <button
            type="button"
            disabled={salvando || marcadas.size === 0}
            onClick={() => void salvar(lista.filter((_, i) => marcadas.has(i)))}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 disabled:opacity-50 dark:text-foreground-950"
          >
            <i className={salvando ? 'ri-loader-4-line animate-spin' : 'ri-save-line'}></i>
            {salvando ? 'Salvando...' : `Salvar ${marcadas.size} avaliações`}
          </button>
        </div>
      )}
    </div>
  );
}
