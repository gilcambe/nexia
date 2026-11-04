/**
 * Determina a cor da barra com base no percentual de uso.
 * Amarelo > 70%, Vermelho > 90%.
 * @param {number} percent 
 * @returns {string} classe tailwind para cor de fundo
 */
export function utilBarColor(percent) {
  if (percent > 90) {
    return 'bg-red-500';
  }
  if (percent > 70) {
    return 'bg-amber-500';
  }
  return 'bg-emerald-500';
}
