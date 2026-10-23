#!/usr/bin/env python3
# Gera os ícones da agenda Splash a partir de sites/splash/logo-splash.png
# Uso: python3 sites/splash/agenda/gerar-icones.py

import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # sites/splash
LOGO = os.path.join(ROOT, "logo-splash.png")
OUT_DIR = os.path.join(ROOT, "agenda")

TARGETS = {
    "icone-192.png": (192, 192, False),
    "icone-512.png": (512, 512, False),
    "icone-maskable-512.png": (512, 512, True),
}


def gerar_icone(logo_path, out_path, size, maskable):
    with Image.open(logo_path) as img:
        img = img.convert("RGBA")
        w, h = size
        if maskable:
            # Margem de segurança de 10%: a imagem ocupa 90% do canvas
            inner = int(w * 0.9)
            resized = img.resize((inner, inner), Image.LANCZOS)
            canvas = Image.new("RGBA", (w, h), (0, 0, 0, 0))
            offset = (w - inner) // 2
            canvas.paste(resized, (offset, offset), resized)
        else:
            canvas = img.resize((w, h), Image.LANCZOS)
        canvas.save(out_path, "PNG")
        print(f"Gerado: {out_path} ({canvas.size[0]}x{canvas.size[1]})")


def main():
    if not os.path.isfile(LOGO):
        raise SystemExit(f"Logo não encontrado: {LOGO}")
    os.makedirs(OUT_DIR, exist_ok=True)
    for nome, (w, h, maskable) in TARGETS.items():
        gerar_icone(LOGO, os.path.join(OUT_DIR, nome), (w, h), maskable)


if __name__ == "__main__":
    main()
