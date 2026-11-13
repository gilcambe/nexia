// Visual da Central nova, no jeito dos exemplos do dono (Painel Executivo): azul-escuro, cartões com degradê,
// ícones coloridos, menu lateral com destaque. A página não rola (height:100vh;overflow:hidden); no PC cada tela
// cabe na altura, e só a área de conteúdo rola se a janela for pequena demais. No celular: menu de baixo + gaveta.
export const CSS = `@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap");

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
.kx-passos{border:1px solid #f8717166;background:#7f1d1d22;border-radius:12px;padding:10px 12px;white-space:normal;line-height:1.45}
.kx-passos ol{margin:6px 0 8px;padding-left:20px;color:#dbe4ff}.kx-passos li{margin:2px 0}
.kx-passos .kx-btn{white-space:normal}
.kx-status-tudo{grid-column:1/-1}
.kx-status-grade{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px}
.kx-status-item{display:flex;flex-direction:column;gap:2px;align-items:flex-start;padding:10px 12px;border-radius:12px;border:1px solid;background:#ffffff08;color:var(--txt);cursor:pointer;text-align:left;font:inherit}
.kx-status-item b{font-size:24px;font-weight:800;line-height:1.1}.kx-status-item span{font-size:12px;color:#c7d2f0}
@media (max-width:1100px){.kx-status-grade{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media (max-width:768px){.kx-status-grade{grid-template-columns:repeat(2,minmax(0,1fr))}}
.kx-passos.neutro{border-color:var(--linha);background:#ffffff08}
/* 09/11 (dono): "a tela corta botões". Notebook com janela baixa: nada encolhe nem some, a área rola. */
@media (min-width:769px) and (max-height:900px){
 .kx-menu{gap:1px;padding:8px 10px}
 .kx-menu button{min-height:34px;font-size:14px}
 .kx-tela,.kx-grade{flex:none}
 .kx-grade{grid-auto-rows:minmax(320px,auto)}
 .kx-bloco{overflow:visible}
 .kx-bloco-corpo{overflow:visible}
}
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
@media (max-width:420px){.kx-status-txt{display:none!important}.kx-status{padding:6px}.kx-topo{gap:6px;padding:0 8px}.kx-sino{width:38px;height:38px}}
/* C2-F1 (PC 2, 13/11): visual premium. Fonte Inter, cantos 10px, cores sólidas suaves (sem degradê gritante),
   botões menores e só 1 botão forte por tela. Fica no fim para valer por cima do visual antigo. */
.kx{background:var(--fundo);--linha:#1c2748;--card:#0e1630;letter-spacing:-.005em}
.kx-bloco{background:var(--card);border-radius:10px;box-shadow:none}
.kx-btn{min-height:34px;padding:0 12px;border-radius:8px;font-size:13.5px;background:transparent}
.kx-btn.forte{background:#2563eb;border-color:#2563eb}
.kx-btn.verde{background:#15803d;border-color:#15803d}
.kx-btn.laranja{background:#c2410c;border-color:#c2410c}
.kx-btn.roxo{background:#6d28d9;border-color:#6d28d9}
.kx-menu button{min-height:38px;border-radius:8px;font-size:14px}
.kx-menu button[aria-current=page]{background:#1e3a8a;box-shadow:none}
.kx-kpi{border-radius:10px}
.kx-kpi.az,.kx-kpi.vd,.kx-kpi.rx,.kx-kpi.lj,.kx-kpi.vm,.kx-kpi.ci{background:var(--card)}
.kx-kpi .ico{box-shadow:none;border-radius:10px}
.kx-heroi{border-radius:10px;background:#0f1d45}
.kx-assist{background:#121a3a;border-color:#2b3a75}
.kx-mod{border-radius:10px;box-shadow:none}
.kx-busca,.kx-sino,.kx-status{border-radius:8px}
.kx-abas{display:flex;gap:4px;flex-wrap:wrap;margin:0 0 10px;border-bottom:1px solid var(--linha)}
.kx-abas button{background:none;border:0;border-bottom:2px solid transparent;color:var(--mut);padding:8px 12px;font:inherit;font-size:13.5px;cursor:pointer;margin-bottom:-1px}
.kx-abas button[aria-selected=true]{color:var(--txt);border-bottom-color:#3b82f6;font-weight:600}
.kx-abas button:hover{color:var(--txt)}
/* 13/11 (dono: visual premium, calmo, estilo Readdy): cores fortes viram detalhe, cartões lisos */
.kx{background:var(--fundo)}
.kx-bloco{background:var(--card);box-shadow:none}
.kx-btn.verde,.kx-btn.laranja,.kx-btn.roxo{background:var(--card2);border-color:var(--linha);color:var(--txt);font-weight:600}
.kx-btn.verde{border-color:#22c55e88}.kx-btn.laranja{border-color:#f59e0b88}.kx-btn.roxo{border-color:#8b5cf688}
.kx-btn.forte{background:#3b82f6;border-color:#3b82f6}
.kx-kpi.az,.kx-kpi.vd,.kx-kpi.rx,.kx-kpi.lj,.kx-kpi.vm{background:var(--card)}
.kx-kpi.az{border-left:3px solid #3b82f6}.kx-kpi.vd{border-left:3px solid #22c55e}.kx-kpi.rx{border-left:3px solid #8b5cf6}.kx-kpi.lj{border-left:3px solid #f59e0b}.kx-kpi.vm{border-left:3px solid #ef4444}
.kx-mod{background:var(--card)!important;border-color:var(--linha)!important;color:var(--txt)}
.kx-boasvindas{display:grid;place-items:center;min-height:calc(100vh - 140px)}
.kx-bv-caixa{width:100%;max-width:760px;display:flex;flex-direction:column;gap:14px;padding:16px}
.kx-bv-titulo{margin:0;text-align:center;font-size:clamp(26px,4vw,40px);font-weight:700;letter-spacing:-.02em}
.kx-bv-sub{text-align:center;margin:0;white-space:normal!important}
.kx-bv-entrada{background:var(--card);border:1px solid var(--linha);border-radius:18px;padding:12px;display:flex;flex-direction:column;gap:8px}
.kx-bv-entrada:focus-within{border-color:#3b82f6}
.kx-bv-entrada textarea{background:none;border:0;outline:0;color:var(--txt);font:inherit;font-size:16px;resize:vertical;min-height:72px}
.kx-bv-acoes{display:flex;gap:8px;align-items:center}
.kx-bv-sugestoes{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
.kx-bv-projeto{display:flex;gap:8px;align-items:center;justify-content:center;flex-wrap:wrap}
.kx-bv-projeto select{max-width:280px;padding-left:12px;height:38px}

.kx-boasvindas{grid-template-columns:minmax(0,1fr)}
.kx-bv-caixa{min-width:0}
.kx-bv-sugestoes .kx-chip{height:auto;min-height:34px;padding:6px 12px;white-space:normal;text-align:center}
@media (max-width:768px){
 .kx-boasvindas{min-height:auto;place-items:start stretch}
 .kx-bv-titulo{font-size:26px}
 .kx:not(.gaveta) .kx-menu button{font-size:10.5px;min-height:54px;line-height:1.15;white-space:normal;text-align:center;min-width:0;padding:0 2px;border-radius:10px}
}

/* 13/11 LUXO (dono: "premium como o painel do Viajante Pro, sofisticado, luxuoso"): tinta escura, linhas finas,
   um só destaque turquesa e dourado em detalhe. Nada de botão colorido gritando nem brilho. */
.kx{--fundo:#0a1219;--fundo2:#0c161e;--card:#101b24;--card2:#14222d;--linha:rgba(255,255,255,.07);--txt:#eef4f6;--mut:#93a6af;--az:#19a7b5;--ouro:#c8a96a;background:var(--fundo)!important;letter-spacing:.003em}
.kx-marca,.kx-menu{background:var(--fundo2)!important}
.kx-topo{background:rgba(10,18,25,.9);backdrop-filter:blur(8px)}
.kx-menu button{color:#b9c7cd}
.kx-menu button[aria-current=page]{background:rgba(25,167,181,.10)!important;color:#fff;box-shadow:inset 2px 0 0 var(--az)!important;font-weight:600}
.kx-bloco{background:var(--card)!important;border:1px solid var(--linha)!important;border-radius:14px}
.kx-btn{background:transparent;border-color:var(--linha);border-radius:10px}
.kx-btn:hover{border-color:var(--ouro)}
.kx-btn.forte{background:var(--az)!important;border-color:var(--az)!important;color:#04161a!important;font-weight:700}
.kx-btn.roxo,.kx-btn.verde,.kx-btn.laranja{background:transparent!important;border:1px solid var(--linha)!important;color:var(--txt)!important}
.kx-btn.roxo:hover,.kx-btn.verde:hover,.kx-btn.laranja:hover{border-color:var(--ouro)!important}
.kx-heroi{background:var(--card)!important;border-color:var(--linha)!important;box-shadow:none!important}
.kx-heroi:after,.kx-heroi:before{display:none!important}
.kx-heroi h1{font-weight:600;letter-spacing:-.02em}
.kx-heroi p{color:var(--mut)}
.kx-heroi-faixa{background:transparent!important;border:1px solid var(--linha)!important;color:var(--mut)}
.kx-status-item{background:transparent!important;border:1px solid var(--linha)!important;border-radius:12px}
.kx-status-item:hover{border-color:var(--ouro)!important}
.kx-status-item b{color:var(--txt)!important;font-weight:600}
.kx-status-item span{color:var(--mut)}
.kx-kpi{background:var(--card)!important;border:1px solid var(--linha)!important;border-radius:14px}
.kx-kpi .ico{background:rgba(255,255,255,.04)!important;box-shadow:none!important;color:var(--ouro)}
.kx-kpi span{color:var(--mut)}
.kx-kpi .barras{display:none}
.kx-mod{background:var(--card)!important;border:1px solid var(--linha)!important;color:var(--txt)!important}
.kx-mod:hover{border-color:var(--ouro)!important}
.kx-abas button[aria-selected=true]{border-bottom-color:var(--ouro)}
.kx-chip{border-color:var(--linha);color:var(--mut)}
.kx-chip:hover{border-color:var(--ouro);color:var(--txt)}
.kx-bv-titulo{font-weight:600;letter-spacing:-.025em}
.kx-bv-titulo:after{content:"";display:block;width:56px;height:2px;margin:14px auto 0;background:var(--ouro);border-radius:2px}
.kx-bv-entrada{background:var(--card2)}
.kx-bv-entrada:focus-within{border-color:var(--ouro)}
.kx-barra i{background:var(--az)!important}

.kx-grade.kx-kpis{grid-auto-rows:auto!important;flex:none}
.kx-kpis .kx-kpi{grid-column:auto!important;min-height:84px}

.kx select,.kx textarea,.kx input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]):not([type=color]):not(.kx-busca){background:var(--card2);color:var(--txt);border:1px solid var(--linha);border-radius:10px;padding:8px 10px;font:inherit}
.kx select:focus,.kx textarea:focus,.kx input:focus{outline:0;border-color:var(--ouro)}
.kx .kx-bv-entrada textarea{background:none;border:0;padding:0}
.kx .kx-busca{padding-left:40px}
.kx .kx-bv-projeto select,.kx .kx-tela select.kx-busca{padding-left:12px}

/* 13/11 IDENTIDADE KERNEX (dono: "a KERNEX já tem uma identidade visual que deve ser fixa e respeitada").
   Paleta oficial de brand/kernex/cores.json e do Protetor de tela Kernex: fundo #060c1c, card #0b1730,
   azul #6fb8ff, ciano #2fd3c7, botão #1d5fd0, fonte Inter. Esta camada vem por último e manda. */
.kx{--fundo:#060c1c;--fundo2:#071126;--card:#0b1730;--card2:#0e1d3a;--linha:rgba(111,184,255,.14);--txt:#e2e8f2;--mut:#8fa3c0;--az:#6fb8ff;--ci:#2fd3c7;--ouro:#2fd3c7;font-family:Inter,system-ui,sans-serif;background:radial-gradient(1200px 600px at 85% -10%,rgba(29,95,208,.18),transparent 60%),var(--fundo)!important}
.kx-marca,.kx-menu{background:var(--fundo2)!important;border-color:var(--linha)!important}
.kx-topo{background:rgba(6,12,28,.92)!important}
.kx-logo{letter-spacing:.22em;font-weight:700;background:linear-gradient(180deg,#e2e8f2,#8fa3c0);-webkit-background-clip:text;background-clip:text;color:transparent}
.kx-logo small{letter-spacing:.02em;font-weight:500;-webkit-text-fill-color:var(--ci);color:var(--ci)}
.kx-menu button{color:#b8c6db}
.kx-menu button[aria-current=page]{background:#0a2468!important;color:#fff;box-shadow:inset 3px 0 0 var(--ci)!important}
.kx-submenu{display:grid;gap:1px;margin:2px 0 8px 30px;padding-left:10px;border-left:1px solid var(--linha)}
.kx-submenu button{all:unset;cursor:pointer;font-size:12.5px;color:var(--mut);padding:5px 8px;border-radius:7px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.kx-submenu button:hover{color:var(--txt);background:rgba(111,184,255,.06)}
.kx-submenu button[aria-current=page]{color:var(--ci);background:rgba(47,211,199,.08);font-weight:600}
.kx-btn:hover{border-color:var(--az)}
.kx-btn.forte{background:#1d5fd0!important;border-color:#1d5fd0!important;color:#fff!important}
.kx-btn.forte:hover{background:#2a6fe6!important}
.kx-kpi .ico{color:var(--az)}
.kx-barra i{background:linear-gradient(90deg,#1d5fd0,var(--ci))!important}
.kx-online{width:100%;box-sizing:border-box;color:var(--txt);white-space:normal;overflow-wrap:anywhere}
.kx-chip[aria-pressed=true]{background:#1d5fd0!important;border-color:#1d5fd0!important;color:#fff!important}
.kx-kpi .ico,.kx-mod .ico{background:linear-gradient(135deg,#1d5fd0,#0a2468)!important;color:#fff}
.kx-classico{background:var(--card);border:1px solid var(--linha);border-radius:14px;padding:16px;color:var(--txt);overflow:auto}
.kx-classico a{color:var(--az)}
.kx-classico [class*=bg-white],.kx-classico [class*=bg-gray-50],.kx-classico [class*=bg-slate-50],.kx-classico [class*=bg-gray-100]{background:var(--card2)!important;color:var(--txt)!important}
.kx-classico [class*=text-gray-9],.kx-classico [class*=text-gray-8],.kx-classico [class*=text-slate-9]{color:var(--txt)!important}
.kx-classico [class*=text-gray-5],.kx-classico [class*=text-gray-6]{color:var(--mut)!important}
.kx-classico [class*=bg-gray-2],.kx-classico [class*=bg-gray-3],.kx-classico [class*=bg-slate-2],.kx-classico [class*=bg-slate-3]{background:rgba(111,184,255,.08)!important}
.kx-classico [class*=bg-gray-9],.kx-classico [class*=bg-zinc-9],.kx-classico [class*=bg-neutral-9],.kx-classico [class*=bg-black]{background:var(--card2)!important}
.kx-online{max-width:100%;min-width:0}
.kx-nome-cel{display:none}
@media (max-width:768px){.kx-nome-pc{display:none}.kx-nome-cel{display:inline}.kx-abas{flex-wrap:nowrap;overflow-x:auto;overflow-y:hidden;flex-shrink:0;min-height:42px;align-items:stretch;scrollbar-width:none;-webkit-overflow-scrolling:touch}.kx-abas::-webkit-scrollbar{display:none}.kx-abas button{white-space:nowrap;flex-shrink:0}.kx-classico{padding:10px}}
.kx-online>span:last-child{min-width:0}
`;
