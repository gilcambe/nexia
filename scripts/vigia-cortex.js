#!/usr/bin/env node
'use strict';
// Vigia do Cortex: se a fila parou, abre a issue "cortex-alerta" para o dono (o GitHub manda e-mail).

const REPO = process.env.REPO || 'gilcambe/nexia';
const DONO = process.env.DONO || 'gilcambe';
const PAINEL = 'https://nexia.gcbezerra.workers.dev/meu-cortex';

async function gh(token, method, caminho, body) {
  const r = await fetch(`https://api.github.com/repos/${REPO}/${caminho}`, {,
    {
      method: method,
      headers: {
        Accept: 'application/vnd.github.v3+json',
        Authorization: `token ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  if (!r.ok) {
    throw new Error(`${method} ${caminho} ${r.status} ${await r.text()}`);
  }
  return r.json();
}

// TODO: Implementar a lógica para verificar a fila e abrir a issue
// Este é um placeholder para o restante do script que será implementado futuramente.
// O objetivo principal agora é fazer com que o arquivo compile.