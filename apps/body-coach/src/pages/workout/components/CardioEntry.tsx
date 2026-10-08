import { useState, ChangeEvent, FormEvent } from 'react';
import { cardioDoTexto, CardioAtividade } from '@/lib/cardioDoTexto';
import { perguntar } from '@/lib/coachAI';

export interface CardioEntryProps {
  onSubmit?: (atividades: CardioAtividade[], fotoNome?: string) => void;
}

export function CardioEntry({ onSubmit }: CardioEntryProps) {
  const [texto, setTexto] = useState('');
  const [fotoNome, setFotoNome] = useState<string | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fotoBase64, setFotoBase64] = useState<string | null>(null);

  const handleTextoChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setTexto(e.target.value);
  };

  const handleFotoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFotoNome(file.name);
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        setFotoPreview(result);
        setFotoBase64(result);
      };
      reader.readAsDataURL(file);
    } else {
      setFotoNome(null);
      setFotoPreview(null);
      setFotoBase64(null);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!texto.trim() && !fotoNome) return;

    setLoading(true);
    try {
      let textoAtual = texto;
      if (!textoAtual.trim() && fotoBase64) {
        const respostaIa = await perguntar({
          pergunta: 'Extraia os dados de cardio (exercício, tempo em minutos, calorias se houver) desta foto do painel do aparelho e retorne em formato de texto descritivo.',
          imagem: fotoBase64
        });
        if (respostaIa) {
          textoAtual = respostaIa;
          setTexto(respostaIa);
        }
      }

      const atividades = cardioDoTexto(textoAtual);
      onSubmit?.(atividades, fotoNome || undefined);

      // Reset form after submit
      setTexto('');
      setFotoNome(null);
      setFotoPreview(null);
      setFotoBase64(null);
    } catch (err) {
      console.error('Erro ao processar cardio:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="cardio-texto" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Cardio
          </label>
          <textarea
            id="cardio-texto"
            value={texto}
            onChange={handleTextoChange}
            placeholder="Conte seu cardio, ex.: 30 min de escada e 10 min de esteira"
            rows={3}
            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors resize-y"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Foto do painel (opcional)
          </label>
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <label className="flex items-center gap-2 px-4 py-2.5 bg-primary-50 dark:bg-primary-900/30 border border-primary-200 dark:border-primary-800 rounded-lg cursor-pointer hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors">
              <i className="ri-camera-line text-primary-600 dark:text-primary-400 text-xl" />
              <span className="text-sm font-medium text-primary-700 dark:text-primary-300">Anexar foto do painel</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFotoChange}
                className="sr-only"
                id="cardio-foto"
                disabled={loading}
              />
            </label>
            {fotoNome && (
              <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
                <i className="ri-file-text-line" />
                {fotoNome}
              </span>
            )}
          </div>
          {fotoPreview && (
            <div className="mt-3 relative w-full max-w-xs">
              <img
                src={fotoPreview}
                alt="Prévia da foto do painel"
                className="w-full h-auto rounded-lg border border-gray-200 dark:border-gray-600 object-cover aspect-video"
              />
              <button
                type="button"
                onClick={() => {
                  setFotoNome(null);
                  setFotoPreview(null);
                  setFotoBase64(null);
                }}
                className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                aria-label="Remover foto"
              >
                <i className="ri-close-line text-sm" />
              </button>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={loading || (!texto.trim() && !fotoNome)}
          className="w-full px-6 py-3 bg-primary-600 text-white font-semibold rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <i className="ri-loader-4-line animate-spin" />
              Registrando...
            </>
          ) : (
            <>
              <i className="ri-save-line" />
              Registrar
            </>
          )}
        </button>
      </form>
    </div>
  );
}
