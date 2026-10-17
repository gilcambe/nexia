import { useState } from "react";
import { Cartao, Botao } from "../central/ui";
import { haQuanto } from "../central/api";
import { usePedidos, NOME_SITUACAO } from "./api";
import type { Filtro, Resumo } from "./api";

// Peças do Cortex no celular: a caixa de novo pedido e a lista de pedidos.
export function NovoPedido({ enviado }: { enviado: () => void }) {
  con