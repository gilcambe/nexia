// #1816: mostra a resposta do Cortex formatada (negrito, listas, tabelas, código, títulos, links)
// em vez do texto cru com asteriscos. Monta elementos React (sem innerHTML), então não abre brecha de XSS.
import React from "react";

type No = React.ReactNode;

// Fórmulas em LaTeX simples viram texto legível (\frac, \times, \[ \] ...).
export function limparLatex(t: string): string {
  return t
    .replace(/\\\[|\\\]|\\\(|\\\)/g, "")
    .replace(/\\(?:d?frac)\{([^{}]*)\}\{([^{}]*)\}/g, "($1)/($2)")
    .replace(/\\text\{([^{}]*)\}/g, "$1")
    .replace(/\\(times|cdot)/g, "×")
    .replace(/\\approx/g, "≈")
    .replace(/\\(Delta|alpha|beta|pi|sqrt|le|ge|neq)\b/g, (_, g) => ({ Delta: "Δ", alpha: "α", beta: "β", pi: "π", sqrt: "√", le: "≤", ge: "≥", neq: "≠" } as Record<string, string>)[g])
    .replace(/\\qquad|\\quad|\\,|\\;|\\!/g, " ")
    .replace(/\\(left|right|begin\{aligned\}|end\{aligned\})/g, "")
    .replace(/&=/g, "=")
    .replace(/\{,\}/g, ",");
}

const LINK = /^https?:\/\//i;

export function inline(t: string, k = "i"): No[] {
  const out: No[] = [];
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\s][^*]*\*)|(\[[^\]]+\]\([^)\s]+\))|(https?:\/\/[^\s)]+)/g;
  let last = 0, m: RegExpExecArray | null, n = 0;
  while ((m = re.exec(t))) {
    if (m.index > last) out.push(t.slice(last, m.index));
    const s = m[0], key = `${k}-${n++}`;
    if (m[1]) out.push(<code key={key} className="px-1 rounded bg-black/10 dark:bg-white/10 text-[13px]">{s.slice(1, -1)}</code>);
    else if (m[2]) out.push(<strong key={key}>{inline(s.slice(2, -2), key)}</strong>);
    else if (m[3]) out.push(<em key={key}>{inline(s.slice(1, -1), key)}</em>);
    else if (m[4]) {
      const [, txt, url] = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(s) || [];
      out.push(LINK.test(url || "") ? <a key={key} href={url} target="_blank" rel="noopener noreferrer" className="underline text-[var(--cx-ac)]">{txt}</a> : s);
    } else out.push(<a key={key} href={s} target="_blank" rel="noopener noreferrer" className="underline text-[var(--cx-ac)] break-all">{s}</a>);
    last = m.index + s.length;
  }
  if (last < t.length) out.push(t.slice(last));
  return out;
}

const celulas = (l: string) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

export default function Markdown({ texto }: { texto: string }) {
  let dentroDeCodigo = false;
  const linhas = (texto || "").split("\n").map((l) => {
    if (/^\s*```/.test(l)) { dentroDeCodigo = !dentroDeCodigo; return l; }
    return dentroDeCodigo ? l : limparLatex(l); // código fica intacto
  });
  const blocos: No[] = [];
  let i = 0, b = 0;
  while (i < linhas.length) {
    const l = linhas[i], key = `b${b++}`;
    if (/^\s*```/.test(l)) {
      const corpo: string[] = [];
      i++;
      while (i < linhas.length && !/^\s*```/.test(linhas[i])) corpo.push(linhas[i++]);
      i++;
      blocos.push(<pre key={key} className="my-2 p-3 rounded-xl bg-black/80 text-white text-[13px] overflow-x-auto"><code>{corpo.join("\n")}</code></pre>);
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(l) && i + 1 < linhas.length && /^\s*\|?\s*:?-{2,}/.test(linhas[i + 1])) {
      const cab = celulas(l);
      i += 2;
      const corpo: string[][] = [];
      while (i < linhas.length && /^\s*\|.*\|\s*$/.test(linhas[i])) corpo.push(celulas(linhas[i++]));
      blocos.push(
        <div key={key} className="my-2 overflow-x-auto"><table className="text-[14px] border-collapse">
          <thead><tr>{cab.map((c, j) => <th key={j} className="border border-black/15 dark:border-white/15 px-2 py-1 text-left">{inline(c, `${key}h${j}`)}</th>)}</tr></thead>
          <tbody>{corpo.map((r, y) => <tr key={y}>{r.map((c, j) => <td key={j} className="border border-black/15 dark:border-white/15 px-2 py-1">{inline(c, `${key}${y}-${j}`)}</td>)}</tr>)}</tbody>
        </table></div>);
      continue;
    }
    const h = /^\s*(#{1,4})\s+(.*)$/.exec(l);
    if (h) { blocos.push(<p key={key} className={`font-semibold mt-2 ${h[1].length <= 2 ? "text-[17px]" : ""}`}>{inline(h[2], key)}</p>); i++; continue; }
    if (/^\s*([-*•]|\d+[.)])\s+/.test(l)) {
      const ordenada = /^\s*\d+[.)]/.test(l);
      const itens: string[] = [];
      while (i < linhas.length && /^\s*([-*•]|\d+[.)])\s+/.test(linhas[i])) itens.push(linhas[i++].replace(/^\s*([-*•]|\d+[.)])\s+/, ""));
      const Lista = ordenada ? "ol" : "ul";
      blocos.push(<Lista key={key} className={`my-1 pl-5 ${ordenada ? "list-decimal" : "list-disc"}`}>{itens.map((t, j) => <li key={j}>{inline(t, `${key}-${j}`)}</li>)}</Lista>);
      continue;
    }
    if (/^\s*>\s?/.test(l)) { blocos.push(<blockquote key={key} className="border-l-2 border-[var(--cx-ac)] pl-3 my-1 opacity-90">{inline(l.replace(/^\s*>\s?/, ""), key)}</blockquote>); i++; continue; }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(l)) { blocos.push(<hr key={key} className="my-2 opacity-30" />); i++; continue; }
    if (!l.trim()) { i++; continue; }
    blocos.push(<p key={key} className="my-1">{inline(l, key)}</p>);
    i++;
  }
  return <>{blocos}</>;
}
