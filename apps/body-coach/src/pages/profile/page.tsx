import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/feature/AuthContext';
import { deleteUser } from 'firebase/auth';
import { getUserDoc, deleteAllUserData } from '@/lib/userData';
import { getFirebase } from '@/lib/firebaseClient';
import Card, { CardHeader } from '@/components/base/Card';
import SobreVoce from './components/SobreVoce';
import CicloCard from './components/CicloCard';
import ConviteCoach from './components/ConviteCoach';
import { definirLetra, letraGuardada, TAMANHOS } from '@/lib/letra';
import { confirmar } from '../../lib/dialogo';
import Abas, { useAba } from '@/components/base/Abas';

const ABAS = [
  { id: 'voce', label: 'Você', icone: 'ri-user-3-line' },
  { id: 'saude', label: 'Saúde', icone: 'ri-heart-pulse-line' },
  { id: 'conta', label: 'App e conta', icone: 'ri-settings-3-line' },
] as const;

// Política única da Kernex (LGPD). Trocar para https://kernex.com.br/privacidade.html quando o domínio ligar.
const PRIVACIDADE_KERNEX = 'https://kernex.pages.dev/privacidade.html';

type Answers = Record<string, string | string[] | undefined>;
interface SavedProfile {
  full_name?: string | null;
  email?: string | null;
  height_cm?: number | null;
  onboarding?: Answers;
}

const MISSING = 'Não informado';
const text = (v: unknown, suffix = '') => (typeof v === 'string' && v.trim() ? `${v.trim()}${suffix}` : MISSING);

// Letra maior para quem acha pequeno: vale para o app inteiro, neste celular.
function TamanhoDaLetra() {
  const [atual, setAtual] = useState(letraGuardada);
  return (
    <Card padding="p-4">
      <CardHeader title="Tamanho da letra" icon="ri-font-size-2" />
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tamanho da letra" data-testid="tamanho-letra">
        {TAMANHOS.map((t) => (
          <button key={t.id} type="button" role="radio" aria-checked={atual === t.id} onClick={() => { definirLetra(t.id); setAtual(t.id); }}
            className={`min-h-[48px] rounded-xl border-2 px-2 py-1.5 font-semibold ${atual === t.id ? 'border-primary-500 bg-primary-50 text-primary-800' : 'border-background-200 text-foreground-700'}`}
            style={{ fontSize: `${t.pct / 100}rem` }}>
            A <span className="block text-xs font-medium">{t.nome}</span>
          </button>
        ))}
      </div>
    </Card>
  );
}

function InfoRow({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-background-100/70 px-3 py-1.5">
      <span className="flex items-center gap-2 text-sm text-foreground-500">
        <i className={`${icon} text-primary-500`}></i>
        {label}
      </span>
      <span className="text-right text-sm font-medium text-foreground-900">{value}</span>
    </div>
  );
}

function TextBlock({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-foreground-400">{label}</p>
      <div className="rounded-lg bg-background-100/70 px-3 py-2 text-sm text-foreground-700">{text(value)}</div>
    </div>
  );
}

export default function Profile() {
  const { user, profile } = useAuth();
  // Lê o perfil salvo de novo ao abrir a página: o questionário pode ter acabado de gravar as respostas.
  const [saved, setSaved] = useState<SavedProfile | null>(null);
  useEffect(() => {
    if (!user) return;
    getUserDoc<SavedProfile>(user.id, 'profile', 'main').then(setSaved).catch(() => {});
  }, [user]);

  const navigate = useNavigate();
  const [aba, setAba] = useAba(ABAS.map((a) => a.id), 'voce');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const deleteAccount = async () => {
    if (!user) return;
    if (!await confirmar('Isso apaga sua conta e todos os seus dados (perfil, refeições, check-ins, evolução e exames). Não dá para desfazer. Continuar?')) return;
    if (!await confirmar('Tem certeza? Esta é a última confirmação: a conta e todos os dados serão apagados agora.')) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const fb = await getFirebase();
      if (!fb?.auth.currentUser) throw new Error('offline');
      await deleteAllUserData(user.id);
      try {
        Object.keys(localStorage).filter((k) => k.includes(user.id)).forEach((k) => localStorage.removeItem(k));
      } catch {
        // Sem armazenamento local: nada a limpar.
      }
      await deleteUser(fb.auth.currentUser);
      navigate('/auth');
    } catch (e) {
      const code = (e as { code?: string }).code ?? '';
      setDeleteError(
        code.includes('requires-recent-login')
          ? 'Por segurança, saia e entre de novo e depois exclua a conta.'
          : 'Não foi possível excluir a conta agora. Tente de novo.',
      );
    } finally {
      setDeleting(false);
    }
  };

  const data: SavedProfile = { ...(profile ?? {}), ...(saved ?? {}) };
  const ob: Answers = data.onboarding ?? {};
  const name = data.full_name || (typeof ob.name === 'string' && ob.name.trim()) || user?.email || MISSING;
  const height = data.height_cm ? `${data.height_cm} cm` : text(ob.height, ' cm');
  const modality = Array.isArray(ob.modality) ? ob.modality : [];

  return (
    <div className="space-y-3">
      <h1 className="font-heading text-xl font-bold text-foreground-950">Perfil</h1>

      {!data.onboarding && (
        <Card padding="p-4">
          <CardHeader title="Complete seu perfil" icon="ri-user-add-line" />
          <p className="text-sm text-foreground-600">Responda o questionário inicial para o coach montar seu plano.</p>
          <Link
            to="/onboarding"
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-primary-500 px-5 py-2.5 text-sm font-semibold text-background-50 transition hover:bg-primary-600"
          >
            Responder agora <i className="ri-arrow-right-line"></i>
          </Link>
        </Card>
      )}

      {/* Três abas curtas no lugar de uma página comprida. */}
      <Abas abas={ABAS} atual={aba} onMudar={setAba} rotulo="Partes do perfil" />

      {aba === 'voce' && (
        <>
          <SobreVoce />
          <Card padding="p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-heading text-base font-semibold text-foreground-950"><i className="ri-sword-line mr-1 text-primary-500"></i>Seus dados e treino</h2>
              <Link to="/onboarding" className="text-xs font-semibold text-primary-600">Refazer</Link>
            </div>
            <div className="space-y-1.5">
              <InfoRow icon="ri-user-3-line" label="Nome" value={name} />
              <InfoRow icon="ri-calendar-line" label="Idade · altura · peso" value={[text(ob.age, ' anos'), height, text(ob.weight, ' kg')].filter((x) => x !== MISSING).join(' · ') || MISSING} />
              <InfoRow icon="ri-trophy-line" label="Objetivos" value={Array.isArray(ob.goals) && ob.goals.length ? (ob.goals as string[]).join(' + ') : text(ob.goal)} />
              <InfoRow icon="ri-map-pin-line" label="Onde treina" value={text(ob.place)} />
              <InfoRow icon="ri-bar-chart-line" label="Nível" value={text(ob.level)} />
              <InfoRow icon="ri-calendar-check-line" label="Treinos" value={[text(ob.days, 'x/semana'), text(ob.minutes, ' min')].filter((x) => x !== MISSING).join(' · ') || MISSING} />
              <InfoRow icon="ri-run-line" label="Modalidades" value={modality.length ? modality.join(', ') : MISSING} />
            </div>
          </Card>
        </>
      )}

      {aba === 'saude' && (
        <>
          <CicloCard />
          <Card padding="p-4">
            <CardHeader title="Saúde &amp; segurança" icon="ri-heart-pulse-line" />
            <p className="mb-2 text-xs text-foreground-500">O sistema não diagnostica e não altera medicamentos.</p>
            <div className="space-y-2">
              <TextBlock label="Histórico médico" value={ob.history} />
              <TextBlock label="Lesões anteriores" value={ob.injuries} />
              <TextBlock label="Sintomas atuais" value={ob.symptoms} />
            </div>
          </Card>
        </>
      )}

      {aba === 'conta' && (<>
      <TamanhoDaLetra />
      <ConviteCoach />
      {/* privacy */}
      <Card padding="p-4">
        <CardHeader title="Privacidade" icon="ri-shield-user-line" />
        <p className="mb-3 text-sm text-foreground-600">
          Seus dados seguem a LGPD. Leia a política ou peça a exclusão definitiva.
        </p>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <Link
            to="/privacidade"
            className="text-sm font-medium text-primary-600 hover:underline inline-flex items-center gap-1.5"
          >
            <i className="ri-file-text-line"></i> Termos e privacidade
          </Link>
          <a
            href={PRIVACIDADE_KERNEX}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-primary-600 hover:underline inline-flex items-center gap-1.5"
          >
            <i className="ri-shield-check-line"></i> Privacidade e termos (Kernex)
          </a>
          <button
            type="button"
            onClick={deleteAccount}
            disabled={deleting}
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 inline-flex items-center gap-2 disabled:opacity-60"
          >
            <i className="ri-delete-bin-line"></i> {deleting ? 'Excluindo...' : 'Excluir minha conta'}
          </button>
        </div>
        {deleteError && <p className="mt-3 text-sm text-red-600">{deleteError}</p>}
      </Card>
      </>)}
    </div>
  );
}
