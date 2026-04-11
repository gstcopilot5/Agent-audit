const express=require('express');const router=express.Router();const db=require('../services/db');const gemini=require('../services/gemini');const{requireApiKey}=require('../middleware/auth');const policyEngine=require('../services/policyEngine');const{uid,now,getRiskScore}=require('../utils/helpers');
async function logAndFlag(agentId,action,authorizationId,status,reason,agent,auth,metadata,orgId){try{await db.insertExecution({id:uid('exec_'),agent_id:agentId,agent_name:agent?.name||'unknown',agent_role:agent?.role||'unknown',org_id:orgId,action,authorization_id:authorizationId,authorized_by:auth?.approved_by||null,authorized_at:auth?.created_at||null,executed_at:now(),status,reason,risk_score:getRiskScore(action),metadata:metadata||{}});const incidentReasons=['REPLAY_ATTEMPT','CROSS_ORG_ATTEMPT','AGENT_MISMATCH'];if(incidentReasons.includes(reason)){await db.insertIncident({id:uid('inc_'),org_id:orgId,type:reason,detail:{agentId,action,authorizationId},ai_summary:'Security event: '+reason+' detected for agent '+(agent?.name||agentId)+' attempting "'+action+'".'});}}catch(err){console.error('[logAndFlag]',err.message);}}
router.post('/',requireApiKey,async(req,res)=>{
const{agentId,action,authorizationId,metadata}=req.body;
if(!agentId||!action||!authorizationId)return res.status(400).json({error:'agentId, action, and authorizationId are required'});
let agent,auth;
try{agent=await db.getAgent(agentId);}catch(err){return res.status(500).json({error:'Failed to fetch agent'});}
if(!agent)return res.status(404).json({error:'Agent not found'});
if(agent.org_id!==req.org.id)return res.status(403).json({error:'Access denied'});
if(agent.status!=='active'){await logAndFlag(agentId,action,authorizationId,'denied','AGENT_SUSPENDED',agent,null,metadata,req.org.id);return res.status(403).json({error:'Agent is suspended',status:'denied',reason:'AGENT_SUSPENDED'});}
try{auth=await db.getAuthorization(authorizationId);}catch(err){return res.status(500).json({error:'Failed to fetch authorization'});}
if(!auth){await logAndFlag(agentId,action,authorizationId,'denied','AUTHORIZATION_NOT_FOUND',agent,null,metadata,req.org.id);return res.status(403).json({error:'Authorization not found',status:'denied',reason:'AUTHORIZATION_NOT_FOUND'});}
if(auth.org_id!==req.org.id){await logAndFlag(agentId,action,authorizationId,'denied','CROSS_ORG_ATTEMPT',agent,auth,metadata,req.org.id);return res.status(403).json({error:'Access denied',status:'denied',reason:'CROSS_ORG_ATTEMPT'});}
if(auth.agent_id!==agentId){await logAndFlag(agentId,action,authorizationId,'denied','AGENT_MISMATCH',agent,auth,metadata,req.org.id);return res.status(403).json({error:'Agent mismatch',status:'denied',reason:'AGENT_MISMATCH'});}
if(auth.action!==action){await logAndFlag(agentId,action,authorizationId,'denied','ACTION_MISMATCH',agent,auth,metadata,req.org.id);return res.status(403).json({error:'Action mismatch',status:'denied',reason:'ACTION_MISMATCH'});}
if(new Date()>new Date(auth.expires_at)){await logAndFlag(agentId,action,authorizationId,'denied','AUTHORIZATION_EXPIRED',agent,auth,metadata,req.org.id);return res.status(403).json({error:'Authorization expired',status:'denied',reason:'AUTHORIZATION_EXPIRED'});}
if(auth.used){await logAndFlag(agentId,action,authorizationId,'denied','REPLAY_ATTEMPT',agent,auth,metadata,req.org.id);return res.status(403).json({error:'Authorization already used',status:'denied',reason:'REPLAY_ATTEMPT'});}
const evaluation=await policyEngine.evaluate(agent,action,{...auth.context,...metadata});
if(!evaluation.allowed){await logAndFlag(agentId,action,authorizationId,'denied','POLICY_VIOLATION',agent,auth,metadata,req.org.id);return res.status(403).json({error:'Blocked by policy',status:'denied',reason:'POLICY_VIOLATION',violations:evaluation.violations});}
const riskScore=getRiskScore(action);const executedAt=now();
await db.markAuthorizationUsed(authorizationId,executedAt);
const execRecord=await db.insertExecution({id:uid('exec_'),agent_id:agentId,agent_name:agent.name,agent_role:agent.role,org_id:req.org.id,action,authorization_id:authorizationId,authorized_by:auth.approved_by,authorized_at:auth.created_at,executed_at:executedAt,status:'success',reason:'VALID',risk_score:riskScore,metadata:metadata||{}});
res.status(200).json({message:'Execution authorized and logged',status:'success',executionId:execRecord.id,riskScore,authorizedBy:auth.approved_by});
setImmediate(async()=>{try{const analysis=await gemini.analyzeExecution({action,status:'success',reason:'VALID',riskScore,agentName:agent.name,agentRole:agent.role,approvedBy:auth.approved_by,metadata});if(analysis)await db.updateExecutionAnalysis(execRecord.id,analysis);const recent=await db.getRecentExecutionsByAgent(agentId,20);const incidents=await gemini.detectIncidents({agentName:agent.name,agentRole:agent.role,recentExecutions:recent});for(const inc of incidents){await db.insertIncident({id:uid('inc_'),org_id:req.org.id,type:inc.type,detail:{agentId,agentName:agent.name,severity:inc.severity},ai_summary:inc.summary});}}catch(err){console.error('[Execute/Async]',err.message);}});
});
module.exports=router;
