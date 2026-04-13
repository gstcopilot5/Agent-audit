const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
async function createOrg(id,name,apiKey){const{data,error}=await supabase.from('orgs').insert({id,name,api_key:apiKey}).select().single();if(error)throw error;return data;}
async function getOrgByApiKey(apiKey){const{data}=await supabase.from('orgs').select('*').eq('api_key',apiKey).single();return data||null;}
async function createAgent(agent){const{data,error}=await supabase.from('agents').insert(agent).select().single();if(error)throw error;return data;}
async function getAgent(id){const{data}=await supabase.from('agents').select('*').eq('id',id).single();return data||null;}
async function getAgentsByOrg(orgId){const{data}=await supabase.from('agents').select('*').eq('org_id',orgId).order('created_at',{ascending:false});return data||[];}
async function updateAgentStatus(id,status,extra={}){const{data,error}=await supabase.from('agents').update({status,...extra}).eq('id',id).select().single();if(error)throw error;return data;}
async function upsertPolicy(policy){const{data,error}=await supabase.from('policies').upsert(policy,{onConflict:'org_id,role,action'}).select().single();if(error)throw error;return data;}
async function getPolicy(orgId,role,action){const{data}=await supabase.from('policies').select('*').eq('org_id',orgId).eq('role',role).eq('action',action).single();return data||null;}
async function getPoliciesByOrg(orgId){const{data}=await supabase.from('policies').select('*').eq('org_id',orgId);return data||[];}
async function createAuthorization(auth){const{data,error}=await supabase.from('authorizations').insert(auth).select().single();if(error)throw error;return data;}
async function getAuthorization(id){const{data}=await supabase.from('authorizations').select('*').eq('id',id).single();return data||null;}
async function markAuthorizationUsed(id,usedAt){const{error}=await supabase.from('authorizations').update({used:true,used_at:usedAt}).eq('id',id);if(error)throw error;}
async function insertExecution(exec){const{data,error}=await supabase.from('executions').insert(exec).select().single();if(error)throw error;return data;}
async function updateExecutionAnalysis(id,aiAnalysis){await supabase.from('executions').update({ai_analysis:aiAnalysis}).eq('id',id);}
async function getExecutionsByAgent(agentId){const{data}=await supabase.from('executions').select('*').eq('agent_id',agentId).order('executed_at',{ascending:false});return data||[];}
async function getExecutionsByOrg(orgId, limit=50, offset=0){const{data}=await supabase.from('executions').select('*').eq('org_id',orgId).order('executed_at',{ascending:false}).range(offset, offset + limit - 1);return data||[];}
async function getRecentExecutionsByAgent(agentId,limit=20){const{data}=await supabase.from('executions').select('*').eq('agent_id',agentId).order('executed_at',{ascending:false}).limit(limit);return data||[];}
async function insertIncident(incident){const{data,error}=await supabase.from('incidents').insert(incident).select().single();if(error)throw error;return data;}
async function getIncidentsByOrg(orgId){const{data}=await supabase.from('incidents').select('*').eq('org_id',orgId).order('detected_at',{ascending:false});return data||[];}
module.exports={createOrg,getOrgByApiKey,createAgent,getAgent,getAgentsByOrg,updateAgentStatus,upsertPolicy,getPolicy,getPoliciesByOrg,createAuthorization,getAuthorization,markAuthorizationUsed,insertExecution,updateExecutionAnalysis,getExecutionsByAgent,getExecutionsByOrg,getRecentExecutionsByAgent,insertIncident,getIncidentsByOrg};
