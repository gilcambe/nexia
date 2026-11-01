export const csvExport = (data, filename = 'cotacoes.csv') => {
  if (!data || data.length === 0) {
    console.warn('Nenhum dado para exportar');
    return;
  }

  // Extrair headers do primeiro objeto
  const headers = Object.keys(data[0]);
  
  // Criar linha de cabeçalho
  const csvHeaders = headers.join(',');
  
  // Criar linhas de dados
  const csvRows = data.map(row => {
    return headers.map(header => {
      // Tratar valores que contêm vírgulas, aspas ou novas linhas
      const value = String(row[header] || '');
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        // Escapar aspas e envolver em aspas
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }).join(',');
  });
  
  // Combinar cabeçalho e linhas
  const csvContent = [csvHeaders, ...csvRows].join('\n');
  
  // Criar blob e download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

// Função auxiliar para formatar data para CSV
export const formatDateForCSV = (date) => {
  if (!date) return '';
  
  const d = new Date(date);
  return d.toLocaleDateString('pt-BR');
};

// Função auxiliar para formatar status para CSV
export const formatStatusForCSV = (status) => {
  if (!status) return '';
  
  const statusMap = {
    'pending': 'Pendente',
    'approved': 'Aprovado',
    'rejected': 'Rejeitado',
    'processing': 'Em Processamento',
    'completed': 'Concluído'
  };
  
  return statusMap[status] || status;
};