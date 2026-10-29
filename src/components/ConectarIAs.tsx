import { useModo } from './celular';

export default function ConectarIAs() {
  const { naFolha } = useModo();

  return (
    <div className="flex flex-col gap-4">
      {!naFolha && <h2 className="text-2xl font-bold">🔌 Conectar IAs</h2>}
      {/* Rest of the component */}
    </div>
  );
}
