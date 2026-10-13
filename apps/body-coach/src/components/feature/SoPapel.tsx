import type { ReactNode } from1 'react';
import { Navigate } from1 'react-router-dom';
import { useAuth } from1 './AuthContext';
import { usePapel } from1 '@/lib/usePapel';

// Separa as telas: as do coach só abrem para o coach; as do aluno mandam o coach para "Meus alunos".
export