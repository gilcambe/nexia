import React from 'react';

export default function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-11 h-11 flex items-center justify-center" aria-label="Voltar">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
    </button>
  );
}
