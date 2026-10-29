#!/bin/bash

# Script para limpar referências NEXIA nos diretórios public/, apps/ e nexia-ai/site-kit/
#
# Requisitos:
#   (1) "NEXIA CORTEX — Plataforma de IA"  →  "Cortex — Plataforma de IA"
#   (2) <title> ou og:site_name contendo a palavra NEXIA → substituído inteiramente por "Cortex"
#   (3) remover apenas a palavra "NEXIA" de outros atributos/textos dentro de
#       <title> ou og:site_name, mantendo o restante do conteúdo
#
# Executa verificação final ao término.

set -euo pipefail

DIRECTORIES="public/ apps/ nexia-ai/site-kit/"

echo ""
echo "=========================================="
echo "Iniciando limpeza de referências NEXIA..."
echo "=========================================="
echo ""

# Processa cada diretório recursivamente
for dir in $DIRECTORIES; do
    if [ -d "$dir" ]; then
        echo "Processando diretório: $dir"
        find "$dir" -type f \( -name "*.html" -o -name "*.htm" \) -print0 | while IFS= read -r -d '' file; do
            # (1) Substitui a string literal exata, mantendo o restante do texto
            sed -i 's/NEXIA CORTEX — Plataforma de IA/Cortex — Plataforma de IA/g' "$file"

            # (2) Substitui completamente o conteúdo de <title> que contenha NEXIA por "Cortex"
            sed -i 's/<title>[^<]*NEXIA[^<]*<\/title>/<title>Cortex<\/title>/gi' "$file"

            # (2b) Substitui completamente o valor de og:site_name que contenha NEXIA por "Cortex"
            sed -i 's/og:site_name="[^"]*NEXIA[^"]*"/og:site_name="Cortex"/gi' "$file"

            # (3) Remove apenas a palavra "NEXIA" de atributos dentro da tag de abertura <title ...>
            #     mantendo o restante dos atributos e do conteúdo da tag
            sed -i 's/<title \([^>]*\)NEXIA\([^>]*\)>/<title \1\2>/gi' "$file"

            # (3b) Remove apenas a palavra "NEXIA" de og:site_name, mantendo o restante do valor
            sed -i 's/og:site_name="\([^"]*\)NEXIA\([^"]*\)"/og:site_name="\1\2"/gi' "$file"
        done
    else
        echo "Diretório não encontrado: $dir"
    fi
done

echo ""
echo "=========================================="
echo "Limpeza concluída!"
echo "=========================================="
echo ""

# VERIFICAÇÃO FINAL (conforme pedido)
echo ""
echo "Verificando se restaram ocorrências de NEXIA em títulos..."

if grep -rnE "<title>[^<]*NEXIA" --include=*.html public apps nexia-ai/site-kit 2>/dev/null; then
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
