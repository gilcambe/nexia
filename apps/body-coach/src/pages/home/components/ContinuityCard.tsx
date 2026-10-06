import { Link } from 'react-router-dom';
import Card from '@/components/base/Card';

export default function ContinuityCard() {
  return (
    <Card padding="p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <i className="ri-history-line text-lg text-primary-500"></i>
          <h2 className="font-heading text-base font-semibold text-foreground-950">Último treino</h2>
        </div>
      </div>

      <div className="py-8 text-center">
        <p className="text-sm text-foreground-500">Nenhum treino registrado ainda. Seus treinos aparecem aqui.</p>
        <div className="mt-4">
          <Link
            to="/workout"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 transition hover:bg-primary-600"
          >
            Começar treino
          </Link>
        </div>
      </div>
    </Card>
  );
}