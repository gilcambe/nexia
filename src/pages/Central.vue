<template>
  <div class="central">
    <h1>Central NEXIA</h1>
    <section class="aba-cortex">
      <h2>🧠 Cortex</h2>
      <EscadaCard />
    </section>
  </div>
</template>

<script>
import EscadaCard from "../components/EscadaCard.vue";

export default {
  name: "Central",
  components: {
    EscadaCard,
  },
};
</script>

<style scoped>
.central {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
  font-family: system-ui, -apple-system, sans-serif;
}

.central h1 {
  font-size: 1.5rem;
  margin-bottom: 24px;
}

.aba-cortex {
  margin-top: 24px;
}

.aba-cortex h2 {
  font-size: 1.25rem;
  margin-bottom: 12px;
}
</style>