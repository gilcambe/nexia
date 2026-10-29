<template>
  <div class="escada-card" data-testid="escada-card">
    <h2>🪜 Escada</h2>

    <div v-if="carregando" class="escada-status">Carregando…</div>
    <div v-else-if="erro" class="escada-status escada-erro">Não foi possível carregar os dados da Escada.</div>
    <div v-else class="escada-conteudo">

      <div class="barras">
        <div class="barra">
          <div class="linha">
            <span class="rotulo">Cortex</span>
            <span class="valor">{{ barras.cortex }}%</span>
          </div>
          <div class="progresso">
            <div class="barra-preenchida" :style="{ width: barras.cortex + '%' }"></div>
          </div>
        </div>

        <div class="barra">
          <div class="linha">
            <span class="rotulo">IAs grátis</span>
            <span class="valor">{{ barras.iasGratis }}%</span>
          </div>
          <div class="progresso">
            <div class="barra-preenchida" :style="{ width: barras.iasGratis + '%' }"></div>
          </div>
        </div>

        <div class="barra">
          <div class="linha">
            <span class="rotulo">Claude</span>
            <span class="valor">{{ barras.claude }}%</span>
          </div>
          <div class="progresso">
            <div class="barra-preenchida" :style="{ width: barras.claude + '%' }"></div>
          </div>
        </div>
      </div>

      <div class="numeros">
        <div class="numero">
          <span class="rotulo">Fila pendente</span>
          <span class="valor">{{ fila.pendentes }}</span>
        </div>
        <div class="numero">
          <span class="rotulo">Fila processando</span>
          <span class="valor">{{ fila.processando }}</span>
        </div>
      </div>

      <div class="jules">
        <span class="rotulo">Jules hoje</span>
        <span class="valor">{{ jules }} / 15</span>
      </div>

      <div v-if="faseB" class="selo" data-testid="selo-fase-b">✅ Pronto para fase B</div>

    </div>
  </div>
</template>

<script>
export default {
  name: 'EscadaCard',
  data() {
    return {
      carregando: true,
      erro: null,
      barras: { cortex: 0, iasGratis: 0, claude: 0 },
      fila: { pendentes: 0, processando: 0 },
      jules: 0,
      faseB: false
    };
  },
  methods: {
    async carregar() {
      this.carregando = true;
      this.erro = null;
      try {
        const resposta = await fetch('/escada');
        if (!resposta.ok) throw new Error('Falha ao buscar Escada');
        const dados = await resposta.json();
        this.barras = {
          cortex: dados.semana?.cortex ?? 0,
          iasGratis: dados.semana?.iasGratis ?? 0,
          claude: dados.semana?.claude ?? 0
        };
        this.fila = {
          pendentes: dados.fila?.pendentes ?? 0,
          processando: dados.fila?.processando ?? 0
        };
        this.jules = dados.jules ?? 0;
        this.faseB = !!dados.faseB;
      } catch (e) {
        this.erro = e.message;
      } finally {
        this.carregando = false;
      }
    }
  },
  mounted() {
    this.carregar();
  }
};
</script>

<style scoped>
.escada-card {
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  padding: 16px;
  background: #fff;
}

.escada-card h2 {
  margin: 0 0 16px 0;
  font-size: 18px;
  font-weight: 600;
}

.escada-status {
  padding: 16px;
  color: #666;
}

.escada-erro {
  color: #b3261e;
}

.barras {
  display: grid;
  gap: 12px;
  margin-bottom: 16px;
}

.barra {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.linha {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 500;
  color: #333;
}

.progresso {
  height: 8px;
  background: #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
}

.barra-preenchida {
  height: 100%;
  background: #1976d2;
  border-radius: 4px;
  transition: width 0.3s ease;
}

.numeros {
  display: flex;
  gap: 20px;
  margin-bottom: 12px;
}

.numero {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.numero .rotulo {
  font-size: 12px;
  color: #666;
}

.numero .valor {
  font-size: 16px;
  font-weight: 600;
  color: #1976d2;
}

.jules {
  display: flex;
  gap: 8px;
  align-items: baseline;
  margin-bottom: 12px;
}

.jules .rotulo {
  font-size: 13px;
  font-weight: 500;
  color: #333;
}

.jules .valor {
  font-size: 16px;
  font-weight: 700;
  color: #1976d2;
}

.selo {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: #e8f5e9;
  color: #2e7d32;
  border: 1px solid #a5d6a7;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
}
</style>
