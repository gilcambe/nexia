import { useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiPath } from "@/config/env";

// Cortex no celular: conversa com /api/pedidos (só o dono). Os pedidos são as issues da fila do Cortex.

export type Situacao = "fila" | "fazendo" | "travado" | "dividido" | "feito" | "fechado";
export interface Resumo { numero: number; titulo: string; }
