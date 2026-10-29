#!/bin/bash

# Script para limpar referências NEXIA nos diretórios public/, apps/ e nexia-ai/site-kit/
# - Substitui "NEXIA CORTEX — Plataforma de IA" por "Cortex — Plataforma de IA"
# - Substitui completamente títulos e og:site_name contendo NEXIA por "Cortex"
# - Executa verificação final ao término

set -e

DIRECTORIES="public/ apps/ nexia-ai/site-kit/"

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

            # (2) Qualquer ocorrência de <title> contendo a palavra NEXIA deve ser substituída por "Cortex"
            sed -i 's/<title>[^<]*NEXIA[^<]*<\/title>/<title>Cortex<\/title>/ig' "$file"
            sed -i 's/<title>.*NEXIA.*<\/title>/<title>Cortex<\/title>/ig' "$file"
            
            # (2b) Qualquer ocorrência de og:site_name contendo a palavra NEXIA deve ser substituída por "Cortex"
            sed -i 's/og:site_name="[^"]*NEXIA[^"]*"/og:site_name="Cortex"/ig' "$file"
            sed -i 's/content="[^"]*NEXIA[^"]*" *property="og:site_name"/content="Cortex" property="og:site_name"/ig' "$file"
            sed -i 's/property="og:site_name" *content="[^"]*NEXIA[^"]*"/property="og:site_name" content="Cortex"/ig' "$file"
            sed -i 's/<meta property="og:site_name" content="[^"]*NEXIA[^"]*">/<meta property="og:site_name" content="Cortex">/ig' "$file"
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

if grep -rnE "<title>[^<]*NEXIA" --include=*.html public apps nexia-ai/site-kit/ viajante-pro 2>/dev/null; then
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
