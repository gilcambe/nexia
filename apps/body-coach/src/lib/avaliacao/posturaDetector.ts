// Detector de pontos do corpo (MediaPipe Pose Landmarker "lite"): carregado só quando o aluno pede a
// checagem de postura. Roda no próprio celular; a foto não sai do aparelho.
import type { Ponto } from './postura.ts';

const VERSAO = '0.10.14';
const WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSAO}/wasm`;
const MODELO = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

type Detector = { detect: (img: HTMLImageElement) => { landmarks: Ponto[][] } };
let carregando: Promise<Detector> | null = null;

function detector(): Promise<Detector> {
  carregando ??= (async () => {
    const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision');
    const arquivos = await FilesetResolver.forVisionTasks(WASM);
    return (await PoseLandmarker.createFromOptions(arquivos, {
      baseOptions: { modelAssetPath: MODELO, delegate: 'CPU' },
      runningMode: 'IMAGE',
      numPoses: 1,
    })) as unknown as Detector;
  })().catch((e) => {
    carregando = null;
    throw e;
  });
  return carregando;
}

function imagem(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, erro) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => erro(new Error('Não consegui abrir a foto.'));
    img.src = src;
  });
}

export async function pontosDaFoto(src: string): Promise<{ pontos: Ponto[] | null; largura: number; altura: number }> {
  const [d, img] = await Promise.all([detector(), imagem(src)]);
  const r = d.detect(img);
  return { pontos: r.landmarks?.[0] ?? null, largura: img.naturalWidth, altura: img.naturalHeight };
}
