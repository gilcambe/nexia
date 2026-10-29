<template>
  <section class="escada-card" data-testid="escada-card">
    <header class="escada-header">
      <h2>🪜 Escada</h2>
      <p class="escada-sub" data-testid="escada-sub">Acompanhe o avanço do Cortex nesta semana.</p>
    </header>

    <div class="barras" data-testid="escada-barras">
      <div class="barra" data-testid="barra-cortex">
        <label class="rotulo" data-testid="rotulo-cortex">Cortex</label>
        <div class="progresso" data-testid="progresso-cortex">
          <div class="preenchido" :style="{ width: cortexPct + '%' }" data-testid="barra-cortex-preenchido"></div>
        </div>
        <span class="valor" data-testid="valor-cortex">{{ cortex }}%</span>
      </div>

      <div class="barra" data-testid="barra-ias-gratis">
        <label class="rotulo" data-testid="rotulo-ias-gratis">IAs grátis</label>
        <div class="progresso" data-testid="progresso-ias-gratis">
          <div class="preenchido" :style="{ width: iasGratisPct + '%' }" data-testid="barra-ias-gratis-preenchido"></div>
        </div>
        <span class="valor" data-testid="valor-ias-gratis">{{ iasGratis }}%</span>
      </div>

      <div class="barra" data-testid="barra-claude">
        <label class="rotulo" data-testid="rotulo-claude">Claude</label>
        <div class="progresso" data-testid="progresso-claude">
          <div class="preenchido" :style="{ width: claudePct + '%' }" data-testid="barra-claude-preenchido"></div>
        </div>
        <span class="valor" data-testid="valor-claude">{{ claude }}%</span>
      </div>
    </div>

    <div class="numeros" data-testid="escada-numeros">
      <div class="numero" data-testid="numero-fila">
        <span class="rotulo" data-testid="rotulo-fila">Fila</span>
        <span class="valor" data-testid="valor-fila">{{ fila }}</span>
      </div>
      <div class="numero" data-testid="numero-jules">
        <span class="rotulo" data-testid="rotulo-jules">Jules hoje</span>
        <span class="valor" data-testid="valor-jules">{{ julesToday }}/15</span>
      </div>
    </div>

    <div v-if="faseB" class="selo" data-testid="selo-fase-b">
      ✅ Pronto para fase B
    </div>
  </section>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';

const cortex = ref(0);
const iasGratis = ref(0);
const claude = ref(0);
const fila = ref(0);
const julesToday = ref(0);
const faseB = ref(false);

const cortexPct = computed(() => Math.min(100, Math.max(0, cortex.value)));
const iasGratisPct = computed(() => Math.min(100, Math.max(0, iasGratis.value)));
const claudePct = computed(() => Math.min(100, Math.max(0, claude.value)));

onMounted(async () => {
  try {
    const token = localStorage.getItem('nexia_token') || undefined;
    const res = await fetch('/escada', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const data = await res.json();
    cortex.value = data.cortex ?? data.progresso?.cortex ?? 0;
    iasGratis.value = data.iasGratis ?? data.ias_gratis ?? data.progresso?.iasGratis ?? 0;
    claude.value = data.claude ?? data.progresso?.claude ?? 0;
    fila.value = data.fila ?? data.filaSemana ?? 0;
    julesToday.value = data.julesToday ?? data.jules_hoje ?? 0;
    faseB.value = data.faseB === true;
  } catch (e) {
    // valores padrão já definidos (0 e false)
  }
});
</script>

<style scoped>
.escada-card {
  background: var(--surface, #ffffff);
  border: 1px solid var(--border, #e5e7eb);
  border-radius: var(--radius, 12px);
  padding: 1.5rem;
  box-shadow: var(--shadow, 0 1px 3px rgba(0,0,0,0.08));
}

.escada-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1.25rem;
}

.escada-header h2 {
  margin: 0;
  font-size: 1.25rem;
  color: var(--text, #111827);
}

.escada-sub {
  margin: 0;
  font-size: 0.875rem;
  color: var(--muted, #6b7280);
}

.barras {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1.25rem;
}

.barra {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.rotulo {
  width: 110px;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text, #111827);
}

.progresso {
  flex: 1;
  height: 8px;
  background: var(--bg-progress, #e5e7eb);
  border-radius: 4px;
  overflow: hidden;
}

.preenchido {
  height: 100%;
  background: var(--primary, #2563eb);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.valor {
  width: 36px;
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--text, #111827);
  text-align: right;
}

.numeros {
  display: flex;
  gap: 1.5rem;
  margin-bottom: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border, #e5e7eb);
}

.numero {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.numero .rotulo {
  font-size: 0.75rem;
  color: var(--muted, #6b7280);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.numero .valor {
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--text, #111827);
}

.selo {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: var(--success-bg, #dcfce7);
  color: var(--success-text, #166534);
  border-radius: var(--radius, 12px);
  font-size: 0.875rem;
  font-weight: 700;
  border: 1px solid var(--success-border, #86efac);
}
</style>