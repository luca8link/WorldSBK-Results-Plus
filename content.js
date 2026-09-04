// WorldSBK Gap Columns
// - Adds "Gap to 1st" and "Gap to prev" after the Time cell on every results table.
// - On RACE sessions adds a "Pts" column with championship points.
// - Adds points "Gap 1st"/"Gap Prev" columns on the championship standings table.
// - Appends a PDF panel (Results always; Standings on races) below the results
//   widget, plus a smooth-scroll "jump" link before it.

const TABLE_SEL = "table.results-table__table";
const TIME_HEAD = ".results-table__header-cell--time";
const TIME_CELL = ".results-table__body-cell--time";
const POS_CELL = ".results-table__body-cell--pos";
const RESULTS_SEL = ".results"; // the widget container
const TAG = "wsbk-col";    // marks injected table cells (idempotent re-runs)
const PDF_TAG = "wsbk-pdf"; // marks the injected PDF panel
const JUMP_TAG = "wsbk-jump"; // marks the smooth-scroll link

// Championship points by finishing position.
const POINTS_FULL = {
  1: 25, 2: 20, 3: 16, 4: 13, 5: 11, 6: 10, 7: 9, 8: 8,
  9: 7, 10: 6, 11: 5, 12: 4, 13: 3, 14: 2, 15: 1,
};
const POINTS_SPRINT = {
  1: 12, 2: 10, 3: 9, 4: 7, 5: 6, 6: 5, 7: 4, 8: 3, 9: 2,
};

// Session is identified by the LAST path segment of the URL.
const RACE_CODES = { "001": POINTS_FULL, "003": POINTS_FULL, "002": POINTS_SPRINT };

function sessionCode() {
  const seg = location.pathname.split("/").filter(Boolean).pop() || "";
  return seg.toUpperCase();
}

function pointsTableFor() {
  const code = sessionCode();
  if (RACE_CODES[code]) return RACE_CODES[code];
  const opt = document.querySelector(
    'select[name="results-filter-session"] option[value="' + code + '"]'
  );
  const label = opt ? opt.textContent.trim() : "";
  if (/race/i.test(label)) return /superpole/i.test(label) ? POINTS_SPRINT : POINTS_FULL;
  return null;
}

function isRaceSession() {
  return pointsTableFor() != null;
}

// ----- PDF panel (Results / Standings) ------------------------------------

// tab: label; linkText: site link to match; tail: URL tail to build;
// racesOnly: only offered on race sessions (Standings PDF doesn't exist otherwise).
const PDFS = [
  { tab: "Results", linkText: "results", tail: "CLA/Results.pdf" },
  { tab: "Standings", linkText: "championship standings", tail: "STD/ChampionshipStandings.pdf", racesOnly: true },
];

function pdfBase() {
  const parts = location.pathname.split("/").filter(Boolean);
  const i = parts.indexOf("results");
  if (i === -1 || parts.length < i + 5) return null;
  const [year, event, cat, session] = parts.slice(i + 1, i + 5);
  return (
    "https://resources.worldsbk.com/files/results/" +
    year + "/" + event.toUpperCase() + "/" + cat.toUpperCase() +
    "/" + session.toUpperCase() + "/"
  );
}

function pdfUrl(spec) {
  for (const a of document.querySelectorAll(".results-pdf__list-link")) {
    const desc = a.querySelector(".results-pdf__list-description") || a;
    if (desc.textContent.trim().toLowerCase() === spec.linkText && a.href) return a.href;
  }
  const base = pdfBase();
  return base ? base + spec.tail : null;
}

let pdfActive = 0;      // remembered tab index across rebuilds
let pdfBuiltKey = null; // session code the current panel was built for

function renderViewer(viewer, openLink, spec) {
  openLink.href = spec.url;
  viewer.textContent = "";
  const obj = document.createElement("object");
  obj.className = PDF_TAG + "__obj";
  obj.data = spec.url;
  obj.type = "application/pdf";
  const fb = document.createElement("p");
  fb.className = PDF_TAG + "__fallback";
  const fbLink = document.createElement("a");
  fbLink.href = spec.url;
  fbLink.target = "_blank";
  fbLink.rel = "noopener noreferrer";
  fbLink.textContent = "Open the PDF \u2197";
  fb.append("Inline preview isn\u2019t available here. ", fbLink);
  obj.append(fb);
  viewer.append(obj);
}

function injectPdf() {
  const container = document.querySelector(RESULTS_SEL);
  if (!container) { pdfBuiltKey = null; return; }

  const code = sessionCode();
  const existing = document.querySelector("." + PDF_TAG);
  // Already built for this session and correctly placed -> leave it (no reload).
  if (existing && pdfBuiltKey === code && container.nextElementSibling === existing) return;
  if (existing) existing.remove();
  document.querySelectorAll("." + JUMP_TAG).forEach((n) => n.remove());

  const races = isRaceSession();
  const specs = PDFS
    .filter((s) => !s.racesOnly || races)
    .map((s) => ({ ...s, url: pdfUrl(s) }))
    .filter((s) => s.url);
  if (!specs.length) { pdfBuiltKey = null; return; }
  if (pdfActive >= specs.length) pdfActive = 0;

  const panel = document.createElement("section");
  panel.className = PDF_TAG;

  const bar = document.createElement("div");
  bar.className = PDF_TAG + "__bar";

  const openLink = document.createElement("a");
  openLink.className = PDF_TAG + "__link";
  openLink.target = "_blank";
  openLink.rel = "noopener noreferrer";
  openLink.textContent = "Open in new tab \u2197";

  const viewer = document.createElement("div");
  viewer.className = PDF_TAG + "__viewer";

  if (specs.length === 1) {
    // Single PDF -> plain title, no tab UI.
    const title = document.createElement("span");
    title.className = PDF_TAG + "__title";
    title.textContent =
      specs[0].tab === "Results" ? "Official Results PDF" : specs[0].tab + " PDF";
    bar.append(title, openLink);
  } else {
    const tabs = document.createElement("div");
    tabs.className = PDF_TAG + "__tabs";
    const tabButtons = specs.map((spec, idx) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className =
        PDF_TAG + "__tab" + (idx === pdfActive ? " " + PDF_TAG + "__tab--active" : "");
      b.textContent = spec.tab;
      b.addEventListener("click", () => {
        pdfActive = idx;
        tabButtons.forEach((tb, j) =>
          tb.classList.toggle(PDF_TAG + "__tab--active", j === idx)
        );
        renderViewer(viewer, openLink, specs[idx]);
      });
      return b;
    });
    tabButtons.forEach((b) => tabs.append(b));
    bar.append(tabs, openLink);
  }

  panel.append(bar, viewer);
  renderViewer(viewer, openLink, specs[pdfActive]);
  container.after(panel);

  // Smooth-scroll link before the results widget.
  const jump = document.createElement("a");
  jump.className = JUMP_TAG;
  jump.href = "#";
  jump.textContent =
    (specs.length > 1 ? "Jump to Results & Standings PDFs" : "Jump to Results PDF") + " \u2193";
  jump.addEventListener("click", (e) => {
    e.preventDefault();
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  container.before(jump);

  pdfBuiltKey = code;
}

// ----- Gap / points columns -----------------------------------------------

function parseLap(raw) {
  let s = (raw || "").trim();
  let rel = false;
  if (s[0] === "+") { rel = true; s = s.slice(1).trim(); }
  const m = s.match(/^(?:(\d+)')?(\d{1,2}(?:\.\d+)?)$/);
  if (!m) return null;
  const mins = m[1] ? parseInt(m[1], 10) : 0;
  return { v: mins * 60 + parseFloat(m[2]), rel };
}

function fmtGap(delta) {
  if (delta == null) return "–";
  if (delta <= 0.0005) return "+0.000";
  return "+" + delta.toFixed(3);
}

function th(label, extra) {
  const el = document.createElement("th");
  el.className = "results-table__header-cell " + TAG + (extra ? " " + extra : "");
  el.textContent = label;
  return el;
}

function td(text, extra) {
  const el = document.createElement("td");
  el.className = "results-table__body-cell " + TAG + (extra ? " " + extra : "");
  el.textContent = text;
  return el;
}

function enhance(table) {
  table.querySelectorAll("." + TAG).forEach((n) => n.remove());

  const headRow = table.querySelector("thead tr");
  const timeHead = headRow && headRow.querySelector(TIME_HEAD);
  if (!timeHead) return;

  const points = pointsTableFor();
  const isRace = points != null;

  const headCells = [th("Gap 1st"), th("Gap Prev")];
  if (isRace) headCells.push(th("Pts", "wsbk-points"));
  timeHead.after(...headCells);

  let firstAbs = null;
  let prevAbs = null;

  table.querySelectorAll("tbody tr").forEach((row) => {
    const timeCell = row.querySelector(TIME_CELL);
    if (!timeCell) return;

    const p = parseLap(timeCell.textContent);
    let abs = null;
    let valid = false;
    if (p) {
      abs = p.rel && firstAbs != null ? firstAbs + p.v : p.v;
      if (firstAbs == null) firstAbs = abs;
      valid = abs >= firstAbs - 0.0005;
    }

    const gapFirst = valid ? fmtGap(abs - firstAbs) : "–";
    const gapPrev = valid ? (prevAbs == null ? "–" : fmtGap(abs - prevAbs)) : "–";
    if (valid) prevAbs = abs;

    const cells = [td(gapFirst), td(gapPrev)];
    if (isRace) {
      const posCell = row.querySelector(POS_CELL);
      const pos = posCell ? parseInt(posCell.textContent.trim(), 10) : NaN;
      const pts = Number.isInteger(pos) ? (points[pos] || 0) : "–";
      cells.push(td(String(pts), "wsbk-points"));
    }
    timeCell.after(...cells);
  });
}

// ----- Standings table: points gap columns ---------------------------------

const STANDINGS_SEL = "table.standings-table__table";
const STD_PTS_HEAD = ".standings-table__header-cell--time"; // the "Pts." column
const STD_PTS_CELL = ".standings-table__body-cell--time";

function fmtPtsGap(delta) {
  if (delta == null) return "–";
  if (delta <= 0) return "0";   // leader, or level on points
  return "-" + delta;           // points behind (a deficit)
}

function stdTh(label) {
  const el = document.createElement("th");
  el.className = "standings-table__header-cell " + TAG;
  el.textContent = label;
  return el;
}

function stdTd(text) {
  const el = document.createElement("td");
  el.className = "standings-table__body-cell " + TAG;
  el.textContent = text;
  return el;
}

// Standings rows are already sorted by points (descending). After the "Pts."
// cell we inject the gap to the leader and to the rider immediately ahead.
function enhanceStandings(table) {
  table.querySelectorAll("." + TAG).forEach((n) => n.remove());

  const headRow = table.querySelector("thead tr");
  const ptsHead = headRow && headRow.querySelector(STD_PTS_HEAD);
  if (!ptsHead) return;

  ptsHead.after(stdTh("Gap 1st"), stdTh("Gap Prev"));

  let leaderPts = null;
  let prevPts = null;

  table.querySelectorAll("tbody tr").forEach((row) => {
    const ptsCell = row.querySelector(STD_PTS_CELL);
    if (!ptsCell) return;

    const pts = parseInt(ptsCell.textContent.trim(), 10);
    let gap1st = "–";
    let gapPrev = "–";
    if (Number.isFinite(pts)) {
      if (leaderPts == null) leaderPts = pts;
      gap1st = fmtPtsGap(leaderPts - pts);
      gapPrev = prevPts == null ? "–" : fmtPtsGap(prevPts - pts);
      prevPts = pts;
    }
    ptsCell.after(stdTd(gap1st), stdTd(gapPrev));
  });
}

// ----- Orchestration -------------------------------------------------------

let timer = null;
let observer = null;

function run() {
  if (observer) observer.disconnect();
  document.querySelectorAll(TABLE_SEL).forEach(enhance);
  document.querySelectorAll(STANDINGS_SEL).forEach(enhanceStandings);
  injectPdf();
  if (observer) observer.observe(document.body, { childList: true, subtree: true });
}

observer = new MutationObserver(() => {
  clearTimeout(timer);
  timer = setTimeout(run, 200);
});

run();
