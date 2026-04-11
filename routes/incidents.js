const express=require('express');const router=express.Router();const db=require('../services/db');const{requireApiKey}=require('../middleware/auth');
router.get('/',requireApiKey,async(req,res)=>{try{const incidents=await db.getIncidentsByOrg(req.org.id);return res.json({incidents,total:incidents.length});}catch(err){return res.status(500).json({error:'Failed to fetch incidents'});}});
module.exports=router;
