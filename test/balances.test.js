'use strict';

const assert = require('assert');
const {
  parseAmount,
  txAmount,
  computePersonBalances,
  summarizeInformal,
  cardOutstanding,
} = require('../js/fintrack-math.js');

function header() {
  return ['Date', 'Direction', 'Person', 'Received', 'Paid', 'Remarks'];
}

function person(rows, name) {
  return computePersonBalances(rows).find(p => p.name.toLowerCase() === name.toLowerCase());
}

// 1. Reported bug: single Amount column (col 3) used for both Received and Paid
{
  const rows = [
    header(),
    ['2026-01-10', 'Received', 'Amit', 50000, '', 'borrowed'],
    ['2026-03-01', 'Paid', 'Amit', 50000, '', 'paid back in full'],
  ];
  const amit = person(rows, 'Amit');
  assert.strictEqual(amit.youOwe, 0, 'fully repaid person must not still be owed');
  assert.strictEqual(amit.theyOwe, 0);
  assert.strictEqual(amit.settled, true);
  const sum = summarizeInformal(rows);
  assert.strictEqual(sum.payable, 0);
  assert.strictEqual(sum.payCount, 0);
  assert.ok(!sum.topPay, 'overview must not tell you to pay a settled person');
}

// 2. App-written shape: Paid amount lives in column 4
{
  const rows = [
    header(),
    ['2026-01-10', 'Received', 'Amit', 50000, '', 'borrowed'],
    ['2026-03-01', 'Paid', 'Amit', '', 50000, 'paid back in full'],
  ];
  const amit = person(rows, 'Amit');
  assert.strictEqual(amit.settled, true);
  assert.strictEqual(amit.youOwe, 0);
}

// 3. Partial repayment still shows remaining payable
{
  const rows = [
    header(),
    ['2026-01-10', 'Received', 'Amit', 50000, '', 'borrowed'],
    ['2026-03-01', 'Paid', 'Amit', 20000, '', 'partial'],
  ];
  const amit = person(rows, 'Amit');
  assert.strictEqual(amit.youOwe, 30000);
  assert.strictEqual(amit.settled, false);
}

// 4. Indian-formatted strings and rupee sign must parse
{
  assert.strictEqual(parseAmount('50,000'), 50000);
  assert.strictEqual(parseAmount('₹1,00,000'), 100000);
  assert.strictEqual(parseAmount(' 25000.50 '), 25000.5);
  assert.strictEqual(parseAmount(1200), 1200);
  assert.strictEqual(parseAmount(''), 0);
}

// 5. Direction is case/whitespace tolerant
{
  const rows = [
    header(),
    ['2026-01-10', ' received ', 'Amit', '10,000', '', ''],
    ['2026-03-01', 'PAID', 'Amit', '10,000', '', ''],
  ];
  assert.strictEqual(person(rows, 'Amit').settled, true);
}

// 6. Same person with different casing/spacing is one balance
{
  const rows = [
    header(),
    ['2026-01-10', 'Received', 'Rahul Shah', 8000, '', ''],
    ['2026-03-01', 'Paid', 'rahul  shah', 8000, '', ''],
  ];
  const people = computePersonBalances(rows);
  assert.strictEqual(people.length, 1);
  assert.strictEqual(people[0].settled, true);
}

// 7. Hemil is parked: excluded from "you have to pay" totals, amount is live
{
  const rows = [
    header(),
    ['2025-01-01', 'Received', 'Hemil', 100000, '', 'parked'],
    ['2026-01-10', 'Received', 'Amit', 5000, '', ''],
    ['2026-06-01', 'Paid', 'Hemil', 100000, '', 'returned'],
  ];
  const sum = summarizeInformal(rows);
  assert.strictEqual(sum.payable, 5000, 'only Amit should remain payable');
  assert.strictEqual(sum.payCount, 1);
  assert.strictEqual(sum.topPay.name, 'Amit');
  assert.strictEqual(sum.topPay.amount, 5000);
  assert.strictEqual(sum.hemil.youOwe, 0);
  assert.strictEqual(sum.hemil.settled, true);
}

// 8. Action text must use the top person's amount, not the total of everyone
{
  const rows = [
    header(),
    ['2026-01-10', 'Received', 'Amit', 5000, '', ''],
    ['2026-01-11', 'Received', 'Neha', 2000, '', ''],
  ];
  const sum = summarizeInformal(rows);
  assert.strictEqual(sum.payable, 7000);
  assert.strictEqual(sum.topPay.name, 'Amit');
  assert.strictEqual(sum.topPay.amount, 5000);
}

// 9. txAmount reads whichever amount column is filled
{
  assert.strictEqual(txAmount(['2026-01-01', 'Paid', 'Amit', 4000, '']), 4000);
  assert.strictEqual(txAmount(['2026-01-01', 'Paid', 'Amit', '', 4000]), 4000);
  assert.strictEqual(txAmount(['2026-01-01', 'Received', 'Amit', 4000, '']), 4000);
}

// 10. Card: full payment since last bill → outstanding 0 (case-insensitive name)
{
  const bills = [
    ['2026-04-01', 'AMEX', 12000, '2026-04-20'],
    ['2026-05-01', 'AMEX', 8000, '2026-05-20'],
  ];
  const payments = [
    ['2026-05-10', 'amex', 8000, 'paid in full'],
  ];
  assert.strictEqual(cardOutstanding({ name: 'AMEX' }, bills, payments, []), 0);
}

// 11. Card: payment before last bill does not clear current statement
{
  const bills = [
    ['2026-05-01', 'AMEX', 8000, '2026-05-20'],
  ];
  const payments = [
    ['2026-04-20', 'AMEX', 8000, 'old payment'],
  ];
  assert.strictEqual(cardOutstanding({ name: 'AMEX' }, bills, payments, []), 8000);
}

// 12. Apps Script often serializes sheet dates as ISO datetimes
{
  const { parseFlexibleDate } = require('../js/fintrack-math.js');
  const d = parseFlexibleDate('2026-05-01T18:30:00.000Z');
  assert.ok(d instanceof Date && !isNaN(d.getTime()));
  const bills = [['2026-05-01T18:30:00.000Z', 'AMEX', 8000, '2026-05-20']];
  const payments = [['2026-05-10T10:00:00.000Z', 'AMEX', 8000, 'paid']];
  assert.strictEqual(cardOutstanding({ name: 'AMEX' }, bills, payments, []), 0);
}

console.log('ok: all settlement tests passed');
