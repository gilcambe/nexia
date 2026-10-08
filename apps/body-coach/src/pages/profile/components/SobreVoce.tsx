import { useEffect, useRef, useState } from 'react';
import Card, { CardHeader } from '@/components/base/Card';
import { useAuth } from '@/components/feature/AuthContext';
import { getUserDoc, setUserDoc } from '@/lib/userData';

export const LIMITACOES = ['Cadeirante', 'Mobilidade reduzida (muleta ou andador)', '60 anos ou mais', 'Gestante'];

// Reduz a foto para 256 px e guarda como texto (JPEG leve, ~15 KB): não precisa de armazenamento pago.
async function reduzirFoto(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, erro) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => erro(new Error('Não consegui abrir a foto.'));
      i.src = url;
    });
    const lado = Math.min(img.width, img.height);
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    c.getContext('2d')!.drawImage(img, (img.width - lado) / 2, (img.height - lado) / 2, lado, lado, 0, 0, 256, 256);
    return c.toDataURL('image/jpeg', 0.8);
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Foto, apelido (o coach chama você por ele) e limitações (o treino se adapta).
export default function SobreVoce() {
  const { user, refreshProfile } = useAuth();
  const [apelido, setApelido] = useState('');
  const [foto, setFoto] = useState<string | null>(null);
  const [limites, setLimites] = useState<string[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user?.id) return;
    getUserDoc<{ nickname?: string; photo_data?: string; mobility?: string[] }>(user.id, 'profile', 'main')
      .then((p) => {
        setApelido(p?.nickname ?? '');
        setFoto(p?.photo_data ?? null);
        setLimites(Array.isArray(p?.mobility) ? p.mobility : []);
      })
      .catch(() => {});
  }, [user?.id]);

  const escolherFoto = async (f: File | undefined) => {
    if (!f) return;
    try { setFoto(await reduzirFoto(f)); setMsg(null); } catch (e) { setMsg((e as Error).message); }
  };

  const salvar = async () => {
    if (!user) return;
    setSalvando(true);
    try {
      await setUserDoc(user.id, 'profile', 'main', { nickname: apelido.trim(), photo_data: foto ?? '', mobility: limites }, true);
      refreshProfile();
      setMsg('Salvo! O coach já vai usar essas informações.');
    } catch {
      setMsg('Não consegui salvar agora. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Card padding="p-5">
      <CardHeader title="Sobre você" icon="ri-user-heart-line" />
      <div className="flex items-center gap-4">
        <button type="button" onClick={() => arquivo.current?.click()} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border-2 border-primary-300 bg-background-100" aria-label="Escolher foto de perfil">
          {foto ? <img src={foto} alt="Sua foto de perfil" className="h-full w-full object-cover" /> : <i className="ri-camera-line text-2xl text-foreground-400"></i>}
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground-900">Foto de perfil</p>
          <button type="button" onClick={() => arquivo.current?.click()} className="mt-1 text-sm font-semibold text-primary-600 hover:underline">{foto ? 'Trocar foto' : 'Escolher foto'}</button>
          {foto && <button type="button" onClick={() => setFoto(null)} className="ml-3 text-sm text-foreground-500 hover:underline">Remover</button>}
          <input ref={arquivo} type="file" accept="image/*" className="hidden" onChange={(e) => { void escolherFoto(e.target.files?.[0]); e.target.value = ''; }} />
        </div>
      </div>

      <label className="mt-4 flex flex-col gap-1">
        <span className="text-sm font-medium text-foreground-600">Como você quer ser chamado(a)?</span>
        <input type="text" maxLength={30} value={apelido} onChange={(e) => setApelido(e.target.value)} placeholder="Seu nome ou apelido" className="rounded-lg border border-background-200 bg-background-50 px-3 py-2.5 text-sm outline-none focus:border-primary-300" />
      </label>

      <div className="mt-4">
        <p className="text-sm font-medium text-foreground-600">Alguma condição que muda o treino?</p>
        <p className="text-xs text-foreground-500">O treino e as dicas se adaptam. Pode deixar em branco.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {LIMITACOES.map((l) => {
            const ativo = limites.includes(l);
            return (
              <button key={l} type="button" onClick={() => setLimites(ativo ? limites.filter((x) => x !== l) : [...limites, l])} className={`rounded-full border px-3 py-2 text-xs font-medium transition ${ativo ? 'border-primary-300 bg-primary-500 text-background-50' : 'border-background-200 bg-background-50 text-foreground-700 hover:bg-background-100'}`}>
                {l}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button type="button" onClick={salvar} disabled={salvando} className="rounded-xl bg-primary-500 px-5 py-2.5 text-sm font-semibold text-background-50 hover:bg-primary-600 disabled:opacity-60">{salvando ? 'Salvando...' : 'Salvar'}</button>
        {msg && <span className="text-sm text-foreground-600">{msg}</span>}
      </div>
    </Card>
  );
}
