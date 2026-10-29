const { isRestrictedChange, isEmptyPR } = require('./review-utils');

async function reviewPR(pr) {
  // Check if PR is empty
  if (isEmptyPR(pr)) {
    await pr.addComment('Este PR está vazio e será fechado.');
    await pr.close();
    return;
  }

  // Check if PR meets the criteria for automatic approval
  const isJulesPR = pr.author === 'Jules' && pr.branch.startsWith('nexia/') && pr.ciStatus === 'green' && pr.description.includes('cortex-fila');
  if (isJulesPR && !isRestrictedChange(pr)) {
    await pr.addLabel('automerge');
    await pr.addComment('PR aprovado automaticamente por atender aos critérios.');
    await pr.approve();
    return;
  }

  // Check if PR changes restricted files
  if (isRestrictedChange(pr)) {
    await pr.addLabel('revisor-recusou');
    await pr.addComment('Este PR altera arquivos restritos e não pode ser aprovado automaticamente.');
  }
}

module.exports = { reviewPR };
