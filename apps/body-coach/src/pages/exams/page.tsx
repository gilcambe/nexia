import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/feature/AuthContext';
import { listUserDocs, deleteUserDoc, dataUrlToObjectUrl } from '@/lib/userData';
import { isLocalDemoActive, readLocalList, writeLocalList, localIso, LOCAL_EXAMS_KEY, type LocalExamRecord } from '@/lib/localDemo';
import { localExamSeed } from '@/mocks/localDemo';
import Card from '@/components/base/Card';
import ExamUpload from './components/ExamUpload';
import ExamList, { type ExamItem } from './components/ExamList';
import BloodMarkers from './components/BloodMarkers';

// Monta a lista de exames do MODO LOCAL (semente + itens salvos no navegador).
function buildLocalExams(): ExamItem[] {
  const stored = readLocalList<LocalExamRecord>(LOCAL_EXAMS_KEY);
  const records: LocalExamRecord[] = stored ?? (localExamSeed as LocalExamRecord[]);
  return records
    .map((r, i) => ({
      id: r.id ?? i + 1,
      exam_type: r.exam_type,
      title: r.title,
      file_url: r.file_url ?? null,
      notes: r.notes,
      taken_at: r.taken_at ?? localIso(r.offset ?? 0),
      signedUrl: null,
    }))
    .sort((a, b) => new Date(b.taken_at).getTime() - new Date(a.taken_at).getTime());
}

export default function Exams() {
  const { user } = useAuth();
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!user) {
        setExams([]);
        setLoading(false);
        return;
      }
      if (isLocalDemoActive()) {
        setExams(buildLocalExams());
        setError(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const rows = await listUserDocs<Omit<ExamItem, 'signedUrl'>>(user.id, 'medical_exams', 'taken_at', 'desc');
        if (!active) return;
        // O arquivo vem como data URL; vira blob: URL para abrir numa aba nova.
        setExams(rows.map(({ _docId, ...e }) => ({ ...e, signedUrl: dataUrlToObjectUrl(e.file_url) })));
      } catch {
        if (active) setError('Não foi possível carregar seus exames.');
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [user?.id, reloadKey]);

  const handleDelete = async (id: number) => {
    if (!user) return;
    const next = exams.filter((e) => e.id !== id);
    setExams(next);
    if (isLocalDemoActive()) {
      writeLocalList(LOCAL_EXAMS_KEY, next);
      return;
    }
    await deleteUserDoc(user.id, 'medical_exams', String(id)).catch(() => setError('Falha ao remover o exame.'));
    reload();
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-heading text-2xl font-bold text-foreground-950">Saúde & Exames</h1>
        <p className="mt-1 max-w-2xl text-sm text-foreground-600">
          Seus exames de sangue, imagem e laudos em um só lugar, com interpretação dos marcadores
          e sugestões de vitaminas, suplementos e encaminhamentos.
        </p>
      </header>

      {isLocalDemoActive() && (
        <div className="flex items-start gap-2 rounded-xl border border-secondary-200 bg-secondary-100/60 px-4 py-3 text-sm text-secondary-900">
          <i className="ri-information-line mt-0.5 text-secondary-700"></i>
          <span>
            Você está no <strong className="font-semibold">modo local</strong> (login de teste).
            Os exames exibidos são exemplos e os que você adicionar ficam salvos apenas neste navegador.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card padding="p-6">
            <div className="mb-3 flex items-center gap-2">
              <i className="ri-file-upload-line text-lg text-primary-500"></i>
              <h2 className="font-heading text-base font-semibold text-foreground-950">Enviar exame</h2>
            </div>
            <ExamUpload userId={user?.id} onSaved={reload} />
          </Card>

          <Card padding="p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <i className="ri-folder-open-line text-lg text-secondary-500"></i>
                <h2 className="font-heading text-base font-semibold text-foreground-950">Meus exames</h2>
              </div>
              <span className="text-xs text-foreground-400">{exams.length} enviado(s)</span>
            </div>
            {error && !loading ? (
              <div className="rounded-lg bg-primary-100/70 p-4 sm:p-6 text-center">
                <p className="text-sm text-foreground-700">{error}</p>
                <button
                  onClick={reload}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-background-50 transition hover:bg-primary-600"
                >
                  <i className="ri-refresh-line"></i>
                  Tentar novamente
                </button>
              </div>
            ) : loading ? (
              <div className="flex items-center justify-center gap-2 p-6 text-sm text-foreground-500">
                <i className="ri-loader-4-line animate-spin"></i>
                Carregando...
              </div>
            ) : (
              <ExamList exams={exams} onDelete={handleDelete} />
            )}
          </Card>
        </div>

        <Card padding="p-6">
          <div className="mb-3 flex items-center gap-2">
            <i className="ri-stethoscope-line text-lg text-accent-500"></i>
            <h2 className="font-heading text-base font-semibold text-foreground-950">Marcadores de sangue</h2>
          </div>
          <BloodMarkers />
          <p className="mt-5 rounded-lg bg-accent-100/60 p-3 text-[11px] leading-relaxed text-foreground-600">
            <i className="ri-information-line mr-1 text-accent-700"></i>
            Isto é <strong className="font-semibold">orientação de performance</strong>, não diagnóstico
            médico. Consulte sempre um profissional de saúde antes de suplementar.
          </p>
        </Card>
      </div>
    </div>
  );
}