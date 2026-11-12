'use strict';
import React from 'react';

export function AlertNotification({ alertas = [], onDispararEmail }) {
  if (!Array.isArray(alertas) || alertas.length === 0) return null;

  return (
    <div className="alert-notification-container p-4 bg-amber-50 border border-amber-200 rounded-md shadow-sm my-2">
      <h3 className="text-amber-800 font-bold text-sm mb-2">Notificações de Alerta</h3>
      <ul className="list-disc pl-5 space-y-1">
        {alertas.map((a, idx) => (
          <li key={idx} className="text-xs text-amber-900">{a.texto || a.mensagem}</li>
        ))}
      </ul>
      {typeof onDispararEmail === 'function' && (
        <button 
          onClick={onDispararEmail} 
          className="mt-3 px-3 py-1 bg-amber-600 text-white text-xs rounded hover:bg-amber-700 transition"
        >
          Enviar e-mail de alerta
        </button>
      )}
    </div>
  );
}
export default AlertNotification;