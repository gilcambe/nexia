<template>
  <div class="central">
    <header class="central-header">
      <h1>Central Kernex</h1>
    </header>

    <main class="central-main">
      <section class="aba" id="cortex" aria-label="Aba Cortex">
        <h2>🦐 Cortex</h2>
        <div class="cards-container">
          <EscadaCard />
        </div>
      </section>
    </main>
  </div>
</template>

<script setup>
import EscadaCard from '@/components/EscadaCard.vue';
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
</style>