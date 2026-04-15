require('dotenv').config();
const express=require('express');
const app=express();
app.use(require('cors')({origin: '*'}));
app.use(express.json());
app.use('/org',require('./routes/orgs'));
app.use('/agents',require('./routes/agents'));
app.use('/policies',require('./routes/policies'));
app.use('/authorize',require('./routes/authorize'));
app.use('/execute',require('./routes/execute'));
app.use('/audit',require('./routes/audit'));
app.use('/incidents',require('./routes/incidents'));
app.use('/analytics', require('./routes/analytics'));
app.use('/risk',require('./routes/risk'));
app.get('/health',(req,res)=>res.json({status:'ok',service:'AgentAudit',version:'2.0.0',uptime:Math.floor(process.uptime())}));
const authRoutes = require('./routes/auth.js');
const paymentRoutes = require('./routes/payments.js');
app.use('/payments', paymentRoutes);
app.use('/auth', authRoutes);

app.use((req,res)=>res.status(404).json({error:'Route '+req.method+' '+req.path+' not found'}));
app.use((err,req,res,next)=>{console.error('[Unhandled]',err);res.status(500).json({error:'Internal server error'});});

const PORT=process.env.PORT||3000;
app.listen(PORT,()=>console.log('AgentAudit v2.0 running on port '+PORT));

