
    <div class="card-header">
      <h2>🗚️ Escada</h2>
      <span v-if="faseB" class="fase-badge">Pronto para fase B</span>
    </div>

    <div class="progress-bars">
      <div v-for="item in progressItems" :key="item.label" class="progress-item">
        <div class="progress-label">{{ item.label }}</div>
        <div class="progress-bar">
          <div
            class="progress-fill"
            :style="{ width: item.percent + '%' }"
            role="progressbar"
            :aria-valuenow="item.percent"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-label="`${item.label}: ${item.percent}%`"
          >
            <span class="progress-text">{{ item.percent }}%</span>
          </div>
        </div>
      </div>
    </div>

    <div class="queue-info">
      <div class="queue-item">Fila: {{ fila }}</div>
    </div>

    <div class="jules-info">
      Jules hoje {{ julesHoje }} / 15
    </div>

    <div v-if="error" class="error-state">
      <p>Erro ao carregar Escada: {{ error }}</p>
      <button @click="fetchData" class="retry-btn">Tentar novamente</button>
    </div>

    <div v-if="loading && !error" class="loading-state">
      <div class="loading-spinner"></div>
      <p>Carregando dados da Escada...</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';

const faseB = ref(false);
const fila = ref(0);
const julesHoje = ref(0);
const semana = ref({ cortex: 0, iasGratis: 0, claude: 0 });
const error = ref(null);
const loading = ref(true);

const progressItems = computed(() => [
  { label: 'Cortex', percent: semana.value.cortex },
  { label: 'IAs grátis', percent: semana.value.iasGratis },
  { label: 'Claude', percent: semana.value.claude },
]);

const sanitizeNumber = (val) => {
  const num = Number(val);
  return isNaN(num) ? 0 : num;
};

const validateData = (raw) => {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Resposta inválida da API');
  }

  const required = ['faseB', 'fila', 'julesHoje', 'semana'];
  for (const key of required) {
    if (!(key in raw)) {
      throw new Error(`Campo obrigatório ausente: ${key}`);
    }
  }

  if (typeof raw.faseB !== 'boolean') {
    throw new Error('faseB deve ser booleano');
  }

  ['fila', 'julesHoje'].forEach((key) => {
    const val = Number(raw[key]);
    if (isNaN(val) || val < 0) {
      throw new Error(`${key} deve ser número não negativo`);
    }
  });

  if (!raw.semana || typeof raw.semana !== 'object') {
    throw new Error('semana deve ser objeto');
  }

  ['cortex', 'iasGratis', 'claude'].forEach((key) => {
    const val = Number(raw.semana[key]);
    if (isNaN(val) || val < 0 || val > 100) {
      throw new Error(`semana.${key} deve ser número entre 0 e 100`);
    }
  });

  return {
    faseB: raw.faseB,
    fila: sanitizeNumber(raw.fila),
    julesHoje: sanitizeNumber(raw.julesHoje),
    semana: {
      cortex: sanitizeNumber(raw.semana.cortex),
      iasGratis: sanitizeNumber(raw.semana.iasGratis),
      claude: sanitizeNumber(raw.semana.claude),
    },
  };
};

const fetchData = async () => {
  loading.value = true;
  error.value = null;

  try {
    const response = await fetch('/escada');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const raw = await response.json();
    const validated = validateData(raw);
    faseB.value = validated.faseB;
    fila.value = validated.fila;
    julesHoje.value = validated.julesHoje;
    semana.value = validated.semana;
  } catch (err) {
    console.error('[EscadaCard] Erro ao buscar dados:', err);
    error.value = err instanceof Error ? err.message : 'Erro desconhecido';
    faseB.value = false;
    fila.value = 0;
    julesHoje.value = 0;
    semana.value = { cortex: 0, iasGratis: 0, claude: 0 };
  } finally {
    loading.value = false;
  }
};

onMounted(fetchData);
</script>

<style scoped>
.escada-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px;
  box-sizing: border-box;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}

.card-header h2 {
  margin: 0;
  font-size: 18px;
  color: #0f172a;
}

.fase-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 10px;
  border-radius: 999px;
  background: #dcfce7;
  color: #166534;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid #86efac;
}

.progress-bars {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 16px;
}

.progress-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.progress-label {
  font-size: 13px;
  font-weight: 600;
  color: #334155;
}

.progress-bar {
  height: 8px;
  border-radius: 4px;
  background: #e2e8f0;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 4px;
  background: #2563eb;
  transition: width 0.6s ease;
  position: relative;
}

.progress-text {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 0 2px rgba(0,0,0,0.45);
}

.queue-info,
.jules-info {
  font-size: 14px;
  color: #0f172a;
  margin-bottom: 10px;
}

.queue-item {
  font-weight: 600;
}

.error-state {
  padding: 12px;
  background: #fee2e2;
  border-radius: 8px;
  color: #991b1b;
  font-size: 13px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.retry-btn {
  align-self: start;
  padding: 4px 12px;
  font-size: 13px;
  border: 1px currentcolor;
  border-radius: 6px;
  background: transparent;
  color: currentcolor;
  cursor: pointer;
}

.retry-btn:hover {
  opacity: 0.9;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 20px;
  color: #64748b;
  font-size: 13px;
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 3px solid #e2e8f0;
  border-top-color: #2563eb;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>