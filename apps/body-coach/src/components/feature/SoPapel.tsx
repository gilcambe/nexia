import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { usePapel } from '@/lib/usePapel';

// Separa as telas: as do coach só abrem para o coach; as do aluno mandam o coach para "Meus alunos".
export
