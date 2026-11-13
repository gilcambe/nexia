// Cadastro simples: listar, buscar, criar, editar e apagar. Guarda na API /api/dados do projeto;
// se a API não responder, guarda no próprio navegador (localStorage) e avisa.
(function () {
  'use strict';
  var API = '/api/dados';
  var LOCAL = 'crud-registros';

  /** "nome, telefone,email" -> ["nome","telefone","email"] (sem vazios e sem repetidos). */
  function lerCampos(texto) {
    var out = [];
    String(texto || '').split(',').forEach(function (c) { c = c.trim(); if (c && out.indexOf(c) < 0) out.push(c); });
    return out;
  }

  /** Confere se o registro tem todos os campos obrigatórios preenchidos. */
  function validarRegistro(r, campos) {
    var faltam = [];
    (campos || []).forEach(function (c) { if (!r || r[c] == null || String(r[c]).trim() === '') faltam.push(c); });
    return { ok: faltam.length === 0, faltam: faltam };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { validarRegistro: validarRegistro, lerCampos: lerCampos };
  if (typeof document === 'undefined') return;

  var $ = function (id) { return document.getElementById(id); };
  var form = $('form');
  var campos = lerCampos(form.getAttribute('data-campos'));
  var registros = [];
  var naNuvem = true;
  var aviso = function (t, erro) { $('aviso').textContent = t || ''; $('aviso').className = erro ? 'erro' : ''; };
  var rotulo = function (c) { return c.charAt(0).toUpperCase() + c.slice(1).replace(/[_-]/g, ' '); };

  function local(lista) {
    try {
      if (lista) localStorage.setItem(LOCAL, JSON.stringify(lista));
      return JSON.parse(localStorage.getItem(LOCAL) || '[]');
    } catch (e) { return lista || []; }
  }
  function api(metodo, corpo, id) {
    return fetch(API + (id ? '/' + encodeURIComponent(id) : ''), {
      method: metodo, headers: { 'Content-Type': 'application/json' }, body: corpo ? JSON.stringify(corpo) : undefined,
    }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.status === 204 ? null : r.json(); });
  }

  function montarForm() {
    $('campos').innerHTML = '';
    campos.forEach(function (c) {
      var l = document.createElement('label'); l.textContent = rotulo(c);
      var i = document.createElement('input'); i.name = c; i.required = true;
      l.appendChild(i); $('campos').appendChild(l);
    });
    var tr = document.createElement('tr');
    campos.concat(['']).forEach(function (c) { var th = document.createElement('th'); th.textContent = c ? rotulo(c) : 'Ações'; tr.appendChild(th); });
    $('cab').innerHTML = ''; $('cab').appendChild(tr);
  }

  function botao(texto, classe, acao) {
    var b = document.createElement('button'); b.type = 'button'; b.textContent = texto;
    if (classe) b.className = classe;
    b.onclick = acao; return b;
  }

  function mostrar() {
    var termo = $('busca').value.trim().toLowerCase();
    var lista = registros.filter(function (r) {
      return !termo || campos.some(function (c) { return String(r[c] || '').toLowerCase().indexOf(termo) >= 0; });
    });
    $('linhas').innerHTML = '';
    lista.forEach(function (r) {
      var tr = document.createElement('tr');
      campos.forEach(function (c) { var td = document.createElement('td'); td.textContent = r[c] == null ? '' : String(r[c]); tr.appendChild(td); });
      var td = document.createElement('td'); var div = document.createElement('div'); div.className = 'acoes';
      div.appendChild(botao('Editar', '', function () { editar(r); }));
      div.appendChild(botao('Apagar', 'leve', function () { apagar(r); }));
      td.appendChild(div); tr.appendChild(td); $('linhas').appendChild(tr);
    });
    $('vazio').style.display = registros.length ? 'none' : '';
  }

  function carregar() {
    api('GET').then(function (d) {
      registros = Array.isArray(d) ? d : (d && d.registros) || []; naNuvem = true; mostrar();
    }).catch(function () {
      naNuvem = false; registros = local(); mostrar();
      aviso('Sem conexão com o servidor: os dados estão só neste aparelho.', true);
    });
  }

  function limpar() { form.reset(); $('id').value = ''; aviso(''); }
  function editar(r) {
    campos.forEach(function (c) { form.elements[c].value = r[c] == null ? '' : r[c]; });
    $('id').value = r.id; aviso('Editando. Clique em Salvar.');
  }

  function apagar(r) {
    if (!window.confirm('Apagar este registro?')) return;
    var fim = function () {
      registros = registros.filter(function (x) { return x.id !== r.id; });
      if (!naNuvem) local(registros);
      mostrar(); aviso('Apagado.');
    };
    if (!naNuvem) { fim(); return; }
    api('DELETE', null, r.id).then(fim).catch(function () { aviso('Não consegui apagar agora. Tente de novo.', true); });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var r = {};
    campos.forEach(function (c) { r[c] = form.elements[c].value.trim(); });
    var v = validarRegistro(r, campos);
    if (!v.ok) { aviso('Preencha: ' + v.faltam.map(rotulo).join(', '), true); return; }
    var id = $('id').value;
    var fim = function (salvo) {
      salvo = salvo && salvo.id ? salvo : Object.assign({ id: id || String(Date.now()) }, r);
      registros = id ? registros.map(function (x) { return x.id === id ? salvo : x; }) : registros.concat([salvo]);
      if (!naNuvem) local(registros);
      mostrar(); limpar(); aviso('Salvo.');
    };
    if (!naNuvem) { fim(null); return; }
    (id ? api('PUT', r, id) : api('POST', r)).then(fim).catch(function () {
      naNuvem = false; fim(null); aviso('Servidor fora do ar: salvei neste aparelho.', true);
    });
  });
  $('limpar').addEventListener('click', limpar);
  $('busca').addEventListener('input', mostrar);
  montarForm();
  carregar();
})();
