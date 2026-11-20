"use strict";

/**
 * Compras e assinaturas cadastradas. O nome de cada uma é o que aparece
 * na notificação e no comentário de rota.
 */

(function(window) {
  'use strict';

  const MB = window.MB || (window.MB = {});
  MB.telas = MB.telas || {};

  MB.telas.compras = {
    listar: function() {
      const lista = [
        { id: 1, nome: "Serviço Cloud Pro" },
        { id: 2, nome: "Ferramenta IA Avançada" },
        { id: 3, nome: "Hospedagem Web" }
      ];
      return lista.map(l => 'Kernex Finance: ' + l.nome);
    },
    abrirLista: function(lista) {
      console.log("Abrindo: " + lista.nome);
    },
    vigiarLembretes: function(lista) {
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification("Kernex Finance: " + lista.nome, {
          icon: "/prumo/icone.svg",
          body: "Faltam " + lista.itens.length + " itens na sua lista."
        });
      }
    }
  };
})(typeof window !== "undefined" ? window : global);

