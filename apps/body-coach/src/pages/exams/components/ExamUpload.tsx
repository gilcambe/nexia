import { useRef, useState, type ChangeEvent } from 'react';
import { setUserDoc, fileToInlineDataUrl } from '@/lib/userData';
import { isLocalDemoActive, readLocalList, writeLocalList, LOCAL_EXAMS_KEY, type LocalExamRecord } from '@/lib/localDemo';
import { localExamSeed } from '@/mocks/localDemo';
import { examTypes } from './markerRules';

export default function ExamUpload({
  userId,
  onSaved,
}: {
  userId: string | undefined;
  onSaved: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<string>(examTypes[0]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!f.type.startsWith('image/') && f.type !== 'application/pdf') {
      setErrorMsg('Envie uma imagem ou um PDF.');
      return;
    }
    setFile(f);
    setErrorMsg(null);
    if (!title.trim()) setTitle(f.name.replace(/\.[^.]+$/, ''));
  };

  const reset = () => {
    setFile(null);
    setTitle('');
    setType(examTypes[0]);
    setNotes('');
  };

  const handleSubmit = async () => {
    if (!userId) {
      setErrorMsg('Você precisa estar conectado.');
      return;
    }

    // MODO LOCAL: salva apenas neste navegador (sem backend).
    if (isLocalDemoActive()) {
      const stored =
        readLocalList<LocalExamRecord>(LOCAL_EXAMS_KEY) ?? (localExamSeed as LocalExamRecord[]);
      stored.push({
        id: Date.now(),
        exam_type: type,
        title: title.trim() || (file ? file.name : 'Exame'),
        file_url: null,
        notes: notes.trim() || null,
        taken_at: new Date().toISOString(),
      });
      writeLocalList(LOCAL_EXAMS_KEY, stored);
      setSuccessMsg('Exame salvo (modo local).');
      reset();
      onSaved();
      return;
    }

    if (!file) {
      setErrorMsg('Selecione um arquivo de exame.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      // Arquivo como data URL dentro do documento (sem Cloud Storage, que é pago).
      let fileData: string;
      try {
        fileData = await fileToInlineDataUrl(file);
      } catch (e) {
        throw new Error(`Falha ao enviar: ${e instanceof Error ? e.message : 'erro desconhecido'}`);
      }

      const id = Date.now();
      try {
        await setUserDoc(userId, 'medical_exams', String(id), {
          id,
          user_id: userId,
          exam_type: type,
          title: title.trim() || file.name,
          file_url: fileData,
          file_name: file.name,
          notes: notes.trim() || null,
          taken_at: new Date().toISOString(),
        });
      } catch (e) {
        throw new Error(`Falha ao salvar: ${e instanceof Error ? e.message : 'erro desconhecido'}`);
      }

      setSuccessMsg('Exame salvo com sucesso!');
      reset();
      onSaved();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Não foi possível salvar o exame.');
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    'w-full rounded-lg border border-background-300 bg-background-50 px-3 py-2 text-sm text-foreground-800 outline-none focus:border-primary-400';

  return (
    <div>
      <p className="text-sm text-foreground-600">
        Envie exames de sangue, raio-X, ressonância ou laudos. Ficam salvos no seu histórico,
        protegidos e com a data real.
      </p>

      <div className="mt-4 space-y-4">
        <button
          onClick={() => fileRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-background-300 bg-background-50 px-4 py-6 transition hover:border-primary-400 hover:bg-background-100"
        >
          <i className="ri-file-upload-line text-3xl text-foreground-400"></i>
          {file ? (
            <span className="text-sm text-foreground-700">{file.name}</span>
          ) : (
            <span className="text-sm text-foreground-500">Clique para enviar imagem ou PDF</span>
          )}
        </button>
        <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFile} />

        <div>
          <label className="mb-1.5 block text-xs font-medium text-foreground-600">Título</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex.: Hemograma completo — 2026"
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground-600">Tipo de exame</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className={inputClass}
            >
              {examTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground-600">Data (hoje)</label>
            <p className="rounded-lg border border-background-200 bg-background-100/50 px-3 py-2 text-sm text-foreground-500">
              {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-foreground-600">Observações (opcional)</label>
          <textarea
            maxLength={500}
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Resultados relevantes, recomendações do médico..."
            className={`${inputClass} resize-none`}
          />
        </div>

        <div className="flex items-center justify-end">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 transition hover:bg-primary-600 disabled:opacity-50 dark:text-foreground-950"
          >
            <i className={saving ? 'ri-loader-4-line animate-spin' : 'ri-save-line'}></i>
            {saving ? 'Enviando...' : 'Salvar exame'}
          </button>
        </div>

        {errorMsg && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{errorMsg}</p>}
        {successMsg && <p className="rounded-lg bg-primary-100 px-3 py-2 text-sm text-primary-700">{successMsg}</p>}
      </div>
    </div>
  );
}