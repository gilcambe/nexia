#!/usr/bin/env bash
# scripts/clean-nexia.sh
# Limpeza de ocorrências de NEXIA em <title>, og:site_name e descrições públicas nos diretórios HTML especificados.

set -euo pipefail

node << 'EOF'
const fs = require("fs");
const path = require("path");

const targetDirs = ["public", "apps", "nexia-ai/site-kit", "viajante-pro"];

function findHtmlFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findHtmlFiles(fullPath, fileList);
    } else if (entry.isFile() && fullPath.endsWith(".html")) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

let modifiedCount = 0;

for (const dir of targetDirs) {
  const files = findHtmlFiles(dir);
  for (const file of files) {
    let content = fs.readFileSync(file, "utf8");
    const original = content;

    // (1) "NEXIA CORTEX — Plataforma de IA" por "Cortex — Plataforma de IA"
    content = content.replace(/NEXIA CORTEX\s*—\s*Plataforma de IA/g, "Cortex — Plataforma de IA");

    // (2) Substitui ocorrências da palavra NEXIA dentro de tags <title>...</title> por Cortex
    content = content.replace(/<title>([^<]*)<\/title>/gi, (match, titleInner) => {
      if (/NEXIA/i.test(titleInner)) {
        const cleaned = titleInner.replace(/NEXIA/g, "Cortex").replace(/Cortex\s+CORTEX/gi, "Cortex");
        return `<title>${cleaned}</title>`;
      }
      return match;
    });

    // (3) Substitui ocorrências de NEXIA em meta tags de og:site_name
    content = content.replace(/(<meta\s+[^>]*property=['"]og:site_name['"][^>]*content=['"])([^'"]*)(['"][^>]*>)/gi, (match, prefix, val, suffix) => {
      if (/NEXIA/i.test(val)) {
        const cleaned = val.replace(/NEXIA/g, "Cortex");
        return `${prefix}${cleaned}${suffix}`;
      }
      return match;
    });

    content = content.replace(/(<meta\s+[^>]*content=['"])([^'"]*)(['"][^>]*property=['"]og:site_name['"][^>]*>)/gi, (match, prefix, val, suffix) => {
      if (/NEXIA/i.test(val)) {
        const cleaned = val.replace(/NEXIA/g, "Cortex");
        return `${prefix}${cleaned}${suffix}`;
      }
      return match;
    });

    if (content !== original) {
      fs.writeFileSync(file, content, "utf8");
      modifiedCount++;
      console.log(`[clean-nexia] Atualizado: ${file}`);
    }
  }
}

console.log(`[clean-nexia] Concluído. Arquivos modificados: ${modifiedCount}`);
EOF
