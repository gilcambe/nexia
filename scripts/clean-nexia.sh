#!/bin/bash

# Script para limpar referências NEXIA nos diretórios especificados
# Substitui NEXIA CORTEX por Cortex e ajusta títulos e metadatos
#
# COMO EXECUTAR AO FINAL DA PR:
#   1. Abra um terminal na raiz do repositório na branch nexia/criar-o-script-scripts-clean-nexia-sh-qu-6f1bd8
#   2. Rode: bash scripts/clean-nexia.sh
#   3. Confirme que o script termina com 'Nenhuma ocorrência de NEXIA encontrada em títulos.'
#   4. Se houver arquivos alterados, faça commit e abra a PR normalmente.


set -e

# O script cria backup automático dos arquivos antes de modificá-los

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

    # (2) Remove apenas a palavra NEXIA de <title>, mantendo o restante
    # Para <title>: remove somente NEXIA (ex: <title>Meu Projeto NEXIA</title> → <title>Meu Projeto </title>)
    sed -E -i 's/<title>([^<]*)NEXIA([^<]*)<\/title>/<title>\1\2<\/title>/g' "$file"
    
    # (3) Remove apenas a palavra NEXIA de og:site_name, mantendo o restante do atributo
    # Para og:site_name="...": remove somente NEXIA (ex: og:site_name="Meu Site NEXIA" → og:site_name="Meu Site ")
    sed -E -i 's/(og:site_name="[^"]*)NEXIA([^"]*")/\1\2/g' "$file"
    
    # (4) Remove apenas a palavra NEXIA de property="og:site_name" content="...", mantendo o restante
    sed -E -i 's/(property="og:site_name" content="[^"]*)NEXIA([^"]*")/\1\2/g' "$file"
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
if grep -rnE "<title>[^<]*NEXIA" --include=*.html public apps nexia-ai/site-kit 2>/dev/null; then
    echo "AVISO: Ainda foram encontradas ocorrências de NEXIA em títulos:"
    exit 1
else
    echo "Nenhuma ocorrência de NEXIA encontrada em títulos."
fi

exit 0
