#!/bin/bash

# Script para limpar referências NEXIA nos diretórios especificados
# Substitui NEXIA CORTEX por Cortex e ajusta títulos e metadatos
#
# REGRAS DE SUBSTITUIÇÃO:
# 1. Substitui "NEXIA CORTEX — Plataforma de IA" por "Cortex — Plataforma de IA"
# 2. Para <title>: remove apenas a palavra NEXIA mantendo o resto do conteúdo
#    Ex: <title>Meu Site NEXIA CORTEX — Plataforma de IA</title> → <title>Meu Site Cortex — Plataforma de IA</title>
# 3. Para og:site_name: remove apenas a palavra NEXIA mantendo o resto do atributo
#    Ex: og:site_name="Meu Site NEXIA" → og:site_name="Meu Site "
# 4. Para property="og:site_name" content="...": remove apenas NEXIA mantendo o resto
#    Ex: property="og:site_name" content="Meu Site NEXIA" → property="og:site_name" content="Meu Site "
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
# Inclui viajante-pro/ conforme comando de verificação final
DIRECTORIES="public/ apps/ nexia-ai/site-kit/ viajante-pro/"

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
    if sed -i 's/NEXIA CORTEX — Plataforma de IA/Cortex — Plataforma de IA/g' "$file" 2>/dev/null; then
        changes_made=1
    fi

    # (2) Remove apenas a palavra NEXIA de <title> mantendo o restante do conteúdo
    # Para <title>: remove apenas a palavra NEXIA mantendo o resto do conteúdo
    # Ex: <title>Meu Site NEXIA CORTEX — Plataforma de IA</title> → <title>Meu Site Cortex — Plataforma de IA</title>
    # Padrão: <title>(qualquer coisa que não seja <)NEXIA(qualquer coisa que não seja <)</title>
    # Substitui por: <title>(qualquer coisa) + (qualquer coisa)</title>
    if sed -E -i 's/<title>([^<]*)NEXIA([^<]*)<\/title>/<title>\1\2<\/title>/g' "$file" 2>/dev/null; then
        changes_made=1
    fi
    
    # (3) Remove apenas a palavra NEXIA de og:site_name, mantendo o restante do atributo
    # Para og:site_name="...": remove somente a palavra NEXIA mantendo o resto do atributo
    # Ex: og:site_name="Meu Site NEXIA" → og:site_name="Meu Site "
    # Padrão: og:site_name="(qualquer coisa)NEXIA(qualquer coisa)"
    # Substitui por: og:site_name="(qualquer coisa) + (qualquer coisa)"
    if sed -E -i 's/(og:site_name="[^"]*)NEXIA([^"]*")/\1\2/g' "$file" 2>/dev/null; then
        changes_made=1
    fi
    
    # (4) Remove apenas a palavra NEXIA de property="og:site_name" content="...", mantendo o resto do conteúdo
    # Para property="og:site_name" content="...": remove apenas a palavra NEXIA mantendo o resto do conteúdo
    # Ex: property="og:site_name" content="Meu Site NEXIA" → property="og:site_name" content="Meu Site "
    # Padrão: property="og:site_name" content="(qualquer coisa)NEXIA(qualquer coisa)"
    # Substitui por: property="og:site_name" content="(qualquer coisa) + (qualquer coisa)"
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

# Comando exato conforme solicitado no pedido (incluindo viajante-pro)
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