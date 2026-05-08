#!/usr/bin/env bash
set -e

echo "[NEXIA] Verificando build..."
if [ ! -f "out/index.html" ]; then
  echo "[NEXIA] Build necessário — rodando npm install && npm run build"
  npm install
  npm run build
  echo "[NEXIA] Build concluído."
else
  echo "[NEXIA] out/index.html encontrado, pulando build."
fi

echo "[NEXIA] Iniciando servidor..."
node server.js
