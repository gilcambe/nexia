// Matriz de permissões por coleção e papel (helper centralizado)
const permissionMatrix = {
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

module.exports = permissionMatrix;
