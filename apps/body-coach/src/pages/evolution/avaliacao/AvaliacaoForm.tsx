import { useMemo, useState } from 'react';
import { CAMPOS, GRUPOS, type Grupo } from '@/lib/avaliacao/campos';
import { calcular, DOBRAS_PROTOCOLO, type Avaliacao, type Protocolo, type Sexo } from '@/lib/avaliacao/calculos';
import { lerNumero } from '@/lib/avaliacao/importar';
import ResultadosAvaliacao from './ResultadosAvaliacao';

const inputClass =
  'w-full rounded-lg border border-background-300 bg-background-50 px-3 py-2 text-sm text-foreground-800 focus:border-primary-400 focus:outline-none';

const texto = (n: number | undefined) => (n == null ? '' : String(n).replace('.', ','));

// Ficha da avaliação: serve para preencher à mão, editar e conferir o que veio de um arquivo.
// Os cálculos (gordura pelas dobras, IMC, RCQ, CMB...) aparecem na hora, enquanto digita.
export default function AvaliacaoForm({
  inicial,
  titulo,
  salvando,
  onSalvar,
  onCancelar,
}: {
  inicial: Avaliacao;
  titulo?: string;
  salvando?: boolean;
  onSalvar: (av: Avaliacao) => void;
  onCancelar?: () => void;
}) {
  const [data, setData] = useState(inicial.data);
  const [hora, setHora] = useState(inicial.hora ?? '');
  const [sexo, setSexo] = useState<Sexo | null>(inicial.sexo ?? null);
  const [protocolo, setProtocolo] = useState<Protocolo>(inicial.protocolo ?? 'auto');
  const [notas, setNotas] = useState(inicial.notas ?? '');
  const [txt, setTxt] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(inicial.valores ?? {}).map(([k, n]) => [k, texto(n)])),
  );
  const [abertos, setAbertos] = useState<Record<string, boolean>>(() => {
    const comValor = new Set(Object.keys(inicial.valores ?? {}).map((k) => CAMPOS.find((c) => c.key === k)?.grupo));
    return { basico: true, dobras: comValor.has('dobras'), circ: true, diametros: comValor.has('diametros'), bio: comValor.has('bio') };
  });

  const valores = useMemo(() => {
    const v: Record<string, number> = {};
    for (const [k, t] of Object.entries(txt)) {
      const n = lerNumero(t);
      if (n != null) v[k] = n;
    }
    // Valores calculados que vieram prontos de um laudo continuam guardados (reserva).
    for (const [k, n] of Object.entries(inicial.valores ?? {})) if (k.endsWith('_laudo') && v[k] == null) v[k] = n;
    return v;
  }, [txt, inicial.valores]);

  const av: Avaliacao = {
    ...inicial,
    data,
    hora: hora || null,
    sexo,
    protocolo,
    notas: notas.trim() || null,
    valores,
  };
  const res = calcular(av);
  const precisaSexo = !sexo;
  const semNada = Object.keys(valores).filter((k) => !['altura', 'idade'].includes(k)).length === 0;

  const grupoCampos = (g: Grupo) => CAMPOS.filter((c) => c.grupo === g);
  const preenchidos = (g: Grupo) => grupoCampos(g).filter((c) => txt[c.key]?.trim()).length;

  return (
    <div className="space-y-4">
      {titulo && <h3 className="font-heading text-base font-semibold text-foreground-950">{titulo}</h3>}

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-foreground-600">Data da avaliação</span>
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-foreground-600">Hora (opcional)</span>
          <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className={inputClass} />
        </label>
      </div>

      <div>
        <span className="mb-1 block text-xs font-medium text-foreground-600">Sexo (muda as fórmulas)</span>
        <div className="flex gap-2">
          {([['M', 'Masculino'], ['F', 'Feminino']] as const).map(([v, l]) => (
            <button
              key={v}
              type="button"
              onClick={() => setSexo(v)}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                sexo === v ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-background-300 text-foreground-600'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {GRUPOS.map((g) => (
        <div key={g.id} className="rounded-xl border border-background-200">
          <button
            type="button"
            onClick={() => setAbertos((a) => ({ ...a, [g.id]: !a[g.id] }))}
            className="flex w-full items-center justify-between px-3 py-2.5 text-left"
            aria-expanded={!!abertos[g.id]}
          >
            <span className="text-sm font-semibold text-foreground-900">{g.label}</span>
            <span className="flex items-center gap-2 text-xs text-foreground-500">
              {preenchidos(g.id) > 0 && <span className="rounded-full bg-primary-100 px-2 py-0.5 text-primary-700">{preenchidos(g.id)}</span>}
              <i className={abertos[g.id] ? 'ri-arrow-up-s-line text-lg' : 'ri-arrow-down-s-line text-lg'}></i>
            </span>
          </button>
          {abertos[g.id] && (
            <div className="border-t border-background-200 px-3 pb-3 pt-2">
              {g.id === 'dobras' && (
                <label className="mb-3 block">
                  <span className="mb-1 block text-xs font-medium text-foreground-600">Protocolo</span>
                  <select value={protocolo} onChange={(e) => setProtocolo(e.target.value as Protocolo)} className={inputClass}>
                    <option value="auto">Automático (o mais completo possível)</option>
                    {Object.entries(DOBRAS_PROTOCOLO).map(([k, p]) => (
                      <option key={k} value={k}>{p.nome}</option>
                    ))}
                  </select>
                </label>
              )}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {grupoCampos(g.id).map((c) => (
                  <label key={c.key} className="block">
                    <span className="mb-1 block truncate text-[11px] font-medium text-foreground-600" title={c.label}>
                      {c.label} <span className="text-foreground-400">({c.unidade})</span>
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      name={c.key}
                      value={txt[c.key] ?? ''}
                      onChange={(e) => setTxt((t) => ({ ...t, [c.key]: e.target.value }))}
                      className={inputClass}
                    />
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-foreground-600">Observações (opcional)</span>
        <textarea rows={2} maxLength={2000} value={notas} onChange={(e) => setNotas(e.target.value)} className={`${inputClass} resize-none`} />
      </label>

      <ResultadosAvaliacao av={av} res={res} compacto />

      {precisaSexo && <p className="rounded-lg bg-secondary-50 px-3 py-2 text-xs text-secondary-800">Escolha o sexo para os cálculos ficarem certos.</p>}

      <div className="flex gap-2">
        {onCancelar && (
          <button type="button" onClick={onCancelar} className="flex-1 rounded-lg border border-background-300 px-4 py-2.5 text-sm font-medium text-foreground-700">
            Cancelar
          </button>
        )}
        <button
          type="button"
          disabled={salvando || semNada || !data}
          onClick={() => onSalvar(av)}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 transition hover:bg-primary-600 disabled:opacity-50 dark:text-foreground-950"
        >
          <i className={salvando ? 'ri-loader-4-line animate-spin' : 'ri-save-line'}></i>
          {salvando ? 'Salvando...' : 'Salvar avaliação'}
        </button>
      </div>
    </div>
  );
}
