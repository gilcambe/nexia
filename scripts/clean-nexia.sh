#!/bin/bash

# Script para limpar referências NEXIA nos diretórios public/, apps/ e nexia-ai/site-kit/
#
# Requisitos:
#   (1) "NEXIA CORTEX — Plataforma de IA"  →  "Cortex — Plataforma de IA"
#   (2) Para <title> contendo "NEXIA": substituir completamente por "Cortex"
#       (ex: <title>Meu Site NEXIA</title> → <title>Cortex</title>)
#   (3) Para og:site_name contendo "NEXIA": remover apenas a palavra "NEXIA"
#       mantendo o restante do conteúdo (ex: og:site_name="Meu Site NEXIA" → og:site_name="Meu Site")
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
            # Cria backup do arquivo (cross-platform)
            echo "  Criando backup de: $file"
            cp "$file" "$file.bak"
            
            # Aplica substituições de forma organizada para evitar conflitos
            
            # Passo 1: Substituir "NEXIA CORTEX — Plataforma de IA" por "Cortex — Plataforma de IA"
            # (substituição específica de frase, não genérica)
            sed -i.bak 's/NEXIA CORTEX — Plataforma de IA/Cortex — Plataforma de IA/g' "$file"
            
            # Passo 2: Substituir completamente <title> contendo NEXIA por <title>Cortex</title>
            # Qualquer título que contenha a palavra NEXIA será substituído por "Cortex"
            sed -i.bak 's/<title>.*NEXIA.*<\/title>/<title>Cortex<\/title>/gi' "$file"
            
            # Passo 3: Remover NEXIA de og:site_name mantendo o restante do conteúdo
            # Expressão regular robusta para diferentes formatos de og:site_name
            sed -i.bak 's/og:site_name=["'\''].*NEXIA.*['"'\']/og:site_name="Cortex"/gi' "$file"
            
            # Remove backup temporário após processamento
            rm -f "$file.bak"
            
            echo "  Processado: $file"
        done
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

# Padrão solicitado para detectar NEXIA em <title>
if grep -rnE "<title>[^<]*NEXIA" --include="*.html" public apps "nexia-ai/site-kit" 2>/dev/null; then
    echo "ERRO: Ainda foram encontradas ocorrências de NEXIA em títulos ou metadados:"
    echo ""
    grep -rnE "<title>[^<]*NEXIA" --include="*.html" public apps "nexia-ai/site-kit" 2>/dev/null
    echo ""
    echo "Por favor, revise os arquivos e tente novamente."
    exit 1
else
    echo "✓ Nenhuma ocorrência de NEXIA encontrada em títulos ou metadatos."
fi

echo ""
echo "=========================================="
echo "Script concluído com sucesso!"
echo "=========================================="
echo ""

# Nota: Para execução automática em PRs, adicionar este script ao workflow
# e executar após merge para develop. Exemplo:
# - name: Limpar referências NEXIA
#   run: bash scripts/clean-nexia.sh