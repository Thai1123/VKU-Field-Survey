from PIL import Image, ImageDraw

PRIMARY = (2, 132, 199, 255)  # #0284c7
WHITE = (255, 255, 255, 255)

OUT_DIR = "public/icons"


def clipboard_icon(size: int, padding_ratio: float) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    pad = int(size * padding_ratio)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * 0.22), fill=PRIMARY)

    # Clipboard body
    body_w = size - 2 * pad
    body_h = int(body_w * 1.25)
    body_x0 = pad
    body_y0 = (size - body_h) // 2
    body_x1 = body_x0 + body_w
    body_y1 = body_y0 + body_h
    d.rounded_rectangle([body_x0, body_y0, body_x1, body_y1], radius=int(size * 0.05), fill=WHITE)

    # Clip at top
    clip_w = int(body_w * 0.4)
    clip_h = int(size * 0.06)
    clip_x0 = body_x0 + (body_w - clip_w) // 2
    clip_y0 = body_y0 - clip_h // 2
    d.rounded_rectangle(
        [clip_x0, clip_y0, clip_x0 + clip_w, clip_y0 + clip_h],
        radius=clip_h // 2,
        fill=PRIMARY,
    )

    # Checkmark
    lw = max(2, int(size * 0.035))
    cx0 = body_x0 + body_w * 0.28
    cy0 = body_y0 + body_h * 0.55
    cx1 = body_x0 + body_w * 0.45
    cy1 = body_y0 + body_h * 0.70
    cx2 = body_x0 + body_w * 0.75
    cy2 = body_y0 + body_h * 0.35
    d.line([(cx0, cy0), (cx1, cy1)], fill=PRIMARY, width=lw)
    d.line([(cx1, cy1), (cx2, cy2)], fill=PRIMARY, width=lw)

    # Two "text" lines below the checkmark to read as a form/checklist
    line_y1 = body_y0 + body_h * 0.80
    line_y2 = body_y0 + body_h * 0.88
    d.rounded_rectangle(
        [body_x0 + body_w * 0.2, line_y1, body_x0 + body_w * 0.8, line_y1 + size * 0.02],
        radius=size * 0.01,
        fill=(2, 132, 199, 120),
    )
    d.rounded_rectangle(
        [body_x0 + body_w * 0.2, line_y2, body_x0 + body_w * 0.65, line_y2 + size * 0.02],
        radius=size * 0.01,
        fill=(2, 132, 199, 120),
    )

    return img


import os

os.makedirs(OUT_DIR, exist_ok=True)

clipboard_icon(192, 0.18).save(f"{OUT_DIR}/icon-192.png")
clipboard_icon(512, 0.18).save(f"{OUT_DIR}/icon-512.png")
# Maskable variant needs more padding so the safe zone survives OS masking.
clipboard_icon(512, 0.26).save(f"{OUT_DIR}/icon-maskable-512.png")

print("Icons generated.")
