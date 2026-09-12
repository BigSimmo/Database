/* ═══════════════════════════════════════════════════════════════════════
   WARD FLOW SHELL, the script. Third edition.

   Lifted from the owner's rail artifact (helpers, service scope, tasks,
   figures and reconcile, the pages' tallies, sort and filter with the
   refusals, universal search, activity, tasks, tools, the Service
   selector, state changes, menus, events, every screen as data, the rail)
   and rewritten to read the engine's data through a small facade. The
   shell owns no data of its own: every count, line, tag, dot, tile,
   sentence and reconciliation line is derived from the engine's arrays on
   every render, within the chosen service.

   RUNS AFTER THE ENGINE. The engine's script must expose, before this
   file runs, a read only facade at window.WardFlow with:

     NOW                 minutes since midnight (642 is 10:42)
     MOVEMENTS, UNITS, EDS, REFERRALS, OVERRIDES   the engine's arrays,
                         EDS and UNITS each carrying a service field
                         ("East Metro", "North Metro", "South Metro",
                         "WACHS") and REFERRALS a homeService field
     state               the engine's state object (movementId, referralId,
                         unitId, edFilter, queueTab are read and written)
     isOpen(m) isBreached(m)
     ed(id) unit(id) byId(list, id)
     dur(min)            the engine's wait formatter, so the rail and the
                         queue write a wait the same way
     referralQueueOrder()   the referral queue as the engine orders it
     announce(text)      the engine's live region writer
     renderAll()         the engine's full render
     selectMovement(id)  select a movement as the shortlist's subject
     selectQueueTab(name, focus)   optional, shows the patients pane

   The engine must also honour three shell hooks, exposed here at
   window.WardFlowShell:

     visible(m)          a predicate the engine's queueRows() applies to
                         the patient queue (service scope, task filter and
                         search text)
     edVisible(e)        a predicate the engine's renderEds() applies to
                         the pressure strip (service scope)
     filterBar()         html the engine's renderQueueTabs() appends to
                         #qFilter, stating the shell's filters in words
     diagramNote()       the sentence for .diagFoot while a service is
                         chosen: the map shows the whole network
     render()            called at the end of the engine's renderAll(), so
                         the rail, the bar and the drawers follow every
                         engine change. If the engine does not call it, the
                         shell calls it itself after WardFlow.renderAll().
     escape(evt)         the one Escape order. The engine's own Escape
                         handler steps aside when window.WardFlowShell
                         exists.

   The engine's click handler for .railLink must step aside too: the shell
   owns rail clicks.

   IDS in the markup this script finds: live, pageTitle, q, qHint, qClear,
   qPop, searchWrap, svcMenu, svcList, svcLabel, svcCount, svcDot,
   activityMenu, activityPanel, actDot, actDotText, tasksMenu, tasksPanel,
   tasksCount, tasksDot, tasksDotText, toolsMenu, toolsPanel, newMenu,
   rail, qpane-patients (the engine's queue pane). Ids it creates: pinMenu.

   CLASSES it queries: rail, menu, menuPanel, searchWrap, qHit, qRow,
   taskRow, seg, part, railLink, railBtn, flyMenu.

   DATA ATTRIBUTES it reads or sets: data-rail (on the root, open or
   closed), data-rail-toggle, data-page, data-pin, data-svc, data-part,
   data-hit, data-id, data-text, data-key, data-active, data-new, data-act,
   data-close, data-notice, data-go, data-task, data-kind, data-clear,
   data-tone, data-ok, data-open, data-state, data-fresh, data-zero,
   data-set-theme, data-mv (the engine's queue rows).

   KEYS: slash focuses the search. Left bracket flips the rail, not in a
   field and not with a modifier. Enter in the search picks the first
   result. ArrowDown in the search moves into the results. Escape, one step
   per press, in this order: an open pop out, the search results, the
   search text, the engine's ward selection, the engine's referral subject,
   the engine's department filter, the task filter, the service.

   STORAGE: ward-flow-rail (open or closed) and ward-flow-command-appearance
   (light or dark, removed for automatic), both wrapped in try and catch.

   GLOBALS: reads window.WardFlow. Writes window.WardFlowShell and
   window.__reflectAppearance. Appends its sum checks to
   window.__commandCheck when that array exists, and never creates it.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var WF = window.WardFlow;
  if (!WF) {
    if (typeof console !== "undefined")
      console.error("Ward Flow shell: window.WardFlow is absent. The engine must run first.");
    return;
  }

  /* ─── constants the engine does not carry ─── */
  var HANDOVER = "14:00";
  var DATE = "Sat 15 Aug";
  var SHIFT_START_MIN = 7 * 60;
  var HANDOVER_MIN = 14 * 60;
  var NOW_MIN = WF.NOW;
  var NOW = minToClock(NOW_MIN);
  var PINNED = ["WF-021", "WF-009", "WF-014"];

  /* The four services, keyed the way the rail's stripe and dots expect, mapped from the names the
     engine's EDS, UNITS and REFERRALS carry in their service field. */
  var SVC = {
    north: "North Metropolitan",
    east: "East Metropolitan",
    south: "South Metropolitan",
    wachs: "WA Country",
  };
  var SVC_SHORT = { north: "North Metro", east: "East Metro", south: "South Metro", wachs: "WA Country" };
  var SVC_ORDER = ["north", "east", "south", "wachs"];
  var SVC_KEY = { "North Metro": "north", "East Metro": "east", "South Metro": "south", WACHS: "wachs" };

  var state = {
    q: "",
    qOpen: false,
    svc: null,
    task: null,
    tallyPage: "command",
    actPart: "activity",
    seen: {},
    railClosed: document.documentElement.getAttribute("data-rail") === "closed",
  };
  var CHECK = [];

  /* ─── helpers ─── */
  function $(id) {
    return document.getElementById(id);
  }
  function all(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function fmtWait(m) {
    return WF.dur(m);
  }
  function fmtDl(m) {
    if (m.legalDue === null || m.legalDue === undefined) return "No deadline recorded";
    var left = m.legalDue - NOW_MIN;
    if (left < 0) return "Legal deadline passed " + fmtWait(-left) + " ago";
    return "Deadline in " + fmtWait(left);
  }
  function plural(n, one, many) {
    return n === 1 ? one : many;
  }
  function num(n) {
    return n === 0 ? "<i>none</i>" : String(n);
  }
  function cell(n) {
    return n === 0 ? '<span class="zero">none</span>' : String(n);
  }
  function minToClock(m) {
    var h = Math.floor(m / 60) % 24,
      mm = m % 60;
    return (h < 10 ? "0" : "") + h + ":" + (mm < 10 ? "0" : "") + mm;
  }
  function agoText(min) {
    var d = NOW_MIN - min;
    if (d <= 0) return "just now";
    if (d === 1) return "one minute ago";
    if (d < 60) return d + " minutes ago";
    return fmtWait(d) + " ago";
  }
  function nameOf(m) {
    if (m.family && m.given) return m.family + ", " + m.given;
    return m.id;
  }
  function hasName(m) {
    return !!(m.family && m.given);
  }
  function announce(text) {
    WF.announce(text);
  }
  function svcName() {
    return state.svc ? SVC[state.svc] : "all services";
  }
  function edOf(m) {
    return WF.ed(m.ed);
  }
  function svcOfMove(m) {
    var e = edOf(m);
    return e ? SVC_KEY[e.service] || null : null;
  }
  function siteName(code) {
    for (var i = 0; i < WF.EDS.length; i++) {
      if (WF.EDS[i].site === code) return WF.EDS[i].name.replace(/ Emergency Department$/, "");
    }
    return code;
  }
  function edShort(e) {
    return e.name
      .replace(/ Emergency Department$/, "")
      .replace(/ Hospital$| Health Service$| Health Campus$| Public Hospital$/, "");
  }
  function edCodes() {
    return WF.EDS.map(function (e) {
      return e.site;
    });
  }
  function edBySite(code) {
    for (var i = 0; i < WF.EDS.length; i++) if (WF.EDS[i].site === code) return WF.EDS[i];
    return null;
  }
  function moveById(id) {
    return WF.byId(WF.MOVEMENTS, id);
  }
  function ownerOf(m) {
    return m.owner === undefined ? undefined : m.owner;
  }

  /* ─── the service scope: everything below is derived within it ─── */
  function inSvc(m) {
    return !state.svc || svcOfMove(m) === state.svc;
  }
  function openMoves() {
    return WF.MOVEMENTS.filter(WF.isOpen);
  }
  function scoped() {
    return openMoves().filter(inSvc);
  }
  function scopedRefs() {
    return WF.referralQueueOrder().filter(function (r) {
      return !state.svc || SVC_KEY[r.homeService] === state.svc;
    });
  }
  function scopedUnits() {
    return WF.UNITS.filter(function (u) {
      return !state.svc || SVC_KEY[u.service] === state.svc;
    });
  }
  /* Beds by site, summed from the engine's wards: free is the ready count, held is held. */
  function scopedBeds() {
    var by = {},
      order = [];
    scopedUnits().forEach(function (u) {
      if (!by[u.site]) {
        by[u.site] = { code: u.site, site: siteName(u.site), svc: SVC_KEY[u.service], beds: 0, free: 0, held: 0 };
        order.push(u.site);
      }
      by[u.site].beds += u.beds;
      by[u.site].free += u.ready;
      by[u.site].held += u.held;
    });
    return order.map(function (c) {
      return by[c];
    });
  }
  function scopedEds() {
    return WF.EDS.filter(function (e) {
      return !state.svc || SVC_KEY[e.service] === state.svc;
    }).map(function (e) {
      return e.site;
    });
  }
  function edVisible(e) {
    return !state.svc || SVC_KEY[e.service] === state.svc;
  }

  /* ─── the tasks, each a test over the engine's movements ─── */
  function dueSoon(m) {
    return m.legalDue !== null && m.legalDue !== undefined && m.legalDue >= NOW_MIN && m.legalDue - NOW_MIN <= 120;
  }
  var TASKS = [
    {
      key: "breached",
      tone: "danger",
      one: "legal deadline passed",
      many: "legal deadlines passed",
      test: WF.isBreached,
    },
    { key: "soon", tone: "warn", one: "due within 2 hours", many: "due within 2 hours", test: dueSoon },
    {
      key: "unowned",
      tone: "warn",
      one: "with no owner",
      many: "with no owner",
      test: function (m) {
        return ownerOf(m) === null;
      },
    },
    {
      key: "declines",
      tone: null,
      one: "decline to answer",
      many: "declines to answer",
      test: function (m) {
        return m.declines.length > 0 && !m.accepted;
      },
    },
    {
      key: "nobed",
      tone: null,
      one: "accepted, no bed pulled",
      many: "accepted, no bed pulled",
      test: function (m) {
        return m.stage === "accepted_awaiting_bed";
      },
    },
  ];
  function taskByKey(k) {
    for (var i = 0; i < TASKS.length; i++) if (TASKS[i].key === k) return TASKS[i];
    return null;
  }
  function countTask(t) {
    return scoped().filter(t.test).length;
  }

  /* ─── derived figures ─── */
  function figures() {
    var moves = scoped(),
      refs = scopedRefs(),
      beds = scopedBeds();
    var f = { total: moves.length, byEd: {}, bySvc: {}, byTier: { 1: 0, 2: 0, 3: 0 } };
    var longest = null;
    moves.forEach(function (m) {
      var code = edOf(m).site;
      f.byEd[code] = f.byEd[code] || { n: 0, longest: 0, breached: 0 };
      f.byEd[code].n++;
      if (m.waited > f.byEd[code].longest) f.byEd[code].longest = m.waited;
      if (WF.isBreached(m)) f.byEd[code].breached++;
      var s = svcOfMove(m);
      f.bySvc[s] = f.bySvc[s] || { n: 0, breached: 0 };
      f.bySvc[s].n++;
      if (WF.isBreached(m)) f.bySvc[s].breached++;
      f.byTier[m.urgency]++;
      if (!longest || m.waited > longest.waited) longest = m;
    });
    f.longest = longest;
    f.breached = countTask(TASKS[0]);
    f.soon = countTask(TASKS[1]);
    f.unowned = countTask(TASKS[2]);
    f.declines = countTask(TASKS[3]);
    f.nobed = countTask(TASKS[4]);
    f.allDeclined = moves.filter(function (m) {
      return m.declines.length >= 3 && !m.accepted && m.referred.length === 0;
    }).length;
    f.refs = refs.length;
    f.beds = beds.reduce(function (a, b) {
      return a + b.beds;
    }, 0);
    f.free = beds.reduce(function (a, b) {
      return a + b.free;
    }, 0);
    f.held = beds.reduce(function (a, b) {
      return a + b.held;
    }, 0);
    f.sites = beds.length;
    f.noFree = beds.filter(function (b) {
      return b.free === 0;
    });
    f.mostFree =
      beds.slice().sort(function (a, b) {
        return b.free - a.free;
      })[0] || null;
    f.refOldest = refs.reduce(function (a, r) {
      return !a || r.raisedAt < a.raisedAt ? r : a;
    }, null);
    f.refNewest = refs.reduce(function (a, r) {
      return !a || r.raisedAt > a.raisedAt ? r : a;
    }, null);
    f.refOlder = refs.filter(function (r) {
      return r.ageBand === "Older adult";
    }).length;
    f.refNotTriaged = refs.filter(function (r) {
      return r.triagedAt === undefined;
    }).length;
    f.overrides = WF.OVERRIDES.length;
    f.outstanding = f.breached + f.soon + f.unowned + f.declines + f.nobed + f.refs + f.overrides + 1;
    return f;
  }
  /* The shell's own sums, appended to the engine's check so there is one list. */
  function reconcile(f) {
    var edSum = 0,
      svcSum = 0,
      tierSum = f.byTier[1] + f.byTier[2] + f.byTier[3];
    edCodes().forEach(function (c) {
      edSum += f.byEd[c] ? f.byEd[c].n : 0;
    });
    SVC_ORDER.forEach(function (s) {
      svcSum += f.bySvc[s] ? f.bySvc[s].n : 0;
    });
    CHECK.length = 0;
    if (edSum !== f.total) CHECK.push("departments sum to " + edSum + ", not " + f.total);
    if (svcSum !== f.total) CHECK.push("services sum to " + svcSum + ", not " + f.total);
    if (tierSum !== f.total) CHECK.push("tiers sum to " + tierSum + ", not " + f.total);
    PINNED.forEach(function (id) {
      if (!moveById(id)) CHECK.push("pinned movement " + id + " is not in the data");
    });
  }
  function allProblems() {
    var engine = Array.isArray(window.__commandCheck) ? window.__commandCheck : [];
    return engine.concat(CHECK);
  }

  /* ─── the pages, each with the figures it carries in the live tally ─── */
  function table(head, rows, total) {
    var h = '<div class="tableWrap" style="border-top:0"><table class="dataTable"><thead><tr>';
    head.forEach(function (c, i) {
      h += "<th" + (i ? ' class="n"' : "") + ">" + c + "</th>";
    });
    h += "</tr></thead><tbody>";
    if (!rows.length)
      h += '<tr><td colspan="' + head.length + '"><span class="zero">none in ' + esc(svcName()) + "</span></td></tr>";
    rows.forEach(function (r) {
      h += "<tr>";
      r.forEach(function (c, i) {
        h += "<td" + (i ? ' class="n"' : "") + ">" + c + "</td>";
      });
      h += "</tr>";
    });
    if (total && rows.length) {
      h += '<tr class="total">';
      total.forEach(function (c, i) {
        h += "<td" + (i ? ' class="n"' : "") + ">" + c + "</td>";
      });
      h += "</tr>";
    }
    return h + "</tbody></table></div>";
  }
  function facts(rows) {
    var h = '<dl class="statsFacts">';
    rows.forEach(function (r) {
      h += "<dt>" + r[0] + "</dt><dd" + (r[2] ? ' data-tone="' + r[2] + '"' : "") + ">" + r[1] + "</dd>";
    });
    return h + "</dl>";
  }
  function longestVal(f) {
    return f.longest ? fmtWait(f.longest.waited) + " <i>at " + edOf(f.longest).site + "</i>" : "<i>none</i>";
  }
  var PAGES = {
    command: {
      title: "Command",
      core: function (f) {
        return [
          { label: "Waiting in ED", val: num(f.total) },
          { label: "Breached", val: num(f.breached), tone: f.breached > 0 ? "danger" : null },
          { label: "Due within 2 hours", val: num(f.soon), tone: f.soon > 0 ? "warn" : null },
          { label: "Longest wait", val: longestVal(f) },
        ];
      },
      groups: function (f) {
        var nowRows = [
          ["Declined by every ward asked", num(f.allDeclined)],
          ["Accepted with no bed pulled", num(f.nobed)],
          ["Referrals awaiting triage", num(f.refs)],
          ["Overrides for governance review", num(f.overrides)],
          ["Beds free", num(f.free) + " <i>of " + f.beds + "</i>"],
        ];
        if (ownersTracked())
          nowRows.unshift(["Movements with no owner", num(f.unowned), f.unowned > 0 ? "warn" : null]);
        var h = '<section><p class="menuHead">Now</p>' + facts(nowRows) + "</section>";
        h +=
          '<section><p class="menuHead">By emergency department<span class="count">' +
          scopedEds().length +
          "</span></p>" +
          table(
            ["ED", "Waiting", "Longest", "Breached"],
            scopedEds().map(function (c) {
              var e = f.byEd[c] || { n: 0, longest: 0, breached: 0 };
              return [c, cell(e.n), e.n ? fmtWait(e.longest) : '<span class="zero">none</span>', cell(e.breached)];
            }),
          ) +
          "</section>";
        h +=
          '<section><p class="menuHead">By health service</p>' +
          table(
            ["Service", "Waiting", "Breached"],
            SVC_ORDER.filter(function (s) {
              return !state.svc || s === state.svc;
            }).map(function (s) {
              var e = f.bySvc[s] || { n: 0, breached: 0 };
              return [SVC_SHORT[s], cell(e.n), cell(e.breached)];
            }),
          ) +
          "</section>";
        h +=
          '<section><p class="menuHead">By tier</p>' +
          table(
            ["Tier", "Waiting"],
            [1, 2, 3].map(function (t) {
              return ["Tier " + t, cell(f.byTier[t])];
            }),
          ) +
          "</section>";
        h +=
          '<section><p class="menuHead">Beds by site<span class="count">' +
          f.sites +
          " drawn</span></p>" +
          table(
            ["Site", "Beds", "Free", "Held"],
            scopedBeds().map(function (b) {
              return [b.code, b.beds, cell(b.free), cell(b.held)];
            }),
            [f.sites + " " + plural(f.sites, "site", "sites"), f.beds, cell(f.free), cell(f.held)],
          ) +
          "</section>";
        return h;
      },
      reconcileLine: function (f) {
        var p = allProblems();
        return p.length
          ? p.length + " " + plural(p.length, "figure does", "figures do") + " not reconcile: " + p.join(", ") + "."
          : "Figures reconcile: " +
              f.total +
              " " +
              plural(f.total, "movement", "movements") +
              " across " +
              scopedEds().length +
              " " +
              plural(scopedEds().length, "department", "departments") +
              " and 3 tiers, in " +
              svcName() +
              ".";
      },
    },
    capacity: {
      title: "Capacity",
      core: function (f) {
        return [
          { label: "Beds free", val: num(f.free) + " <i>of " + f.beds + "</i>" },
          {
            label: plural(f.noFree.length, "Site with none", "Sites with none"),
            val: num(f.noFree.length),
            tone: f.noFree.length > 0 ? "warn" : null,
          },
          { label: "Held", val: num(f.held) },
          { label: "Sites drawn", val: num(f.sites) },
        ];
      },
      groups: function (f) {
        var h =
          '<section><p class="menuHead">Now</p>' +
          facts([
            ["Most free", f.mostFree ? f.mostFree.free + " at " + f.mostFree.code : "<i>none</i>"],
            ["Accepted with no bed pulled", num(f.nobed)],
            ["Waiting in ED", num(f.total)],
          ]) +
          "</section>";
        h +=
          '<section><p class="menuHead">By site<span class="count">' +
          f.sites +
          " drawn</span></p>" +
          table(
            ["Site", "Beds", "Free", "Held"],
            scopedBeds().map(function (b) {
              return [b.code, b.beds, cell(b.free), cell(b.held)];
            }),
            [f.sites + " " + plural(f.sites, "site", "sites"), f.beds, cell(f.free), cell(f.held)],
          ) +
          "</section>";
        var bySvc = {};
        scopedBeds().forEach(function (b) {
          bySvc[b.svc] = bySvc[b.svc] || { beds: 0, free: 0 };
          bySvc[b.svc].beds += b.beds;
          bySvc[b.svc].free += b.free;
        });
        h +=
          '<section><p class="menuHead">By health service</p>' +
          table(
            ["Service", "Beds", "Free"],
            SVC_ORDER.filter(function (s) {
              return !state.svc || s === state.svc;
            }).map(function (s) {
              var e = bySvc[s] || { beds: 0, free: 0 };
              return [SVC_SHORT[s], cell(e.beds), cell(e.free)];
            }),
          ) +
          '<p class="menuNote" style="padding-left:14px">A service with no ward drawn reads none. Absence here means not drawn, not that no bed exists.</p></section>';
        return h;
      },
      reconcileLine: function (f) {
        return (
          "Figures reconcile: " +
          f.sites +
          " " +
          plural(f.sites, "site sums", "sites sum") +
          " to " +
          f.beds +
          " beds and " +
          f.free +
          " free, in " +
          svcName() +
          "."
        );
      },
    },
    referrals: {
      title: "Referrals",
      core: function (f) {
        var oldest = f.refOldest ? NOW_MIN - f.refOldest.raisedAt : null;
        return [
          { label: "In the queue", val: num(f.refs) },
          {
            label: "Oldest",
            val: oldest === null ? "<i>none</i>" : fmtWait(oldest),
            tone: oldest !== null && oldest > 120 ? "warn" : null,
          },
          { label: "Older adult", val: num(f.refOlder) },
          { label: "Not yet triaged", val: num(f.refNotTriaged) },
        ];
      },
      groups: function (f) {
        var refs = scopedRefs();
        var h =
          '<section><p class="menuHead">Now</p>' +
          facts([
            ["Newest", f.refNewest ? fmtWait(NOW_MIN - f.refNewest.raisedAt) + ", " + f.refNewest.id : "<i>none</i>"],
            ["Triaged", num(refs.length - f.refNotTriaged)],
          ]) +
          "</section>";
        var by = function (key, label) {
          var m = {},
            order = [];
          refs.forEach(function (r) {
            if (!m[r[key]]) order.push(r[key]);
            m[r[key]] = (m[r[key]] || 0) + 1;
          });
          return table(
            [label, "Waiting"],
            order.map(function (k) {
              return [k, cell(m[k])];
            }),
          );
        };
        h += '<section><p class="menuHead">By home service</p>' + by("homeService", "Service") + "</section>";
        h += '<section><p class="menuHead">By age band</p>' + by("ageBand", "Age band") + "</section>";
        h +=
          '<section><p class="menuHead">Waiting<span class="count">' +
          refs.length +
          "</span></p>" +
          table(
            ["Referral", "Raised", "Waiting"],
            refs.map(function (r) {
              return [r.id, minToClock(r.raisedAt), fmtWait(NOW_MIN - r.raisedAt)];
            }),
          ) +
          "</section>";
        return h;
      },
      reconcileLine: function (f) {
        return (
          "Figures reconcile: " +
          f.refs +
          " " +
          plural(f.refs, "referral", "referrals") +
          " by service and by age band, in " +
          svcName() +
          "."
        );
      },
    },
  };

  /* ─── sort and filter, with the refusals ─── */
  function refusal(q) {
    if (/\b(risk|acuity|score|scores|best match)\b/i.test(q))
      return "Search does not return a risk or acuity score or a best match. Search by name, identifier, department or ward.";
    if (/\b(closed|arrived|discharged)\b/i.test(q))
      return "Closed and arrived movements are not searchable here. They are in the Movement screen's register.";
    return null;
  }
  function unitNames(m) {
    var names = [];
    if (m.accepted && WF.unit(m.accepted)) names.push(WF.unit(m.accepted).name);
    m.referred.forEach(function (id) {
      if (WF.unit(id)) names.push(WF.unit(id).name);
    });
    m.declines.forEach(function (d) {
      if (WF.unit(d.unit)) names.push(WF.unit(d.unit).name);
    });
    return names;
  }
  function matches(m, q) {
    var e = edOf(m);
    var hay = [
      m.id,
      hasName(m) ? m.given + " " + m.family : "",
      hasName(m) ? nameOf(m) : "",
      e.site,
      e.name,
      "tier " + m.urgency,
      m.legalStatus || "",
    ]
      .concat(unitNames(m))
      .concat(ownerOf(m) ? [ownerOf(m)] : [])
      .join(" ")
      .toLowerCase();
    return hay.indexOf(q.toLowerCase()) !== -1;
  }
  /* The predicate the engine's queueRows() applies. Service scope, then the task filter, then the
     search text. A refused search filters nothing, because it returns nothing. */
  function visible(m) {
    if (!inSvc(m)) return false;
    if (state.task && !taskByKey(state.task).test(m)) return false;
    if (state.q && !refusal(state.q) && !matches(m, state.q)) return false;
    return true;
  }
  function shownCount() {
    var rows = openMoves().filter(visible);
    if (WF.state.edFilter)
      rows = rows.filter(function (m) {
        return m.ed === WF.state.edFilter;
      });
    return rows.length;
  }
  function shownText() {
    return "Showing " + shownCount() + " of " + openMoves().length + ".";
  }
  function ownersTracked() {
    return openMoves().some(function (m) {
      return ownerOf(m) !== undefined;
    });
  }
  /* The filter bar above the queue, appended by the engine's renderQueueTabs. */
  function filterBar() {
    var ref = state.q ? refusal(state.q) : null;
    if (ref)
      return (
        '<div class="filterBar"><span>' +
        ref +
        '</span><button type="button" class="linkBtn" data-clear="q">Clear search</button></div>'
      );
    var parts = [];
    if (state.svc) parts.push("in " + SVC[state.svc]);
    if (state.task) {
      var t = taskByKey(state.task);
      var n = countTask(t);
      parts.push(n + " " + plural(n, t.one, t.many));
    }
    if (state.q) parts.push("matching “" + esc(state.q) + "”");
    if (!parts.length) return "";
    return (
      '<div class="filterBar"><span>Showing ' +
      shownCount() +
      " of " +
      openMoves().length +
      ", " +
      parts.join(", ") +
      '.</span><button type="button" class="linkBtn" data-clear="all">Show all</button></div>'
    );
  }
  function diagramNote() {
    return state.svc ? "Showing the whole network. The queue is scoped to " + SVC[state.svc] + "." : "";
  }

  /* ─── universal search ─── */
  var ACTIONS = [
    { key: "print", label: "Print handover sheet", words: "print handover sheet", small: "Tools" },
    { key: "tools", label: "Ward and ED contacts", words: "ward contacts extension email ed contacts", small: "Tools" },
    { key: "new", label: "Raise a referral", words: "new referral raise", small: "primary" },
    {
      key: "tally",
      label: "Live tally for this page",
      words: "figures statistics stats numbers tally",
      small: "Activity",
    },
    { key: "tasks", label: "Outstanding tasks", words: "tasks outstanding work notices", small: "Tasks" },
    { key: "activity", label: "What is going on", words: "activity events going on log", small: "Activity" },
  ];
  function hits(q) {
    var ql = q.trim().toLowerCase();
    var r = { patients: [], eds: [], wards: [], owners: [], actions: [] };
    if (!ql) return r;
    openMoves().forEach(function (m) {
      var hay = (m.id + " " + (hasName(m) ? m.given + " " + m.family + " " + nameOf(m) : "")).toLowerCase();
      if (hay.indexOf(ql) !== -1) r.patients.push(m);
    });
    WF.EDS.forEach(function (e) {
      if ((e.site + " " + e.name).toLowerCase().indexOf(ql) !== -1) r.eds.push(e);
    });
    WF.UNITS.forEach(function (u) {
      if (u.name.toLowerCase().indexOf(ql) !== -1) r.wards.push(u.name);
    });
    var owners = {};
    openMoves().forEach(function (m) {
      var o = ownerOf(m);
      if (o) owners[o] = (owners[o] || 0) + 1;
    });
    Object.keys(owners).forEach(function (o) {
      if (o.toLowerCase().indexOf(ql) !== -1) r.owners.push({ name: o, n: owners[o] });
    });
    ACTIONS.forEach(function (a) {
      if (a.words.indexOf(ql) !== -1 || a.label.toLowerCase().indexOf(ql) !== -1) r.actions.push(a);
    });
    r.any = r.patients.length + r.eds.length + r.wards.length + r.owners.length + r.actions.length > 0;
    return r;
  }
  function renderSearch() {
    var q = state.q.trim();
    var html = "";
    if (q) {
      var ref = refusal(q);
      if (ref) {
        html = '<p class="qNone">' + ref + "</p>";
      } else {
        var h = hits(q);
        if (!h.any) {
          html =
            '<p class="qNone">Nothing matches “' +
            esc(q) +
            "”. Search finds patients by name or identifier, movements, departments, wards and tools.</p>";
        } else {
          if (h.patients.length) {
            html +=
              '<p class="menuHead">Patients<span class="count">' +
              h.patients.length +
              ' open</span></p><div class="menuList">';
            h.patients.slice(0, 6).forEach(function (m, i) {
              var under = WF.isBreached(m) ? "<em>" + fmtDl(m) + "</em>" : fmtDl(m);
              var outside = state.svc && svcOfMove(m) !== state.svc ? " Outside " + SVC[state.svc] + "." : "";
              html +=
                '<button type="button" class="qHit" data-hit="patient" data-id="' +
                m.id +
                '"' +
                (i === 0 ? ' data-active="true"' : "") +
                "><b>" +
                esc(nameOf(m)) +
                "</b><small>" +
                (hasName(m) ? m.id + ", " : "") +
                "Tier " +
                m.urgency +
                ", " +
                fmtWait(m.waited) +
                '</small><span class="under">' +
                esc(edOf(m).name) +
                ". " +
                under +
                "." +
                outside +
                "</span></button>";
            });
            html += "</div>";
          }
          if (h.eds.length) {
            html += '<p class="menuHead">Emergency departments</p><div class="menuList">';
            h.eds.forEach(function (e) {
              html +=
                '<button type="button" class="qHit" data-hit="text" data-text="' +
                esc(e.site) +
                '"><b>' +
                esc(e.name) +
                "</b><small>" +
                esc(SVC_SHORT[SVC_KEY[e.service]] || e.service) +
                ", filter the queue</small></button>";
            });
            html += "</div>";
          }
          if (h.wards.length) {
            html += '<p class="menuHead">Wards</p><div class="menuList">';
            h.wards.slice(0, 5).forEach(function (w) {
              html +=
                '<button type="button" class="qHit" data-hit="text" data-text="' +
                esc(w) +
                '"><b>' +
                esc(w) +
                "</b><small>filter the queue</small></button>";
            });
            html += "</div>";
          }
          if (h.owners.length) {
            html += '<p class="menuHead">Owners</p><div class="menuList">';
            h.owners.forEach(function (o) {
              html +=
                '<button type="button" class="qHit" data-hit="text" data-text="' +
                esc(o.name) +
                '"><b>' +
                esc(o.name) +
                "</b><small>" +
                o.n +
                " " +
                plural(o.n, "movement", "movements") +
                "</small></button>";
            });
            html += "</div>";
          }
          if (h.actions.length) {
            html += '<p class="menuHead">Tools and views</p><div class="menuList">';
            h.actions.forEach(function (a) {
              html +=
                '<button type="button" class="qHit" data-hit="action" data-key="' +
                a.key +
                '"><b>' +
                a.label +
                "</b><small>" +
                a.small +
                "</small></button>";
            });
            html += "</div>";
          }
        }
      }
      html +=
        '<p class="popFoot"><span>Names are invented.</span><span>Search never returns a risk score, an acuity score or a best match.</span></p>';
    }
    $("qPop").innerHTML = html;
    $("searchWrap").setAttribute("data-open", state.qOpen && q ? "true" : "false");
  }

  /* ─── activity: the events, the notices, the sentence, the tally ─── */
  function events() {
    var ev = [];
    scoped().forEach(function (m) {
      var opened = NOW_MIN - m.waited;
      if (opened >= 0)
        ev.push({
          min: opened,
          tone: null,
          text: "<b>" + m.id + "</b> opened at " + esc(edOf(m).name) + ", Tier " + m.urgency + ".",
        });
      if (WF.isBreached(m))
        ev.push({
          min: m.legalDue,
          tone: "danger",
          text: "<b>" + m.id + "</b> passed its legal deadline at " + esc(edOf(m).name) + ".",
        });
      m.declines.forEach(function (d) {
        if (d.at !== undefined && WF.unit(d.unit))
          ev.push({
            min: d.at,
            tone: "warn",
            text:
              esc(WF.unit(d.unit).name) + " declined <b>" + m.id + "</b>. " + esc(d.reason || "Reason recorded") + ".",
          });
      });
      if (m.escalation && m.escalation.at !== undefined)
        ev.push({
          min: m.escalation.at,
          tone: "warn",
          text: "<b>" + m.id + "</b> escalated to " + esc(m.escalation.contact || "the coordinator on call") + ".",
        });
    });
    scopedRefs().forEach(function (r) {
      ev.push({
        min: r.raisedAt,
        tone: null,
        text: "<b>" + r.id + "</b> raised. " + esc(r.ageBand) + ", " + esc(r.homeService) + ".",
      });
      if (r.triagedAt !== undefined) ev.push({ min: r.triagedAt, tone: null, text: "<b>" + r.id + "</b> triaged." });
    });
    WF.OVERRIDES.forEach(function (o) {
      var m = moveById(o.movement);
      if (!m || !inSvc(m)) return;
      ev.push({
        min: o.at,
        tone: null,
        text:
          "Override recorded on <b>" +
          o.movement +
          "</b>, " +
          esc(o.gate.toLowerCase()) +
          " at " +
          esc(WF.unit(o.unit) ? WF.unit(o.unit).name : o.unit) +
          ", for governance review.",
      });
    });
    ev.sort(function (a, b) {
      return b.min - a.min;
    });
    return ev;
  }
  /* A notice is something that changed: an override recorded, or a legal deadline passed within
     the last hour. A bed pulled has no time in the engine's data, so it is not invented. */
  function notices() {
    var n = [];
    WF.OVERRIDES.forEach(function (o, i) {
      var m = moveById(o.movement);
      if (!m || !inSvc(m)) return;
      n.push({
        key: "o" + i,
        min: o.at,
        tone: null,
        text: "Override recorded on <b>" + o.movement + "</b>, for governance review.",
      });
    });
    scoped().forEach(function (m) {
      if (WF.isBreached(m) && NOW_MIN - m.legalDue <= 60)
        n.push({
          key: m.id,
          min: m.legalDue,
          tone: "danger",
          text: "<b>" + m.id + "</b> passed its legal deadline at " + esc(edOf(m).name) + ".",
        });
    });
    n.sort(function (a, b) {
      return b.min - a.min;
    });
    return n;
  }
  function summary(f) {
    var where = state.svc ? " in " + SVC[state.svc] : "";
    if (f.total === 0 && f.sites === 0)
      return (
        "Nothing is open" +
        where +
        ". No department there has a movement open and no site there is drawn in this prototype. Absence here means none, not that nothing exists."
      );
    var breachedAt = scopedEds()
      .filter(function (c) {
        return f.byEd[c] && f.byEd[c].breached > 0;
      })
      .map(function (c) {
        return edShort(edBySite(c));
      });
    var s =
      "<b>" +
      f.total +
      "</b> " +
      plural(f.total, "person is", "people are") +
      " waiting in <b>" +
      scopedEds().length +
      "</b> emergency " +
      plural(scopedEds().length, "department", "departments") +
      where +
      ". ";
    if (f.breached === 0) s += "None has passed a legal deadline. ";
    else
      s +=
        '<b data-tone="danger">' +
        f.breached +
        "</b> " +
        plural(f.breached, "has", "have") +
        " passed a legal deadline, at " +
        breachedAt.join(" and ") +
        ". ";
    s += f.soon
      ? "<b>" + f.soon + "</b> more " + plural(f.soon, "falls", "fall") + " due within two hours. "
      : "None falls due within two hours. ";
    if (ownersTracked())
      s += f.unowned
        ? "<b>" + f.unowned + "</b> " + plural(f.unowned, "movement has", "movements have") + " no owner. "
        : "Every movement has an owner. ";
    var withFree = f.sites - f.noFree.length;
    s +=
      "<b>" +
      f.free +
      "</b> beds are free at " +
      withFree +
      " of the " +
      f.sites +
      " " +
      plural(f.sites, "site", "sites") +
      " drawn" +
      (f.noFree.length
        ? ", none at " +
          f.noFree
            .map(function (b) {
              return b.site;
            })
            .join(" or ")
        : "") +
      ". ";
    s +=
      "<b>" +
      (f.refs || "No") +
      "</b> " +
      plural(f.refs, "referral is", "referrals are") +
      " in the queue. Handover is due at <b>" +
      HANDOVER +
      "</b>.";
    return s;
  }
  function pageOf(key) {
    if (PAGES[key]) return PAGES[key];
    var s = SCREENS[key];
    return {
      title: s.title,
      core: s.core || PAGES.command.core,
      groups: PAGES.command.groups,
      reconcileLine: PAGES.command.reconcileLine,
    };
  }
  function renderActivity(f) {
    var ev = events();
    var last = ev.length ? ev[0].min : null;
    var page = pageOf(state.tallyPage);
    var live = last !== null && NOW_MIN - last <= 5;
    var html =
      '<div class="popHead"><h2>Activity</h2><span class="count">' +
      esc(svcName()) +
      '</span><button type="button" class="closeBtn" data-close="1">Close</button>' +
      '<span class="fresh"><span class="dot" data-tone="good" aria-hidden="true"></span>Live, reconciled ' +
      NOW +
      (last !== null ? ", last event " + minToClock(last) + ", " + agoText(last) : ", no event today") +
      "</span></div>";
    html +=
      '<div class="seg" role="group" aria-label="Two parts"><button type="button" data-part="activity" aria-pressed="' +
      (state.actPart === "activity" ? "true" : "false") +
      '">Activity<span class="count">' +
      ev.length +
      '</span></button><button type="button" data-part="tally" aria-pressed="' +
      (state.actPart === "tally" ? "true" : "false") +
      '">Live tally<span class="count">' +
      esc(page.title) +
      "</span></button></div>";
    html +=
      '<div class="popBody part" data-part="activity"' +
      (state.actPart === "activity" ? "" : " hidden") +
      '><section><p class="menuHead">What is going on</p><p class="actSum">' +
      summary(f) +
      "</p></section>";
    html +=
      '<section><p class="menuHead">Last events<span class="count">' +
      Math.min(ev.length, 14) +
      " of " +
      ev.length +
      " today</span></p>";
    if (!ev.length) html += '<p class="menuNote">No event today in ' + esc(svcName()) + ".</p>";
    else {
      html += '<ol class="feed">';
      ev.slice(0, 14).forEach(function (e) {
        html +=
          '<li class="feedItem"' +
          (e.tone ? ' data-tone="' + e.tone + '"' : "") +
          "><time>" +
          minToClock(e.min) +
          '</time><span class="dot" aria-hidden="true"></span><span>' +
          e.text +
          "</span></li>";
      });
      html += "</ol>";
    }
    html += "</section></div>";
    html +=
      '<div class="popBody part" data-part="tally"' +
      (state.actPart === "tally" ? "" : " hidden") +
      '><p class="menuHead" style="padding-left:14px">' +
      esc(page.title) +
      ' now<span class="count">' +
      esc(svcName()) +
      '</span></p><div class="tally">';
    page.core(f).forEach(function (c) {
      html +=
        '<div class="tile"' +
        (c.tone ? ' data-tone="' + c.tone + '"' : "") +
        "><small>" +
        c.label +
        "</small><b>" +
        c.val +
        "</b></div>";
    });
    html += '</div><div class="figGrid">' + page.groups(f) + "</div>";
    html +=
      '<p class="statsFoot"><span>' +
      page.reconcileLine(f) +
      "</span><span>Reconciled at " +
      NOW +
      ".</span><span>Every figure is invented.</span></p></div>";
    html +=
      '<p class="popFoot"><span>Events are derived from the data and listed newest first.</span><span>The live product would stream them from the pathway record and say when the stream last spoke.</span></p>';
    $("activityPanel").innerHTML = html;
    $("actDot").hidden = !live;
    var t = $("actDotText");
    if (t) t.textContent = live ? ", live" : ", quiet";
  }

  /* ─── tasks ─── */
  function renderTasks(f) {
    var rows = [];
    TASKS.forEach(function (t) {
      var n = countTask(t);
      if (n === 0) return;
      rows.push({
        key: t.key,
        tone: t.tone,
        n: n,
        word: plural(n, t.one, t.many),
        kind: "filter",
        hint: "filter the queue",
      });
    });
    if (f.refs)
      rows.push({
        key: "referrals",
        tone: null,
        n: f.refs,
        word: plural(f.refs, "referral in the queue", "referrals in the queue"),
        kind: "go",
        hint: "open the Referrals tab",
      });
    if (f.overrides)
      rows.push({
        key: "overrides",
        tone: null,
        n: f.overrides,
        word: plural(f.overrides, "override to review", "overrides to review"),
        kind: "go",
        hint: "Governance",
      });
    rows.push({
      key: "handover",
      tone: null,
      n: null,
      word: "Handover sheet due " + HANDOVER,
      kind: "go",
      hint: "print from Tools",
    });
    var outstanding = rows.reduce(function (a, c) {
      return a + (c.n || 1);
    }, 0);
    var ns = notices();
    var unseen = ns.filter(function (n) {
      return !state.seen[n.key];
    });
    var html =
      '<div class="popHead"><h2>Tasks</h2><span class="count">' +
      outstanding +
      " outstanding, " +
      rows.length +
      ' kinds</span><button type="button" class="closeBtn" data-close="1">Close</button></div>';
    html +=
      '<div class="popBody"><section><p class="menuHead">Notices<span class="count">' +
      (unseen.length ? unseen.length + " new" : "none new") +
      "</span></p>";
    if (!ns.length) html += '<p class="menuNote">No notices since handover in ' + esc(svcName()) + ".</p>";
    else {
      html += '<ol class="notices">';
      ns.forEach(function (n) {
        var isNew = !state.seen[n.key];
        html +=
          '<li class="notice" data-fresh="' +
          (isNew ? "true" : "false") +
          '"><time>' +
          minToClock(n.min) +
          "</time><span>" +
          n.text +
          "</span>" +
          (isNew ? '<button type="button" class="seen" data-notice="' + n.key + '">Seen</button>' : "<span></span>") +
          "</li>";
      });
      html += "</ol>";
    }
    html +=
      '<p class="menuNote">A notice is something that changed. It stays until it is marked seen, and the dot on the button goes when none is new.</p></section>';
    html += '<section><p class="menuHead">Work open<span class="count">worst first</span></p><div class="taskRows">';
    rows.forEach(function (c) {
      var fig = c.n === null ? "<b><i>at</i></b>" : "<b>" + c.n + "</b>";
      html +=
        '<button type="button" class="taskRow" data-task="' +
        c.key +
        '" data-kind="' +
        c.kind +
        '"' +
        (c.tone ? ' data-tone="' + c.tone + '"' : "") +
        (c.kind === "filter" ? ' aria-pressed="' + (state.task === c.key ? "true" : "false") + '"' : "") +
        ">" +
        fig +
        "<span>" +
        c.word +
        "</span><small>" +
        c.hint +
        "</small></button>";
    });
    html +=
      '</div><div class="menuList" style="padding-top:0"><button type="button" class="linkBtn" data-go="queue" style="padding:4px 10px;text-align:left">Show in queue</button></div></section></div>';
    html +=
      '<p class="popFoot"><span>Counts are derived from the open movements in ' +
      esc(svcName()) +
      " on every render.</span><span>A task with a count of none is not shown.</span></p>";
    $("tasksPanel").innerHTML = html;
    $("tasksCount").textContent = String(outstanding);
    var dot = $("tasksDot");
    dot.hidden = unseen.length === 0;
    var breach = unseen.some(function (n) {
      return n.tone === "danger";
    });
    if (breach) dot.setAttribute("data-tone", "danger");
    else dot.removeAttribute("data-tone");
    var t = $("tasksDotText");
    if (t)
      t.textContent = unseen.length
        ? ", " + unseen.length + " new " + plural(unseen.length, "notice", "notices") + (breach ? ", one a breach" : "")
        : ", no new notice";
  }

  /* ─── tools ─── */
  function contactsTable(rows) {
    return (
      '<div class="tableWrap" style="border-top:1px solid var(--line)"><table class="dataTable"><thead><tr><th>Name</th><th>Extension</th><th>Email</th></tr></thead><tbody>' +
      rows.join("") +
      "</tbody></table></div>"
    );
  }
  function renderTools() {
    var glyph = function (d) {
      return '<svg class="glyph" viewBox="0 0 16 16" aria-hidden="true"><path d="' + d + '" /></svg>';
    };
    var html =
      '<div class="popHead"><h2>Tools</h2><span class="count">' +
      esc(svcName()) +
      '</span><button type="button" class="closeBtn" data-close="1">Close</button></div>';
    html +=
      '<div class="popBody"><section><div class="who"><b>Bed coordinator</b><span>Day shift, handover ' +
      HANDOVER +
      ", " +
      DATE +
      " AWST</span></div></section>";
    html += '<section><p class="menuHead">Do</p><div class="toolList">';
    html +=
      '<button type="button" class="toolItem" data-act="print">' +
      glyph("M4 6V2h8v4M4 12H2V7h12v5h-2M4 10h8v4H4z") +
      "<span>Print handover sheet<em>The queue and the registers as a record, due " +
      HANDOVER +
      "</em></span><small>print</small></button>";
    html +=
      '<button type="button" class="toolItem" data-act="export">' +
      glyph("M8 2v8M5 7l3 3 3-3M3 12v2h10v-2") +
      "<span>Export the queue<em>The open movements in " +
      esc(svcName()) +
      " as a sheet</em></span><small>not wired</small></button>";
    html +=
      '<button type="button" class="toolItem" data-act="new">' +
      glyph("M8 3v10M3 8h10") +
      "<span>Raise a referral<em>With the source chosen first</em></span><small>primary</small></button>";
    html += "</div></section>";
    var wards = scopedUnits();
    html +=
      '<section class="contacts"><p class="menuHead">Ward contacts<span class="count">' +
      wards.length +
      " " +
      plural(wards.length, "ward", "wards") +
      "</span></p>";
    html +=
      '<p class="menuNote" style="max-width:none;padding-left:14px">Extensions and addresses are placeholders in the shape the live product would show. None is real. The live product reads the site directory and says when it last did.</p>';
    html += wards.length
      ? contactsTable(
          wards.map(function (u) {
            var slug = u.name.toLowerCase().replace(/\s+/g, ".");
            var n = WF.UNITS.indexOf(u) + 1;
            return (
              "<tr><td>" +
              esc(u.name) +
              "<em>" +
              esc(siteName(u.site)) +
              '</em></td><td class="holder">ext ' +
              (n < 10 ? "0" : "") +
              n +
              '</td><td class="holder">' +
              slug +
              "@example.invalid</td></tr>"
            );
          }),
        )
      : '<p class="menuNote" style="padding-left:14px">No ward in ' +
        esc(svcName()) +
        " is drawn in this prototype.</p>";
    html += "</section>";
    var eds = WF.EDS.filter(edVisible);
    html +=
      '<section class="contacts"><p class="menuHead">Emergency department contacts<span class="count">' +
      eds.length +
      " " +
      plural(eds.length, "department", "departments") +
      "</span></p>";
    html += eds.length
      ? contactsTable(
          eds.map(function (e) {
            return (
              "<tr><td>" +
              esc(e.site) +
              " ED<em>" +
              esc(e.name.replace(/ Emergency Department$/, "")) +
              '</em></td><td class="holder">ext 1' +
              (WF.EDS.indexOf(e) + 1) +
              '</td><td class="holder">' +
              e.site.toLowerCase() +
              ".ed@example.invalid</td></tr>"
            );
          }),
        )
      : '<p class="menuNote" style="padding-left:14px">No department in ' +
        esc(svcName()) +
        " is drawn in this prototype.</p>";
    html += "</section>";
    html +=
      '<section><p class="menuHead" id="apLabel">Appearance</p><div class="appearance" role="group" aria-labelledby="apLabel"><button type="button" class="apBtn" data-set-theme="light" aria-pressed="false">Light</button><button type="button" class="apBtn" data-set-theme="dark" aria-pressed="false">Dark</button><button type="button" class="apBtn" data-set-theme="auto" aria-pressed="true">Auto</button></div></section>';
    html +=
      '<section><div class="toolList"><a class="toolItem" href="design-system-third-edition.html" target="_blank" rel="noopener">' +
      glyph("M3 3h10v10H3zM3 7h10M7 7v6") +
      "<span>Design system<em>The rules every Ward Flow screen follows</em></span><small>third edition</small></a>";
    html +=
      '<button type="button" class="toolItem" data-act="signout" aria-disabled="true" title="Sign out is not wired in this prototype">' +
      glyph("M6 3H3v10h3M10 5l3 3-3 3M13 8H6") +
      "<span>Sign out<em>Ends the shift on this device</em></span><small>not wired</small></button></div></section></div>";
    html +=
      '<p class="popFoot"><span>Every extension and address is invented.</span><span>Real numbers belong to the site directory, never to a prototype.</span></p>';
    $("toolsPanel").innerHTML = html;
    if (window.__reflectAppearance) window.__reflectAppearance();
  }

  /* ─── the service selector ─── */
  function renderService() {
    var counts = {};
    openMoves().forEach(function (m) {
      var s = svcOfMove(m);
      counts[s] = (counts[s] || 0) + 1;
    });
    var total = openMoves().length;
    var html =
      '<div class="menuList"><button type="button" class="menuItem" data-svc="" aria-pressed="' +
      (state.svc ? "false" : "true") +
      '"><span class="lead">All services</span><small>' +
      total +
      " waiting</small></button>";
    SVC_ORDER.forEach(function (s) {
      var n = counts[s] || 0;
      html +=
        '<button type="button" class="menuItem" data-svc="' +
        s +
        '" aria-pressed="' +
        (state.svc === s ? "true" : "false") +
        '"><span class="lead"><span class="dot" data-svc="' +
        s +
        '" aria-hidden="true"></span>' +
        SVC[s] +
        "</span><small>" +
        (n ? n + " waiting" : "none waiting") +
        "</small></button>";
    });
    html += "</div>";
    $("svcList").innerHTML = html;
    $("svcLabel").textContent = state.svc ? SVC_SHORT[state.svc] : "All services";
    $("svcCount").textContent = String(state.svc ? counts[state.svc] || 0 : total);
    var dot = $("svcDot");
    dot.hidden = !state.svc;
    if (state.svc) dot.setAttribute("data-svc", state.svc);
  }

  /* ─── every screen: name, group, purpose, primary action, who ─── */
  var ICON = {
    command: "M3 3h5v5H3zM10 3h5v5h-5zM3 10h5v5H3zM10 10h5v5h-5z",
    movement: "M2 9h11M9 5l4 4-4 4",
    capacity: "M2 6v7M2 9h11a3 3 0 0 1 3 3v1M6 9V7h4v2",
    wards: "M9 2l6 3v5c0 3-2.6 5.3-6 6-3.4-.7-6-3-6-6V5z",
    eds: "M9 3v12M3 9h12",
    teams:
      "M6 7a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM12.5 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM1.5 15c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4M11 11.5c2 .3 3.5 1.6 3.5 3.5",
    search: "M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12zM12.5 12.5L16 16",
    referrals: "M4 2h6l4 4v10H4zM10 2v4h4",
    handover: "M3 9h12M3 5h12M3 13h8",
    statistics: "M3 15V8M8 15V3M13 15v-5",
    governance: "M9 2l6 3v4c0 4-2.7 6.3-6 7-3.3-.7-6-3-6-7V5z",
    pin: "M9 2l3 3-2 1v4l2 2H6l2-2V6L6 5z",
    collapse: "M11 3L6 9l5 6",
    expand: "M7 3l5 6-5 6",
  };
  var GROUPS = [
    { key: "operations", label: "Operations" },
    { key: "network", label: "Network" },
    { key: "records", label: "Records" },
  ];
  var SCREENS = {
    command: {
      short: "Command",
      title: "Command",
      group: "operations",
      purpose: "Every open movement across the network, worst first, with what is wrong beside it.",
      count: function (f) {
        return f.total;
      },
    },
    movement: {
      short: "Movement",
      title: "Movement",
      group: "operations",
      purpose: "One person's movement from referral to bed, with every event, decline and decision on it.",
      core: function (f) {
        return [
          { label: "Open movements", val: num(f.total) },
          { label: "Breached", val: num(f.breached), tone: f.breached > 0 ? "danger" : null },
          { label: "Declines to answer", val: num(f.declines) },
          { label: "Accepted, no bed", val: num(f.nobed), tone: f.nobed > 0 ? "warn" : null },
        ];
      },
    },
    capacity: {
      short: "Capacity",
      title: "Capacity",
      group: "operations",
      purpose: "Beds by site and by ward, what is held, and where the pressure is.",
      count: function (f) {
        return f.free;
      },
    },
    wards: {
      short: "Wards",
      title: "Wards",
      group: "network",
      purpose: "Every ward in the network, what it takes, and how it has answered.",
      core: function (f) {
        return [
          { label: "Wards drawn", val: String(scopedUnits().length) },
          { label: "Beds free", val: num(f.free) },
          { label: "Sites with none", val: num(f.noFree.length), tone: f.noFree.length > 0 ? "warn" : null },
          { label: "Declines to answer", val: num(f.declines) },
        ];
      },
    },
    eds: {
      short: "EDs",
      title: "Emergency departments",
      group: "network",
      purpose: "Each department's waiting, longest and breached, and the liaison it works through.",
      core: function (f) {
        return [
          { label: "Departments", val: String(scopedEds().length) },
          { label: "Waiting", val: num(f.total) },
          { label: "Breached", val: num(f.breached), tone: f.breached > 0 ? "danger" : null },
          { label: "Longest wait", val: longestVal(f) },
        ];
      },
    },
    teams: {
      short: "Teams",
      title: "Community teams",
      group: "network",
      purpose: "The community teams by service, their catchments, and the referrals they send.",
      core: function (f) {
        return [
          { label: "Teams drawn", val: "<i>none yet</i>" },
          { label: "Referrals in the queue", val: num(f.refs) },
          { label: "Not yet triaged", val: num(f.refNotTriaged) },
          { label: "Older adult", val: num(f.refOlder) },
        ];
      },
    },
    search: {
      short: "Search",
      title: "Patient search",
      group: "records",
      purpose: "Find a person by name or identifier and open their movement, with the refusals stated.",
      core: function (f) {
        return [
          { label: "Open movements", val: num(f.total) },
          { label: "Searchable", val: num(f.total) + " <i>open only</i>" },
          { label: "Refusals", val: "3 <i>kinds</i>" },
          { label: "Searches recorded", val: "<i>every one</i>" },
        ];
      },
    },
    referrals: {
      short: "Referrals",
      title: "Referrals",
      group: "records",
      purpose: "Every referral in the queue, oldest first inside its tier, and the decision on each.",
      count: function (f) {
        return f.refs;
      },
    },
    handover: {
      short: "Handover",
      title: "Handover",
      group: "records",
      purpose: "The state of the network as a record for the incoming coordinator, and the sign off.",
      core: function (f) {
        var ex = exceptionsCount();
        return [
          { label: "Handover at", val: HANDOVER },
          { label: "Time left", val: fmtWait(HANDOVER_MIN - NOW_MIN) },
          { label: "To hand over", val: num(f.total) + " <i>movements</i>" },
          { label: "Exceptions", val: num(ex), tone: ex > 0 ? "warn" : null },
        ];
      },
      tag: function () {
        return HANDOVER;
      },
    },
    statistics: {
      short: "Statistics",
      title: "Statistics",
      group: "records",
      purpose: "Waits, breaches and flows over a period, with stated scales and nothing extrapolated.",
      core: function (f) {
        return [
          { label: "Waiting now", val: num(f.total) },
          { label: "Breached now", val: num(f.breached), tone: f.breached > 0 ? "danger" : null },
          { label: "Beds free", val: num(f.free) },
          { label: "Period", val: "<i>this shift</i>" },
        ];
      },
    },
    governance: {
      short: "Governance",
      title: "Governance",
      group: "records",
      purpose: "Every override recorded, oldest first, and the review of each.",
      count: function (f) {
        return f.overrides;
      },
      core: function (f) {
        return [
          { label: "Overrides to review", val: num(f.overrides) },
          { label: "Reviewed this month", val: "<i>none</i>" },
          { label: "Oldest", val: "<i>today</i>" },
          { label: "Reviewers", val: "2 <i>roles</i>" },
        ];
      },
    },
  };
  var SCREEN_ORDER = [
    "command",
    "movement",
    "capacity",
    "wards",
    "eds",
    "teams",
    "search",
    "referrals",
    "handover",
    "statistics",
    "governance",
  ];
  function exceptionsCount() {
    var n = 0;
    scoped().forEach(function (m) {
      if (WF.isBreached(m)) n++;
      if (m.stage === "accepted_awaiting_bed") n++;
      if (ownerOf(m) === null && !WF.isBreached(m)) n++;
    });
    return n;
  }
  /* A tag is a figure, or the word none. The word is drawn without a pill. */
  function screenTag(key, f) {
    var s = SCREENS[key];
    if (s.tag) return { text: s.tag(f), zero: false };
    if (s.count) {
      var n = s.count(f);
      return n === 0 ? { text: "none", zero: true } : { text: String(n), zero: false };
    }
    return null;
  }
  function tagHtml(tag) {
    if (!tag) return "";
    return '<span class="tag"' + (tag.zero ? ' data-zero="true"' : "") + ">" + tag.text + "</span>";
  }
  function glyph(key, cls) {
    return (
      '<svg class="' +
      (cls || "railGlyph") +
      '" viewBox="0 0 18 18" aria-hidden="true"><path d="' +
      ICON[key] +
      '" /></svg>'
    );
  }

  /* ─── the rail, open and closed, rendered from the same screens and the same figures ─── */
  function stateLine(key, f) {
    switch (key) {
      case "command":
        if (!f.total) return null;
        return (
          (f.breached ? '<b data-tone="danger">' + f.breached + " breached</b>" : "no breach") +
          ", " +
          (f.soon ? f.soon + " due soon" : "none due soon")
        );
      case "capacity":
        if (!f.sites) return null;
        return (
          f.free +
          " free" +
          (f.noFree.length
            ? ", none at " +
              f.noFree
                .map(function (b) {
                  return b.code;
                })
                .join(", ")
            : " of " + f.beds)
        );
      case "eds":
        return f.longest ? "longest " + fmtWait(f.longest.waited) + " at " + edOf(f.longest).site : null;
      case "referrals":
        if (!f.refOldest) return null;
        var o = NOW_MIN - f.refOldest.raisedAt;
        return o > 120 ? '<b data-tone="warn">oldest ' + fmtWait(o) + "</b>" : "oldest " + fmtWait(o);
      case "handover":
        return "in " + fmtWait(HANDOVER_MIN - NOW_MIN);
    }
    return null;
  }
  function tagTone(key, f) {
    if (key === "command" && f.breached > 0) return "danger";
    if (key === "referrals" && f.refOldest && NOW_MIN - f.refOldest.raisedAt > 120) return "warn";
    return null;
  }
  function toneWords(tone) {
    return tone === "danger" ? "a legal deadline has passed" : tone === "warn" ? "look here" : "";
  }
  function railLink(key, f, closed) {
    var s = SCREENS[key];
    var tag = screenTag(key, f);
    var tone = tagTone(key, f);
    var cur = key === "command";
    var line = stateLine(key, f);
    var dotHtml = tone ? '<span class="toneDot" data-tone="' + tone + '" aria-hidden="true"></span>' : "";
    var h;
    if (closed) {
      h =
        '<button class="railLink" type="button" data-page="' +
        key +
        '"' +
        (cur ? ' aria-current="page"' : "") +
        ' aria-label="' +
        esc(s.title) +
        (tag ? ", " + tag.text : "") +
        (tone ? ", " + toneWords(tone) : "") +
        '"><span class="railLabel">' +
        glyph(key) +
        '<span class="word">' +
        s.short +
        "</span></span>" +
        tagHtml(tag) +
        dotHtml;
      h +=
        '<span class="flyCard" aria-hidden="true"><b>' +
        esc(s.title) +
        tagHtml(tag) +
        "</b><em>" +
        esc(s.purpose) +
        "</em>" +
        (line ? '<span class="stateLine">' + line + "</span>" : "") +
        "</span></button>";
      return h;
    }
    h =
      '<button class="railLink" type="button" data-page="' +
      key +
      '"' +
      (cur ? ' aria-current="page"' : "") +
      ' data-state="' +
      (line ? "true" : "false") +
      '" title="' +
      esc(s.purpose) +
      '"><span class="railLabel">' +
      glyph(key) +
      '<span class="railText"><span>' +
      s.title +
      "</span>" +
      (line ? "<em>" + line + "</em>" : "") +
      "</span></span>" +
      tagHtml(tag) +
      dotHtml +
      (tone ? '<span class="srOnly">, ' + toneWords(tone) + "</span>" : "") +
      "</button>";
    return h;
  }
  function railGroups(f, closed) {
    var h = "";
    GROUPS.forEach(function (g) {
      h +=
        '<div class="railGroup" role="group" aria-label="' + g.label + '"><p class="railEyebrow">' + g.label + "</p>";
      SCREEN_ORDER.forEach(function (k) {
        if (SCREENS[k].group === g.key) h += railLink(k, f, closed);
      });
      h += "</div>";
    });
    return h;
  }
  function ringHtml(size, label) {
    var pct = (NOW_MIN - SHIFT_START_MIN) / (HANDOVER_MIN - SHIFT_START_MIN);
    var C = 2 * Math.PI * 19;
    return (
      '<div class="ring' +
      (size === "small" ? " small" : "") +
      '" role="img" aria-label="Day shift, ' +
      Math.round(pct * 100) +
      " percent through, handover at " +
      HANDOVER +
      '"><svg viewBox="0 0 44 44"><circle class="track" cx="22" cy="22" r="19" /><circle class="arc" cx="22" cy="22" r="19" stroke-dasharray="' +
      (C * pct).toFixed(1) +
      " " +
      C.toFixed(1) +
      '" /></svg><b>' +
      label +
      "</b></div>"
    );
  }
  function pinnedMoves() {
    return PINNED.map(moveById).filter(function (m) {
      return m && WF.isOpen(m) && inSvc(m);
    });
  }
  function isSubject(id) {
    return WF.state.movementId === id && !WF.state.referralId;
  }
  function pinnedRows() {
    var h = "";
    pinnedMoves().forEach(function (m) {
      var tone = WF.isBreached(m) ? "danger" : dueSoon(m) ? "warn" : null;
      h +=
        '<button type="button" class="pinRow" data-pin="' +
        m.id +
        '" aria-pressed="' +
        (isSubject(m.id) ? "true" : "false") +
        '"' +
        (tone ? ' data-tone="' + tone + '"' : "") +
        ' title="' +
        esc(fmtDl(m)) +
        '"><span class="id">' +
        m.id +
        "</span><b>" +
        esc(hasName(m) ? nameOf(m) : edOf(m).site + ", Tier " + m.urgency) +
        '</b><span class="wait">' +
        fmtWait(m.waited) +
        "</span></button>";
    });
    return h || '<p class="menuNote" style="padding:2px 10px 4px">No pinned movement in ' + esc(svcName()) + ".</p>";
  }
  function checkText(f) {
    var p = allProblems();
    return p.length
      ? p.length + " " + plural(p.length, "figure does", "figures do") + " not reconcile"
      : "Figures reconcile at " +
          NOW +
          ": " +
          f.total +
          " " +
          plural(f.total, "movement", "movements") +
          ", " +
          f.refs +
          " " +
          plural(f.refs, "referral", "referrals") +
          (state.svc ? ", " + SVC_SHORT[state.svc] : "");
  }
  var narrow = window.matchMedia ? window.matchMedia("(max-width: 1000px)") : { matches: false };
  function railClosed() {
    return state.railClosed && !narrow.matches;
  }
  function renderRail(nav, closed, f) {
    var pct = Math.round(((NOW_MIN - SHIFT_START_MIN) / (HANDOVER_MIN - SHIFT_START_MIN)) * 100);
    var ok = allProblems().length === 0;
    var h =
      '<div class="brand"><b>' +
      (closed ? "WF" : "Ward Flow") +
      '</b><span>WA</span></div><i class="svcStripe"' +
      (state.svc ? ' data-svc="' + state.svc + '"' : "") +
      ' aria-hidden="true"></i>';
    if (!closed) {
      h += '<div class="railScroll">';
      h +=
        '<div class="railBlock" aria-label="Shift"><div class="shiftRow">' +
        ringHtml("small", pct + "%") +
        '<div><p class="eyebrow"><span>Day shift</span><span class="count">' +
        NOW +
        '</span></p><p class="big">' +
        fmtWait(HANDOVER_MIN - NOW_MIN) +
        "<small>to handover at " +
        HANDOVER +
        ", " +
        DATE +
        '</small></p></div></div><div class="meter" aria-hidden="true"><i style="width:' +
        pct +
        '%"></i></div></div>';
      h += railGroups(f, false);
      h +=
        '<div class="railGroup pinGroup" role="group" aria-label="Pinned movements"><p class="railEyebrow">Pinned</p>' +
        pinnedRows() +
        "</div>";
      h += "</div>";
      h +=
        '<div class="railFoot"><p class="railUser"><span>Signed in as</span><b>Bed coordinator</b></p><p class="railCheck" id="railCheck" data-ok="' +
        (ok ? "true" : "false") +
        '"><span>' +
        esc(checkText(f)) +
        '</span></p><p class="railNote">Every ward state, movement, referral, clock and figure on this screen is invented. The hospital sites and health services are real WA names.</p></div>';
      h +=
        '<button type="button" class="railBtn" data-rail-toggle="closed" title="Close the rail to a strip. The bracket key does the same.">' +
        glyph("collapse") +
        '<span>Close the rail</span><kbd aria-hidden="true">[</kbd></button>';
    } else {
      h += railGroups(f, true);
      h += '<div class="railFoot">';
      h +=
        '<details class="menu flyMenu" id="pinMenu"><summary title="Pinned movements"><span class="srOnly">Pinned movements</span>' +
        glyph("pin") +
        tagHtml(
          pinnedMoves().length ? { text: String(pinnedMoves().length), zero: false } : { text: "none", zero: true },
        ) +
        '</summary><div class="menuPanel"><p class="menuHead">Pinned<span class="count">watching</span></p><div class="menuList">' +
        pinnedRows() +
        '</div><p class="menuNote">Pin a movement from its row to keep it here through the shift. Not wired in this prototype.</p></div></details>';
      h +=
        '<div class="ringRow" title="Bed coordinator. Day shift, handover ' +
        HANDOVER +
        ", in " +
        fmtWait(HANDOVER_MIN - NOW_MIN) +
        '">' +
        ringHtml("", "BC") +
        "</div>";
      h +=
        '<p class="railCheck" id="railCheck" data-ok="' +
        (ok ? "true" : "false") +
        '" title="' +
        esc(checkText(f)) +
        '"><span>' +
        esc(checkText(f)) +
        "</span></p>";
      h += "</div>";
      h +=
        '<button type="button" class="railBtn" data-rail-toggle="open" title="Open the rail. The bracket key does the same.">' +
        glyph("expand") +
        "<span>Open the rail</span></button>";
    }
    nav.className = "rail " + (closed ? "closed" : "open");
    nav.innerHTML = h;
  }
  function updateRailFade() {
    var el = $("rail").querySelector(".railScroll");
    if (!el) return;
    var more = el.scrollHeight - el.clientHeight;
    el.setAttribute("data-fade-top", more > 1 && el.scrollTop > 1 ? "true" : "false");
    el.setAttribute("data-fade-bottom", more > 1 && el.scrollTop < more - 1 ? "true" : "false");
  }
  function renderRails(f) {
    renderRail($("rail"), railClosed(), f);
    var sc = $("rail").querySelector(".railScroll");
    if (sc) sc.addEventListener("scroll", updateRailFade);
    updateRailFade();
    menus = all("details.menu");
    bindMenus();
  }
  window.addEventListener("resize", updateRailFade);

  /* ─── render: the engine first, then the shell; or the shell alone when the engine calls back ─── */
  var rendered = false;
  function render() {
    rendered = true;
    var f = figures();
    reconcile(f);
    renderRails(f);
    renderService();
    renderActivity(f);
    renderTasks(f);
    renderTools();
    renderSearch();
    $("pageTitle").textContent = "Command";
  }
  function renderAll() {
    rendered = false;
    WF.renderAll();
    if (!rendered) render();
  }

  /* ─── state changes ─── */
  function setTask(key) {
    state.task = key;
    renderAll();
  }
  function setSvc(s) {
    state.svc = s;
    renderAll();
  }
  function setQ(q) {
    state.q = q;
    if ($("q").value !== q) $("q").value = q;
    $("qClear").hidden = !q;
    $("qHint").hidden = !!q;
    renderAll();
  }
  function setRail(closed) {
    state.railClosed = closed;
    document.documentElement.setAttribute("data-rail", closed ? "closed" : "open");
    try {
      localStorage.setItem("ward-flow-rail", closed ? "closed" : "open");
    } catch (err) {}
    closeMenus(null);
    renderRails(figures());
    var btn = $("rail").querySelector(".railBtn");
    if (btn) btn.focus();
    announce(closed ? "The rail, closed." : "The rail, open.");
  }
  function queueRow(id) {
    var pane = $("qpane-patients");
    return pane ? pane.querySelector('.qRow[data-mv="' + id + '"]') : null;
  }
  function showInQueue(id) {
    if (WF.state.edFilter && moveById(id) && moveById(id).ed !== WF.state.edFilter) WF.state.edFilter = null;
    if (WF.selectQueueTab) WF.selectQueueTab("patients", false);
    else WF.state.queueTab = "patients";
    WF.selectMovement(id);
    var row = queueRow(id);
    if (row) {
      row.scrollIntoView({ block: "center" });
      row.focus();
    }
  }
  function selectPatient(id) {
    var m = moveById(id);
    if (!m) return;
    var note = "";
    if (state.svc && svcOfMove(m) !== state.svc) {
      state.svc = null;
      note = " Service set back to all, because this person is outside it.";
    }
    state.qOpen = false;
    setQ("");
    showInQueue(id);
    announce(nameOf(m) + (hasName(m) ? ", " + id : "") + ", selected in the queue. " + fmtDl(m) + "." + note);
  }

  /* ─── menus and drawers: one open at a time, close outside, Escape returns focus ─── */
  var menus = [];
  function closeMenus(except) {
    menus.forEach(function (o) {
      if (o !== except && o.open) o.open = false;
    });
  }
  function openMenu(id) {
    var d = $(id);
    if (!d) return;
    d.open = true;
    var focusable = d.querySelector(".menuPanel button, .menuPanel input, .menuPanel a");
    if (focusable) focusable.focus();
  }
  function bindMenus() {
    menus.forEach(function (d) {
      if (d.__bound) return;
      d.__bound = true;
      d.addEventListener("toggle", onToggle);
    });
  }
  function onToggle() {
    var d = this;
    if (!d.open) return;
    closeMenus(d);
    state.qOpen = false;
    renderSearch();
    if (d.id === "activityMenu")
      announce(
        "Activity opened, in two parts: what is going on, and the live tally for the " +
          pageOf(state.tallyPage).title +
          " page.",
      );
    if (d.id === "tasksMenu") announce("Tasks opened. " + $("tasksCount").textContent + " outstanding, notices first.");
    if (d.id === "toolsMenu")
      announce("Tools opened. Every extension and address in the contact tables is a placeholder.");
    if (d.id === "pinMenu") announce("Pinned movements opened.");
  }
  document.addEventListener("click", function (e) {
    menus.forEach(function (d) {
      if (!d.open) return;
      if (e.target === d || !d.contains(e.target)) d.open = false;
    });
    if (!e.target.closest(".searchWrap") && state.qOpen) {
      state.qOpen = false;
      renderSearch();
    }
  });

  /* ─── the one Escape order ─── */
  function escape() {
    var open = null;
    menus.forEach(function (d) {
      if (d.open) open = d;
    });
    if (open) {
      open.open = false;
      open.querySelector("summary").focus();
      announce("Closed.");
      return true;
    }
    if (state.qOpen) {
      state.qOpen = false;
      renderSearch();
      announce("Search results closed. The queue still matches the search.");
      return true;
    }
    if (state.q) {
      setQ("");
      announce("Search cleared. " + shownText());
      return true;
    }
    if (WF.state.unitId) {
      WF.state.unitId = null;
      renderAll();
      announce("Ward selection cleared.");
      return true;
    }
    if (WF.state.referralId) {
      WF.state.referralId = null;
      renderAll();
      announce("Shortlist back to " + WF.state.movementId + ".");
      return true;
    }
    if (WF.state.edFilter) {
      WF.state.edFilter = null;
      renderAll();
      announce("Queue filter cleared.");
      return true;
    }
    if (state.task) {
      setTask(null);
      announce("Task filter cleared. " + shownText());
      return true;
    }
    if (state.svc) {
      setSvc(null);
      announce("Service set to all. " + shownText());
      return true;
    }
    return false;
  }

  /* ─── events ─── */
  $("q").addEventListener("input", function () {
    state.qOpen = true;
    closeMenus(null);
    setQ(this.value);
    var ref = refusal(state.q);
    if (ref) announce(ref);
  });
  $("q").addEventListener("focus", function () {
    if (state.q) {
      state.qOpen = true;
      renderSearch();
    }
  });
  $("q").addEventListener("keydown", function (e) {
    /* A search field clears itself on Escape, which would fold two steps of the order into one and
       announce the wrong one. The shell takes the key and walks the order itself. */
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      escape();
      return;
    }
    if (e.key === "Enter") {
      var first = $("qPop").querySelector('.qHit[data-active="true"], .qHit');
      if (first) {
        first.click();
        e.preventDefault();
        return;
      }
      announce(refusal(state.q) || shownText());
    }
    if (e.key === "ArrowDown") {
      var hit = $("qPop").querySelector(".qHit");
      if (hit) {
        hit.focus();
        e.preventDefault();
      }
    }
  });
  $("qClear").addEventListener("click", function () {
    state.qOpen = false;
    setQ("");
    announce("Search cleared. " + shownText());
    $("q").focus();
  });
  document.addEventListener("keydown", function (e) {
    var tag = (document.activeElement && document.activeElement.tagName) || "";
    var typing = /input|textarea|select/i.test(tag);
    if (e.key === "/" && !typing) {
      e.preventDefault();
      $("q").focus();
      $("q").select();
      return;
    }
    if (e.key === "[" && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
      if (narrow.matches) return;
      setRail(!state.railClosed);
      return;
    }
    if (e.key === "Escape") escape();
  });
  document.addEventListener("click", function (e) {
    var b;
    if ((b = e.target.closest(".qHit"))) {
      var kind = b.getAttribute("data-hit");
      if (kind === "patient") selectPatient(b.getAttribute("data-id"));
      else if (kind === "text") {
        state.qOpen = false;
        setQ(b.getAttribute("data-text"));
        announce(shownText() + " Matching " + b.getAttribute("data-text") + ".");
      } else if (kind === "action") {
        var key = b.getAttribute("data-key");
        state.qOpen = false;
        setQ("");
        if (key === "print") window.print();
        else if (key === "tally") {
          state.actPart = "tally";
          renderAll();
          openMenu("activityMenu");
        } else openMenu({ tools: "toolsMenu", new: "newMenu", tasks: "tasksMenu", activity: "activityMenu" }[key]);
      }
      return;
    }
    if ((b = e.target.closest("[data-svc]")) && b.classList.contains("menuItem")) {
      var s = b.getAttribute("data-svc") || null;
      setSvc(s);
      $("svcMenu").open = false;
      $("svcMenu").querySelector("summary").focus();
      announce((s ? "Service set to " + SVC[s] + ". " : "Service set to all. ") + shownText());
      return;
    }
    if ((b = e.target.closest("[data-part]")) && b.closest(".seg")) {
      state.actPart = b.getAttribute("data-part");
      all("#activityPanel .part").forEach(function (p) {
        p.hidden = p.getAttribute("data-part") !== state.actPart;
      });
      all("#activityPanel .seg button").forEach(function (x) {
        x.setAttribute("aria-pressed", x.getAttribute("data-part") === state.actPart ? "true" : "false");
      });
      announce(
        state.actPart === "tally"
          ? "Live tally for the " + pageOf(state.tallyPage).title + " page."
          : "Activity: what is going on, then the last events.",
      );
      return;
    }
    if ((b = e.target.closest("[data-new]"))) {
      $("newMenu").open = false;
      announce(
        "Raise a referral would open, prefilled from " + b.getAttribute("data-new") + ". Not wired in this prototype.",
      );
      return;
    }
    if ((b = e.target.closest("[data-act]"))) {
      var act = b.getAttribute("data-act");
      if (act === "print") {
        closeMenus(null);
        window.print();
      } else if (act === "export") announce("Export the queue is not wired in this prototype.");
      else if (act === "new") {
        closeMenus(null);
        openMenu("newMenu");
      } else if (act === "signout") {
        e.preventDefault();
        announce(b.getAttribute("title"));
      }
      return;
    }
    if ((b = e.target.closest("[data-close]"))) {
      var dc = b.closest("details");
      dc.open = false;
      dc.querySelector("summary").focus();
      announce("Closed.");
      return;
    }
    if ((b = e.target.closest("[data-notice]"))) {
      state.seen[b.getAttribute("data-notice")] = true;
      render();
      announce("Notice marked seen.");
      return;
    }
    if ((b = e.target.closest('[data-go="queue"]'))) {
      closeMenus(null);
      var pane = $("qpane-patients");
      if (pane) {
        pane.scrollIntoView({ block: "start" });
        pane.focus();
      }
      announce(shownText());
      return;
    }
    if ((b = e.target.closest(".taskRow"))) {
      var tk = b.getAttribute("data-task");
      if (b.getAttribute("data-kind") === "filter") {
        var on = state.task === tk;
        closeMenus(null);
        setTask(on ? null : tk);
        if (on) announce("Task filter cleared. " + shownText());
        else {
          var tt = taskByKey(tk);
          var n = countTask(tt);
          announce("Showing " + n + " " + plural(n, tt.one, tt.many) + " in the queue.");
          var qp = $("qpane-patients");
          if (qp) qp.scrollTop = 0;
        }
        return;
      }
      if (tk === "referrals") {
        closeMenus(null);
        if (WF.selectQueueTab) WF.selectQueueTab("referrals", true);
        announce("Referral queue shown.");
      } else if (tk === "overrides")
        announce(
          WF.OVERRIDES.length +
            " overrides are reviewed on the Governance screen. Not built in this prototype. They are also in the Overrides register below the map.",
        );
      else if (tk === "handover") announce("The handover sheet is printed from Tools, due at " + HANDOVER + ".");
      return;
    }
    if ((b = e.target.closest(".railLink[data-page]"))) {
      var pg = b.getAttribute("data-page");
      if (pg === "command") {
        announce("Command. This is the screen you are on.");
        return;
      }
      state.tallyPage = pg;
      render();
      announce(SCREENS[pg].title + " is not part of this prototype. The live tally now carries its figures.");
      return;
    }
    if ((b = e.target.closest("[data-clear]"))) {
      if (b.getAttribute("data-clear") === "q") setQ("");
      else {
        state.svc = null;
        state.task = null;
        setQ("");
      }
      announce("Showing every open movement.");
      return;
    }
    if ((b = e.target.closest("[data-rail-toggle]"))) {
      setRail(b.getAttribute("data-rail-toggle") === "closed");
      return;
    }
    if ((b = e.target.closest("[data-pin]"))) {
      var pid = b.getAttribute("data-pin");
      closeMenus(null);
      showInQueue(pid);
      announce(pid + " selected in the queue.");
      return;
    }
  });
  if (narrow.addEventListener)
    narrow.addEventListener("change", function () {
      renderRails(figures());
    });

  /* ─── the hooks the engine reads ─── */
  window.WardFlowShell = {
    visible: visible,
    edVisible: edVisible,
    filterBar: filterBar,
    diagramNote: diagramNote,
    render: render,
    escape: escape,
  };

  /* First render: the engine again with the predicates installed, then the shell. */
  renderAll();
  var liveEl = $("live");
  if (liveEl) liveEl.textContent = "";
})();

/* ─── appearance: three states, remembered for this browser only. Document level, so the group
   inside the Tools drawer works after every re-render, and the root's data-theme is observed so
   every copy of the group reflects the choice. The key is the third edition's. ─── */
(function () {
  var root = document.documentElement;
  var KEY = "ward-flow-command-appearance";
  function remember(v) {
    try {
      if (v === "auto") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, v);
    } catch (e) {}
  }
  function restore() {
    try {
      var v = localStorage.getItem(KEY);
      if (v === "light" || v === "dark") root.setAttribute("data-theme", v);
    } catch (e) {}
  }
  function reflect() {
    var cur = root.getAttribute("data-theme") || "auto";
    var btns = document.querySelectorAll("[data-set-theme]");
    for (var i = 0; i < btns.length; i++) {
      btns[i].setAttribute("aria-pressed", btns[i].getAttribute("data-set-theme") === cur ? "true" : "false");
    }
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest("[data-set-theme]") : null;
    if (!b) return;
    var v = b.getAttribute("data-set-theme");
    if (v === "auto") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", v);
    remember(v);
    reflect();
    var live = document.getElementById("live");
    if (live) live.textContent = "Appearance set to " + (v === "auto" ? "automatic" : v) + ".";
  });
  if (window.MutationObserver)
    new MutationObserver(reflect).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  window.__reflectAppearance = reflect;
  restore();
  reflect();
})();
