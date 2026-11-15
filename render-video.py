#!/usr/bin/env python3
"""Render the real Sepolia demo run (demo/video-run-output.txt) as a
terminal-style MP4: title card, typed command, scrolling output, end card.
Everything shown is the actual output of a live run — nothing is invented.
Usage: python3 render-video.py   (run from the agent/ dir)
"""
import os
import textwrap
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, 'demo', 'video-run-output.txt')
FRAMES = os.path.join(ROOT, 'demo', 'frames')
FPS = 15
W, H = 1280, 720
BG = (13, 17, 23)
FG = (201, 209, 217)
DIM = (139, 148, 158)
GREEN = (63, 185, 80)
BLUE = (88, 166, 255)
YELLOW = (210, 153, 34)
PAD = 28
FONT = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf', 17)
FONT_B = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf', 17)
FONT_TITLE = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf', 44)
FONT_SUB = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf', 22)
LINE_H = 21
MAX_LINES = (H - 2 * PAD) // LINE_H  # visible rows
WRAP = 108


def color_for(line):
    if line.startswith('=='):
        return FONT_B, BLUE
    if 'got 402' in line:
        return FONT_B, YELLOW
    if 'settlement: settled tx' in line or 'payment verified: true' in line:
        return FONT_B, GREEN
    if 'AAPL: Bullish' in line:
        return FONT_B, GREEN
    if line.startswith('[client]'):
        return FONT, FG
    return FONT, FG


def draw_terminal(lines, path):
    img = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(img)
    vis = lines[-MAX_LINES:]
    y = H - PAD - len(vis) * LINE_H
    for line in vis:
        font, col = color_for(line)
        d.text((PAD, y), line, font=font, fill=col)
        y += LINE_H
    img.save(path)


def draw_card(title_lines, sub_lines, path):
    img = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(img)
    y = H // 2 - 90
    for t in title_lines:
        bb = d.textbbox((0, 0), t, font=FONT_TITLE)
        d.text(((W - (bb[2] - bb[0])) // 2, y), t, font=FONT_TITLE, fill=GREEN)
        y += 60
    y += 20
    for s in sub_lines:
        bb = d.textbbox((0, 0), s, font=FONT_SUB)
        d.text(((W - (bb[2] - bb[0])) // 2, y), s, font=FONT_SUB, fill=DIM)
        y += 34
    img.save(path)


def main():
    os.makedirs(FRAMES, exist_ok=True)
    for f in os.listdir(FRAMES):
        os.remove(os.path.join(FRAMES, f))
    raw = open(OUT, encoding='utf-8').read().splitlines()
    # Wrap long lines, keep blanks.
    lines = []
    for ln in raw:
        if not ln.strip():
            lines.append('')
        else:
            lines.extend(textwrap.wrap(ln, WRAP) or [''])
    n = 0

    def save(img_fn):
        nonlocal n
        n += 1
        img_fn(os.path.join(FRAMES, f'f_{n:04d}.png'))

    # Title card (2s)
    for _ in range(2 * FPS):
        save(lambda p: draw_card(
            ['Stocks Maxxing', 'Agentic Stock Finance'],
            ['Research agent — pay test USDC via x402, get an analyst report',
             'Live demo on Base Sepolia testnet (no real money)'], p))
    # Type the command
    cmd = '$ bash demo/run-demo.sh'
    shown = []
    for i in range(1, len(cmd) + 1, 4):
        cur = cmd[:i]
        save(lambda p, c=cur: draw_terminal([c], p))
    shown = [cmd]
    # Reveal output: 1 line/frame, slower (2 frames) for report prose.
    in_report = False
    for ln in lines:
        if ln.startswith('--- report ---'):
            in_report = True
        if ln.startswith('== portfolio'):
            in_report = False
        shown.append(ln)
        frames = 2 if in_report and ln.strip() else 1
        for _ in range(frames):
            save(lambda p, s=list(shown): draw_terminal(s, p))
        if 'got 402' in ln:
            for _ in range(20):
                save(lambda p, s=list(shown): draw_terminal(s, p))
        if 'settlement: settled tx' in ln:
            for _ in range(45):
                save(lambda p, s=list(shown): draw_terminal(s, p))
        if 'AAPL: Bullish' in ln:
            for _ in range(20):
                save(lambda p, s=list(shown): draw_terminal(s, p))
        if '"totalEarnedUsdc"' in ln:
            for _ in range(15):
                save(lambda p, s=list(shown): draw_terminal(s, p))
    # End card (3s)
    tx = '0xdab3fbbd0785462b02ec98950a6b9acb3fbf5b2098355286a3c368f73d7dfa78'
    for _ in range(3 * FPS):
        save(lambda p: draw_card(
            ['Demo complete'],
            ['Settlement on Base Sepolia — 0.10 test USDC, status 1',
             f'sepolia.basescan.org/tx/{tx}'], p))
    print(f'rendered {n} frames ({n / FPS:.1f}s at {FPS} fps) -> {FRAMES}')


if __name__ == '__main__':
    main()
