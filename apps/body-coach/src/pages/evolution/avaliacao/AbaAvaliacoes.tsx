import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '@/components/base/Card';
import { dataBr, type Avaliacao } from '@/lib/avaliacao/calculos';
import { apagarAvaliacao, salvarAvaliacao, type PerfilAvaliacao } from '@/lib/avaliacao/dados';
import { hojeIso } from '@/lib/avaliacao/importar';
import type { ItemSerie } from '@/lib/avaliacao/serie';
import type { ProgressEntry } from '@/hooks/useProgressData';
import AvaliacaoForm from './AvaliacaoForm';
import ImportarAvaliacao from './ImportarAvaliacao';

export default function AbaAvaliacoes({
  uid,
  perfil,
  entries,
  serie,
  onMudou,
}: {
  uid: string | undefined;
  perfil: PerfilAvaliacao;
  entries: ProgressEntry[];
  serie: ItemSerie[];
  onMudou: () => void;
}) {
  const navigate = useNavigate();
  const [nova, setNova] = useState(false);
  const [editar, setEditar] = useState<ItemSerie | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const ultima = serie[serie.length - 1];
  const novaBase: Avaliacao = {
    data: hojeIso(),
    sexo: perfil.sexo,
    valores: {
      ...(perfil.altura ? { altura: perfil.altura } : {}),
      ...(perfil.idade ? { idade: perfil.idade } : {}),
    },
    fonte: 'Manual',
    protocolo: ultima?.av.protocolo ?? 'auto',
  };

  const salvar = async (av: Avaliacao, id?: number) => {
    if (!uid) return;
    setSalvando(true);
    setErro(null);
    try {
      const novoId = await salvarAvaliacao(uid, av, { existentes: entries, id });
      setNova(false);
      setEditar(null);
      setMsg(`Avaliação de ${dataBr(av.data)} salva.`);
      onMudou();
      if (id == null) navigate(`/evolution/relatorio/${novoId}`);
    } catch (e) {
      setErro(`Não consegui salvar: ${e instanceof Error ? e.message : 'erro'}`);
    } finally {
      setSalvando(false);
    }
  };

  const apagar = async (item: ItemSerie) => {
    if (!uid || !window.confirm(`Apagar a avaliação de ${dataBr(item.data)}? Não dá para desfazer.`)) return;
    try {
      await apagarAvaliacao(uid, item.id);
      setMsg('Avaliação apagada.');
      onMudou();
    } catch (e) {
      setErro(`Não consegui apagar: ${e instanceof Error ? e.message : 'erro'}`);
    }
  };

  return (
    <div className="space-y-4">
      <Card padding="p-5">
        <h2 className="mb-1 font-heading text-base font-semibold text-foreground-950">Nova avaliação</h2>
        <p className="mb-4 text-sm text-foreground-600">Envie o arquivo e o app coloca cada número no lugar certo, ou preencha à mão.</p>
        <ImportarAvaliacao uid={uid} perfil={perfil} existentes={entries} onSalvo={(m) => { setMsg(m); onMudou(); }} />
        {!nova ? (
          <button
            type="button"
            onClick={() => { setNova(true); setEditar(null); }}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-background-300 px-4 py-3 text-sm font-semibold text-foreground-800 hover:bg-background-100"
          >
            <i className="ri-edit-2-line"></i> Preencher à mão (dobras, medidas, balança)
          </button>
        ) : (
          <div className="mt-4 rounded-xl border border-background-200 p-3">
            <AvaliacaoForm inicial={novaBase} titulo="Avaliação manual" salvando={salvando} onCancelar={() => setNova(false)} onSalvar={(av) => void salvar(av)} />
          </div>
        )}
        {msg && <p className="mt-3 rounded-lg bg-primary-100 px-3 py-2 text-sm text-primary-700">{msg}</p>}
        {erro && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{erro}</p>}
      </Card>

      <Card padding="p-5">
        <h2 className="mb-3 font-heading text-base font-semibold text-foreground-950">Histórico de avaliações</h2>
        {serie.length === 0 && <p className="text-sm text-foreground-500">Nenhuma avaliação ainda.</p>}
        <ul className="space-y-2">
          {[...serie].reverse().map((item) => (
            <li key={item.id} className="rounded-xl border border-background-200 p-3">
              {editar?.id === item.id ? (
                <AvaliacaoForm inicial={item.av} titulo={`Editar ${dataBr(item.data)}`} salvando={salvando} onCancelar={() => setEditar(null)} onSalvar={(av) => void salvar(av, item.id)} />
              ) : (
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground-950">{dataBr(item.data)}</p>
                    <p className="truncate text-xs text-foreground-500">
                      {[item.m.peso != null && `${item.m.peso} kg`, item.res.gordura != null && `${item.res.gordura}% gordura`, item.av.fonte].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <button type="button" aria-label={`Relatório de ${dataBr(item.data)}`} onClick={() => navigate(`/evolution/relatorio/${item.id}`)} className="rounded-lg p-2 text-primary-600 hover:bg-primary-50">
                    <i className="ri-file-chart-line text-lg"></i>
                  </button>
                  <button type="button" aria-label={`Editar ${dataBr(item.data)}`} onClick={() => { setEditar(item); setNova(false); }} className="rounded-lg p-2 text-foreground-600 hover:bg-background-100">
                    <i className="ri-pencil-line text-lg"></i>
                  </button>
                  <button type="button" aria-label={`Apagar ${dataBr(item.data)}`} onClick={() => void apagar(item)} className="rounded-lg p-2 text-red-500 hover:bg-red-50">
                    <i className="ri-delete-bin-line text-lg"></i>
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
