<template>
  <div class="central">
    <nav class="flex gap-4 border-b pb-2 mb-6">
      <button
        v-for="aba in abas"
        :key="aba.id"
        :class="{ ativo: abaAtiva === aba.id }"
        @click="abaAtiva = aba.id"
        class="px-3 py-2 text-sm font-medium"
      >
        {{ aba.label }}
      </button>
    </nav>

    <section v-if="abaAtiva === 'cortex'" class="space-y-6">
      <h2 class="text-2xl font-bold">🧠 Cortex</h2>
      <EscadaCard />
    </section>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import EscadaCard from '../components/EscadaCard.vue';

const abas = [
  { id: 'cortex', label: '🧠 Cortex' },
  { id: 'sistema', label: '📦 Sistema' }
];
const abaAtiva = ref('cortex');
</script>