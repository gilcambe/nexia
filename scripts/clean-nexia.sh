#!/bin/bash

# Script para limpar referências NEXIA nos diretórios especificados
# Substitui NEXIA CORTEX por Cortex e ajusta títulos e metadatos
#
# COMO EXECUTAR AO FINAL DA PR:
#   1. Abra um terminal na raiz do repositório na branch nexia/criar-o-script-scripts-clean-nexia-sh-qu-6f1bd8
#   2. Rode: bash scripts/clean-nexia.sh
#   3. Confirme que o script termina com 'Nenhuma ocorrência de NEXIA encontrada em títulos.'
#   4. Se houver arquivos alterados, faça commit e abra a PR normalmente.

# --- VARIAVEIS E DIRETORIOS ---

set -e

# O script cria backup automático dos arquivos antes de modificá-los

# Diretórios para processar conforme solicitado no pedido
DIRECTORIES="public/ apps/ nexia-ai/site-kit/"

# --- FUNÇÃO DE PROCESSAMENTO DE ARQUIVO ---

# Função para processar um arquivo
process_file() {
    local file="$1"
    local original_file="$file"
    local changes_made=0
    
    # Criar backup do arquivo antes de modificar
    cp "$file" "$file.bak"
    echo "Backup criado: $file.bak"

    # (1) Substituir "NEXIA CORTEX — Plataforma de IA" por "Cortex — Plataforma de IA"
    if sed -i 's/NEXIA CORTEX — Plataforma de IA/Cortex — Plataforma de IA/g' "$file" 2>/dev/null; then
        changes_made=1
    fi

    # (2) Substitui todo o conteúdo de <title> que contenha NEXIA por "Cortex"
    # Para <title>: substitui todo o conteúdo (ex: <title>Meu Projeto NEXIA</title> → <title>Cortex</title>)
    if sed -E -i 's/<title>.*NEXIA.*<\/title>/<title>Cortex<\/title>/g' "$file" 2>/dev/null; then
        changes_made=1
    fi
    
    # (3) Remove apenas a palavra NEXIA de og:site_name, mantendo o restante do atributo
    # Para og:site_name="...": remove somente NEXIA (ex: og:site_name="Meu Site NEXIA" → og:site_name="Meu Site ")
    if sed -E -i 's/(og:site_name="[^"]*)NEXIA([^"]*")/\1\2/g' "$file" 2>/dev/null; then
        changes_made=1
    fi
    
    # (4) Remove apenas a palavra NEXIA de property="og:site_name" content="...", mantendo o restante
    if sed -E -i 's/(property="og:site_name" content="[^"]*)NEXIA([^"]*")/\1\2/g' "$file" 2>/dev/null; then
        changes_made=1
    fi
    
    if [ "$changes_made" -eq 1 ]; then
        echo "  Arquivo modificado: $original_file"
    fi
}

# --- FUNÇÃO DE PROCESSAMENTO DE DIRETÓRIOS ---

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

# --- VERIFICAÇÃO FINAL ---

# Verificar se ainda existem ocorrências de NEXIA em títulos
echo ""
echo "Verificando se restaram ocorrências de NEXIA em títulos..."

# Buscar em todos os diretórios processados
if grep -rnE "<title>[^<]*NEXIA" --include=*.html $DIRECTORIES 2>/dev/null; then
    echo ""
    echo "ERRO: Ainda foram encontradas ocorrências de NEXIA em títulos:"
    echo ""
    grep -rnE "<title>[^<]*NEXIA" --include=*.html $DIRECTORIES 2>/dev/null
    echo ""
    echo "Por favor, revise os arquivos e tente novamente."
    exit 1
else
    echo "✓ Nenhuma ocorrência de NEXIA encontrada em títulos."
fi

# Verificar se ainda existem ocorrências de NEXIA em og:site_name
if grep -rnE "og:site_name.*NEXIA" --include=*.html $DIRECTORIES 2>/dev/null; then
    echo ""
    echo "ERRO: Ainda foram encontradas ocorrências de NEXIA em og:site_name:"
    echo ""
    grep -rnE "og:site_name.*NEXIA" --include=*.html $DIRECTORIES 2>/dev/null
    echo ""
    echo "Por favor, revise os arquivos e tente novamente."
    exit 1
else
    echo "✓ Nenhuma ocorrência de NEXIA encontrada em og:site_name."
fi

# Verificar se ainda existem ocorrências de NEXIA em property="og:site_name"
if grep -rnE 'property="og:site_name".*NEXIA' --include=*.html $DIRECTORIES 2>/dev/null; then
    echo ""
    echo "ERRO: Ainda foram encontradas ocorrências de NEXIA em property="og:site_name":"
    echo ""
    grep -rnE 'property="og:site_name".*NEXIA' --include=*.html $DIRECTORIES 2>/dev/null
    echo ""
    echo "Por favor, revise os arquivos e tente novamente."
    exit 1
else
    echo "✓ Nenhuma ocorrência de NEXIA encontrada em property="og:site_name"."
fi

# --- EXECUÇÃO ---

# Executar o processamento
echo ""
echo "========================================"
echo "Iniciando limpeza de referências NEXIA..."
echo "========================================"
echo ""

process_directories

echo ""
echo "========================================"
echo "Limpeza concluída!"
echo "========================================"
echo ""

exit 0