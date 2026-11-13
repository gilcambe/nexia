// CRUD simples: usa a API /api/dados e, se falhar, guarda no localStorage.
const campos = '{{campos}}';
const nome = '{{nome}}';
const API = '/api/dados';
const CHAVE = nome + '_dados';

function listaCampos() {
  return campos.split(',').map((s) => s.trim()).filter(Boolean);
}

function validarRegistro(r) {
  if (!r || typeof r !== 'object' || Array.isArray(r)) return false;
  return listaCampos().every((c) => {
    const v = r[c];
    return v !== undefined && v !== null && String(v).trim() !== '';
  });
}

function lerLocal() {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE));
    return Array.isArray(v) ? v : [];
  } catch (e) {
    return [];
  }
}

function salvarLocal(lista) {
  localStorage.setItem(CHAVE, JSON.stringify(lista));
}

async function chamar(metodo, url, corpo) {
  const opcoes = { method: metodo };
  if (corpo !== undefined) {
    opcoes.headers = { 'Content-Type': 'application/json' };
    opcoes.body = JSON.stringify(corpo);
  }
  const resp = await fetch(url, opcoes);
  if (!resp || !resp.ok) throw new Error('API indisponível');
  return resp.json();
}

async function listar() {
  try {
    const dados = await chamar('GET', API);
    if (Array.isArray(dados)) return dados;
    throw new Error('resposta inválida');
  } catch (e) {
    return lerLocal();
  }
}

async function criar(registro) {
  if (!validarRegistro(registro)) throw new Error('Registro inválido');
  try {
    return await chamar('POST', API, registro);
  } catch (e) {
    const lista = lerLocal();
    lista.push(registro);
    salvarLocal(lista);
    return registro;
  }
}

async function editar(registro) {
  if (!validarRegistro(registro)) throw new Error('Registro inválido');
  try {
    return await chamar('PUT', API + '/' + encodeURIComponent(registro.id), registro);
  } catch (e) {
    const lista = lerLocal().map((x) => (x.id === registro.id ? registro : x));
    salvarLocal(lista);
    return registro;
  }
}

async function remover(id) {
  try {
    return await chamar('DELETE', API + '/' + encodeURIComponent(id));
  } catch (e) {
    salvarLocal(lerLocal().filter((x) => x.id !== id));
    return true;
  }
}

const crud = { validarRegistro, listar, criar, editar, remover };
if (typeof module !== 'undefined' && module.exports) module.exports = crud;
if (typeof window !== 'undefined') window.crud = crud;
