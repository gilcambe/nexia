import axios from 'axios';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

// Lista dos IDs que precisam de demo
const ids = [
  'crucifixo-com-halteres',
  'remada-invertida-na-mesa',
  'superman',
  'flexao-pike',
  'elevacao-frontal-com-halter',
  'crucifixo-inverso-com-halteres',
  'triceps-coice-com-halter',
  'abducao-de-quadril-deitada',
  'coice-em-quadras-apoios',
  'prancha-lateral',
  'abdominal-curto-no-solo',
];

const BASE_URL = 'https://free-exercise-db.com/exercises';
const OUTPUT_DIR = path.resolve(__dirname, '..', 'public', 'exercicios');

async function downloadAndCompress(id: string, frame: number) {
  const url = `${BASE_URL}/${id}/frame/${frame}`; // Ex.: https://free-exercise-db.com/exercises/crucifixo-com-halteres/frame/0
  const response = await axios.get(url, { responseType: 'arraybuffer' });
  const imageBuffer = Buffer.from(response.data);
  const webpBuffer = await sharp(imageBuffer)
    .webp({ quality: 70 })
    .toBuffer();
  const outputPath = path.join(OUTPUT_DIR, `${id}-${frame}.webp`);
  fs.writeFileSync(outputPath, webpBuffer);
  console.log(`Saved ${outputPath} (${webpBuffer.length} bytes)`);
}

async function run() {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  for (const id of ids) {
    await Promise.all([downloadAndCompress(id, 0), downloadAndCompress(id, 1)]);
  }
}

run().catch(err => console.error(err));