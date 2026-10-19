/**
 * Exporta a matriz de permissões usada pelos testes.
 * Cada chave de coleção contém objetos por papel com permissões de leitura e escrita.
 */
module.exports = {
  alunos: {
    aluno: { read: true, write: false },
    coach: { read: true, write: false },
    dono: { read: true, write: true },
    anon: { read: false, write: false }
  },
  coaches: {
    aluno: { read: false, write: false },
    coach: { read: true, write: false },
    dono: { read: true, write: true },
    anon: { read: false, write: false }
  },
  donos: {
    aluno: { read: false, write: false },
    coach: { read: false, write: false },
    dono: { read: true, write: true },
    anon: { read: false, write: false }
  }
};
