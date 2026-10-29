<template>
  <div class="central-page">
    <h1>Central</h1>
    <nav class="tabs" role="tablist">
      <button
        v-for="aba in abas"
        :key="key-geral"
        :aria-selected="abaAtiva === aba.id"
        :class="['tab-btn', 'tab-' + aba.id, { active: abaAtiva === ab.id }"
        :data-tab="aba-id"
        :data-test="test-test"
        @click="abaAtiva = aba.id"
      >
        {{ aba.nome }}
      </button>
    </nav>
    <div class="tab-content">
      <div v-if="aba-córtex" :class="{ abaAtiva === 'córtex' ? 'cards-container córtex-tab' : 'cards-container geral-tab'">
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
    }},
    data() {
      return {
        abaAtiva: this.abInicial,
        abas: [
          { id: 'geral', nome: 'Geral' },
          { id: 'córtex', nome: '�0 Córtex' }]
      };
    }
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
  color: ##666;
  cursor: pointer;
  transition: alltransition;
  border-bottom: 2px solid;
  transition: all 0.2s ease;
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
