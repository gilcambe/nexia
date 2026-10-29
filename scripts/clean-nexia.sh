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
#
# NOTAS:
# - O script usa sed com múltiplas expressões (-e) para aplicar todas as substituições
#   em uma única passagem por arquivo, otimizando o desempenho.
# - A verificação final usa grep para garantir que não restou nenhum NEXIA em
#   <title> ou og:site_name nos diretórios processados.

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
            # Aplica todas as substituições em uma única passagem de sed para otimizar
                # Passo 1: Substituir "NEXIA CORTEX — Plataforma de IA" por "Cortex — Plataforma de IA"
            sed -i \\
                -e 's/NEXIA CORTEX — Plataforma de IA/Cortex — Plataforma de IA/g' \\
                # Passo 2: Qualquer <title> que contenha NEXIA vira <title>Cortex</title>
                -e "s/<title>[^<]*NEXIA[^<]*<\/title>/<title>Cortex<\/title>/gi" \\
                # Passo 3: Qualquer og:site_name que contenha NEXIA vira og:site_name='Cortex'
                -e "s/og:site_name=['"]?[^'"]*NEXIA[^'"]*['"]?/og:site_name='Cortex'/gi" \\
                # Passo 4: Remover apenas "NEXIA" de <title> mantendo o restante (após substituição completa)
                -e "s/<title>\([^<]*\)NEXIA\([^<]*\)<\/title>/<title>\1\2<\/title>/gi" \\
                # Passo 5: Remover apenas "NEXIA" de og:site_name mantendo o restante (após substituição completa)
                -e "s/og:site_name=['"]?\([^'"]*\)NEXIA\([^'"]*\)['"]?/og:site_name='\1\2'/gi" \\
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

if grep -rnE "<title>[^<]*NEXIA" --include=*.html public apps nexia-ai/site-kit 2>/dev/null; then
    echo ""
    echo "ERRO: Ainda foram encontradas ocorrências de NEXIA em títulos:"
    echo ""
    grep -rnE "<title>[^<]*NEXIA" --include=*.html public apps nexia-ai/site-kit 2>/dev/null
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
if grep -rnE "og:site_name=[^>]*NEXIA" --include=*.html public apps nexia-ai/site-kit 2>/dev/null; then
    echo ""
    echo "ERRO: Ainda foram encontradas ocorrências de NEXIA em og:site_name:"
    echo ""
    grep -rnE "og:site_name=[^>]*NEXIA" --include=*.html public apps nexia-ai/site-kit 2>/dev/null
    exit 1
else
    echo "✓ Nenhuma ocorrência de NEXIA encontrada em og:site_name."
fi
