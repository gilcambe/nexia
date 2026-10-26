import { useState } from 'react';
import { resizeImageToFile, needsResize } from '../utils/imageResize';

export interface ChatInputProps {
  onSend: (files: File[], text: string) => void | Promise<void>;
  disabled?: boolean;
}

export default function ChatInput({ onSend, disabled = false }: ChatInputProps) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [processingImages, setProcessingImages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageStatus, setImageStatus] = useState<{[key: string]: string}>({});

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
    setProcessingImages(true);
    setError(null);
    setImageStatus({});
    
    try {
      const resized: File[] = [];
      
      for (const file of files) {
        const fileId = file.name + file.size + file.lastModified;
        
        try {
          if (!file.type.startsWith('image/')) {
            setError(`"${file.name}" não é uma imagem`);
            continue;
          }
          
          // Verifica se precisa redimensionar
          const needsResizing = await needsResize(file, 1024);
          
          if (needsResizing) {
            setImageStatus(prev => ({...prev, [fileId]: 'Redimensionando...'}));
            const resizedFile = await resizeImageToFile(file, {
              maxDimension: 1024,
              quality: 0.8,
              outputFormat: 'webp',
            });
            resized.push(resizedFile);
            setImageStatus(prev => ({...prev, [fileId]: '✓ Redimensionado'}));
          } else {
            setImageStatus(prev => ({...prev, [fileId]: '✓ Já no tamanho correto'}));
            resized.push(file);
          }
        } catch (err) {
          setError(`Erro ao processar "${file.name}": ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
          setImageStatus(prev => ({...prev, [fileId]: '✗ Falhou'}));
        }
      }
      
      if (resized.length > 0) {
        await onSend(resized, text.trim());
        setText('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar imagens');
    } finally {
      setSending(false);
      setProcessingImages(false);
      setTimeout(() => setImageStatus({}), 3000); // Limpa status após 3 segundos
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
          disabled={disabled || processingImages}
          style={{ display: 'none' }}
        />
        {processingImages ? '⏳' : '📷'}
      </label>
      <input
        type="text"
        value={text}
        onChange={handleChange}
        placeholder="Escreva uma mensagem ou anexe uma imagem…"
        disabled={disabled || sending || processingImages}
        className="text-input"
        autoComplete="off"
      />
      <button
        type="submit"
        disabled={disabled || sending || processingImages || !text.trim()}
        className="send-button"
      >
        {sending ? 'Enviando...' : 'Enviar'}
      </button>
      {error && <span className="error" role="alert">{error}</span>}
      
      {/* Status do processamento de imagens */}
      {Object.keys(imageStatus).length > 0 && (
        <div className="image-status" role="status">
          {Object.entries(imageStatus).map(([id, status]) => (
            <div key={id} className="image-status-item">
              <span className="status-icon">{status.includes('✓') ? '✓' : status.includes('✗') ? '✗' : '⏳'}</span>
              <span>{status}</span>
            </div>
          ))}
        </div>
      )}
    </form>
  );
}
