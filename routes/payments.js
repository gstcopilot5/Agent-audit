const express = require('express');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// POST /payments/create-order
router.post('/create-order', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token' });

  try {
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return res.status(401).json({ error: 'Invalid token' });

    const order = await razorpay.orders.create({
      amount: 499900, // ₹4999 in paise
      currency: 'INR',
      receipt: 'growth_' + user.id.slice(0, 8),
      notes: { userId: user.id, plan: 'growth' }
    });

    res.json({ orderId: order.id, amount: order.amount, currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID });
  } catch(e) {
    res.status(500).json({ error: e.message, description: e.error?.description, statusCode: e.statusCode });
  }
});

// POST /payments/verify
router.post('/verify', async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token' });

  try {
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return res.status(401).json({ error: 'Invalid token' });

    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSig = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body).digest('hex');

    if (expectedSig !== razorpay_signature)
      return res.status(400).json({ error: 'Invalid signature' });

    // Upgrade plan
    await supabase.from('orgs').update({ plan: 'growth' }).eq('user_id', user.id);

    res.json({ success: true, plan: 'growth' });
  } catch(e) {
    res.status(500).json({ error: e.message, description: e.error?.description, statusCode: e.statusCode });
  }
});

module.exports = router;

// POST /payments/webhook - Razorpay webhook for payment confirmation
router.post('/webhook', express.raw({type: 'application/json'}), async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const expectedSig = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(req.body).digest('hex');

    if (expectedSig !== signature) {
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const event = JSON.parse(req.body);

    if (event.event === 'payment.captured') {
      const payment = event.payload.payment.entity;
      const userId = payment.notes?.userId;

      if (userId) {
        // Upgrade plan
        await supabase.from('orgs').update({ plan: 'growth' }).eq('user_id', userId);

        // Get user email
        const { data: org } = await supabase.from('orgs').select('*').eq('user_id', userId).single();
        const { data: { user } } = await supabase.auth.admin.getUserById(userId);

        // Send confirmation email
        const { Resend } = require('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: 'AgentAudit <hello@agentpassport.in>',
          to: user.email,
          subject: '🚀 Welcome to AgentAudit Growth Plan!',
          html: `
            <h2>Payment Confirmed!</h2>
            <p>Hi there,</p>
            <p>Your upgrade to the <strong>Growth Plan</strong> is confirmed.</p>
            <p><strong>What you now have:</strong></p>
            <ul>
              <li>25 agents</li>
              <li>50,000 executions/month</li>
              <li>Full AI analysis (Gemini)</li>
              <li>Priority support</li>
            </ul>
            <p><a href="https://agentpassport.in/dashboard">Go to Dashboard →</a></p>
            <p>Amount paid: ₹${payment.amount / 100}</p>
            <p>Payment ID: ${payment.id}</p>
          `
        });
      }
    }

    res.json({ received: true });
  } catch(e) {
    console.error('Webhook error:', e);
    res.status(500).json({ error: e.message, description: e.error?.description, statusCode: e.statusCode });
  }
});
