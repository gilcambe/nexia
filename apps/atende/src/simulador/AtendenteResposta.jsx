<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AtendenteResposta - NEXIA OS</title>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
  <style>
    :root {
      --primary: #1a1a2e;
      --accent: #e94560;
      --bg: #f5f2f0;
      --surface: #ffffff;
      --text: #2d3436;
      --muted: #636e72;
      --radius: 8px;
      --shadow: 0 2px 8px rgba(0,0,0,0.05);
    }

    * { box-sizing: border-box; }

    body {
      font-family: 'Inter', sans-serif;
      background: var(--bg);
      color: var(--text);
      margin: 0;
      padding: 20px;
    }

    .container {
      max-width: 800px;
      margin: 0 auto;
    }

    .mode-indicator {
      background: var(--surface);
      border: 2px solid var(--muted);
      border-radius: var(--radius);
      padding: 20px;
      margin-bottom: 20px;
      transition: border-color 0.3s, background 0.3s;
    }

    .mode-indicator.active {
      border-color: var(--primary);
      background: #f0eff0;
    }

    .mode-name {
      font-weight: 600;
      font-size: 1.1rem;
      margin-bottom: 8px;
    }

    .mode-desc {
      font-size: 0.85rem;
      color: var(--muted);
      margin-bottom: 12px;
    }

    .controls {
      display: gap; flex-wrap: wrap; justify-content: center; }

    .mode-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      border: 2px solid var(--muted);
      border-radius: var(--radius);
      background: transparent;
      color: var(--text);
      font-size: 0.9rem;
      cursor: pointer;
      transition: all 0.2s;
      white-space: nowrap;
    }

    .mode-btn:hover {
      border-color: var(--primary);
      color: var(--primary);
    }

    .mode-btn.active {
      border-color: var(--primary);
      background: rgba(26, 26, 46, 0.1);
      color: var(--primary);
    }

    .mode-btn.loading {
      pointer-events: none;
      opacity: 0.7;
    }

    .btn-falar::after {
      content: '●'; color: var(--accent); font-size: 0.7rem; }

    .btn-nuvem::after {
      content: '☁'; color: var(--muted); font-size: 0.7rem; }

    .btn-digitar::after {
      content: '⌨'; color: var(--muted); font-size: 0.7rem; }

    .input-field {
      width: 100%;
      padding: 10px 14px;
      border: 2px solid var(--muted);
      border-radius: var(--radius);
      font-size: 1rem;
      background: var(--surface);
      color: var(--text);
      transition: border-color 0.2s;
      margin-top: 8px;
    }

    .input-field:focus {
      outline: none;
      border-color: var(--primary);
    }

    .input-field.disabled {
      opacity: 0.5;
      pointer-events: none;
    }

    .audio-status {
      margin-top: 8px;
      font-size: 0.75rem;
      color: var(--muted);
    }

    .fallback-warning {
      background: #fff3cd;
      border: 1px solid #ffeeba;
      border-radius: var(--radius);
      padding: 10px;
      margin-top: 10px;
      display: none;
      color: #856404;
    }

    @media (max-width: 480px) {
      .controls { gap: 8px; }
      .mode-btn { padding: 6px 12px; font-size: 0.8rem; }
      .container { padding: 10px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>AtendenteResposta</h1>

    <!-- Modo indicador -->
    <div id="mode-indicator" class="mode-indicator" data-mode="digitar">
      <div class="mode-name" id="mode-name">Digitar</div>
      <div class="mode-desc">Digite sua mensagem abaixo</div>
      <div class="controls">
        <button class="mode-btn active mode-btn-digitar" data-mode="digitar" aria-pressed="true">
          <span class="btn-digitar">Digitar</span>
        </button>
        <button class="mode-btn mode-btn-falar" data-mode="falar" aria-pressed="false" disabled>
          <span class="btn-falar">Falar</span>
          <span class="loading-indicator" style="display:none; border: 2px solid rgba(233,69,96,0.3); border-radius: 999px; width: 12px; height: 12px; animation: spinner 0.8s linear infinite;">
            <style>
              @keyframes spinner { to { transform: rotate(360deg); }
            </style>
            <div style="border: 2px solid transparent; border-top-color: currentColor; border-radius: 999px; width: 12px; height: 12px;"></div>
          </span>
        </button>
        <button class="mode-btn mode-btn-nuvem" data-mode="nuvem" aria-pressed="false" disabled>
          <span class="btn-nuvem">Transcrever na nuvem</span>
        </button>
      </div>
    </div>

    <!-- Área de digitação (sempre visível) -->
    <div id="digitar-area" class="mb-3">
      <textarea id="txt-input" class="input-field" placeholder="Digite sua mensagem..." rows="2" disabled></textarea>
    </div>

    <!-- Área de áudio (aparece quando modo falar está ativo) -->
    <div id="falar-area" class="mb-3" style="display:none;">
      <div class="audio-status" id="audio-status">Clique em "Falar" e conceda permissão de microfone</div>
      <input type="file" id="audio-input" accept="audio/*" style="display:none;" />
    </div>

    <!-- Aviso de fallback -->
    <div id="fallback-warning" class="fallback-warning" style="display:none;">
      ⚠�sup2> Carregamento do modelo WASM falhou. Mudando para transcrição na nuvem. Clique em "Transcrever na nuvem" para continuar.
    </div>

    <p style="margin-top: 20px; font-size: 0.8rem; color: var(--muted);">
      Atendente ativo • Modo: <span id="modo-atual">Digitar</span>
    </p>
  </div>

  <script type="module">
    import { createAtendenteResposta } from './AtendenteResposta.js';
    createAtendenteResposta();
  </script>
</body>
</html>