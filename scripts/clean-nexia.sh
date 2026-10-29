#!/bin/bash

# Script para limpar referências NEXIA nos diretórios public/, apps/, nexia-ai/ e viajante-pro/
# - Substitui "NEXIA CORTEX — Plataforma de IA" por "Cortex — Plataforma de IA"
# - Remove apenas a palavra NEXIA dentro de <title> e og:site_name, mantendo o restante do conteúdo
# - Executa verificação final ao término

set -e

DIRECTORIES="public/ apps/ nexia-ai/ viajante-pro/"

echo ""
echo "========================================"
echo "Iniciando limpeza de referências NEXIA..."
echo "========================================"
echo ""

# Processa cada diretório recursivamente
for dir in $DIRECTORIES; do
    if [ -d "$dir" ]; then
        echo "Processando diretório: $dir"
        find "$dir" -type f \( -name "*.html" -o -name "*.htm" \) -print0 | while IFS= read -r -d '' file; do
            # (1) Substitui a string literal, mantendo o restante do texto
            sed -i 's/NEXIA CORTEX — Plataforma de IA/Cortex — Plataforma de IA/g' "$file"

            # (2) Remove apenas a palavra NEXIA dentro de <title>, mantendo o restante
            sed -i 's/<title>\([^<]*\)NEXIA\([^<]*\)<\/title>/<title>\1\2<\/title>/g' "$file"

            # (3) Remove apenas a palavra NEXIA dentro de og:site_name="...", mantendo o restante
            sed -i 's/og:site_name="\([^"]*\)NEXIA\([^"]*\)"/og:site_name="\1\2"/g' "$file"

            # (4) Remove apenas a palavra NEXIA dentro de property="og:site_name" content="...", mantendo o restante
            sed -i 's/property="og:site_name" content="\([^"]*\)NEXIA\([^"]*\)"/property="og:site_name" content="\1\2"/g' "$file"
        done
    else
        echo "Diretório não encontrado: $dir"
    fi
done

echo ""
echo "========================================"
echo "Limpeza concluída!"
echo "========================================"
echo ""

# VERIFICAÇÃO FINAL (conforme pedido)
echo ""
echo "Verificando se restaram ocorrências de NEXIA em títulos..."

if grep -rnE "<title>[^<]*NEXIA" --include=*.html public apps nexia-ai viajante-pro 2>/dev/null; then
    echo ""
    echo "ERRO: Ainda foram encontradas ocorrências de NEXIA em títulos:"
    echo ""
    grep -rnE "<title>[^<]*NEXIA" --include=*.html public apps nexia-ai viajante-pro 2>/dev/null
    echo ""
    echo "Por favor, revise os arquivos e tente novamente."
    exit 1
else
    echo "✓ Nenhuma ocorrência de NEXIA encontrada em títulos."
fi
