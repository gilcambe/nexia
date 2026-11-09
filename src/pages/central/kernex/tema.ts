// Visual da Central nova, no jeito dos exemplos do dono (Painel Executivo): azul-escuro, cartões com degradê,
// ícones coloridos, menu lateral com destaque. A página não rola (height:100vh;overflow:hidden); no PC cada tela
// cabe na altura, e só a área de conteúdo rola se a janela for pequena demais. No celular: menu de baixo + gaveta.
export const CSS = `
.kx{--fundo:#060c22;--fundo2:#0a1330;--card:#0f1a3d;--card2:#132250;--linha:#1f2e5e;--txt:#eef3ff;--mut:#9aa8cf;--az:#3b82f6;--vd:#22c55e;--am:#f59e0b;--vm:#ef4444;--rx:#8b5cf6;--ci:#06b6d4;
 position:fixed;inset:0;height:100vh;overflow:hidden;display:grid;grid-template-columns:232px 1fr;grid-template-rows:64px 1fr;color:var(--txt);font-size:14px;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
 background:radial-gradient(1200px 600px at 85% -10%,#1e3a8a55,transparent 60%),radial-gradient(900px 500px at 10% 110%,#5b21b633,transparent 60%),var(--fundo)}
.kx *{box-sizing:border-box}
.kx button{font-family:inherit}
.kx-topo{grid-column:2;display:flex;align-items:center;gap:14px;padding:0 20px}
.kx-marca{grid-row:1;display:flex;align-items:center;gap:10px;padding:0 16px;border-right:1px solid var(--linha);background:var(--fundo2)}
.kx-logo{font-weight:800;letter-spacing:.06em;font-size:20px;line-height:1}
.kx-logo small{display:block;font-size:9.5px;letter-spacing:.02em;font-weight:500;color:var(--mut);margin-top:3px}
.kx-busca{flex:1;width:100%;height:42px;border-radius:12px;border:1px solid var(--linha);background:#0d1738cc;color:var(--txt);padding:0 14px 0 40px;font-size:14px}
.kx-busca-ico{position:absolute;left:12px;top:11px;color:var(--mut);pointer-events:none}
.kx-status{display:flex;align-items:center;gap:10px;padding:6px 14px;border-radius:12px;border:1px solid;white-space:nowrap;background:none;color:var(--txt);cursor:pointer;font:inherit}
.kx-status b{display:block;font-size:14px;text-align:left}.kx-status-txt{display:block}.kx-status-txt span{display:block;font-size:11px;color:var(--mut);text-align:left}
.kx-sino{position:relative;width:42px;height:42px;border-radius:12px;border:1px solid var(--linha);background:none;color:var(--txt);display:grid;place-items:center;cursor:pointer;flex-shrink:0}
.kx-sino i{position:absolute;top:-5px;right:-5px;min-width:18px;height:18px;border-radius:9px;background:var(--vm);font-size:11px;font-style:normal;font-weight:700;display:grid;place-items:center;padding:0 4px}
.kx-menu{grid-row:2;border-right:1px solid var(--linha);padding:12px 10px;display:flex;flex-direction:column;gap:3px;overflow:auto;background:var(--fundo2)}
.kx-menu button{display:flex;gap:12px;align-items:center;min-height:42px;padding:0 14px;border-radius:12px;border:0;background:none;color:#c7d2f0;font-size:14.5px;text-align:left;cursor:pointer}
.kx-menu button:hover{background:#ffffff0d}
.kx-menu button[aria-current=page]{background:linear-gradient(90deg,#2563eb,#1d4ed8);color:#fff;font-weight:600;box-shadow:0 6px 20px #2563eb55}
.kx-menu-rodape{margin-top:auto;display:flex;flex-direction:column;gap:8px;padding-top:10px}
.kx-online{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;border:1px solid;font-size:13px;text-decoration:none;color:var(--txt)}
.kx-area{overflow-y:auto;overflow-x:hidden;padding:4px 20px 16px;display:flex;flex-direction:column;gap:12px;min-height:0}
.kx-serve{margin:0;color:var(--mut)}
.kx-grade{flex:1;min-height:0;display:grid;gap:12px}
.kx-bloco{background:linear-gradient(180deg,#111d45,#0d1838);border:1px solid var(--linha);border-radius:16px;padding:12px 14px;display:flex;flex-direction:column;min-height:0;overflow:hidden;box-shadow:0 8px 24px #0006}
.kx-bloco-topo{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px}
.kx-bloco h2{font-size:15px;margin:0;color:var(--txt);font-weight:700;display:flex;align-items:center;gap:8px}
.kx-bloco-acoes{display:flex;align-items:center;gap:6px}
.kx-ver{background:none;border:0;color:#60a5fa;font-size:13px;cursor:pointer;display:inline-flex;gap:4px;align-items:center;padding:4px;white-space:nowrap}
.kx-ajuda{width:24px;height:24px;border-radius:50%;border:1px solid var(--linha);background:none;color:var(--mut);cursor:pointer;font-size:12px;flex-shrink:0}
.kx-ajuda-texto{margin:0 0 6px;color:var(--mut)}
.kx-bloco-corpo{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden}
.kx-fonte{font-size:11px;color:#7d8bb5;margin-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.kx-sem{color:var(--mut)}
.kx-num{font-size:32px;font-weight:800;margin:4px 0}
.kx-sinal{display:flex;align-items:center;gap:14px;font-size:18px}
.kx-bola{width:12px;height:12px;border-radius:50%;flex-shrink:0}
.kx-lista{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px}
.kx-lista li{display:flex;gap:10px;align-items:center;min-height:36px}
.kx-btn{min-height:38px;padding:0 14px;border-radius:10px;border:1px solid var(--linha);background:#0b1533;color:var(--txt);font-size:14px;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:8px;white-space:nowrap}
.kx-btn:hover{border-color:#3b82f6}
.kx-btn:disabled{opacity:.6;cursor:wait}
.kx-btn.forte{background:linear-gradient(135deg,#3b82f6,#2563eb);border-color:#2563eb;color:#fff;font-weight:600}
.kx-btn.verde{background:linear-gradient(135deg,#22c55e,#15803d);border-color:#16a34a;color:#fff;font-weight:600}
.kx-btn.laranja{background:linear-gradient(135deg,#f59e0b,#c2410c);border-color:#ea580c;color:#fff;font-weight:600}
.kx-btn.roxo{background:linear-gradient(135deg,#8b5cf6,#6d28d9);border-color:#7c3aed;color:#fff;font-weight:600}
.kx-btn.vermelho{background:#7f1d1d;border-color:#b91c1c;color:#fff;font-weight:600}
.kx-chips{display:flex;gap:6px;flex-wrap:wrap}
.kx-chip{height:34px;padding:0 12px;border-radius:17px;border:1px solid var(--linha);background:none;color:var(--mut);cursor:pointer;font-size:14px}
.kx-chip[aria-pressed=true]{background:var(--az);border-color:var(--az);color:#fff}
.kx-selo{display:inline-flex;gap:4px;align-items:center;padding:3px 10px;border-radius:10px;font-size:12px;font-weight:600;color:#fff;white-space:nowrap}
.kx-linha-tarefa{width:100%;text-align:left;background:none;border:1px solid transparent;border-radius:10px;color:var(--txt);padding:6px 8px;cursor:pointer;display:flex;gap:8px;align-items:center;font-size:14px;text-decoration:none}
.kx-lista li>.kx-linha-tarefa{width:auto;flex:1;min-width:0}
.kx-linha-tarefa:hover{background:#ffffff08}
.kx-linha-tarefa[aria-current=true]{border-color:var(--az);background:var(--fundo)}
.kx-titulo{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.kx-mut{color:var(--mut);font-size:12px;white-space:nowrap}
.kx-tempo{list-style:none;margin:0;padding:0 0 0 6px;border-left:2px solid var(--linha);display:flex;flex-direction:column;gap:8px}
.kx-caixa-travada{border:1px solid var(--am);border-radius:12px;padding:8px 10px;margin:8px 0}
.kx-aviso{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:50;max-width:min(560px,92vw);padding:12px 16px;border-radius:12px;background:#111d45;border:1px solid #3b82f6;box-shadow:0 10px 30px #000a}
/* Início (Painel Executivo) */
.kx-inicio{display:grid;gap:12px;grid-template-columns:repeat(12,minmax(0,1fr));grid-auto-rows:min-content;flex:none}
.kx-heroi{grid-column:1/-1;position:relative;overflow:hidden;border-radius:18px;border:1px solid #1e40af88;padding:16px 22px;display:flex;align-items:center;gap:18px;
 background:radial-gradient(500px 220px at 78% 120%,#0ea5e966,transparent 70%),radial-gradient(260px 160px at 95% 0%,#6366f155,transparent 70%),linear-gradient(120deg,#0b1a4a,#0a1438 55%,#0b2a5e)}
.kx-heroi:after{content:"";position:absolute;right:-60px;bottom:-150px;width:440px;height:260px;border-radius:50%;border-top:2px solid #38bdf899;box-shadow:0 -10px 40px #38bdf855;pointer-events:none}
.kx-heroi h1{margin:0;font-size:28px;font-weight:800}
.kx-heroi p{margin:4px 0 0;color:#c7d2f0}
.kx-heroi-faixa{display:inline-block;margin-top:8px;padding:5px 12px;border-radius:10px;background:#1d4ed855;border:1px solid #3b82f655;font-size:13px}
.kx-controles{margin-left:auto;display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;position:relative;z-index:1;max-width:52%}
.kx-kpi{grid-column:span 3;position:relative;overflow:hidden;border-radius:16px;padding:14px 16px;display:flex;gap:14px;align-items:center;border:1px solid;min-height:104px;cursor:pointer;text-align:left;color:var(--txt);font:inherit}
.kx-kpi .ico{width:52px;height:52px;border-radius:14px;display:grid;place-items:center;flex-shrink:0;box-shadow:0 6px 18px #0005}
.kx-kpi b{display:block;font-size:30px;font-weight:800;line-height:1.1}
.kx-kpi span{display:block;font-size:14px;color:#dbe4ff}
.kx-kpi small{display:block;font-size:12px;margin-top:4px;font-weight:600}
.kx-kpi .barras{position:absolute;right:14px;bottom:12px;display:flex;gap:3px;align-items:flex-end;opacity:.9}
.kx-kpi .barras i{width:6px;border-radius:2px}
.kx-kpi.az{background:linear-gradient(135deg,#1e40af,#0f1f5c);border-color:#2563eb88}
.kx-kpi.vd{background:linear-gradient(135deg,#166534,#0b2e1f);border-color:#16a34a88}
.kx-kpi.rx{background:linear-gradient(135deg,#5b21b6,#22104f);border-color:#7c3aed88}
.kx-kpi.lj{background:linear-gradient(135deg,#9a3412,#3b1608);border-color:#ea580c88}
.kx-kpi.vm{background:linear-gradient(135deg,#991b1b,#3b0d0d);border-color:#dc262688}
.kx-modulos{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px}
.kx-mod{border-radius:14px;padding:12px;border:1px solid #ffffff22;color:#fff;cursor:pointer;text-align:left;display:flex;flex-direction:column;gap:4px;min-height:112px;position:relative;font:inherit;box-shadow:0 8px 20px #0005}
.kx-mod b{font-size:15px}.kx-mod span{font-size:12px;opacity:.85;line-height:1.3}
.kx-mod .seta{position:absolute;right:10px;bottom:10px;width:24px;height:24px;border-radius:50%;background:#ffffff33;display:grid;place-items:center}
.kx-mod:hover{transform:translateY(-2px);transition:transform .15s}
.kx-tabela{width:100%;border-collapse:collapse;font-size:13px;table-layout:fixed}
.kx-tabela th{text-align:left;color:var(--mut);font-weight:600;font-size:12px;padding:4px 6px}
.kx-tabela td{padding:6px;border-top:1px solid #ffffff0d;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.kx-barra{height:8px;background:#1e2c55;border-radius:4px;overflow:hidden;flex:1}
.kx-barra i{display:block;height:100%;border-radius:4px;background:linear-gradient(90deg,#22c55e,#10b981)}
.kx-alerta{display:flex;gap:10px;align-items:center;padding:6px 0;border-top:1px solid #ffffff0d}
.kx-alerta:first-child{border-top:0}
.kx-assist{background:linear-gradient(180deg,#1b1f6b,#101a4a);border-color:#4f46e5aa}
.kx-assist textarea{width:100%;min-height:64px;resize:none;border-radius:12px;border:1px solid var(--linha);background:#0b1533;color:var(--txt);padding:10px;font:inherit}
.kx-sugestao{display:flex;gap:10px;align-items:center;width:100%;padding:8px 10px;border-radius:10px;border:1px solid #ffffff1f;background:#ffffff0a;color:var(--txt);cursor:pointer;text-align:left;font:inherit;font-size:13px}
.kx-sugestao:hover{border-color:#818cf8}
.kx-inicio>.kx-assist{grid-column:span 3;grid-row:span 2}
.kx-span5{grid-column:span 5}.kx-span4{grid-column:span 4}
.kx-tela{flex:1;min-height:0;display:flex;flex-direction:column;gap:12px}
.kx-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;flex:none}
.kx-kpis .kx-kpi{grid-column:auto;min-height:88px;padding:12px 14px}
.kx-kpis .kx-kpi b{font-size:26px}
.kx-kpi.ci{background:linear-gradient(135deg,#0e7490,#083344);border-color:#06b6d488}
.kx-kpi.ativo{outline:2px solid #fff;outline-offset:-2px}
.kx-colunas{display:flex;align-items:flex-end;gap:10px;height:150px;padding-top:8px}
.kx-colunas div{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;height:100%;justify-content:flex-end;min-width:0}
.kx-colunas i{display:block;width:100%;max-width:44px;border-radius:8px 8px 3px 3px;background:linear-gradient(180deg,#60a5fa,#2563eb);min-height:3px}
.kx-colunas span{font-size:11px;color:var(--mut)}
.kx-ladrilhos{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}
.kx-so-cel{display:none}
.kx-gaveta-fundo{display:none}
.kx-busca-caixa{position:relative;flex:1;max-width:620px}
@media (max-width:1280px){.kx-controles{max-width:60%}.kx-heroi h1{font-size:24px}.kx-modulos{grid-template-columns:repeat(3,minmax(0,1fr))}.kx-mod{min-height:84px}}
@media (max-width:768px){
 .kx{grid-template-columns:minmax(0,1fr);grid-template-rows:56px minmax(0,1fr) 64px}
 .kx-topo,.kx-area,.kx-menu{min-width:0}
 .kx-menu button{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
 .kx-marca{display:none}
 .kx-topo{grid-column:1;padding:0 12px;gap:10px}
 .kx-so-cel{display:inline-flex}
 .kx-so-pc-flex{display:none!important}
 .kx-menu{grid-row:3;flex-direction:row;border-right:0;border-top:1px solid var(--linha);padding:4px 6px;justify-content:space-around;overflow:hidden}
 .kx-menu button{flex-direction:column;justify-content:center;min-height:54px;gap:3px;font-size:11px;padding:0 4px;flex:1}
 .kx-menu button[aria-current=page]{box-shadow:none}
 .kx-menu .kx-so-pc,.kx-menu-rodape{display:none}
 .kx.gaveta .kx-menu{position:fixed;z-index:30;left:0;top:0;bottom:0;width:78%;max-width:300px;flex-direction:column;justify-content:flex-start;padding:16px 10px;border-top:0;border-right:1px solid var(--linha);overflow:auto}
 .kx.gaveta .kx-menu button{flex-direction:row;justify-content:flex-start;font-size:15px;min-height:46px;flex:none;padding:0 14px}
 .kx.gaveta .kx-menu .kx-so-pc{display:flex}
 .kx.gaveta .kx-menu-rodape{display:flex}
 .kx.gaveta .kx-gaveta-fundo{display:block;position:fixed;inset:0;background:#000a;z-index:29}
 .kx-area{padding:10px 12px 16px;overflow-y:auto}
 .kx-grade{display:flex!important;flex-direction:column;overflow:visible;flex:none}
 .kx-bloco{flex:none;min-height:auto;overflow:visible}
 .kx-bloco-corpo{overflow:visible}
 .kx-busca-caixa{display:none}
 .kx.buscando .kx-busca-caixa{display:block;position:fixed;left:8px;right:8px;top:8px;z-index:40;max-width:none}
 .kx-status{padding:4px 10px}.kx-status-txt span{display:none}
 .kx-inicio{grid-template-columns:repeat(2,minmax(0,1fr))}
 .kx-inicio>*{grid-column:1/-1!important}
 .kx-inicio>.kx-kpi{grid-column:span 1!important;min-height:96px;padding:12px;flex-direction:column;align-items:flex-start;gap:8px}
 .kx-kpi .ico{width:40px;height:40px}.kx-kpi b{font-size:26px}.kx-kpi .barras{display:none}
 .kx-heroi{flex-direction:column;align-items:flex-start;padding:16px}
 .kx-heroi h1{font-size:22px}
 .kx-controles{margin-left:0;max-width:none;display:grid;grid-template-columns:1fr 1fr;width:100%}
 .kx-controles .kx-btn{justify-content:center;min-height:46px}
 .kx-modulos{grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
 .kx-mod{min-height:84px;padding:10px}.kx-mod span,.kx-mod .seta{display:none}
 .kx-esconde-cel{display:none}
 .kx-lista li{flex-wrap:wrap}.kx-lista .kx-mut{white-space:normal}
 .kx-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}
 .kx-kpis .kx-kpi{grid-column:auto!important;flex-direction:column;align-items:flex-start;gap:6px}
 .kx-kpis .kx-kpi .ico{width:36px;height:36px}
 .kx-tela{flex:none}
}
@media (max-width:420px){.kx-status-txt{display:none!important}.kx-status{padding:6px}.kx-topo{gap:6px;padding:0 8px}.kx-sino{width:38px;height:38px}}`;
