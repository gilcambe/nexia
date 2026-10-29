#!/bin/bash

# Script para limpar referências NEXIA nos diretórios public/, apps/ e nexia-ai/site-kit/
#
# Requisitos:
#   (1) "NEXIA CORTEX — Plataforma de IA"  →  "Cortex — Plataforma de IA"
#   (2) <title> ou og:site_name contendo a palavra NEXIA → substituído inteiramente por "Cortex"
#   (3) remover apenas a palavra "NEXIA" de outros atributos/textos dentro de
#       <title> ou og:site_name, mantendo o restante do conteúdo
#
# Processa cada arquivo uma única vez com múltiplas expressões sed.
# Executa verificação final ao término.

set -euo pipefail

DIRECTORIES="public/ apps/ nexia-ai/site-kit/ viajante-pro/"

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
            # Aplica todas as substituições em uma única passagem de sed para otimizar
            sed -i \
                -e 's/NEXIA CORTEX — Plataforma de IA/Cortex — Plataforma de IA/g' \
                -e 's/<title>[^<]*NEXIA[^<]*<\/title>/<title>Cortex<\/title>/gi' \
                -e 's/<title>\([^<]*\)NEXIA\([^<]*\)<\/title>/<title>\1\2<\/title>/gi' \
                -e 's/<title>\s*<\/title>/<title>Cortex<\/title>/gi' \
                -e "s/og:site_name='\([^']*\)NEXIA\([^']*\)'/og:site_name='\1\2'/gi" \
                -e "s/og:site_name='\s*'/og:site_name='Cortex'/gi" \
                "$file"
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

if grep -rnE "<title>[^<]*NEXIA" --include=*.html public apps nexia-ai/site-kit viajante-pro 2>/dev/null; then
    echo ""
    echo "ERRO: Ainda foram encontradas ocorrências de NEXIA em títulos:"
    echo ""
    grep -rnE "<title>[^<]*NEXIA" --include=*.html public apps nexia-ai/site-kit viajante-pro 2>/dev/null
    echo ""
    echo "Por favor, revise os arquivos e tente novamente."
    exit 1
else
    echo "✓ Nenhuma ocorrência de NEXIA encontrada em títulos."
fi

echo ""
echo "=========================================="
echo "Limpeza concluída!"
echo "=========================================="
echo ""
# Verifica og:site_name restante
if grep -rnE "og:site_name=[^>]*NEXIA" --include=*.html public apps nexia-ai/site-kit viajante-pro 2>/dev/null; then
    echo ""
    echo "ERRO: Ainda foram encontradas ocorrências de NEXIA em og:site_name:"
    echo ""
    grep -rnE "og:site_name=[^>]*NEXIA" --include=*.html public apps nexia-ai/site-kit viajante-pro 2>/dev/null
    exit 1
else
    echo "✓ Nenhuma ocorrência de NEXIA encontrada em og:site_name."
fi
