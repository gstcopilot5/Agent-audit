const express = require('express');
const router = express.Router();
const db = require('../services/db');
const { requireApiKey } = require('../middleware/auth');

// GET /analytics/overview — daily execution counts for last 30 days
router.get('/overview', requireApiKey, async (req, res) => {
  try {
    const executions = await db.getExecutionsByOrg(req.org.id, 5000);

    // Group by day
    const days = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days[key] = { date: key, success: 0, denied: 0, total: 0 };
    }

    executions.forEach(e => {
      const day = e.executed_at?.slice(0, 10);
      if (days[day]) {
        days[day].total++;
        if (e.status === 'success') days[day].success++;
        else days[day].denied++;
      }
    });

    // Denial reasons breakdown
    const reasons = {};
    executions.filter(e => e.status === 'denied').forEach(e => {
      reasons[e.reason] = (reasons[e.reason] || 0) + 1;
    });

    // Hourly distribution
    const hours = Array(24).fill(0);
    executions.forEach(e => {
      const h = new Date(e.executed_at).getUTCHours();
      if (!isNaN(h)) hours[h]++;
    });

    // Per-agent summary
    const agentMap = {};
    executions.forEach(e => {
      if (!agentMap[e.agent_id]) {
        agentMap[e.agent_id] = { agentId: e.agent_id, agentName: e.agent_name, total: 0, success: 0, denied: 0 };
      }
      agentMap[e.agent_id].total++;
      if (e.status === 'success') agentMap[e.agent_id].success++;
      else agentMap[e.agent_id].denied++;
    });

    return res.json({
      daily: Object.values(days),
      denialReasons: Object.entries(reasons).map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count),
      hourly: hours.map((count, hour) => ({ hour, count })),
      perAgent: Object.values(agentMap),
      totals: {
        total: executions.length,
        success: executions.filter(e => e.status === 'success').length,
        denied: executions.filter(e => e.status === 'denied').length,
      }
    });
  } catch (err) {
    console.error('[Analytics]', err.message);
    return res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// GET /analytics/org — current org details
router.get('/org', requireApiKey, async (req, res) => {
  return res.json({ org: req.org });
});

module.exports = router;
