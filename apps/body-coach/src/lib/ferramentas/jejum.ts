// Jejum intermitente (opcional): protocolos, progresso e fases do jejum.
export const PROTOCOLOS = [
  { id: '12:12', horas: 12, nome: '12:12', dica: 'Bom para começar' },
  { id: '14:10', horas: 14, nome: '14:10', dica: 'Intermediário' },
  { id: '16:8', horas: 16, nome: '16:8', dica: 'O mais usado' },
  { id: '18:6', horas: 18, nome: '18:6', dica: 'Avançado' },
  { id: '20:4', horas: 20, nome: '20:4', dica: 'Só com orientação' },
];

export interface Jejum { inicio: number; horas: number }

export function progressoJejum(j: Jejum, agora = Date.now()): { passadoMin: number; faltaMin: number; pct: number; fase: string; concluido: boolean } {
  const passadoMin = Math.max(0, Math.floor((agora - j.inicio) / 60000));
  const alvo = j.horas * 60;
  const h = passadoMin / 60;
  const fase =
    h < 4 ? 'Digestão: o corpo usa a última refeição' :
    h < 12 ? 'Glicose caindo: o corpo começa a usar reservas' :
    h < 16 ? 'Queima de gordura aumentando' :
    h < 24 ? 'Cetose leve: gordura como combustível principal' :
    'Jejum longo: só com orientação profissional';
  return { passadoMin, faltaMin: Math.max(0, alvo - passadoMin), pct: Math.min(100, Math.round((passadoMin / alvo) * 100)), fase, concluido: passadoMin >= alvo };
}

export function hhmm(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h${String(m).padStart(2, '0')}`;
}
