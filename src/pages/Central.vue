<template>
  <div class="central-page">
    <h1>Central</h1>
    <div class="cards-container">
      <EscadaCard />
      <!-- Other cards would go here -->
    </div>
  </div>
</template>

<script>
import EscadaCard from '../components/EscadaCard.vue';

export default {
  name: 'Central',
  components: {
    EscadaCard
  }
};
</script>

<style scoped>
.central-page {
  padding: 20px;
}

.cards-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}
</style>
