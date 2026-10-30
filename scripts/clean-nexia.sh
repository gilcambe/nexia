#!/bin/bash

set -euo pipefail

DIRECTORIES="public/ apps/ nexia-ai/site-kit/"
echo ""
echo "=========================================="
echo "Iniciando limpeza de referências NEXIA..."
echo "=========================================="
echo ""

# Verificar se os diretórios existem
for dir in $DIRECTORIES; do
    if [ ! -d "$dir" ]; then
        echo "AVISO: Diretório não encontrado: $dir - pulando"
        continue
    fi
done

for dir in $DIRECTORIES; do
    if [ -d "$dir" ]; then
        echo "Processando diretório: $dir"
        find "$dir" -type f \( -name "*.html" -o -name "*.htm" \) -print0 | while IFS= read -r -d '' file; do
            echo "  Processando arquivo: $file"

            # Criar backup antes de modificar
            cp "$file" "${file}.bak"

            # Passo 1: Substituir "NEXIA CORTEX — Plataforma de IA" por "Cortex — Plataforma de IA"
            sed -i 's/NEXIA CORTEX — Plataforma de IA/Cortex — Plataforma de IA/g' "$file"

            # Passo 2: Processar tags <title>...</title>
            # Substituir NEXIA por Cortex em <title>, mantendo o restante do conteúdo
            # Se for apenas "NEXIA", substitui por "Cortex"
            # Se tiver outros textos, remove apenas "NEXIA" mantendo o restante
            python3 << 'PYEOF'
import re, sys

filepath = sys.argv[1]
with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
    content = f.read()

# Processar tags <title> - substituir NEXIA por Cortex mantendo o restante
def clean_title(match):
    full_tag = match.group(0)
    inner = match.group(2)
    if "NEXIA" in inner:
        # Remover apenas NEXIA mantendo o restante do texto
        cleaned = re.sub(r"\bNEXIA\b", "Cortex", inner)
        return full_tag.replace(inner, cleaned)
    return full_tag

content = re.sub(r"<title([^>]*)>(.*?)</title>", clean_title, content, flags=re.IGNORECASE | re.DOTALL)

# Processar tags og:site_name - substituir NEXIA por Cortex mantendo o restante
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
PYEOF
            "$file"

            echo "  Processado: $file"
        done
        # Remover backups após processamento bem-sucedido
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
if grep -rnE "<title>[^<]*NEXIA" --include="*.html" public apps nexia-ai/site-kit 2>/dev/null; then
    echo "ERRO: Ainda foram encontradas ocorrências de NEXIA em títulos:"
    echo ""
    grep -rnE "<title>[^<]*NEXIA" --include="*.html" public apps nexia-ai/site-kit 2>/dev/null
    echo ""
    echo "Por favor, revise os arquivos e tente novamente."
    exit 1
else
    echo "OK: Nenhuma ocorrência de NEXIA encontrada em títulos nos diretórios especificados."
fi

# Verificação adicional: og:site_name
if grep -rnE "og:site_name" --include="*.html" public apps nexia-ai/site-kit 2>/dev/null | grep -i nexia; then
    echo "AVISO: Ainda foram encontradas ocorrências de NEXIA em og:site_name (verificar manualmente):"
    echo ""
    grep -rnE "og:site_name" --include="*.html" public apps nexia-ai/site-kit 2>/dev/null | grep -i nexia
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

