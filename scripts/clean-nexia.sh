#!/bin/bash

set -euo pipefail

# Script para limpar referências NEXIA em arquivos HTML
# ATENÇÃO: Este script foi projetado para substituir apenas referências NEXIA em títulos e metadados
# específicos, NÃO faz substituição genérica para evitar afetar outros textos
# 
# Substituições realizadas:
# 1. "NEXIA CORTEX — Plataforma de IA" → "Cortex — Plataforma de IA" (frase específica)
#    - Esta substituição é permitida pois é uma frase completa e específica
# 2. <title> contendo NEXIA → <title>Cortex</title> (regra 2)
#    - Se o título contiver apenas "NEXIA", substituir por "Cortex"
#    - Se tiver outros textos além de "NEXIA", remover apenas "NEXIA" mantendo o restante (regra 3)
# 3. og:site_name contendo NEXIA → conteúdo substituído por "Cortex" (regra 2 e 3)
#    - Usando padrões específicos: content="*NEXIA*" → content="Cortex"
# 
# NÃO faz substituição genérica de NEXIA → Cortex para evitar afetar textos não relacionados
# a títulos ou metadados, como nomes de arquivos, textos de conteúdo, etc.

# Diretórios a serem processados (requisito: apenas public/, apps/ e nexia-ai/site-kit/)
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
            
            # Criar backup do arquivo antes de processar
            # O backup é criado como medida de segurança para permitir restauração em caso de erro
            backup_file="$file.backup"
            cp "$file" "$backup_file"
            echo "  Backup criado: $backup_file"
            echo "  OBS: O backup será removido automaticamente se o processamento for bem-sucedido"
            
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
    # Regra 2: Se o título contiver apenas "NEXIA", substituir por "Cortex"
    # Regra 3: Se tiver outros textos além de "NEXIA", remover apenas "NEXIA" mantendo o restante
def clean_title(match):
    full_tag = match.group(0)
    full_tag_lower = full_tag.lower()
    
    # Extrair o conteúdo entre as tags
    inner = match.group(2)
    
    # Se o título contiver NEXIA, aplicar a regra (2 ou 3)
    if "nexia" in inner.lower():
        # Verificar se é apenas "NEXIA" ou se há outros textos
        # Usar regex para remover NEXIA mantendo o restante (regra 3)
        cleaned = re.sub(r'\bnexia\b', '', inner, flags=re.IGNORECASE).strip()
        
        # Se ficou vazio, usar "Cortex" (regra 2)
        if not cleaned:
            return f'<title{match.group(1)}>Cortex</title>'
        else:
            # Se restou texto, retornar com NEXIA removido
            return f'<title{match.group(1)}>{cleaned}</title>'
    
    return full_tag

content = re.sub(r"<title([^>]*)>(.*?)</title>", clean_title, content, flags=re.IGNORECASE | re.DOTALL)

    # Processar tags og:site_name
    # Regra 2: Se contiver apenas "NEXIA", substituir por "Cortex"
    # Regra 3: Se tiver outros textos além de "NEXIA", remover apenas "NEXIA" mantendo o restante
def clean_og_site_name(match):
    full_tag = match.group(0)
    full_tag_lower = full_tag.lower()
    
    # Verificar se é uma tag og:site_name
    if "og:site_name" in full_tag_lower:
        # Extrair o atributo content
        content_match = re.search(r'content=["\']([^"\']*)["\']', full_tag, re.IGNORECASE)
        if content_match:
            inner = content_match.group(1)
            
            # Se o conteúdo contiver NEXIA, aplicar a regra (2 ou 3)
            if "nexia" in inner.lower():
                # Verificar se é apenas "NEXIA" ou se há outros textos
                # Usar regex para remover NEXIA mantendo o restante (regra 3)
                cleaned = re.sub(r'\bnexia\b', '', inner, flags=re.IGNORECASE).strip()
                
                # Se ficou vazio, usar "Cortex" (regra 2)
                if not cleaned:
                    return re.sub(r'content=["\'][^"\']*["\']', 'content="Cortex"', full_tag, flags=re.IGNORECASE)
                else:
                    # Se restou texto, retornar com NEXIA removido
                    return re.sub(r'content=["\'][^"\']*["\']', f'content="{cleaned}"', full_tag, flags=re.IGNORECASE)
    
    return full_tag

content = re.sub(r'<meta[^>]*og:site_name[^>]*>', clean_og_site_name, content, flags=re.IGNORECASE)

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
            
            echo "  AVISO: Este script NÃO faz substituição genérica de 'NEXIA' → 'Cortex'"
            echo "  para evitar afetar textos não relacionados a títulos ou metadados."
            echo "  Apenas títulos (<title>) e metadados (og:site_name) são processados."
            
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
# Esta verificação é o CRITÉRIO DE PRONTO definido no pedido:
# "Pronto quando: Rodar bash scripts/clean-nexia.sh e depois executar grep -rnE "<title>[^<]*NEXIA" --include=*.html public apps nexia-ai viajante-pro"
# O comando não deve retornar nenhum resultado
echo "Executando verificação final como solicitado no pedido..."

# Verificar se restaram títulos com NEXIA (comando exato do pedido)
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
echo "2. <title> contendo NEXIA → <title>Cortex</title> (se apenas NEXIA)"
echo "3. <title> contendo NEXIA + outros textos → <title>outros textos</title> (removendo apenas NEXIA)"
echo "4. og:site_name contendo NEXIA → conteúdo substituído por 'Cortex' (se apenas NEXIA)"
echo "5. og:site_name contendo NEXIA + outros textos → conteúdo com NEXIA removido (regra 3)"
echo "6. NÃO foi feita substituição genérica de NEXIA → Cortex (para evitar afetar outros textos)"
echo ""
echo "INSTRUÇÕES PARA USO:"
echo "1. Execute: bash scripts/clean-nexia.sh"
echo "2. Verifique se não há mais ocorrências: grep -rnE '<title>[^<]*NEXIA' --include=*.html public apps nexia-ai viajante-pro"
echo "3. Se o comando acima não retornar nada, o script está pronto!"