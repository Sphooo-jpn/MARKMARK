#!/usr/bin/env python3
"""Generate MARKMARK icons (app + .md document) as multi-size .ico files.

Draws the iconic Markdown "M + down-arrow" mark with vector primitives (no font
dependency), supersampled for smooth edges, then exports Windows .ico containing
16/32/48/64/128/256 px layers.
"""
from PIL import Image, ImageDraw

SS = 4               # supersample factor
BASE = 256
S = BASE * SS        # working canvas size

BRAND = (58, 110, 208, 255)      # MARKMARK blue
BRAND_DK = (40, 82, 160, 255)
WHITE = (255, 255, 255, 255)
PAGE = (248, 249, 251, 255)
PAGE_EDGE = (206, 212, 222, 255)


def rounded_rect(draw, box, radius, fill):
    draw.rounded_rectangle(box, radius=radius, fill=fill)


def draw_mark(draw, cx, cy, w, h, color, stroke):
    """Draw the 'M' + down-arrow markdown mark centered in a w*h box at (cx,cy)."""
    left = cx - w // 2
    right = cx + w // 2
    top = cy - h // 2
    bottom = cy + h // 2

    # --- M (occupies left ~62%) ---
    m_right = left + int(w * 0.52)
    mid_x = (left + m_right) // 2
    m_pts = [
        (left, bottom),
        (left, top),
        (mid_x, top + int(h * 0.55)),
        (m_right, top),
        (m_right, bottom),
    ]
    draw.line(m_pts, fill=color, width=stroke, joint="curve")
    # round the endpoints
    r = stroke // 2
    for (x, y) in [(left, bottom), (left, top), (m_right, top), (m_right, bottom)]:
        draw.ellipse([x - r, y - r, x + r, y + r], fill=color)

    # --- down arrow (right side) ---
    ax = right - int(w * 0.14)
    shaft_top = top
    shaft_bottom = bottom - int(h * 0.30)
    draw.line([(ax, shaft_top), (ax, shaft_bottom)], fill=color, width=stroke, joint="curve")
    draw.ellipse([ax - r, shaft_top - r, ax + r, shaft_top + r], fill=color)
    head = int(w * 0.17)
    tri = [(ax - head, shaft_bottom - stroke // 2),
           (ax + head, shaft_bottom - stroke // 2),
           (ax, bottom)]
    draw.polygon(tri, fill=color)


def make_app_icon(path):
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    pad = int(S * 0.06)
    rounded_rect(d, [pad, pad, S - pad, S - pad], radius=int(S * 0.20), fill=BRAND)
    # subtle bottom shade
    d.rounded_rectangle([pad, int(S * 0.72), S - pad, S - pad], radius=int(S * 0.20), fill=BRAND_DK)
    rounded_rect(d, [pad, pad, S - pad, int(S * 0.80)], radius=int(S * 0.20), fill=BRAND)
    draw_mark(d, S // 2, int(S * 0.52), int(S * 0.56), int(S * 0.40), WHITE, int(S * 0.075))
    save_ico(img, path)


def make_doc_icon(path):
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # page with folded top-right corner
    m = int(S * 0.14)
    fold = int(S * 0.22)
    left, top, right, bottom = m, int(S * 0.06), S - m, S - int(S * 0.06)
    page = [
        (left, top), (right - fold, top), (right, top + fold),
        (right, bottom), (left, bottom),
    ]
    d.polygon(page, fill=PAGE, outline=PAGE_EDGE, width=max(1, int(S * 0.006)))
    # folded corner triangle
    d.polygon([(right - fold, top), (right - fold, top + fold), (right, top + fold)],
              fill=PAGE_EDGE)
    # brand header band
    band_top = int(S * 0.18)
    d.rectangle([left, band_top, right, band_top + int(S * 0.11)], fill=BRAND)
    # the M-down mark in brand blue, lower half
    draw_mark(d, S // 2, int(S * 0.62), int(S * 0.44), int(S * 0.30), BRAND, int(S * 0.058))
    save_ico(img, path)


def save_ico(img_ss, path):
    base = img_ss.resize((BASE, BASE), Image.LANCZOS)
    sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    base.save(path, format="ICO", sizes=sizes)
    # also emit a png preview next to it
    base.save(path.replace(".ico", ".png"), format="PNG")
    print("wrote", path)


if __name__ == "__main__":
    import os
    out = os.path.join(os.path.dirname(__file__), "..", "build")
    os.makedirs(out, exist_ok=True)
    make_app_icon(os.path.join(out, "icon.ico"))
    make_doc_icon(os.path.join(out, "md.ico"))
