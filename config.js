/**
 * config.js
 * Tela de Configurações do Cortex - incluindo opção para IA local (WebGPU)
 */

import React, { useState, useEffect } from 'react';
import { obterConfig, salvarConfig, verificarSuporteWebGPU } from './ia-local';

const ConfiguracoesCortex = () => {
  const [config, setConfig] = useState({ ativo: false, modelo: 'PEQUENO' });
  const [suporteWebGPU, setSuporteWebGPU] = useState(null);
  const [memoriaGb, setMemoriaGb] = useState(null);
  const [avisos, setAvisos] = useState({
    bloqueio: '',
    download: '',
    erro: ''
  });
  const [carregando, setCarregando] = useState(true);

  // Verificar suporte WebGPU e memória ao carregar
  useEffect(() => {
    const verificarSuporte = async () => {
      try {
        const suporte = await verificarSuporteWebGPU();
        setSuporteWebGPU(suporte.suportado);
        setMemoriaGb(suporte.memoriaGb);
        
        if (!suporte.suportado) {
          setAvisos(prev => ({
            ...prev,
            bloqueio: suporte.motivo || 'Seu dispositivo/navegador não suporta WebGPU.'
          }));
        }
      } catch (err) {
        setAvisos(prev => ({
          ...prev,
          erro: `Erro ao verificar suporte: ${err?.message || err}`
        }));
      }
      setCarregando(false);
    };

    const configAtual = obterConfig();
    setConfig(configAtual);
    verificarSuporte();
  }, []);

  const handleSwitchChange = async (e) => {
    const ativo = e.target.checked;
    
    // Se tentando ativar mas não tem suporte
    if (ativo && !suporteWebGPU) {
      setAvisos(prev => ({
        ...prev,
        bloqueio: 'Não é possível ativar a IA local. Seu dispositivo não suporta WebGPU.'
      }));
      return;
    }

    // Se ativando, mostrar aviso de download
    if (ativo) {
      setAvisos(prev => ({
        ...prev,
        download: 'Ao ativar, será necessário baixar ~1 GB de dados do modelo. Recomendado Wi-Fi.'
      }));
      
      // Aqui você poderia adicionar uma confirmação antes de salvar
      // const confirmar = window.confirm('Deseja realmente baixar ~1 GB? Recomendado Wi-Fi.');
      // if (!confirmar) return;
    }

    // Salvar nova configuração
    const novaConfig = salvarConfig({ ativo });
    setConfig(novaConfig);
  };

  if (carregando) {
    return <div>Carregando configurações...</div>;
  }

  return (
    <div className="configuracoes-cortex">
      <h2>Configurações do Cortex</h2>
      
      <div className="config-item">
        <div className="config-info">
          <h3>IA no meu aparelho (grátis, offline)</h3>
          <p className="config-desc">
            Executa a IA diretamente no seu dispositivo, sem necessidade de internet.
            Mais rápido e privado, mas requer hardware compatível.
          </p>
          {memoriaGb && (
            <p className="config-info">
              Memória detectada: {memoriaGb} GB
            </p>
          )}
        </div>
        
        <div className="config-control">
          <label className="switch">
            <input
              type="checkbox"
              checked={config.ativo}
              onChange={handleSwitchChange}
              disabled={!suporteWebGPU}
            />
            <span className="slider"></span>
          </label>
          
          {!suporteWebGPU && (
            <div className="aviso-bloqueio">
              <i className="ri-error-warning-line"></i>
              {avisos.bloqueio || 'Requer suporte WebGPU.'}
            </div>
          )}
        </div>
      </div>
      
      {avisos.download && (
        <div className="aviso-download">
          <i className="ri-download-line"></i>
          {avisos.download}
          <button 
            className="btn-download"
            onClick={() => {
              // Aqui você implementaria o download do modelo
              alert('Download iniciado...');
            }}
          >
            Baixar agora
          </button>
        </div>
      )}
      
      {avisos.erro && (
        <div className="aviso-erro">
          <i className="ri-alert-line"></i>
          {avisos.erro}
        </div>
      )}
      
      <style jsx>{`
        .configuracoes-cortex {
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
        }
        
        .config-item {
          background: #1a1a1a;
          border: 1px solid #333;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 20px;
        }
        
        .config-info h3 {
          margin-bottom: 8px;
          color: #fff;
        }
        
        .config-desc {
          color: #ccc;
          font-size: 14px;
          margin-bottom: 10px;
        }
        
        .config-info {
          color: #aaa;
          font-size: 12px;
        }
        
        .config-control {
          display: flex;
          align-items: center;
          gap: 15px;
        }
        
        .switch {
          position: relative;
          display: inline-block;
          width: 50px;
          height: 24px;
        }
        
        .switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }
        
        .slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: #333;
          transition: .4s;
          border-radius: 24px;
        }
        
        .slider:before {
          position: absolute;
          content: "";
          height: 16px;
          width: 16px;
          left: 4px;
          bottom: 4px;
          background-color: white;
          transition: .4s;
          border-radius: 50%;
        }
        
        input:checked + .slider {
          background-color: #4CAF50;
        }
        
        input:checked + .slider:before {
          transform: translateX(26px);
        }
        
        input:disabled + .slider {
          background-color: #555;
          cursor: not-allowed;
        }
        
        .aviso-bloqueio,
        .aviso-download,
        .aviso-erro {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px;
          border-radius: 6px;
          margin-top: 15px;
          font-size: 14px;
        }
        
        .aviso-bloqueio {
          background: rgba(255, 0, 0, 0.1);
          border: 1px solid rgba(255, 0, 0, 0.3);
          color: #ff6b6b;
        }
        
        .aviso-download {
          background: rgba(255, 193, 7, 0.1);
          border: 1px solid rgba(255, 193, 7, 0.3);
          color: #ffc107;
        }
        
        .aviso-erro {
          background: rgba(220, 53, 69, 0.1);
          border: 1px solid rgba(220, 53, 69, 0.3);
          color: #dc3545;
        }
        
        .btn-download {
          margin-left: auto;
          padding: 6px 12px;
          background: #ffc107;
          border: none;
          border-radius: 4px;
          color: #000;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }
        
        .btn-download:hover {
          background: #ffb300;
        }
      `}</style>
    </div>
  );
};

export default ConfiguracoesCortex;