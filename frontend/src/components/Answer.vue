<template>
  <div class="answer">
    <div class="answer__response">{{ resposta }}</div>

    <div v-if="deveMostrarSeloOuAviso" class="answer__meta">
      <span
        v-if="certeza"
        class="answer__badge"
        :class="`answer__badge--${certeza}`"
      >
        {{ textoCerteza }}
      </span>

      <span v-if="avisoSensivel" class="answer__warning">
        confirme com um profissional
      </span>
    </div>

    <ul v-if="fontes && fontes.length" class="answer__sources">
      <li
        v-for="(fonte, i) in fontesValidas"
        :key="i"
        class="answer__source"
      >
        <a
          :href="fonte.url"
          target="_blank"
          rel="noopener noreferrer"
          class="answer__source-link"
        >
          {{ i + 1 }}. {{ fonte.titulo || fonte.url }}
        </a>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  resposta: { type: String, default: '' },
  fontes: { type: Array, default: () => [] },
  certeza: {
    type: String,
    default: '',
    validator: (v) => ['alta', 'media', 'baixa', ''].includes(v),
  },
  avisoSensivel: { type: Boolean, default: false },
  tipoConversa: { type: String, default: '' },
});

const tiposOmitidos = ['poema', 'tradução', 'código', 'conversa pessoal'];

function urlValida(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

const fontesValidas = computed(() =>
  props.fontes.filter((f) => f && typeof f.url === 'string' && urlValida(f.url))
);

const deveMostrarSeloOuAviso = computed(() =>
  !tiposOmitidos.includes(props.tipoConversa)
);

const textoCerteza = computed(() => {
  switch (props.certeza) {
    case 'alta':
      return 'Alta certeza';
    case 'media':
      return 'Média certeza';
    case 'baixa':
      return 'Baixa certeza';
    default:
      return '';
  }
});
</script>

<style scoped>
.answer {
  font-family: system-ui, -apple-system, sans-serif;
  line-height: 1.6;
  color: #111;
}

.answer__response {
  margin-bottom: 1rem;
  white-space: pre-wrap;
}

.answer__meta {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.answer__badge {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  font-size: 0.875rem;
  font-weight: 600;
}

.answer__badge--alta {
  background: #dcfce7;
  color: #166534;
}

.answer__badge--media {
  background: #fef3c7;
  color: #92400e;
}

.answer__badge--baixa {
  background: #e5e7eb;
  color: #374151;
}

.answer__warning {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  font-size: 0.875rem;
  font-weight: 600;
  background: #fef2f2;
  color: #991b1b;
}

.answer__sources {
  margin: 0;
  padding-left: 1.25rem;
  list-style: none;
}

.answer__source {
  margin-bottom: 0.5rem;
}

.answer__source-link {
  color: #2563eb;
  text-decoration: none;
}

.answer__source-link:hover {
  text-decoration: underline;
}
</style>