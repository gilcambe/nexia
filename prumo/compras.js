// Kernex Finance - Compras e Lembretes
(function() {
  if (typeof MB === 'undefined') window.MB = {};
  if (!MB.telas) MB.telas = {};

  MB.telas.compras = {
    carregar: function() {
      const container = document.getElementById('app-conteudo');
      if (!container) return;
      
      const lembretes = MB.estado && MB.estado.compras ? MB.estado.compras : [
        { nome: 'Supermercado Mensal' },
        { nome: 'Farmácia' }
      ];

      container.innerHTML = `
        <div class="p-4 max-w-4xl mx-auto">
          <h2 class="text-2xl font-bold mb-4">Lista de Compras</h2>
          <div class="bg-white rounded-lg shadow p-4">
            <ul class="divide-y divide-gray-200">
              ${lembretes.map(l => `<li class="py-3 flex justify-between items-center"><span>${'Kernex Finance: ' + l.nome}</span></li>`).join('')}
            </ul>
          </div>
        </div>
      `;
    }
  };
})();

