/**
 * generateReport.ts
 * Pure jsPDF 4.x — no plugins, no autoTable, no roundedRect, no circle.
 * Uses only the guaranteed-stable drawing primitives.
 */
import jsPDF from 'jspdf';
import type { LogEntry } from '../types';

/* ── Constants ──────────────────────────────────────────────── */
const PW = 210;    // A4 width  (mm)
const PH = 297;    // A4 height (mm)
const M  = 14;     // margin
const CW = PW - M * 2;

/* ── Colours ────────────────────────────────────────────────── */
const C = {
  green:  [34,  197, 94]  as const,
  dkGrn:  [22,  163, 74]  as const,
  red:    [239, 68,  68]  as const,
  dark:   [15,  23,  42]  as const,
  gray:   [107, 114, 128] as const,
  lgray:  [220, 228, 220] as const,
  white:  [255, 255, 255] as const,
  bg:     [246, 251, 246] as const,
  card:   [255, 255, 255] as const,
};

/* ── Helpers ────────────────────────────────────────────────── */
type Col = readonly [number, number, number];
const sf = (d: jsPDF, c: Col) => d.setFillColor(c[0], c[1], c[2]);
const sd = (d: jsPDF, c: Col) => d.setDrawColor(c[0], c[1], c[2]);
const st = (d: jsPDF, c: Col) => d.setTextColor(c[0], c[1], c[2]);

const fmtTs = (ts: LogEntry['timestamp']): string => {
  if (!ts || typeof ts.toDate !== 'function') return 'N/A';
  return ts.toDate().toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

const trunc = (s: string, n: number) =>
  s.length > n ? s.slice(0, n - 1) + '.' : s;

/* ══════════════════════════════════════════════════════════════
   ENTRY POINT
══════════════════════════════════════════════════════════════ */
export async function generateReport(
  logs: LogEntry[],
  userEmail: string,
): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const now = new Date();

  /* Page 1 — summary */
  drawPage1(doc, logs, userEmail, now);

  /* Page 2+ — history table */
  if (logs.length > 0) {
    doc.addPage();
    drawHistoryTable(doc, logs, userEmail);
  }

  /* Footer on every page */
  const np = doc.getNumberOfPages();
  for (let p = 1; p <= np; p++) {
    doc.setPage(p);
    drawFooter(doc, p, np);
  }

  /* Download via Blob URL — more reliable than doc.save() */
  const blob = doc.output('blob');
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'CluckCare_Report_' + now.toISOString().slice(0, 10) + '.pdf';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/* ══════════════════════════════════════════════════════════════
   PAGE 1
══════════════════════════════════════════════════════════════ */
function drawPage1(doc: jsPDF, logs: LogEntry[], userEmail: string, now: Date) {
  /* ── Header ── */
  sf(doc, C.green);
  doc.rect(0, 0, PW, 44, 'F');

  // Right accent
  sf(doc, C.dkGrn);
  doc.rect(PW - 50, 0, 50, 44, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  st(doc, C.white);
  doc.text('CluckCare', M, 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text('AI-Powered Poultry Health Analysis Report', M, 25);

  const dateStr = now.toLocaleDateString('en-GB', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });
  doc.setFontSize(7.5);
  doc.text('Generated:  ' + dateStr, M, 33);
  doc.text('Account:    ' + userEmail, M, 39);

  // Record count (right block)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text(String(logs.length), PW - 25, 22, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text('total', PW - 25, 28, { align: 'center' });
  doc.text('records', PW - 25, 33, { align: 'center' });

  let y = 52;

  /* ── Computed stats ── */
  const healthy = logs.filter(l => l.status === 'healthy');
  const flagged = logs.filter(l => l.status === 'unhealthy');
  const audios  = logs.filter(l => l.type === 'audio');
  const images  = logs.filter(l => l.type === 'image');
  const rate    = logs.length > 0 ? Math.round((healthy.length / logs.length) * 100) : 0;
  const avgConf = logs.length > 0
    ? (logs.reduce((s, l) => s + l.confidence, 0) / logs.length * 100).toFixed(1)
    : '0.0';
  const lastDate = logs.length > 0 && logs[logs.length - 1].timestamp?.toDate
    ? logs[logs.length - 1].timestamp!.toDate().toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
      })
    : 'N/A';

  /* ── Section title ── */
  y = sectionTitle(doc, 'Account Summary', M, y);

  /* ── Primary stat cards ── */
  const cW = (CW - 9) / 4;
  const cH = 24;

  const cards = [
    { label: 'TOTAL ANALYSES', value: String(logs.length),  sub: 'All time',        col: C.green },
    { label: 'HEALTHY',         value: String(healthy.length), sub: 'Cleared',       col: C.green },
    { label: 'FLAGGED',         value: String(flagged.length), sub: 'Need attention', col: C.red   },
    { label: 'SUCCESS RATE',    value: rate + '%',            sub: 'Healthy/Total',  col: rate >= 50 ? C.green : C.red },
  ];

  cards.forEach((card, i) => {
    const cx = M + i * (cW + 3);

    // Card body
    sf(doc, C.card);
    sd(doc, C.lgray);
    doc.setLineWidth(0.3);
    doc.rect(cx, y, cW, cH, 'FD');

    // Top colour strip
    sf(doc, card.col as Col);
    doc.rect(cx, y, cW, 4, 'F');

    // Value
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(card.col[0], card.col[1], card.col[2]);
    doc.text(card.value, cx + cW / 2, y + 14, { align: 'center' });

    // Label
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.8);
    st(doc, C.dark);
    doc.text(card.label, cx + cW / 2, y + 19, { align: 'center' });

    // Sub
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    st(doc, C.gray);
    doc.text(card.sub, cx + cW / 2, y + 22.5, { align: 'center' });
  });

  y += cH + 4;

  /* ── Secondary info row ── */
  const sec = [
    { label: 'Audio Checks',   value: String(audios.length) },
    { label: 'Image Scans',    value: String(images.length) },
    { label: 'Avg Confidence', value: avgConf + '%' },
    { label: 'Most Recent',    value: lastDate },
  ];

  sec.forEach((item, i) => {
    const cx = M + i * (cW + 3);
    sf(doc, C.bg);
    sd(doc, C.lgray);
    doc.setLineWidth(0.2);
    doc.rect(cx, y, cW, 13, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    st(doc, C.dark);
    doc.text(item.value, cx + cW / 2, y + 6.5, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    st(doc, C.gray);
    doc.text(item.label, cx + cW / 2, y + 11, { align: 'center' });
  });

  y += 19;

  /* ── Charts ── */
  if (logs.length > 0) {
    const halfW  = (CW - 8) / 2;
    const chartH = 54;

    y = sectionTitle(doc, 'Confidence Trend', M, y);
    y -= 2; // align both titles on same line
    sectionTitle(doc, 'Outcome Breakdown', M + halfW + 8, y + 2);
    y += 2;

    drawLineChart(doc, logs, M, y, halfW, chartH);
    drawBarChart(doc, logs, M + halfW + 8, y, halfW, chartH);

    y += chartH + 8;
  }

  /* ── Diagnosis distribution ── */
  if (logs.length > 0 && y < PH - 60) {
    y = sectionTitle(doc, 'Diagnosis Distribution', M, y);

    const counts: Record<string, number> = {};
    logs.forEach(l => {
      const k = l.label.charAt(0).toUpperCase() + l.label.slice(1).toLowerCase();
      counts[k] = (counts[k] || 0) + 1;
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const maxV = Math.max(1, ...sorted.map(e => e[1]));
    const rowH = 9;

    sorted.forEach(([label, cnt], i) => {
      if (y + rowH > PH - 30) return;
      const pct = Math.round((cnt / logs.length) * 100);

      sf(doc, i % 2 === 0 ? C.bg : C.card);
      sd(doc, C.lgray);
      doc.setLineWidth(0.1);
      doc.rect(M, y, CW, rowH, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      st(doc, C.dark);
      doc.text(label, M + 3, y + 6);

      // Mini bar
      const barX = M + 48;
      const barMaxW = CW - 90;
      sf(doc, C.lgray);
      doc.rect(barX, y + 3, barMaxW, 2.5, 'F');
      sf(doc, C.green);
      doc.rect(barX, y + 3, Math.max(1, barMaxW * cnt / maxV), 2.5, 'F');

      // Count + pct
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      st(doc, C.dark);
      doc.text(String(cnt), M + CW - 22, y + 6, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      st(doc, C.gray);
      doc.text('(' + pct + '%)', M + CW - 2, y + 6, { align: 'right' });

      y += rowH;
    });
  }
}

/* ══════════════════════════════════════════════════════════════
   HISTORY TABLE (no autoTable)
══════════════════════════════════════════════════════════════ */
function drawHistoryTable(doc: jsPDF, logs: LogEntry[], userEmail: string) {
  /* Compact header */
  sf(doc, C.green);
  doc.rect(0, 0, PW, 20, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  st(doc, C.white);
  doc.text('CluckCare - Complete Analysis History', M, 10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(
    logs.length + ' record' + (logs.length !== 1 ? 's' : '') + '   |   ' + userEmail,
    M, 16.5,
  );

  /* Column definitions */
  const colDefs = [
    { header: '#',          width: 10  },
    { header: 'Type',       width: 22  },
    { header: 'Diagnosis',  width: 44  },
    { header: 'Status',     width: 26  },
    { header: 'Confidence', width: 26  },
    { header: 'Timestamp',  width: CW - 10 - 22 - 44 - 26 - 26 },
  ];
  const ROW_H = 7;
  const BOTTOM = PH - 18;

  let y = 25;

  const drawTableHeader = (startY: number) => {
    sf(doc, C.green);
    doc.rect(M, startY, CW, ROW_H, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    st(doc, C.white);
    let cx = M;
    colDefs.forEach(col => {
      doc.text(col.header, cx + 2, startY + ROW_H * 0.7);
      cx += col.width;
    });
    return startY + ROW_H;
  };

  y = drawTableHeader(y);

  const reversed = [...logs].reverse();

  reversed.forEach((log, i) => {
    /* Page break */
    if (y + ROW_H > BOTTOM) {
      doc.addPage();
      sf(doc, C.green);
      doc.rect(0, 0, PW, 12, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      st(doc, C.white);
      doc.text('CluckCare - History (continued)', M, 8);
      y = 16;
      y = drawTableHeader(y);
    }

    /* Row background */
    sf(doc, i % 2 === 0 ? C.bg : C.card);
    doc.rect(M, y, CW, ROW_H, 'F');

    /* Row separator */
    sd(doc, C.lgray);
    doc.setLineWidth(0.1);
    doc.line(M, y + ROW_H, M + CW, y + ROW_H);

    /* Cell data */
    const statusColor: Col = log.status === 'healthy' ? C.green : C.red;
    const typeColor: Col   = log.type === 'audio'     ? C.green : C.red;

    const cells: { text: string; col: Col; bold?: boolean }[] = [
      { text: String(i + 1),         col: C.gray },
      { text: log.type === 'audio' ? 'Audio' : 'Image',
        col: typeColor },
      { text: trunc(
          log.label.charAt(0).toUpperCase() + log.label.slice(1).toLowerCase(), 30
        ), col: C.dark },
      { text: log.status === 'healthy' ? 'Healthy' : 'Flagged',
        col: statusColor, bold: true },
      { text: (log.confidence * 100).toFixed(1) + '%', col: C.gray },
      { text: fmtTs(log.timestamp), col: C.gray },
    ];

    let cx = M;
    cells.forEach((cell, ci) => {
      doc.setFont('helvetica', cell.bold ? 'bold' : 'normal');
      doc.setFontSize(8);
      doc.setTextColor(cell.col[0], cell.col[1], cell.col[2]);
      doc.text(cell.text, cx + 2, y + ROW_H * 0.69);
      cx += colDefs[ci].width;
    });

    y += ROW_H;
  });

  /* Outer border */
  sd(doc, [190, 210, 190] as Col);
  doc.setLineWidth(0.3);
  doc.rect(M, 25, CW, y - 25);
}

/* ── Page footer ────────────────────────────────────────────── */
function drawFooter(doc: jsPDF, page: number, total: number) {
  sf(doc, C.green);
  doc.rect(0, PH - 7, PW, 7, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  st(doc, C.white);
  doc.text(
    'CluckCare | For demonstration only. Always confirm with a licensed veterinarian.',
    M, PH - 2.5,
  );
  doc.text('Page ' + page + ' / ' + total, PW - M, PH - 2.5, { align: 'right' });
}

/* ── Section title ──────────────────────────────────────────── */
function sectionTitle(doc: jsPDF, label: string, x: number, y: number): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  st(doc, C.dark);
  doc.text(label, x, y);
  sf(doc, C.green);
  doc.rect(x, y + 1.8, label.length * 1.75, 0.7, 'F');
  return y + 8;
}

/* ══════════════════════════════════════════════════════════════
   CHARTS (no circle, no roundedRect)
══════════════════════════════════════════════════════════════ */

function drawLineChart(
  doc: jsPDF, logs: LogEntry[],
  x: number, y: number, w: number, h: number,
) {
  const pL = 14, pR = 5, pT = 4, pB = 12;
  const cX = x + pL, cY = y + pT;
  const cW = w - pL - pR, cH = h - pT - pB;
  const n  = logs.length;

  /* Panel */
  sf(doc, C.bg);
  sd(doc, C.lgray);
  doc.setLineWidth(0.2);
  doc.rect(x, y, w, h, 'FD');

  /* Y gridlines: 0, 25, 50, 75, 100 */
  [0, 0.25, 0.5, 0.75, 1].forEach(frac => {
    const ly = cY + cH - frac * cH;
    if (frac > 0) {
      sd(doc, [215, 228, 215] as Col);
      doc.setLineWidth(0.1);
      doc.line(cX, ly, cX + cW, ly);
    }
    doc.setFontSize(4.5);
    st(doc, C.gray);
    doc.text(Math.round(frac * 100) + '%', cX - 1.5, ly + 1.2, { align: 'right' });
  });

  /* Data series */
  type Pt = { px: number; py: number };

  const getPts = (type: 'audio' | 'image'): Pt[] =>
    logs
      .map((l, i) => ({ l, i }))
      .filter(({ l }) => l.type === type)
      .map(({ l, i }) => ({
        px: n <= 1 ? cX + cW / 2 : cX + (i / (n - 1)) * cW,
        py: cY + cH - Math.min(1, Math.max(0, l.confidence)) * cH,
      }));

  const drawSeries = (pts: Pt[], colour: Col) => {
    if (pts.length === 0) return;

    /* Lines */
    sd(doc, colour);
    doc.setLineWidth(0.8);
    for (let i = 1; i < pts.length; i++) {
      doc.line(pts[i - 1].px, pts[i - 1].py, pts[i].px, pts[i].py);
    }

    /* Dots (small squares instead of circles) */
    const R = 1.2;
    pts.forEach(p => {
      sf(doc, colour);
      doc.rect(p.px - R, p.py - R, R * 2, R * 2, 'F');
      sf(doc, C.card);
      doc.rect(p.px - 0.45, p.py - 0.45, 0.9, 0.9, 'F');
    });
  };

  drawSeries(getPts('audio'), C.green);
  drawSeries(getPts('image'), C.red);

  /* X axis */
  sd(doc, C.lgray);
  doc.setLineWidth(0.3);
  doc.line(cX, cY + cH, cX + cW, cY + cH);

  /* X ticks */
  const step = Math.max(1, Math.ceil(n / 6));
  for (let i = 0; i < n; i += step) {
    const px = n <= 1 ? cX + cW / 2 : cX + (i / (n - 1)) * cW;
    doc.setFontSize(4.5);
    st(doc, C.gray);
    doc.text('#' + (i + 1), px, cY + cH + 3.5, { align: 'center' });
  }

  chartLegend(doc, cX, cY + cH + 8, C.green, C.red, 'Audio', 'Image');
}

function drawBarChart(
  doc: jsPDF, logs: LogEntry[],
  x: number, y: number, w: number, h: number,
) {
  const pL = 11, pR = 5, pT = 4, pB = 14;
  const cX = x + pL, cY = y + pT;
  const cW = w - pL - pR, cH = h - pT - pB;

  /* Panel */
  sf(doc, C.bg);
  sd(doc, C.lgray);
  doc.setLineWidth(0.2);
  doc.rect(x, y, w, h, 'FD');

  /* Counts */
  const counts: Record<string, { audio: number; image: number }> = {};
  logs.forEach(l => {
    const k = l.label.charAt(0).toUpperCase() + l.label.slice(1).toLowerCase();
    if (!counts[k]) counts[k] = { audio: 0, image: 0 };
    if (l.type === 'audio') counts[k].audio++;
    else counts[k].image++;
  });
  const labels = Object.keys(counts);
  if (!labels.length) return;
  const maxVal = Math.max(1, ...Object.values(counts).map(c => Math.max(c.audio, c.image)));

  /* Y gridlines */
  [0, 0.5, 1].forEach(frac => {
    const ly = cY + cH - frac * cH;
    if (frac > 0) {
      sd(doc, [215, 228, 215] as Col);
      doc.setLineWidth(0.1);
      doc.line(cX, ly, cX + cW, ly);
    }
    doc.setFontSize(4.5);
    st(doc, C.gray);
    doc.text(String(Math.round(frac * maxVal)), cX - 1.5, ly + 1.2, { align: 'right' });
  });

  const groupW = cW / labels.length;
  const barW   = Math.min((groupW - 4) / 2, 8);

  labels.forEach((label, i) => {
    const gx = cX + i * groupW + (groupW - barW * 2 - 2) / 2;
    const { audio, image } = counts[label];

    if (audio > 0) {
      const bh = (audio / maxVal) * cH;
      sf(doc, C.green);
      doc.rect(gx, cY + cH - bh, barW, bh, 'F');
      doc.setFontSize(4.5);
      st(doc, C.dkGrn);
      doc.text(String(audio), gx + barW / 2, cY + cH - bh - 1.5, { align: 'center' });
    }

    if (image > 0) {
      const bh = (image / maxVal) * cH;
      sf(doc, C.red);
      doc.rect(gx + barW + 2, cY + cH - bh, barW, bh, 'F');
      doc.setFontSize(4.5);
      st(doc, C.red);
      doc.text(String(image), gx + barW + 2 + barW / 2, cY + cH - bh - 1.5, { align: 'center' });
    }

    const lbl = label.length > 9 ? label.slice(0, 8) + '.' : label;
    doc.setFontSize(5);
    st(doc, C.gray);
    doc.text(lbl, gx + barW + 1, cY + cH + 4.5, { align: 'center' });
  });

  /* X axis */
  sd(doc, C.lgray);
  doc.setLineWidth(0.3);
  doc.line(cX, cY + cH, cX + cW, cY + cH);

  chartLegend(doc, cX, cY + cH + 9, C.green, C.red, 'Audio', 'Image');
}

function chartLegend(
  doc: jsPDF,
  x: number, y: number,
  c1: Col, c2: Col,
  l1: string, l2: string,
) {
  sf(doc, c1);
  doc.rect(x, y - 2, 5, 2.5, 'F');
  doc.setFontSize(5.5);
  st(doc, C.gray);
  doc.text(l1, x + 6.5, y);

  sf(doc, c2);
  doc.rect(x + 22, y - 2, 5, 2.5, 'F');
  doc.text(l2, x + 28.5, y);
}
