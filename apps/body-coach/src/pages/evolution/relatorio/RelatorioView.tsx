import { type ReactNode } from 'react';
import { CAMPOS, CAMPO_POR_KEY } from '@/lib/avaliacao/campos';
import { alertas, comparar, dataBr, DOBRAS_PROTOCOLO, metricaInfo, recordes, simetria } from '@/lib/avaliacao/calculos';
import { POSES, type PerfilAvaliacao } from '@/lib/avaliacao/dados';
import type { ItemSerie } from '@/lib/avaliacao/serie';
import ResultadosAvaliacao from '../avaliacao/ResultadosAvaliacao';
import Faixa from './Faixa';
import CorpoSegmentos from './CorpoSegmentos';

const fmt = (n: number | null | undefined, c = 1) =>
  n == null ? '–' : n.toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c });

const PRINCIPAIS = ['peso', 'gordura', 'massaGorda', 'mlg', 'imc', 'somaDobras', 'cintura', 'abdomen', 'quadril', 'braco_relaxado', 'braco_contraido', 'coxa_medial', 'rcq', 'cmb', 'massa_muscular', 'visceral'];

export interface Avaliador { nome: string; foto?: string }

// Relatório de uma avaliação, no formato de laudo: abre no celular e vira PDF pelo "Baixar PDF"
// (a impressão do próprio navegador, sem custo e sem servidor). Usado pelo aluno, pelo coach e no link público.
export default function RelatorioView({
  serie, idx, perfil, nome, avaliador, onVoltar, acoes, rodape,
}: {
  serie: ItemSerie[];
  idx: number;
  perfil: PerfilAvaliacao;
  nome: string;
  avaliador?: Avaliador | null;
  onVoltar?: () => void;
  acoes?: ReactNode;
  rodape?: ReactNode;
}) {
  const item = serie[idx];
  const anterior = idx > 0 ? serie[idx - 1] : null;
  const ateAqui = serie.slice(0, idx + 1);

  const { av, res } = item;
  const v = av.valores;
  const sexo = av.sexo ?? perfil.sexo;
  const comp = anterior ? comparar(anterior.m, item.m, PRINCIPAIS).filter((c) => c.antes != null || c.depois != null) : [];
  const avisos = alertas(ateAqui.map((s) => ({ data: s.data, m: s.m })));
  const recs = recordes(ateAqui.map((s) => ({ data: s.data, m: s.m }))).filter((r) => r.novo);
  const temFotos = POSES.some((p) => item.fotos[p.id]);
  const grupo = (g: string) => CAMPOS.filter((c) => c.grupo === g && v[c.key] != null);
  const lados = simetria(v, av.segmental);

  const compartilhar = async () => {
    const texto = `Minha avaliação de ${dataBr(av.data)}: ${fmt(v.peso)} kg, ${fmt(res.gordura)}% de gordura, ${fmt(res.mlg)} kg de massa magra. (NEXIA Body Coach)`;
    try {
      if (navigator.share) await navigator.share({ title: 'Minha avaliação', text: texto });
      else await navigator.clipboard.writeText(texto);
    } catch {
      /* cancelado */
    }
  };

  return (
    <div className="min-h-screen bg-background-100 print:bg-white">
      <style>{'@page { size: A4; margin: 10mm; } @media print { html, body { background: #fff !important; } .relatorio { box-shadow: none !important; } * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }'}</style>
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-background-200 bg-background-50/95 px-3 py-2 backdrop-blur print:hidden">
        {onVoltar && (
          <button type="button" onClick={onVoltar} className="rounded-lg p-2 text-foreground-700 hover:bg-background-100" aria-label="Voltar">
            <i className="ri-arrow-left-line text-lg"></i>
          </button>
        )}
        <span className="flex-1 truncate text-sm font-semibold text-foreground-900">Relatório {dataBr(av.data)}</span>
        {acoes ?? (
          <button type="button" onClick={() => void compartilhar()} className="rounded-lg px-3 py-2 text-sm font-semibold text-foreground-700 hover:bg-background-100">
            <i className="ri-share-line mr-1"></i>Enviar
          </button>
        )}
        <button type="button" onClick={() => window.print()} className="rounded-lg bg-primary-500 px-3 py-2 text-sm font-semibold text-background-50 dark:text-foreground-950">
          <i className="ri-file-pdf-2-line mr-1"></i>Baixar PDF
        </button>
      </div>

      <article className="relatorio mx-auto my-3 max-w-[820px] bg-white p-4 text-[#1f2328] shadow-sm sm:my-6 sm:p-8 print:my-0 print:max-w-none print:p-0">
        <header className="flex items-start justify-between gap-3 border-b-2 border-[#e8590c] pb-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#e8590c]">NEXIA Body Coach</p>
            <h1 className="text-xl font-bold">Relatório de avaliação física</h1>
            <p className="text-sm">{nome}</p>
            {avaliador && (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-[#495057]">
                {avaliador.foto ? <img src={avaliador.foto} alt="" className="h-5 w-5 rounded-full object-cover" /> : null}
                Avaliador(a): <b>{avaliador.nome}</b>
              </p>
            )}
          </div>
          <div className="text-right text-xs leading-5">
            <p><b>Data:</b> {dataBr(av.data)}{av.hora ? ` ${av.hora}` : ''}</p>
            {v.idade != null && <p><b>Idade:</b> {v.idade} anos</p>}
            {sexo && <p><b>Sexo:</b> {sexo === 'M' ? 'Masculino' : 'Feminino'}</p>}
            {v.altura != null && <p><b>Altura:</b> {fmt(v.altura)} cm</p>}
            <p className="text-[10px] text-[#666]">{av.fonte}</p>
          </div>
        </header>

        <Secao titulo="Composição corporal">
          <div className="space-y-3">
            {v.peso != null && res.pesoSaudavel && (
              <Faixa titulo="Peso" valor={v.peso} unidade="kg" faixas={[[res.pesoSaudavel[0] * 0.85, res.pesoSaudavel[0], 'Abaixo'], [res.pesoSaudavel[0], res.pesoSaudavel[1], 'Saudável'], [res.pesoSaudavel[1], res.pesoSaudavel[1] * 1.25, 'Acima']]} />
            )}
            {res.gordura != null && (
              <Faixa titulo="% de gordura" valor={res.gordura} unidade="%" classe={res.gorduraClasse} faixas={sexo === 'F' ? [[8, 16, 'Baixa'], [16, 25, 'Boa'], [25, 32, 'Média'], [32, 45, 'Alta']] : [[2, 8, 'Baixa'], [8, 18, 'Boa'], [18, 25, 'Média'], [25, 40, 'Alta']]} />
            )}
            {res.imc != null && (
              <Faixa titulo="IMC" valor={res.imc} unidade="" classe={res.imcClasse} faixas={[[15, 18.5, 'Baixo'], [18.5, 25, 'Normal'], [25, 30, 'Sobrepeso'], [30, 40, 'Obesidade']]} />
            )}
          </div>
          <div className="mt-4">
            <ResultadosAvaliacao av={av} res={res} />
          </div>
          {res.imc != null && res.imcClasse && res.imcClasse !== 'Peso normal' && res.gordura != null && res.gorduraClasse && ['Baixa', 'Excelente', 'Bom'].includes(res.gorduraClasse) && (
            <p className="mt-3 rounded bg-[#f1f8f4] p-2 text-xs">
              O IMC aponta "{res.imcClasse}", mas a gordura está {res.gorduraClasse.toLowerCase()}: o peso extra é músculo, não gordura.
            </p>
          )}
        </Secao>

        {anterior && comp.length > 0 && (
          <Secao titulo={`Comparação com ${dataBr(anterior.data)}`}>
            <table className="w-full text-xs">
              <thead><tr className="border-b text-[#666]"><th className="py-1 text-left font-medium">Medida</th><th className="text-right font-medium">Antes</th><th className="text-right font-medium">Agora</th><th className="text-right font-medium">Diferença</th></tr></thead>
              <tbody>
                {comp.map((c) => {
                  const info = metricaInfo(c.key);
                  return (
                    <tr key={c.key} className="border-b border-[#eee]">
                      <td className="py-1">{info?.label} {info?.unidade && <span className="text-[#888]">({info.unidade})</span>}</td>
                      <td className="text-right">{fmt(c.antes, c.key === 'rcq' ? 2 : 1)}</td>
                      <td className="text-right font-semibold">{fmt(c.depois, c.key === 'rcq' ? 2 : 1)}</td>
                      <td className={`text-right font-semibold ${c.leitura === 'bom' ? 'text-[#2f9e44]' : c.leitura === 'ruim' ? 'text-[#e03131]' : 'text-[#666]'}`}>
                        {c.delta == null ? '–' : `${c.delta > 0 ? '↑ +' : c.delta < 0 ? '↓ ' : ''}${fmt(c.delta, c.key === 'rcq' ? 2 : 1)}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Secao>
        )}

        {(avisos.length > 0 || recs.length > 0) && (
          <Secao titulo="Destaques">
            <ul className="space-y-1 text-xs">
              {recs.map((r) => <li key={r.key}>🏆 Recorde: {r.label} {fmt(r.valor)} {r.unidade}</li>)}
              {avisos.map((a) => <li key={a.texto} className={a.nivel === 'atencao' ? 'text-[#c92a2a]' : 'text-[#2f9e44]'}>{a.nivel === 'atencao' ? '⚠️' : '✅'} {a.texto}</li>)}
            </ul>
          </Secao>
        )}

        <div className="grid gap-x-6 sm:grid-cols-2 print:grid-cols-2">
          {grupo('dobras').length > 0 && (
            <Secao titulo="Dobras cutâneas (mm)">
              <Lista itens={grupo('dobras').map((c) => [c.label, fmt(v[c.key], 0)])} />
              <p className="mt-1 text-[11px] text-[#666]">Soma: <b>{fmt(res.somaDobras, 0)} mm</b>{res.protocolo ? ` · ${DOBRAS_PROTOCOLO[res.protocolo].nome} + Brozek` : ''}{res.densidade ? ` · densidade ${fmt(res.densidade, 3)} g/mL` : ''}</p>
            </Secao>
          )}
          {grupo('circ').length > 0 && (
            <Secao titulo="Circunferências (cm)">
              <Lista itens={grupo('circ').map((c) => [c.label, fmt(v[c.key])])} />
            </Secao>
          )}
          {grupo('bio').length > 0 && (
            <Secao titulo="Bioimpedância">
              <Lista itens={grupo('bio').map((c) => [c.label, `${fmt(v[c.key], c.unidade === 'kcal' || c.unidade === 'nível' || c.unidade === 'anos' ? 0 : 1)} ${c.unidade}`])} />
            </Secao>
          )}
          {grupo('diametros').length > 0 && (
            <Secao titulo="Diâmetros ósseos (cm)">
              <Lista itens={grupo('diametros').map((c) => [c.label, fmt(v[c.key])])} />
            </Secao>
          )}
        </div>

        {lados.length > 0 && (
          <Secao titulo="Simetria (esquerdo x direito)">
            <table className="w-full text-xs">
              <thead><tr className="border-b text-[#666]"><th className="py-1 text-left font-medium">Região</th><th className="text-right font-medium">Esq.</th><th className="text-right font-medium">Dir.</th><th className="text-right font-medium">Diferença</th></tr></thead>
              <tbody>
                {lados.map((l) => (
                  <tr key={l.label} className="border-b border-[#eee]">
                    <td className="py-1">{l.label}</td>
                    <td className="text-right">{fmt(l.esquerdo)} {l.unidade}</td>
                    <td className="text-right">{fmt(l.direito)} {l.unidade}</td>
                    <td className={`text-right font-semibold ${l.atencao ? 'text-[#e8590c]' : 'text-[#2f9e44]'}`}>{fmt(l.diferenca)} {l.unidade}{l.atencao && l.menor ? ` · reforçar ${l.menor}` : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-1 text-[11px] text-[#666]">Até 1 cm (ou 3% de músculo) de diferença é normal. Acima disso, vale um pouco mais de volume no lado menor.</p>
          </Secao>
        )}

        {av.segmental && (av.segmental.musculo_kg || av.segmental.gordura_pct) && (
          <Secao titulo="Análise por segmento">
            <div className="grid grid-cols-2 gap-4">
              {av.segmental.musculo_kg && <CorpoSegmentos titulo="Massa muscular" valores={av.segmental.musculo_kg} unidade="kg" cor="#1971c2" />}
              {av.segmental.gordura_pct && <CorpoSegmentos titulo="Gordura" valores={av.segmental.gordura_pct} unidade="%" cor="#e8590c" />}
            </div>
          </Secao>
        )}

        {temFotos && (
          <Secao titulo="Fotos">
            <div className="grid grid-cols-4 gap-2">
              {POSES.map((p) => (
                <figure key={p.id} className="text-center">
                  {item.fotos[p.id] ? <img src={item.fotos[p.id]!} alt={p.label} className="aspect-[3/4] w-full rounded object-cover object-top" /> : <div className="aspect-[3/4] w-full rounded bg-[#f1f3f5]" />}
                  <figcaption className="mt-1 text-[10px] text-[#666]">{p.label}</figcaption>
                </figure>
              ))}
            </div>
          </Secao>
        )}

        {av.notas && <Secao titulo="Observações"><p className="whitespace-pre-line text-xs">{av.notas}</p></Secao>}

        <footer className="mt-6 border-t pt-2 text-[10px] leading-4 text-[#888]">
          Gerado pelo NEXIA Body Coach{avaliador ? ` para ${avaliador.nome}` : ''} em {new Date().toLocaleDateString('pt-BR')}. Gordura por dobras: Jackson & Pollock ou Guedes com a fórmula de Brozek.
          Classificações: % de gordura (Pollock & Wilmore), IMC (OMS), relação cintura/quadril (Bray & Gray), CMB (Jelliffe).
          {Object.keys(v).some((k) => CAMPO_POR_KEY[k]?.grupo === 'bio') ? ' Dados de bioimpedância como informados pelo aparelho.' : ''}
        </footer>
      </article>
      {rodape && <div className="mx-auto mb-6 max-w-[820px] px-3 print:hidden">{rodape}</div>}
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="mt-5 break-inside-avoid">
      <h2 className="mb-2 bg-[#f1f3f5] px-2 py-1 text-xs font-bold uppercase tracking-wide text-[#495057]">{titulo}</h2>
      {children}
    </section>
  );
}

function Lista({ itens }: { itens: [string, string][] }) {
  return (
    <dl className="text-xs">
      {itens.map(([k, val]) => (
        <div key={k} className="flex justify-between border-b border-[#f1f3f5] py-1">
          <dt className="text-[#495057]">{k}</dt>
          <dd className="font-semibold">{val}</dd>
        </div>
      ))}
    </dl>
  );
}
