<template>
  <div class="escada-card">
    <h3>🪜 Escada</h3>
    <div class="progress-bars">
      <div class="progress-bar">
        <span>Cortex</span>
        <div class="bar">
          <div class="fill" :style="{ width: cortexProgress + '%' }"></div>
        </div>
        <span>{{ cortexProgress }}%</span>
      </div>
      <div class="progress-bar">
        <span>IAs grátis</span>
        <div class="bar">
          <div class="fill" :style="{ width: freeIAsProgress + '%' }"></div>
        </div>
        <span>{{ freeIAsProgress }}%</span>
      </div>
      <div class="progress-bar">
        <span>Claude</span>
        <div class="bar">
          <div class="fill" :style="{ width: claudeProgress + '%' }"></div>
        </div>
        <span>{{ claudeProgress }}%</span>
      </div>
    </div>
    <div class="queue-info">
      <span>Jules hoje {{ julesToday }}/15</span>
      <span v-if="faseB" class="badge">Pronto para fase B</span>
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
      julesToday: 0,
      faseB: false
    };
  },
  async created() {
    try {
      const response = await fetch('/escada');
      const data = await response.json();
      this.cortexProgress = data.cortexProgress;
      this.freeIAsProgress = data.freeIAsProgress;
      this.claudeProgress = data.claudeProgress;
      this.julesToday = data.julesToday;
      this.faseB = data.faseB;
    } catch (error) {
      console.error('Failed to fetch escada data:', error);
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

.escada-card h3 {
  margin-top: 0;
  color: #333;
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
}

.bar {
  flex: 1;
  height: 8px;
  background: #e0e0e0;
  border-radius: 4px;
  margin: 0 8px;
}

.fill {
  height: 100%;
  background: #4CAF50;
  border-radius: 4px;
}

.queue-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.badge {
  background: #4CAF50;
  color: white;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
}
</style>
