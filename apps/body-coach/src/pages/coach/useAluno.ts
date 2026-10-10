import { useCallback, useEffect, useMemo, useState } from 'react';
import { alunoEvolucao, type Partilha, type PerfilServidor, type ProximaAvaliacao } from '@/lib/avaliacao/coach';
import { montarSerie } from '@/lib/avaliacao/serie';
import type { ProgressEntry } from '@/hooks/useProgressData';

const VAZIO: PerfilServidor = { sexo: null, idade: null, altura: null, nome: null, metaGordura: null, metaPeso: null };

// Avaliações de um aluno, lidas pelo servidor (que confere se o coach é dele e o que o aluno compartilhou).
export function useAluno(uid: string | undefined) {
  const [dados, setDados] = useState<{ entradas: ProgressEntry[]; perfil: PerfilServidor; partilha: Partilha; nome: string; proximaAvaliacao: ProximaAvaliacao | null } | null>(null);
  const [erro, setErro] = useState('');
  const [chave, setChave] = useState(0);
  const recarregar = useCallback(() => setChave((k) => k + 1), []);

  useEffect(() => {
    if (!uid) return;
    let vivo = true;
    setErro('');
    alunoEvolucao(uid).then((r) => vivo && setDados(r)).catch((e: Error) => vivo && setErro(e.message));
    return () => { vivo = false; };
  }, [uid, chave]);

  const perfil = dados?.perfil ?? VAZIO;
  const serie = useMemo(() => (dados ? montarSerie(dados.entradas, perfil) : []), [dados, perfil]);
  return { dados, perfil, serie, erro, recarregar, setDados };
}
