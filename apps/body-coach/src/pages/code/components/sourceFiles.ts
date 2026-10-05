// Cópia fiel do código-fonte do app, lida na hora do build (import.meta.glob ?raw).
// Alimenta a tela "Código & Especificações". Este próprio arquivo fica de fora, como no original.
export interface SourceFile {
  path: string;
  label: string;
  group: string;
  language: string;
  lines: number;
  bytes: number;
  code: string;
}

const srcFiles = import.meta.glob(
  ['/src/**/*.{ts,tsx,css,md}', '!/src/pages/code/components/sourceFiles.ts'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

const rootFiles = import.meta.glob(
  [
    '/eslint-rules/*.js',
    '/eslint.config.ts',
    '/index.html',
    '/package.json',
    '/postcss.config.js',
    '/tailwind.config.ts',
    '/tsconfig*.json',
    '/vite-env.d.ts',
    '/vite.config.ts',
  ],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

export const GROUP_ORDER = [
  'config raiz',
  'router',
  'lib',
  'hooks',
  'components/base',
  'components/feature',
  'pages',
  'mocks',
  'i18n',
  'outros',
];

function languageOf(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'ts' || ext === 'tsx') return 'typescript';
  if (ext === 'css') return 'css';
  if (ext === 'json') return 'json';
  if (ext === 'html') return 'html';
  if (ext === 'md') return 'markdown';
  if (ext === 'js' || ext === 'jsx') return 'javascript';
  return 'texto';
}

function groupOf(path: string): string {
  if (!path.startsWith('src/')) return 'config raiz';
  const parts = path.split('/');
  const top = parts[1] ?? 'outros';
  return (top === 'components' || top === 'pages') && parts.length > 3 ? `${top}/${parts[2]}` : top;
}

function toSourceFile(rawPath: string, code: string): SourceFile {
  const path = rawPath.replace(/^\//, '');
  return {
    path,
    label: path.split('/').pop() ?? path,
    group: groupOf(path),
    language: languageOf(path),
    lines: code.split('\n').length,
    bytes: code.length,
    code,
  };
}

export const sourceFiles: SourceFile[] = [
  ...Object.entries(rootFiles).map(([p, c]) => toSourceFile(p, c)),
  ...Object.entries(srcFiles).map(([p, c]) => toSourceFile(p, c)),
].sort((a, b) => a.path.localeCompare(b.path));

export const totalLines = sourceFiles.reduce((acc, f) => acc + f.lines, 0);
