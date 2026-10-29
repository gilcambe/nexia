<template>
  <div class="escada-card" data-testid="escada-card">
    <div class="card-header">
      <h3>🪜 Escada</h3>
      <span class="periodo">Semana</span>
    </div>
    <div class="progress-bars">
      <div class="progress-bar" data-testid="progresso-cortex">
        <span>Cortex</span>
        <div class="bar">
          <div class="fill" :style="{ width: cortexProgress + '%' }"></div>
        </div>
        <span>{{ cortexProgress }}%</span>
      </div>
      <div class="progress-bar" data-testid="progresso-ias-gratis">
        <span>IAs grátis</span>
        <div class="bar">
          <div class="fill" :style="{ width: freeIAsProgress + '%' }"></div>
        </div>
        <span>{{ freeIAsProgress }}%</span>
      </div>
      <div class="progress-bar" data-testid="progresso-claude">
        <span>Claude</span>
        <div class="bar">
          <div class="fill" :style="{ width: claudeProgress + '%' }"></div>
        </div>
        <span>{{ claudeProgress }}%</span>
      </div>
    </div>
    <div class="queue-info">
      <span v-if="fila !== null && fila !== undefined" class="fila-info" data-testid="fila">Na fila: {{ fila }}</span>
      <span class="jules-info" data-testid="jules">Jules hoje {{ julesToday }}/15</span>
      <span v-if="faseB" class="badge badge-fase-b" data-testid="badge-fase-b">Pronto para fase B</span>
    </div>
  </div>
</template>

<script>
export default {
  name: 'EscadaCard',
  data() {
    return {
      cortexProgress: 0,
      freeIAsProgress: 0,
      claudeProgress: 0,
      fila: 0,
      julesToday: 0,
      faseB: false,
      carregando: false
    };
  },
  async created() {
    await this.carregar();
  },
  methods: {
    async carregar() {
      this.carregando = true;
      try {
        const response = await fetch('/escada');
        if (!response.ok) return;
        const data = await response.json();
        this.cortexProgress = data.semana?.cortex ?? data.cortexProgress ?? data.cortex ?? 0;
        this.freeIAsProgress = data.semana?.iasGratis ?? data.semana?.freeIAs ?? data.freeIAsProgress ?? data.freeIAs ?? data.iasGratis ?? 0;
        this.claudeProgress = data.semana?.claude ?? data.claudeProgress ?? data.claude ?? 0;
        this.fila = data.fila ?? data.queue ?? data.emFila ?? 0;
        this.julesToday = data.julesHoje ?? data.julesToday ?? data.jules ?? 0;
        this.faseB = Boolean(data.faseB ?? data.prontoFaseB ?? data.fase_b);
      } catch (error) {
        console.error('Failed to fetch escada data:', error);
      } finally {
        this.carregando = false;
      }
    }
  }
};
</script>

<style scoped>
.escada-card {
  background: white;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.escada-card h3 {
  margin: 0;
  color: #333;
}

.periodo {
  font-size: 12px;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.progress-bars {
  margin: 16px 0;
}

.progress-bar {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.progress-bar span {
  width: 80px;
  font-size: 14px;
}

.bar {
  flex: 1;
  height: 8px;
  background: #e0e0e0;
  border-radius: 4px;
  margin: 0 8px;
  overflow: hidden;
}

.fill {
  height: 100%;
  background: #4CAF50;
  border-radius: 4px;
  transition: width 0.3s ease;
}

.queue-info {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  font-size: 13px;
  color: #555;
}

.badge {
  background: #4CAF50;
  color: white;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: bold;
}
</style>
