#!/bin/bash

set -euo pipefail

# Script para limpar referências NEXIA em arquivos HTML
# Substituições realizadas:
# 1. "NEXIA CORTEX — Plataforma de IA" → "Cortex — Plataforma de IA" (frase específica)
# 2. <title> contendo NEXIA → <title>Cortex</title> (regra 2)
# 3. og:site_name contendo NEXIA → conteúdo substituído por "Cortex" (regra 2 e 3)
# NÃO faz substituição genérica de NEXIA → Cortex para evitar afetar textos não relacionados

# Diretórios a serem processados
DIRECTORIES="public/ apps/ nexia-ai/site-kit/"

echo ""
echo "=========================================="
echo "Iniciando limpeza de referências NEXIA..."
echo "=========================================="
echo ""

# Verificar se Python3 está disponível
if ! command -v python3 &> /dev/null; then
    echo "ERRO: Python3 não encontrado. Instale python3 para continuar."
    exit 1
fi

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
            
            # Criar backup do arquivo antes de processar (opcional, pode ser removido se não necessário)
            backup_file="$file.backup"
            cp "$file" "$backup_file"
            echo "  Backup criado: $backup_file"
            
            # Substituir "NEXIA CORTEX — Plataforma de IA" por "Cortex — Plataforma de IA"
            # (Esta substituição específica é permitida pois é uma frase completa e específica)
            if sed -i 's/\bNEXIA CORTEX — Plataforma de IA\b/Cortex — Plataforma de IA/g' "$file" 2>/dev/null; then
                echo "  Substituição 1 concluída"
            else
                echo "  AVISO: Falha na substituição 1 - pulando"
            fi
            
            # Substituir NEXIA por Cortex em títulos e og:site_name
            if python3 - "$file" << 'PYEOF' 2>/dev/null; then
import re, sys

filepath = sys.argv[1]
try:
    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()
    
    # Verificar tamanho do arquivo (limite de 10MB)
    if len(content) > 10 * 1024 * 1024:
        print(f"AVISO: Arquivo muito grande: {filepath} - pulando processamento Python")
        sys.exit(0)
    
    # Passo 1: Substituir "NEXIA CORTEX — Plataforma de IA" por "Cortex — Plataforma de IA"
    # (Esta substituição específica é permitida pois é uma frase completa e específica)
    content = re.sub(r'\bNEXIA CORTEX — Plataforma de IA\b', 'Cortex — Plataforma de IA', content)
    
    # Processar tags <title>...</title>
    # Se o título contém NEXIA, substituir TODO o conteúdo do título por 'Cortex'
def clean_title(match):
    full_tag = match.group(0)
    inner = match.group(2)
    if "NEXIA" in inner:
        # Substituir TODO o conteúdo do título por 'Cortex'
        return f'<title{match.group(1)}>Cortex</title>'
    return full_tag

content = re.sub(r"<title([^>]*)>(.*?)</title>", clean_title, content, flags=re.IGNORECASE | re.DOTALL)

    # Processar tags og:site_name - se contém NEXIA, substituir conteúdo por 'Cortex'
    # Usando padrões mais específicos para evitar falsos positivos
def clean_og_site_name(match):
    full_tag = match.group(0)
    # Usar padrões mais específicos para og:site_name para evitar falsos positivos
    if "NEXIA" in full_tag and "og:site_name" in full_tag:
        # Substituir TODO o conteúdo do og:site_name por 'Cortex'
        # Padrão específico: content="qualquer_coisa_contendo_NEXIA" -> content="Cortex"
        return re.sub(r'(content=["\'])[^"\']*["\']', r'\1Cortex\2', full_tag, flags=re.IGNORECASE)
    return full_tag

content = re.sub(r'<meta[^>]*og:site_name[^>]*content=["\'][^"\']*NEXIA[^"\']*[^>]*>', clean_og_site_name, content, flags=re.IGNORECASE)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
PYEOF
                echo "  Processamento Python concluído"
            else
                echo "  AVISO: Falha no processamento Python - tentando restaurar backup"
                if [ -f "$backup_file" ]; then
                    cp "$backup_file" "$file"
                    echo "  Backup restaurado"
                fi
            fi
            
            # Remover backup se tudo deu certo
            if [ -f "$backup_file" ]; then
                rm "$backup_file"
                echo "  Backup removido"
            fi
            
            echo "  ATENÇÃO: Este script NÃO faz substituição genérica de 'NEXIA' → 'Cortex'"
            echo "  para evitar afetar textos não relacionados a títulos ou metadados."
            
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

# Verificação final: garantir que TODOS os títulos e og:site_name contendo NEXIA foram substituídos por 'Cortex'
echo "Executando verificação final como solicitado no pedido..."

# Verificar se restaram títulos com NEXIA
titles_with_nexia=$(grep -rnE "<title>[^<]*NEXIA" --include="*.html" public apps nexia-ai viajante-pro 2>/dev/null || true)
if [ -n "$titles_with_nexia" ]; then
    echo "ERRO: Ainda foram encontradas ocorrências de NEXIA em títulos:"
    echo ""
    echo "$titles_with_nexia"
    echo ""
    echo "Por favor, revise os arquivos e tente novamente."
    exit 1
else
    echo "OK: Nenhuma ocorrência de NEXIA encontrada em títulos nos diretórios especificados."
fi

# Verificar se restaram og:site_name com NEXIA
og_with_nexia=$(grep -rnE "og:site_name" --include="*.html" public apps nexia-ai viajante-pro 2>/dev/null | grep -i nexia || true)
if [ -n "$og_with_nexia" ]; then
    echo "ERRO: Ainda foram encontradas ocorrências de NEXIA em og:site_name:"
    echo ""
    echo "$og_with_nexia"
    echo ""
    echo "Por favor, revise os arquivos e tente novamente."
    exit 1
else
    echo "OK: Nenhuma ocorrência de NEXIA encontrada em og:site_name nos diretórios especificados."
fi

echo ""
echo "=========================================="
echo "Script concluído com sucesso!"
echo "=========================================="
echo ""
echo "RESUMO DAS SUBSTITUIÇÕES REALIZADAS:"
echo "1. 'NEXIA CORTEX — Plataforma de IA' → 'Cortex — Plataforma de IA' (frase específica)"
echo "2. <title> contendo NEXIA → <title>Cortex</title>"
echo "3. og:site_name contendo NEXIA → conteúdo substituído por 'Cortex'"
echo "4. NÃO foi feita substituição genérica de NEXIA → Cortex (para evitar afetar outros textos)"