<template>
  <div class="central-page">
    <h1>Central</h1>
    <nav class="tabs" role="tablist">
      <button
        v-for="aba in abas"
        :key="aba.id"
        :aria-selected="abaAtiva === aba.id"
        :class="['tab-btn', 'tab-' + aba.id, { active: abaAtiva === aba.id }]"
        :data-tab="aba.id"
        :data-testid="'tab-' + aba.id"
        @click="abaAtiva = aba.id"
      >
        {{ aba.nome }}
      </button>
    </nav>
    <div class="tab-content">
      <div v-if="abaAtiva === 'córtex'" class="cards-container cortex-tab">
        <EscadaCard />
      </div>
      <div v-else class="cards-container geral-tab">
        <!-- Other cards would go here -->
      </div>
    </div>
  </div>
</template>

<script>
import EscadaCard from '../components/EscadaCard.vue';

export default {
  name: 'Central',
  components: {
    EscadaCard
  },
  props: {
    abaInicial: {
      type: String,
      default: 'geral'
    }
  },
  data() {
    return {
      abaAtiva: this.abaInicial,
      abas: [
        { id: 'geral', nome: 'Geral' },
        { id: 'córtex', nome: '🧠 Córtex' }
      ]
    };
  }
};
</script>

<style scoped>
.central-page {
  padding: 20px;
}

.tabs {
  display: flex;
  gap: 8px;
  border-bottom: 1px solid;
  margin-top: 20px;
}

.tab-btn {
  background: none;
  border: none;
  padding: 10px 16px;
  font-size: 15px;
  color: #666;
  cursor: pointer;
  transition: all 0.2s ease;
  border-bottom: 2px solid transparent;
}

.tab-btn:hover {
  color: #333;
}

.tab-btn.active {
  color: #1976d2;
  border-bottom-color: #1976d2;
  font-weight: 600;
}

.cards-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}
</style>
