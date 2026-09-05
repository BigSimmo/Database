"""Emit the second-edition -> ward-tokens role map, by ROLE, with contrast.

Matching by VALUE cannot work here: six of seven neutral roles differ, one by a
single hex digit. So the mapping is authored by role and this script's job is to
print the evidence beside each row, not to discover the pairing.
"""

import pathlib
import re

PROTO = pathlib.Path("docs/ward-flow/design/prototypes/design-language.html")
V2 = pathlib.Path("src/app/ckb-v2-tokens.css")
WARD = pathlib.Path("src/components/ward-management/ward-tokens.module.css")


def lin(c):
    c = c / 255
    return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4


def lum(h):
    h = h.lstrip("#")
    if len(h) == 3:
        h = "".join(ch * 2 for ch in h)
    r, g, b = (int(h[i : i + 2], 16) for i in (0, 2, 4))
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)


def ratio(a, b):
    la, lb = lum(a), lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def first_root_values(path, indent):
    """Literal hex values as first declared (the light theme), by token name."""
    out = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        m = re.match(rf"^{indent}(--[a-z0-9-]+):\s*(#[0-9a-fA-F]{{3,8}})\s*;", line)
        if m and m.group(1) not in out:
            out[m.group(1)] = m.group(2).lower()
    return out


proto = first_root_values(PROTO, r" {4}")
v2 = first_root_values(V2, r" {2}")

# ward-tokens aliases: --ward-x -> --y
ward = {}
for m in re.finditer(r"(--ward-[a-z0-9-]+):\s*var\((--[a-z0-9-]+)\)", WARD.read_text(encoding="utf-8")):
    ward[m.group(1)] = m.group(2)

# Authored BY ROLE. Left: the mockup's token. Right: the ward-tokens role a
# screen must use instead. None = no ward role carries this; it is a finding.
ROLE_MAP = [
    ("--ground", "--ward-ground", "the page ground WardGround owns"),
    ("--surface", "--ward-canvas", "a panel's own fill"),
    ("--surface-2", "--ward-chrome", "a panel header / recessed strip"),
    ("--sunken", "--ward-subtle", "the deepest recess (occupancy bar track)"),
    ("--ink", "--ward-heading", "heading ink"),
    ("--ink-2", "--ward-text", "body ink"),
    ("--muted", "--ward-muted", "secondary ink"),
    ("--faint", "--ward-muted", "quiet ink — NO separate ward role, see note"),
    ("--rule", "--ward-divider", "a rule inside a panel"),
    ("--rule-2", "--ward-border", "a panel edge"),
    ("--accent", "--ward-blue", "the brand accent"),
    ("--accent-strong", "--ward-blue", "accent, pressed/strong — NO separate role"),
    ("--accent-wash", "--ward-blue-soft", "accent fill"),
    ("--good", "--ward-success", "success ink"),
    ("--good-wash", "--ward-success-soft", "success fill"),
    ("--signal", "--ward-warning", "warning ink"),
    ("--signal-wash", "--ward-warning-soft", "warning fill"),
    ("--crit", "--ward-danger", "danger ink"),
    ("--crit-wash", "--ward-danger-soft", "danger fill"),
    ("--cool", None, "the fifth state colour — NO ward role at all"),
    ("--cool-wash", None, "same"),
]

print("| mockup token | its hex | ward role to use | resolves to | that hex | same? | on white |")
print("| --- | --- | --- | --- | --- | --- | --- |")
findings = []
for token, ward_role, note in ROLE_MAP:
    ph = proto.get(token, "?")
    if ward_role is None:
        print(f"| `{token}` | `{ph}` | 🔴 **none** | — | — | — | {ratio(ph, '#ffffff'):.2f}:1 |")
        findings.append(f"{token} ({note}) has no ward role")
        continue
    target = ward.get(ward_role)
    th = v2.get(target, "?")
    if th == "?":
        print(f"| `{token}` | `{ph}` | `{ward_role}` | `{target}` | not a literal | ? | — |")
        findings.append(f"{ward_role} -> {target} is not a literal hex in ckb-v2 (indirect)")
        continue
    same = "yes" if ph == th else "**NO**"
    print(
        f"| `{token}` | `{ph}` | `{ward_role}` | `{target}` | `{th}` | {same} | "
        f"{ratio(ph, '#ffffff'):.2f} -> {ratio(th, '#ffffff'):.2f} |"
    )

print()
print("FINDINGS:")
for f in findings:
    print(f"  - {f}")
