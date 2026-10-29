const API_URL = '/api/viagem';
let viagemData = null;

async function fetchViagemData(token) {
  try {
    const response = await fetch(`${API_URL}?t=${token}`);
    if (!response.ok) throw new Error('Falha ao carregar dados da viagem');
    viagemData = await response.json();
    saveToIndexedDB(viagemData);
    renderApp(viagemData);
  } catch (error) {
    console.error('Erro ao buscar dados da viagem:', error);
    restoreFromIndexedDB();
  }
}

function saveToIndexedDB(data) {
  const request = indexedDB.open('viajantepro', 1);
  request.onupgradeneeded = () => {
    const db = request.result;
    db.createObjectStore('viagens', { keyPath: 'token' });
  };
  request.onsuccess = () => {
    const db = request.result;
    const transaction = db.transaction('viagens', 'readwrite');
    const store = transaction.objectStore('viagens');
    store.put({ token: data.viagem.token, data });
  };
}

function restoreFromIndexedDB() {
  const request = indexedDB.open('viajantepro', 1);
  request.onsuccess = () => {
    const db = request.result;
    const transaction = db.transaction('viagens', 'readonly');
    const store = transaction.objectStore('viagens');
    const getRequest = store.get('TOKEN_TESTE_VP');
    getRequest.onsuccess = () => {
      if (getRequest.result) {
        viagemData = getRequest.result.data;
        renderApp(viagemData, true);
      }
    };
  };
}

function renderApp(data, isOffline = false) {
  const appContent = document.getElementById('app-content');
  appContent.innerHTML = '';

  if (isOffline) {
    const offlineNotice = document.createElement('div');
    offlineNotice.textContent = `Atualizado às ${new Date(data.timestamp).toLocaleTimeString()}`;
    appContent.appendChild(offlineNotice);
  }

  // Renderizar conteúdo das abas com base em data.viagem
  // Exemplo para aba "Hoje":
  const hojeTab = document.getElementById('tab-hoje');
  hojeTab.innerHTML = `
    <div class="card">
      <h2>Hoje</h2>
      ${data.viagem.hoje.eventos.map(evento => `
        <div>${evento.hora} - ${evento.titulo}</div>
      `).join('')}
    </div>
  `;

  // Renderizar outras abas...
}

document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('t');
  if (!token) {
    alert('Token de viagem não fornecido.');
    return;
  }

  fetchViagemData(token);

  // Lógica para instalar PWA
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
      .then(() => {
        console.log('Service Worker registrado com sucesso.');
        if (isPWASupported()) {
          document.getElementById('install-button').style.display = 'block';
        }
      })
      .catch(error => console.error('Erro ao registrar Service Worker:', error));
  }

  function isPWASupported() {
    return 'BeforeInstallPromptEvent' in window;
  }

  let deferredPrompt;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    document.getElementById('install-button').style.display = 'block';
  });

  document.getElementById('install-button').addEventListener('click', () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(({ outcome }) => {
        if (outcome === 'accepted') {
          console.log('Usuário instalou o app.');
        }
        deferredPrompt = null;
      });
    }
  });

  // Navegação entre abas
  const tabButtons = document.querySelectorAll('.tab-button');
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.getAttribute('data-tab');
      document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
      });
      document.getElementById(`tab-${tabName}`).classList.add('active');
    });
  });
});
