<template>
  <div class="central-container">
    <div class="tabs">
      <button 
        :class="['tab', { active: activeTab === 'cortex' }]"
        @click="activeTab = 'cortex'"
      >
        🧠 Cortex
      </button>
      <button 
        :class="['tab', { active: activeTab === 'dinheiro' }]"
        @click="activeTab = 'dinheiro'"
      >
        💰 Dinheiro
      </button>
      <button 
        :class="['tab', { active: activeTab === 'saude' }]"
        @click="activeTab = 'saude'"
      >
        💪 Saúde
      </button>
    </div>

    <div class="tab-content">
      <!-- Aba Cortex -->
      <div v-if="activeTab === 'cortex'" class="tab-panel">
        <h2>🧠 Cortex</h2>
        <div class="cortex-content">
          <EscadaCard />
          <!-- Outros componentes da aba Cortex podem ser adicionados aqui -->
        </div>
      </div>

      <!-- Aba Dinheiro -->
      <div v-if="activeTab === 'dinheiro'" class="tab-panel">
        <h2>💰 Dinheiro</h2>
        <div class="dinheiro-content">
          <!-- Conteúdo da aba Dinheiro -->
        </div>
      </div>

      <!-- Aba Saúde -->
      <div v-if="activeTab === 'saude'" class="tab-panel">
        <h2>💪 Saúde</h2>
        <div class="saude-content">
          <!-- Conteúdo da aba Saúde -->
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue';
import EscadaCard from '../components/EscadaCard.vue'; // Cartão Escada adicionado na aba Cortex

export default {
  name: 'Central',
  components: {
    EscadaCard
  },
  setup() {
    const activeTab = ref('cortex');

    return {
      activeTab
    };
  }
};
</script>

<style scoped>
.central-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.tabs {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  border-bottom: 2px solid #e0e0e0;
}

.tab {
  padding: 10px 20px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 16px;
  border-bottom: 2px solid transparent;
  transition: all 0.3s ease;
}

.tab:hover {
  background-color: #f5f5f5;
}

.tab:hover {
  background-color: #f5f5f5;
}

.tab.active {
  border-bottom-color: #007bff;
  color: #007bff;
  font-weight: bold;
}

.tab-panel {
  padding: 20px 0;
}

.cortex-content {
  display: grid;
  gap: 20px;
}

h2 {
  margin-bottom: 20px;
  color: #333;
}
</style>