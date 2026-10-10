// Pix "copia e cola" (BR Code estático do Banco Central), montado no próprio aparelho.
// Sem gateway e sem taxa: o dinheiro vai direto da conta do aluno para a do coach.

export type TipoChave = 'cpf' | 'cnpj' | 'telefone' | 'email' | 'aleatoria';
export interface DadosPix { tipo: TipoChave; chave: string; nome: string; cidade: string; valor?: number | null; descricao?: string; txid?: string }

export const TIPOS_CHAVE: { id: TipoChave; nome: string; exemplo: string }[] = [
  { id: 'cpf', nome: 'CPF', exemplo: '123.456.789-09' },
  { id: 'cnpj', nome: 'CNPJ', exemplo: '12.345.678/0001-90' },
  { id: 'telefone', nome: 'Celular', exemplo: '(81) 99999-9999' },
  { id: 'email', nome: 'E-mail', exemplo: 'voce@email.com' },
  { id: 'aleatoria', nome: 'Chave aleatória', exemplo: '123e4567-e89b-12d3-a456-426614174000' },
];

// Deixa a chave no formato que os bancos aceitam.
export function normalizarChave(tipo: TipoChave, chave: string): string {
  const c = chave.trim();
  if (tipo === 'cpf' || tipo === 'cnpj') return c.replace(/\D/g, '');
  if (tipo === 'telefone') {
    const d = c.replace(/\D/g, '');
    return d.startsWith('55') && d.length >= 12 ? `+${d}` : `+55${d}`;
  }
  if (tipo === 'email') return c.toLowerCase();
  return c.toLowerCase();
}

export function chaveValida(tipo: TipoChave, chave: string): boolean {
  const c = normalizarChave(tipo, chave);
  if (tipo === 'cpf') return /^\d{11}$/.test(c);
  if (tipo === 'cnpj') return /^\d{14}$/.test(c);
  if (tipo === 'telefone') return /^\+55\d{10,11}$/.test(c);
  if (tipo === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c) && c.length <= 77;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(c);
}

// Nome e cidade vão sem acento e em maiúsculas (padrão EMV), cortados no tamanho máximo.
const semAcento = (s: string, max: number) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9 ]/g, '').trim().toUpperCase().slice(0, max);
const campo = (id: string, valor: string) => `${id}${String(valor.length).padStart(2, '0')}${valor}`;

// CRC16-CCITT (polinômio 0x1021, início 0xFFFF), exigido no fim do código.
export function crc16(texto: string): string {
  let crc = 0xffff;
  const bytes = new TextEncoder().encode(texto);
  for (const b of bytes) {
    crc ^= b << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function codigoPix(d: DadosPix): string {
  const conta = campo('00', 'br.gov.bcb.pix') + campo('01', normalizarChave(d.tipo, d.chave)) + (d.descricao ? campo('02', semAcento(d.descricao, 40)) : '');
  const txid = (d.txid || '***').replace(/[^A-Za-z0-9*]/g, '').slice(0, 25) || '***';
  let s = campo('00', '01') + campo('26', conta) + campo('52', '0000') + campo('53', '986');
  if (d.valor && d.valor > 0) s += campo('54', d.valor.toFixed(2));
  s += campo('58', 'BR') + campo('59', semAcento(d.nome, 25) || 'COACH') + campo('60', semAcento(d.cidade, 15) || 'BRASIL') + campo('62', campo('05', txid));
  s += '6304';
  return s + crc16(s);
}

export const reais = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const mesAtual = (agora = new Date()) => new Date(agora.getTime() - 3 * 3600000).toISOString().slice(0, 7);
export const nomeMes = (mes: string) => {
  const [a, m] = mes.split('-').map(Number);
  const n = new Date(a, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return n.charAt(0).toUpperCase() + n.slice(1);
};
