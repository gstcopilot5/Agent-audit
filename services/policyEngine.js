const db = require('./db');
async function evaluate(agent,action,context={}){
  const policy=await db.getPolicy(agent.org_id,agent.role,action);
  if(!policy)return{allowed:true,requiresApproval:true,violations:[],policy:null};
  const violations=[];
  if(policy.allowed_hours_from!=null&&policy.allowed_hours_to!=null){const hour=new Date().getUTCHours();if(hour<policy.allowed_hours_from||hour>policy.allowed_hours_to)violations.push('Action outside allowed hours');}
  if(policy.max_amount!=null&&context.amount!=null){if(Number(context.amount)>Number(policy.max_amount))violations.push('Amount exceeds policy max of '+policy.max_amount);}
  return{allowed:violations.length===0,requiresApproval:policy.requires_approval,violations,policy};
}
module.exports={evaluate};
