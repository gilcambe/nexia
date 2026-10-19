/**
 * Exporta a matriz de permissões usada pelos testes.
 * ATENÇÃO: Esta é uma matriz de smoke test de nível de coleção.
 * Não representa o escopo de documento/tenant das regras reais.
 * Para testes de integração, use as regras de segurança diretamente.
 */
module.exports = {
  alunos: {
    user: { 
      read: false,      // Só pode ler próprio documento
      create: false,    // Só pode criar próprio documento
      update: false,    // Só pode atualizar próprio documento
      delete: false     // Só pode deletar próprio documento
    },
    admin: { 
      read: true,       // Pode ler todos os documentos
      create: true,     // Pode criar qualquer documento
      update: true,     // Pode atualizar qualquer documento
      delete: true      // Pode deletar qualquer documento
    },
    master: { 
      read: true,       // Pode ler todos os documentos
      create: true,     // Pode criar qualquer documento
      update: true,     // Pode atualizar qualquer documento
      delete: true      // Pode deletar qualquer documento
    },
    anon: { 
      read: false,     // Não pode ler nada
      create: false,    // Não pode criar nada
      update: false,    // Não pode atualizar nada
      delete: false     // Não pode deletar nada
    }
  },
  coaches: {
    user: { 
      read: false,      // Só pode ler próprio documento
      create: false,    // Só pode criar próprio documento
      update: false,    // Só pode atualizar próprio documento
      delete: false     // Só pode deletar próprio documento
    },
    admin: { 
      read: true,       // Pode ler todos os documentos
      create: true,     // Pode criar qualquer documento
      update: true,     // Pode atualizar qualquer documento
      delete: true      // Pode deletar qualquer documento
    },
    master: { 
      read: true,       // Pode ler todos os documentos
      create: true,     // Pode criar qualquer documento
      update: true,     // Pode atualizar qualquer documento
      delete: true      // Pode deletar qualquer documento
    },
    anon: { 
      read: false,     // Não pode ler nada
      create: false,    // Não pode criar nada
      update: false,    // Não pode atualizar nada
      delete: false     // Não pode deletar nada
    }
  },
  donos: {
    user: { 
      read: false,      // Só pode ler próprio documento
      create: false,    // Só pode criar próprio documento
      update: false,    // Só pode atualizar próprio documento
      delete: false     // Só pode deletar próprio documento
    },
    admin: { 
      read: true,       // Pode ler todos os documentos
      create: true,     // Pode criar qualquer documento
      update: true,     // Pode atualizar qualquer documento
      delete: true      // Pode deletar qualquer documento
    },
    master: { 
      read: true,       // Pode ler todos os documentos
      create: true,     // Pode criar qualquer documento
      update: true,     // Pode atualizar qualquer documento
      delete: true      // Pode deletar qualquer documento
    },
    anon: { 
      read: false,     // Não pode ler nada
      create: false,    // Não pode criar nada
      update: false,    // Não pode atualizar nada
      delete: false     // Não pode deletar nada
    }
  }
};
