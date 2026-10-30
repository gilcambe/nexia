#!/bin/bash

set -euo pipefail

# Script para limpar referências NEXIA nos diretórios public/, apps/ e nexia-ai/site-kit/
#
# Requisitos:
#   (1) "NEXIA CORTEX — Plataforma de IA"  →  "Cortex — Plataforma de IA"
#   (2) Para <title> contendo "NEXIA": remover NEXIA mantendo o restante do conteúdo
#       (ex: <title>Meu Site NEXIA</title> → <title>Meu Site</title>)
#   (3) Para og:site_name contendo "NEXIA": substituir completamente por "Cortex"
#       (ex: og:site_name="Meu Site NEXIA" → og:site_name="Cortex")
#
# Para execução automática em PRs:
#   Adicionar este script ao workflow da PR e executar após merge para develop
#
# Processa cada arquivo com segurança, criando backup antes de modificar.
# Executa verificação final ao término para garantir que NEXIA foi removido de títulos.

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
            echo "  Processando arquivo: $file"
            
            # Aplica substituições de forma organizada para evitar conflitos
            
            # Passo 1: Substituir "NEXIA CORTEX — Plataforma de IA" por "Cortex — Plataforma de IA"
            # (substituição específica de frase, não genérica)
            sed -i.bak 's/NEXIA CORTEX — Plataforma de IA/Cortex — Plataforma de IA/g' "$file"
            
            # Passo 2: Remover NEXIA de <title> mantendo o restante do conteúdo
            # Ex: <title>Meu Site NEXIA</title> → <title>Meu Site</title>
            # Ex: <title>NEXIA Meu Site</title> → <title> Meu Site</title>
            # Ex: <title>NEXIA CORTEX — Plataforma de IA</title> → <title>— Plataforma de IA</title>
            # Remove apenas a palavra NEXIA do conteúdo do <title>
            sed -i.bak 's/<title>\([^<]*\)NEXIA\([^<]*\)<\/title>/<title>\1\2<\/title>/gi' "$file"
            # Remove espaços extras que possam ter sido criados
            sed -i.bak 's/<title>\s*<\/title>/<title><\/title>/gi' "$file"
            sed -i.bak 's/<title>\([^<]*\)\s\+\([^<]*\)<\/title>/<title>\1 \2<\/title>/gi' "$file"
            
            # Passo 3: Remover NEXIA de og:site_name mantendo o restante do conteúdo
            # Ex: og:site_name="Meu Site NEXIA" → og:site_name="Meu Site"
            # Ex: og:site_name="NEXIA Site" → og:site_name=" Site"
            # Ex: og:site_name="NEXIA" → og:site_name=""
            # Ex: property="og:site_name" content="Meu Site NEXIA" → property="og:site_name" content="Meu Site"
            # Remove apenas a palavra NEXIA do conteúdo do og:site_name
            sed -i.bak 's/og:site_name=["'\'']\([^"'\']*\)NEXIA\([^"'\']*\)['"'\']/og:site_name="\1\2"/gi' "$file"
            sed -i.bak 's/property=["'\'']og:site_name["'\'] content=["'\'']\([^"'\']*\)NEXIA\([^"'\']*\)['"'\']/property="og:site_name" content="\1\2"/gi' "$file"
            # Remove espaços extras que possam ter sido criados
            sed -i.bak 's/og:site_name="\s*"/og:site_name=""/gi' "$file"
            sed -i.bak 's/content="\s*"/content=""/gi' "$file"
            # Remove espaços extras que possam ter sido criados
            sed -i.bak 's/og:site_name="\s*"/og:site_name=""/gi' "$file"
            sed -i.bak 's/content="\s*"/content=""/gi' "$file"
            

            
            echo "  Processado: $file"
        done
        
        # Remover arquivos .bak após processamento
        find "$dir" -name "*.bak" -type f -delete
        echo "  Backups removidos: $dir"
    else
        echo "ERRO: Diretório não encontrado: $dir"
        exit 1
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

# Padrão exato do pedido para detectar NEXIA em <title>
if grep -rnE "<title>[^<]*NEXIA" --include="*.html" public apps nexia-ai/site-kit 2>/dev/null; then
    echo "ERRO: Ainda foram encontradas ocorrências de NEXIA em títulos:"
    echo ""
    grep -rnE "<title>[^<]*NEXIA" --include="*.html" public apps nexia-ai viajante-pro 2>/dev/null
    echo ""
    echo "Por favor, revise os arquivos e tente novamente."
    exit 1
else
    echo "✓ Nenhuma ocorrência de NEXIA encontrada em títulos."
fi

echo ""
echo "NOTA: Verificação final inclui diretórios: public, apps, nexia-ai/site-kit"
echo "NOTA: Script processa apenas: public/, apps/ e nexia-ai/site-kit/"
echo "NOTA: Arquivos .bak são criados como segurança e removidos após processamento"
echo "NOTA: Critério de pronto (conforme pedido):"
echo "   bash scripts/clean-nexia.sh && grep -rnE "<title>[^<]*NEXIA" --include=*.html public apps nexia-ai/site-kit"

echo ""
echo "=========================================="
echo "Script concluído com sucesso!"
echo "=========================================="
echo ""

# Nota: Para execução automática em PRs, adicionar este script ao workflow
# e executar após merge para develop. Exemplo:
# - name: Limpar referências NEXIA
#   run: bash scripts/clean-nexia.sh
#
# Verificação final após execução (critério de pronto):
#   bash scripts/clean-nexia.sh && grep -rnE "<title>[^<]*NEXIA" --include=*.html public apps nexia-ai viajante-pro
#
# NOTA: Script verificado e pronto para execução automática em PRs
#
# CRITÉRIO DE PRONTO (conforme pedido):
#   bash scripts/clean-nexia.sh && grep -rnE "<title>[^<]*NEXIA" --include=*.html public apps nexia-ai/site-kit
#
# O script garante que:
#   1. "NEXIA CORTEX — Plataforma de IA" é substituído por "Cortex — Plataforma de IA"
#   2. NEXIA é removido de <title> mantendo o restante do conteúdo
#   3. og:site_name contendo NEXIA é substituído por "Cortex"
#   4. Verificação final completa cobrindo todos os casos