import type { CargaRep } from "@/lib/cargasDoTexto";

type Registrador = (series: CargaRep[]) => string | null;

let registrador: Registrador | null = null;

export function setTreinoAtivo(fn: Registrador | null): void {
  registrador = fn;
}

export function registrarSeries(series: CargaRep[]): string | null {
  return registrador ? registrador(series) : null;
}
