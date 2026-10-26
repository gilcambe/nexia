import React from 'react';
import Footer from '@/components/Footer';

export default function CortexPage() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold mb-6">Cortex</h1>
        <p className="text-gray-600">Bem-vindo ao Cortex, sua central de automação e IA.</p>
      </main>
      <Footer />
    </div>
  );
}
