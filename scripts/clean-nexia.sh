#!/bin/bash

# Script para limpar referências NEXIA nos diretórios especificados
# Substitui NEXIA CORTEX por Cortex e ajusta títulos e metadados
#
# COMO EXECUTAR AO FINAL DA PR:
#   1. Abra um terminal na raiz do repositório na branch nexia/criar-o-script-scripts-clean-nexia-sh-qu-6f1bd8
#   2. Rode: bash scripts/clean-nexia.sh
#   3. Confirme que o script termina com 'Nenhuma ocorrência de NEXIA encontrada em títulos.'
#   4. Se houver arquivos alterados, faça commit e abra a PR normalmente.


set -e

# Atenção: este script modifica os arquivos no local, sem criar backup.
# Recomenda-se fazer backup dos diretórios antes de executar.

# Diretórios para processar conforme solicitado no pedido
DIRECTORIES="public/ apps/ nexia-ai/site-kit/"

# Função para processar um arquivo
process_file() {
    local file="$1"
    
    # Criar backup do arquivo antes de modificar
    cp "$file" "$file.bak"
    echo "Backup criado: $file.bak"

    # (1) Substituir "NEXIA CORTEX — Plataforma de IA" por "Cortex — Plataforma de IA"
    sed -i 's/NEXIA CORTEX — Plataforma de IA/Cortex — Plataforma de IA/g' "$file"

    # (2) Substituir <title> contendo NEXIA por <title>Cortex</title>
    # Se o título contiver NEXIA, substituir por Cortex
    sed -E -i 's/<title>.*NEXIA.*<\/title>/<title>Cortex<\/title>/g' "$file"
    
    # (3) Substituir og:site_name contendo NEXIA por og:site_name="Cortex"
    # Se og:site_name contiver NEXIA, substituir por Cortex
    sed -E -i 's/og:site_name=".*NEXIA.*"/og:site_name="Cortex"/g' "$file"
    sed -E -i 's/property="og:site_name" content=".*NEXIA.*"/property="og:site_name" content="Cortex"/g' "$file"
}

# Função para processar diretórios recursivamente
process_directories() {
    for dir in $DIRECTORIES; do
        if [ -d "$dir" ]; then
            echo "Processando diretório: $dir"
            find "$dir" -type f \( -name "*.html" -o -name "*.htm" \) -print0 | while IFS= read -r -d '' file; do
                process_file "$file"
            done
        else
            echo "Diretório não encontrado: $dir"
        fi
    done
}

# Executar o processamento
echo "Iniciando limpeza de referências NEXIA..."
process_directories
echo "Limpeza concluída!"

# Verificar se ainda existem ocorrências de NEXIA em títulos
echo "Verificando se restaram ocorrências de NEXIA em títulos..."
if grep -rnE "<title>[^<]*NEXIA" --include=*.html public apps nexia-ai/site-kit viajante-pro 2>/dev/null; then
    echo "AVISO: Ainda foram encontradas ocorrências de NEXIA em títulos:"
    exit 1
else
    echo "Nenhuma ocorrência de NEXIA encontrada em títulos."
fi

exit 0
