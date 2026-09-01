'use strict';

function parseAmount(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const cleaned = String(v)
    .trim()
    .replace(/₹/g, '')
    .replace(/,/g, '')
    .replace(/\s/g, '');
  if (!cleaned) return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function normalizeDir(v) {
  const s = String(v == null ? '' : v).trim().toLowerCase().replace(/\s+/g, ' ');
  if (!s) return '';
  if (s === 'paid' || s === 'pay' || s === 'given' || s === 'gave' || s === 'repaid' || s === 'repayment' || s === 'paid back' || s === 'payback' || s === 'returned' || s === 'return') return 'Paid';
  if (s === 'received' || s === 'recv' || s === 'took' || s === 'borrowed') return 'Received';
  return s;
}

function personKey(name) {
  return String(name || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function namesEqual(a, b) {
  return personKey(a) === personKey(b);
}

function isHeaderRow(row) {
  if (!row) return false;
  const a = String(row[0] || '').trim().toLowerCase();
  const b = String(row[1] || '').trim().toLowerCase();
  return a === 'date' || b === 'direction' || b === 'type';
}

function isParkedName(name) {
  return /^hemil\b/i.test(String(name || '').trim());
}

function txAmount(row) {
  if (!row) return 0;
  const dir = normalizeDir(row[1]);
  const receivedCol = parseAmount(row[3]);
  const paidCol = parseAmount(row[4]);
  if (dir === 'Paid') return paidCol || receivedCol;
  if (dir === 'Received') return receivedCol || paidCol;
  return receivedCol || paidCol;
}

function rupees(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function computePersonBalances(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const start = list.length && isHeaderRow(list[0]) ? 1 : 0;
  const people = {};
  for (let i = start; i < list.length; i++) {
    const r = list[i];
    if (!r) continue;
    const rawName = String(r[2] == null ? '' : r[2]).trim().replace(/\s+/g, ' ');
    if (!rawName || /^total$/i.test(rawName)) continue;
    const dir = normalizeDir(r[1]);
    const amt = rupees(txAmount(r));
    if (!amt || (dir !== 'Paid' && dir !== 'Received')) continue;
    const key = personKey(rawName);
    if (!people[key]) {
      people[key] = {
        name: rawName,
        received: 0,
        paid: 0,
        parked: isParkedName(rawName),
      };
    }
    if (dir === 'Received') people[key].received += amt;
    else people[key].paid += amt;
  }
  return Object.values(people).map(p => {
    const net = rupees(p.paid - p.received);
    const settled = Math.abs(net) < 0.5;
    return {
      ...p,
      received: rupees(p.received),
      paid: rupees(p.paid),
      net: settled ? 0 : net,
      youOwe: net < -0.5 ? rupees(-net) : 0,
      theyOwe: net > 0.5 ? rupees(net) : 0,
      settled,
    };
  });
}

function summarizeInformal(rows) {
  const people = computePersonBalances(rows);
  let payable = 0;
  let receivable = 0;
  let payCount = 0;
  let collectCount = 0;
  let topPay = null;
  let topCollect = null;
  let hemil = null;
  people.forEach(p => {
    if (p.parked) {
      hemil = p;
      return;
    }
    if (p.theyOwe > 0) {
      receivable += p.theyOwe;
      collectCount += 1;
      if (!topCollect || p.theyOwe > topCollect.amount) {
        topCollect = { name: p.name, amount: p.theyOwe };
      }
    } else if (p.youOwe > 0) {
      payable += p.youOwe;
      payCount += 1;
      if (!topPay || p.youOwe > topPay.amount) {
        topPay = { name: p.name, amount: p.youOwe };
      }
    }
  });
  return {
    people,
    payable: rupees(payable),
    receivable: rupees(receivable),
    payCount,
    collectCount,
    topPay,
    topCollect,
    hemil,
  };
}

function parseFlexibleDate(s) {
  if (s == null || s === '') return null;
  if (s instanceof Date && !isNaN(s.getTime())) {
    return new Date(s.getFullYear(), s.getMonth(), s.getDate());
  }
  const str = String(s).trim();
  const dateOnly = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
  const t = Date.parse(str);
  if (!Number.isFinite(t)) return null;
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function cardOutstanding(card, bills, payments, loanNames) {
  const name = card && card.name;
  const myBills = (bills || []).filter(b => namesEqual(b[1], name) && parseAmount(b[2]) > 0);
  const lastBill = myBills.length ? myBills[myBills.length - 1] : null;
  const lastAmt = lastBill ? parseAmount(lastBill[2]) : 0;
  const lastTs = lastBill ? (parseFlexibleDate(lastBill[0]) || new Date(0)).getTime() : 0;
  const loanSet = new Set((loanNames || []).map(personKey));
  const paid = (payments || []).reduce((s, p) => {
    if (!namesEqual(p[1], name)) return s;
    if (loanSet.has(personKey(p[1]))) return s;
    const dt = parseFlexibleDate(p[0]);
    if (!dt || dt.getTime() < lastTs) return s;
    return s + parseAmount(p[2]);
  }, 0);
  return Math.max(0, rupees(lastAmt - paid));
}

const api = {
  parseAmount,
  normalizeDir,
  personKey,
  namesEqual,
  txAmount,
  computePersonBalances,
  summarizeInformal,
  parseFlexibleDate,
  cardOutstanding,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = api;
}
if (typeof globalThis !== 'undefined') {
  globalThis.FinTrackMath = api;
}
