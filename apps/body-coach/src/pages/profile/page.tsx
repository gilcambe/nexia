import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/feature/AuthContext';
import { deleteUser } from 'firebase/auth';
import { getUserDoc, setUserDoc, deleteAllUserData } from '@/lib/userData';
import { getFirebase } from '@/lib/firebaseClient';
import { POR_ID } from '@/lib/exerciseDb';
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
  { id: 'evitar', label: 'Exercícios evitados', icone: 'ri-sword-line' },
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
    <Card padding="p-3">
      <h2 className="mb-1.5 font-heading text-sm font-semibold text-foreground-950"><i className="ri-font-size-2 mr-1 text-primary-500"></i>Tamanho da letra</h2>
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tamanho da letra" data-testid="tamanho-letra">
        {TAMANHOS.map((t) => (
          <button key={t.id} type="button" role="radio" aria-checked={atual === t.id} onClick={() => { definirLetra(t.id); setAtual(t.id); }}
            className={`min-h-[40px] rounded-xl border-2 px-1 py-0.5 font-semibold leading-tight ${atual === t.id ? 'border-primary-500 bg-primary-50 text-primary-800' : 'border-background-200 text-foreground-700'}`}
            style={{ fontSize: `${t.pct / 100}rem` }}>
            A <span className="block whitespace-nowrap text-[11px] font-medium">{t.nome}</span>
          </button>
        ))}
      </div>
    </Card>
  );
}

function InfoRow({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="flex flex-1 items-center gap-2 py-0.5">
      <span className="flex w-24 shrink-0 items-center gap-1 text-xs text-foreground-500 alto:w-32 alto:text-sm">
        <i className={`${icon} text-primary-500`}></i>
        {label}
      </span>
      <span className="min-w-0 flex-1 text-[13px] font-medium leading-snug text-foreground-900 alto:text-base">{value}</span>
    </div>
  );
}

function TextBlock({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="flex flex-1 items-center gap-2 py-1">
      <p className="w-24 shrink-0 text-xs text-foreground-500 alto:w-32 alto:text-sm">{label}</p>
      <p className="min-w-0 flex-1 text-[13px] text-foreground-800 alto:text-base">{text(value)}</p>
    </div>
  );
}

export default function Profile() {
  const { user, profile, refreshProfile } = useAuth();
  // Lê o perfil salvo de novo ao abrir a página: o questionário pode ter acabado de gravar as respostas.
  const [saved, setSaved] = useState<SavedProfile | null>(null);
  const [removendoId, setRemovendoId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    getUserDoc<SavedProfile>(user.id, 'profile', 'main').then(setSaved).catch(() => {});
  }, [user]);

  // Busca nomes dos exercícios evitados para exibir de forma mais amigável
  useEffect(() => {
    const profileDoc = saved || profile;
    if (profileDoc?.onboarding?.evitar && Array.isArray(profileDoc.onboarding.evitar) && profileDoc.onboarding.evitar.length > 0) {
      const nomes: Record<string, string> = {};
      profileDoc.onboarding.evitar.forEach(exercicioId => {
        nomes[exercicioId] = `Exercício #${exercicioId}`;
      });
      setExerciciosNomes(nomes);
    }
  }, [saved, profile]);

  const navigate = useNavigate();
  const [aba, setAba] = useAba(ABAS.map((a) => a.id), 'voce');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingExercicio, setDeletingExercicio] = useState<string | null>(null);
  const [exerciciosNomes, setExerciciosNomes] = useState<Record<string, string>>({});
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

  const removerExercicioEvitado = async (exercicioId: string) => {
    if (!user) return;
    
    setDeletingExercicio(exercicioId);
    try {
      // Atualiza o perfil removendo o exercício da lista de evitar
      const profileDoc = await getUserDoc(user.id, 'profile', 'main');
      if (!profileDoc?.onboarding) return;
      
      const evitarAtual = Array.isArray(profileDoc.onboarding.evitar) 
        ? profileDoc.onboarding.evitar.filter(id => id !== exercicioId)
        : [];
      
      await setUserDoc(user.id, 'profile', 'main', {
        onboarding: {
          ...profileDoc.onboarding,
          evitar: evitarAtual
        }
      }, true); // merge = true para atualizar apenas os campos fornecidos
      
      // Atualiza o estado local para refletir a mudança
      setSaved(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          onboarding: {
            ...prev.onboarding,
            evitar: evitarAtual
          }
        };
      });
    } catch (error) {
      console.error('Erro ao remover exercício evitado:', error);
    } finally {
      setDeletingExercicio(null);
    }
  };

  const data: SavedProfile = { ...(profile ?? {}), ...(saved ?? {}) };
  const ob: Answers = data.onboarding ?? {};
  const name = data.full_name || (typeof ob.name === 'string' && ob.name.trim()) || user?.email || MISSING;
  const height = data.height_cm ? `${data.height_cm} cm` : text(ob.height, ' cm');
  const modality = Array.isArray(ob.modality) ? ob.modality : [];

  const rawEvitar = ob.evitar ?? (data as Record<string, unknown>).evitar;
  const listaEvitar: string[] = Array.isArray(rawEvitar)
    ? (rawEvitar as string[]).map((x) => String(x ?? '').trim()).filter(Boolean)
    : typeof rawEvitar === 'string' && rawEvitar.trim()
    ? rawEvitar.split(',').map((x) => x.trim()).filter(Boolean)
    : [];

  const removerEvitar = async (idRemover: string) => {
    if (!user) return;
    const novaLista = listaEvitar.filter((x) => x !== idRemover);
    const novoOb = { ...ob, evitar: novaLista };
    setRemovendoId(idRemover);
    try {
      await setUserDoc(user.id, 'profile', 'main', { onboarding: novoOb, evitar: novaLista }, true);
      setSaved((prev) => (prev ? { ...prev, onboarding: novoOb } : { onboarding: novoOb }));
      refreshProfile();
    } catch (err) {
      console.error('Erro ao remover exercício a evitar:', err);
    } finally {
      setRemovendoId(null);
    }
  };

  return (
    <div className="tela tela-fim">
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
          <Card padding="p-3" className="flex flex-col">
            <div className="mb-1.5 flex items-center justify-between">
              <h2 className="font-heading text-sm font-semibold text-foreground-950"><i className="ri-sword-line mr-1 text-primary-500"></i>Seus dados e treino</h2>
              <Link to="/onboarding" className="text-xs font-semibold text-primary-600">Refazer</Link>
            </div>
            {/* As linhas dividem a altura do cartão (tela cheia, sem faixa vazia embaixo). */}
            <div className="flex flex-1 flex-col divide-y divide-background-200">
              <InfoRow icon="ri-user-3-line" label="Nome" value={name} />
              <InfoRow icon="ri-calendar-line" label="Idade e corpo" value={[text(ob.age, ' anos'), height, text(ob.weight, ' kg')].filter((x) => x !== MISSING).join(' · ') || MISSING} />
              <InfoRow icon="ri-trophy-line" label="Objetivos" value={Array.isArray(ob.goals) && ob.goals.length ? (ob.goals as string[]).join(' + ') : text(ob.goal)} />
              <InfoRow icon="ri-map-pin-line" label="Onde treina" value={text(ob.place)} />
              <InfoRow icon="ri-bar-chart-line" label="Nível" value={text(ob.level)} />
              <InfoRow icon="ri-calendar-check-line" label="Treinos" value={[text(ob.days, 'x/semana'), text(ob.minutes, ' min')].filter((x) => x !== MISSING).join(' · ') || MISSING} />
              <InfoRow icon="ri-run-line" label="Modalidades" value={modality.length ? modality.join(', ') : MISSING} />
            </div>
            <div className="mt-3 pt-2 border-t border-background-200">
              <span className="flex items-center gap-1 text-xs font-semibold text-foreground-700 mb-1.5">
                <i className="ri-close-circle-line text-primary-500"></i>
                Exercícios a evitar
              </span>
              {listaEvitar.length === 0 ? (
                <p className="text-[13px] text-foreground-500">Nenhum exercício marcado para evitar.</p>
              ) : (
                <ul className="space-y-1" data-testid="lista-exercicios-evitar">
                  {listaEvitar.map((id) => {
                    const ex = POR_ID[id];
                    const nome = ex?.nome ?? id;
                    return (
                      <li key={id} className="flex items-center justify-between rounded-lg bg-background-100 px-2.5 py-1.5 text-xs text-foreground-800">
                        <span className="font-medium">{nome}</span>
                        <button
                          type="button"
                          onClick={() => void removerEvitar(id)}
                          disabled={removendoId === id}
                          className="rounded bg-background-200 px-2 py-0.5 text-[11px] font-semibold text-foreground-700 hover:bg-background-300 hover:text-foreground-900 disabled:opacity-50"
                          aria-label={`Remover ${nome}`}
                        >
                          Remover
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </Card>
        </>
      )}

      {aba === 'saude' && (
        <>
          <CicloCard />
          <Card padding="p-3" className="flex flex-col">
            <h2 className="font-heading text-sm font-semibold text-foreground-950"><i className="ri-heart-pulse-line mr-1 text-primary-500"></i>Saúde e segurança</h2>
            <p className="text-[11px] text-foreground-500">O app não diagnostica e não altera remédios.</p>
            <div className="flex flex-1 flex-col divide-y divide-background-200">
              <TextBlock label="Histórico médico" value={ob.history} />
              <TextBlock label="Lesões anteriores" value={ob.injuries} />
              <TextBlock label="Sintomas atuais" value={ob.symptoms} />
            </div>
          </Card>
        </>
      )}

      {aba === 'evitar' && (
        <Card padding="p-3">
          <h2 className="font-heading text-sm font-semibold text-foreground-950"><i className="ri-sword-line mr-1 text-primary-500"></i>Exercícios evitados</h2>
          <p className="text-[11px] text-foreground-500">Você pode remover exercícios que não quer fazer</p>
          
          {Array.isArray(ob.evitar) && ob.evitar.length > 0 ? (
            <div className="mt-3 space-y-2">
              {ob.evitar.map((exercicioId) => (
                <div key={exercicioId} className="flex items-center justify-between rounded-lg border border-background-200 bg-background-50 p-3">
                  <span className="text-sm font-medium text-foreground-800">{exerciciosNomes[exercicioId] || `Exercício #${exercicioId}`}</span>
                  <button
                    type="button"
                    onClick={() => removerExercicioEvitado(exercicioId)}
                    disabled={deletingExercicio === exercicioId}
                    className="rounded-md bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-200 disabled:opacity-60"
                  >
                    {deletingExercicio === exercicioId ? 'Removendo...' : 'Remover'}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-3 rounded-lg border border-background-200 bg-background-50 p-4 text-center">
              <i className="ri-sword-line text-2xl text-foreground-300 mb-2 block"></i>
              <p className="text-sm text-foreground-600">Nenhum exercício marcado como evitado</p>
              <p className="text-xs text-foreground-500 mt-1">Você pode marcar exercícios para evitar durante o onboarding</p>
            </div>
          )}
        </Card>
      )}

      {aba === 'conta' && (<>
      <TamanhoDaLetra />
      <ConviteCoach />
      {/* privacy */}
      <Card padding="p-3">
        <h2 className="font-heading text-sm font-semibold text-foreground-950"><i className="ri-shield-user-line mr-1 text-primary-500"></i>Privacidade</h2>
        <p className="mb-1.5 text-[11px] text-foreground-600">
          Seus dados seguem a LGPD. Leia a política ou peça a exclusão definitiva.
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <Link
            to="/privacidade"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline"
          >
            <i className="ri-file-text-line"></i> Termos e privacidade
          </Link>
          <a
            href={PRIVACIDADE_KERNEX}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline"
          >
            <i className="ri-shield-check-line"></i> Privacidade e termos (Kernex)
          </a>
          <button
            type="button"
            onClick={deleteAccount}
            disabled={deleting}
            className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 inline-flex items-center gap-2 disabled:opacity-60"
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
