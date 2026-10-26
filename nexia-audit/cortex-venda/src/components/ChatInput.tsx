import { useState } from 'react';
import { resizeImageToFile } from '../utils/imageResize';

export interface ChatInputProps {
  onSend: (files: File[], text: string) => void | Promise<void>;
  disabled?: boolean;
}

export default function ChatInput({ onSend, disabled = false }: ChatInputProps) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!text.trim()) return;
    setSending(true);
    try {
      await onSend([], text.trim());
      setText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar');
    } finally {
      setSending(false);
    }
  };

  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setSending(true);
    setError(null);
    try {
      const resized: File[] = [];
      for (const file of files) {
        if (!file.type.startsWith('image/')) {
          setError('Arquivo não é uma imagem');
          return;
        }
        const resizedFile = await resizeImage(file, {
          maxDimension: 1024,
          quality: 0.8,
          outputFormat: 'webp',
        });
        resized.push(resizedFile as unknown as File);
      }
      await onSend(resized, text.trim());
      setText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao processar imagem');
    } finally {
      setSending(false);
      e.target.value = '';
    }
  };

  return (
    <form onSubmit={handleSubmit} className="chat-input" aria-label="Enviar mensagem">
      <label htmlFor="image-upload" className="image-button" aria-hidden="true">
        <input
          id="image-upload"
          type="file"
          accept="image/*"
          multiple
          onChange={handleImage}
          disabled={disabled}
          style={{ display: 'none' }}
        />
        📷
      </label>
      <input
        type="text"
        value={text}
        onChange={handleChange}
        placeholder="Escreva uma mensagem ou anexe uma imagem…"
        disabled={disabled || sending}
        className="text-input"
        autoComplete="off"
      />
      <button
        type="submit"
        disabled={disabled || sending || !text.trim()}
        className="send-button"
      >
        Enviar
      </button>
      {error && <span className="error" role="alert">{error}</span>}
    </form>
  );
}
