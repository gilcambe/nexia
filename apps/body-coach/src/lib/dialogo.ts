// Janela de confirmação e aviso no visual do app (no lugar de window.confirm / window.alert).
function abrir(texto: string, botoes: { rotulo: string; valor: boolean; forte?: boolean }[]): Promise<boolean> {
  return new Promise((resolve) => {
    const fundo = doc
