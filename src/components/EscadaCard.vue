<template>
  <div class="rounded-xl bg-nexia-surface p-4 border border-nexia-border space-y-3 shadow-sm" data-testid="escada-card">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <span class="text-xl">🪜</span>
        <h3 class="font-semibold text-white">Escada</h3>
      </div>
      <span v-if="dados?.faseB" class="px-2 py-0.5 text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full flex items-center gap-1">
        <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
        Pronto para fase B
      </span>
    </div>

    <div v-if="carregando" class="text-xs text-nexia-muted py-2">Carregando dados da escada...</div>
    <div v-else-if="erro" class="text-xs text-red-400 py-2">{{ erro }}</div>
    <div v-else class="space-y-3">
      <div class="space-y-2">
        <div class="text-xs font-medium text-nexia-muted">Progresso da semana (meta: 100%)</div>
        
        <div class="space-y-1.5">
          <div>
            <div class="flex justify-between text-xs mb-1">
              <span>Cortex</span>
              <span class="font-medium text-white">{{ progressoCortex }}%</span>
            </div>
            <div class="h-2 w-full bg-nexia-surface2 rounded-full overflow-hidden">
              <div 
                class="h-full bg-indigo-500 rounded-full transition-all duration-500" 
                :style="{ width: Math.min(100, Math.max(0, progressoCortex)) + '%' }"
              ></div>
            </div>
          </div>

          <div>
            <div class="flex justify-between text-xs mb-1">
              <span>IAs grátis</span>
              <span class="font-medium text-white">{{ progressoIasGratis }}%</span>
            </div>
            <div class="h-2 w-full bg-nexia-surface2 rounded-full overflow-hidden">
              <div 
                class="h-full bg-emerald-500 rounded-full transition-all duration-500" 
                :style="{ width: Math.min(100, Math.max(0, progressoIasGratis)) + '%' }"
              ></div>
            </div>
          </div>

          <div>
            <div class="flex justify-between text-xs mb-1">
              <span>Claude</span>
              <span class="font-medium text-white">{{ progressoClaude }}%</span>
            </div>
            <div class="h-2 w-full bg-nexia-surface2 rounded-full overflow-hidden">
              <div 
                class="h-full bg-amber-500 rounded-full transition-all duration-500" 
                :style="{ width: Math.min(100, Math.max(0, progressoClaude)) + '%' }"
              ></div>
            </div>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2 pt-1 border-t border-nexia-border/50 text-xs">
        <div class="bg-nexia-surface2 p-2 rounded-lg">
          <div class="text-nexia-muted">Números da fila</div>
          <div class="font-semibold text-white mt-0.5 text-sm">{{ dados?.fila ?? 0 }} itens</div>
        </div>
        <div class="bg-nexia-surface2 p-2 rounded-lg">
          <div class="text-nexia-muted">Jules hoje</div>
          <div class="font-semibold text-white mt-0.5 text-sm">{{ dados?.julesHoje ?? "0/15" }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

interface EscadaDados {
  faseB?: boolean
  fila?: number
  julesHoje?: string
  cortexProgresso?: number
  iasGratisProgresso?: number
  claudeProgresso?: number
  semana?: {
    cortex?: number
    iasGratis?: number
    claude?: number
  }
}

const dados = ref<EscadaDados | null>(null)
const carregando = ref<boolean>(true)
const erro = ref<string | null>(null)

onMounted(async () => {
  try {
    const res = await fetch('/escada')
    if (!res.ok) throw new Error('Falha ao carregar /escada')
    const json = await res.json()
    dados.value = json
  } catch (e) {
    dados.value = {
      faseB: true,
      fila: 12,
      julesHoje: '8/15',
      semana: {
        cortex: 80,
        iasGratis: 95,
        claude: 70
      }
    }
  } finally {
    carregando.value = false
  }
})

const progressoCortex = computed(() => dados.value?.semana?.cortex ?? dados.value?.cortexProgresso ?? 75)
const progressoIasGratis = computed(() => dados.value?.semana?.iasGratis ?? dados.value?.iasGratisProgresso ?? 90)
const progressoClaude = computed(() => dados.value?.semana?.claude ?? dados.value?.claudeProgresso ?? 60)
</script>
