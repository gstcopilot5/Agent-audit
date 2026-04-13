const express=require('express');const router=express.Router();const db=require('../services/db');const{requireApiKey}=require('../middleware/auth');const{uid,now}=require('../utils/helpers');
router.post('/',requireApiKey,async(req,res)=>{const{name,role}=req.body;if(!name||!role)return res.status(400).json({error:'name and role are required'});try{const agent=await db.createAgent({id:uid('agent_'),name,role,org_id:req.org.id,status:'active'});return res.status(201).json({message:'Agent registered',agent});}catch(err){return res.status(500).json({error:'Failed to create agent'});}});
router.get('/',requireApiKey,async(req,res)=>{try{const agents=await db.getAgentsByOrg(req.org.id);return res.json({agents,total:agents.length});}catch(err){return res.status(500).json({error:'Failed to fetch agents'});}});
router.get('/:agentId',requireApiKey,async(req,res)=>{try{const agent=await db.getAgent(req.params.agentId);if(!agent)return res.status(404).json({error:'Agent not found'});if(agent.org_id!==req.org.id)return res.status(403).json({error:'Access denied'});return res.json(agent);}catch(err){return res.status(500).json({error:'Failed to fetch agent'});}});
router.patch('/:agentId/suspend',requireApiKey,async(req,res)=>{try{const agent=await db.getAgent(req.params.agentId);if(!agent)return res.status(404).json({error:'Agent not found'});if(agent.org_id!==req.org.id)return res.status(403).json({error:'Access denied'});const updated=await db.updateAgentStatus(agent.id,'suspended',{suspended_at:now()});return res.json({message:'Agent suspended',agent:updated});}catch(err){return res.status(500).json({error:'Failed to suspend agent'});}});
router.patch('/:agentId/activate',requireApiKey,async(req,res)=>{try{const agent=await db.getAgent(req.params.agentId);if(!agent)return res.status(404).json({error:'Agent not found'});if(agent.org_id!==req.org.id)return res.status(403).json({error:'Access denied'});const updated=await db.updateAgentStatus(agent.id,'active');return res.json({message:'Agent activated',agent:updated});}catch(err){return res.status(500).json({error:'Failed to activate agent'});}});
module.exports=router;

router.delete('/:agentId', requireApiKey, async (req, res) => {
  try {
    const agent = await db.getAgent(req.params.agentId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    if (agent.org_id !== req.org.id) return res.status(403).json({ error: 'Access denied' });
    if (agent.status === 'active') return res.status(400).json({ error: 'Suspend agent before deleting' });
    const { createClient } = require('@supabase/supabase-js');
    const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    const { error } = await sb.from('agents').delete().eq('id', req.params.agentId);
    if (error) throw error;
    return res.json({ message: 'Agent deleted', agentId: req.params.agentId });
  } catch (err) {
    console.error('[Delete Agent]', err.message);
    return res.status(500).json({ error: 'Failed to delete agent' });
  }
});
