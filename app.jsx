import { useState, useEffect, useMemo } from "react";

const KEY = "mmfinanz_v3";

const seed = {
  customers: [
    { id: 1, name: "Klaus Müller", phone: "0151-123456", type: "business", alwaysZeroVat: false, note: "" },
    { id: 2, name: "Stefan Weber", phone: "0172-654321", type: "private", alwaysZeroVat: true, note: "Freund" },
  ],
  invoices: [
    { id: 1, customerId: 1, date: "2026-05-10", vatRate: 19, paid: true, items: [{ desc: "Küchenmontage", sell: 800, buy: 600, qty: 1 }] },
    { id: 2, customerId: 2, date: "2026-05-18", vatRate: 0, paid: true, items: [{ desc: "Regal", sell: 200, buy: 150, qty: 1 }] },
    { id: 3, customerId: 1, date: "2026-05-25", vatRate: 19, paid: false, items: [{ desc: "Schrank", sell: 1200, buy: 900, qty: 1 }] },
    { id: 4, customerId: 1, date: "2026-05-29", vatRate: 19, paid: true, items: [{ desc: "Tür einbauen", sell: 350, buy: 250, qty: 1 }] },
  ],
  fixedCosts: [
    { id: 1, name: "Werkstattmiete", amount: 600, section: "work" },
    { id: 2, name: "Transporter", amount: 280, section: "work" },
    { id: 3, name: "Versicherung", amount: 150, section: "work" },
    { id: 4, name: "Steuerberater", amount: 120, section: "work" },
    { id: 5, name: "Wohnungsmiete", amount: 950, section: "private" },
    { id: 6, name: "Lebensmittel", amount: 400, section: "private" },
  ],
  expenses: [
    { id: 1, date: "2026-05-08", desc: "Rewe", amount: 85, cat: "Lebensmittel" },
    { id: 2, date: "2026-05-14", desc: "Tanken", amount: 60, cat: "Transport" },
  ],
  privateIncome: [
    { id: 1, date: "2026-05-01", desc: "Kindergeld", amount: 255, cat: "Kindergeld", recurring: true },
    { id: 2, date: "2026-05-28", desc: "Gehalt Frau", amount: 1800, cat: "Gehalt/Lohn", recurring: true },
  ],
};

// ── COMPANY INFO ──────────────────────────────────────────
const COMPANY_EMAIL = "Info@mezyak-schreinerei.de";
const COMPANY_PHONE = "015771507987";
const COMPANY_IBAN = "DE93 7935 0101 0022 3729 32";
const COMPANY_BANK = "Sparkasse Schweinfurt Hassberge";

// ── PDF GENERATION ────────────────────────────────────────
function generateInvoicePDF(inv, customer) {
  const netto = inv.items.reduce((s, it) => {
    if (it.kind === "arbeit") return s + (parseFloat(it.hours)||0)*(parseFloat(it.rate)||0);
    return s + (parseFloat(it.sell)||0)*(parseFloat(it.qty)||1);
  }, 0);
  const vatAmt = netto * (inv.vatRate / 100);
  const brutto = netto + vatAmt;
  const eur2 = (n) => new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n||0);

  let rows = inv.items.map((it, i) => {
    const isArbeit = it.kind === "arbeit";
    const menge = isArbeit ? `${it.hours||0} Std` : `${it.qty||1} St`;
    const desc = it.desc || (isArbeit ? "Arbeitszeit" : "Material");
    const ePreis = isArbeit ? parseFloat(it.rate)||0 : parseFloat(it.sell)||0;
    const gPreis = isArbeit
      ? (parseFloat(it.hours)||0)*(parseFloat(it.rate)||0)
      : (parseFloat(it.sell)||0)*(parseFloat(it.qty)||1);
    return `<tr>
      <td style="text-align:center;padding:7px 8px;border-bottom:1px solid #e8e8e8">${i+1}</td>
      <td style="text-align:center;padding:7px 8px;border-bottom:1px solid #e8e8e8">${menge}</td>
      <td style="padding:7px 8px;border-bottom:1px solid #e8e8e8">${desc}</td>
      <td style="text-align:right;padding:7px 8px;border-bottom:1px solid #e8e8e8;font-variant-numeric:tabular-nums">${eur2(ePreis)}</td>
      <td style="text-align:right;padding:7px 8px;border-bottom:1px solid #e8e8e8;font-variant-numeric:tabular-nums">${eur2(gPreis)}</td>
    </tr>`;
  }).join("");

  const invNum = inv.invoiceNumber || `RG-${String(inv.id).padStart(4,"0")}`;
  const dateStr = inv.date ? new Date(inv.date).toLocaleDateString("de-DE") : "";
  const custName = customer?.name || "";
  const custAddress = customer?.address || "";
  const baustelle = inv.baustelle || "";
  const custNum = customer?.kundennr ? `#${customer.kundennr}` : (customer?.id ? String(customer.id).padStart(4,"0") : "");
  const greeting = customer?.salutation || "Sehr geehrte Damen und Herren";

  const html = `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8">
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 12.5px; color: #1a1a1a; background: #fff; }
.page { width: 210mm; margin: 0 auto; padding: 18mm 20mm 40mm 25mm; }
.header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10mm; }
.company-block { text-align: right; font-size: 11px; line-height: 1.75; color: #333; }
.company-block strong { font-size: 13px; color: #111; }
.sender-line { font-size: 9px; color: #888; border-bottom: 1px solid #ccc; padding-bottom: 3px; margin-bottom: 5mm; }
.addr-meta { display: flex; justify-content: space-between; margin-bottom: 10mm; }
.meta-block { text-align: right; font-size: 12px; line-height: 1.8; }
.meta-block .meta-label { color: #888; font-size: 10px; }
.meta-block .inv-num { font-size: 14px; font-weight: bold; margin-top: 4px; }
.inv-title { font-size: 22px; font-weight: bold; margin-bottom: 6mm; border-bottom: 2px solid #1a1a1a; padding-bottom: 2mm; }
.greeting { font-size: 12px; margin-bottom: 6mm; line-height: 1.6; }
table { width: 100%; border-collapse: collapse; margin-bottom: 0; }
thead tr { background: #f0f0f0; }
th { padding: 6px 8px; font-size: 11px; font-weight: 700; border-top: 1.5px solid #ccc; border-bottom: 1.5px solid #ccc; text-align: left; }
.totals-wrap { display: flex; justify-content: flex-end; margin-top: 6mm; margin-bottom: 6mm; }
.totals-table { width: 260px; font-size: 12px; border-collapse: collapse; }
.totals-table td { padding: 4px 6px; }
.totals-table td:last-child { text-align: right; font-weight: 600; }
.total-final { background: #1a1a1a; color: #fff; border-radius: 6px; display: flex; justify-content: space-between; padding: 10px 14px; font-size: 14px; font-weight: bold; margin-top: 4px; }
.closing { font-size: 12px; line-height: 1.8; margin-top: 8mm; margin-bottom: 8mm; }
.footer { position: fixed; bottom: 0; left: 0; width: 100%; padding: 4mm 20mm 5mm 25mm; border-top: 1px solid #ccc; display: flex; justify-content: space-between; font-size: 10px; color: #666; line-height: 1.7; background: #fff; }
.footer strong { color: #333; }
@media print {
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .footer { position: fixed; bottom: 0; }
}
@page { margin-bottom: 30mm; }
</style></head><body>
<div class="page">
  <div class="header">
    <div style="font-size:22px;font-weight:900;letter-spacing:-1px;color:#1a1a1a">MEZYAK<br><span style="font-size:12px;font-weight:400;letter-spacing:2px;color:#888">SCHREINEREI</span></div>
    <div class="company-block">
      <strong>Mezyak Schreinerei</strong><br>
      Zeilstraße 11<br>97464 Niederwerrn<br>
      Tel: ${COMPANY_PHONE}<br>${COMPANY_EMAIL}
    </div>
  </div>
  <div class="sender-line">Mezyak Schreinerei &nbsp;·&nbsp; Zeilstraße 11 &nbsp;·&nbsp; 97464 Niederwerrn</div>
  <div class="addr-meta">
    <div style="font-size:12px;line-height:1.8">
      ${baustelle ? `<div style="font-size:10px;color:#888">Baustelle</div><div>${baustelle.replace(/\n/g,"<br>")}</div><br>` : ""}
      ${custName ? `<strong>${custName}</strong><br>` : ""}
      ${custAddress ? custAddress.replace(/\n/g,"<br>") : ""}
    </div>
    <div class="meta-block">
      <div><span class="meta-label">Datum:</span> <strong>${dateStr}</strong></div>
      ${custNum ? `<div><span class="meta-label">Kunden-Nr:</span> <strong>${custNum}</strong></div>` : ""}
      <div class="inv-num">Rechnung ${invNum}</div>
    </div>
  </div>
  <div class="inv-title">Rechnung</div>
  <div class="greeting">${greeting},<br>hiermit stellen wir Ihnen die ausgeführten Arbeiten in Rechnung.</div>
  <table>
    <thead><tr>
      <th style="width:28px;text-align:center">Pos</th>
      <th style="width:65px;text-align:center">Menge</th>
      <th>Beschreibung</th>
      <th style="width:90px;text-align:right">E-Preis EUR</th>
      <th style="width:90px;text-align:right">G-Preis EUR</th>
    </tr></thead>
    <tbody>
      ${rows}
      <tr>
        <td colspan="4" style="text-align:right;padding:8px;border-top:1.5px solid #ccc;font-weight:600">Gesamtpreis</td>
        <td style="text-align:right;padding:8px;border-top:1.5px solid #ccc;font-weight:600;font-variant-numeric:tabular-nums">${eur2(netto)}</td>
      </tr>
    </tbody>
  </table>
  <div class="totals-wrap">
    <div>
      <table class="totals-table">
        <tr><td>Gesamtpreis Netto</td><td>${eur2(netto)} EUR</td></tr>
        ${inv.vatRate > 0
          ? `<tr><td>+ Mehrwertsteuer ${inv.vatRate},00%</td><td>${eur2(vatAmt)} EUR</td></tr>`
          : `<tr><td style="color:#888">Steuerbefreit (0%)</td><td>0,00 EUR</td></tr>`}
      </table>
      <div class="total-final"><span>Gesamtbetrag</span><span>${eur2(brutto)} EUR</span></div>
    </div>
  </div>
  <div class="closing">
    Wir hoffen, die Arbeiten zu Ihrer Zufriedenheit ausgeführt zu haben und würden uns freuen,<br>
    in Zukunft wieder für Sie arbeiten zu dürfen.<br><br>
    Mit freundlichen Grüßen<br><br>
    <strong>Mohamad Mezyak</strong><br>Mezyak Schreinerei
  </div>
  <div class="footer">
    <div><strong>Bankverbindung:</strong><br>${COMPANY_BANK}<br>IBAN: ${COMPANY_IBAN}</div>
    <div style="text-align:center"><strong>Mohamad Mezyak</strong><br>Tel: ${COMPANY_PHONE}<br>${COMPANY_EMAIL}</div>
  </div>
</div>
</body></html>`;

  const win = window.open("", "_blank");
  if (!win) { alert("Bitte Pop-ups erlauben und erneut versuchen"); return; }
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 800);
}

function load() {
  try {
    const r = localStorage.getItem(KEY);
    if (!r) return seed;
    const d = JSON.parse(r);
    if (!d.privateIncome) d.privateIncome = [];
    return d;
  } catch { return seed; }
}
function persist(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch {} }

const eur = (n) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n || 0);
const deFmt = (d) => d ? new Date(d).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "";
const today = () => new Date().toISOString().split("T")[0];

// ── DATE FILTER HELPERS ───────────────────────────────────
const PERIODS = ["Tag", "Woche", "Monat", "Jahr"];

function inPeriod(dateStr, period) {
  const d = new Date(dateStr);
  const now = new Date();
  if (period === "Tag") {
    return d.toDateString() === now.toDateString();
  }
  if (period === "Woche") {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
    start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23, 59, 59);
    return d >= start && d <= end;
  }
  if (period === "Monat") {
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }
  if (period === "Jahr") {
    return d.getFullYear() === now.getFullYear();
  }
  return true;
}

function periodLabel(period) {
  const now = new Date();
  if (period === "Tag") return now.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
  if (period === "Woche") {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
    const end = new Date(start); end.setDate(start.getDate() + 6);
    return `${start.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })} – ${end.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}`;
  }
  if (period === "Monat") return now.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
  if (period === "Jahr") return String(now.getFullYear());
  return "";
}

const TABS = ["Übersicht", "Rechnungen", "Kunden", "Kosten", "Privat", "Einst."];

// ── BACKUP HELPERS ────────────────────────────────────────
function exportData(data) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const date = new Date().toISOString().split("T")[0];
  a.href = url;
  a.download = `mohamad-mezyak-finanz-backup-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importData(file, onSuccess, onError) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      if (!parsed.invoices || !parsed.customers) throw new Error("Ungültige Datei");
      if (!parsed.privateIncome) parsed.privateIncome = [];
      onSuccess(parsed);
    } catch {
      onError();
    }
  };
  reader.readAsText(file);
}

const BACKUP_KEY = "mmfinanz_last_backup";
const BACKUP_DAYS = 7;

function daysSinceBackup() {
  const last = localStorage.getItem(BACKUP_KEY);
  if (!last) return 999;
  return Math.floor((Date.now() - new Date(last).getTime()) / (1000 * 60 * 60 * 24));
}

function markBackupNow() {
  localStorage.setItem(BACKUP_KEY, new Date().toISOString());
}

export default function App() {
  const [data, setData] = useState(load);
  const [tab, setTab] = useState(0);
  const [sheet, setSheet] = useState(null);
  const [period, setPeriod] = useState("Monat");
  const [toast, setToast] = useState(null);
  const [backupBanner, setBackupBanner] = useState(() => daysSinceBackup() >= BACKUP_DAYS);

  useEffect(() => persist(data), [data]);

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2800);
  };

  const handleBackupFromBanner = () => {
    exportData(data);
    markBackupNow();
    setBackupBanner(false);
    showToast("Backup gespeichert");
  };

  const set = (key, val) => setData(p => ({ ...p, [key]: val }));

  const filteredInvoices = useMemo(() =>
    data.invoices.filter(i => inPeriod(i.date, period)),
    [data.invoices, period]
  );

  const filteredExpenses = useMemo(() =>
    data.expenses.filter(e => inPeriod(e.date, period)),
    [data.expenses, period]
  );

  const filteredPrivateIncome = useMemo(() =>
    (data.privateIncome || []).filter(e => inPeriod(e.date, period)),
    [data.privateIncome, period]
  );

  const stats = useMemo(() => {
    let rev = 0, buy = 0, vat = 0;
    // Material
    let matSell = 0, matBuy = 0, matVat = 0;
    // Arbeit
    let arbHours = 0, arbSell = 0, arbVat = 0;

    filteredInvoices.forEach(i => {
      i.items.forEach(it => {
        if (it.kind === "arbeit") {
          const s = (parseFloat(it.hours)||0) * (parseFloat(it.rate)||0);
          arbSell += s;
          arbHours += parseFloat(it.hours) || 0;
          if (i.vatRate > 0) arbVat += s * (i.vatRate / 100);
          rev += s;
          if (i.vatRate > 0) vat += s * (i.vatRate / 100);
        } else {
          const s = (parseFloat(it.sell)||0) * (parseFloat(it.qty)||1);
          const b = (parseFloat(it.buy)||0) * (parseFloat(it.qty)||1);
          matSell += s; matBuy += b;
          if (i.vatRate > 0) matVat += s * (i.vatRate / 100);
          rev += s; buy += b;
          if (i.vatRate > 0) vat += s * (i.vatRate / 100);
        }
      });
    });

    const brutto = rev + vat;
    const matProfit = matSell - matBuy;           // Marge Material
    const matBrutto = matSell + matVat;           // Brutto Material
    const arbNetto = arbSell;                     // Netto Arbeit
    const arbBrutto = arbSell + arbVat;           // Brutto Arbeit
    const arbNettoAfterVat = arbSell - arbVat;    // Arbeit nach Steuer (was bleibt)

    const fixWork = data.fixedCosts.filter(c => c.section === "work").reduce((s, c) => s + c.amount, 0);
    const fixPriv = data.fixedCosts.filter(c => c.section === "private").reduce((s, c) => s + c.amount, 0);
    const varPriv = filteredExpenses.reduce((s, e) => s + e.amount, 0);
    const privIncome = filteredPrivateIncome.reduce((s, e) => s + e.amount, 0);
    const netProfit = period === "Monat" ? rev - buy - fixWork : rev - buy;
    const totalNettoProfit = matProfit + arbNetto;         // Gesamt Netto (Material Marge + Arbeit Netto)
    const totalBruttoProfit = matProfit + arbBrutto;       // Gesamt Brutto
    const totalPrivBalance = privIncome - fixPriv - varPriv;

    return {
      rev, buy, vat, brutto, margin: rev - buy, netProfit, fixWork, fixPriv, varPriv,
      privTotal: fixPriv + varPriv, privIncome, totalPrivBalance,
      matSell, matBuy, matVat, matProfit, matBrutto,
      arbHours, arbSell, arbVat, arbBrutto, arbNetto, arbNettoAfterVat,
      totalNettoProfit, totalBruttoProfit,
    };
  }, [filteredInvoices, filteredExpenses, filteredPrivateIncome, data.fixedCosts, period]);

  return (
    <div style={{ maxWidth: 430, margin: "0 auto", minHeight: "100vh", background: "#F7F5F2", fontFamily: "'Outfit', sans-serif", display: "flex", flexDirection: "column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600&family=Lora:ital@0;1&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
        body { background: #F7F5F2; }
        .field label { display: block; font-size: 11px; font-weight: 500; color: #999; text-transform: uppercase; letter-spacing: .7px; margin-bottom: 6px; }
        .field input, .field select { width: 100%; background: #fff; border: 1.5px solid #E8E4DF; border-radius: 10px; padding: 12px 14px; font-family: 'Outfit', sans-serif; font-size: 15px; color: #1a1a1a; outline: none; appearance: none; }
        .field input:focus, .field select:focus { border-color: #1a1a1a; }
        .btn-prim { width: 100%; background: #1a1a1a; color: #fff; border: none; border-radius: 12px; padding: 15px; font-family: 'Outfit', sans-serif; font-size: 15px; font-weight: 500; cursor: pointer; }
        .btn-ghost { background: none; border: 1.5px solid #E8E4DF; border-radius: 12px; padding: 12px; font-family: 'Outfit', sans-serif; font-size: 14px; color: #555; cursor: pointer; }
        .row { display: flex; align-items: center; justify-content: space-between; padding: 14px 0; border-bottom: 1px solid #EDEBE7; }
        .row:last-child { border-bottom: none; }
        .tag { display: inline-block; padding: 3px 9px; border-radius: 20px; font-size: 11px; font-weight: 500; }
        .tag-green { background: #E8F5EE; color: #1A7A45; }
        .tag-amber { background: #FEF3E2; color: #B45309; }
        .tag-red { background: #FEE8E8; color: #B91C1C; }
        .tag-grey { background: #F0EDEA; color: #666; }
        .card { background: #fff; border-radius: 16px; padding: 16px; margin-bottom: 12px; }
        .sheet-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.35); z-index: 50; display: flex; align-items: flex-end; }
        .sheet { background: #F7F5F2; border-radius: 20px 20px 0 0; width: 100%; max-height: 92vh; overflow-y: auto; padding: 0 0 40px; }
        .sheet-handle { width: 36px; height: 4px; background: #D8D4CF; border-radius: 2px; margin: 12px auto 20px; }
        .sheet-pad { padding: 0 20px; }
        .del-btn { background: none; border: none; color: #ccc; font-size: 18px; cursor: pointer; padding: 4px 8px; }
        .del-btn:hover { color: #B91C1C; }
        .check { width: 20px; height: 20px; accent-color: #1a1a1a; cursor: pointer; }
        .num-stat { font-family: 'Lora', Georgia, serif; font-size: 20px; color: #1a1a1a; }
        .lbl-stat { font-size: 11px; color: #999; font-weight: 500; text-transform: uppercase; letter-spacing: .7px; margin-bottom: 4px; }
        .add-btn { position: fixed; bottom: 76px; right: 50%; transform: translateX(calc(215px - 56px)); width: 52px; height: 52px; background: #1a1a1a; color: #fff; border: none; border-radius: 50%; font-size: 24px; cursor: pointer; box-shadow: 0 4px 16px rgba(0,0,0,.18); display: flex; align-items: center; justify-content: center; z-index: 10; }
        .bar { height: 6px; background: #EDEBE7; border-radius: 3px; overflow: hidden; margin-top: 6px; }
        .bar-fill { height: 100%; background: #1a1a1a; border-radius: 3px; }
        input[type=checkbox] { accent-color: #1a1a1a; }
        .period-bar { display: flex; background: #EDEBE7; border-radius: 10px; padding: 3px; gap: 2px; }
        .period-btn { flex: 1; border: none; border-radius: 8px; padding: 7px 4px; font-family: 'Outfit', sans-serif; font-size: 12px; font-weight: 500; cursor: pointer; transition: all .15s; background: transparent; color: #888; }
        .period-btn.active { background: #fff; color: #1a1a1a; box-shadow: 0 1px 4px rgba(0,0,0,.10); }
        .period-label { font-size: 11px; color: #aaa; text-align: center; margin-top: 6px; letter-spacing: .3px; }
        .divider-line { border: none; border-top: 1px solid #EDEBE7; margin: 12px 0; }
        .stat-row { display: flex; justify-content: space-between; align-items: center; padding: 9px 0; border-bottom: 1px solid #F5F3F0; }
        .stat-row:last-child { border-bottom: none; }
        .brutto-highlight { background: #1a1a1a; border-radius: 10px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: center; margin-top: 10px; }
        .toast { position: fixed; top: 24px; left: 50%; transform: translateX(-50%); padding: 12px 20px; border-radius: 10px; font-family: 'Outfit', sans-serif; font-size: 14px; font-weight: 500; z-index: 200; white-space: nowrap; box-shadow: 0 4px 20px rgba(0,0,0,.15); transition: opacity .3s; }
        .toast-ok { background: #1a1a1a; color: #fff; }
        .toast-err { background: #B91C1C; color: #fff; }
      `}</style>

      {/* Toast */}
      {toast && (
        <div className={`toast ${toast.ok ? "toast-ok" : "toast-err"}`}>{toast.msg}</div>
      )}

      {/* Backup reminder banner */}
      {backupBanner && (
        <div style={{
          position: "fixed", top: 0, left: "50%", transform: "translateX(-50%)",
          width: "100%", maxWidth: 430, zIndex: 100,
          background: "#1a1a1a", padding: "12px 16px",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
          boxShadow: "0 2px 12px rgba(0,0,0,.18)",
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>Backup empfohlen</div>
            <div style={{ fontSize: 11, color: "#aaa", marginTop: 1 }}>
              {daysSinceBackup() >= 999 ? "Noch kein Backup erstellt" : `Letztes Backup vor ${daysSinceBackup()} Tagen`}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button onClick={handleBackupFromBanner} style={{
              background: "#fff", color: "#1a1a1a", border: "none", borderRadius: 8,
              padding: "7px 14px", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}>Jetzt sichern</button>
            <button onClick={() => setBackupBanner(false)} style={{
              background: "none", color: "#888", border: "1.5px solid #333", borderRadius: 8,
              padding: "7px 10px", fontFamily: "'Outfit', sans-serif", fontSize: 13, cursor: "pointer",
            }}>Spater</button>
          </div>
        </div>
      )}

      {/* Top bar */}
      <div style={{ padding: backupBanner ? "96px 20px 12px" : "52px 20px 12px", background: "#F7F5F2", transition: "padding .2s" }}>
        <div style={{ fontSize: 11, fontWeight: 500, color: "#999", textTransform: "uppercase", letterSpacing: 1 }}>Mohamad Mezyak Finanz</div>
        <div style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 22, color: "#1a1a1a", marginTop: 2 }}>{TABS[tab]}</div>
      </div>

      {/* Period filter — shown on Overview and Rechnungen */}
      {(tab === 0 || tab === 1 || tab === 4) && (
        <div style={{ padding: "0 16px 10px" }}>
          <div className="period-bar">
            {PERIODS.map(p => (
              <button key={p} className={`period-btn ${period === p ? "active" : ""}`} onClick={() => setPeriod(p)}>{p}</button>
            ))}
          </div>
          <div className="period-label">{periodLabel(period)}</div>
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 16px 100px" }}>
        {tab === 0 && <Overview stats={stats} data={data} filteredInvoices={filteredInvoices} eur={eur} deFmt={deFmt} period={period} />}
        {tab === 1 && <Invoices data={data} set={set} sheet={sheet} setSheet={setSheet} eur={eur} deFmt={deFmt} filteredInvoices={filteredInvoices} />}
        {tab === 2 && <Customers data={data} set={set} sheet={sheet} setSheet={setSheet} />}
        {tab === 3 && <FixedCosts data={data} set={set} sheet={sheet} setSheet={setSheet} eur={eur} />}
        {tab === 4 && <Private data={data} set={set} sheet={sheet} setSheet={setSheet} eur={eur} deFmt={deFmt} filteredExpenses={filteredExpenses} filteredPrivateIncome={filteredPrivateIncome} stats={stats} />}
        {tab === 5 && <Settings data={data} setData={setData} showToast={showToast} onBackupDone={() => setBackupBanner(false)} />}
      </div>

      {/* Bottom nav */}
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: "#fff", borderTop: "1px solid #EDEBE7", display: "flex", paddingBottom: "env(safe-area-inset-bottom, 8px)" }}>
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)} style={{ flex: 1, background: "none", border: "none", padding: "10px 0 6px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
            <div style={{ width: 4, height: 4, borderRadius: "50%", background: tab === i ? "#1a1a1a" : "transparent", transition: "background .2s" }} />
            <span style={{ fontSize: 10, fontWeight: 500, color: tab === i ? "#1a1a1a" : "#aaa", letterSpacing: .3 }}>{t.toUpperCase()}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── OVERVIEW ──────────────────────────────────────────────
function StatRow({ label, sub, value, color, bold }) {
  return (
    <div className="stat-row">
      <div>
        <span style={{ fontSize: 14, color: bold ? "#1a1a1a" : "#555", fontWeight: bold ? 600 : 400 }}>{label}</span>
        {sub && <div style={{ fontSize: 11, color: "#bbb", marginTop: 1 }}>{sub}</div>}
      </div>
      <span style={{ fontSize: bold ? 16 : 15, fontWeight: bold ? 700 : 600, color: color || "#1a1a1a" }}>{value}</span>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 500, color: "#999", textTransform: "uppercase", letterSpacing: .7, margin: "14px 0 10px" }}>{children}</div>
  );
}

function Overview({ stats, data, filteredInvoices, eur, deFmt, period }) {
  const recent = [...filteredInvoices].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

  return (
    <div>

      {/* ── MATERIAL BLOCK ── */}
      <div className="card">
        <SectionTitle>🪵 Material</SectionTitle>
        <StatRow label="Verkauf (Netto)" value={eur(stats.matSell)} />
        <StatRow label="Einkauf" value={eur(stats.matBuy)} color="#B91C1C" />
        <StatRow label="MwSt. 19% auf Material" value={eur(stats.matVat)} color="#B45309" />
        <div style={{ background: "#F7F5F2", borderRadius: 10, padding: "10px 12px", marginTop: 10, display: "flex", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 11, color: "#aaa", marginBottom: 2 }}>Brutto Material</div>
            <div style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 18 }}>{eur(stats.matBrutto)}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: "#aaa", marginBottom: 2 }}>Gewinn (Marge)</div>
            <div style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 18, color: "#1A7A45" }}>{eur(stats.matProfit)}</div>
          </div>
        </div>
      </div>

      {/* ── ARBEIT BLOCK ── */}
      <div className="card">
        <SectionTitle>🔨 Arbeitsstunden</SectionTitle>
        <StatRow label="Stunden gearbeitet" value={`${stats.arbHours.toFixed(1)} Std.`} />
        <StatRow label="Netto (Arbeit)" value={eur(stats.arbNetto)} />
        <StatRow label="MwSt. 19% auf Arbeit" value={eur(stats.arbVat)} color="#B45309" />
        <StatRow label="Nach Steuer (Arbeit)" value={eur(stats.arbNettoAfterVat)} color="#1A7A45" />
        <div style={{ background: "#F7F5F2", borderRadius: 10, padding: "10px 12px", marginTop: 10, display: "flex", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 11, color: "#aaa", marginBottom: 2 }}>Brutto Arbeit</div>
            <div style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 18 }}>{eur(stats.arbBrutto)}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: "#aaa", marginBottom: 2 }}>Netto Arbeit</div>
            <div style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 18, color: "#1A7A45" }}>{eur(stats.arbNetto)}</div>
          </div>
        </div>
      </div>

      {/* ── GESAMT ── */}
      <div className="card">
        <SectionTitle>📊 Gesamt</SectionTitle>
        <StatRow label="Gesamtumsatz Netto" value={eur(stats.rev)} />
        <StatRow label="MwSt. gesamt (Finanzamt)" value={eur(stats.vat)} color="#B45309" />
        <StatRow label="Einkaufskosten" value={eur(stats.buy)} color="#B91C1C" />
        {period === "Monat" && <StatRow label="Fixkosten Geschäft" sub="pro Monat" value={eur(stats.fixWork)} color="#B91C1C" />}

        <div className="brutto-highlight" style={{ marginTop: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: "#aaa", fontWeight: 500, textTransform: "uppercase", letterSpacing: .7 }}>Brutto gesamt</div>
            <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>was Kunden zahlen</div>
          </div>
          <div style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 24, color: "#fff" }}>{eur(stats.brutto)}</div>
        </div>

        <hr className="divider-line" />
        <SectionTitle>💰 Gewinn</SectionTitle>
        <StatRow label="Material Gewinn" value={eur(stats.matProfit)} color="#1A7A45" />
        <StatRow label="Arbeit Netto" value={eur(stats.arbNetto)} color="#1A7A45" />
        <div style={{ background: "#E8F5EE", borderRadius: 10, padding: "10px 14px", marginTop: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 13, color: "#1A7A45", fontWeight: 500 }}>Gesamt Netto-Gewinn</span>
            <span style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 20, color: "#1A7A45" }}>{eur(stats.totalNettoProfit)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "#555" }}>Gesamt Brutto-Gewinn</span>
            <span style={{ fontSize: 16, fontWeight: 700 }}>{eur(stats.totalBruttoProfit)}</span>
          </div>
        </div>
      </div>

      {/* ── PRIVAT ── */}
      <div className="card">
        <SectionTitle>🏠 Privat</SectionTitle>
        {stats.privIncome > 0 && <StatRow label="Einkommen privat" value={eur(stats.privIncome)} color="#1A7A45" />}
        <StatRow label="Fixkosten" sub="pro Monat" value={eur(stats.fixPriv)} color="#B91C1C" />
        <StatRow label="Variable Ausgaben" value={eur(stats.varPriv)} color="#B91C1C" />
        {stats.privIncome > 0 && (
          <div style={{ background: stats.totalPrivBalance >= 0 ? "#E8F5EE" : "#FEE8E8", borderRadius: 10, padding: "10px 14px", marginTop: 8, display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: stats.totalPrivBalance >= 0 ? "#1A7A45" : "#B91C1C" }}>Privat Bilanz</span>
            <span style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 18, color: stats.totalPrivBalance >= 0 ? "#1A7A45" : "#B91C1C" }}>{eur(stats.totalPrivBalance)}</span>
          </div>
        )}
      </div>

      {/* ── RECENT INVOICES ── */}
      {recent.length > 0 && (
        <div className="card">
          <div style={{ fontSize: 11, fontWeight: 500, color: "#999", textTransform: "uppercase", letterSpacing: .7, marginBottom: 12 }}>Letzte Rechnungen</div>
          {recent.map(inv => {
            const cust = data.customers.find(c => c.id === inv.customerId);
            const netto = inv.items.reduce((s, i) => {
              if (i.kind === "arbeit") return s + (parseFloat(i.hours)||0)*(parseFloat(i.rate)||0);
              return s + (parseFloat(i.sell)||0)*(parseFloat(i.qty)||1);
            }, 0);
            const gross = netto * (1 + inv.vatRate / 100);
            return (
              <div className="row" key={inv.id}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{cust?.name || "-"}</div>
                  <div style={{ fontSize: 12, color: "#aaa", marginTop: 2 }}>{deFmt(inv.date)}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{eur(gross)}</div>
                  <span className={`tag ${inv.paid ? "tag-green" : "tag-red"}`}>{inv.paid ? "Bezahlt" : "Offen"}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {filteredInvoices.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: "24px 16px" }}>
          <div style={{ fontSize: 14, color: "#aaa" }}>Keine Rechnungen in diesem Zeitraum</div>
        </div>
      )}
    </div>
  );
}

// ── INVOICES ──────────────────────────────────────────────

// Compute the effective sell price for any item (material or labor)
function itemSell(it) {
  if (it.kind === "arbeit") {
    return (parseFloat(it.hours) || 0) * (parseFloat(it.rate) || 0);
  }
  return (parseFloat(it.sell) || 0) * (parseFloat(it.qty) || 1);
}
function itemBuy(it) {
  if (it.kind === "arbeit") return 0;
  return (parseFloat(it.buy) || 0) * (parseFloat(it.qty) || 1);
}

function PositionItem({ item, idx, setItem, removeItem, isLast, eur }) {
  const sell = itemSell(item);
  const buy = itemBuy(item);
  const margin = sell - buy;

  return (
    <div style={{ marginBottom: 14, paddingBottom: 14, borderBottom: !isLast ? "1px solid #EDEBE7" : "none" }}>

      {/* Type toggle */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {["material", "arbeit"].map(k => (
          <button key={k} onClick={() => setItem(idx, "kind", k)} style={{
            flex: 1, border: "1.5px solid", borderRadius: 8, padding: "8px 0",
            fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 500, cursor: "pointer",
            background: item.kind === k ? "#1a1a1a" : "transparent",
            borderColor: item.kind === k ? "#1a1a1a" : "#E8E4DF",
            color: item.kind === k ? "#fff" : "#888",
            transition: "all .15s",
          }}>
            {k === "material" ? "Material" : "Arbeit"}
          </button>
        ))}
        {idx > 0 && (
          <button onClick={() => removeItem(idx)} style={{ border: "1.5px solid #E8E4DF", borderRadius: 8, padding: "8px 10px", background: "transparent", color: "#ccc", cursor: "pointer", fontFamily: "'Outfit', sans-serif", fontSize: 14 }}>x</button>
        )}
      </div>

      {/* Description */}
      <div className="field" style={{ marginBottom: 8 }}>
        <label>Beschreibung</label>
        <input placeholder={item.kind === "arbeit" ? "z.B. Montage, Schreinerarbeit" : "z.B. Holz, Schrauben"} value={item.desc} onChange={e => setItem(idx, "desc", e.target.value)} />
      </div>

      {/* MATERIAL fields */}
      {item.kind !== "arbeit" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <div className="field">
            <label>Verkauf EUR</label>
            <input type="number" placeholder="200" value={item.sell} onChange={e => setItem(idx, "sell", e.target.value)} />
          </div>
          <div className="field">
            <label>Einkauf EUR</label>
            <input type="number" placeholder="150" value={item.buy} onChange={e => setItem(idx, "buy", e.target.value)} />
          </div>
          <div className="field">
            <label>Menge</label>
            <input type="number" placeholder="1" value={item.qty} onChange={e => setItem(idx, "qty", e.target.value)} />
          </div>
        </div>
      )}

      {/* ARBEIT fields */}
      {item.kind === "arbeit" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div className="field">
            <label>Stunden</label>
            <input type="number" placeholder="8" value={item.hours} onChange={e => setItem(idx, "hours", e.target.value)} />
          </div>
          <div className="field">
            <label>EUR / Stunde</label>
            <input type="number" placeholder="45" value={item.rate} onChange={e => setItem(idx, "rate", e.target.value)} />
          </div>
        </div>
      )}

      {/* Live result */}
      {sell > 0 && (
        <div style={{ marginTop: 10, background: "#F7F5F2", borderRadius: 8, padding: "8px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {item.kind === "arbeit" ? (
            <span style={{ fontSize: 12, color: "#666" }}>
              {item.hours || 0} Std. x {eur(parseFloat(item.rate) || 0)}
            </span>
          ) : (
            <span style={{ fontSize: 12, color: "#1A7A45", fontWeight: 500 }}>Marge: +{eur(margin)}</span>
          )}
          <span style={{ fontSize: 14, fontWeight: 700 }}>{eur(sell)}</span>
        </div>
      )}
    </div>
  );
}

function InvoiceSheet({ data, set, close, editing }) {
  const blankItem = { kind: "material", desc: "", sell: "", buy: "", qty: 1, hours: "", rate: "" };
  const blank = { customerId: data.customers[0]?.id || "", date: today(), vatRate: 19, paid: false, items: [{ ...blankItem }] };
  const [f, setF] = useState(editing ? { ...editing, items: editing.items.map(i => ({ kind: "material", hours: "", rate: "", ...i })) } : blank);

  const save = () => {
    const items = f.items.map(i => ({
      ...i,
      sell: i.kind === "arbeit" ? itemSell(i) : (parseFloat(i.sell) || 0),
      buy: i.kind === "arbeit" ? 0 : (parseFloat(i.buy) || 0),
      qty: i.kind === "arbeit" ? 1 : (parseFloat(i.qty) || 1),
    }));
    const inv = { ...f, customerId: parseInt(f.customerId), vatRate: parseInt(f.vatRate), items };
    if (editing) set("invoices", data.invoices.map(x => x.id === editing.id ? { ...inv, id: editing.id } : x));
    else set("invoices", [...data.invoices, { ...inv, id: Date.now() }]);
    close();
  };

  const setItem = (idx, key, val) => {
    const items = f.items.map((it, i) => i === idx ? { ...it, [key]: val } : it);
    setF({ ...f, items });
  };
  const removeItem = (idx) => setF({ ...f, items: f.items.filter((_, i) => i !== idx) });

  const totalNetto = f.items.reduce((s, i) => s + itemSell(i), 0);
  const totalBuy = f.items.reduce((s, i) => s + itemBuy(i), 0);
  const totalVat = totalNetto * (parseInt(f.vatRate) / 100);
  const totalBrutto = totalNetto + totalVat;

  return (
    <div className="sheet-pad">
      <div style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 20, marginBottom: 20 }}>{editing ? "Rechnung bearbeiten" : "Neue Rechnung"}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="field">
          <label>Kunde</label>
          <select value={f.customerId} onChange={e => setF({ ...f, customerId: e.target.value })}>
            {data.customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="field">
            <label>Datum</label>
            <input type="date" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} />
          </div>
          <div className="field">
            <label>MwSt.</label>
            <select value={f.vatRate} onChange={e => setF({ ...f, vatRate: e.target.value })}>
              <option value={19}>19%</option>
              <option value={7}>7%</option>
              <option value={0}>0%</option>
            </select>
          </div>
        </div>

        <div style={{ background: "#fff", borderRadius: 12, padding: 14, border: "1.5px solid #E8E4DF" }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: "#999", textTransform: "uppercase", letterSpacing: .7, marginBottom: 12 }}>Positionen</div>
          {f.items.map((item, idx) => (
            <PositionItem key={idx} item={item} idx={idx} setItem={setItem} removeItem={removeItem} isLast={idx === f.items.length - 1} eur={eur} />
          ))}
          <button className="btn-ghost" style={{ width: "100%", marginTop: 4 }} onClick={() => setF({ ...f, items: [...f.items, { ...blankItem }] })}>+ Position</button>
        </div>

        {/* Live summary */}
        {totalNetto > 0 && (
          <div style={{ background: "#F7F5F2", borderRadius: 12, padding: 14, border: "1.5px solid #E8E4DF" }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: "#999", textTransform: "uppercase", letterSpacing: .7, marginBottom: 10 }}>Zusammenfassung</div>
            {[
              ["Netto", totalNetto, "#1a1a1a"],
              ["MwSt. " + f.vatRate + "%", totalVat, "#B45309"],
              ["Marge", totalNetto - totalBuy, "#1A7A45"],
            ].map(([l, v, c]) => (
              <div key={l} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: "#666" }}>{l}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: c }}>{eur(v)}</span>
              </div>
            ))}
            <div style={{ background: "#1a1a1a", borderRadius: 8, padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
              <span style={{ fontSize: 13, color: "#aaa" }}>Brutto</span>
              <span style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 20, color: "#fff" }}>{eur(totalBrutto)}</span>
            </div>
          </div>
        )}

        <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 15, fontWeight: 400, cursor: "pointer" }}>
          <input type="checkbox" className="check" checked={f.paid} onChange={e => setF({ ...f, paid: e.target.checked })} />
          Bereits bezahlt
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="field">
            <label>Rechnungs-Nr. (optional)</label>
            <input placeholder={`RG-${String(Date.now()).slice(-4)}`} value={f.invoiceNumber||""} onChange={e => setF({ ...f, invoiceNumber: e.target.value })} />
          </div>
          <div className="field">
            <label>Baustelle (optional)</label>
            <input placeholder="z.B. Küche, Musterstr. 5" value={f.baustelle||""} onChange={e => setF({ ...f, baustelle: e.target.value })} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <button className="btn-prim" onClick={save}>Speichern</button>
          <button className="btn-ghost" style={{ minWidth: 90 }} onClick={close}>Abbrechen</button>
        </div>
      </div>
    </div>
  );
}

// ── CALENDAR ─────────────────────────────────────────────
const WDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const MONTHS_DE = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];

function invNetto(inv) {
  return inv.items.reduce((s, it) => s + (it.kind === "arbeit" ? (parseFloat(it.sell)||0) : (parseFloat(it.sell)||0)*(parseFloat(it.qty)||1)), 0);
}
function invGross(inv) { return invNetto(inv) * (1 + inv.vatRate / 100); }

function Calendar({ invoices, onSelectDay, selectedDay }) {
  const [cursor, setCursor] = useState(() => { const n = new Date(); return { y: n.getFullYear(), m: n.getMonth() }; });

  const { y, m } = cursor;
  const firstDay = new Date(y, m, 1);
  const lastDay = new Date(y, m + 1, 0);
  // start grid on Monday
  let startOffset = firstDay.getDay() - 1; if (startOffset < 0) startOffset = 6;
  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) cells.push(d);

  // build map: date-string -> total brutto
  const dayMap = {};
  invoices.forEach(inv => {
    const k = inv.date;
    if (!k) return;
    const [iy, im] = k.split("-").map(Number);
    if (iy === y && im - 1 === m) {
      dayMap[k] = (dayMap[k] || 0) + invGross(inv);
    }
  });

  const todayStr = new Date().toISOString().split("T")[0];

  return (
    <div className="card" style={{ marginBottom: 12, padding: "14px 10px" }}>
      {/* Month nav */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, padding: "0 4px" }}>
        <button onClick={() => setCursor(c => c.m === 0 ? { y: c.y-1, m: 11 } : { y: c.y, m: c.m-1 })}
          style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#555", padding: "0 6px" }}>{"<"}</button>
        <span style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 16 }}>{MONTHS_DE[m]} {y}</span>
        <button onClick={() => setCursor(c => c.m === 11 ? { y: c.y+1, m: 0 } : { y: c.y, m: c.m+1 })}
          style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#555", padding: "0 6px" }}>{">"}</button>
      </div>

      {/* Weekday headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 6 }}>
        {WDAYS.map(d => (
          <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 600, color: "#bbb", letterSpacing: .5, padding: "2px 0" }}>{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const dateStr = `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
          const total = dayMap[dateStr] || 0;
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedDay;
          const hasInv = total > 0;

          return (
            <button key={i} onClick={() => onSelectDay(dateStr === selectedDay ? null : dateStr)} style={{
              border: "none", borderRadius: 8, padding: "6px 2px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
              background: isSelected ? "#1a1a1a" : isToday ? "#F0EDEA" : "transparent",
              outline: "none",
            }}>
              <span style={{ fontSize: 13, fontWeight: isToday || isSelected ? 700 : 400, color: isSelected ? "#fff" : isToday ? "#1a1a1a" : "#333" }}>{d}</span>
              {hasInv && (
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: isSelected ? "#fff" : "#1A7A45", display: "block" }} />
              )}
              {!hasInv && <span style={{ width: 5, height: 5 }} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function InvoiceCard({ inv, data, onEdit, onDelete, onTogglePaid, eur, deFmt }) {
  const cust = data.customers.find(c => c.id === inv.customerId);
  const netto = invNetto(inv);
  const margin = inv.items.reduce((s, i) => s + (i.kind === "arbeit" ? 0 : ((parseFloat(i.sell)||0)-(parseFloat(i.buy)||0))*(parseFloat(i.qty)||1)), 0);
  const gross = invGross(inv);
  return (
    <div className="card" onClick={onEdit} style={{ cursor: "pointer" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 500 }}>{cust?.name || "-"}</div>
          <div style={{ fontSize: 12, color: "#aaa", marginTop: 2 }}>{deFmt(inv.date)} · {inv.items.map(i => i.kind === "arbeit" ? `${i.desc||"Arbeit"} (${i.hours||0}Std.)` : i.desc).join(", ").slice(0, 32)}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: "#aaa" }}>Brutto</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{eur(gross)}</div>
          <div style={{ fontSize: 12, color: "#888" }}>Netto {eur(netto)}</div>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 6 }}>
          <span className={`tag ${inv.vatRate > 0 ? "tag-amber" : "tag-grey"}`}>{inv.vatRate}% MwSt.</span>
          {margin > 0 && <span style={{ fontSize: 12, color: "#1A7A45", fontWeight: 500, padding: "3px 0" }}>+{eur(margin)}</span>}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }} onClick={e => e.stopPropagation()}>
            <button onClick={() => generateInvoicePDF(inv, cust)} style={{
              background: "#1a1a1a", color: "#fff", border: "none", borderRadius: 8,
              padding: "5px 10px", fontSize: 12, fontWeight: 500, cursor: "pointer"
            }}>PDF</button>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#555", cursor: "pointer" }}>
              <input type="checkbox" className="check" style={{ width: 16, height: 16 }} checked={inv.paid} onChange={onTogglePaid} />
              Bezahlt
            </label>
            <button className="del-btn" onClick={onDelete}>x</button>
          </div>
      </div>
    </div>
  );
}

function Invoices({ data, set, sheet, setSheet, eur, deFmt, filteredInvoices }) {
  const [selectedDay, setSelectedDay] = useState(null);

  const del = (id) => set("invoices", data.invoices.filter(i => i.id !== id));
  const togglePaid = (id) => set("invoices", data.invoices.map(i => i.id === id ? { ...i, paid: !i.paid } : i));

  // If a day is selected, show only that day. Otherwise show filteredInvoices.
  const displayed = selectedDay
    ? data.invoices.filter(i => i.date === selectedDay).sort((a, b) => a.id - b.id)
    : [...filteredInvoices].sort((a, b) => new Date(b.date) - new Date(a.date));

  const totNetto = displayed.reduce((s, i) => s + invNetto(i), 0);
  const totVat = displayed.reduce((s, i) => s + invNetto(i) * (i.vatRate / 100), 0);
  const totBrutto = totNetto + totVat;
  const totMargin = displayed.reduce((s, i) => s + i.items.reduce((ss, it) => ss + (it.kind === "arbeit" ? 0 : ((parseFloat(it.sell)||0)-(parseFloat(it.buy)||0))*(parseFloat(it.qty)||1)), 0), 0);

  const selectedLabel = selectedDay
    ? new Date(selectedDay).toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })
    : null;

  return (
    <div>
      {sheet?.type === "invoice" && (
        <div className="sheet-overlay">
          <div className="sheet">
            <div className="sheet-handle" />
            <InvoiceSheet data={data} set={set} close={() => setSheet(null)} editing={sheet.payload} />
          </div>
        </div>
      )}
      <button className="add-btn" onClick={() => setSheet({ type: "invoice", payload: null })}>+</button>

      {/* Calendar */}
      <Calendar invoices={data.invoices} onSelectDay={setSelectedDay} selectedDay={selectedDay} />

      {/* Selected day header */}
      {selectedDay && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: "#1a1a1a" }}>{selectedLabel}</div>
          <button onClick={() => setSelectedDay(null)} style={{ background: "none", border: "1.5px solid #E8E4DF", borderRadius: 8, padding: "4px 10px", fontSize: 12, color: "#888", cursor: "pointer" }}>Alle zeigen</button>
        </div>
      )}

      {/* Totals card */}
      {displayed.length > 0 && (
        <div className="card">
          <div style={{ fontSize: 11, fontWeight: 500, color: "#999", textTransform: "uppercase", letterSpacing: .7, marginBottom: 10 }}>
            {selectedDay ? "Tag gesamt" : "Zeitraum gesamt"}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[["Netto", totNetto, "#1a1a1a"], ["MwSt.", totVat, "#B45309"], ["Marge", totMargin, "#1A7A45"]].map(([l, v, c]) => (
              <div key={l}>
                <div style={{ fontSize: 11, color: "#aaa", marginBottom: 2 }}>{l}</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: c }}>{eur(v)}</div>
              </div>
            ))}
            <div>
              <div style={{ fontSize: 11, color: "#aaa", marginBottom: 2 }}>Brutto</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{eur(totBrutto)}</div>
            </div>
          </div>
        </div>
      )}

      {displayed.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: "24px 16px" }}>
          <div style={{ fontSize: 14, color: "#aaa" }}>
            {selectedDay ? "Keine Rechnungen an diesem Tag" : "Keine Rechnungen in diesem Zeitraum"}
          </div>
        </div>
      )}

      {displayed.map(inv => (
        <InvoiceCard key={inv.id} inv={inv} data={data} eur={eur} deFmt={deFmt}
          onEdit={() => setSheet({ type: "invoice", payload: inv })}
          onDelete={(e) => { e.stopPropagation(); del(inv.id); }}
          onTogglePaid={() => togglePaid(inv.id)}
        />
      ))}
    </div>
  );
}

// ── CUSTOMERS ─────────────────────────────────────────────
function CustSheet({ data, set, close, editing }) {
  const nextKundennr = () => {
    const nums = data.customers.map(c => parseInt(c.kundennr || "0")).filter(n => !isNaN(n));
    return String(nums.length ? Math.max(...nums) + 1 : 1001).padStart(4, "0");
  };
  const blank = { name: "", phone: "", email: "", ansprechpartner: "", kundennr: nextKundennr(), type: "private", alwaysZeroVat: false, note: "" };
  const [f, setF] = useState(() => editing ? { email: "", ansprechpartner: "", kundennr: "", ...editing } : blank);
  const save = () => {
    if (!f.name.trim()) return;
    if (editing) set("customers", data.customers.map(c => c.id === editing.id ? { ...f, id: editing.id } : c));
    else set("customers", [...data.customers, { ...f, id: Date.now() }]);
    close();
  };
  return (
    <div className="sheet-pad">
      <div style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 20, marginBottom: 20 }}>{editing ? "Kunde bearbeiten" : "Neuer Kunde"}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", gap: 10 }}>
          <div className="field" style={{ flex: 2 }}>
            <label>Name *</label>
            <input placeholder="Max Mustermann" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Kunden-Nr.</label>
            <input placeholder="1001" value={f.kundennr} onChange={e => setF({ ...f, kundennr: e.target.value })} />
          </div>
        </div>
        <div className="field">
          <label>Ansprechpartner</label>
          <input placeholder="Herr Müller, Frau Schmidt..." value={f.ansprechpartner} onChange={e => setF({ ...f, ansprechpartner: e.target.value })} />
        </div>
        <div className="field">
          <label>Telefon</label>
          <input type="tel" placeholder="0151-..." value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} />
        </div>
        <div className="field">
          <label>E-Mail</label>
          <input type="email" placeholder="max@beispiel.de" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} />
        </div>
        <div className="field">
          <label>Typ</label>
          <select value={f.type} onChange={e => setF({ ...f, type: e.target.value })}>
            <option value="private">Privat</option>
            <option value="business">Firma</option>
          </select>
        </div>
        <div className="field">
          <label>Adresse</label>
          <input placeholder="Straße, PLZ Ort" value={f.address||""} onChange={e => setF({ ...f, address: e.target.value })} />
        </div>
        <div className="field">
          <label>Anrede (für PDF)</label>
          <input placeholder="Sehr geehrter Herr Mezyak" value={f.salutation||""} onChange={e => setF({ ...f, salutation: e.target.value })} />
        </div>
        <div className="field">
          <label>Notiz</label>
          <input placeholder="Freund, Stammkunde..." value={f.note} onChange={e => setF({ ...f, note: e.target.value })} />
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 15, cursor: "pointer" }}>
          <input type="checkbox" className="check" checked={f.alwaysZeroVat} onChange={e => setF({ ...f, alwaysZeroVat: e.target.checked })} />
          Immer 0% MwSt.
        </label>
        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <button className="btn-prim" onClick={save}>Speichern</button>
          <button className="btn-ghost" style={{ minWidth: 90 }} onClick={close}>Abbrechen</button>
        </div>
      </div>
    </div>
  );
}

function Customers({ data, set, sheet, setSheet }) {
  const del = (id) => set("customers", data.customers.filter(c => c.id !== id));
  return (
    <div>
      {sheet?.type === "customer" && (
        <div className="sheet-overlay">
          <div className="sheet">
            <div className="sheet-handle" />
            <CustSheet data={data} set={set} close={() => setSheet(null)} editing={sheet.payload} />
          </div>
        </div>
      )}
      <button className="add-btn" onClick={() => setSheet({ type: "customer", payload: null })}>+</button>
      {data.customers.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: "24px 16px" }}>
          <div style={{ fontSize: 14, color: "#aaa" }}>Noch keine Kunden eingetragen</div>
        </div>
      )}
      {data.customers.map(c => {
        const count = data.invoices.filter(i => i.customerId === c.id).length;
        const total = data.invoices.filter(i => i.customerId === c.id).reduce((s, inv) => s + invNetto(inv), 0);
        return (
          <div className="card" key={c.id} onClick={() => setSheet({ type: "customer", payload: c })} style={{ cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{c.name}</span>
                  {c.kundennr && <span style={{ fontSize: 11, color: "#aaa", background: "#F5F3F0", borderRadius: 6, padding: "2px 7px" }}>#{c.kundennr}</span>}
                </div>
                {c.ansprechpartner && (
                  <div style={{ fontSize: 12, color: "#666", marginTop: 3 }}>👤 {c.ansprechpartner}</div>
                )}
                <div style={{ fontSize: 12, color: "#aaa", marginTop: 3, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {c.phone && <span>📞 {c.phone}</span>}
                  {c.email && <span>✉ {c.email}</span>}
                </div>
                {c.note && <div style={{ fontSize: 11, color: "#bbb", marginTop: 3 }}>{c.note}</div>}
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0, marginLeft: 10 }} onClick={e => e.stopPropagation()}>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  {c.alwaysZeroVat && <span className="tag tag-green">0%</span>}
                  <span className="tag tag-grey">{count} Rg.</span>
                  <button className="del-btn" onClick={() => del(c.id)}>x</button>
                </div>
                {total > 0 && <span style={{ fontSize: 12, color: "#1A7A45", fontWeight: 500 }}>{eur(total)} Netto</span>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── FIXED COSTS ───────────────────────────────────────────
function CostSheet({ data, set, close, editing }) {
  const blank = { name: "", amount: "", section: "work" };
  const [f, setF] = useState(editing || blank);
  const save = () => {
    const c = { ...f, amount: parseFloat(f.amount) || 0 };
    if (editing) set("fixedCosts", data.fixedCosts.map(x => x.id === editing.id ? { ...c, id: editing.id } : x));
    else set("fixedCosts", [...data.fixedCosts, { ...c, id: Date.now() }]);
    close();
  };
  return (
    <div className="sheet-pad">
      <div style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 20, marginBottom: 20 }}>{editing ? "Bearbeiten" : "Neue Fixkosten"}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="field">
          <label>Bereich</label>
          <select value={f.section} onChange={e => setF({ ...f, section: e.target.value })}>
            <option value="work">Geschäft</option>
            <option value="private">Privat</option>
          </select>
        </div>
        <div className="field">
          <label>Bezeichnung</label>
          <input placeholder="Werkstattmiete" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} />
        </div>
        <div className="field">
          <label>Betrag pro Monat (EUR)</label>
          <input type="number" placeholder="500" value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} />
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <button className="btn-prim" onClick={save}>Speichern</button>
          <button className="btn-ghost" style={{ minWidth: 90 }} onClick={close}>Abbrechen</button>
        </div>
      </div>
    </div>
  );
}

function FixedCosts({ data, set, sheet, setSheet, eur }) {
  const del = (id) => set("fixedCosts", data.fixedCosts.filter(c => c.id !== id));
  const workCosts = data.fixedCosts.filter(c => c.section === "work");
  const privCosts = data.fixedCosts.filter(c => c.section === "private");
  const workTotal = workCosts.reduce((s, c) => s + c.amount, 0);
  const privTotal = privCosts.reduce((s, c) => s + c.amount, 0);
  return (
    <div>
      {sheet?.type === "cost" && (
        <div className="sheet-overlay">
          <div className="sheet">
            <div className="sheet-handle" />
            <CostSheet data={data} set={set} close={() => setSheet(null)} editing={sheet.payload} />
          </div>
        </div>
      )}
      <button className="add-btn" onClick={() => setSheet({ type: "cost", payload: null })}>+</button>
      {[["Geschäft", workCosts, workTotal], ["Privat", privCosts, privTotal]].map(([title, costs, total]) => (
        <div key={title}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0 8px" }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: "#999", textTransform: "uppercase", letterSpacing: .7 }}>{title}</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#B91C1C" }}>{eur(total)}/Monat</div>
          </div>
          <div className="card">
            {costs.map(c => (
              <div className="row" key={c.id} onClick={() => setSheet({ type: "cost", payload: c })} style={{ cursor: "pointer" }}>
                <span style={{ fontSize: 15 }}>{c.name}</span>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }} onClick={e => e.stopPropagation()}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: "#B91C1C" }}>{eur(c.amount)}</span>
                  <button className="del-btn" onClick={() => del(c.id)}>x</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── PRIVATE ───────────────────────────────────────────────
const EXP_CATS = ["Lebensmittel", "Restaurant", "Transport", "Kleidung", "Gesundheit", "Freizeit", "Urlaub", "Sonstiges"];
const INC_CATS = ["Kindergeld", "Gehalt/Lohn", "Unterhalt", "Rente", "Nebenjob", "Steuerrückerstattung", "Sonstiges"];

function ExpSheet({ data, set, close, editing }) {
  const blank = { date: today(), desc: "", amount: "", cat: "Lebensmittel" };
  const [f, setF] = useState(editing || blank);
  const save = () => {
    const e = { ...f, amount: parseFloat(f.amount) || 0 };
    if (editing) set("expenses", data.expenses.map(x => x.id === editing.id ? { ...e, id: editing.id } : x));
    else set("expenses", [...data.expenses, { ...e, id: Date.now() }]);
    close();
  };
  return (
    <div className="sheet-pad">
      <div style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 20, marginBottom: 20 }}>{editing ? "Bearbeiten" : "Neue Ausgabe"}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="field"><label>Datum</label><input type="date" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} /></div>
        <div className="field"><label>Beschreibung</label><input placeholder="Rewe, Tanken..." value={f.desc} onChange={e => setF({ ...f, desc: e.target.value })} /></div>
        <div className="field"><label>Betrag (EUR)</label><input type="number" placeholder="85" value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} /></div>
        <div className="field">
          <label>Kategorie</label>
          <select value={f.cat} onChange={e => setF({ ...f, cat: e.target.value })}>
            {EXP_CATS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <button className="btn-prim" onClick={save}>Speichern</button>
          <button className="btn-ghost" style={{ minWidth: 90 }} onClick={close}>Abbrechen</button>
        </div>
      </div>
    </div>
  );
}

function IncomeSheet({ data, set, close, editing }) {
  const blank = { date: today(), desc: "", amount: "", cat: "Kindergeld", recurring: false };
  const [f, setF] = useState(editing || blank);
  const save = () => {
    const e = { ...f, amount: parseFloat(f.amount) || 0 };
    const list = data.privateIncome || [];
    if (editing) set("privateIncome", list.map(x => x.id === editing.id ? { ...e, id: editing.id } : x));
    else set("privateIncome", [...list, { ...e, id: Date.now() }]);
    close();
  };
  return (
    <div className="sheet-pad">
      <div style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 20, marginBottom: 20 }}>{editing ? "Bearbeiten" : "Neues Einkommen"}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="field"><label>Datum</label><input type="date" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} /></div>
        <div className="field"><label>Beschreibung</label><input placeholder="z.B. Kindergeld Jan." value={f.desc} onChange={e => setF({ ...f, desc: e.target.value })} /></div>
        <div className="field"><label>Betrag (EUR)</label><input type="number" placeholder="255" value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} /></div>
        <div className="field">
          <label>Kategorie</label>
          <select value={f.cat} onChange={e => setF({ ...f, cat: e.target.value })}>
            {INC_CATS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 0" }}>
          <input type="checkbox" className="check" id="rec" checked={!!f.recurring} onChange={e => setF({ ...f, recurring: e.target.checked })} />
          <label htmlFor="rec" style={{ fontSize: 14, color: "#555", cursor: "pointer" }}>Wiederkehrend (monatlich)</label>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <button className="btn-prim" onClick={save}>Speichern</button>
          <button className="btn-ghost" style={{ minWidth: 90 }} onClick={close}>Abbrechen</button>
        </div>
      </div>
    </div>
  );
}

function Private({ data, set, sheet, setSheet, eur, deFmt, filteredExpenses, filteredPrivateIncome, stats }) {
  const [subTab, setSubTab] = useState("ausgaben");
  const delExp = (id) => set("expenses", data.expenses.filter(e => e.id !== id));
  const delInc = (id) => set("privateIncome", (data.privateIncome || []).filter(e => e.id !== id));

  const sortedExp = [...filteredExpenses].sort((a, b) => new Date(b.date) - new Date(a.date));
  const sortedInc = [...filteredPrivateIncome].sort((a, b) => new Date(b.date) - new Date(a.date));
  const totalExp = filteredExpenses.reduce((s, e) => s + e.amount, 0);
  const totalInc = filteredPrivateIncome.reduce((s, e) => s + e.amount, 0);
  const bycat = EXP_CATS.map(cat => ({ cat, val: filteredExpenses.filter(e => e.cat === cat).reduce((s, e) => s + e.amount, 0) })).filter(x => x.val > 0).sort((a, b) => b.val - a.val);
  const byIncCat = INC_CATS.map(cat => ({ cat, val: filteredPrivateIncome.filter(e => e.cat === cat).reduce((s, e) => s + e.amount, 0) })).filter(x => x.val > 0).sort((a, b) => b.val - a.val);

  return (
    <div>
      {sheet?.type === "expense" && (
        <div className="sheet-overlay">
          <div className="sheet">
            <div className="sheet-handle" />
            <ExpSheet data={data} set={set} close={() => setSheet(null)} editing={sheet.payload} />
          </div>
        </div>
      )}
      {sheet?.type === "privateincome" && (
        <div className="sheet-overlay">
          <div className="sheet">
            <div className="sheet-handle" />
            <IncomeSheet data={data} set={set} close={() => setSheet(null)} editing={sheet.payload} />
          </div>
        </div>
      )}

      {/* Sub-tab switcher */}
      <div style={{ display: "flex", background: "#EDEBE7", borderRadius: 10, padding: 3, gap: 2, marginBottom: 14 }}>
        {[["ausgaben", "Ausgaben"], ["einkommen", "Einkommen"]].map(([key, label]) => (
          <button key={key} onClick={() => setSubTab(key)} style={{
            flex: 1, border: "none", borderRadius: 8, padding: "9px 4px",
            fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 500, cursor: "pointer",
            background: subTab === key ? "#fff" : "transparent",
            color: subTab === key ? "#1a1a1a" : "#888",
            boxShadow: subTab === key ? "0 1px 4px rgba(0,0,0,.10)" : "none",
            transition: "all .15s",
          }}>{label}</button>
        ))}
      </div>

      {subTab === "ausgaben" && (
        <>
          <button className="add-btn" onClick={() => setSheet({ type: "expense", payload: null })}>+</button>
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="lbl-stat">Variable Ausgaben</div>
            <div style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 26 }}>{eur(totalExp)}</div>
            {bycat.length > 0 && (
              <div style={{ marginTop: 16 }}>
                {bycat.map(({ cat, val }) => (
                  <div key={cat} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: "#666" }}>{cat}</span>
                      <span style={{ fontSize: 12, fontWeight: 500 }}>{eur(val)}</span>
                    </div>
                    <div className="bar"><div className="bar-fill" style={{ width: `${Math.min((val / (totalExp || 1)) * 100, 100)}%` }} /></div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {sortedExp.length === 0 && (
            <div className="card" style={{ textAlign: "center", padding: "24px 16px" }}>
              <div style={{ fontSize: 14, color: "#aaa" }}>Keine Ausgaben in diesem Zeitraum</div>
            </div>
          )}
          {sortedExp.map(e => (
            <div className="card" key={e.id} onClick={() => setSheet({ type: "expense", payload: e })} style={{ cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 500 }}>{e.desc}</div>
                  <div style={{ fontSize: 12, color: "#aaa", marginTop: 2 }}>{deFmt(e.date)} · {e.cat}</div>
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }} onClick={ev => ev.stopPropagation()}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: "#B91C1C" }}>{eur(e.amount)}</span>
                  <button className="del-btn" onClick={() => delExp(e.id)}>x</button>
                </div>
              </div>
            </div>
          ))}
        </>
      )}

      {subTab === "einkommen" && (
        <>
          <button className="add-btn" onClick={() => setSheet({ type: "privateincome", payload: null })}>+</button>

          {/* Summary card */}
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="lbl-stat">Privates Einkommen</div>
            <div style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 26, color: "#1A7A45" }}>{eur(totalInc)}</div>
            {byIncCat.length > 0 && (
              <div style={{ marginTop: 16 }}>
                {byIncCat.map(({ cat, val }) => (
                  <div key={cat} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: "#666" }}>{cat}</span>
                      <span style={{ fontSize: 12, fontWeight: 500, color: "#1A7A45" }}>{eur(val)}</span>
                    </div>
                    <div className="bar"><div className="bar-fill" style={{ width: `${Math.min((val / (totalInc || 1)) * 100, 100)}%`, background: "#1A7A45" }} /></div>
                  </div>
                ))}
              </div>
            )}
            {totalInc > 0 && (
              <>
                <hr className="divider-line" />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0" }}>
                  <span style={{ fontSize: 13, color: "#888" }}>Ausgaben (variabel)</span>
                  <span style={{ fontSize: 13, color: "#B91C1C" }}>− {eur(totalExp)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0" }}>
                  <span style={{ fontSize: 13, color: "#888" }}>Fixkosten (Monat)</span>
                  <span style={{ fontSize: 13, color: "#B91C1C" }}>− {eur(stats.fixPriv)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: stats.totalPrivBalance >= 0 ? "#E8F5EE" : "#FEE8E8", borderRadius: 10, marginTop: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: stats.totalPrivBalance >= 0 ? "#1A7A45" : "#B91C1C" }}>Privat Bilanz</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: stats.totalPrivBalance >= 0 ? "#1A7A45" : "#B91C1C" }}>{eur(stats.totalPrivBalance)}</span>
                </div>
              </>
            )}
          </div>

          {sortedInc.length === 0 && (
            <div className="card" style={{ textAlign: "center", padding: "24px 16px" }}>
              <div style={{ fontSize: 14, color: "#aaa" }}>Noch kein Einkommen eingetragen</div>
              <div style={{ fontSize: 12, color: "#ccc", marginTop: 6 }}>Kindergeld, Lohn, Unterhalt usw.</div>
            </div>
          )}

          {sortedInc.map(e => (
            <div className="card" key={e.id} onClick={() => setSheet({ type: "privateincome", payload: e })} style={{ cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 500 }}>{e.desc}</div>
                  <div style={{ fontSize: 12, color: "#aaa", marginTop: 2 }}>
                    {deFmt(e.date)} · {e.cat}
                    {e.recurring && <span style={{ marginLeft: 6, background: "#E8F0FE", color: "#3B5EDB", borderRadius: 6, padding: "1px 7px", fontSize: 10, fontWeight: 600 }}>↻ monatlich</span>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }} onClick={ev => ev.stopPropagation()}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: "#1A7A45" }}>{eur(e.amount)}</span>
                  <button className="del-btn" onClick={() => delInc(e.id)}>x</button>
                </div>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
// ── SETTINGS ─────────────────────────────────────────────
function Settings({ data, setData, showToast, onBackupDone }) {
  const [confirmReset, setConfirmReset] = useState(false);
  const fileRef = useState(null);

  const handleExport = () => {
    exportData(data);
    markBackupNow();
    showToast("Backup gespeichert");
    onBackupDone && onBackupDone();
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    importData(
      file,
      (parsed) => { setData(parsed); showToast("Daten erfolgreich wiederhergestellt"); },
      () => showToast("Fehler: Ungültige Backup-Datei", false)
    );
    e.target.value = "";
  };

  const handleReset = () => {
    if (!confirmReset) { setConfirmReset(true); return; }
    localStorage.removeItem("mmfinanz_v3");
    window.location.reload();
  };

  const totalInvoices = data.invoices.length;
  const totalCustomers = data.customers.length;
  const lastBackupKey = "mmfinanz_last_backup";
  const saveBackupTime = () => localStorage.setItem(lastBackupKey, new Date().toISOString());

  const counts = [
    ["Rechnungen", totalInvoices],
    ["Kunden", totalCustomers],
    ["Fixkosten", data.fixedCosts.length],
    ["Private Ausgaben", data.expenses.length],
    ["Privates Einkommen", (data.privateIncome || []).length],
  ];

  return (
    <div>
      {/* Info card */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 500, color: "#999", textTransform: "uppercase", letterSpacing: .7, marginBottom: 14 }}>Gespeicherte Daten</div>
        {counts.map(([l, v]) => (
          <div className="stat-row" key={l}>
            <span style={{ fontSize: 14, color: "#555" }}>{l}</span>
            <span style={{ fontSize: 15, fontWeight: 600 }}>{v}</span>
          </div>
        ))}
      </div>

      {/* Backup card */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 500, color: "#999", textTransform: "uppercase", letterSpacing: .7, marginBottom: 6 }}>Datensicherung</div>
        <div style={{ fontSize: 13, color: "#888", marginBottom: 16, lineHeight: 1.5 }}>
          Exportiere alle Daten als JSON-Datei auf dein Gerät. Importiere sie jederzeit wieder, um deine Daten wiederherzustellen.
        </div>

        <button className="btn-prim" onClick={() => { handleExport(); saveBackupTime(); }} style={{ marginBottom: 10 }}>
          Backup exportieren
        </button>

        <label style={{
          display: "block", width: "100%", textAlign: "center",
          border: "1.5px solid #E8E4DF", borderRadius: 12, padding: "13px",
          fontFamily: "'Outfit', sans-serif", fontSize: 15, color: "#555", cursor: "pointer",
        }}>
          Backup importieren
          <input type="file" accept=".json" style={{ display: "none" }} onChange={handleImport} />
        </label>
      </div>

      {/* Install as app card */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 500, color: "#999", textTransform: "uppercase", letterSpacing: .7, marginBottom: 6 }}>Als App installieren</div>
        <div style={{ fontSize: 13, color: "#888", lineHeight: 1.6 }}>
          <div style={{ marginBottom: 8 }}>So installierst du die App auf deinem iPhone:</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[
              "1. Tippe auf das Teilen-Symbol unten in Safari",
              "2. Wähle 'Zum Home-Bildschirm'",
              "3. Tippe auf 'Hinzufügen'",
            ].map(s => (
              <div key={s} style={{ fontSize: 13, color: "#555", padding: "8px 10px", background: "#F7F5F2", borderRadius: 8 }}>{s}</div>
            ))}
          </div>
          <div style={{ marginTop: 12, fontSize: 13, color: "#888" }}>
            Für Android: Menü oben rechts — "App installieren" oder "Zum Startbildschirm".
          </div>
        </div>
      </div>

      {/* Danger zone */}
      <div className="card" style={{ marginBottom: 24, border: confirmReset ? "1.5px solid #B91C1C" : "1.5px solid #E8E4DF" }}>
        <div style={{ fontSize: 11, fontWeight: 500, color: "#B91C1C", textTransform: "uppercase", letterSpacing: .7, marginBottom: 6 }}>Gefahrenzone</div>
        <div style={{ fontSize: 13, color: "#888", marginBottom: 14 }}>
          Alle Daten löschen und neu starten. Diese Aktion kann nicht rückgängig gemacht werden.
        </div>
        {confirmReset && (
          <div style={{ fontSize: 13, fontWeight: 600, color: "#B91C1C", marginBottom: 10, padding: "10px", background: "#FEE8E8", borderRadius: 8 }}>
            Sicher? Alle Daten werden unwiderruflich geloscht.
          </div>
        )}
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={handleReset} style={{
            flex: 1, border: "none", borderRadius: 12, padding: "13px",
            fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 500, cursor: "pointer",
            background: confirmReset ? "#B91C1C" : "#F0EDEA", color: confirmReset ? "#fff" : "#B91C1C",
          }}>
            {confirmReset ? "Ja, alles loschen" : "Alle Daten loschen"}
          </button>
          {confirmReset && (
            <button onClick={() => setConfirmReset(false)} className="btn-ghost" style={{ minWidth: 100 }}>Abbrechen</button>
          )}
        </div>
      </div>

      <div style={{ textAlign: "center", fontSize: 11, color: "#ccc", paddingBottom: 8 }}>
        Mohamad Mezyak Finanz v1.0
      </div>
    </div>
  );
}
