export interface ResizeOptions {
  maxDimension?: number;
  quality?: number;
  outputFormat?: 'webp' | 'jpeg';
}

const DEFAULT_OPTIONS: Required<ResizeOptions> = {
  maxDimension: 1024,
  quality: 0.8,
  outputFormat: 'webp',
};

/**
 * Redimensiona um arquivo de imagem para no máximo maxDimension no maior lado,
 * mantém a proporção e converte para WebP ou JPEG comprimido.
 * Retorna um Blob pronto para upload.
 */
export async function resizeImage(
  file: File,
  options: ResizeOptions = {}
): Promise<Blob> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Valida se é imagem
  if (!file.type.startsWith('image/')) {
    throw new Error('Arquivo não é uma imagem');
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const { width, height } = img;
      const maxDim = opts.maxDimension;

      // Calcula novas dimensões mantendo proporção
      let newWidth = width;
      let newHeight = height;

      if (width > height) {
        if (width > maxDim) {
          newWidth = maxDim;
          newHeight = Math.round((height * maxDim) / width);
        }
      } else {
        if (height > maxDim) {
          newHeight = maxDim;
          newWidth = Math.round((width * maxDim) / height);
        }
      }

      // Se já está dentro do limite, apenas converte o formato se necessário
      if (newWidth === width && newHeight === height && file.type.includes(opts.outputFormat)) {
        // Tenta comprimir mesmo sem redimensionar
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Falha ao criar canvas'));
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(
          (blob) => blob ? resolve(blob) : reject(new Error('Falha ao gerar blob')),
          `image/${opts.outputFormat}`,
          opts.quality
        );
        return;
      }

      // Redimensiona no canvas
      const canvas = document.createElement('canvas');
      canvas.width = newWidth;
      canvas.height = newHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Falha ao criar canvas'));

      // Suaviza a imagem redimensionada
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, newWidth, newHeight);

      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('Falha ao gerar blob')),
        `image/${opts.outputFormat}`,
        opts.quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Falha ao carregar imagem'));
    };

    img.src = url;
  });
}

/**
 * Versão simplificada que retorna um File com nome .webp/.jpg
 */
export async function resizeImageToFile(
  file: File,
  options: ResizeOptions = {}
): Promise<File> {
  const blob = await resizeImage(file, options);
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const ext = opts.outputFormat === 'webp' ? 'webp' : 'jpg';
  const name = file.name.replace(/\.[^.]+$/, '') + '.' + ext;
  return new File([blob], name, { type: `image/${opts.outputFormat}` });
}

/**
 * Verifica se o arquivo precisa de redimensionamento
 */
export function needsResize(file: File, maxDimension = 1024): Promise<boolean> {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) return resolve(false);
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img.width > maxDimension || img.height > maxDimension);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(false);
    };
    img.src = url;
  });
}
