/* Contractor Estimate & Markup vs Margin Calculator
   Runs 100% in the browser. No tracking, no network calls. Inputs are saved
   only in this browser's localStorage. */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
  var usd0 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  var num = function (v) { var n = parseFloat(String(v).replace(/[$,%\s]/g, "")); return isFinite(n) ? n : 0; };
  var pct = function (n, d) { return isFinite(n) ? n.toFixed(d == null ? 1 : d) + "%" : "—"; };
  var money = function (n) { return isFinite(n) ? usd.format(n) : "—"; };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  var setText = function (id, t) { var el = document.getElementById(id); if (el) el.textContent = t; };
  var yr = $("#yr"); if (yr) yr.textContent = new Date().getFullYear();

  /* ---------- 1. Billable hourly rate ---------- */
  var RATE_KEY = "ce_rate_v1";
  var rateFields = ["r-wage", "r-burden", "r-overhead", "r-weeks", "r-hours", "r-util", "r-profit"];
  var lastRate = null;
  function calcRate() {
    var v = {}; rateFields.forEach(function (id) { v[id] = num(document.getElementById(id).value); });
    var hours = v["r-weeks"] * v["r-hours"] * (v["r-util"] / 100);
    var laborCost = v["r-wage"] * (1 + v["r-burden"] / 100);
    var costHr = hours > 0 ? laborCost / hours : NaN;
    var ohHr = hours > 0 ? v["r-overhead"] / hours : NaN;
    var be = costHr + ohHr;
    var p = v["r-profit"] / 100;
    var rate = p < 1 ? be / (1 - p) : NaN;
    setText("r-out-hours", isFinite(hours) ? Math.round(hours).toLocaleString() + " hrs" : "—");
    setText("r-out-cost", money(costHr));
    setText("r-out-oh", money(ohHr));
    setText("r-out-be", money(be));
    setText("r-out-rate", money(rate));
    setText("r-out-rev", isFinite(rate) ? usd0.format(rate * hours) : "—");
    var w = document.getElementById("r-warn");
    if (w) {
      w.textContent = v["r-util"] > 85 ? "Heads up: most trades bill well under 85% of hours worked once you count driving, quoting, supply runs and admin." :
        (hours > 0 && hours < 600 ? "Low billable hours push your rate up fast — double-check weeks, hours and billable %." : "");
    }
    lastRate = { hours: hours, costHr: costHr, ohHr: ohHr, be: be, rate: rate, v: v };
    store.set(RATE_KEY, v);
    return lastRate;
  }
  if (document.getElementById("r-wage")) {
    var savedR = store.get(RATE_KEY, null);
    if (savedR) rateFields.forEach(function (id) { if (savedR[id] != null) document.getElementById(id).value = savedR[id]; });
    rateFields.forEach(function (id) { document.getElementById(id).addEventListener("input", calcRate); });
    calcRate();
    var useBtn = document.getElementById("r-use");
    if (useBtn) useBtn.addEventListener("click", function () {
      var r = calcRate(); if (!isFinite(r.rate)) return;
      var cost = Math.round(r.costHr * 100) / 100, bill = Math.round(r.rate * 100) / 100;
      $$("#labor-lines tr").forEach(function (tr) {
        tr.querySelector("[data-k=cost]").value = cost;
        tr.querySelector("[data-k=bill]").value = bill;
      });
      laborDefaults = { cost: cost, bill: bill };
      calcEstimate();
      var est = document.getElementById("estimate"); if (est) est.scrollIntoView({ behavior: "smooth" });
    });
    var rReset = document.getElementById("r-reset");
    if (rReset) rReset.addEventListener("click", function () {
      $$("#rate input").forEach(function (i) { i.value = i.defaultValue; }); calcRate();
    });
    var rPrint = document.getElementById("r-print");
    if (rPrint) rPrint.addEventListener("click", function () {
      var r = calcRate(), v = r.v;
      printHTML("<h1>Billable Hourly Rate Worksheet</h1><table>" +
        row("Owner/crew pay per year", usd0.format(v["r-wage"])) +
        row("Labor burden", pct(v["r-burden"], 0)) +
        row("Annual overhead", usd0.format(v["r-overhead"])) +
        row("Billable hours per year", Math.round(r.hours).toLocaleString() + " (" + v["r-weeks"] + " wks × " + v["r-hours"] + " hrs × " + v["r-util"] + "%)") +
        row("Labor cost per billable hour", money(r.costHr)) +
        row("Overhead per billable hour", money(r.ohHr)) +
        row("Break-even rate", money(r.be)) +
        row("Target net profit margin", pct(v["r-profit"], 0)) +
        "<tr class='tot'><td>Recommended billable rate</td><td class='num'>" + money(r.rate) + "/hr</td></tr></table>");
    });
  }

  /* ---------- 2. Job estimate ---------- */
  var EST_KEY = "ce_estimate_v1";
  var laborDefaults = { cost: 38, bill: 85 };
  var DEFAULT_EST = {
    meta: { client: "", job: "Bathroom vanity + tile repair", date: "", num: "", notes: "" },
    labor: [{ d: "Demo + prep", q: 4, cost: 38, bill: 85 }, { d: "Install vanity, plumbing hookup", q: 6, cost: 38, bill: 85 }, { d: "Tile repair + grout", q: 5, cost: 38, bill: 85 }],
    mat: [{ d: "36\" vanity w/ top", q: 1, u: 480 }, { d: "Faucet + supply lines", q: 1, u: 145 }, { d: "Tile, thinset, grout", q: 1, u: 120 }],
    sub: [{ d: "Licensed plumber (shutoff valve)", c: 250 }],
    oth: [{ d: "Disposal / dump fee", c: 60 }],
    set: { mode: "markup", waste: 10, matMk: 20, subMk: 15, othMk: 10, margin: 35, cont: 5, tax: 0, dep: 30 }
  };
  var lineDefs = {
    labor: { tb: "#labor-lines", cols: [["d", "Task", "text"], ["q", "Hours", "num"], ["cost", "Cost/hr", "num"], ["bill", "Bill/hr", "num"]], blank: function () { return { d: "", q: 1, cost: laborDefaults.cost, bill: laborDefaults.bill }; } },
    mat: { tb: "#mat-lines", cols: [["d", "Item", "text"], ["q", "Qty", "num"], ["u", "Unit cost", "num"]], blank: function () { return { d: "", q: 1, u: 0 }; } },
    sub: { tb: "#sub-lines", cols: [["d", "Subcontractor / scope", "text"], ["c", "Cost", "num"]], blank: function () { return { d: "", c: 0 }; } },
    oth: { tb: "#oth-lines", cols: [["d", "Permit, rental, dumpster…", "text"], ["c", "Cost", "num"]], blank: function () { return { d: "", c: 0 }; } }
  };
  function addLine(kind, data) {
    var def = lineDefs[kind], tb = $(def.tb), tr = document.createElement("tr");
    data = data || def.blank();
    def.cols.forEach(function (c) {
      var td = document.createElement("td"); td.setAttribute("data-l", c[1]);
      var inp = document.createElement("input");
      inp.setAttribute("data-k", c[0]); inp.setAttribute("aria-label", c[1]);
      if (c[2] === "num") { inp.type = "number"; inp.step = "any"; inp.min = "0"; inp.inputMode = "decimal"; } else { inp.type = "text"; inp.placeholder = c[1]; }
      inp.value = data[c[0]] != null ? data[c[0]] : "";
      inp.addEventListener("input", calcEstimate);
      td.appendChild(inp); tr.appendChild(td);
    });
    var tdT = document.createElement("td"); tdT.className = "num"; tdT.setAttribute("data-l", "Line total"); tdT.setAttribute("data-total", ""); tr.appendChild(tdT);
    var tdX = document.createElement("td"); var x = document.createElement("button");
    x.type = "button"; x.className = "x no-print"; x.title = "Remove line"; x.setAttribute("aria-label", "Remove line"); x.textContent = "×";
    x.addEventListener("click", function () { tr.remove(); calcEstimate(); });
    tdX.appendChild(x); tr.appendChild(tdX); tb.appendChild(tr);
  }
  function readLines(kind) {
    return $$(lineDefs[kind].tb + " tr").map(function (tr) {
      var o = {}; $$("input", tr).forEach(function (i) { var k = i.getAttribute("data-k"); o[k] = i.type === "number" ? num(i.value) : i.value; }); o._tr = tr; return o;
    });
  }
  var setIds = { waste: "e-waste", matMk: "e-matmk", subMk: "e-submk", othMk: "e-othmk", margin: "e-margin", cont: "e-cont", tax: "e-tax", dep: "e-dep" };
  var metaIds = { client: "e-client", job: "e-job", date: "e-date", num: "e-num", notes: "e-notes" };
  var mode = "markup", lastEst = null;
  function setMode(m) {
    mode = m;
    $$("#e-mode button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-mode") === m)); });
    $$(".mode-markup").forEach(function (el) { el.hidden = m !== "markup"; });
    $$(".mode-margin").forEach(function (el) { el.hidden = m !== "margin"; });
    calcEstimate();
  }
  function calcEstimate() {
    if (!document.getElementById("estimate")) return;
    var s = {}; Object.keys(setIds).forEach(function (k) { s[k] = num(document.getElementById(setIds[k]).value); });
    var L = readLines("labor"), M = readLines("mat"), S = readLines("sub"), O = readLines("oth");
    var laborCost = 0, laborBill = 0, matCost = 0, subCost = 0, othCost = 0;
    L.forEach(function (l) { l.costT = l.q * l.cost; l.billT = l.q * l.bill; laborCost += l.costT; laborBill += l.billT; });
    M.forEach(function (l) { l.costT = l.q * l.u * (1 + s.waste / 100); matCost += l.costT; });
    S.forEach(function (l) { l.costT = l.c; subCost += l.costT; });
    O.forEach(function (l) { l.costT = l.c; othCost += l.costT; });
    var direct = laborCost + matCost + subCost + othCost;
    var cont = direct * s.cont / 100;
    var cost = direct + cont;
    var mult = {};
    if (mode === "markup") {
      mult.labor = laborCost > 0 ? laborBill / laborCost : 1;
      mult.mat = 1 + s.matMk / 100; mult.sub = 1 + s.subMk / 100; mult.oth = 1 + s.othMk / 100; mult.cont = 1;
    } else {
      var m = Math.min(s.margin, 95) / 100, k = 1 / (1 - m);
      mult.labor = mult.mat = mult.sub = mult.oth = mult.cont = k;
    }
    var laborSell = mode === "markup" ? laborBill : laborCost * mult.labor;
    var matSell = matCost * mult.mat, subSell = subCost * mult.sub, othSell = othCost * mult.oth, contSell = cont * mult.cont;
    var price = laborSell + matSell + subSell + othSell + contSell;
    var tax = matSell * s.tax / 100;
    var total = price + tax;
    var gp = price - cost;
    var gm = price > 0 ? gp / price * 100 : NaN;
    var mk = cost > 0 ? gp / cost * 100 : NaN;
    L.forEach(function (l) { l.sell = mode === "markup" ? l.billT : l.costT * mult.labor; });
    M.forEach(function (l) { l.sell = l.costT * mult.mat; });
    S.forEach(function (l) { l.sell = l.costT * mult.sub; });
    O.forEach(function (l) { l.sell = l.costT * mult.oth; });
    [L, M, S, O].forEach(function (arr) { arr.forEach(function (l) { l._tr.querySelector("[data-total]").textContent = money(l.costT) + " cost"; }); });
    setText("e-out-cost", money(cost)); setText("e-out-price", money(price)); setText("e-out-tax", money(tax));
    setText("e-out-total", money(total)); setText("e-out-gp", money(gp)); setText("e-out-gm", pct(gm));
    setText("e-out-mk", pct(mk)); setText("e-out-dep", money(total * s.dep / 100));
    setText("e-sub-labor", money(laborCost) + " cost → " + money(laborSell) + " price");
    setText("e-sub-mat", money(matCost) + " cost (incl. " + s.waste + "% waste) → " + money(matSell) + " price");
    setText("e-sub-sub", money(subCost) + " cost → " + money(subSell) + " price");
    setText("e-sub-oth", money(othCost) + " cost → " + money(othSell) + " price");
    var w = document.getElementById("e-warn");
    if (w) {
      if (!(price > 0)) { w.className = "note"; w.textContent = "Add some labor, materials or subs to see a price."; }
      else if (gm < 0) { w.className = "warn"; w.textContent = "This job loses money at these numbers."; }
      else if (gm < 15) { w.className = "warn"; w.textContent = "Gross margin under 15% leaves very little to cover overhead, callbacks and profit. Many remodelers aim for roughly 25–40% gross margin (it varies by trade and market)."; }
      else { w.className = "good"; w.textContent = "Gross margin of " + pct(gm) + " — check it against what your overhead actually needs."; }
    }
    var meta = {}; Object.keys(metaIds).forEach(function (k) { meta[k] = document.getElementById(metaIds[k]).value; });
    var strip = function (arr) { return arr.map(function (l) { var o = {}; Object.keys(l).forEach(function (k) { if (["_tr", "costT", "billT", "sell"].indexOf(k) < 0) o[k] = l[k]; }); return o; }); };
    s.mode = mode;
    store.set(EST_KEY, { meta: meta, labor: strip(L), mat: strip(M), sub: strip(S), oth: strip(O), set: s });
    lastEst = { L: L, M: M, S: S, O: O, s: s, meta: meta, laborCost: laborCost, matCost: matCost, subCost: subCost, othCost: othCost, cont: cont, contSell: contSell, cost: cost, laborSell: laborSell, matSell: matSell, subSell: subSell, othSell: othSell, price: price, tax: tax, total: total, gp: gp, gm: gm, mk: mk };
    return lastEst;
  }
  function loadEstimate(d) {
    Object.keys(lineDefs).forEach(function (k) { $(lineDefs[k].tb).innerHTML = ""; (d[k] || []).forEach(function (l) { addLine(k, l); }); });
    Object.keys(setIds).forEach(function (k) { if (d.set && d.set[k] != null) document.getElementById(setIds[k]).value = d.set[k]; });
    Object.keys(metaIds).forEach(function (k) { document.getElementById(metaIds[k]).value = (d.meta && d.meta[k]) || ""; });
    if (!document.getElementById("e-date").value) document.getElementById("e-date").value = new Date().toISOString().slice(0, 10);
    setMode((d.set && d.set.mode) || "markup");
  }
  function row(a, b) { return "<tr><td>" + a + "</td><td class='num'>" + b + "</td></tr>"; }
  function printHTML(html) {
    var box = document.getElementById("printSummary");
    box.innerHTML = html + "<p style='font-size:9pt;color:#555;margin-top:18pt'>Estimate only — prices may change after site inspection or if scope changes. Generated with a free calculator; not legal, tax or financial advice.</p>";
    document.body.classList.add("printing");
    window.print();
  }
  window.addEventListener("afterprint", function () { document.body.classList.remove("printing"); });
  function printEstimate(internal) {
    var e = calcEstimate(), m = e.meta, h = "";
    h += "<h1 style='margin:0'>" + (internal ? "Internal Job Cost Breakdown" : "Estimate") + "</h1>";
    h += "<p>" + (m.job ? "<b>Job:</b> " + esc(m.job) + "<br>" : "") + (m.client ? "<b>Client:</b> " + esc(m.client) + "<br>" : "") +
      (m.num ? "<b>Estimate #:</b> " + esc(m.num) + "<br>" : "") + (m.date ? "<b>Date:</b> " + esc(m.date) : "") + "</p>";
    var sect = function (title, arr, qtyFn) {
      var rows = arr.filter(function (l) { return l.costT || l.d; });
      if (!rows.length) return "";
      var t = "<h3>" + title + "</h3><table><thead><tr><th>Description</th><th class='num'>Qty</th>" + (internal ? "<th class='num'>Cost</th>" : "") + "<th class='num'>Amount</th></tr></thead><tbody>";
      rows.forEach(function (l) { t += "<tr><td>" + esc(l.d || "—") + "</td><td class='num'>" + qtyFn(l) + "</td>" + (internal ? "<td class='num'>" + money(l.costT) + "</td>" : "") + "<td class='num'>" + money(l.sell) + "</td></tr>"; });
      return t + "</tbody></table>";
    };
    h += sect("Labor", e.L, function (l) { return l.q + " hr"; });
    h += sect("Materials", e.M, function (l) { return l.q; });
    h += sect("Subcontractors", e.S, function () { return ""; });
    h += sect("Other", e.O, function () { return ""; });
    h += "<h3>Summary</h3><table>";
    if (e.cont > 0) h += row("Contingency allowance", money(e.contSell));
    h += row("Subtotal", money(e.price));
    if (e.tax > 0) h += row("Sales tax on materials (" + e.s.tax + "%)", money(e.tax));
    h += "<tr class='tot'><td>Total</td><td class='num'>" + money(e.total) + "</td></tr>";
    if (e.s.dep > 0) h += row("Deposit due to schedule (" + e.s.dep + "%)", money(e.total * e.s.dep / 100));
    h += "</table>";
    if (internal) {
      h += "<h3>Profit check (internal — do not send)</h3><table>" + row("Total job cost (incl. contingency)", money(e.cost)) + row("Gross profit", money(e.gp)) +
        row("Gross margin", pct(e.gm)) + row("Effective markup on cost", pct(e.mk)) + row("Pricing method", e.s.mode === "markup" ? "Category markups" : "Target gross margin " + e.s.margin + "%") + "</table>";
    }
    if (m.notes) h += "<h3>Notes / terms</h3><p>" + esc(m.notes).replace(/\n/g, "<br>") + "</p>";
    printHTML(h);
  }
  if (document.getElementById("estimate")) {
    var sr = store.get(RATE_KEY, null);
    loadEstimate(store.get(EST_KEY, DEFAULT_EST));
    Object.keys(setIds).forEach(function (k) { document.getElementById(setIds[k]).addEventListener("input", calcEstimate); });
    Object.keys(metaIds).forEach(function (k) { document.getElementById(metaIds[k]).addEventListener("input", calcEstimate); });
    $$("[data-add]").forEach(function (b) { b.addEventListener("click", function () { addLine(b.getAttribute("data-add")); calcEstimate(); }); });
    $$("#e-mode button").forEach(function (b) { b.addEventListener("click", function () { setMode(b.getAttribute("data-mode")); }); });
    document.getElementById("e-print-client").addEventListener("click", function () { printEstimate(false); });
    document.getElementById("e-print-internal").addEventListener("click", function () { printEstimate(true); });
    document.getElementById("e-reset").addEventListener("click", function () { if (confirm("Reset the estimate to the sample job? Your current lines will be cleared.")) loadEstimate(DEFAULT_EST); });
    document.getElementById("e-clear").addEventListener("click", function () {
      if (!confirm("Clear all lines and start a blank estimate?")) return;
      var b = JSON.parse(JSON.stringify(DEFAULT_EST)); b.labor = [lineDefs.labor.blank()]; b.mat = [lineDefs.mat.blank()]; b.sub = []; b.oth = []; b.meta = { job: "" }; b.set.mode = mode; loadEstimate(b);
    });
  }

  /* ---------- 3. Markup vs margin ---------- */
  if (document.getElementById("m-cost")) {
    var mBy = "markup";
    var mInputs = { markup: "m-markup", margin: "m-margin", price: "m-price" };
    var calcMM = function (src) {
      var cost = num($("#m-cost").value), mk, mg, price;
      if (src) mBy = src;
      if (mBy === "markup") { mk = num($("#m-markup").value); price = cost * (1 + mk / 100); mg = price ? (price - cost) / price * 100 : NaN; }
      else if (mBy === "margin") { mg = num($("#m-margin").value); price = mg < 100 ? cost / (1 - mg / 100) : NaN; mk = cost ? (price - cost) / cost * 100 : NaN; }
      else { price = num($("#m-price").value); mk = cost ? (price - cost) / cost * 100 : NaN; mg = price ? (price - cost) / price * 100 : NaN; }
      if (mBy !== "markup") $("#m-markup").value = isFinite(mk) ? +mk.toFixed(2) : "";
      if (mBy !== "margin") $("#m-margin").value = isFinite(mg) ? +mg.toFixed(2) : "";
      if (mBy !== "price") $("#m-price").value = isFinite(price) ? +price.toFixed(2) : "";
      setText("m-out-price", money(price)); setText("m-out-profit", money(price - cost));
      setText("m-out-mk", pct(mk)); setText("m-out-mg", pct(mg));
      var gap = document.getElementById("m-gap");
      if (gap) {
        var x = num($("#m-markup").value);
        gap.textContent = x > 0 && x < 100 ? "Common mistake: adding a " + pct(x, 0) + " markup gives you only a " + pct(x / (100 + x) * 100) + " margin. To actually keep a " + pct(x, 0) + " margin, you need a " + pct(x / (100 - x) * 100) + " markup." : "";
      }
      store.set("ce_mm_v1", { cost: $("#m-cost").value, by: mBy, v: $("#" + mInputs[mBy]).value });
    };
    var sm = store.get("ce_mm_v1", null);
    if (sm) { $("#m-cost").value = sm.cost; mBy = sm.by || "markup"; $("#" + mInputs[mBy]).value = sm.v; }
    $("#m-cost").addEventListener("input", function () { calcMM(); });
    Object.keys(mInputs).forEach(function (k) { $("#" + mInputs[k]).addEventListener("input", function () { calcMM(k); }); });
    calcMM();
    var tb = document.getElementById("m-table");
    if (tb) {
      [10, 15, 20, 25, 30, 33.33, 40, 50, 60, 75, 100].forEach(function (mk) {
        var mg = mk / (100 + mk) * 100;
        var tr = document.createElement("tr");
        tr.innerHTML = "<td>" + +mk.toFixed(2) + "%</td><td>" + mg.toFixed(1) + "%</td><td class='num'>" + usd.format(100 * (1 + mk / 100)) + "</td>";
        tb.appendChild(tr);
      });
    }
    var tb2 = document.getElementById("m-table2");
    if (tb2) {
      [10, 15, 20, 25, 30, 35, 40, 45, 50].forEach(function (mg) {
        var mk = mg / (100 - mg) * 100;
        var tr = document.createElement("tr");
        tr.innerHTML = "<td>" + mg + "%</td><td>" + mk.toFixed(1) + "%</td><td class='num'>" + usd.format(100 / (1 - mg / 100)) + "</td>";
        tb2.appendChild(tr);
      });
    }
  }
})();
