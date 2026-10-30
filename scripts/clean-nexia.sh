#!/bin/bash

set -euo pipefail

DIRECTORIES="public/ apps/ nexia-ai/site-kit/"

echo ""
echo "=========================================="
echo "Iniciando limpeza de referências NEXIA..."
echo "=========================================="
echo ""

for dir in $DIRECTORIES; do
    if [ -d "$dir" ]; then
        echo "Processando diretório: $dir"
        find "$dir" -type f \( -name "*.html" -o -name "*.htm" \) -print0 | while IFS= read -r -d '' file; do
            echo "  Processando arquivo: $file"

            # Passo 1: Substituir "NEXIA CORTEX — Plataforma de IA" por "Cortex — Plataforma de IA"
            sed -i.bak 's/NEXIA CORTEX — Plataforma de IA/Cortex — Plataforma de IA/g' "$file"

            # Passo 2: Substituir <title> ou og:site_name contendo NEXIA por Cortex (ou remover a palavra NEXIA mantendo o restante)
            # Para <title>...</title> ou <meta property="og:site_name" ...>
            python3 -c '
import sys, re

filepath = sys.argv[1]
with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
    content = f.read()

# (1) Substituição específica de "NEXIA CORTEX — Plataforma de IA"
content = content.replace("NEXIA CORTEX — Plataforma de IA", "Cortex — Plataforma de IA")

# (2 e 3) Processar tags <title>...</title> e og:site_name
def clean_title(match):
    full_tag = match.group(0)
    # Se contém NEXIA, vamos limpar ou substituir
    inner = match.group(1)
    if "NEXIA" in inner:
        # Se for basicamente NEXIA ou NEXIA CORTEX ou algo do tipo, ou remover NEXIA mantendo o restante
        cleaned = re.sub(r"NEXIA(\s*[-—–]\s*)?", "", inner).strip()
        if not cleaned or "Cortex" in inner:
            cleaned = "Cortex"
        else:
            cleaned = re.sub(r"NEXIA", "Cortex", inner)
        return full_tag.replace(inner, cleaned)
    return full_tag

content = re.sub(r"<title([^>]*)>(.*?)</title>", clean_title, content, flags=re.IGNORECASE | re.DOTALL)

def clean_og_site_name(match):
    full_tag = match.group(0)
    if "NEXIA" in full_tag:
        replaced = full_tag.replace("NEXIA", "Cortex")
        return replaced
    return full_tag

content = re.sub(r"<meta[^>]*og:site_name[^>]*>", clean_og_site_name, content, flags=re.IGNORECASE)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
' "$file"

            echo "  Processado: $file"
        done
        find "$dir" -name "*.bak" -type f -delete
    else
        echo "ERRO: Diretório não encontrado: $dir"
        exit 1
    fi
done

echo ""
echo "=========================================="
echo "Limpeza concluída!"
echo "=========================================="
echo ""

# VERIFICAÇÃO FINAL (critério de pronto)
echo "Verificando se restaram ocorrências de NEXIA em títulos..."
echo ""

if grep -rnE "<title>[^<]*NEXIA" --include="*.html" public apps nexia-ai viajante-pro 2>/dev/null; then
    echo "ERRO: Ainda foram encontradas ocorrências de NEXIA em títulos:"
    echo ""
    grep -rnE "<title>[^<]*NEXIA" --include="*.html" public apps nexia-ai viajante-pro 2>/dev/null
    echo ""
    echo "Por favor, revise os arquivos e tente novamente."
    exit 1
else
    echo "OK: Nenhuma ocorrência de NEXIA encontrada em títulos."
fi

echo ""
echo "=========================================="
echo "Script concluído com sucesso!"
echo "=========================================="
