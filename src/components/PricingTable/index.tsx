import { useEffect, useState } from 'react';

// Dados dos planos lidos do arquivo nexia-audit/cortex-venda/plano-vender-cortex.md
import planoMD from '../../../nexia-audit/cortex-venda/plano-vender-cortex.md?raw';

interface Plano {
  id: string;
  nome: string;
  precoBRL: number;
  precoUSD: number;
  destaque: boolean;
  limiteMensagens: string;
  iaIlimitada: boolean;
}

function parsePlanos(markdown: string): Plano[] {
  const linhas = markdown.trim().split('\n');
  const planos: Plano[] = [];
  let tabela = false;
  for (const linha of linhas) {
    if (!tabela) {
      if (linha.trim().startsWith('| plano |')) tabela = true;
      continue;
    }
    const limpa = linha.trim();
    if (!limpa.startsWith('|') || /^[\s|-:]+$/.test(limpa)) continue;
    const colunas = limpa.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
    if (colunas.length < 6) continue;
    planos.push({
      id: colunas[0],
      nome: colunas[0],
      precoBRL: Number(colunas[1]),
      precoUSD: Number(colunas[2]),
      destaque: colunas[3] === 'sim',
      limiteMensagens: colunas[4],
      iaIlimitada: colunas[5] === 'sim',
    });
  }
  return planos;
}

const PLANOS: Plano[] = parsePlanos(planoMD);

const formatoBRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const formatoUSD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export default function PricingTable() {
  const [idioma, setIdioma] = useState<'pt' | 'en'>('pt');

  useEffect(() => {
    const lang = navigator.language || navigator.languages?.[0] || 'pt-BR';
    setIdioma(lang.startsWith('pt') ? 'pt' : 'en');
  }, []);

  return (
    <section aria-label="Tabela de planos do Cortex" className="mx-auto max-w-5xl px-4 py-12">
      <div className="text-center mb-10">
        <h2 id="planos-cortex-titulo" className="text-3xl font-bold text-gray-900 mb-2">
          Planos do Cortex
        </h2>
        <p className="text-gray-600">
          Escolha o plano que cabe no seu projeto. Todos com suporte da IA do Cortex.
        </p>
      </div>

      <div
        className="overflow-x-auto border border-gray-200 rounded-2xl bg-white shadow-sm"
        role="region"
        aria-label="Planos e preços"
        aria-labelledby="planos-cortex-titulo"
      >
        <table className="w-full text-left border-collapse" aria-labelledby="planos-cortex-titulo">
          <caption className="sr-only">Planos e preços do Cortex</caption>
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-6 py-4 text-sm font-semibold text-gray-700" scope="col">
                Plano
              </th>
              <th className="px-6 py-4 text-sm font-semibold text-gray-700" scope="col">
                Preço
              </th>
              <th className="px-6 py-4 text-sm font-semibold text-gray-700" scope="col">
                Limite de mensagens
              </th>
              <th className="px-6 py-4 text-sm font-semibold text-gray-700" scope="col">
                IA ilimitada
              </th>
              <th className="px-6 py-4 text-sm font-semibold text-gray-700 text-right" scope="col">
                Escolher
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {PLANOS.map((plano) => (
              <tr
                key={plano.id}
                className={`border-b border-gray-100 ${
                  plano.destaque ? 'bg-orange-50' : ''
                }`}
              >
                <td className="px-6 py-4">
                  <div className="font-semibold text-gray-900">
                    {plano.nome}
                  </div>
                  {plano.destaque && (
                    <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-800 uppercase tracking-tighter">
                      Mais procurado
                    </span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className="text-xl font-bold text-gray-900">
                    {idioma === 'pt' ? formatoBRL.format(plano.precoBRL) : formatoUSD.format(plano.precoUSD)}
                  </div>
                  <p className="text-xs text-gray-500">
                    {idioma === 'pt' ? 'por mês' : 'per month'}
                  </p>
                </td>
                <td className="px-6 py-4 text-gray-700">
                  {plano.limiteMensagens === 'ilimitado'
                    ? idioma === 'pt'
                      ? 'Ilimitado'
                      : 'Unlimited'
                    : plano.limiteMensagens}
                </td>
                <td className="px-6 py-4 text-center">
                  {plano.iaIlimitada ? (
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 text-green-600 text-[10px]">
                      ✓
                    </span>
                  ) : (
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 text-gray-400 text-[10px]">
                      –
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  <button
                    className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                      plano.destaque
                        ? 'bg-gray-900 text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2'
                        : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2'
                    }`}
                  >
                    {idioma === 'pt' ? 'Escolher' : 'Choose'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-6 text-center text-xs text-gray-400">
        Preços exibidos de acordo com o idioma do seu navegador.
      </p>
    </section>
  );
}
