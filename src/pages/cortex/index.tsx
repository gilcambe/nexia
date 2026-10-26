import PricingTable from '@/components/PricingTable';

export default function Cortex() {
  return (
    <div className="min-h-screen bg-white text-foreground-900">
      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-3xl font-bold mb-6 text-foreground-900">Cortex</h1>
        <PricingTable />
      </main>
    </div>
  );
}
