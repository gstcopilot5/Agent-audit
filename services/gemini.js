const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
async function analyzeExecution({action,status,reason,riskScore,agentName,agentRole,approvedBy,metadata}){
  const prompt = 'You are AgentAudit AI analyst. Analyze this AI agent execution in 2-3 sentences.\nAgent: "'+agentName+'" (role: '+agentRole+')\nAction: "'+action+'"\nResult: '+status+' - '+reason+'\nRisk: '+riskScore+'\nApproved by: '+(approvedBy||'none')+'\nBe direct. State what happened, whether risk score fits, one recommendation. Plain paragraph only.';
  try{const result=await model.generateContent(prompt);return result.response.text().trim();}catch(err){console.error('[Gemini] analyzeExecution:',err.message);return null;}
}
async function generateAuditSummary({agentName,agentRole,executions}){
  if(!executions||executions.length===0)return 'No executions recorded yet.';
  const sample=executions.slice(0,30).map(e=>({action:e.action,status:e.status,reason:e.reason,risk:e.risk_score}));
  const prompt = 'You are AgentAudit AI analyst. Summarize this AI agent behavior in 3-4 sentences.\nAgent: "'+agentName+'" (role: '+agentRole+')\nTotal: '+executions.length+'\nSuccess rate: '+((executions.filter(e=>e.status==="success").length/executions.length)*100).toFixed(1)+'%\nSample: '+JSON.stringify(sample)+'\nCover: what it does, failure patterns, trust assessment. Plain paragraph only.';
  try{const result=await model.generateContent(prompt);return result.response.text().trim();}catch(err){return 'AI summary temporarily unavailable.';}
}
async function detectIncidents({agentName,agentRole,recentExecutions}){
  if(!recentExecutions||recentExecutions.length<3)return[];
  const sample=recentExecutions.slice(0,15).map(e=>({action:e.action,status:e.status,reason:e.reason,risk:e.risk_score,at:e.executed_at}));
  const prompt = 'You are AgentAudit anomaly detector.\nAgent: "'+agentName+'" role: '+agentRole+'\nRecent activity: '+JSON.stringify(sample)+'\nDetect: repeated failures, escalating risk, unusual actions, replay patterns, burst activity.\nReturn ONLY a JSON array. Each item: {"type":"TYPE","severity":"low|medium|high","summary":"explanation"}\nIf none: return []\nRaw JSON only, no markdown.';
  try{const result=await model.generateContent(prompt);const text=result.response.text().trim().replace(/```json|```/g,'').trim();const parsed=JSON.parse(text);return Array.isArray(parsed)?parsed:[];}catch(err){console.error('[Gemini] detectIncidents:',err.message);return[];}
}
module.exports={analyzeExecution,generateAuditSummary,detectIncidents};
