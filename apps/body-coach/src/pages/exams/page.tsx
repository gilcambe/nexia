import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/feature/AuthContext';
import { listUserDocs, deleteUserDoc, dataUrlToObjectUrl } from '@/lib/userData';
import Card from '@/components/base/Card';
import ExamUpload from './components/ExamUpload';
import ExamList, { type ExamItem } from './components/ExamList';
import BloodMarkers from './components/BloodMarkers';
import Abas, { useAba } from '@/components/base/Abas';

const ABAS = [
  { id: 'enviar', label: 'Enviar', icone: 'ri-file-upload-line' },
  { id: 'meus', label: 'Exames', icone: 'ri-folder-open-line' },
  { id: 'marcadores', label: 'Marcadores', icone: 'ri-stethoscope-line' },
] as const;

export default function Exams() {
  const { user } = useAuth();
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [aba, setAba] = useAba(ABAS.map((a) => a.id), 'enviar');
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
  }, [user, reloadKey]);

  const handleDelete = async (id: number) => {
    if (!user) return;
    const next = exams.filter((e) => e.id !== id);
    setExams(next);
    await deleteUserDoc(user.id, 'medical_exams', String(id)).catch(() => setError('Falha ao remover o exame.'));
    reload();
  };

  return (
    <div className="tela tela-fim">
      <header>
        <h1 className="font-heading text-xl font-bold text-foreground-950">Saúde e exames</h1>
      </header>

      {/* No celular: uma parte por aba (cabe sem rolar). No computador, tudo lado a lado. */}
      <div className="lg:hidden"><Abas abas={ABAS} atual={aba} onMudar={setAba} rotulo="Partes dos exames" /></div>

      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[1fr_380px] lg:gap-6">
        <div className={`${aba === 'marcadores' ? 'hidden' : 'flex flex-1 flex-col gap-3'} lg:block lg:space-y-3`}>
          <Card padding="p-3" className={aba === 'enviar' ? 'flex flex-1 flex-col lg:block' : 'hidden lg:block'}>
            <div className="mb-1 flex items-center gap-2">
              <i className="ri-file-upload-line text-lg text-primary-500"></i>
              <h2 className="font-heading text-base font-semibold text-foreground-950">Enviar exame</h2>
            </div>
            <ExamUpload userId={user?.id} onSaved={() => { reload(); setAba('meus'); }} />
          </Card>

          <Card padding="p-3" className={aba === 'meus' ? 'flex flex-1 flex-col lg:block' : 'hidden lg:block'}>
            <div className="mb-2 flex items-center justify-between">
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

        <Card padding="p-3" className={aba === 'marcadores' ? 'flex flex-1 flex-col justify-between lg:block' : 'hidden lg:block'}>
          <div className="mb-1 flex items-center gap-2">
            <i className="ri-stethoscope-line text-lg text-accent-500"></i>
            <h2 className="font-heading text-base font-semibold text-foreground-950">Marcadores de sangue</h2>
          </div>
          <BloodMarkers />
          <p className="mt-2 rounded-lg bg-accent-100/60 px-2.5 py-1.5 text-[11px] leading-snug text-foreground-600">
            <i className="ri-information-line mr-1 text-accent-700"></i>
            Isto é <strong className="font-semibold">orientação de performance</strong>, não diagnóstico
            médico. Consulte sempre um profissional de saúde antes de suplementar.
          </p>
        </Card>
      </div>
    </div>
  );
}