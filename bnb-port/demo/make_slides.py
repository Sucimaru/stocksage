#!/usr/bin/env python3
"""Render 6 demo slides (1280x720 PNG) for the StockSage BNB demo video."""
import os, textwrap
from PIL import Image, ImageDraw, ImageFont

OUT = os.path.expanduser("~/workspace/tools/stocks-maxxing/bnb-port/demo/slides")
os.makedirs(OUT, exist_ok=True)

W, H = 1280, 720
BG = (11, 14, 17)        # dark
GOLD = (240, 185, 11)    # binance gold
WHITE = (255, 255, 255)
MUTED = (150, 155, 165)
CARD = (24, 29, 35)
GREEN = (46, 204, 113)

def font(name, size):
    paths = [
        f"/usr/share/fonts/truetype/dejavu/DejaVuSans{'-Bold' if name == 'bold' else ''}.ttf",
        f"/usr/share/fonts/truetype/dejavu/DejaVuSansMono{'-Bold' if name == 'boldmono' else ''}.ttf",
    ]
    for p in paths:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                pass
    return ImageFont.load_default()

F_TITLE = font("bold", 64)
F_H = font("bold", 48)
F_BODY = font("reg", 32)
F_SMALL = font("reg", 26)
F_MONO = font("boldmono", 26)
F_MONO_S = font("boldmono", 22)

def wrap(draw, text, fnt, max_w):
    lines = []
    for para in text.split("\n"):
        if not para:
            lines.append("")
            continue
        words, cur = para.split(), ""
        for w in words:
            t = (cur + " " + w).strip()
            if draw.textlength(t, font=fnt) <= max_w:
                cur = t
            else:
                if cur:
                    lines.append(cur)
                cur = w
        if cur:
            lines.append(cur)
    return lines

def base():
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, W, 10], fill=GOLD)
    d.text((90, H - 56), "StockSage on BNB Chain  ·  Agent ID Hackathon",
           font=F_SMALL, fill=MUTED)
    return img, d

def title_slide(img, d):
    d.text((90, 180), "StockSage", font=F_TITLE, fill=WHITE)
    d.text((90, 260), "on BNB Chain", font=F_TITLE, fill=GOLD)
    d.text((90, 380), "AI stock research, sold on-chain.",
           font=F_BODY, fill=WHITE)
    d.text((90, 430), "Pay USDC to a smart contract, get an analyst report.",
           font=F_SMALL, fill=MUTED)
    d.text((90, 480), "Agent ID holders pay half price — decided on-chain.",
           font=F_SMALL, fill=MUTED)

def heading(img, d, text):
    d.text((90, 70), text, font=F_H, fill=GOLD)

def steps_slide(img, d):
    heading(img, d, "How it works")
    steps = [
        ("1.", "Ask for a quote — GET /quote?ticker=AAPL&buyer=0x..."),
        ("2.", "Approve exactly the quoted USDC — never unlimited"),
        ("3.", 'Call purchase("AAPL") — the contract pulls the exact amount'),
        ("4.", "GET /research — the server verifies on-chain, serves the report"),
    ]
    y = 170
    for num, txt in steps:
        d.text((90, y), num, font=F_BODY, fill=GOLD)
        for ln in wrap(d, txt, F_BODY, 980):
            d.text((150, y), ln, font=F_BODY, fill=WHITE)
            y += 44
        y += 26

def pricing_slide(img, d):
    heading(img, d, "Agent ID sets the price")
    # holder card
    d.rounded_rectangle([90, 180, 590, 380], radius=16, fill=CARD)
    d.text((120, 210), "HOLDER", font=F_BODY, fill=GREEN)
    d.text((120, 260), "0.05 USDC", font=F_TITLE, fill=WHITE)
    d.text((120, 340), "per report", font=F_SMALL, fill=MUTED)
    # non-holder card
    d.rounded_rectangle([690, 180, 1190, 380], radius=16, fill=CARD)
    d.text((720, 210), "NO AGENT ID", font=F_BODY, fill=MUTED)
    d.text((720, 260), "0.10 USDC", font=F_TITLE, fill=WHITE)
    d.text((720, 340), "per report", font=F_SMALL, fill=MUTED)
    d.text((90, 430), "The contract reads your Agent ID balance with balanceOf() —",
           font=F_BODY, fill=WHITE)
    d.text((90, 480), "no account, no off-chain payment, no signed authorization.",
           font=F_BODY, fill=WHITE)

def live_slide(img, d):
    heading(img, d, "Live on BNB Chain")
    d.text((90, 180), "StockSageAccess", font=F_BODY, fill=WHITE)
    d.text((90, 230), "0xc6cf59c62b7c4d24DaFB221Ce642D0a1EF783bf6",
           font=F_MONO, fill=GOLD)
    y = 300
    for ln in [
        "Source Code Verified — Exact Match",
        "BscScan + Sourcify, 20 Nov 2026",
        "Deployed in block 134680219",
        "Deploy tx 0xd578a68899232ec87a770fd9e726b1a29d4200390af4a6d95c800503df7ca44a",
    ]:
        for wln in wrap(d, ln, F_BODY, 1100):
            d.text((90, y), wln, font=F_BODY, fill=WHITE if y < 380 else MUTED)
            y += 44
        y += 6

def purchase_slide(img, d):
    heading(img, d, "First live purchase — proven on mainnet")
    y = 170
    rows = [
        ("Ticker:", "AAPL report — 0.05 USDC, holder price"),
        ("Tx:", "0xb7a4f8c5900c5ff02d990601ffceac3dbe991ab0e08ea916ada71fc967740005"),
        ("Block:", "134680988  ·  ResearchPurchased event emitted"),
        ("Access:", "hasAccess(AAPL) = true — report served"),
    ]
    for label, txt in rows:
        d.text((90, y), label, font=F_BODY, fill=GOLD)
        fnt = F_MONO_S if label == "Tx:" else F_BODY
        for ln in wrap(d, txt, fnt, 1000):
            d.text((230, y), ln, font=fnt, fill=WHITE)
            y += 44
        y += 22

def links_slide(img, d):
    heading(img, d, "Try it")
    y = 180
    rows = [
        ("Code:", "github.com/Sucimaru/stocksage  (bnb-port/)"),
        ("Contract:", "bscscan.com/address/0xc6cf59c62b7c4d24DaFB221Ce642D0a1EF783bf6"),
        ("Price:", "0.05 USDC with Agent ID · 0.10 USDC without"),
    ]
    for label, txt in rows:
        d.text((90, y), label, font=F_BODY, fill=GOLD)
        for ln in wrap(d, txt, F_BODY, 1000):
            d.text((230, y), ln, font=F_BODY, fill=WHITE)
            y += 44
        y += 22
    d.text((90, 520), "Built for the Agent ID Hackathon. Independent project —",
           font=F_SMALL, fill=MUTED)
    d.text((90, 556), "not affiliated with or endorsed by Binance.",
           font=F_SMALL, fill=MUTED)

SLIDES = [title_slide, steps_slide, pricing_slide, live_slide, purchase_slide, links_slide]
for i, fn in enumerate(SLIDES, 1):
    img, d = base()
    fn(img, d)
    p = os.path.join(OUT, f"slide-{i:02d}.png")
    img.save(p)
    print("wrote", p)
