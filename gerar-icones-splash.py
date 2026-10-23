#!/usr/bin/env python3
"""Gera os ícones do Splash a partir de sites/splash/logo-splash.png.

Execução (na raiz do repositório):
    python gerar-icones-splash.py

Requisito: Pillow (pip install pillow)
"""
from PIL import Image
import os

SRC = "sites/splash/logo-splash.png"
OUT_DIR = "sites/splash/agenda"

ICONS = [
    ("icone-192.png", 192, 192, False),
    ("icone-512.png", 512, 512, False),
    ("icone-maskable-512.png", 512, 512, True),
]


def gerar_icones():
    if not os.path.exists(SRC):
        raise FileNotFoundError(f"Logo não encontrado: {SRC}")

    os.makedirs(OUT_DIR, exist_ok=True)

    with Image.open(SRC) as img:
        img = img.convert("RGBA")
        largura, altura = img.size
        lado = min(largura, altura)
        esquerda = (largura - lado) // 2
        topo = (altura - lado) // 2
        img_quadrada = img.crop((esquerda, topo, esquerda + lado, topo + lado))

        for nome, tamanho, _, maskable in ICONS:
            if maskable:
                # Margem de segurança de 10% para o formato maskable
                margem = int(tamanho * 0.10)
                conteudo_tamanho = tamanho - 2 * margem
                icone = img_quadrada.resize(
                    (conteudo_tamanho, conteudo_tamanho), Image.LANCZOS
                )
                canvas = Image.new("RGBA", (tamanho, tamanho), (0, 0, 0, 0))
                canvas.paste(icone, (margem, margem), icone)
            else:
                canvas = img_quadrada.resize((tamanho, tamanho), Image.LANCZOS)

            caminho = os.path.join(OUT_DIR, nome)
            canvas.save(caminho, "PNG")
            print(f"Criado: {caminho} ({tamanho}x{tamanho})")


if __name__ == "__main__":
    gerar_icones()
