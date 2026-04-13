const PLANS = {
  free: { name:'Free', maxExecutions:500, maxAgents:3, aiAnalysis:false, incidentDetection:false },
  growth: { name:'Growth', maxExecutions:50000, maxAgents:25, aiAnalysis:true, incidentDetection:true },
  enterprise: { name:'Enterprise', maxExecutions:Infinity, maxAgents:Infinity, aiAnalysis:true, incidentDetection:true }
};
module.exports = { PLANS };
