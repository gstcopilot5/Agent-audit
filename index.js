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
const rateLimit = require('express-rate-limit');

// Rate limiters
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per 15 mins
  message: { error: 'Too many attempts. Please try again in 15 minutes.' }
});

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 signups per hour per IP
  message: { error: 'Too many accounts created. Please try again in an hour.' }
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: { error: 'Rate limit exceeded. Please slow down.' }
});

const authRoutes = require('./routes/auth.js');
const paymentRoutes = require('./routes/payments.js');
app.use('/payments', paymentRoutes);
app.use('/auth/login', authLimiter);
app.use('/auth/signup', signupLimiter);
app.use('/auth', authRoutes);
app.use('/api', apiLimiter);

app.use((req,res)=>res.status(404).json({error:'Route '+req.method+' '+req.path+' not found'}));
app.use((err,req,res,next)=>{console.error('[Unhandled]',err);res.status(500).json({error:'Internal server error'});});

const PORT=process.env.PORT||3000;
app.listen(PORT,()=>console.log('AgentAudit v2.0 running on port '+PORT));

