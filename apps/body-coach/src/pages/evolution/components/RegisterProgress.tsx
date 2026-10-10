import { useRef, useState, type ChangeEvent } from 'react';
import { setUserDoc, compressImageToDataUrl } from '@/lib/userData';
import { isLocalDemoActive, readLocalList, writeLocalList, LOCAL_PROGRESS_KEY } from '@/lib/localDemo';
import { localProgressSeed } from '@/mocks/localDemo';

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Falha ao ler imagem'));
    reader.readAsDataURL(file);
  });
}

const num = (v: string): number | null => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

export default function RegisterProgress({
  userId,
  onSaved,
}: {
  userId: string | undefined;
  onSaved: () => void;
}) {
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [cintura, setCintura] = useState('');
  const [quadril, setQuadril] = useState('');
  const [notes, setNotes] = useState('');

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  const handlePhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Selecione um arquivo de imagem válido.');
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(await readFileAsDataUrl(file));
    setErrorMsg(null);
  };

  const reset = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    setWeight('');
    setBodyFat('');
    setCintura('');
    setQuadril('');
    setNotes('');
  };

  const handleSubmit = async () => {
    if (!userId) {
      setErrorMsg('Você precisa estar conectado para registrar progresso.');
      return;
    }

    const weightVal = num(weight);
    const bodyFatVal = num(bodyFat);
    const cinturaVal = num(cintura);
    const quadrilVal = num(quadril);

    if (weightVal === null && bodyFatVal === null && !photoFile) {
      setErrorMsg('Informe ao menos o peso, o % de gordura ou uma foto.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    // 2) Medidas
    const measurements: Record<string, number> = {};
    if (cinturaVal !== null) measurements.cintura = cinturaVal;
    if (quadrilVal !== null) measurements.quadril = quadrilVal;

    // MODO LOCAL: salva apenas neste navegador (sem backend).
    if (isLocalDemoActive()) {
      // Parte da semente de exemplo (como nos exames); no original a lista começava vazia
      // e o primeiro registro apagava o histórico de demonstração do gráfico.
      const list =
        readLocalList<Record<string, unknown>>(LOCAL_PROGRESS_KEY) ??
        (localProgressSeed.map((r) => ({ ...r })) as Record<string, unknown>[]);
      list.push({
        taken_at: new Date().toISOString(),
        weight_kg: weightVal,
        body_fat_pct: bodyFatVal,
        measurements,
        notes: notes.trim() || null,
      });
      writeLocalList(LOCAL_PROGRESS_KEY, list);
      setSuccessMsg('Progresso salvo (modo local).');
      reset();
      onSaved();
      setSaving(false);
      return;
    }

    try {
      // 1) Foto: comprimida e guardada como data URL no próprio documento
      // (o Cloud Storage do Firebase exige plano pago).
      let imageData: string | null = null;
      if (photoFile) {
        try {
          imageData = await compressImageToDataUrl(photoFile);
        } catch (e) {
          throw new Error(`Falha ao enviar a foto: ${e instanceof Error ? e.message : 'erro desconhecido'}`);
        }
      }

      // 3) Grava no banco com a data real de hoje
      const id = Date.now();
      try {
        await setUserDoc(userId, 'progress_entries', String(id), {
          id,
          user_id: userId,
          weight_kg: weightVal,
          body_fat_pct: bodyFatVal,
          measurements,
          image_url: imageData,
          notes: notes.trim() || null,
          taken_at: new Date().toISOString(),
        });
      } catch (e) {
        throw new Error(`Falha ao salvar: ${e instanceof Error ? e.message : 'erro desconhecido'}`);
      }

      setSuccessMsg('Progresso salvo com sucesso!');
      reset();
      onSaved();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Não foi possível salvar o progresso.');
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    'w-full rounded-lg border border-background-300 bg-background-50 px-3 py-2 text-sm text-foreground-800 focus:border-primary-400 focus:outline-none';

  return (
    <div>
      <p className="mb-4 text-sm text-foreground-600">
        Registre uma nova foto de progresso com peso e medidas. Tudo é salvo no seu histórico
        com a <span className="font-semibold text-foreground-900">data real de hoje</span> e
        alimenta automaticamente os gráficos e o corpo 3D.
      </p>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-[220px_1fr]">
        {/* foto */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-foreground-600">Foto de progresso</label>
          <button
            onClick={() => fileRef.current?.click()}
            className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border-2 border-dashed border-background-300 bg-background-50 transition hover:border-primary-400 hover:bg-background-100"
          >
            {photoPreview ? (
              <img
                src={photoPreview}
                alt="Prévia da foto de progresso"
                className="h-full w-full object-cover object-top"
              />
            ) : (
              <>
                <i className="ri-camera-line text-3xl text-foreground-400"></i>
                <span className="px-4 text-center text-xs text-foreground-500">
                  Clique para enviar uma foto (frente)
                </span>
              </>
            )}
          </button>
          {photoPreview && (
            <button
              onClick={() => {
                setPhotoFile(null);
                setPhotoPreview(null);
              }}
              className="mt-2 flex w-full items-center justify-center gap-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium text-foreground-500 transition hover:bg-background-100"
            >
              <i className="ri-delete-bin-line"></i>
              Remover foto
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhoto}
          />
        </div>

        {/* campos */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground-600">Peso (kg)</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                placeholder="ex.: 78,5"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground-600">Gordura corporal (%)</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                placeholder="ex.: 16,2"
                value={bodyFat}
                onChange={(e) => setBodyFat(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground-600">Cintura (cm)</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                placeholder="ex.: 84"
                value={cintura}
                onChange={(e) => setCintura(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground-600">Quadril (cm)</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                placeholder="ex.: 96"
                value={quadril}
                onChange={(e) => setQuadril(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground-600">Observações (opcional)</label>
            <textarea
              maxLength={500}
              rows={3}
              placeholder="Como você está se sentindo? Energia, sono, treino..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={`${inputClass} resize-none`}
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] text-foreground-400">
              {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex items-center gap-2 whitespace-nowrap rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-background-50 transition hover:bg-primary-600 disabled:opacity-50 dark:text-foreground-950"
            >
              <i className={saving ? 'ri-loader-4-line animate-spin' : 'ri-save-line'}></i>
              {saving ? 'Salvando...' : 'Salvar progresso'}
            </button>
          </div>

          {errorMsg && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{errorMsg}</p>
          )}
          {successMsg && (
            <p className="rounded-lg bg-primary-100 px-3 py-2 text-sm text-primary-700">{successMsg}</p>
          )}
        </div>
      </div>
    </div>
  );
}