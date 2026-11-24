import { Link } from "react-router-dom";

// Endereço que não existe: mensagem simples em português e caminho de volta.
export default function NotFound() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background-50 px-6 text-center">
      <i className="ri-compass-3-line text-5xl text-primary-500"></i>
      <h1 className="font-heading text-xl font-bold text-foreground-950">Página não encontrada</h1>
      <p className="text-sm text-foreground-600">Esse endereço não existe no Body Coach.</p>
      <Link to="/" className="rounded-full bg-primary-500 px-6 py-3 text-sm font-semibold text-background-50" data-testid="voltar-inicio">
        Voltar para o início
      </Link>
    </div>
  );
}
