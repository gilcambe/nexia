#!/usr/bin/env python3
"""Gera os ícones PNG do painel de agenda Splash a partir de sites/splash/logo-splash.png.

Uso (na raiz do repositório):
    python gerar-icones-agenda.py

Requisitos:
    pip install Pillow
"""

from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent
LOGO = ROOT / "sites" / "splash" / "logo-splash.png"
DEST = ROOT / "sites" / "splash" / "agenda"

TAMANHOS = {
    "icone-192.png": (192, False),
    "icone-512.png": (512, False),
    "icone-maskable-512.png": (512, True),
}


def gerar_icone(origem: Path, destino: Path, tamanho: int, maskable: bool) -> None:
    img = Image.open(origem).convert("RGBA")
    if maskable:
        # Margem transparente de 10% (safe zone do formato maskable)
        margem = int(tamanho * 0.10)
        conteudo = tamanho - 2 * margem
        img = img.resize((conteudo, conteudo), Image.LANCZOS)
        tela = Image.new("RGBA", (tamanho, tamanho), (0, 0, 0, 0))
        tela.paste(img, (margem, margem), img)
        tela.save(destino, "PNG")
    else:
        img = img.resize((tamanho, tamanho), Image.LANCZOS)
        img.save(destino, "PNG")


def main() -> None:
    if not LOGO.exists():
        raise SystemExit(f"Logo não encontrado: {LOGO}")
    DEST.mkdir(parents=True, exist_ok=True)
    for nome, (t, maskable) in TAMANHOS.items():
        gerar_icone(LOGO, DEST / nome, t, maskable)
        print(f"Gerado: {DEST / nome}")


if __name__ == "__main__":
    main()
