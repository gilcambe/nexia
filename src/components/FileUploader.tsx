import React, { useState, useRef } from 'react';

interface FileUploaderProps {
  onFileSelect: (file: File, content: string) => void;
  acceptedTypes?: string[];
  maxSize?: number; // in bytes
}

const FileUploader: React.FC<FileUploaderProps> = ({ 
  onFileSelect, 
  acceptedTypes = ['.txt', '.pdf', '.doc', '.docx'],
  maxSize = 700 * 1024 // 700KB default
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFile = async (file: File) => {
    setError(null);
    setIsProcessing(true);

    // Validate file size
    if (file.size > maxSize) {
      setError(`Arquivo grande demais. Tamanho máximo: ${(maxSize / 1024 / 1024).toFixed(1)}MB`);
      setIsProcessing(false);
      return;
    }

    // Validate file type
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!acceptedTypes.includes(fileExtension)) {
      setError(`Tipo de arquivo não suportado. Tipos aceitos: ${acceptedTypes.join(', ')}`);
      setIsProcessing(false);
      return;
    }

    try {
      // Read file content
      const content = await readFileContent(file);
      onFileSelect(file, content);
    } catch (err) {
      setError('Erro ao ler o arquivo');
      console.error('File reading error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result;
        if (typeof result === 'string') {
          resolve(result);
        } else {
          reject(new Error('Failed to read file content'));
        }
      };
      reader.onerror = () => reject(new Error('File reading error'));
      
      if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
        reader.readAsText(file);
      } else {
        // For PDF and other binary files, we'll need to process them differently
        // For now, just read as text for simplicity
        reader.readAsText(file);
      }
    });
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full">
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          isDragging 
            ? 'border-nexia-cyan bg-nexia-cyan/10' 
            : isProcessing 
              ? 'border-gray-300 bg-gray-50' 
              : 'border-gray-300 hover:border-nexia-cyan hover:bg-nexia-cyan/5'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileInput}
          accept={acceptedTypes.join(',')}
          className="hidden"
        />
        
        {isProcessing ? (
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nexia-cyan mb-2"></div>
            <p className="text-gray-600 dark:text-gray-300">Processando arquivo...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <svg 
              className="w-12 h-12 text-gray-400 mb-3" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" 
              />
            </svg>
            <p className="text-gray-600 dark:text-gray-300 mb-2">
              {isDragging ? 'Solte o arquivo aqui' : 'Clique ou arraste arquivos para upload'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Arquivos suportados: {acceptedTypes.join(', ')} (máx. {(maxSize / 1024 / 1024).toFixed(1)}MB)
            </p>
          </div>
        )}
      </div>
      
      {error && (
        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}
    </div>
  );
};

export default FileUploader;