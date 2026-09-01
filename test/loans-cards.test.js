'use strict';

const assert = require('assert');
const {
  collapseByName,
  computeLoan,
  toInputDate,
} = require('../js/fintrack-math.js');

const now = new Date(2026, 8, 1); // 1 Sep 2026

// Last row with the same name wins (update-by-append fallback)
{
  const rows = [
    ['Name', 'Type', 'EMI', 'Rate', 'StartDate', 'Installments', 'Notes'],
    ['HDFC Personal', 'Personal Loan', 30000, 10.9, '2024-01-07', 60, 'old'],
    ['HDFC Personal', 'Personal Loan', 28000, 10.5, '2024-01-07', 48, 'updated EMI'],
    ['Car loan', 'Auto Loan', 12000, 9, '2025-06-01', 36, ''],
  ];
  const collapsed = collapseByName(rows);
  assert.strictEqual(collapsed.length, 2);
  const hdfc = collapsed.find(r => r[0] === 'HDFC Personal');
  assert.strictEqual(Number(hdfc[2]), 28000);
  assert.strictEqual(Number(hdfc[5]), 48);
}

// Updating a card keeps the latest rate/notes
{
  const rows = [
    ['Name', 'Rate', 'Notes'],
    ['AMEX Gold', 3.5, 'old'],
    ['amex gold', 3.2, 'updated rate'],
  ];
  const collapsed = collapseByName(rows);
  assert.strictEqual(collapsed.length, 1);
  assert.strictEqual(Number(collapsed[0][1]), 3.2);
}

// Calendar remaining still works when no payments are logged
{
  const row = ['HDFC Personal', 'Personal Loan', 30000, 10.9, '2025-09-01', 24, ''];
  const loan = computeLoan(row, [], now);
  assert.strictEqual(loan.remaining, 12);
  assert.strictEqual(loan.outstanding, 30000 * 12);
}

// Logging EMI payments can reduce remaining below calendar elapsed
{
  const row = ['HDFC Personal', 'Personal Loan', 30000, 10.9, '2026-03-01', 12, ''];
  const payments = [
    ['2026-03-07', 'HDFC Personal', 30000, 'Mar'],
    ['2026-04-07', 'HDFC Personal', 30000, 'Apr'],
    ['2026-05-07', 'HDFC Personal', 30000, 'May'],
    ['2026-06-07', 'HDFC Personal', 30000, 'Jun'],
    ['2026-07-07', 'HDFC Personal', 30000, 'Jul'],
    ['2026-08-07', 'HDFC Personal', 30000, 'Aug'],
    ['2026-09-07', 'HDFC Personal', 30000, 'Sep extra'],
  ];
  const loan = computeLoan(row, payments, now);
  // elapsed from Mar 2026 to Sep 2026 = 6; 7 payments logged → remaining 12-7=5
  assert.strictEqual(loan.remaining, 5);
  assert.strictEqual(loan.outstanding, 30000 * 5);
}

// Fully paid-off via payment log
{
  const row = ['Small EMI', 'Personal Loan', 5000, 11, '2026-01-01', 3, ''];
  const payments = [
    ['2026-01-07', 'Small EMI', 5000, ''],
    ['2026-02-07', 'Small EMI', 5000, ''],
    ['2026-03-07', 'Small EMI', 5000, ''],
  ];
  const loan = computeLoan(row, payments, now);
  assert.strictEqual(loan.remaining, 0);
  assert.strictEqual(loan.outstanding, 0);
}

{
  assert.strictEqual(toInputDate('2024-01-07'), '2024-01-07');
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(toInputDate('2024-01-07T18:30:00.000Z')));
}

// Closed / refinanced loan must not still show as payable
{
  const row = ['Old HDFC', 'Personal Loan', 31808, 10.9, '2024-01-07', 60, 'refinanced', 'Closed'];
  const loan = computeLoan(row, [], now);
  assert.strictEqual(loan.closed, true);
  assert.strictEqual(loan.status, 'Closed');
  assert.strictEqual(loan.remaining, 0);
  assert.strictEqual(loan.outstanding, 0);
}

{
  const { parseStatus } = require('../js/fintrack-math.js');
  assert.strictEqual(parseStatus('closed'), 'Closed');
  assert.strictEqual(parseStatus('Active'), 'Active');
  assert.strictEqual(parseStatus(''), 'Active');
}

console.log('ok: loan/card update tests passed');
