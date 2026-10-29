#!/bin/bash

# Script para limpar referências NEXIA nos diretórios especificados
# Substitui NEXIA CORTEX por Cortex e ajusta títulos e metadatos
#
# REGRAS DE SUBSTITUIÇÃO:
# 1. Substitui "NEXIA CORTEX — Plataforma de IA" por "Cortex — Plataforma de IA"
#    Ex: "NEXIA CORTEX — Plataforma de IA" → "Cortex — Plataforma de IA"
# 2. Substitui completamente <title> ou og:site_name contendo NEXIA por 'Cortex'
#    Ex: <title>Meu Site NEXIA CORTEX — Plataforma de IA</title> → <title>Cortex</title>
#    Ex: og:site_name="Meu Site NEXIA" → og:site_name="Cortex"
# 3. Remove apenas a palavra NEXIA de outros atributos ou textos dentro de <title> ou og:site_name
#    Ex: <title>Meu Site NEXIA CORTEX — Plataforma de IA</title> → <title>Meu Site Cortex — Plataforma de IA</title>
#    Ex: property="og:site_name" content="Meu Site NEXIA" → property="og:site_name" content="Meu Site"
#
# COMO EXECUTAR AO FINAL DA PR:
#   1. Abra um terminal na raiz do repositório
#   2. Rode: bash scripts/clean-nexia.sh
#   3. Confirme que o script termina com 'Nenhuma ocorrência de NEXIA encontrada em títulos.'
#   4. Se houver arquivos alterados, faça commit e abra a PR normalmente.
#
# EXECUÇÃO AUTOMÁTICA NA PR:
# Para adicionar execução automática ao final da PR:
#   1. Crie o arquivo .github/workflows/clean-nexia-pr.yml com o conteúdo abaixo
#   2. Adicione o arquivo à PR
#   3. O script será executado automaticamente antes do merge
#   4. Se alterações forem feitas, o commit será adicionado automaticamente à PR
#
# Conteúdo para .github/workflows/clean-nexia-pr.yml:
# ---
# name: Clean NEXIA References
# on:
#   pull_request:
#     branches: [ develop ]
#     types: [opened, synchronize]
# jobs:
#   clean:
#     runs-on: ubuntu-latest
#     steps:
#       - uses: actions/checkout@v4
#         with:
#           token: ${{ secrets.GITHUB_TOKEN }}
#       - name: Clean NEXIA references
#         run: bash scripts/clean-nexia.sh
#         continue-on-error: true
# ---

# --- VARIAVEIS E DIRETORIOS ---

set -e

# O script cria backup automático dos arquivos antes de modificá-los
# Flag para limpar backups em caso de erro
ERROR_OCCURRED=0
trap 'ERROR_OCCURRED=1; cleanup_backups' ERR

# Diretórios para processar conforme solicitado no pedido
# Inclui: public/, apps/ e nexia-ai/site-kit/
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
    # Esta substituição é direta e mantém o resto do texto intacto
    if sed -i 's/NEXIA CORTEX — Plataforma de IA/Cortex — Plataforma de IA/g' "$file"; then
        changes_made=1
    fi

    # (2) Substitui completamente <title> contendo NEXIA por 'Cortex'
    # Ex: <title>Meu Site NEXIA CORTEX — Plataforma de IA</title> → <title>Cortex</title>
    # Ex: <title>Qualquer texto com NEXIA no meio</title> → <title>Cortex</title>
    if sed -i 's/<title>.*NEXIA.*<\/title>/<title>Cortex<\/title>/g' "$file"; then
        changes_made=1
    fi
    
    # (3) Substitui completamente og:site_name contendo NEXIA por 'Cortex'
    # Ex: og:site_name="Meu Site NEXIA" → og:site_name="Cortex"
    # Ex: og:site_name="Qualquer texto com NEXIA" → og:site_name="Cortex"
    if sed -i 's/og:site_name=".*NEXIA.*"/og:site_name="Cortex"/g' "$file"; then
        changes_made=1
    fi
    
    # (4) Substitui completamente property="og:site_name" content contendo NEXIA por 'Cortex'
    # Ex: property="og:site_name" content="Meu Site NEXIA" → property="og:site_name" content="Cortex"
    # Ex: property="og:site_name" content="Qualquer texto com NEXIA" → property="og:site_name" content="Cortex"
    if sed -i 's/property="og:site_name" content=".*NEXIA.*"/property="og:site_name" content="Cortex"/g' "$file"; then
        changes_made=1
    fi
    
    # (5) Remove apenas a palavra NEXIA de outros atributos ou textos dentro de <title>
    # Ex: <title>Meu Site NEXIA CORTEX — Plataforma de IA</title> → <title>Meu Site Cortex — Plataforma de IA</title>
    # Ex: <title>Meu Site NEXIA</title> → <title>Meu Site</title>
    if sed -i 's/<title>\([^<]*\)NEXIA\([^<]*\)<\/title>/<title>\1\2<\/title>/g' "$file"; then
        changes_made=1
    fi
    
    # (6) Remove apenas a palavra NEXIA de outros atributos ou textos dentro de og:site_name
    # Ex: og:site_name="Meu Site NEXIA" → og:site_name="Meu Site"
    # Ex: og:site_name="Site NEXIA Legal" → og:site_name="Site Legal"
    if sed -i 's/og:site_name="\([^"]*\)NEXIA\([^"]*\)"/og:site_name="\1\2"/g' "$file"; then
        changes_made=1
    fi
    
    # (7) Remove apenas a palavra NEXIA de outros atributos ou textos dentro de property="og:site_name" content
    # Ex: property="og:site_name" content="Meu Site NEXIA" → property="og:site_name" content="Meu Site"
    # Ex: property="og:site_name" content="Site NEXIA Legal" → property="og:site_name" content="Site Legal"
    if sed -i 's/property="og:site_name" content="\([^"]*\)NEXIA\([^"]*\)"/property="og:site_name" content="\1\2"/g' "$file"; then
        changes_made=1
    fi
    

    
    if [ "$changes_made" -eq 1 ]; then
        echo "  Arquivo modificado: $original_file"
    fi
}

# --- FUNÇÃO DE PROCESSAMENTO DE DIRETORIOS ---

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

# --- FUNÇÃO DE LIMPEZA DE BACKUPS ---

# Função para remover os backups após a execução
cleanup_backups() {
    echo ""
    echo "Removendo arquivos de backup..."
    # Garante que só remove backups dos diretórios processados
    for dir in $DIRECTORIES; do
        if [ -d "$dir" ]; then
            find "$dir" -name "*.bak" -type f -delete 2>/dev/null || true
        fi
    done
    echo "✓ Backups removidos com sucesso."
}

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

# Limpar backups após a execução
cleanup_backups

# Se houve erro, sair com código de erro
echo ""
echo "========================================"
if [ "$ERROR_OCCURRED" -eq 1 ]; then
    echo "ERRO ocorreu durante a execução."
    exit 1
else
    echo "Script executado com sucesso!"
fi
echo "========================================"
echo ""

# --- VERIFICAÇÃO FINAL ---

# Verificar se ainda existem ocorrências de NEXIA em títulos
echo ""
echo "Verificando se restaram ocorrências de NEXIA em títulos..."

# Comando exato conforme solicitado no pedido
# Verifica apenas os diretórios especificados: public, apps e nexia-ai/site-kit
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
