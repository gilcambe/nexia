<template>
  <div class="escada-card" v-if="!error">
    <div class="card-header">
      <h2>🪜 Escada</h2>
      <span class="fase-badge" v-if="data.faseB === true" v-text="'Pronto para fase B'"></span>
    </div>

    <div class="progress-bars">
      <div class="progress-item" v-for="item in progressItems" :key="item.label">
        <div class="progress-label" v-text="item.label"></div>
        <div class="progress-bar">
          <div
            class="progress-fill"
            :style="{ width: item.percent + '%' }"
            role="progressbar"
            :aria-valuenow="item.percent"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-label="item.label + ': ' + item.percent + '%'">
            <span class="progress-text" v-text="item.percent + '%'"></span>
          </div>
        </div>
      </div>
    </div>

    <div class="queue-info">
      <div class="queue-item" v-text="'Fila Cortex: ' + sanitizeNumber(data.queueCortex)"></div>
      <div class="queue-item" v-text="'Fila IAs grátis: ' + sanitizeNumber(data.queueFreeAI)"></div>
      <div class="queue-item" v-text="'Fila Claude: ' + sanitizeNumber(data.queueClaude)"></div>
    </div>

    <div class="jules-info" v-text="'Jules hoje ' + sanitizeNumber(data.julesToday) + '/15'"></div>
  </div>

  <div class="escada-card error-state" v-else>
    <p v-text="'Erro ao carregar Escada: ' + error"></p>
    <button @click="fetchData" class="retry-btn" v-text="'Tentar novamente'"></button>
  </div>
</template>

<script>
export default {
  name: 'EscadaCard',
  data() {
    return {
      data: {
        cortexPercent: 0,
        freeAIPercent: 0,
        claudePercent: 0,
        queueCortex: 0,
        queueFreeAI: 0,
        queueClaude: 0,
        julesToday: 0,
        faseB: false
      },
      error: null,
      loading: true
    };
  },
  computed: {
    progressItems() {
      return [
        { label: 'Cortex', percent: this.data.cortexPercent },
        { label: 'IAs grátis', percent: this.data.freeAIPercent },
        { label: 'Claude', percent: this.data.claudePercent }
      ];
    }
  },
  async created() {
    await this.fetchData();
  },
  methods: {
    sanitizeNumber(val) {
      const num = Number(val);
      return isNaN(num) ? 0 : num;
    },
    validateData(raw) {
      if (!raw || typeof raw !== 'object') {
        throw new Error('Resposta inválida da API');
      }
      const required = ['cortexPercent', 'freeAIPercent', 'claudePercent', 'queueCortex', 'queueFreeAI', 'queueClaude', 'julesToday', 'faseB'];
      for (const key of required) {
        if (!(key in raw)) {
          throw new Error(`Campo obrigatório ausente: ${key}`);
        }
      }
      // Validar ranges
      ['cortexPercent', 'freeAIPercent', 'claudePercent'].forEach(key => {
        const val = Number(raw[key]);
        if (isNaN(val) || val < 0 || val > 100) {
          throw new Error(`${key} deve ser número entre 0 e 100`);
        }
      });
      ['queueCortex', 'queueFreeAI', 'queueClaude', 'julesToday'].forEach(key => {
        const val = Number(raw[key]);
        if (isNaN(val) || val < 0) {
          throw new Error(`${key} deve ser número não negativo`);
        }
      });
      if (typeof raw.faseB !== 'boolean') {
        throw new Error('faseB deve ser booleano');
      }
      return raw;
    },
    async fetchData() {
      this.loading = true;
      this.error = null;
      try {
        const response = await fetch('/escada');
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const raw = await response.json();
        const validated = this.validateData(raw);
        this.data = validated;
      } catch (err) {
        console.error('[EscadaCard] Erro ao buscar dados:', err);
        this.error = err.message || 'Erro desconhecido';
        // Reset para valores seguros
        this.data = {
          cortexPercent: 0,
          freeAIPercent: 0,
          claudePercent: 0,
          queueCortex: 0,
          queueFreeAI: 0,
          queueClaude: 0,
          julesToday: 0,
          faseB: false
        };
      } finally {
        this.loading = false;
      }
    }
  }
};
</script>

<style scoped>
.escada-card {
  background: var(--surface, #fff);
  border: 1px solid var(--border, #e0e0e0);
  border-radius: var(--radius, 12px);
  padding: 20px;
  box-shadow: var(--shadow, 0 2px 8px rgba(0,0,0,0.08));
}

.escada-card.error-state {
  border-color: var(--danger, #dc3545);
  background: var(--danger-light, #fff5f5);
  text-align: center;
  padding: 24px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.card-header h2 {
  margin: 0;
  font-size: 1.25rem;
  color: var(--text, #1a1a1a);
}

.fase-badge {
  background: var(--success, #28a745);
  color: white;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 600;
}

.progress-bars {
  margin-bottom: 16px;
}

.progress-item {
  margin-bottom: 12px;
}

.progress-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text, #1a1a1a);
  margin-bottom: 4px;
}

.progress-bar {
  height: 8px;
  background: var(--muted, #f0f0f0);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--primary, #0066cc);
  border-radius: 4px;
  transition: width 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 8px;
  min-width: 0;
}

.progress-text {
  color: white;
  font-size: 0.7rem;
  font-weight: 600;
  white-space: nowrap;
}

.queue-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
  font-size: 0.875rem;
  color: var(--muted-text, #666);
}

.jules-info {
  font-weight: 600;
  color: var(--text, #1a1a1a);
  font-size: 0.875rem;
}

.retry-btn {
  margin-top: 12px;
  padding: 8px 16px;
  background: var(--primary, #0066cc);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.875rem;
}

.retry-btn:hover {
  opacity: 0.9;
}

@media (prefers-reduced-motion: reduce) {
  .progress-fill {
    transition: none;
  }
}
</style>