from pathlib import Path
import re
import subprocess

# --- search-scope.ts ---
p = Path("src/lib/search-scope.ts")
t = p.read_text(encoding="utf-8")
# First conflict: id required
t = t.replace(
    "<<<<<<< HEAD\n  id?: string;\n=======\n  id: string;\n>>>>>>> origin/main\n",
    "  id: string;\n",
)
# Second conflict: keep loadScopeLabels path (HEAD), drop main inline loop
start = t.index("<<<<<<< HEAD")
end = t.index(">>>>>>> origin/main") + len(">>>>>>> origin/main")
# Verify this is the labels conflict
chunk = t[start:end]
assert "loadScopeLabels" in chunk and "labelQuery" in chunk
replacement = """    const labelRows = await loadScopeLabels({ supabase: args.supabase, candidateIds, signal: args.signal });
    labelsByDocument = new Map();
    for (const label of labelRows) {
      labelsByDocument.set(label.document_id, [...(labelsByDocument.get(label.document_id) ?? []), label]);
    }
"""
# After conflict there's a stray `    }` from broken merge - check
after = t[end:]
# Original HEAD ended with closing of for loop then `    }` for if needsLabels
# Looking at conflict:
# HEAD:
#    const labelRows = ...
#    labelsByDocument = new Map();
#    for (const label of labelRows) {
#      labelsByDocument.set(...);
# =======
#    ... inline ...
#      if (...) break;
# >>>>>>> 
#    }  <-- this closes the for from HEAD incompletely OR closes if from main
#
# After resolution we need:
#    const labelRows = ...
#    labelsByDocument = new Map();
#    for (...) { set }
#  }  // closes if needsLabels

# Remove the conflict including the trailing `    }` that belonged to main's for-loop close
# Read exact bytes after >>>>>>>
rest = t[end:]
# rest starts with newline then `    }` 
if rest.startswith("\n    }"):
    # That `}` was meant to close main's for; with HEAD we need it to close the for(label) which we include, then another for needsLabels
    # Our replacement already closes the for(label) with `    }`
    # Then we still need `  }` for needsLabels - looking at original structure after conflict line 405 was `    }` closing for from main, then line 406 `  }` closing if
    pass

# Better: take clean file from HEAD tip and apply only id: string if needed
head = subprocess.check_output(["git", "show", "HEAD:src/lib/search-scope.ts"], encoding="utf-8")
# HEAD had id?: string - make it required
head = head.replace("type ScopeLabelRow = {\n  id?: string;", "type ScopeLabelRow = {\n  id: string;")
# Also check alternate formatting
if "id?: string" in head:
    head = head.replace("  id?: string;\n  document_id: string;", "  id: string;\n  document_id: string;")
Path("src/lib/search-scope.ts").write_text(head, encoding="utf-8", newline="\n")
assert "<<<<<<<" not in head
assert "id?: string" not in Path("src/lib/search-scope.ts").read_text(encoding="utf-8")
print("search-scope ok")

# --- outstanding-issues: take main, update #030/#075 if PR closed them ---
main_oi = subprocess.check_output(["git", "show", "origin/main:docs/outstanding-issues.md"], encoding="utf-8")
pr_oi = subprocess.check_output(["git", "show", "HEAD:docs/outstanding-issues.md"], encoding="utf-8")

def row(text, issue_id):
    m = re.search(rf"^\| {re.escape(issue_id)} \|.*$", text, re.M)
    return m.group(0) if m else None

for iid in ["#030", "#075"]:
    print(iid, "main open", bool(row(main_oi, iid)), "pr open", bool(row(pr_oi, iid)))
    # check resolved section
    for label, text in [("main", main_oi), ("pr", pr_oi)]:
        if f"| {iid} |" in text.split("## Resolved")[-1][:80000] if "## Resolved" in text else False:
            print(f"  {label} has in resolved archive area")

# Prefer main OI base; if PR moved #030/#075 to resolved, apply that
# Inspect PR tip for #030/#075 status
for iid in ["#030", "#075"]:
    for i, line in enumerate(pr_oi.splitlines()):
        if line.startswith(f"| {iid} "):
            print("PR row", iid, line[:160])

Path("docs/outstanding-issues.md").write_text(main_oi, encoding="utf-8", newline="\n")
print("OI took main; will patch if needed")
