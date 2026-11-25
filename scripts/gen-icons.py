#!/usr/bin/env python3
"""Draw the Chronostasis icon with the standard library only."""

import struct
import zlib
from pathlib import Path

INK = (27, 23, 18, 255)
PAPER = (243, 236, 223, 255)
COPPER = (141, 79, 36, 255)


def png(width, height, pixels):
    raw = bytearray()
    for y in range(height):
        raw.append(0)
        raw.extend(pixels[y])

    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    header = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b"")


def draw(size, inset):
    rows = []
    center = (size - 1) / 2
    ring = 0.34 if inset >= 0.15 else 0.42
    for y in range(size):
        row = bytearray()
        for x in range(size):
            dx = (x - center) / size
            dy = (y - center) / size
            dist = (dx * dx + dy * dy) ** 0.5
            color = PAPER
            if abs(dist - ring) < 0.012:
                color = COPPER
            if abs(dx) < 0.012 and -0.18 < dy < 0.02:
                color = INK
            if abs(dy) < 0.009 and -0.015 < dx < 0.24:
                color = INK
            if abs(dx) < 0.014 and -ring + 0.02 < dy < -ring + 0.07:
                color = INK
            if dist < 0.022:
                color = COPPER
            row.extend(color)
        rows.append(row)
    return rows


def main():
    out = Path("public/icons")
    out.mkdir(parents=True, exist_ok=True)
    (out / "icon-192.png").write_bytes(png(192, 192, draw(192, 0.08)))
    (out / "icon-512.png").write_bytes(png(512, 512, draw(512, 0.08)))
    (out / "icon-maskable-512.png").write_bytes(png(512, 512, draw(512, 0.18)))


if __name__ == "__main__":
    main()
