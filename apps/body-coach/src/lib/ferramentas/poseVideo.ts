// Detector de pose em vídeo (MediaPipe Pose Landmarker "lite", grátis, roda no celular).
import type { P } from './contadorReps';

const VERSAO = '0.10.14';
const WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSAO}/wasm`;
const MODELO = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

export type DetectorVideo = { detectForVideo: (v: HTMLVideoElement, t: number) => { landmarks: P[][] } };
let carregando: Promise<DetectorVideo> | null = null;

export function detectorVideo(): Promise<DetectorVideo> {
  carregando ??= (async () => {
    const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision');
    const arquivos = await FilesetResolver.forVisionTasks(WASM);
    const criar = (delegate: 'GPU' | 'CPU') => PoseLandmarker.createFromOptions(arquivos, {
      baseOptions: { modelAssetPath: MODELO, delegate },
      runningMode: 'VIDEO',
      numPoses: 1,
    });
    // Placa de vídeo quando o celular deixa (mais rápido); senão, processador.
    return (await criar('GPU').catch(() => criar('CPU'))) as unknown as DetectorVideo;
  })().catch((e) => {
    carregando = null;
    throw e;
  });
  return carregando;
}
