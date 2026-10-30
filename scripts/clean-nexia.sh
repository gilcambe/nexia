#!/bin/bash

set -euo pipefail

DIRECTORIES="public/ apps/ nexia-ai/site-kit/ viajante-pro"
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
            # (feito apenas no Python script abaixo para evitar duplicação)

# Passo 2: Substituir <title> ou og:site_name contendo NEXIA por Cortex (ou remover a palavra NEXIA mantendo o restante)
            python3 -c '\nimport sys, re

filepath = sys.argv[1]
with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
    content = f.read()

# (1) Substituição específica de "NEXIA CORTEX — Plataforma de IA"
content = content.replace("NEXIA CORTEX — Plataforma de IA", "Cortex — Plataforma de IA")

# (2) Processar tags <title>...</title> - substituir NEXIA por Cortex mantendo o restante do conteúdo
def clean_title(match):
    full_tag = match.group(0)
    inner = match.group(2)
    if "NEXIA" in inner:
        # Remover apenas NEXIA mantendo o restante do texto
        cleaned = re.sub(r"\bNEXIA\b", "Cortex", inner)
        return full_tag.replace(inner, cleaned)
    return full_tag

content = re.sub(r"<title([^>]*)>(.*?)</title>", clean_title, content, flags=re.IGNORECASE | re.DOTALL)

# (3) Processar tags og:site_name - substituir NEXIA por Cortex mantendo o restante
def clean_og_site_name(match):
    full_tag = match.group(0)
    if "NEXIA" in full_tag:
        # Remover apenas NEXIA mantendo o restante dos atributos
        replaced = re.sub(r"\bNEXIA\b", "Cortex", full_tag)
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
echo "Verificando se restaram ocorrências de NEXIA em títulos e metadados..."
echo ""

# Verificação final: verificar se restaram ocorrências de NEXIA em títulos
if grep -rnE "<title>[^<]*NEXIA" --include="*.html" public apps nexia-ai/site-kit viajante-pro 2>/dev/null; then
    echo "ERRO: Ainda foram encontradas ocorrências de NEXIA em títulos:"
    echo ""
    grep -rnE "<title>[^<]*NEXIA" --include="*.html" public apps nexia-ai/site-kit viajante-pro 2>/dev/null
    echo ""
    echo "Por favor, revise os arquivos e tente novamente."
    exit 1
else
    echo "OK: Nenhuma ocorrência de NEXIA encontrada em títulos nos diretórios especificados."
fi

# Verificação adicional: og:site_name
if grep -rnE "og:site_name" --include="*.html" public apps nexia-ai/site-kit viajante-pro 2>/dev/null | grep -i nexia; then
    echo "AVISO: Ainda foram encontradas ocorrências de NEXIA em og:site_name (verificar manualmente):"
    echo ""
    grep -rnE "og:site_name" --include="*.html" public apps nexia-ai/site-kit viajante-pro 2>/dev/null | grep -i nexia
    echo ""
    echo "Por favor, revise os arquivos."
    exit 1
else
    echo "OK: Nenhuma ocorrência de NEXIA encontrada em og:site_name nos diretórios especificados."
fi

echo ""
echo "=========================================="
echo "Script concluído com sucesso!"
echo "=========================================="

