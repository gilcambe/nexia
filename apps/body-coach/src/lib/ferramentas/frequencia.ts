// Frequência cardíaca ao vivo pelo Bluetooth do navegador (Web Bluetooth, Chrome no Android/computador).
// Funciona com qualquer cinta ou relógio que transmita o serviço padrão "Heart Rate" (0x180D):
// Polar H10/Verity, Garmin HRM e relógios com "transmitir FC", Coros, Amazfit, Mi Band etc. Grátis.
// A conexão fica neste módulo (fora das telas) para continuar ligada ao trocar de página no treino.

// Calorias por minuto pela frequência cardíaca (Keytel et al., 2005).
export function kcalPorMinuto(bpm: number, pesoKg: number, idade: number, sexo: 'M' | 'F'): number {
  if (!(bpm > 0) || !(pesoKg > 0) || !(idade > 0)) return 0;
  const v = sexo === 'F'
    ? (-20.4022 + 0.4472 * bpm - 0.1263 * pesoKg + 0.074 * idade) / 4.184
    : (-55.0969 + 0.6309 * bpm + 0.1988 * pesoKg + 0.2017 * idade) / 4.184;
  return Math.max(0, v);
}

// Calorias de musculação sem relógio: MET ~5 (treino de força moderado) × peso × horas.
export function kcalMusculacao(minutos: number, pesoKg: number, met = 5): number {
  if (!(minutos > 0)) return 0;
  return Math.round(met * (pesoKg || 70) * (minutos / 60));
}

// Lê o valor da característica 0x2A37 (formato do padrão Bluetooth).
export function lerBpm(dv: DataView): number {
  const flags = dv.getUint8(0);
  return flags & 0x1 ? dv.getUint16(1, true) : dv.getUint8(1);
}

export interface EstadoFC {
  conectado: boolean;
  aparelho: string;
  bpm: number;
  media: number;
  maxima: number;
  kcal: number;
  inicio: number;
  erro: string;
}

type Dispositivo = { name?: string; gatt?: { connect: () => Promise<Servidor>; disconnect: () => void; connected?: boolean }; addEventListener: (t: string, f: () => void) => void };
type Servidor = { getPrimaryService: (s: string) => Promise<{ getCharacteristic: (c: string) => Promise<Caracteristica> }> };
type Caracteristica = { startNotifications: () => Promise<unknown>; addEventListener: (t: string, f: (e: Event) => void) => void; value?: DataView };

let estado: EstadoFC = { conectado: false, aparelho: '', bpm: 0, media: 0, maxima: 0, kcal: 0, inicio: 0, erro: '' };
let somaBpm = 0, leituras = 0, ultimo = 0;
let perfil = { peso: 75, idade: 30, sexo: 'M' as 'M' | 'F' };
let dispositivo: Dispositivo | null = null;
const ouvintes = new Set<(e: EstadoFC) => void>();

function publicar(p: Partial<EstadoFC>) {
  estado = { ...estado, ...p };
  ouvintes.forEach((f) => f(estado));
}

export function ouvirFC(f: (e: EstadoFC) => void): () => void {
  ouvintes.add(f);
  f(estado);
  return () => { ouvintes.delete(f); };
}
export function estadoFC(): EstadoFC { return estado; }
export function bluetoothDisponivel(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}
export function definirPerfilFC(p: { peso?: number; idade?: number; sexo?: 'M' | 'F' }) {
  perfil = { peso: p.peso || perfil.peso, idade: p.idade || perfil.idade, sexo: p.sexo || perfil.sexo };
}

// Recebe uma leitura (também usado nos testes): atualiza média, máxima e soma as calorias do intervalo.
export function registrarLeitura(bpm: number, agora = Date.now()) {
  if (!(bpm > 25 && bpm < 240)) return;
  somaBpm += bpm; leituras++;
  const dtMin = ultimo ? Math.min(0.1, (agora - ultimo) / 60000) : 0; // ignora buracos > 6 s
  ultimo = agora;
  publicar({
    bpm,
    media: Math.round(somaBpm / leituras),
    maxima: Math.max(estado.maxima, bpm),
    kcal: estado.kcal + kcalPorMinuto(bpm, perfil.peso, perfil.idade, perfil.sexo) * dtMin,
    inicio: estado.inicio || agora,
  });
}

export function zerarSessaoFC() {
  somaBpm = 0; leituras = 0; ultimo = 0;
  publicar({ media: 0, maxima: 0, kcal: 0, inicio: 0 });
}

export async function conectarFC(): Promise<void> {
  const bt = (navigator as unknown as { bluetooth?: { requestDevice: (o: unknown) => Promise<Dispositivo> } }).bluetooth;
  if (!bt) {
    publicar({ erro: 'Este navegador não tem Bluetooth. Use o Chrome no Android ou no computador (no iPhone não funciona).' });
    return;
  }
  try {
    publicar({ erro: '' });
    const d = await bt.requestDevice({ filters: [{ services: ['heart_rate'] }] });
    dispositivo = d;
    d.addEventListener('gattserverdisconnected', () => publicar({ conectado: false, bpm: 0 }));
    const srv = await d.gatt!.connect();
    const car = await (await srv.getPrimaryService('heart_rate')).getCharacteristic('heart_rate_measurement');
    car.addEventListener('characteristicvaluechanged', (e: Event) => {
      const v = (e.target as unknown as Caracteristica).value;
      if (v) registrarLeitura(lerBpm(v));
    });
    await car.startNotifications();
    publicar({ conectado: true, aparelho: d.name || 'Monitor cardíaco' });
  } catch (e) {
    const nome = (e as Error).name;
    if (nome === 'NotFoundError') return; // a pessoa fechou a lista
    publicar({ erro: 'Não consegui conectar. Ligue a transmissão de batimentos no relógio (ou molhe a cinta) e tente de novo.' });
  }
}

export function desconectarFC() {
  try { dispositivo?.gatt?.disconnect(); } catch { /* já desconectado */ }
  dispositivo = null;
  publicar({ conectado: false, bpm: 0 });
}
