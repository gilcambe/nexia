import { useEffect, useState } from 'react';

// Dados dos planos lidos do arquivo nexia-audit/cortex-venda/plano-vender-cortex.md
// (mantidos aqui para o componente ler do arquivo de dados do projeto)
interface Plano {
  id: string;
  nome: string;
  precoBRL: number;
  precoUSD: number;
  destaque: boolean;
  limiteMensagens: string;
  iaIlimitada: boolean;
}

const PLANOS: Plano[] = [
  {
    id: 'gratuito',
    nome: 'Gratuito',
    precoBRL: 0,
    precoUSD: 0,
    destaque: false,
    limiteMensagens: '10',
    iaIlimitada: false,
  },
  {
    id: 'profissional',
    nome: 'Profissional',
    precoBRL: 49,
    precoUSD: 10,
    destaque: true,
    limiteMensagens: 'ilimitado',
    iaIlimitada: true,
  },
  {
    id: 'empresarial',
    nome: 'Empresarial',
    precoBRL: 149,
    precoUSD: 30,
    destaque: false,
    limiteMensagens: 'ilimitado',
    iaIlimitada: true,
  },
];

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
        <h2 className="text-3xl font-bold text-foreground-900 mb-2">Planos do Cortex</h2>
        <p className="text-foreground-600">
          Escolha o plano que cabe no seu projeto. Todos com suporte da IA do Cortex.
        </p>
      </div>

      <div
        className="overflow-x-auto border border-foreground-200 rounded-2xl bg-white shadow-sm"
        role="region"
        aria-label="Planos e preços"
      >
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-foreground-50 border-b border-foreground-200">
              <th
                className="px-6 py-4 text-sm font-semibold text-foreground-700"
                scope="col"
              >
                Plano
              </th>
              <th
                className="px-6 py-4 text-sm font-semibold text-foreground-700"
                scope="col"
              >
                Preço
              </th>
              <th
                className="px-6 py-4 text-sm font-semibold text-foreground-700"
                scope="col"
              >
                Limite de mensagens
              </th>
              <th
                className="px-6 py-4 text-sm font-semibold text-foreground-700"
                scope="col"
              >
                IA ilimitada
              </th>
              <th
                className="px-6 py-4 text-sm font-semibold text-foreground-700 text-right"
                scope="col"
              >
                Escolher
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-foreground-100">
            {PLANOS.map((plano) => (
              <tr
                key={plano.id}
                className={`border-b border-foreground-100 ${
                  plano.destaque ? 'bg-orange-50' : ''
                }`}
              >
                <td className="px-6 py-4">
                  <div className="font-semibold text-foreground-900">
                    {plano.nome}
                  </div>
                  {plano.destaque && (
                    <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-800 uppercase tracking-tighter">
                      Mais procurado
                    </span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className="text-xl font-bold text-foreground-900">
                    {idioma === 'pt' ? formatoBRL.format(plano.precoBRL) : formatoUSD.format(plano.precoUSD)}
                  </div>
                  <p className="text-xs text-foreground-500">
                    {idioma === 'pt' ? 'por mês' : 'per month'}
                  </p>
                </td>
                <td className="px-6 py-4 text-foreground-700">
                  {plano.limiteMensagens === 'ilimitado'
                    ? idioma === 'pt'
                      ? 'Ilimitado'
                      : 'Unlimited'
                    : plano.limiteMensagens}
                </td>
                <td className="px-6 py-4 text-center">
                  {plano.iaIlimitada ? (
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-em-100 text-em-600 text-[10px]">
                      ✓
                    </span>
                  ) : (
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-foreground-200 text-foreground-400 text-[10px]">
                      –
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  <button
                    className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                      plano.destaque
                        ? 'bg-foreground-900 text-white hover:bg-foreground-800 focus:outline-none focus:ring-2 focus:ring-foreground-900 focus:ring-offset-2'
                        : 'bg-white text-foreground-700 border border-foreground-200 hover:bg-foreground-50 focus:outline-none focus:ring-2 focus:ring-foreground-300 focus:ring-offset-2'
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

      <p className="mt-6 text-center text-xs text-foreground-400">
        Preços exibidos de acordo com o idioma do seu navegador.
      </p>
    </section>
  );
}
