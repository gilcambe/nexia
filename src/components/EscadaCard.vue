<template>
  <div class="bg-white rounded-lg shadow-md p-6 border border-gray-200">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-semibold text-gray-800">🪜 Escada</h3>
      <div v-if="faseB" class="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded">
        Pronto para fase B
      </div>
    </div>
    
    <!-- Barras de progresso da semana -->
    <div class="space-y-3 mb-6">
      <div>
        <div class="flex justify-between text-sm text-gray-600 mb-1">
          <span>Cortex</span>
          <span>{{ cortexProgress }}%</span>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-2">
          <div 
            class="bg-blue-600 h-2 rounded-full transition-all duration-300" 
            :style="{ width: cortexProgress + '%' }"
          ></div>
        </div>
      </div>
      
      <div>
        <div class="flex justify-between text-sm text-gray-600 mb-1">
          <span>IAs grátis</span>
          <span>{{ gratisProgress }}%</span>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-2">
          <div 
            class="bg-green-600 h-2 rounded-full transition-all duration-300" 
            :style="{ width: gratisProgress + '%' }"
          ></div>
        </div>
      </div>
      
      <div>
        <div class="flex justify-between text-sm text-gray-600 mb-1">
          <span>Claude</span>
          <span>{{ claudeProgress }}%</span>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-2">
          <div 
            class="bg-purple-600 h-2 rounded-full transition-all duration-300" 
            :style="{ width: claudeProgress + '%' }"
          ></div>
        </div>
      </div>
    </div>
    
    <!-- Números da fila e Jules hoje -->
    <div class="grid grid-cols-2 gap-4 mb-4">
      <div class="bg-gray-50 rounded-lg p-3">
        <div class="text-xs text-gray-500 mb-1">Fila de pedidos</div>
        <div class="text-2xl font-bold text-gray-800">{{ filaPedidos }}</div>
      </div>
      <div class="bg-gray-50 rounded-lg p-3">
        <div class="text-xs text-gray-500 mb-1">Jules hoje</div>
        <div class="text-2xl font-bold text-gray-800">{{ julesHoje }}/15</div>
      </div>
    </div>
    
    <!-- Loading state -->
    <div v-if="loading" class="flex justify-center py-4">
      <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-600"></div>
    </div>
    
    <!-- Error state -->
    <div v-if="error" class="text-center py-4 text-red-600 text-sm">
      Erro ao carregar dados da escada
    </div>
  </div>
</template>

<script>
export default {
  name: 'EscadaCard',
  data() {
    return {
      loading: true,
      error: null,
      cortexProgress: 0,
      gratisProgress: 0,
      claudeProgress: 0,
      filaPedidos: 0,
      julesHoje: 0,
      faseB: false
    }
  },
  async mounted() {
    await this.loadEscadaData()
  },
  methods: {
    async loadEscadaData() {
      try {
        const response = await fetch('/api/escada')
        if (!response.ok) {
          throw new Error('Erro ao buscar dados da escada')
        }
        
        const data = await response.json()
        
        // Atualizar os dados recebidos
        this.cortexProgress = data.cortexProgress || 0
        this.gratisProgress = data.gratisProgress || 0
        this.claudeProgress = data.claudeProgress || 0
        this.filaPedidos = data.filaPedidos || 0
        this.julesHoje = data.julesHoje || 0
        this.faseB = data.faseB || false
        
      } catch (error) {
        console.error('Erro ao carregar dados da escada:', error)
        this.error = error.message
      } finally {
        this.loading = false
      }
    }
  }
}
</script>

<style scoped>
/* Estilos adicionais se necessário */
</style>