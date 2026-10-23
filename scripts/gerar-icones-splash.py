#!/usr/bin/env python3
# Gera os ícones do painel Splash a partir de sites/splash/logo-splash.png
# Uso: python scripts/gerar-icones-splash.py

from PIL import Image
import os

LOGO = "sites/splash/logo-splash.png"
OUT_DIR = "sites/splash/agenda"


def gerar_icone(tamanho, maskable=False, saida=None):
    if not os.path.exists(LOGO):
        raise FileNotFoundError(f"Logo não encontrado: {LOGO}")

    img = Image.open(LOGO).convert("RGBA")
    largura, altura = img.size

    # Redimensiona mantendo a proporção, cabendo dentro do quadrado alvo
    escala = tamanho / max(largura, altura)
    novo_w = round(largura * escala)
    novo_h = round(altura * escala)
    img = img.resize((novo_w, novo_h), Image.LANCZOS)

    if maskable:
        # Margem de segurança de 10% (5% em cada lado) para máscara adaptativa
        margem = round(tamanho * 0.10)
        conteudo = tamanho - 2 * margem
        escala2 = conteudo / max(largura, altura)
        cw = round(largura * escala2)
        ch = round(altura * escala2)
        img = img.resize((cw, ch), Image.LANCZOS)
        canvas = Image.new("RGBA", (tamanho, tamanho), (0, 0, 0, 0))
        canvas.paste(img, ((tamanho - cw) // 2, (tamanho - ch) // 2), img)
        img = canvas
    else:
        canvas = Image.new("RGBA", (tamanho, tamanho), (0, 0, 0, 0))
        canvas.paste(img, ((tamanho - novo_w) // 2, (tamanho - novo_h) // 2), img)
        img = canvas

    os.makedirs(OUT_DIR, exist_ok=True)
    caminho = saida or os.path.join(OUT_DIR, f"icone-{tamanho}.png")
    img.save(caminho, "PNG")
    print(f"Gerado: {caminho} ({img.size[0]}x{img.size[1]})")


def main():
    gerar_icone(192, maskable=False, saida=os.path.join(OUT_DIR, "icone-192.png"))
    gerar_icone(512, maskable=False, saida=os.path.join(OUT_DIR, "icone-512.png"))
    gerar_icone(512, maskable=True, saida=os.path.join(OUT_DIR, "icone-maskable-512.png"))
    print("Concluído.")


if __name__ == "__main__":
    main()
