import sys
from PIL import Image

LOGO = 'sites/splash/logo-splash.png'
OUT_DIR = 'sites/splash/agenda'

def gerar_icone(src, dst, tamanho, margem=0):
    img = Image.open(src).convert('RGBA')
    w, h = img.size
    # escalar mantendo proporcao para caber no tamanho alvo (menos margem)
    area = tamanho - 2 * margem
    escala = min(area / w, area / h)
    novo_w = max(1, round(w * escala))
    novo_h = max(1, round(h * escala))
    img = img.resize((novo_w, novo_h), Image.LANCZOS)
    # canvas transparente
    canvas = Image.new('RGBA', (tamanho, tamanho), (0, 0, 0, 0))
    pos = ((tamanho - novo_w) // 2, (tamanho - novo_h) // 2)
    canvas.paste(img, pos, img)
    canvas.save(dst, 'PNG')
    print(f'Gerado: {dst} ({tamanho}x{tamanho}, margem={margem})')

if __name__ == '__main__':
    try:
        gerar_icone(LOGO, f'{OUT_DIR}/icone-192.png', 192)
        gerar_icone(LOGO, f'{OUT_DIR}/icone-512.png', 512)
        # maskable: 512x512 com 10% de margem transparente
        gerar_icone(LOGO, f'{OUT_DIR}/icone-maskable-512.png', 512, margem=51)
        print('Concluido. Verifique os arquivos em', OUT_DIR)
    except FileNotFoundError as e:
        print(f'Erro: {e}', file=sys.stderr)
        sys.exit(1)
    except ImportError:
        print('Erro: Pillow nao instalado. Rode: pip install pillow', file=sys.stderr)
        sys.exit(1)
