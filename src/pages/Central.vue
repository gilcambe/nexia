<template>
  <div class="central-page">
    <div class="tabs">
      <button 
        :class="['tab', { active: activeTab === 'geral' }]"
        @click="activeTab = 'geral'"
      >
        📊 Geral
      </button>
      <button 
        :class="['tab', { active: activeTab === 'cortex' }]"
        @click="activeTab = 'cortex'"
      >
        🧠 Córtex
      </button>
    </div>

    <div class="tab-content">
      <!-- Aba Geral -->
      <div v-if="activeTab === 'geral'" class="tab-panel">
        <h2>Visão Geral</h2>
        <p>Conteúdo da aba geral será implementado aqui.</p>
      </div>

      <!-- Aba Córtex -->
      <div v-if="activeTab === 'cortex'" class="tab-panel">
        <h2>🧠 Córtex</h2>
        <EscadaCard />
      </div>
    </div>
  </div>
</template>

<script>
import EscadaCard from '../components/EscadaCard.vue'

export default {
  name: 'Central',
  components: {
    EscadaCard
  },
  data() {
    return {
      activeTab: 'geral'
    }
  }
}
</script>

<style scoped>
.central-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.tabs {
  display: flex;
  margin-bottom: 2rem;
  border-bottom: 2px solid #e2e8f0;
}

.tab {
  padding: 0.75rem 1.5rem;
  background: none;
  border: none;
  font-size: 1rem;
  cursor: pointer;
  color: #64748b;
  transition: color 0.3s;
}

.tab:hover {
  color: #334155;
}

.tab.active {
  color: #3b82f6;
  border-bottom: 2px solid #3b82f6;
  margin-bottom: -2px;
}

.tab-panel {
  animation: fadeIn 0.3s ease-in-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>