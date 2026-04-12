const crypto = require('crypto');

function uid(prefix = '') {
  return `${prefix}${crypto.randomBytes(8).toString('hex')}`;
}

function now() {
  return new Date().toISOString();
}

function parseExpiry(str) {
  const match = String(str).match(/^(\d+)(s|m|h|d)$/);
  if (!match) return null;
  const val = parseInt(match[1]);
  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return val * multipliers[match[2]];
}

function getRiskScore(action) {
  const a = action.toLowerCase();
  const HIGH = ['delete','drop','transfer','revoke','wipe','destroy','purge'];
  const MEDIUM = ['update','create_invoice','send_payment','modify','export','bulk'];
  if (HIGH.some(k => a.includes(k))) return 'high';
  if (MEDIUM.some(k => a.includes(k))) return 'medium';
  return 'low';
}

module.exports = { uid, now, parseExpiry, getRiskScore };
