"""Render the demo frames from capture-help.mjs with Pillow 11 or later."""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

frames_dir, output = map(Path, sys.argv[1:])
output.mkdir(exist_ok=True, parents=True)
font = ImageFont.load_default(size=18)
for manifest in sorted(frames_dir.glob("*/frames.json")):
    frames, delays = [], []
    guide = manifest.parent.name
    for index, scene in enumerate(json.loads(manifest.read_text())):
        source = Image.open(manifest.parent / f"{index}.png").convert("RGB")
        width, height = source.size
        size = (min(800, width), round(height * min(800, width) / width))
        point = scene.get("point")
        # Anchor the zoom at the control's relative position, even near an edge.
        beats = [(1, 900), (1.04, 90), (1.09, 90), (1.15, 850)] if point else [(1, 1900)]
        for zoom, delay in beats:
            x, y = point or (0, 0)
            left, top = x * (1 - 1 / zoom), y * (1 - 1 / zoom)
            screen = source.resize(size, Image.Resampling.LANCZOS,
                                   box=(left, top, left + width / zoom, top + height / zoom))
            frame = Image.new("RGB", (size[0], size[1] + 48), "#192131")
            frame.paste(screen)
            draw = ImageDraw.Draw(frame)
            if zoom > 1:
                cx, cy = x * size[0] / width, y * size[1] / height
                radius = 16 if zoom < 1.15 else 13
                bounds = (cx-radius, cy-radius, cx+radius, cy+radius)
                draw.ellipse(bounds, outline="white", width=5)
                draw.ellipse(bounds, outline="#2859aa", width=3)
            draw.text((14, size[1]+24), scene["caption"], font=font, fill="white", anchor="lm")
            frames.append(frame.quantize(colors=160, method=Image.Quantize.MEDIANCUT))
            delays.append(delay)
    frames[0].save(output / f"{guide}.gif", save_all=True, append_images=frames[1:],
                   duration=delays, loop=0, optimize=True)
