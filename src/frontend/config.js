// src/frontend/config.js

// Configurações globais do frontend do Cortex.
// Mantido mínimo: exporta apenas constantes de ambiente.
export const API_URL = import.meta.env.VITE_API_URL || '/api';
export const APP_NAME = 'Cortex';
export default { API_URL, APP_NAME };
