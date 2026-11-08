// Visual da Central nova (azul-escuro, cards). Sem rolagem da página: cada tela cabe em 100% da altura.
export const CSS = `
.kx{--fundo:#0b1530;--card:#121f42;--linha:#1e2c55;--txt:#e8eefc;--mut:#94a3c7;--az:#3b82f6;--vd:#22c55e;--am:#f59e0b;--vm:#ef4444;--rx:#8b5cf6;
 position:fixed;inset:0;height:100vh;overflow:hidden;display:grid;grid-template-columns:220px 1fr;grid-template-rows:56px 1fr;background:var(--fundo);color:var(--txt);font-size:14px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
.kx *{box-sizing:border-box}
.kx-topo{grid-column:1/3;display:flex;align-items:center;gap:16px;padding:0 16px;border-bottom:1px solid var(--linha)}
.kx-logo{font-weight:800;letter-spacing:.08em;font-size:18px}
.kx-busca{flex:1;max-width:520px;height:36px;border-radius:10px;border:1px solid var(--linha);background:var(--card);color:var(--txt);padding:0 12px;font-size:14px}
.kx-menu{border-right:1px solid var(--linha);padding:8px;display:flex;flex-direction:column;gap:2px;overflow:hidden}
.kx-menu button{display:flex;gap:10px;align-items:center;height:40px;padding:0 12px;border-radius:10px;border:0;background:none;color:var(--mut);font-size:14px;text-align:left;cursor:pointer}
.kx-menu button[aria-current=page]{background:var(--card);color:var(--txt);font-weight:600}
.kx-area{overflow:hidden;padding:12px 16px;display:flex;flex-direction:column;gap:10px;min-height:0}
.kx-serve{margin:0;color:var(--mut)}
.kx-grade{flex:1;min-height:0;display:grid;gap:10px}
.kx-bloco{background:var(--card);border:1px solid var(--linha);border-radius:14px;padding:10px 12px;display:flex;flex-direction:column;min-height:0;overflow:hidden}
.kx-bloco-topo{display:flex;justify-content:space-between;align-items:center}
.kx-bloco h2{font-size:14px;margin:0;color:var(--mut);font-weight:600}
.kx-ajuda{width:24px;height:24px;border-radius:50%;border:1px solid var(--linha);background:none;color:var(--mut);cursor:pointer}
.kx-ajuda-texto{margin:4px 0;color:var(--mut)}
.kx-bloco-corpo{flex:1;min-height:0;overflow:hidden}
.kx-fonte{font-size:12px;color:var(--mut);margin-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.kx-sem{color:var(--mut)}
.kx-num{font-size:32px;font-weight:800;margin:4px 0}
.kx-sinal{display:flex;align-items:center;gap:14px;font-size:18px}
.kx-bola{width:22px;height:22px;border-radius:50%;flex-shrink:0}
.kx-lista{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px;overflow:hidden}
.kx-lista li{display:flex;gap:8px;align-items:center;min-height:36px}
.kx-btn{min-height:40px;padding:0 14px;border-radius:10px;border:1px solid var(--linha);background:var(--fundo);color:var(--txt);font-size:14px;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center}
.kx-btn.forte{background:var(--az);border-color:var(--az);color:#fff;font-weight:600}
.kx-chips{display:flex;gap:6px;flex-wrap:wrap}
.kx-chip{height:34px;padding:0 12px;border-radius:17px;border:1px solid var(--linha);background:none;color:var(--mut);cursor:pointer;font-size:14px}
.kx-chip[aria-pressed=true]{background:var(--az);border-color:var(--az);color:#fff}
.kx-selo{display:inline-flex;gap:4px;align-items:center;padding:2px 8px;border-radius:10px;font-size:12px;font-weight:600;color:#fff;white-space:nowrap}
.kx-linha-tarefa{width:100%;text-align:left;background:none;border:1px solid transparent;border-radius:10px;color:var(--txt);padding:6px 8px;cursor:pointer;display:flex;gap:8px;align-items:center;font-size:14px}
.kx-linha-tarefa[aria-current=true]{border-color:var(--az);background:var(--fundo)}
.kx-titulo{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kx-mut{color:var(--mut);font-size:12px;white-space:nowrap}
.kx-tempo{list-style:none;margin:0;padding:0 0 0 6px;border-left:2px solid var(--linha);display:flex;flex-direction:column;gap:8px;overflow:hidden}
.kx-caixa-travada{border:1px solid var(--am);border-radius:12px;padding:8px 10px;margin:8px 0}
@media (max-width:768px){
 .kx{grid-template-columns:1fr;grid-template-rows:52px 1fr 60px}
 .kx-topo{grid-column:1}
 .kx-menu{grid-row:3;flex-direction:row;border-right:0;border-top:1px solid var(--linha);padding:4px;justify-content:space-around}
 .kx-menu button{flex-direction:column;height:52px;gap:2px;font-size:12px;padding:0 4px}
 .kx-menu .kx-so-pc{display:none}
 .kx-area{overflow-y:auto;scroll-snap-type:y proximity}
 .kx-grade{display:flex!important;flex-direction:column;overflow:visible;flex:none}
 .kx-bloco{flex:none;min-height:auto;scroll-snap-align:start;overflow:visible}
 .kx-bloco-corpo{overflow:visible}
 .kx-lista{overflow:visible}
 .kx-busca{display:none}
}`;
