// Lembretes no celular sem servidor e sem custo: gera um arquivo de calendário (.ics) com alarme.
// Ao abrir, o Google Agenda / Agenda do iPhone cria os eventos repetidos toda semana e avisa no horário.
export const DIAS_SEMANA = [
  { cod: 'MO', nome: 'Seg' }, { cod: 'TU', nome: 'Ter' }, { cod: 'WE', nome: 'Qua' },
  { cod: 'TH', nome: 'Qui' }, { cod: 'FR', nome: 'Sex' }, { cod: 'SA', nome: 'Sáb' }, { cod: 'SU', nome: 'Dom' },
] as const;

export function diasSugeridos(diasPorSemana: number): string[] {
  const por: Record<number, string[]> = {
    1: ['WE'], 2: ['TU', 'TH'], 3: ['MO', 'WE', 'FR'], 4: ['MO', 'TU', 'TH', 'FR'],
    5: ['MO', 'TU', 'WE', 'TH', 'FR'], 6: ['MO', 'TU', 'WE', 'TH', 'FR', 'SA'], 7: ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'],
  };
  return por[Math.min(7, Math.max(1, Math.round(diasPorSemana) || 4))];
}

const dois = (n: number) => String(n).padStart(2, '0');
const escapa = (t: string) => t.replace(/[\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');

// hora no formato "HH:MM"; devolve o texto do .ics (linhas separadas por CRLF).
export function gerarIcs(opts: { dias: string[]; hora: string; apelido?: string | null; incluirPeso?: boolean; agora?: Date }): string {
  const agora = opts.agora ?? new Date();
  const [h, m] = (opts.hora || '18:00').split(':').map(Number);
  const hh = Number.isFinite(h) ? h : 18;
  const mm = Number.isFinite(m) ? m : 0;
  const quando = (d: Date, hora: number, min: number) => `${d.getFullYear()}${dois(d.getMonth() + 1)}${dois(d.getDate())}T${dois(hora)}${dois(min)}00`;
  const carimbo = `${agora.getUTCFullYear()}${dois(agora.getUTCMonth() + 1)}${dois(agora.getUTCDate())}T${dois(agora.getUTCHours())}${dois(agora.getUTCMinutes())}00Z`;
  const nome = opts.apelido ? `${opts.apelido}, ` : '';
  const COD = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  // primeira data (de hoje em diante) que cai num dos dias escolhidos: o primeiro evento já nasce no dia certo
  const primeiro = (dias: string[]) => { const d = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()); for (let i = 0; i < 7 && !dias.includes(COD[d.getDay()]); i++) d.setDate(d.getDate() + 1); return d; };
  const evento = (uid: string, titulo: string, texto: string, regra: string, hora: number, min: number, duracaoMin: number, diasEv: string[]) => {
    const dia0 = primeiro(diasEv);
    const fim = new Date(2000, 0, 1, hora, min + duracaoMin);
    return [
      'BEGIN:VEVENT', `UID:${uid}@nexia-body-coach`, `DTSTAMP:${carimbo}`,
      `DTSTART:${quando(dia0, hora, min)}`, `DTEND:${quando(dia0, fim.getHours(), fim.getMinutes())}`,
      `RRULE:${regra}`, `SUMMARY:${escapa(titulo)}`, `DESCRIPTION:${escapa(texto)}`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapa(titulo)}`, 'TRIGGER:-PT10M', 'END:VALARM', 'END:VEVENT',
    ];
  };
  const linhas = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//NEXIA Body Coach//PT-BR//', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  const dias = opts.dias.length ? opts.dias : ['MO', 'WE', 'FR'];
  linhas.push(...evento('treino', `${nome}hora do treino!`.replace(/^./, (c) => c.toUpperCase()), 'Abra o NEXIA Body Coach, responda como você está e comece o treino de hoje.', `FREQ=WEEKLY;BYDAY=${dias.join(',')}`, hh, mm, 60, dias));
  if (opts.incluirPeso) linhas.push(...evento('peso', 'Registrar o peso da semana', 'Registre o seu peso na aba Evolução para o app ajustar a dieta.', 'FREQ=WEEKLY;BYDAY=SU', 8, 0, 10, ['SU']));
  linhas.push('END:VCALENDAR');
  return linhas.join('\r\n') + '\r\n';
}

// Lembrete mensal de reavaliação (fotos nas 4 posições + medidas), sempre no mesmo dia do mês.
export function gerarIcsReavaliacao(agora: Date = new Date(), hora = 8): string {
  const dia = Math.min(28, agora.getDate());
  const prox = new Date(agora.getFullYear(), agora.getMonth() + 1, dia, hora, 0);
  const q = (d: Date) => `${d.getFullYear()}${dois(d.getMonth() + 1)}${dois(d.getDate())}T${dois(d.getHours())}${dois(d.getMinutes())}00`;
  const fim = new Date(prox.getTime() + 20 * 60000);
  const carimbo = `${agora.getUTCFullYear()}${dois(agora.getUTCMonth() + 1)}${dois(agora.getUTCDate())}T${dois(agora.getUTCHours())}${dois(agora.getUTCMinutes())}00Z`;
  const titulo = 'Reavaliação do mês: fotos e medidas';
  const texto = 'Abra o NEXIA Body Coach > Evolução: tire as fotos nas 4 posições (frente, costas, lado direito e esquerdo) e registre as medidas ou importe o laudo da balança.';
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//NEXIA Body Coach//PT-BR//', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT', 'UID:reavaliacao@nexia-body-coach', `DTSTAMP:${carimbo}`, `DTSTART:${q(prox)}`, `DTEND:${q(fim)}`,
    `RRULE:FREQ=MONTHLY;BYMONTHDAY=${dia}`, `SUMMARY:${escapa(titulo)}`, `DESCRIPTION:${escapa(texto)}`,
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapa(titulo)}`, 'TRIGGER:-PT10M', 'END:VALARM', 'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n') + '\r\n';
}
