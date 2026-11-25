"""Generate honest side-by-side comparison sheets (Reference vs Actual Blender Render).

Strictly ZERO reference pixels are blended onto model panels.
Usage:
  python3 compare_v2.py <version_tag>
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

VERSION_TAG = sys.argv[1] if len(sys.argv) > 1 else "v1-blockout"
ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / "assets" / "freedom-head" / "v2-rebuild"
REF_DIR = BASE / "ref"
VER_DIR = BASE / VERSION_TAG
RND_DIR = VER_DIR / "renders"

font_lg = ImageFont.load_default(size=18)
font_sm = ImageFont.load_default(size=14)

def fit_square(img, size=500, bg=(135, 135, 138)):
    im = img.convert("RGB")
    w, h = im.size
    scale = min(size / w, size / h)
    nw, nh = int(round(w * scale)), int(round(h * scale))
    im = im.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (size, size), bg)
    canvas.paste(im, ((size - nw) // 2, (size - nh) // 2))
    return canvas


def build_grid(mode, out_name, views):
    cell = 480
    hdr = 36
    pad = 8
    cols = len(views)
    W = cols * (cell + pad) + pad
    H = 2 * (cell + hdr) + 3 * pad + 26
    canvas = Image.new("RGB", (W, H), (235, 235, 238))
    draw = ImageDraw.Draw(canvas)

    for idx, (vkey, vlabel) in enumerate(views):
        x0 = pad + idx * (cell + pad)
        # Row 0: Reference (cropped cleanly from 6-view sheet)
        ref_im = Image.open(REF_DIR / f"{vkey}.png").convert("RGB")
        # Crop bottom label strip (bottom 38px) cleanly for uniform proportion comparison
        rw, rh = ref_im.size
        ref_clean = ref_im.crop((0, 0, rw, rh - 36))
        ref_sq = fit_square(ref_clean, cell, bg=(138, 138, 140))

        # Row 1: Actual Blender render (100% pure render pixels)
        rnd_im = Image.open(RND_DIR / f"{mode}-{vkey}.png").convert("RGB")
        rnd_sq = fit_square(rnd_im, cell, bg=(110, 110, 112))

        y0 = pad
        draw.text((x0 + 8, y0 + 7), f"REFERENCE / {vlabel}", font=font_lg, fill=(20, 20, 20))
        canvas.paste(ref_sq, (x0, y0 + hdr))

        y1 = pad + hdr + cell + pad
        mode_title = "CLAY" if mode == "clay" else "SHADED"
        short_ver = VERSION_TAG.split("-")[0]
        draw.text((x0 + 8, y1 + 8), f"{short_ver} ({mode_title}) / {vlabel}", font=font_lg, fill=(15, 60, 120))
        canvas.paste(rnd_sq, (x0, y1 + hdr))

    footer = f"{VERSION_TAG} | Pure side-by-side comparison. Model panels contain ZERO reference pixels."
    draw.text((pad + 6, H - 24), footer, font=font_sm, fill=(40, 40, 40))
    out_path = VER_DIR / out_name
    canvas.save(out_path)
    print("Wrote:", out_path)


# 1. Primary 4-view comparison (3/4 PRIMARY first, then Front, Side, Top)
primary_views = [
    ("three_quarter", "3/4 (PRIMARY)"),
    ("front", "FRONT"),
    ("side", "LEFT SIDE"),
    ("top", "TOP"),
]
build_grid("clay", "compare-clay-4view.png", primary_views)
build_grid("shaded", "compare-shaded-4view.png", primary_views)

# 2. Rear views comparison (Rear 3/4 + Back)
rear_views = [
    ("rear_three_quarter", "REAR 3/4"),
    ("back", "BACK"),
]
build_grid("clay", "compare-clay-rear.png", rear_views)

# 3. Dedicated Vent Protrusion & Blade Thickness 3-view closeup strip (Requirement #3)
vent_views = [
    ("vent_closeup_34", "VENT 3/4 CLOSEUP"),
    ("vent_closeup_side", "VENT SIDE CLOSEUP"),
    ("vent_closeup_top", "VENT TOP-OBLIQUE CLOSEUP"),
]
cell = 480
hdr = 36
pad = 8
W = 3 * (cell + pad) + pad
H = cell + hdr + 2 * pad + 24
vc = Image.new("RGB", (W, H), (235, 235, 238))
vd = ImageDraw.Draw(vc)
for idx, (vkey, vlabel) in enumerate(vent_views):
    x0 = pad + idx * (cell + pad)
    im = fit_square(Image.open(RND_DIR / f"clay-{vkey}.png"), cell, bg=(110, 110, 112))
    vd.text((x0 + 8, pad + 7), f"{VERSION_TAG} / {vlabel}", font=font_lg, fill=(15, 60, 120))
    vc.paste(im, (x0, pad + hdr))
vd.text((pad + 6, H - 22), "Independent protruding side vent frame + recessed thick blades check (pure clay render).", font=font_sm, fill=(40, 40, 40))
vout = VER_DIR / "vent-structure-closeup.png"
vc.save(vout)
print("Wrote:", vout)
