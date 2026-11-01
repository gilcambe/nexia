'use strict';
/**
 * Central NEXIA - Página de saúde do Cofre (Vault)
 * Exibe o uso diário de cada banco (Firestore B, C, D1, CofreSql)
 * com alertas quando passam de 70% da cota grátis.
 */
import React, { useState, useEffect } from 'react';
import { obterUsoTodosBancos } from '../../../src/durable/VazaoController';

export default function SaudeVazao() {
  const [bancos, setBancos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    async function carregar() {
      try {
        setCarregando(true);
        const resp = await fetch('/api/central/cofre-vazao', {
          headers: { 'Content-Type': 'application/json' }
        });
        if (!resp.ok) throw new Error('Falha ao carregar uso dos bancos');
        const data = await resp.json();
        setBancos(data.bancos || []);
      } catch (e) {
        setErro(e.message);
      } finally {
        setCarregando(false);
      }
    }
    carregar();
  }, []);

  if (carregando) {
    return (
      <div className="min-h-screen p-4 text-center">
        <p className="text-gray-600">Carregando saúde do cofre...</p>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="min-h-screen p-4 text-center">
        <p className="text-red-600 font-medium">Erro: {erro}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-gray-800">Saúde do Cofre (Vault)</h1>
          <p className="text-gray-600 mt-2">
            Uso diário de cada banco do rodízio: Firestore B → C → D1 → CofreSql.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {bancos.map((b) => (
            <div
              key={b.banco}
              className={`bg-white rounded-lg shadow p-6 border-l-4 ${
                b.status === 'quase cheio'
                  ? 'border-amber-500 bg-amber-50'
                  : b.status === 'cheio'
                    ? 'border-red-500 bg-red-50'
                    : 'border-blue-500'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <span className="font-semibold text-gray-700">{b.banco}</span>
                <span
                  className={`text-xs font-bold px-2 py-1 rounded-full uppercase ${
                    b.status === 'quase cheio'
                      ? 'bg-amber-100 text-amber-700'
                      : b.status === 'cheio'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {b.status === 'quase cheio' ? 'Quase cheio' : b.status === 'cheio' ? 'Cheio' : 'Ativo'}
                </span>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Leituras</span>
                  <span className="font-mono">{b.leituras.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Escritas</span>
                  <span className="font-mono">{b.escritas.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Limite leituras</span>
                  <span className="font-mono text-gray-400 text-xs">{b.limiteLeituras?.toLocaleString() ?? '—'}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Limite escritas</span>
                  <span className="font-mono text-gray-400 text-xs">{b.limiteEscritas?.toLocaleString() ?? '—'}</span>
                </div>
              </div>

              <div className="mt-4 h-2 bg-gray-200 rounded overflow-hidden">
                <div
                  className={`h-full ${
                    b.status === 'quase cheio' ? 'bg-amber-500' : b.status === 'cheio' ? 'bg-red-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${Math.min(100, b.percentualLeituras ?? 0)}%` }}
                  role="progressbar"
                  aria-valuenow={b.percentualLeituras ?? 0}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Uso de leituras do banco ${b.banco}: ${b.percentualLeituras ?? 0}%`}
                ></div>
              </div>
            </div>
          ))}
        </div>

        {bancos.some((b) => b.status === 'quase cheio' || b.status === 'cheio') && (
          <section className="bg-amber-50 border border-amber-200 rounded-lg p-6 mb-8">
            <h2 className="text-lg font-bold text-amber-800 mb-4">⚠️ Aviso de cota (Sentinel)</h2>
            <p className="text-amber-700 mb-4">
              Um ou mais bancos passaram de 70% da cota grátis. O Vault fez a troca preventiva automaticamente.
            </p>
            <ul className="list-disc list-inside text-amber-700 space-y-2">
              {bancos
                .filter((b) => b.status === 'quase cheio' || b.status === 'cheio')
                .map((b) => (
                  <li key={b.banco}>
                    Banco <strong>{b.banco}</strong>: {b.percentualLeituras?.toFixed(1)}% leituras / {b.percentualEscritas?.toFixed(1)}% escritas
                  </li>
                ))}
            </ul>
          </section>
        )}

        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Passo a passo quando um banco enche</h2>
          <ol className="list-decimal list-inside text-gray-700 space-y-2">
            <li>O dono é avisado na Central com o rótulo <code className="bg-gray-100 px-1.5 rounded">sentinel</code>.</li>
            <li>O Vault troca automaticamente para o próximo banco do rodízio (B → C → D1 → CofreSql).</li>
            <li>Verifique o consumo de cada banco nesta tela.</li>
            <li>Se necessário, redefina cotas ou limpe dados antigos no banco que encheu.</li>
          </ol>
        </section>
      </div>
    </div>
  );
}
