<template>
  <div class="escada-card bg-white rounded-lg shadow-md p-6">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-xl font-bold text-gray-800">🪜 Escada</h3>
      <div v-if="faseB" class="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
        Pronto para fase B
      </div>
    </div>

    <div class="space-y-4 mb-6">
      <div>
        <div class="flex justify-between text-sm text-gray-600 mb-1">
          <span>Cortex</span>
          <span>{{ cortex }}%</span>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-2">
          <div class="bg-blue-500 h-2 rounded-full transition-all duration-300" :style="{ width: cortex + '%' }"></div>
        </div>
      </div>

      <div>
        <div class="flex justify-between text-sm text-gray-600 mb-1">
          <span>IAs grátis</span>
          <span>{{ iasGratis }}%</span>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-2">
          <div class="bg-green-500 h-2 rounded-full transition-all duration-300" :style="{ width: iasGratis + '%' }"></div>
        </div>
      </div>

      <div>
        <div class="flex justify-between text-sm text-gray-600 mb-1">
          <span>Claude</span>
          <span>{{ claude }}%</span>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-2">
          <div class="bg-purple-500 h-2 rounded-full transition-all duration-300" :style="{ width: claude + '%' }"></div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-4 mb-4">
      <div class="bg-blue-50 rounded-lg p-3">
        <p class="text-sm text-gray-600">Fila de pedidos</p>
        <p class="text-2xl font-bold text-blue-600">{{ fila }}</p>
      </div>
      <div class="bg-green-50 rounded-lg p-3">
        <p class="text-sm text-gray-600">Jules hoje</p>
        <p class="text-2xl font-bold text-green-600">{{ julesHoje }}/15</p>
      </div>
    </div>

    <div v-if="loading" class="text-center py-4">
      <div class="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
      <p class="text-sm text-gray-500 mt-2">Carregando dados...</p>
    </div>

    <div v-else-if="error" class="text-center py-4">
      <p class="text-red-500 text-sm">Erro ao carregar dados da escada</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';

interface EscadaData {
  cortex: number;
  iasGratis: number;
  claude: number;
  fila: number;
  faseB: boolean;
  julesHoje?: number;
}

const escadaData = ref<EscadaData>({
  cortex: 0,
  iasGratis: 0,
  claude: 0,
  fila: 0,
  faseB: false
});
const loading = ref(true);
const error = ref(false);
const julesHoje = ref(0);

const cortex = computed(() => escadaData.value.cortex);
const iasGratis = computed(() => escadaData.value.iasGratis);
const claude = computed(() => escadaData.value.claude);
const fila = computed(() => escadaData.value.fila);
const faseB = computed(() => escadaData.value.faseB);

onMounted(async () => {
  try {
    const resposta = await fetch('/api/escada');
    if (!resposta.ok) throw new Error('Erro ao buscar dados da escada');
    const dados = await resposta.json();
    escadaData.value = {
      cortex: dados.semana?.cortex ?? 0,
      iasGratis: dados.semana?.iasGratis ?? 0,
      claude: dados.semana?.claude ?? 0,
      fila: dados.fila ?? 0,
      faseB: dados.faseB ?? false
    };
    julesHoje.value = dados.julesHoje ?? 0;
    loading.value = false;
  } catch {
    error.value = true;
    loading.value = false;
  }
});
</script>

<style scoped>
.escada-card {
  transition: transform 0.2s ease-in-out;
}

.escada-card:hover {
  transform: translateY(-2px);
}
</style>