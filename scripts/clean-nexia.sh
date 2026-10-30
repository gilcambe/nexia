#!/bin/bash

set -euo pipefail

DIRECTORIES="public/ apps/ nexia-ai/site-kit/"
echo ""
echo "=========================================="
echo "Iniciando limpeza de referências NEXIA..."
echo "=========================================="
echo ""

# Criar backup dos arquivos antes das substituições
BACKUP_DIR="backup_nexia_clean_$(date +%Y%m%d_%H%M%S)"
echo "Criando backup dos arquivos em: $BACKUP_DIR"
mkdir -p "$BACKUP_DIR"

# Verificar se os diretórios existem
for dir in $DIRECTORIES; do
    if [ ! -d "$dir" ]; then
        echo "AVISO: Diretório não encontrado: $dir - pulando"
        continue
    fi
done

for dir in $DIRECTORIES; do
    if [ -d "$dir" ]; then
        echo "Processando diretório: $dir"
        find "$dir" -type f \( -name "*.html" -o -name "*.htm" \) -print0 | while IFS= read -r -d '' file; do
            echo "  Processando arquivo: $file"
            
            # Criar backup do arquivo
            backup_file="$BACKUP_DIR/$(basename "$file")"
cp "$file" "$backup_file"
            echo "    Backup criado: $backup_file"

            # Substituir "NEXIA CORTEX — Plataforma de IA" por "Cortex — Plataforma de IA"
            sed -i 's/\bNEXIA CORTEX — Plataforma de IA\b/Cortex — Plataforma de IA/g' "$file"
            
            # Substituir NEXIA por Cortex em títulos e og:site_name
            python3 - "$file" << 'PYEOF'
import re, sys

filepath = sys.argv[1]
with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
    content = f.read()

# Passo 1: Substituir "NEXIA CORTEX — Plataforma de IA" por "Cortex — Plataforma de IA"
content = re.sub(r'\bNEXIA CORTEX — Plataforma de IA\b', 'Cortex — Plataforma de IA', content)

# Processar tags <title>...</title>
# Se o título contém NEXIA, substituir todo o conteúdo por "Cortex" (regra 2)
def clean_title(match):
    full_tag = match.group(0)
    inner = match.group(2)
    if "NEXIA" in inner:
        return f"<title{match.group(1)}>Cortex</title>"
    return full_tag

content = re.sub(r"<title([^>]*)>(.*?)</title>", clean_title, content, flags=re.IGNORECASE | re.DOTALL)

# Processar tags og:site_name - se contém NEXIA, substituir o conteúdo por "Cortex" (regra 2)
def clean_og_site_name(match):
    full_tag = match.group(0)
    if "NEXIA" in full_tag:
        # Substituir o valor do atributo content por "Cortex", mantendo os demais atributos
        replaced = re.sub(r'(content=["\'])[^"\']*(["\'])', r'\1Cortex\2', full_tag, flags=re.IGNORECASE)
        return replaced
    return full_tag

content = re.sub(r"<meta[^>]*og:site_name[^>]*>", clean_og_site_name, content, flags=re.IGNORECASE)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
PYEOF
            
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

# VERIFICAÇÃO FINAL (critério de pronto)
echo "Verificando se restaram ocorrências de NEXIA em títulos e metadados..."
echo ""

# Verificação final: verificar se restaram ocorrências de NEXIA em títulos
# Usando o comando exato solicitado no pedido (sem viajante-pro, pois não foi solicitado no pedido)
if grep -rnE "<title>[^<]*NEXIA" --include="*.html" public apps nexia-ai 2>/dev/null; then
    echo "ERRO: Ainda foram encontradas ocorrências de NEXIA em títulos:"
    echo ""
    grep -rnE "<title>[^<]*NEXIA" --include="*.html" public apps nexia-ai 2>/dev/null
    echo ""
    echo "Por favor, revise os arquivos e tente novamente."
    exit 1
else
    echo "OK: Nenhuma ocorrência de NEXIA encontrada em títulos nos diretórios especificados."
fi

# Verificação adicional: og:site_name
if grep -rnE "og:site_name" --include="*.html" public apps nexia-ai 2>/dev/null | grep -i nexia; then
    echo "AVISO: Ainda foram encontradas ocorrências de NEXIA em og:site_name (verificar manualmente):"
    echo ""
    grep -rnE "og:site_name" --include="*.html" public apps nexia-ai 2>/dev/null | grep -i nexia
    echo ""
    echo "Por favor, revise os arquivos."
    exit 1
else
    echo "OK: Nenhuma ocorrência de NEXIA encontrada em og:site_name nos diretórios especificados."
fi

echo ""
echo "=========================================="
echo "Script concluído com sucesso!"
echo "=========================================="

