"""Render the "Totality" new-tab artwork for amoled-theme.

A total solar eclipse: black moon, streaked corona, one H-alpha prominence,
a diamond-ring bead and Venus. Everything below the visibility floor is forced
to exactly #000 so the OLED pixels stay off.

    python tools/render_totality.py      (needs numpy + pillow)
"""
from pathlib import Path

import numpy as np
from PIL import Image

OUT = Path(__file__).resolve().parent.parent / "amoled-theme" / "images"
W, H = 2560, 1440
# Edge scales the new-tab image to the page width (like background-size: cover),
# so positions are effectively fractions of the width. Upper right keeps the
# eclipse clear of the centred search box and the settings icons.
CX, CY = W * 0.845, 275
R = 100  # moon radius (px)

CORONA = np.array([239, 228, 207]) / 255   # warm white
HALPHA = np.array([242, 71, 111]) / 255    # prominence pink
rng = np.random.default_rng(7)


def render(scale=1):
    w, h, cx, cy, r = W * scale, H * scale, CX * scale, CY * scale, R * scale
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    dx, dy = x - cx, y - cy
    rad = np.hypot(dx, dy)
    ang = np.arctan2(dy, dx)
    rr = np.maximum(rad / r, 1.0)  # radius in moon radii, >= 1

    # Corona: bright inner ring, then streamers that fall off as r^-3.
    inner = np.exp(-(rr - 1) / 0.13)
    lobes = sum(a * np.exp(-((np.angle(np.exp(1j * (ang - c)))) / s) ** 2)
                for a, c, s in [(1.0, -0.25, 0.32), (0.85, 2.85, 0.38),
                                (0.45, 1.35, 0.22), (0.35, -1.9, 0.18)])
    # Fine radial striations: angular noise, smoothed, constant along each ray.
    k = 720
    noise = np.convolve(rng.random(k), np.ones(9) / 9, mode="same")
    noise = (noise - noise.min()) / (noise.max() - noise.min())
    stri = noise[((ang + np.pi) / (2 * np.pi) * (k - 1)).astype(int)]
    outer = (0.25 + lobes) * (0.55 + 0.9 * stri) * rr ** -3.2 * np.exp(-(rr - 1) / 2.6)
    corona = np.clip(0.9 * inner + 0.75 * outer, 0, None)

    img = corona[..., None] * CORONA

    # Chromosphere: a hair-thin pink rim.
    rim = np.exp(-((rad - r * 1.008) / (1.6 * scale)) ** 2) * 0.55
    img += rim[..., None] * HALPHA

    # Prominence: a small looped arc rising off the lower-left limb.
    pa = np.deg2rad(152)
    px, py = cx + np.cos(pa) * r * 1.045, cy + np.sin(pa) * r * 1.045
    # Arc: a ring around a point just outside the limb, kept only outside the moon.
    pd = np.hypot(x - px, y - py)
    arc = np.exp(-((pd - 7 * scale) / (1.8 * scale)) ** 2) * (rad > r)
    knot = np.exp(-(pd / (5 * scale)) ** 2) * (rad > r)
    img += (2.2 * arc + 1.6 * knot)[..., None] * HALPHA

    # Diamond ring: one bead of photosphere at the upper-right limb, with glare.
    ba = np.deg2rad(-38)
    bx, by = cx + np.cos(ba) * r * 1.01, cy + np.sin(ba) * r * 1.01
    d = np.hypot(x - bx, y - by)
    bead = np.exp(-(d / (5.0 * scale)) ** 2) * 3.0 + np.exp(-(d / (22 * scale)) ** 2) * 0.8
    spikes = (np.exp(-((y - by) / (0.7 * scale)) ** 2) + np.exp(-((x - bx) / (0.7 * scale)) ** 2)) \
        * np.exp(-d / (14 * scale)) * 0.6
    img += (bead + spikes)[..., None] * np.array([1.0, 0.98, 0.94])

    # Moon: exactly black.
    img[rad < r] = 0

    # Venus, low and to the left, and a few faint stars.
    vx, vy = cx - 560 * scale, cy + 330 * scale
    img += (np.exp(-(np.hypot(x - vx, y - vy) / (2.2 * scale)) ** 2) * 0.9)[..., None] \
        * np.array([1.0, 0.97, 0.9])
    for _ in range(38):
        sx, sy = rng.uniform(0, w), rng.uniform(0, h * 0.75)
        b = rng.uniform(0.05, 0.22)
        img += (np.exp(-(np.hypot(x - sx, y - sy) / (1.1 * scale)) ** 2) * b)[..., None]

    # Tone map, dither only where there's light, then hard floor to true black.
    img = 1 - np.exp(-img * 1.35)
    v = img * 255
    lit = v.max(axis=-1, keepdims=True) > 2
    v = np.where(lit, v + rng.uniform(-0.5, 0.5, v.shape), 0)
    # Soft knee to black: subtract the floor instead of cutting at it, so the
    # corona fades into true black without a jagged outline.
    v = np.clip(v - 2.5, 0, None) * (255 / 252.5)
    return Image.fromarray(np.clip(v, 0, 255).astype(np.uint8))


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    im = render()
    im.save(OUT / "ntp.png", optimize=True)
    a = np.asarray(im)
    print(f"ntp.png {im.size}, pure-black pixels: {100 * (a.max(axis=-1) == 0).mean():.2f}%")
    # Icons and store tiles are rendered from this image by tools/render_assets.mjs.
