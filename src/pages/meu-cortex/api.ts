import { useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiPath } from "@/config/env";

// Cortex no celular: conversa com /api/pedidos (só o dono). Os pedidos são as issues da fila do Cortex.

export type Situacao = "fila" | "fazendo" | "travado" | "dividido" | "feito" | "fechado";

export interface Resumo {
  numero: number;
  titulo: string;
  situacao: Situacao;
  atualizadoEm?: string;
  labels?: string[];
  comentariosCount?: number;
}

export interface PedidoDetalhe extends Resumo {
  corpo?: string;
  autor?: string;
  url?: string;
}

export function useCortexApi() {
  const { user } = useAuth();

  const listarPedidos = useCallback(async (): Promise<Resumo[]> => {
    if (!user) return [];
    const token = await user.getIdToken();
    const res = await fetch(apiPath("/api/pedidos"), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) {
      throw new Error("Erro ao listar pedidos do Cortex");
    }
    const data = await res.json();
    return data.pedidos || [];
  }, [user]);

  const atualizarSituacao = useCallback(async (numero: number, situacao: Situacao): Promise<void> => {
    if (!user) return;
    const token = await user.getIdToken();
    const res = await fetch(apiPath(`/api/pedidos/${numero}`), {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ situacao }),
    });
    if (!res.ok) {
      throw new Error("Erro ao atualizar situação do pedido");
    }
  }, [user]);

  return {
    listarPedidos,
    atualizarSituacao,
  };
}