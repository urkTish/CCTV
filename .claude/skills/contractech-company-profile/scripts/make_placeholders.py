"""Draw the neutral gray photo frames listed in placeholders.json.

Usage:  python3 make_placeholders.py
Writes  ../assets/placeholders/<id>-<lang>.png

Arabic labels need Pillow built with libraqm (for letter joining). Without it the
frames are still written, with the English label only.
"""
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont, features

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "assets", "placeholders")
PX_PER_INCH = 200
GRAY = (217, 217, 217)  # #D9D9D9
LABEL = (64, 64, 64)

FONT_CANDIDATES = [
    "C:/Windows/Fonts/tahoma.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/Library/Fonts/Arial Unicode.ttf",
]


def font(size):
    for path in FONT_CANDIDATES:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def main():
    with open(os.path.join(HERE, "placeholders.json"), encoding="utf-8") as f:
        slots = json.load(f)["slots"]
    os.makedirs(OUT, exist_ok=True)
    raqm = features.check("raqm")
    if not raqm:
        print("Pillow has no libraqm: Arabic frames will carry the English label.", file=sys.stderr)
    for slot in slots:
        w, h = round(slot["w"] * PX_PER_INCH), round(slot["h"] * PX_PER_INCH)
        for lang in ("ar", "en"):
            img = Image.new("RGB", (w, h), GRAY)
            draw = ImageDraw.Draw(img)
            text = slot[lang] if (lang == "en" or raqm) else slot["en"]
            f = font(max(18, round(0.13 * PX_PER_INCH)))
            kwargs = {"direction": "rtl", "language": "ar"} if (lang == "ar" and raqm) else {}
            box = draw.textbbox((0, 0), text, font=f, **kwargs)
            tw, th = box[2] - box[0], box[3] - box[1]
            draw.text(((w - tw) / 2 - box[0], (h - th) / 2 - box[1]), text, font=f, fill=LABEL, **kwargs)
            img.save(os.path.join(OUT, f"{slot['id']}-{lang}.png"), optimize=True)
    print(f"Wrote {len(slots) * 2} frames to {os.path.normpath(OUT)}")


if __name__ == "__main__":
    main()
