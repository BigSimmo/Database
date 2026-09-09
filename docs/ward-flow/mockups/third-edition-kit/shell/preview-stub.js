/* The preview's stand in for the Command engine. It exposes the facade shell-script.js expects at
   window.WardFlow, with a small dataset in the engine's own shapes, and a renderAll that draws a
   plain patient queue honouring the shell's predicate, writes the shell's filter bar, and calls
   the shell back. It defines no window.__commandCheck, because the preview is not a Command page.
   Every figure and name here is invented. */
(function () {
  "use strict";
  var NOW = 642;
  var EDS = [
    { id: "rph-ed", site: "RPH", name: "Royal Perth Hospital Emergency Department", service: "East Metro" },
    { id: "scgh-ed", site: "SCGH", name: "Sir Charles Gairdner Hospital Emergency Department", service: "North Metro" },
    { id: "fsh-ed", site: "FSH", name: "Fiona Stanley Hospital Emergency Department", service: "South Metro" },
    { id: "arm-ed", site: "ARM", name: "Armadale Health Service Emergency Department", service: "East Metro" },
    {
      id: "sjgm-ed",
      site: "SJGM",
      name: "St John of God Midland Public Hospital Emergency Department",
      service: "East Metro",
    },
    { id: "rgh-ed", site: "RGH", name: "Rockingham General Hospital Emergency Department", service: "South Metro" },
    { id: "jhc-ed", site: "JHC", name: "Joondalup Health Campus Emergency Department", service: "North Metro" },
    { id: "peel-ed", site: "PEEL", name: "Peel Health Campus Emergency Department", service: "South Metro" },
  ];
  var UNITS = [
    {
      id: "rph-adult-secure",
      name: "RPH Adult Secure",
      site: "RPH",
      service: "East Metro",
      beds: 20,
      ready: 1,
      held: 1,
      blocked: 0,
      occupied: 18,
    },
    {
      id: "rph-older-adult",
      name: "RPH Older Adult",
      site: "RPH",
      service: "East Metro",
      beds: 16,
      ready: 2,
      held: 0,
      blocked: 1,
      occupied: 13,
    },
    {
      id: "fsh-adult-secure",
      name: "FSH Adult Secure",
      site: "FSH",
      service: "South Metro",
      beds: 24,
      ready: 0,
      held: 1,
      blocked: 0,
      occupied: 23,
    },
    {
      id: "scgh-adult-open",
      name: "SCGH Adult Open",
      site: "SCGH",
      service: "North Metro",
      beds: 22,
      ready: 3,
      held: 0,
      blocked: 0,
      occupied: 19,
    },
    {
      id: "bty-adult-secure",
      name: "BTY Adult Secure",
      site: "BTY",
      service: "East Metro",
      beds: 18,
      ready: 0,
      held: 0,
      blocked: 0,
      occupied: 18,
    },
    {
      id: "gry-adult-open",
      name: "GRY Adult Open",
      site: "GRY",
      service: "North Metro",
      beds: 20,
      ready: 2,
      held: 1,
      blocked: 0,
      occupied: 17,
    },
  ];
  function M(o) {
    o.referred = o.referred || [];
    o.declines = o.declines || [];
    o.accepted = o.accepted || null;
    o.stage = o.stage || "destination_review";
    return o;
  }
  var MOVEMENTS = [
    M({
      id: "WF-021",
      urgency: 1,
      ed: "rph-ed",
      waited: 268,
      legalDue: 572,
      legalStatus: "Involuntary inpatient",
      cohort: "Adult",
      security: "Secure",
      given: "Oona",
      family: "Larkspur",
      declines: [
        { unit: "scgh-adult-open", reason: "No bed", at: 598 },
        { unit: "fsh-adult-secure", reason: "Catchment", at: 611 },
      ],
      referred: ["rph-adult-secure"],
    }),
    M({
      id: "WF-014",
      urgency: 2,
      ed: "rph-ed",
      waited: 191,
      legalDue: 730,
      legalStatus: "Referred for psychiatric examination",
      cohort: "Adult",
      security: "Open",
      given: "Bram",
      family: "Tallow",
      stage: "accepted_awaiting_bed",
      accepted: "fsh-adult-secure",
    }),
    M({
      id: "WF-009",
      urgency: 1,
      ed: "fsh-ed",
      waited: 640,
      legalDue: 737,
      legalStatus: "Involuntary inpatient",
      cohort: "Adult",
      security: "Secure",
      referred: ["fsh-adult-secure", "bty-adult-secure"],
    }),
    M({
      id: "WF-004",
      urgency: 2,
      ed: "arm-ed",
      waited: 150,
      legalDue: null,
      legalStatus: "Voluntary",
      cohort: "Adult",
      security: "Open",
    }),
    M({
      id: "WF-006",
      urgency: 3,
      ed: "scgh-ed",
      waited: 95,
      legalDue: null,
      legalStatus: "Voluntary",
      cohort: "Older adult",
      security: "Open",
      accepted: "scgh-adult-open",
      stage: "pulled",
    }),
    M({
      id: "WF-011",
      urgency: 2,
      ed: "jhc-ed",
      waited: 520,
      legalDue: 752,
      legalStatus: "Referred for psychiatric examination",
      cohort: "Adult",
      security: "Secure",
      declines: [{ unit: "gry-adult-open", reason: "Acuity mix", at: 620 }],
    }),
    M({
      id: "WF-017",
      urgency: 3,
      ed: "rgh-ed",
      waited: 60,
      legalDue: null,
      legalStatus: "Voluntary",
      cohort: "Adult",
      security: "Open",
    }),
    M({
      id: "WF-002",
      urgency: 2,
      ed: "fsh-ed",
      waited: 400,
      legalDue: null,
      legalStatus: "Voluntary",
      cohort: "Adult",
      security: "Open",
      stage: "arrived",
      accepted: "fsh-adult-secure",
    }),
  ];
  var REFERRALS = [
    {
      id: "RF-001",
      urgency: 1,
      ageBand: "Adult",
      sex: "Male",
      homeService: "East Metro",
      raisedAt: 560,
      triagedAt: undefined,
    },
    {
      id: "RF-002",
      urgency: 2,
      ageBand: "Older adult",
      sex: "Female",
      homeService: "North Metro",
      raisedAt: 520,
      triagedAt: 600,
    },
    {
      id: "RF-003",
      urgency: 2,
      ageBand: "Adult",
      sex: "Male",
      homeService: "South Metro",
      raisedAt: 610,
      triagedAt: undefined,
    },
    {
      id: "RF-005",
      urgency: 3,
      ageBand: "Adult",
      sex: "Male",
      homeService: "WACHS",
      raisedAt: 600,
      triagedAt: undefined,
    },
  ];
  var OVERRIDES = [
    {
      at: 630,
      movement: "WF-021",
      unit: "fsh-adult-secure",
      gate: "Catchment",
      reason: "Clinical urgency outweighs the mismatch",
      by: "Bed coordinator",
    },
    {
      at: 610,
      movement: "WF-011",
      unit: "gry-adult-open",
      gate: "Acuity mix",
      reason: "Continuity with a previous admission",
      by: "Bed coordinator",
    },
  ];
  var state = { movementId: "WF-014", unitId: null, edFilter: null, referralId: null, queueTab: "patients" };
  function byId(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return undefined;
  }
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function isOpen(m) {
    return m.stage !== "arrived";
  }
  function isBreached(m) {
    return m.legalDue !== null && m.legalDue !== undefined && m.legalDue < NOW;
  }
  function dur(min) {
    var h = Math.floor(min / 60),
      m = min % 60;
    return h > 0 ? h + " h " + m + " m" : m + " m";
  }
  function announce(text) {
    var el = document.getElementById("live");
    if (!el) return;
    el.textContent = el.textContent === text ? text + "​" : text;
  }
  function referralQueueOrder() {
    return REFERRALS.slice().sort(function (a, b) {
      return a.urgency - b.urgency || a.raisedAt - b.raisedAt;
    });
  }
  function routeLine(m) {
    var from = "<b>" + esc(byId(EDS, m.ed).site) + "</b>";
    if (m.accepted)
      return from + " to <b>" + esc(byId(UNITS, m.accepted).name) + '</b> <span class="how">&middot; accepted</span>';
    if (m.referred.length)
      return (
        from + " to <b>" + esc(byId(UNITS, m.referred[0]).name) + '</b> <span class="how">&middot; referred</span>'
      );
    return from + ' <span class="noneYet">&middot; no destination yet</span>';
  }
  function queueRows() {
    var rows = MOVEMENTS.filter(isOpen);
    if (state.edFilter)
      rows = rows.filter(function (m) {
        return m.ed === state.edFilter;
      });
    if (window.WardFlowShell) rows = rows.filter(window.WardFlowShell.visible);
    rows.sort(function (a, b) {
      return a.urgency - b.urgency || b.waited - a.waited;
    });
    return rows;
  }
  function renderAll() {
    var rows = queueRows();
    document.getElementById("qCount").textContent = rows.length + " open";
    document.getElementById("qFilter").innerHTML = window.WardFlowShell ? window.WardFlowShell.filterBar() : "";
    document.getElementById("qpane-patients").innerHTML = rows.length
      ? rows
          .map(function (m) {
            return (
              '<div><button type="button" class="qRow" data-mv="' +
              m.id +
              '" aria-pressed="' +
              (m.id === state.movementId) +
              '"><span class="qTop"><span class="qId">' +
              m.id +
              '</span><span class="tier" data-t="' +
              m.urgency +
              '">T' +
              m.urgency +
              '</span><span class="qWait">' +
              dur(m.waited) +
              '</span></span><span class="qRoute">' +
              routeLine(m) +
              '</span><span class="qMeta">' +
              esc(m.cohort) +
              " &middot; " +
              esc(m.security) +
              " &middot; " +
              esc(m.legalStatus) +
              "</span>" +
              (isBreached(m)
                ? '<span class="qBreach">Legal deadline passed ' + dur(NOW - m.legalDue) + " ago</span>"
                : "") +
              "</button></div>"
            );
          })
          .join("")
      : '<p class="none">No open movement matches this filter. Absence here means the filter excludes every movement, not that the queue is empty.</p>';
    var note = document.getElementById("previewDiagNote");
    if (note) note.textContent = window.WardFlowShell ? window.WardFlowShell.diagramNote() : "";
    if (window.WardFlowShell) window.WardFlowShell.render();
  }
  function selectMovement(id) {
    if (!byId(MOVEMENTS, id)) return;
    state.movementId = id;
    state.referralId = null;
    renderAll();
    announce("Shortlist now explains " + id + ".");
  }
  function selectQueueTab(name) {
    state.queueTab = name;
  }
  document.addEventListener("click", function (e) {
    var mv = e.target.closest ? e.target.closest("[data-mv]") : null;
    if (mv) selectMovement(mv.getAttribute("data-mv"));
  });
  window.WardFlow = {
    NOW: NOW,
    MOVEMENTS: MOVEMENTS,
    UNITS: UNITS,
    EDS: EDS,
    REFERRALS: REFERRALS,
    OVERRIDES: OVERRIDES,
    state: state,
    isOpen: isOpen,
    isBreached: isBreached,
    ed: function (id) {
      return byId(EDS, id);
    },
    unit: function (id) {
      return byId(UNITS, id);
    },
    byId: byId,
    dur: dur,
    referralQueueOrder: referralQueueOrder,
    announce: announce,
    renderAll: renderAll,
    selectMovement: selectMovement,
    selectQueueTab: selectQueueTab,
  };
  renderAll();
})();
