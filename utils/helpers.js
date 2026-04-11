const crypto = require('crypto');
function uid(prefix=''){return `${prefix}${crypto.randomBytes(8).toString('hex')}`;}
function now(){return new Date().toISOString();}
function getRiskScore(action){const a=action.toLowerCase();const HIGH=['delete','drop','transfer','revoke','wipe','destroy','purge'];const MEDIUM=['update','create_invoice','send_payment','modify','export','bulk'];if(HIGH.some(k=>a.includes(k)))return 'high';if(MEDIUM.some(k=>a.includes(k)))return 'medium';return 'low';}
module.exports={uid,now,parseExpiry,getRiskScore};
