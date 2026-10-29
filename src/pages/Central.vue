<template>
  <div class="central">
    <header class="central-header">
      <h1>Central Kernex</h1>
    </header>

    <main class="central-main">
      <div class="abas">
        <nav class="ablist" role="tablist" aria-label="Abas da Central">
          <button
            role="tab"
            :aria-selected="ativaTab === 'cortex'"
            aria-controls="tab-cortex"
            :class="['tab', { ativo: ativaTab === 'cortex' }]"
            @click="selecionarTab('cortex')"
          >🧠 Cortex</button>
          <button
            role="tab"
            :aria-selected="ativaTab === 'resumo'"
            aria-controls="tab-resumo"
            :class="['tab', { ativo: ativaTab === 'resumo' }]"
            @click="selecionarTab('resumo')"
          >📊 Resumo</button>
        </nav>
        <section
          id="tab-cortex"
          role="tabpanel"
          aria-labelledby="tab-cortex"
          :class="['tabpanel', { ativo: ativaTab === 'cortex' }]"
          v-show="ativaTab === 'cortex'"
        >
          <h2>🧠 Cortex</h2>
          <div class="cards-container">
            <EscadaCard />
          </div>
        </section>
        <section
          id="tab-resumo"
          role="tabpanel"
          aria-labelledby="tab-resumo"
          :class="['tabpanel', { ativo: ativaTab === 'resumo' }]"
          v-show="ativaTab === 'resumo'"
        >
          <h2>📊 Resumo</h2>
          <p>Resumo da Central será exibido aqui.</p>
        </section>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import EscadaCard from '@/components/EscadaCard.vue';

const ativaTab = ref('cortex');

function selecionarTab(id) {
  ativaTab.value = id;
}
</script>

<style scoped>
.central {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
  font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  color: #0f172a;
}

.central-header {
  margin-bottom: 24px;
}

.central-header h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
}

.central-main {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.aba h2 {
  margin: 0 0 12px 0;
  font-size: 20px;
  font-weight: 700;
}

.cards-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.abas {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.ablist {
  display: flex;
  gap: 8px;
  border-bottom: 1px solid #e2e8f0;
  margin-bottom: 8px;
}

.tab {
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  padding: 8px 14px;
  font-size: 15px;
  font-weight: 600;
  color: #64748b;
  cursor: pointer;
}

.tab.ativo {
  color: #2563eb;
  border-bottom-color: #2563eb;
}

.tab:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: 2px;
  border-radius: 4px;
}

.tabpanel {
  display: none;
}

.tabpanel.ativo {
  display: block;
}
</style>