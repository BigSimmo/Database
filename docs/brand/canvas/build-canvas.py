# -*- coding: utf-8 -*-
"""Generate the artboards for the PsychSift design canvas.

    python3 docs/brand/canvas/build-canvas.py <output-directory>

Writes six `.dc.html` artboards plus `canvas.json`. See README.md in this
directory for what to do with them. Pure standard library, no dependencies.

Every geometry value below is copied from `src/lib/brand-mark.ts` and every
colour from the `@theme` tokens in `src/app/globals.css`. When either moves,
update this file too: nothing enforces the copy, because the canvas is a
published artifact rather than a build output.
"""
import os
import sys

OUT = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.dirname(os.path.abspath(__file__))
os.makedirs(OUT, exist_ok=True)


STROKE = ("M41.3675 2.6554 A17.7232 17.7232 0 0 0 29.0679 28.0493 A13 13 0 0 1 28.8667 40.1963 "
          "L18.0434 59.8793 A55.1234 55.1234 0 0 1 3.9761 43.9116 A29.2009 29.2009 0 0 1 41.3675 2.6554 Z")
STROKE_S = ("M41.3675 2.6554 A17.7232 17.7232 0 0 0 28.6276 27.115 A13 13 0 0 1 28.1033 38.5768 "
            "L16.8897 58.9696 A55.1234 55.1234 0 0 1 3.9761 43.9116 A29.2009 29.2009 0 0 1 41.3675 2.6554 Z")
COUNTER = "translate(55.1029 100.3813) scale(-1.07)"
PLACE      = "translate(143.1125 51.2) scale(4.0804)"
PLACE_S    = "translate(122.7103 51.2) scale(4.0804)"
PLACE_BARE = "translate(114.8907 0) scale(5.1006)"

GROUND="#F7F9FB"; PLATE="#FFFFFF"; INK="#0B1016"; MUTED="#5A6675"
RULE="#DDE4EC"; ACCENT="#1D6FB8"; SOFT="#EAF2FA"; DARK="#171B1E"; DARKINK="#74BDF0"
SANS="ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
MONO="ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace"

def glyph(ink, small=False, bare=True):
    """The three shapes, no tile. bare=True uses the edge-to-edge placement."""
    st = STROKE_S if small else STROKE
    cx = 54.8724 if small else 44.8724
    pl = PLACE_BARE if bare else (PLACE_S if small else PLACE)
    return ('<g transform="%s" fill="%s"><path d="%s"/><path d="%s" transform="%s"/>'
            '<circle cx="%s" cy="20.0286" r="10.4586"/></g>' % (pl, ink, st, st, COUNTER, cx))

def mark(size, ink=ACCENT, small=False, bare=True, extra=""):
    return ('<svg width="%s" height="%s" viewBox="0 0 512 512" %s '
            'xmlns="http://www.w3.org/2000/svg" role="img" aria-label="PsychSift mark">%s</svg>'
            % (size, size, extra, glyph(ink, small, bare)))

def tile(size, ink, ground, rx_ratio=96/512.0, small=True):
    rx = round(512*rx_ratio, 2)
    pl = PLACE_S if small else PLACE
    st = STROKE_S if small else STROKE
    cx = 54.8724 if small else 44.8724
    return ('<svg width="%s" height="%s" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" '
            'role="img" aria-label="PsychSift app icon">'
            '<rect x="0" y="0" width="512" height="512" rx="%s" fill="%s"/>'
            '<g transform="%s" fill="%s"><path d="%s"/><path d="%s" transform="%s"/>'
            '<circle cx="%s" cy="20.0286" r="10.4586"/></g></svg>'
            % (size, size, rx, ground, pl, ink, st, st, COUNTER, cx))

def eyebrow(text, colour=MUTED):
    return ('<div style="font:600 10.5px/1 %s;letter-spacing:.12em;text-transform:uppercase;'
            'color:%s">%s</div>' % (SANS, colour, text))

def plate(w, h, inner, ground=GROUND):
    return ('<script src="./support.js"></script>'
            '<div style="width:%spx;height:%spx;box-sizing:border-box;background:%s;'
            'font-family:%s;color:%s;-webkit-font-smoothing:antialiased;overflow:hidden">'
            '<div style="height:3px;background:%s"></div>%s</div>' % (w, h, ground, SANS, INK, ACCENT, inner))

def head(title, sub):
    return ('<div style="display:flex;flex-direction:column;gap:6px">%s'
            '<div style="font:700 26px/1.15 %s;letter-spacing:-0.02em;color:%s">%s</div>'
            '<div style="font:400 13.5px/1.5 %s;color:%s;max-width:62ch">%s</div></div>'
            % (eyebrow("PsychSift brand"), SANS, INK, title, SANS, MUTED, sub))

def num(v):
    return '<span style="font:500 12.5px/1.6 %s;font-variant-numeric:tabular-nums;color:%s">%s</span>' % (MONO, INK, v)

def rows(pairs, label_w=210):
    out=[]
    for k,v in pairs:
        out.append('<div style="display:flex;gap:16px;padding:7px 0;border-top:1px solid %s">'
                   '<div style="flex:0 0 %spx;font:400 12.5px/1.6 %s;color:%s">%s</div>'
                   '<div style="flex:1">%s</div></div>' % (RULE, label_w, SANS, MUTED, k, v))
    return '<div>' + "".join(out) + '</div>' 

W = lambda f, s: open(os.path.join(OUT, f), "w", encoding="utf-8").write(s)

# ---------------------------------------------------------------- Main
inner = ('<div style="display:flex;height:697px">'
  '<div style="flex:0 0 400px;background:%s;display:flex;align-items:center;justify-content:center;'
  'border-right:1px solid %s">%s</div>'
  '<div style="flex:1;padding:48px 52px;display:flex;flex-direction:column;justify-content:center;gap:30px">'
  '%s'
  '<div style="display:flex;flex-direction:column;gap:8px">'
    '<div style="font:800 46px/1 %s;letter-spacing:-0.02em;color:%s">PsychSift</div>'
    '<div style="font:500 15px/1.4 %s;color:%s">From question to source</div>'
  '</div>'
  '<div style="height:1px;background:%s"></div>'
  '<div style="font:400 14px/1.65 %s;color:%s;max-width:46ch">'
  'One <b style="color:%s;font-weight:600">S</b>, cut once. Two counter-turning strokes divided by a '
  'straight gap of constant width, with a settled point cradled in the throat &mdash; the sift, and the '
  'thing that settles out of it.</div>'
  '<div style="display:flex;gap:34px">%s</div>'
  '</div></div>') % (
    SOFT, RULE, mark(230),
    eyebrow("The mark"),
    SANS, INK, SANS, MUTED, RULE, SANS, MUTED, INK,
    "".join('<div style="flex:0 0 150px;display:flex;flex-direction:column;gap:5px">%s<div>%s</div></div>'
            % (eyebrow(k), num(v)) for k,v in
            [("Master","512 &times; 512"),("Ink","#1D6FB8"),("Constant crescent","7.2646"),("Cut","4.2000")]))
W("Main.dc.html", plate(1000, 700, inner))

# ---------------------------------------------------------------- Construction
S=4.0; OX=30; OY=28            # glyph units -> px
def gx(v): return round(OX+v*S,2)
def gy(v): return round(OY+v*S,2)
def circ(cx,cy,r,stroke,dash="",width=1):
    return ('<circle cx="%s" cy="%s" r="%s" fill="none" stroke="%s" stroke-width="%s" %s/>'
            % (gx(cx),gy(cy),round(r*S,2),stroke,width,('stroke-dasharray="%s"'%dash) if dash else ""))
def dot(cx,cy,c=ACCENT,r=2.6):
    return '<circle cx="%s" cy="%s" r="%s" fill="%s"/>' % (gx(cx),gy(cy),r,c)
def lab(x,y,t,c=MUTED,anchor="start",weight=500,size=10.5):
    return ('<text x="%s" y="%s" text-anchor="%s" style="font:%s %spx %s;fill:%s;'
            'letter-spacing:.02em">%s</text>' % (gx(x),gy(y),anchor,weight,size,MONO,c,t))

diagram = ('<svg width="500" height="470" viewBox="0 0 500 470" xmlns="http://www.w3.org/2000/svg" '
  'role="img" aria-label="Construction geometry of the PsychSift mark">'
  + circ(29.2009,29.2009,29.2009,"#C3D3E3","4 4")
  + circ(17.4753,33.9324,13,"#DCE5EE","4 4")
  + circ(44.8723,20.0286,17.7232,ACCENT,"3 3")
  + '<g transform="translate(%s %s) scale(%s)" fill="%s" fill-opacity="0.13">'
    '<path d="%s"/><path d="%s" transform="%s"/></g>' % (OX,OY,S,INK,STROKE,STROKE,COUNTER)
  + '<g transform="translate(%s %s) scale(%s)"><circle cx="44.8724" cy="20.0286" r="10.4586" fill="%s"/></g>'
    % (OX,OY,S,ACCENT)
  + dot(44.8723,20.0286,"#FFFFFF",3.4) + dot(44.8723,20.0286,ACCENT,1.7)
  + dot(29.2009,29.2009,"#93A6BA",2.2) + dot(26.6198,48.4934,"#93A6BA",2.2)
  + '<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="%s" stroke-width="1.3" stroke-dasharray="3 3"/>'
    % (gx(28.8667),gy(40.1963),gx(18.0434),gy(59.8793),ACCENT)
  + lab(69,17.5,"R 17.7232 throat",ACCENT)
  + lab(69,22.5,"r 10.4586 point",ACCENT)
  + lab(69,27.5,"= 7.2646 constant",ACCENT)
  + lab(1,-2.5,"R 29.2009 outer ring")
  + lab(2,74,"cut 4.2000, edges parallel")
  + '</svg>')

facts = rows([
  ("Space", num("100 &times; 100, drawn into 512")),
  ("Outer ring", num("R 29.2009 at (29.2009, 29.2009)")),
  ("Throat arc", num("R 17.7232 at (44.8724, 20.0286)")),
  ("Transition", num("R 13.0000 at (17.4753, 33.9324)")),
  ("Inner sweep", num("R 55.1234 at (51.5936, 16.1417)")),
  ("Straight cut", num("22.4625 long, 4.2000 wide")),
  ("Turn centre", num("(26.6198, 48.4934)")),
  ("The point", num("r 10.4586 at (44.8724, 20.0286)")),
  ("Crescent", num("17.7232 &minus; 10.4586 = 7.2646")),
], 96)

inner = ('<div style="padding:36px 44px;display:flex;flex-direction:column;gap:20px;height:734px;box-sizing:border-box">'
  + head("Construction", "Every curve is a circular arc, and every number here is the artwork itself &mdash; not a "
         "redrawing of it. The point sits exactly on the throat arc\'s centre, which is the whole reason the white "
         "crescent around it never tapers.")
  + '<div style="display:flex;gap:26px;align-items:flex-start">'
    '<div style="flex:0 0 500px">%s</div>'
    '<div style="flex:1;padding-top:2px;display:flex;flex-direction:column;gap:18px">%s'
    '<div style="display:flex;gap:14px;padding:16px 18px;background:%s;border-radius:12px">'
      '<div style="display:flex;flex-direction:column;align-items:center;gap:8px">%s'
      '<div style="font:400 10px/1.35 %s;color:%s;text-align:center">standard<br>crescent 7.2646</div></div>'
      '<div style="display:flex;flex-direction:column;align-items:center;gap:8px">%s'
      '<div style="font:400 10px/1.35 %s;color:%s;text-align:center">small<br>crescent 11.55</div></div>'
      '<div style="flex:1;font:400 11.5px/1.55 %s;color:%s;align-self:center">Same arcs, two cuts. The small set '
      'opens the gap and slides the point out so both survive a 32&nbsp;px tab.</div>'
    '</div></div></div>' % (diagram, facts, SOFT,
        mark(74), SANS, MUTED, mark(74, ACCENT, True), SANS, MUTED, SANS, MUTED)
  + '<div style="margin-top:auto;padding-top:14px;border-top:1px solid %s;font:400 12px/1.6 %s;color:%s">'
    'The lower stroke is not a second drawing. It is the upper stroke under '
    '<span style="font-family:%s;color:%s">translate(55.1029 100.3813) scale(-1.07)</span> &mdash; a 180&deg; turn '
    'about (26.6198, 48.4934) with a 7%% enlargement, which is what carries the upper stroke\'s facing edge exactly '
    'onto the lower one and keeps the cut parallel.</div>' % (RULE, SANS, MUTED, MONO, INK)
  + '</div>')
W("Construction.dc.html", plate(1000, 740, inner))

# ---------------------------------------------------------------- Sizes
def size_cell(px, small, note):
    return ('<div style="display:flex;flex-direction:column;align-items:center;gap:12px;width:104px">'
      '<div style="height:100px;display:flex;align-items:flex-end;justify-content:center">%s</div>'
      '<div style="font:500 11px/1 %s;font-variant-numeric:tabular-nums;color:%s">%s px</div>'
      '<div style="font:400 10px/1.3 %s;color:%s;text-align:center;min-height:26px">%s</div></div>'
      % (mark(px, ACCENT, small), MONO, INK, px, SANS, MUTED, note))

row_a = "".join(size_cell(p, False, n) for p,n in
    [(96,""),(64,""),(48,"handover to<br>the small set"),(32,"crescent<br>closes"),(16,"")])
row_b = "".join(size_cell(p, True, n) for p,n in
    [(96,""),(64,""),(48,"cut opened<br>4.2 &rarr; 7.2"),(32,"point slid<br>10 units out"),(16,"merges &mdash; the<br>size, not the<br>placement")])

inner = ('<div style="padding:34px 44px;display:flex;flex-direction:column;gap:22px;height:617px;box-sizing:border-box">'
  + head("Sizes", "Two cuts of one silhouette. Below 48&nbsp;px the 4.2-unit gap closes up and the point fuses "
         "into the S, so the small set widens the cut and slides the point out of the cradle &mdash; three changes "
         "that only ever travel together.")
  + '<div style="display:flex;gap:34px;align-items:flex-start">'
    '<div style="flex:0 0 118px;padding-top:24px;display:flex;flex-direction:column;gap:6px">%s'
    '<div style="font:400 11px/1.4 %s;color:%s">Master artwork.<br>48&nbsp;px and up.</div></div>'
    '<div style="display:flex;gap:8px">%s</div></div>' % (eyebrow("Standard set"), SANS, MUTED, row_a)
  + '<div style="height:1px;background:%s"></div>' % RULE
  + '<div style="display:flex;gap:34px;align-items:flex-start">'
    '<div style="flex:0 0 118px;padding-top:24px;display:flex;flex-direction:column;gap:6px">%s'
    '<div style="font:400 11px/1.4 %s;color:%s">Browser tab, favicon.<br>Below 48&nbsp;px.</div></div>'
    '<div style="display:flex;gap:8px">%s</div></div>' % (eyebrow("Small set"), SANS, MUTED, row_b)
  + '</div>')
W("Sizes.dc.html", plate(1000, 620, inner))

# ---------------------------------------------------------------- Colour
def swatch(hexv, token, use, on_dark=False):
    border = "rgba(255,255,255,.14)" if on_dark else RULE
    tcol = "#E9EEF3" if on_dark else INK
    mcol = "#9AA7B4" if on_dark else MUTED
    return ('<div style="display:flex;flex-direction:column;gap:9px;width:140px">'
      '<div style="height:74px;border-radius:10px;background:%s;border:1px solid %s"></div>'
      '<div style="font:500 12px/1 %s;font-variant-numeric:tabular-nums;color:%s">%s</div>'
      '<div style="font:400 10.5px/1.45 %s;color:%s">%s<br>%s</div></div>'
      % (hexv, border, MONO, tcol, hexv.upper(), SANS, mcol, token, use))

light = "".join(swatch(*a) for a in [
  ("#1d6fb8","--clinical-accent","The mark, links, focus"),
  ("#185c99","--clinical-accent-strong","Pressed and hover"),
  ("#eff5fc","--clinical-accent-soft","Quiet accent grounds"),
  ("#ffffff","--surface-raised","Page ground behind the mark"),
  ("#080b0f","--text-heading","Wordmark"),
  ("#475467","--text-muted","Strapline"),
])
dark = "".join(swatch(a,b,c,True) for a,b,c in [
  ("#74bdf0","--clinical-accent","The mark, links, focus"),
  ("#a9d8f8","--clinical-accent-strong","Pressed and hover"),
  ("#123556","--clinical-accent-soft","Quiet accent grounds"),
  ("#171b1e","--surface-raised","Page ground behind the mark"),
  ("#fbfcfd","--text-heading","Wordmark"),
  ("#a4adb7","--text-muted","Strapline"),
])

inner = ('<div style="padding:34px 44px;display:flex;flex-direction:column;gap:20px;height:617px;box-sizing:border-box">'
  + head("Colour", "The mark carries the colour and the ground stays out of its way. Ink is always the accent "
         "token; the tile is always the page ground, which is why on white the mark reads as the bare symbol "
         "with no box around it.")
  + '<div style="display:flex;flex-direction:column;gap:12px">%s<div style="display:flex;gap:16px">%s</div></div>'
    % (eyebrow("Light"), light)
  + '<div style="background:%s;border-radius:12px;padding:20px;display:flex;flex-direction:column;gap:12px">'
    '%s<div style="display:flex;gap:14px">%s</div></div>' % (DARK, eyebrow("Dark", "#9AA7B4"), dark)
  + '</div>')
W("Colour.dc.html", plate(1000, 620, inner))

# ---------------------------------------------------------------- Lockups
def wordmark(size, colour, tag=None, tagcol=None, gap=3):
    t = ('<div style="font:500 12px/1.35 %s;color:%s">%s</div>' % (SANS, tagcol, tag)) if tag else ""
    return ('<div style="display:flex;flex-direction:column;gap:%spx">'
      '<div style="font:800 %spx/1 %s;letter-spacing:-0.02em;color:%s">PsychSift</div>%s</div>'
      % (gap, size, SANS, colour, t))

def cell(title, body, w, ground=PLATE, border=True):
    return ('<div style="width:%spx;box-sizing:border-box;display:flex;flex-direction:column;gap:11px">'
      '%s<div style="background:%s;border:%s;border-radius:12px;padding:22px 24px;'
      'display:flex;align-items:center;min-height:104px">%s</div></div>'
      % (w, eyebrow(title), ground, ("1px solid "+RULE) if border else "none", body))

horiz = ('<div style="display:flex;align-items:center;gap:14px">%s%s</div>'
         % (mark(46), wordmark(28, INK, "From question to source", MUTED)))
stack = ('<div style="display:flex;flex-direction:column;align-items:center;gap:10px;width:100%%">%s'
         '<div style="font:800 22px/1 %s;letter-spacing:-0.02em;color:%s">PsychSift</div></div>'
         % (mark(44), SANS, INK))
rev   = ('<div style="display:flex;align-items:center;gap:14px">%s%s</div>'
         % (mark(46, DARKINK), wordmark(28, "#FBFCFD", "From question to source", "#A4ADB7")))

safe = ('<svg width="104" height="104" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" '
  'role="img" aria-label="Maskable icon with the Android safe circle marked">'
  '<rect width="512" height="512" fill="#1d6fb8"/>'
  '<g transform="%s" fill="#ffffff"><path d="%s"/><path d="%s" transform="%s"/>'
  '<circle cx="54.8724" cy="20.0286" r="10.4586"/></g>'
  '<circle cx="256" cy="256" r="170.8" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="4" '
  'stroke-dasharray="10 10"/></svg>') % (
   "translate(152.6800 97.28) scale(3.1626)", STROKE_S, STROKE_S, COUNTER)

H=70.0; Wk=round(H*55.331/100.3813,3); CS=round(H/4,3)
BX=round((176-(Wk+2*CS))/2,3); BY=round((124-(H+2*CS))/2,3)
IX=round(BX+CS,3); IY=round(BY+CS,3)
GS=round(H/512.0,6); GTX=round(IX-114.8907*GS,4)
clear = ('<svg width="176" height="124" viewBox="0 0 176 124" xmlns="http://www.w3.org/2000/svg" '
  'role="img" aria-label="Clear space is a quarter of the mark height on every side">'
  '<rect x="%s" y="%s" width="%s" height="%s" fill="%s" stroke="%s" stroke-dasharray="4 3"/>'
  '<rect x="%s" y="%s" width="%s" height="%s" fill="none" stroke="#C9D8E7" stroke-dasharray="2 2"/>'
  '<g transform="translate(%s %s) scale(%s)">%s</g></svg>'
  ) % (BX,BY,round(Wk+2*CS,3),round(H+2*CS,3),SOFT,"#BFD3E6",
       IX,IY,Wk,H, GTX,IY,GS, glyph(ACCENT))

inner = ('<div style="padding:34px 44px;display:flex;flex-direction:column;gap:22px;height:717px;box-sizing:border-box">'
  + head("Lockups", "The symbol is the primary asset and stands alone wherever the name is already present. "
         "Where the name is needed, the mark leads and the strapline sits under it &mdash; never beside it.")
  + '<div style="display:flex;gap:20px;flex-wrap:wrap">'
    + cell("Horizontal, primary", horiz, 430)
    + cell("Stacked", stack, 176)
    + cell("Reverse", rev, 430, DARK, False)
    + cell("App icon &middot; maskable", safe, 176)
    + cell("Clear space", clear, 224)
  + '</div>'
  + '<div style="height:1px;background:%s"></div>' % RULE
  + '<div style="display:flex;gap:40px">'
    + '<div style="flex:1;display:flex;flex-direction:column;gap:8px">%s'
      '<div style="font:400 12.5px/1.6 %s;color:%s">Do not re-draw the arcs, re-space the cut, or move the point '
      'off the throat centre. Do not outline the mark, add a shadow, rotate it, or set it in any colour outside '
      'the accent pair.</div></div>' % (eyebrow("Don't"), SANS, MUTED)
    + '<div style="flex:1;display:flex;flex-direction:column;gap:8px">%s'
      '<div style="font:400 12.5px/1.6 %s;color:%s">Clear space on every side is a quarter of the mark\'s height. '
      'The maskable icon keeps all ink inside the dashed circle &mdash; 66.7%% of the icon width, r&nbsp;170.8 at 512.'
      '</div></div>' % (eyebrow("Spacing"), SANS, MUTED)
  + '</div></div>')
W("Lockups.dc.html", plate(1000, 720, inner))

# ---------------------------------------------------------------- Typography
spec = rows([
  ("Wordmark", num("18px &middot; 800 &middot; --tracking-display &minus;0.02em &middot; --text-heading")),
  ("Strapline", num("12px &middot; 500 &middot; --tracking-normal 0 &middot; --text-muted")),
  ("Family", num("Geist Sans, then the system stack")),
  ("Set as", num("sentence case, no full stop, never all caps")),
], 118)

ladder = "".join(
  '<div style="display:flex;align-items:baseline;gap:18px;padding:9px 0;border-top:1px solid %s">'
  '<div style="flex:0 0 168px;font:500 11.5px/1 %s;color:%s">%s</div>'
  '<div style="flex:0 0 62px;font:500 11.5px/1 %s;font-variant-numeric:tabular-nums;color:%s">%s</div>'
  '<div style="flex:1;font:600 12px/1 %s;letter-spacing:%s;text-transform:%s;color:%s">%s</div></div>'
  % (RULE, MONO, MUTED, k, MONO, INK, v, SANS, v, tc, INK, sample)
  for k, v, tc, sample in [
    ("--tracking-display", "-0.02em", "none", "PsychSift"),
    ("--tracking-normal", "0em", "none", "From question to source"),
    ("--tracking-label", "0.06em", "uppercase", "Sources"),
    ("--tracking-eyebrow", "0.08em", "uppercase", "Guideline"),
    ("--tracking-kicker", "0.12em", "uppercase", "Answer"),
  ])
ladder = '<div>' + ladder + '</div>'

inner = ('<div style="padding:34px 44px;display:flex;flex-direction:column;gap:20px;height:697px;box-sizing:border-box">'
  + head("Wordmark and strapline", "Set on the app’s own type ramp, not a separate brand ramp &mdash; so the "
         "header lockup and the interface are the same typography, and there is nothing to keep in sync.")
  + '<div style="background:%s;border:1px solid %s;border-radius:12px;padding:26px 28px;'
    'display:flex;align-items:center;gap:16px">%s'
    '<div style="display:flex;flex-direction:column;gap:3px">'
    '<div style="font:800 18px/1.1 %s;letter-spacing:-0.02em;color:%s">PsychSift</div>'
    '<div style="font:500 12px/1.2 %s;color:%s">From question to source</div></div></div>'
    % (PLATE, RULE, mark(34), SANS, INK, SANS, MUTED)
  + '<div style="display:flex;gap:32px;align-items:flex-start">'
    + '<div style="flex:0 0 440px;display:flex;flex-direction:column;gap:10px">%s%s</div>' % (eyebrow("Header lockup, as built"), spec)
    + '<div style="flex:1;display:flex;flex-direction:column;gap:10px">%s%s</div>' % (eyebrow("The tracking ladder &mdash; five values, no others"), ladder)
  + '</div>'
  + '<div style="margin-top:auto;padding-top:16px;border-top:1px solid %s;font:400 12.5px/1.6 %s;color:%s;max-width:88ch">'
    'The strapline is deliberately set in --text-muted rather than a lighter grey: the next step down the ramp '
    'measures 3.07:1 on white, which fails. At 12&nbsp;px it stays sentence case, because pushed to a tracked '
    'uppercase label it stops reading as a sentence and starts reading as a section heading.</div>'
    % (RULE, SANS, MUTED)
  + '</div>')
W("Typography.dc.html", plate(1000, 700, inner))

# ---------------------------------------------------------------- canvas.json
import json
canvas = {
  "artboards": [
    {"file":"Main.dc.html","x":0,"y":0,"w":1000,"h":700},
    {"file":"Construction.dc.html","x":1120,"y":0,"w":1000,"h":740},
    {"file":"Sizes.dc.html","x":0,"y":860,"w":1000,"h":620},
    {"file":"Colour.dc.html","x":1120,"y":860,"w":1000,"h":620},
    {"file":"Lockups.dc.html","x":0,"y":1640,"w":1000,"h":720},
    {"file":"Typography.dc.html","x":1120,"y":1640,"w":1000,"h":700},
  ],
  "launch": {"view":"canvas"},
}
W("canvas.json", json.dumps(canvas, indent=2))
print("wrote", sorted(f for f in os.listdir(OUT) if f.endswith(('.dc.html','.json'))))
