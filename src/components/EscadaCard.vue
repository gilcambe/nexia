<template>
  <div class="escada-card">
    <div class="card-header">
      <h3>🪜 Escada</h3>
      <div v-if="faseB" class="status-badge ready">Pronto para fase B</div>
    </div>
    
    <div class="progress-section">
      <div class="progress-item">
        <div class="progress-info">
          <span class="progress-label">Cortex</span>
          <span class="progress-value">{{ escadaData.cortex }}%</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill cortex" :style="{ width: escadaData.cortex + '%' }"></div>
        </div>
      </div>
      
      <div class="progress-item">
        <div class="progress-info">
          <span class="progress-label">IAs grátis</span>
          <span class="progress-value">{{ escadaData.gratis }}%</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill gratis" :style="{ width: escadaData.gratis + '%' }"></div>
        </div>
      </div>
      
      <div class="progress-item">
        <div class="progress-info">
          <span class="progress-label">Claude</span>
          <span class="progress-value">{{ escadaData.claude }}%</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill claude" :style="{ width: escadaData.claude + '%' }"></div>
        </div>
      </div>
    </div>
    
    <div class="stats-section">
      <div class="stat-item">
        <div class="stat-label">Fila de pedidos</div>
        <div class="stat-value">{{ escadaData.filaPedidos }}</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">Jules hoje</div>
        <div class="stat-value">{{ escadaData.julesHoje }}/15</div>
      </div>
    </div>
    
    <div v-if="loading" class="loading">
      <div class="spinner"></div>
      <span>Carregando dados...</span>
    </div>
    
    <div v-if="error" class="error">
      Erro ao carregar dados da escada
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue';

export default {
  name: 'EscadaCard',
  setup() {
    const escadaData = ref({
      cortex: 0,
      gratis: 0,
      claude: 0,
      filaAtual: 0,
      julesHoje: 0,
      faseB: false
    });
    
    const loading = ref(true);
    const error = ref(false);
    
    const carregar = async () => {
      try {
        loading.value = true;
        error.value = false;
        
        const response = await fetch('/escada');
        
        if (!response.ok) {
          throw new Error('Erro ao buscar dados da escada');
        }
        
        const data = await response.json();
        
        const semana = data.semana || data;
        const fila = semana.filaPedidos !== undefined ? semana.filaPedidos : (semana.filaAtual !== undefined ? semana.filaAtual : (data.fila || 0));
        
        escadaData.value = {
          cortex: Number(semana.cortex ?? data.cortex ?? 0),
          gratis: Number(semana.gratis ?? semana.iasGratis ?? data.gratis ?? 0),
          claude: Number(semana.claude ?? data.claude ?? 0),
          filaPedidos: Number(fila),
          julesHoje: Number(semana.julesHoje ?? data.julesHoje ?? 0),
          faseB: Boolean(semana.faseB ?? data.faseB ?? false)
        };
        
      } catch (err) {
        console.error('Erro ao carregar dados da escada:', err);
        error.value = true;
      } finally {
        loading.value = false;
      }
    };
    
    onMounted(() => {
      carregar();
    });
    
    return {
      escadaData,
      loading,
      error
    };
  }
};
</script>

<style scoped>
.escada-card {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border: 1px solid #e0e0e0;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.card-header h3 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #333;
}

.status-badge {
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.status-badge.ready {
  background: #10b981;
  color: white;
}

.progress-section {
  margin-bottom: 24px;
}

.progress-item {
  margin-bottom: 16px;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.progress-label {
  font-size: 14px;
  font-weight: 500;
  color: #666;
}

.progress-value {
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.progress-bar {
  height: 8px;
  background: #f0f0f0;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s ease;
}

.progress-fill.cortex {
  background: #3b82f6;
}

.progress-fill.gratis {
  background: #10b981;
}

.progress-fill.claude {
  background: #8b5cf6;
}

.stats-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
}

.stat-item {
  text-align: center;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
}

.stat-label {
  font-size: 12px;
  color: #666;
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #333;
}

.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #666;
  font-size: 14px;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid #f3f3f3;
  border-top: 2px solid #666;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error {
  text-align: center;
  color: #ef4444;
  font-size: 14px;
  padding: 12px;
  background: #fef2f2;
  border-radius: 6px;
  border: 1px solid #fecaca;
}
</style>