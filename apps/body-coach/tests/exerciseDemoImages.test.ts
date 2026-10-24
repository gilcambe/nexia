import fs from 'fs';
import path from 'path';
import { EXERCICIOS, IDS_COM_DEMO } from '../src/lib/exerciseDb';

test('Every exercise has its own image or a demo', () => {
  const folder = path.resolve(__dirname, '..', '..', '..', 'public', 'exercicios');
  const ids = Object.keys(EXERCICIOS);
  ids.forEach(id => {
    const hasOwn = fs.existsSync(path.join(folder, `${id}.webp`));
    const hasDemo0 = fs.existsSync(path.join(folder, `${id}-0.webp`));
    const hasDemo1 = fs.existsSync(path.join(folder, `${id}-1.webp`));
    expect(hasOwn || hasDemo0 || hasDemo1).toBeTruthy();
  });
});