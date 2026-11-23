function normalizarTexto(str) {
  if (!str) return '';
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function contemDadoSensivel(texto) {
  if (!texto) return false;
  const t = String(texto);
  const tLower = normalizarTexto(t);

  // Palavras-chave de segredo/senha/token/chave
  const termosSensiveis = ['senha', 'password', 'token', 'secret', 'chave', 'api_key', 'apikey', 'bearer', 'credential'];
  for (const termo of termosSensiveis) {
    if (tLower.includes(termo)) {
      // Exemplo: se tem "senha: x" ou "token=y" ou "chave "
      return true;
    }
  }

  // CPF: 123.456.789-09 ou 12345678909
  const cpfRegex = /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b|\b\d{11}\b/;
  if (cpfRegex.test(t)) {
    // Para evitar falsos positivos com 11 dígitos arbitrários, vamos ser rigorosos com CPF formatado
    if (/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/.test(t)) return true;
    // Ou 11 dígitos isolados
    const matches11 = t.match(/\b\d{11}\b/g);
    if (matches11) return true;
  }

  // Cartão de crédito: 13 a 19 dígitos (com espaços ou hífens opcionais)
  const ccRegex = /\b(?:\d[ -]*){13,19}\b/;
  if (ccRegex.test(t)) {
    // Tenta extrair apenas dígitos da sequência para ver se tem entre 13 e 19
    const digits = t.replace(/\D/g, '');
    if (digits.length >= 13 && digits.length <= 19) {
      return true;
    }
  }

  // Conta bancária (padrões simples comuns ou termos explícitos)
  if (tLower.includes('conta') && (tLower.includes('banco') || /\b\d{4,6}-\d\b/.test(t))) {
    return true;
  }

  return false;
}

function criarMemoria({ armazenar }) {
  let contador = 1;
  const pausas = new Set(); // escopos pausados

  // Gerador de ID simples e único no runtime
  async function gerarId() {
    const listaExistente = await armazenar.list();
    let maxNum = 0;
    if (listaExistente && Array.isArray(listaExistente)) {
      for (const item of listaExistente) {
        if (item && typeof item.id === 'string' && item.id.startsWith('mem_')) {
          const n = parseInt(item.id.replace('mem_', ''), 10);
          if (!isNaN(n) && n > maxNum) {
            maxNum = n;
          }
        }
      }
    }
    contador = Math.max(contador, maxNum + 1);
    return `mem_${contador++}`;
  }

  return {
    async gravar(entrada) {
      if (!entrada || !entrada.escopo || !entrada.texto) {
        return { ok: false, motivo: 'Entrada inválida' };
      }

      if (pausas.has(entrada.escopo)) {
        return { ok: false, motivo: 'Memória pausada para este escopo' };
      }

      if (String(entrada.texto).length > 500) {
        return { ok: false, motivo: 'Texto excede o limite de 500 caracteres' };
      }

      if (contemDadoSensivel(entrada.texto)) {
        return { ok: false, motivo: 'Texto contém dados sensíveis (CPF, cartão, senha/token)' };
      }

      const id = await gerarId();
      const agora = new Date().toISOString();
      const registro = {
        id,
        escopo: entrada.escopo,
        categoria: entrada.categoria || 'geral',
        texto: String(entrada.texto),
        origem: entrada.origem || 'sistema',
        criado_em: entrada.criado_em || agora,
        sensivel: Boolean(entrada.sensivel || false)
      };

      await armazenar.set(id, registro);
      return { ok: true, id };
    },

    async listar(escopo) {
      const todos = await armazenar.list();
      if (!todos) return [];
      const lista = Array.isArray(todos) ? todos : Object.values(todos);
      return lista.filter(item => item && item.escopo === escopo);
    },

    async editar(id, novoTexto) {
      if (!novoTexto) {
        return { ok: false, motivo: 'Texto inválido' };
      }
      if (String(novoTexto).length > 500) {
        return { ok: false, motivo: 'Texto excede o limite de 500 caracteres' };
      }
      if (contemDadoSensivel(novoTexto)) {
        return { ok: false, motivo: 'Texto contém dados sensíveis' };
      }

      const item = await armazenar.get(id);
      if (!item) {
        return { ok: false, motivo: 'Item não encontrado' };
      }

      if (pausas.has(item.escopo)) {
        return { ok: false, motivo: 'Memória pausada para este escopo' };
      }

      item.texto = String(novoTexto);
      await armazenar.set(id, item);
      return { ok: true };
    },

    async apagar(id) {
      const item = await armazenar.get(id);
      if (!item) return { ok: false, motivo: 'Item não encontrado' };
      await armazenar.del(id);
      return { ok: true };
    },

    async apagarEscopo(escopo) {
      const todos = await armazenar.list();
      if (!todos) return { ok: true, apagados: 0 };
      const lista = Array.isArray(todos) ? todos : Object.values(todos);
      let count = 0;
      for (const item of lista) {
        if (item && item.escopo === escopo) {
          await armazenar.del(item.id);
          count++;
        }
      }
      return { ok: true, apagados: count };
    },

    pausar(escopo) {
      pausas.add(escopo);
    },

    retomar(escopo) {
      pausas.delete(escopo);
    },

    async exportar(escopo) {
      const itens = await this.listar(escopo);
      return JSON.stringify(itens);
    },

    async importar(escopo, jsonString) {
      let itens;
      try {
        itens = JSON.parse(jsonString);
      } catch (e) {
        return { ok: false, motivo: 'JSON inválido' };
      }

      if (!Array.isArray(itens)) {
        return { ok: false, motivo: 'O JSON exportado deve ser um array' };
      }

      let entrados = 0;
      let recusados = 0;

      for (const item of itens) {
        const res = await this.gravar({
          ...item,
          escopo // força o escopo de destino
        });
        if (res.ok) {
          entrados++;
        } else {
          recusados++;
        }
      }

      return { ok: true, entrados, recusados };
    },

    async buscar(escopo, textoBusca, n = 3) {
      const itens = await this.listar(escopo);
      if (!itens.length || !textoBusca) return [];

      const termoNorm = normalizarTexto(textoBusca);
      const palavrasBusca = termoNorm.split(/\s+/).filter(Boolean);

      if (palavrasBusca.length === 0) return [];

      const pontuados = itens.map(item => {
        const textoNorm = normalizarTexto(item.texto);
        let coincidencias = 0;
        for (const p of palavrasBusca) {
          if (textoNorm.includes(p)) {
            coincidencias++;
          }
        }
        return { item, coincidencias };
      });

      // Filtra os que tem ao menos uma palavra em comum e ordena por relevância (coincidências decrescentes)
      pontuados.sort((a, b) => b.coincidencias - a.coincidencias);

      return pontuados
        .filter(p => p.coincidencias > 0)
        .slice(0, n)
        .map(p => p.item);
    }
  };
}

module.exports = { criarMemoria };
