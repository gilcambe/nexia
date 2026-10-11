# Temporário: gera os corpos pelo FLUX.1-schnell do Hugging Face Spaces (grátis, sem chave).
import os, re, shutil, sys, time
from gradio_client import Client
SEXO = {'m': 'man', 'f': 'woman'}
ROUPA = {'m': 'wearing only plain black athletic shorts, shirtless', 'f': 'wearing a plain black sports bra and plain black athletic shorts'}
PELE = {'clara': 'fair white skin', 'media': 'light olive tan skin, brazilian', 'morena': 'brown skin, latino', 'negra': 'dark black skin, african descent'}
NIVEL = {'magro': 'lean muscular athletic body with visible abs, low body fat',
         'medio': 'average fit body, slightly soft belly, moderate body fat',
         'alto': 'slightly overweight body with a soft belly and some love handles, about 25 percent body fat, not obese'}
VISTA = {'frente': 'facing the camera, front view', 'lado': 'standing in strict side profile facing right, side view',
         'costas': 'seen from behind, back view, facing away from the camera'}
def prompt(k):
    s, p, n, v = re.match(r'^(m|f)-(clara|media|morena|negra)-(magro|medio|alto)-(frente|lado|costas)$', k).groups()
    return (f'Wide full body shot, camera far away. Ultra realistic full length studio photograph of one adult {SEXO[s]}, {PELE[p]}, {NIVEL[n]}, {ROUPA[s]}, barefoot, '
            f'standing straight and relaxed with arms hanging slightly away from the body, {VISTA[v]}. The whole body from the top of the head '
            'to the feet is visible and nothing is cut off, the person fills only the middle 70 percent of the frame height with empty space above the head and below the feet, centered. Plain light gray seamless '
            'studio background, soft even lighting, natural realistic skin texture, sharp focus, DSLR photo, 85mm lens.')
os.makedirs('corpos', exist_ok=True)
log = open(f"corpos/log-hf-{os.environ.get('PARTE', 0)}.txt", 'a')
spaces = ['black-forest-labs/FLUX.1-schnell']
client = None
for sp in spaces:
    try: client = Client(sp); break
    except Exception as e: print(sp, 'erro', e, file=log, flush=True)
if not client: sys.exit(0)
ks = open('corpos-hf.txt').read().split()
parte, total = int(os.environ.get('PARTE', 0)), int(os.environ.get('TOTAL', 1))
ks = ks[parte::total]
for n in (1, 2):
    for k in ks:
        if os.path.exists(f'corpos/{k}__{n}.webp'): continue
        try:
            img, seed = client.predict(prompt(k), 0, True, 1024, 1024, 4, api_name='/infer')
            shutil.copy(img, f'corpos/{k}__{n}.webp'); print(k, n, 'ok', file=log, flush=True)
        except Exception as e:
            print(k, n, 'erro', str(e)[:300], file=log, flush=True)
            if 'quota' in str(e).lower(): sys.exit(0)
