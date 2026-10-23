#!/usr/bin/env python3
"""Gera os ícones do painel da Amanda a partir do logo do Splash.

Execução: python gerar-icones-splash.py (na raiz do repositório)
Requisitos: Pillow (pip install pillow)
"""
from PIL import Image
import os
import sys

SRC = "sites/splash/logo-splash.png"
OUT_DIR = "sites/splash/agenda"


def make_square(img, size):
    """Redimensiona mantendo proporção e centraliza em fundo transparente."""
    img = img.convert("RGBA")
    img.thumbnail((size, size), Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    x = (size - img.width) // 2
    y = (size - img.height) // 2
    canvas.paste(img, (x, y))
    return canvas


def make_maskable(img, size):
    """Ícone maskable com margem de segurança de 10%."""
    img = img.convert("RGBA")
    safe = int(size * 0.9)
    img.thumbnail((safe, safe), Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    x = (size - img.width) // 2
    y = (size - img.height) // 2
    canvas.paste(img, (x, y))
    return canvas


def main():
    if not os.path.isfile(SRC):
        print(f"ERRO: não encontrei {SRC}", file=sys.stderr)
        sys.exit(1)

    os.makedirs(OUT_DIR, exist_ok=True)

    logo = Image.open(SRC)

    icone_192 = make_square(logo, 192)
    icone_192.save(os.path.join(OUT_DIR, "icone-192.png"), format="PNG")
    print("Criado:", os.path.join(OUT_DIR, "icone-192.png"))

    icone_512 = make_square(logo, 512)
    icone_512.save(os.path.join(OUT_DIR, "icone-512.png"), format="PNG")
    print("Criado:", os.path.join(OUT_DIR, "icone-512.png"))

    maskable = make_maskable(logo, 512)
    maskable.save(os.path.join(OUT_DIR, "icone-maskable-512.png"), format="PNG")
    print("Criado:", os.path.join(OUT_DIR, "icone-maskable-512.png"))

    print(f"Ícones gerados em {OUT_DIR}/")


if __name__ == "__main__":
    main()
