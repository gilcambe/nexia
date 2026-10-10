import { useState } from 'react';
import Card from '@/components/base/Card';
import { TIPOS_LUGAR, buscarLugares, linkOsm, linkRota, mapaEmbutido, type Lugar, type TipoLugar } from '@/lib/ferramentas/mapa';

const RAIOS = [1, 3, 5, 10];
const km = (n: number) => (n < 1 ? `${Math.round(n * 1000)} m` : `${n.toFixed(1).replace('.', ',')} km`);

// Onde treinar por perto: academias, parques, pistas e aparelhos ao ar livre (OpenStreetMap, grátis).
export default function Mapa() {
  const [pos, setPos] = useState<{ lat: number; lon: number } | null>(null);
  const [raio, setRaio] = useState(3);
  const [lugares, setLugares] = useState<Lugar[] | null>(null);
  const [filtro, setFiltro] = useState<TipoLugar | 'todos'>('todos');
  const [sel, setSel] = useState<Lugar | null>(null);
  const [estado, setEstado] = useState<'parado' | 'local' | 'buscando'>('parado');
  const [erro, setErro] = useState('');

  const buscar = async (p: { lat: number; lon: number }, r: number) => {
    setEstado('buscando'); setErro('');
    try { setLugares(await buscarLugares(p.lat, p.lon, r * 1000)); setSel(null); }
    catch { setErro('O mapa gratuito está ocupado agora. Tente de novo em instantes.'); }
    finally { setEstado('parado'); }
  };

  const localizar = () => {
    if (!navigator.geolocation) { setErro('Este aparelho não informa a localização.'); return; }
    setEstado('local'); setErro('');
    navigator.geolocation.getCurrentPosition(
      (g) => { const p = { lat: g.coords.latitude, lon: g.coords.longitude }; setPos(p); void buscar(p, raio); },
      () => { setEstado('parado'); setErro('Permita a localização para achar lugares perto de você.'); },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 },
    );
  };

  const lista = (lugares ?? []).filter((l) => filtro === 'todos' || l.tipo === filtro);
  const tipos = TIPOS_LUGAR.filter((t) => (lugares ?? []).some((l) => l.tipo === t.id));

  return (
    <div className="space-y-3">
      {!pos && (
        <Card>
          <p className="text-sm text-foreground-700">Ache academias, parques para correr, pistas e academias ao ar livre perto de você, em casa ou viajando.</p>
          <button type="button" onClick={localizar} disabled={estado !== 'parado'} className="mt-3 w-full rounded-xl bg-primary-500 px-4 py-3 text-sm font-semibold text-background-50 disabled:opacity-60">
            <i className="ri-map-pin-line mr-1"></i>{estado === 'local' ? 'Pegando sua localização…' : 'Usar minha localização'}
          </button>
        </Card>
      )}
      {pos && (
        <>
          <iframe title="Mapa" src={mapaEmbutido(pos.lat, pos.lon, raio, sel ?? undefined)} className="h-56 w-full rounded-2xl border border-background-200" loading="lazy" />
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-xs text-foreground-500">Raio</span>
            {RAIOS.map((r) => (
              <button key={r} type="button" onClick={() => { setRaio(r); void buscar(pos, r); }} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${raio === r ? 'bg-primary-500 text-background-50' : 'border border-background-200 bg-background-50 text-foreground-700'}`}>{r} km</button>
            ))}
          </div>
          {tipos.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              <button type="button" onClick={() => setFiltro('todos')} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${filtro === 'todos' ? 'bg-foreground-900 text-background-50' : 'border border-background-200 bg-background-50'}`}>Todos</button>
              {tipos.map((t) => (
                <button key={t.id} type="button" onClick={() => setFiltro(t.id)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${filtro === t.id ? 'bg-foreground-900 text-background-50' : 'border border-background-200 bg-background-50'}`}><i className={`${t.icone} mr-1`}></i>{t.nome}</button>
              ))}
            </div>
          )}
          {estado === 'buscando' && <p className="text-sm text-foreground-500">Procurando lugares…</p>}
          {lugares && estado === 'parado' && lista.length === 0 && <p className="text-sm text-foreground-500">Nada encontrado nesse raio. Tente um raio maior.</p>}
          <ul className="space-y-2">
            {lista.slice(0, 60).map((l) => {
              const t = TIPOS_LUGAR.find((x) => x.id === l.tipo);
              return (
                <li key={l.id} className={`rounded-2xl border bg-background-50 p-3 ${sel?.id === l.id ? 'border-primary-400' : 'border-background-200'}`}>
                  <button type="button" onClick={() => setSel(l)} className="flex w-full items-start gap-3 text-left">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-lg text-primary-700"><i className={t?.icone}></i></span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-foreground-950">{l.nome}</span>
                      <span className="block text-xs text-foreground-500">{t?.nome.replace(/s$/, '')} · {km(l.km)}{l.endereco ? ` · ${l.endereco}` : ''}</span>
                      {l.horario && <span className="block text-xs text-foreground-500">Horário: {l.horario}</span>}
                    </span>
                  </button>
                  <div className="mt-2 flex gap-2">
                    <a href={linkRota(l)} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-primary-500 px-3 py-1.5 text-xs font-semibold text-background-50"><i className="ri-direction-line mr-1"></i>Como chegar</a>
                    <a href={linkOsm(l)} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-background-200 px-3 py-1.5 text-xs font-semibold">Ver no mapa</a>
                    {l.site && <a href={l.site} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-background-200 px-3 py-1.5 text-xs font-semibold">Site</a>}
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="text-[11px] text-foreground-400">Dados do OpenStreetMap (colaborativo). Confira horário e acesso antes de ir.</p>
        </>
      )}
      {erro && <p className="text-sm text-red-600" role="alert">{erro}</p>}
    </div>
  );
}
