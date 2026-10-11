/* NEXIA · Bezsan — motor do "Parecer completo" de um imóvel de leilão (a consultoria inteira).
   Junta a conta de viabilidade (calculo.js), o que a IA leu no edital e na matrícula, o processo no CNJ,
   a ocupação, as dívidas e os dados públicos da região, e devolve uma nota de 0 a 100 por pilar,
   os pontos de atenção, o veredito e até quanto dar de lance. Sem dependências; roda no navegador e no Node.
   Regras simples e explicadas, não é opinião jurídica: o texto sempre manda confirmar com um advogado. */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.BezsanParecer = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var PESOS = { financeiro: 30, juridico: 25, posse: 15, dividas: 15, regiao: 15 };
  var PENALIDADE = { grave: 30, atencao: 10 };

  function txt(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  function num(v) { var n = typeof v === 'string' ? Number(v.replace(/[R$\s.]/g, '').replace(',', '.')) : Number(v); return isFinite(n) && n > 0 ? n : 0; }
  function pct(x) { return (Math.round(x * 1000) / 10).toLocaleString('pt-BR') + '%'; }
  function pct1(x) { return (Math.round(x * 10) / 10).toLocaleString('pt-BR') + '%'; }
  function reais(x) { var n = Math.round(x); return (n < 0 ? '- ' : '') + 'R$ ' + Math.abs(n).toLocaleString('pt-BR'); }
  function lista(v) { return Array.isArray(v) ? v.filter(function (s) { return typeof s === 'string' && s.trim(); }) : []; }

  function pilar(id, titulo) { return { id: id, titulo: titulo, nota: 100, itens: [], peso: PESOS[id] }; }
  function ponto(p, nivel, texto, fazer) {
    p.itens.push({ nivel: nivel, texto: texto, fazer: fazer || '' });
    if (PENALIDADE[nivel]) p.nota -= PENALIDADE[nivel];
  }
  function fechar(p) { p.nota = Math.max(0, Math.min(100, Math.round(p.nota))); return p; }

  /** Tipo do leilão: judicial, extrajudicial (alienação fiduciária, Lei 9.514) ou venda direta. */
  function tipoLeilao(im) {
    var ed = im.analise_edital || {};
    var t = txt(ed.tipo_leilao || '') + ' ' + txt(im.modalidade || '');
    if (/venda_direta|venda direta|licitacao aberta|compra direta/.test(t)) return 'venda_direta';
    if (/extrajudicial|9\.?514|fiduci/.test(t)) return 'extrajudicial';
    if (/judicial/.test(t) || ed.processo || im.processo) return 'judicial';
    return '';
  }

  // ── Jurídico: ônus da matrícula, riscos do edital, situação do processo ──
  function juridico(im, tipo) {
    var p = pilar('juridico', 'Parte jurídica');
    var ed = im.analise_edital, mt = im.analise_matricula, pr = im.processo_info;
    if (!ed && !mt) ponto(p, 'atencao', 'O edital e a matrícula ainda não foram lidos.', 'Leia o edital e a matrícula atualizada (peça no cartório ou no site do leilão).');
    else if (!mt) ponto(p, 'atencao', 'A matrícula ainda não foi lida: os ônus só aparecem nela.', 'Tire a matrícula atualizada (menos de 30 dias) e leia aqui.');

    var onus = lista((mt && mt.onus) || []).concat(lista(ed && ed.onus));
    var alertas = lista(mt && mt.alertas).concat(lista(ed && ed.riscos)).concat(lista(im.alertas));
    var todos = txt(onus.concat(alertas).join(' | '));
    var visto = {};
    function regra(re, nivel, texto, fazer) { if (!visto[texto] && re.test(todos)) { visto[texto] = 1; ponto(p, nivel, texto, fazer); } }
    regra(/indisponib/, 'grave', 'Há indisponibilidade de bens registrada: o registro em seu nome pode travar até o juiz liberar.', 'Confirme no edital ou com o juiz se a indisponibilidade será cancelada com a arrematação.');
    regra(/usufruto/, 'grave', 'Há usufruto na matrícula: alguém pode ter o direito de morar ou alugar o imóvel.', 'Confira se o usufruto será cancelado ou se continua depois da compra.');
    regra(/dono diferente|proprietario diferente|nao e o executado|diferente do executado/, 'grave', 'O dono na matrícula pode não ser o devedor do processo: risco de a venda ser contestada.', 'Compare o nome do dono na matrícula com o executado no edital.');
    regra(/hipoteca/, 'atencao', 'Há hipoteca: o credor hipotecário precisa ter sido avisado do leilão (art. 889 do CPC).', 'Confira no processo se o credor hipotecário foi intimado.');
    if (tipo === 'judicial') regra(/fiduci/, 'atencao', 'Há alienação fiduciária (banco) num leilão judicial: o banco precisa ser avisado e a dívida com ele pode continuar.', 'Pergunte ao leiloeiro como fica a dívida com o banco.');
    regra(/arrolamento/, 'atencao', 'Há arrolamento fiscal (Receita Federal) na matrícula.', 'Peça a certidão da Receita e confira se o arrolamento será baixado.');
    regra(/acao (anulatoria|reivindicatoria|de usucapiao|de nulidade|pauliana|revocatoria)|usucapiao|ajuizamento de acao|existencia de acao/, 'atencao', 'Há ação judicial registrada na matrícula além do leilão.', 'Leia o número da ação na matrícula e veja o andamento no site do tribunal.');
    regra(/nao averbad|falta de averbacao|sem averbacao|construcao irregular/, 'atencao', 'A construção pode não estar averbada: regularizar custa e demora.', 'Peça na prefeitura o habite-se e a certidão de área construída.');
    regra(/area divergente|divergenc/, 'atencao', 'A área do imóvel diverge entre os documentos.', 'Compare a área da matrícula, do IPTU e do edital.');
    var penhoras = (txt(lista(mt && mt.onus && mt.onus.length ? mt.onus : ed && ed.onus).join(' | ')).match(/penhora/g) || []).length;
    if (penhoras > 1) ponto(p, 'atencao', 'Há mais de uma penhora: as outras dívidas em geral são pagas com o dinheiro do leilão (art. 908 do CPC), mas é preciso o edital dizer isso.', 'Confira no edital se as outras penhoras serão canceladas.');

    // Executado x dono da matrícula
    if (ed && ed.executado && mt && lista(mt.proprietarios).length) {
      var ex = txt(ed.executado).split(/\s+/).filter(function (w) { return w.length > 2; });
      var bate = lista(mt.proprietarios).some(function (n) { var t = txt(n); return ex.length && ex.filter(function (w) { return t.indexOf(w) >= 0; }).length >= Math.min(2, ex.length); });
      if (!bate && !visto.dono) { visto.dono = 1; ponto(p, 'grave', 'O executado do edital (' + ed.executado + ') não aparece como dono na matrícula.', 'Confirme com um advogado se a penhora vale contra o dono registrado.'); }
    }

    // Processo
    if (tipo === 'judicial') {
      if (!im.processo && !(ed && ed.processo)) ponto(p, 'atencao', 'Falta o número do processo para conferir o andamento.', 'Copie o número do processo do edital e consulte no CNJ.');
      else if (!pr) ponto(p, 'atencao', 'O processo ainda não foi consultado no CNJ.', 'Toque em "Consultar no CNJ".');
      if (pr) {
        var sinais = (pr.sinais || []).map(function (s) { return txt(s.nome); }).join(' | ');
        if (/embargo/.test(sinais)) ponto(p, 'grave', 'O processo tem embargos: a arrematação pode ser discutida ou desfeita.', 'Peça a um advogado para ler os embargos antes do lance.');
        if (/suspens|sobrest/.test(sinais)) ponto(p, 'grave', 'O processo teve suspensão: confirme que o leilão não está suspenso.', 'Ligue para o leiloeiro e confira no site do tribunal.');
        if (/nulidade|anula/.test(sinais)) ponto(p, 'grave', 'Há pedido de nulidade no processo.', 'Peça a um advogado para ler o pedido.');
        if (/agravo|apela|recurso/.test(sinais)) ponto(p, 'atencao', 'O processo tem recurso (agravo ou apelação) em andamento ou já julgado.', 'Confira se o recurso pode mudar a penhora ou o leilão.');
        if (/acordo|remi|desist|extin/.test(sinais)) ponto(p, 'atencao', 'Há sinais de acordo, remição ou extinção: o devedor pode pagar e cancelar o leilão.', 'Confira com o leiloeiro se o leilão continua de pé.');
        if (!p.itens.some(function (i) { return i.nivel === 'grave'; }) && (pr.sinais || []).length === 0) ponto(p, 'ok', 'Nenhuma movimentação de risco (embargos, suspensão, nulidade, recurso) no processo público do CNJ.');
      }
    } else if (tipo === 'extrajudicial') {
      ponto(p, 'ok', 'Leilão extrajudicial de banco (Lei 9.514): menor risco de ser anulado, desde que o devedor tenha sido avisado.', 'Confira no edital as datas da consolidação da propriedade e dos avisos ao devedor.');
    } else if (tipo === 'venda_direta') {
      ponto(p, 'ok', 'Venda direta (o banco já é o dono): sem processo para desfazer a venda.');
    }
    if (onus.length && !p.itens.some(function (i) { return i.nivel !== 'ok'; })) ponto(p, 'ok', 'Os ônus lidos são os comuns do leilão e saem com a arrematação.');
    return fechar(p);
  }

  // ── Posse: ocupado ou não, caminho, prazo e custo de desocupação ──
  function posse(im, tipo, conta) {
    var p = pilar('posse', 'Posse e ocupação');
    var ed = im.analise_edital || {};
    var ocupante = txt(ed.ocupante || '') + ' ' + txt(im.descricao || '');
    var ocupado = im.ocupado === true || ed.ocupado === true;
    var info = { ocupado: ocupado, caminho: '', prazo: '', custo: conta && conta.custos ? conta.custos.desocupacao : 0 };
    if (!ocupado && ed.ocupado === false) {
      ponto(p, 'ok', 'O imóvel está desocupado segundo o edital.', 'Visite a rua e confirme que ninguém mora lá.');
      info.caminho = 'Desocupado: recebe as chaves depois do registro.'; info.prazo = 'até 2 meses';
      return { pilar: fechar(p), info: info };
    }
    if (!ocupado) {
      ponto(p, 'atencao', 'Não está confirmado que o imóvel está desocupado (o edital não diz).', 'Visite o imóvel e pergunte aos vizinhos ou ao porteiro.');
      p.nota -= 10; info.caminho = 'Confirmar se está ocupado.';
      return { pilar: fechar(p), info: info };
    }
    if (tipo === 'extrajudicial' || tipo === 'venda_direta') {
      p.nota -= 35;
      info.caminho = 'Ação de imissão na posse (reintegração) contra quem ocupa; a lei 9.514 (art. 30) prevê desocupação liminar em 60 dias.';
      info.prazo = '4 a 12 meses';
      ponto(p, 'atencao', 'Ocupado: depois da compra é preciso entrar com ação para tirar o ocupante (prazo comum de 4 a 12 meses).', 'Reserve dinheiro para advogado e para pagar condomínio e IPTU enquanto espera.');
    } else {
      p.nota -= 30;
      info.caminho = 'Pedido de imissão na posse no próprio processo do leilão (art. 901 do CPC), com mandado do juiz.';
      info.prazo = '3 a 12 meses';
      ponto(p, 'atencao', 'Ocupado: o juiz do próprio processo manda desocupar, mas leva de 3 a 12 meses.', 'Reserve dinheiro para advogado e para pagar condomínio e IPTU enquanto espera.');
    }
    if (/inquilin|locat|alugad/.test(ocupante)) { ponto(p, 'atencao', 'Ocupado por inquilino: o contrato pode ser respeitado por 90 dias depois do aviso (Lei 8.245, art. 8).', 'Peça o contrato de aluguel e veja se está registrado na matrícula.'); }
    if (/terceir|invas/.test(ocupante)) ponto(p, 'grave', 'Ocupado por terceiros ou invasores: a desocupação tende a ser mais demorada.', 'Converse com um advogado sobre o prazo real na comarca.');
    if (!(conta && conta.custos && conta.custos.desocupacao > 0)) ponto(p, 'atencao', 'O custo de desocupação não está na conta.', 'Preencha o campo "Desocupação" na conta.');
    return { pilar: fechar(p), info: info };
  }

  // ── Dívidas: IPTU, condomínio, quem paga segundo o edital, peso no lance ──
  function quemPaga(campo, texto) {
    var c = txt(campo || ''), t = txt(texto || '');
    if (c === 'preco' || /sub-?roga|130 do ctn|art\.? ?130|908|produto da arremata|preco da arremata|com o valor do lance|quitad[oa]s? com o/.test(t)) return 'preco';
    if (c === 'arrematante' || /(arrematante|adquirente|comprador)[^.]{0,60}(responsa|arca|pag|a cargo)|(responsabilidade|a cargo|por conta) do (arrematante|adquirente|comprador)/.test(t)) return 'arrematante';
    return '';
  }
  function dividas(im, conta) {
    var p = pilar('dividas', 'Dívidas (IPTU, condomínio)');
    var ed = im.analise_edital || {};
    var lance = num(im.lance);
    var iptu = num(im.debitos_iptu), cond = num(im.debitos_condominio), outros = num(im.debitos_outros);
    var total = iptu + cond + outros;
    var qIptu = quemPaga(ed.iptu_quem_paga, ed.debitos_iptu), qCond = quemPaga(ed.condominio_quem_paga, ed.debitos_condominio);
    var tipoImovel = txt(ed.tipo_imovel || '') + ' ' + txt(im.descricao || '');
    var temCondominio = /apart|apto|condomin|sala comercial|conjunto|unidade autonoma/.test(tipoImovel);

    if (qIptu === 'preco') ponto(p, 'ok', 'IPTU atrasado é pago com o dinheiro do leilão (art. 130 do CTN): você não herda essa dívida.', 'Peça a certidão de débitos da prefeitura depois da compra para confirmar a baixa.');
    else if (qIptu === 'arrematante') ponto(p, iptu > 0 ? 'atencao' : 'grave', 'O edital diz que quem compra paga o IPTU atrasado.', iptu > 0 ? '' : 'Consulte a dívida no site da prefeitura e coloque o valor na conta.');
    else ponto(p, 'atencao', im.analise_edital ? 'O edital não diz claramente quem paga o IPTU atrasado.' : 'Ainda não se sabe quem paga o IPTU atrasado (o edital não foi lido).', 'Leia a parte de débitos do edital ou pergunte ao leiloeiro.');

    if (temCondominio || cond > 0 || ed.debitos_condominio) {
      if (qCond === 'preco') ponto(p, 'ok', 'O condomínio atrasado é pago com o dinheiro do leilão segundo o edital.');
      else if (qCond === 'arrematante') ponto(p, cond > 0 ? 'atencao' : 'grave', 'O edital diz que quem compra paga o condomínio atrasado (dívida que acompanha o imóvel).', cond > 0 ? '' : 'Peça ao síndico ou à administradora a declaração de débitos e coloque na conta.');
      else ponto(p, 'atencao', 'O edital não diz quem paga o condomínio atrasado. Essa dívida acompanha o imóvel; se o edital não avisou, a Justiça costuma proteger quem compra, mas não é garantido.', 'Peça a declaração de débitos ao síndico ou à administradora.');
    }
    if (lance > 0 && total > 0) {
      var peso = total / lance;
      if (peso > 0.3) ponto(p, 'grave', 'As dívidas lançadas (' + reais(total) + ') passam de 30% do lance.');
      else if (peso > 0.1) ponto(p, 'atencao', 'As dívidas lançadas (' + reais(total) + ') são ' + pct(peso) + ' do lance.');
      else ponto(p, 'ok', 'As dívidas lançadas (' + reais(total) + ') pesam pouco no lance (' + pct(peso) + ').');
    }
    var mensal = num(im.mensal_condominio) + num(im.mensal_iptu);
    if (mensal > 0) ponto(p, 'ok', 'Gasto por mês até vender: ' + reais(mensal) + ' (já está na conta).');
    return fechar(p);
  }

  // ── Financeiro: vem da conta (calculo.js) ──
  function financeiro(im, conta) {
    var p = pilar('financeiro', 'Valores e retorno');
    var r = conta && conta.resultado;
    if (!r || !(conta.custos.lance > 0) || !(conta.venda.valor > 0)) { p.nota = 0; ponto(p, 'grave', 'Falta o lance ou o valor de venda.', 'Preencha o lance e a avaliação na conta.'); return fechar(p); }
    p.nota = r.lucro_liquido <= 0 ? 10 : Math.max(20, Math.min(100, 40 + r.roi_anual * 200));
    if (r.desconto >= 0.4) p.nota += 10;
    if (r.lucro_liquido <= 0) ponto(p, 'grave', 'Com estes números dá prejuízo de ' + reais(-r.lucro_liquido) + '.');
    else ponto(p, r.roi_anual >= 0.25 ? 'ok' : r.roi_anual >= 0.12 ? 'ok' : 'atencao', 'Lucro líquido de ' + reais(r.lucro_liquido) + ' (' + pct(r.roi_anual) + ' ao ano).');
    if (r.desconto > 0) ponto(p, r.desconto >= 0.3 ? 'ok' : 'atencao', 'Desconto de ' + pct(r.desconto) + ' sobre a avaliação.');
    if (conta.custos.lance > r.lance_maximo) ponto(p, 'atencao', 'O lance passa do máximo para o lucro desejado (' + reais(r.lance_maximo) + ').');
    var area = num(im.area_m2) || num(im.analise_edital && im.analise_edital.area_m2) || num(im.analise_matricula && im.analise_matricula.area_m2);
    var m2 = num(im.preco_m2);
    if (area && m2) {
      var mercado = area * m2;
      var aval = conta.entrada.avaliacao;
      if (aval > mercado * 1.15) { p.nota -= 15; ponto(p, 'atencao', 'A avaliação (' + reais(aval) + ') está acima do valor de mercado estimado (' + reais(mercado) + ' = ' + Math.round(area) + ' m² × ' + reais(m2) + '): o desconto real é menor.', 'Coloque em "Vendo por" o valor de mercado, não a avaliação.'); }
      else ponto(p, 'ok', 'Valor de mercado estimado: ' + reais(mercado) + ' (' + Math.round(area) + ' m² × ' + reais(m2) + ' por m²).');
    } else ponto(p, 'atencao', 'Falta o preço do m² na região para comparar com a avaliação.', 'Pesquise imóveis parecidos à venda no bairro e preencha "Preço do m² na região".');
    return fechar(p);
  }

  // ── Região: população, renda, serviços perto e tendência de preço ──
  function regiao(rg, prazoMeses) {
    var p = pilar('regiao', 'Região e valorização');
    var info = { valorizacao_prazo: null };
    if (!rg) { ponto(p, 'atencao', 'A região ainda não foi analisada.', 'Toque em "Analisar a região".'); p.nota = null; return { pilar: p, info: info }; }
    p.nota = 60;
    var pop = rg.populacao || {};
    if (typeof pop.cresc_anual_pct === 'number') {
      if (pop.cresc_anual_pct >= 1) { p.nota += 15; ponto(p, 'ok', 'A cidade cresceu ' + pct1(pop.cresc_anual_pct) + ' ao ano entre os Censos de 2010 e 2022: demanda por moradia crescendo.'); }
      else if (pop.cresc_anual_pct >= 0) { p.nota += 5; ponto(p, 'ok', 'A população cresceu pouco (' + pct1(pop.cresc_anual_pct) + ' ao ano entre 2010 e 2022): cidade estável.'); }
      else { p.nota -= 15; ponto(p, 'atencao', 'A população caiu (' + pct1(pop.cresc_anual_pct) + ' ao ano entre 2010 e 2022): pode demorar mais para vender.'); }
    }
    var pib = rg.pib_per_capita;
    if (pib && typeof pib.cresc_anual_pct === 'number') {
      if (pib.cresc_anual_pct >= 8) { p.nota += 10; ponto(p, 'ok', 'A renda da cidade (PIB por pessoa) subiu ' + pct1(pib.cresc_anual_pct) + ' ao ano nos últimos 5 anos.'); }
      else if (pib.cresc_anual_pct < 4) { p.nota -= 5; ponto(p, 'atencao', 'A renda da cidade (PIB por pessoa) subiu só ' + pct1(pib.cresc_anual_pct) + ' ao ano nos últimos 5 anos.'); }
      else ponto(p, 'ok', 'A renda da cidade (PIB por pessoa) subiu ' + pct1(pib.cresc_anual_pct) + ' ao ano nos últimos 5 anos.');
    }
    if (Array.isArray(rg.servicos)) {
      var faltam = rg.servicos.filter(function (s) { return !(s.qtd > 0); });
      var com = rg.servicos.length - faltam.length;
      p.nota += (com - 4) * 5;
      if (!faltam.length) ponto(p, 'ok', 'Tem de tudo a até 1 km: escola, saúde, mercado, transporte, lazer e comércio.');
      else ponto(p, faltam.length >= 3 ? 'atencao' : 'ok', 'A até 1 km não achei: ' + faltam.map(function (s) { return s.nome.toLowerCase(); }).join(', ') + ' (mapa colaborativo OpenStreetMap, pode estar incompleto).');
    } else if (rg.local && rg.local.na_cidade === false) ponto(p, 'atencao', 'O endereço não foi achado no mapa desta cidade; os serviços perto não foram contados.', 'Confira o endereço.');
    else ponto(p, 'atencao', 'O endereço não foi achado no mapa; os serviços perto não foram contados.', 'Confira o endereço com número e bairro.');
    var m = rg.mercado || {};
    if (typeof m.ivgr_12m_pct === 'number') {
      var anual = m.ivgr_12m_pct / 100;
      info.valorizacao_prazo = Math.pow(1 + anual, (prazoMeses || 12) / 12) - 1;
      ponto(p, anual >= 0 ? 'ok' : 'atencao', 'Imóveis residenciais no Brasil ' + (anual >= 0 ? 'valorizaram ' : 'desvalorizaram ') + pct1(Math.abs(m.ivgr_12m_pct)) + ' em 12 meses (índice IVG-R do Banco Central' + (m.ivgr_ate ? ', até ' + m.ivgr_ate : '') + '). Média nacional, não deste bairro.');
    }
    return { pilar: fechar(p), info: info };
  }

  /**
   * Monta o parecer completo.
   * @param {object} im     imóvel salvo (campos da tela, analise_edital, analise_matricula, processo_info, regiao, preco_m2, area_m2)
   * @param {object} conta  resultado de BezsanCalculo.calcular(...)
   */
  function montar(im, conta) {
    im = im || {};
    var tipo = tipoLeilao(im);
    var ps = posse(im, tipo, conta), rg = regiao(im.regiao, conta && conta.entrada ? conta.entrada.prazo_meses : 12);
    var pilares = [financeiro(im, conta), juridico(im, tipo), ps.pilar, dividas(im, conta), rg.pilar];
    var somaPeso = 0, soma = 0;
    pilares.forEach(function (p) { if (typeof p.nota === 'number') { soma += p.nota * p.peso; somaPeso += p.peso; } });
    var nota = somaPeso ? Math.round(soma / somaPeso) : 0;
    var graves = [], atencoes = [];
    pilares.forEach(function (p) { p.itens.forEach(function (i) { if (i.nivel === 'grave') graves.push(i); else if (i.nivel === 'atencao') atencoes.push(i); }); });

    // Lance limite: o máximo da conta menos uma reserva para os riscos que não têm valor exato.
    var riscosSemValor = 0;
    pilares.forEach(function (p) { if (p.id !== 'financeiro' && p.id !== 'regiao') p.itens.forEach(function (i) { riscosSemValor += i.nivel === 'grave' ? 0.05 : i.nivel === 'atencao' ? 0.015 : 0; }); });
    var reserva = Math.min(0.25, riscosSemValor);
    var r = conta && conta.resultado;
    var lanceMax = r ? r.lance_maximo : 0;
    var limite = Math.max(0, Math.floor(lanceMax * (1 - reserva) / 500) * 500);
    var semNumeros = !(conta && conta.custos && conta.custos.lance > 0 && conta.venda && conta.venda.valor > 0);
    var prejuizo = r && r.lucro_liquido <= 0;
    var graveJuridico = pilares[1].itens.some(function (i) { return i.nivel === 'grave'; });

    var nivel;
    if (semNumeros || prejuizo || nota < 50 || limite <= 0) nivel = 0;
    else if (nota >= 70 && !graves.length) nivel = 2;
    else nivel = 1;
    if (graveJuridico && nivel === 2) nivel = 1;
    var lanceAtual = conta && conta.custos ? conta.custos.lance : 0;
    var titulo = ['Não vale a pena', 'Vale só com cuidado', 'Vale a pena'][nivel];
    if (nivel > 0) titulo += ', até ' + reais(limite);
    if (semNumeros) titulo = 'Faltam dados: preencha o lance e a avaliação';

    var resumo = [];
    if (!semNumeros) {
      resumo.push('Nota ' + nota + ' de 100.');
      if (nivel > 0) resumo.push('Lance limite ' + reais(limite) + (reserva > 0 ? ' (o máximo da conta, ' + reais(lanceMax) + ', menos ' + pct(reserva) + ' de reserva para os riscos sem valor exato)' : '') + '.');
      if (nivel > 0 && lanceAtual > limite) resumo.push('O lance de ' + reais(lanceAtual) + ' passa do limite.');
      if (graves.length) resumo.push(graves.length + (graves.length === 1 ? ' ponto grave' : ' pontos graves') + ' para resolver antes do lance.');
    }
    var conferir = [];
    pilares.forEach(function (p) { p.itens.forEach(function (i) { if (i.fazer && i.nivel !== 'ok' && conferir.indexOf(i.fazer) < 0) conferir.push(i.fazer); }); });
    var valorizacao = rg.info.valorizacao_prazo;
    return {
      nota: nota,
      nivel: nivel,
      veredito: titulo,
      resumo: resumo,
      tipo_leilao: tipo,
      lance_limite: nivel > 0 ? limite : 0,
      lance_maximo_conta: lanceMax,
      reserva_risco: reserva,
      lance_empate: r ? r.lance_empate : 0,
      posse: ps.info,
      valorizacao_prazo: valorizacao,
      venda_com_valorizacao: valorizacao !== null && conta && conta.venda ? Math.round(conta.venda.valor * (1 + valorizacao)) : null,
      pilares: pilares,
      graves: graves.length,
      atencoes: atencoes.length,
      conferir: conferir.slice(0, 15),
    };
  }

  return { montar: montar, PESOS: PESOS, tipoLeilao: tipoLeilao, quemPaga: quemPaga };
});
