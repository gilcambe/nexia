/* Logic pura do calendário do Splash Eventos (fuso de Brasília, suporte a CommonJS para testes e browser) */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SplashCalendario = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const TZ_OFFSET_MIN = -180; // Brasília

  /** "Hoje" no fuso de Brasília YYYY-MM-DD */
  function hojeBr(now = Date.now()) {
    const t = new Date(now + TZ_OFFSET_MIN * 60000);
    return t.toISOString().slice(0, 10);
  }

  /** Retorna o mês no formato YYYY-MM de uma data YYYY-MM-DD ou agora */
  function mesAtualBr(now = Date.now()) {
    return hojeBr(now).slice(0, 7);
  }

  /** Soma/subtrai meses a partir de YYYY-MM. Retorna YYYY-MM */
  function somarMeses(anoMes, n) {
    const [ano, mes] = anoMes.split('-').map(Number);
    const d = new Date(Date.UTC(ano, mes - 1 + n, 1));
    const a = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    return `${a}-${m}`;
  }

  /** Nome do mês em português (ex: "Janeiro 2026") */
  function nomeMesPt(anoMes) {
    const [ano, mes] = anoMes.split('-').map(Number);
    const nomes = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return `${nomes[mes - 1]} ${ano}`;
  }

  /**
   * Gera a grade do mês (semana começando na Segunda-feira = 0 ... Domingo = 6).
   * Retorna array de objetos do dia: { data: 'YYYY-MM-DD', diaNum: 1..31, doMesAtual: boolean, passado: boolean }
   */
  function gerarGradeMes(anoMes, hoje = hojeBr()) {
    const [ano, mes] = anoMes.split('-').map(Number);

    // Primeiro dia do mês em UTC
    const primDia = new Date(Date.UTC(ano, mes - 1, 1));
    // getUTCDay: 0 = Dom, 1 = Seg, ..., 6 = Sab
    // Queremos Segunda = 0, Terça = 1, ..., Domingo = 6
    let diaSemanaInicio = primDia.getUTCDay() - 1;
    if (diaSemanaInicio === -1) diaSemanaInicio = 6;

    // Quantidade de dias no mês
    const totalDiasMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();

    // Dias do mês anterior para completar a primeira semana
    const mesAnteriorAnoMes = somarMeses(anoMes, -1);
    const [anoAnt, mesAnt] = mesAnteriorAnoMes.split('-').map(Number);
    const totalDiasMesAnt = new Date(Date.UTC(anoAnt, mesAnt, 0)).getUTCDate();

    const dias = [];

    // Preenche dias do mês anterior
    for (let i = diaSemanaInicio - 1; i >= 0; i--) {
      const diaNum = totalDiasMesAnt - i;
      const dataStr = `${anoAnt}-${String(mesAnt).padStart(2, '0')}-${String(diaNum).padStart(2, '0')}`;
      dias.push({
        data: dataStr,
        diaNum,
        doMesAtual: false,
        passado: dataStr < hoje
      });
    }

    // Preenche dias do mês atual
    for (let d = 1; d <= totalDiasMes; d++) {
      const dataStr = `${anoMes}-${String(d).padStart(2, '0')}`;
      dias.push({
        data: dataStr,
        diaNum: d,
        doMesAtual: true,
        passado: dataStr < hoje
      });
    }

    // Preenche dias do mês seguinte para fechar semanas completas (múltiplo de 7)
    const mesSeguinteAnoMes = somarMeses(anoMes, 1);
    const [anoSeg, mesSeg] = mesSeguinteAnoMes.split('-').map(Number);
    let proxDia = 1;
    while (dias.length % 7 !== 0) {
      const dataStr = `${anoSeg}-${String(mesSeg).padStart(2, '0')}-${String(proxDia).padStart(2, '0')}`;
      dias.push({
        data: dataStr,
        diaNum: proxDia,
        doMesAtual: false,
        passado: dataStr < hoje
      });
      proxDia++;
    }

    return dias;
  }

  return {
    hojeBr,
    mesAtualBr,
    somarMeses,
    nomeMesPt,
    gerarGradeMes
  };
});
