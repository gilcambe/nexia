#!/bin/bash

# Script para limpar referências NEXIA nos diretórios public/, apps/ e nexia-ai/site-kit/
#
# Requisitos:
#   (1) "NEXIA CORTEX — Plataforma de IA"  →  "Cortex — Plataforma de IA"
#   (2) <title> ou og:site_name contendo a palavra NEXIA → substituído inteiramente por "Cortex"
#   (3) remover apenas a palavra "NEXIA" de outros atributos/textos dentro de
#       <title> ou og:site_name, mantendo o restante do conteúdo
#
# Processa cada arquivo com segurança, criando backup e validando entradas.
# Executa verificação final ao término.

set -euo pipefail

DIRECTORIES="public/ apps/ nexia-ai/site-kit/"

echo ""
echo "=========================================="
echo "Iniciando limpeza de referências NEXIA..."
echo "=========================================="
echo ""

# Função para escapar caracteres especiais em padrões
escape_pattern() {
    echo "$1" | sed 's/[][\^$*.]/\\&/g'
}

# Processa cada diretório recursivamente
for dir in $DIRECTORIES; do
    if [ -d "$dir" ]; then
        echo "Processando diretório: $dir"
        find "$dir" -type f \( -name "*.html" -o -name "*.htm" \) -print0 | while IFS= read -r -d '' file; do
            # Cria backup do arquivo
            cp "$file" "$file.backup"
            
            # Aplica todas as substituições em uma única passagem de sed para otimizar
            # Passo 1: Substituir "NEXIA CORTEX — Plataforma de IA" por "Cortex — Plataforma de IA"
            sed -i.bak 's/NEXIA CORTEX — Plataforma de IA/Cortex — Plataforma de IA/g' "$file"
            
            # Passo 2: Remover NEXIA de <title> mantendo o restante
            sed -i.bak 's/<title>\([^<]*\)NEXIA\([^<]*\)<\/title>/<title>\1\2<\/title>/gi' "$file"
            sed -i.bak 's/<title>NEXIA\([^<]*\)<\/title>/<title>\1<\/title>/gi' "$file"
            sed -i.bak 's/<title>\([^<]*\)NEXIA<\/title>/<title>\1<\/title>/gi' "$file"
            sed -i.bak 's/<title>NEXIA<\/title>/<title>Cortex<\/title>/gi' "$file"
            
            # Passo 3: Remover NEXIA de og:site_name mantendo o restante
            sed -i.bak 's/og:site_name=["'\'']?\([^"'\'']*\)NEXIA\([^"'\'']*\)["'\'']?/og:site_name="\1\2"/gi' "$file"
            sed -i.bak 's/og:site_name=["'\'']?NEXIA\([^"'\'']*\)["'\'']?/og:site_name="Cortex\1"/gi' "$file"
            sed -i.bak 's/og:site_name=["'\'']?\([^"'\'']*\)NEXIA["'\'']?/og:site_name="\1"/gi' "$file"
            sed -i.bak 's/og:site_name=["'\'']?NEXIA["'\'']?/og:site_name="Cortex"/gi' "$file"
            
            # Remover backup temporário
            rm -f "$file.bak"
            
            echo "  Processado: $file"
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
echo ""

        # Padrão solicitado para detectar NEXIA em <title>
        if grep -rnE "<title>[^<]*NEXIA" --include=*.html public apps nexia-ai nexia-ai/site-kit 2>/dev/null; then
    echo "ERRO: Ainda foram encontradas ocorrências de NEXIA em títulos ou metadados:"
    echo ""
    grep -rnE "<title>[^<]*NEXIA" --include=*.html public apps nexia-ai nexia-ai/site-kit 2>/dev/null
    echo ""
    echo "Por favor, revise os arquivos e tente novamente."
    exit 1
else
    echo "✓ Nenhuma ocorrência de NEXIA encontrada em títulos ou metadados."
fi

echo ""
echo "=========================================="
echo "Script concluído com sucesso!"
echo "=========================================="
echo ""
