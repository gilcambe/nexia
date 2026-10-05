export interface ExamItem {
  id: number;
  exam_type: string | null;
  title: string;
  file_url: string | null;
  notes: string | null;
  taken_at: string;
  signedUrl: string | null;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ExamList({
  exams,
  onDelete,
}: {
  exams: ExamItem[];
  onDelete: (id: number) => void;
}) {
  if (exams.length === 0) {
    return (
      <p className="rounded-lg bg-background-100/70 p-6 text-center text-sm text-foreground-500">
        Nenhum exame enviado ainda. Envie o primeiro acima.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {exams.map((e) => (
        <div
          key={e.id}
          className="flex items-center gap-4 rounded-xl border border-background-200 bg-background-50 px-4 py-3"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
            <i className="ri-file-text-line text-lg"></i>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-medium text-foreground-900">{e.title}</p>
              {e.exam_type && (
                <span className="rounded-full bg-secondary-100 px-2 py-0.5 text-[10px] font-semibold text-secondary-900">
                  {e.exam_type}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[11px] text-foreground-400">{formatDate(e.taken_at)}</p>
            {e.notes && <p className="mt-0.5 truncate text-xs text-foreground-500">{e.notes}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {e.signedUrl && (
              <a
                href={e.signedUrl}
                target="_blank"
                rel="noreferrer"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground-500 transition hover:bg-background-100 hover:text-foreground-700"
                aria-label="Abrir exame"
                title="Abrir exame"
              >
                <i className="ri-external-link-line"></i>
              </a>
            )}
            <button
              onClick={() => onDelete(e.id)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground-400 transition hover:bg-background-200 hover:text-foreground-700"
              aria-label="Remover exame"
            >
              <i className="ri-delete-bin-line"></i>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}