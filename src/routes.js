const express = require('express');
const crypto = require('crypto');
const db = require('./database');
const razorpay = require('./services/razorpay');
const whatsapp = require('./services/whatsapp');
const numerology = require('./services/numerology');

const router = express.Router();

// Pricing tiers
const TIERS = {
  free_awareness: { amount: 0, label: 'Free Awareness Report' },
  deep_decode: { amount: 999, label: 'Deep Decode Report' },
  transformation: { amount: 2999, label: 'Transformation Blueprint' },
  vip: { amount: 4999, label: 'VIP Private Consultation' }
};

// ===== LEAD CAPTURE =====
router.post('/leads', (req, res) => {
  try {
    const { name, phone, dob, tob, pob, email, question, source, utm_source, utm_medium, utm_campaign } = req.body;
    if (!name || !phone || !dob) return res.status(400).json({ error: 'Name, phone, and date of birth are required' });
    
    const existing = db.getLeads({ search: phone });
    if (existing.length > 0) return res.json({ lead: existing[0], existing: true });
    
    const lead = db.createLead({ name, phone, dob, tob, pob, email, question, source, utm_source, utm_medium, utm_campaign });
    res.status(201).json({ lead, existing: false });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/leads', (req, res) => {
  const { status, tier, from, to, search, page = 1, limit = 50 } = req.query;
  let leads = db.getLeads({ status, tier, from, to, search });
  const total = leads.length;
  const offset = (page - 1) * limit;
  leads = leads.slice(offset, offset + parseInt(limit));
  res.json({ leads, total, page: parseInt(page), pages: Math.ceil(total / limit) });
});

router.get('/leads/:id', (req, res) => {
  const lead = db.getLead(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  const reports = db.getReports({ lead_id: lead.id });
  const payments = db.getPayments({ lead_id: lead.id });
  const bookings = db.getBookings({ lead_id: lead.id });
  res.json({ lead, reports, payments, bookings });
});

router.patch('/leads/:id', (req, res) => {
  const updated = db.updateLead(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Lead not found' });
  res.json({ lead: updated });
});

router.post('/leads/:id/notes', (req, res) => {
  const lead = db.getLead(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  const notes = lead.notes || [];
  notes.push({ text: req.body.note, added_at: new Date().toISOString() });
  const updated = db.updateLead(req.params.id, { notes });
  res.json({ lead: updated });
});

// ===== FREE REPORT (Full Pipeline) =====
router.post('/reports/free', async (req, res) => {
  try {
    const { name, phone, dob, tob, pob, question } = req.body;
    if (!name || !phone || !dob) return res.status(400).json({ error: 'Name, phone, and DOB required' });
    
    // 1. Create or find lead
    let lead;
    const existing = db.getLeads({ search: phone });
    if (existing.length > 0) {
      lead = existing[0];
    } else {
      lead = db.createLead({ name, phone, dob, tob, pob, question });
    }
    
    // 2. Create report record
    const report = db.createReport({
      lead_id: lead.id,
      type: 'free_awareness',
      input_data: { name, dob, tob, pob, question }
    });
    
    // 3. Calculate numbers instantly (no API needed)
    const numbers = numerology.calcAllNumbers(name, dob);
    
    // 4. Generate AI report
    db.updateReport(report.id, { status: 'generating', horosoft_data: numbers });
    
    const aiResult = await numerology.generateReport('free_awareness', name, dob, question);
    
    if (aiResult.generated) {
      db.updateReport(report.id, {
        status: 'completed',
        ai_report: aiResult.report_text,
        ai_insights: aiResult.insights
      });
      
      // 5. Send to WhatsApp (async, don't block response)
      whatsapp.sendFreeReport(phone, name, aiResult.report_text.slice(0, 800)).catch(err => {
        console.error('[WhatsApp] Free report delivery failed:', err.message);
      });
      
      // 6. Schedule follow-up upsell (after 2 hours)
      if (aiResult.insights) {
        setTimeout(() => {
          const insightText = aiResult.insights.concerns
            ? aiResult.insights.concerns.map((c, i) => `${i + 1}. ${c}`).join('\n')
            : 'Your chart shows some interesting patterns worth exploring deeper.';
          whatsapp.sendFollowUp(phone, name, insightText).catch(err => {
            console.error('[WhatsApp] Follow-up failed:', err.message);
          });
        }, 2 * 60 * 60 * 1000); // 2 hours
      }
      
      db.updateLead(lead.id, { status: 'free_report_sent' });
      
      res.json({
        success: true,
        report_id: report.id,
        lead_id: lead.id,
        numbers: aiResult.numbers,
        report_text: aiResult.report_text,
        insights: aiResult.insights
      });
    } else {
      // AI not available, return calculations only
      db.updateReport(report.id, {
        status: 'completed',
        horosoft_data: numbers
      });
      db.updateLead(lead.id, { status: 'free_report_sent' });
      
      res.json({
        success: true,
        report_id: report.id,
        lead_id: lead.id,
        numbers: aiResult.numbers,
        report_text: null,
        message: aiResult.message || 'Numbers calculated. AI report generation pending API configuration.'
      });
    }
  } catch (err) {
    console.error('[Free Report]', err);
    res.status(500).json({ error: err.message });
  }
});

// ===== PAID REPORTS =====
router.post('/reports/paid', async (req, res) => {
  try {
    const { lead_id, tier } = req.body;
    if (!lead_id || !tier || !TIERS[tier]) return res.status(400).json({ error: 'Valid lead_id and tier required' });
    if (tier === 'free_awareness') return res.status(400).json({ error: 'Use /reports/free for free reports' });
    
    const lead = db.getLead(lead_id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    
    // Create report
    const report = db.createReport({
      lead_id,
      type: tier,
      input_data: { name: lead.name, dob: lead.dob, tob: lead.tob, pob: lead.pob }
    });
    
    // Create Razorpay order
    const order = await razorpay.createOrder(
      TIERS[tier].amount,
      'INR',
      report.id,
      { lead_id, tier, report_id: report.id }
    );
    
    // Create payment record
    const payment = db.createPayment({
      lead_id,
      report_id: report.id,
      amount: TIERS[tier].amount,
      tier,
      razorpay_order_id: order.id
    });
    
    // Get checkout config for frontend
    const checkout = razorpay.getCheckoutConfig(order, { ...lead, lead_id, tier });
    
    res.status(201).json({
      report_id: report.id,
      payment_id: payment.id,
      razorpay_order_id: order.id,
      checkout_config: checkout,
      amount: TIERS[tier].amount,
      tier_label: TIERS[tier].label
    });
  } catch (err) {
    console.error('[Paid Report]', err);
    res.status(500).json({ error: err.message });
  }
});

// Payment verification (called after Razorpay checkout)
router.post('/payments/verify', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, payment_id } = req.body;
    
    // Verify signature
    const valid = razorpay.verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
    if (!valid) return res.status(400).json({ error: 'Payment verification failed' });
    
    // Update payment
    const payment = db.updatePayment(payment_id, {
      razorpay_payment_id,
      razorpay_signature,
      status: 'captured'
    });
    
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    
    // Get lead and generate paid report
    const lead = db.getLead(payment.lead_id);
    
    // Send payment confirmation on WhatsApp
    whatsapp.sendPaymentConfirm(lead.phone, lead.name, payment.amount, payment.tier).catch(console.error);
    
    // Generate the paid report (async)
    if (payment.report_id) {
      db.updateReport(payment.report_id, { status: 'generating' });
      
      numerology.generateReport(payment.tier, lead.name, lead.dob, lead.question)
        .then(result => {
          db.updateReport(payment.report_id, {
            status: result.generated ? 'completed' : 'pending',
            ai_report: result.report_text,
            horosoft_data: result.numbers
          });
          
          if (result.generated) {
            whatsapp.sendPaidReport(lead.phone, lead.name, payment.tier, result.report_text.slice(0, 2000))
              .catch(console.error);
          }
        })
        .catch(err => {
          console.error('[Paid Report Gen]', err);
          db.updateReport(payment.report_id, { status: 'failed' });
        });
    }
    
    res.json({ success: true, payment });
  } catch (err) {
    console.error('[Payment Verify]', err);
    res.status(500).json({ error: err.message });
  }
});

// Razorpay webhook (server-to-server)
router.post('/payments/webhook', (req, res) => {
  try {
    const event = req.body;
    if (event.event === 'payment.captured') {
      const payment = event.payload?.payment?.entity;
      if (payment) {
        const payments = db.getPayments({});
        const record = payments.find(p => p.razorpay_order_id === payment.order_id);
        if (record) {
          db.updatePayment(record.id, {
            razorpay_payment_id: payment.id,
            status: 'captured',
            method: payment.method
          });
        }
      }
    }
    res.json({ status: 'ok' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/payments', (req, res) => {
  const { lead_id, status, tier } = req.query;
  res.json({ payments: db.getPayments({ lead_id, status, tier }) });
});

router.post('/payments/:id/capture', (req, res) => {
  const updated = db.updatePayment(req.params.id, { status: 'captured', method: req.body.method || 'manual' });
  if (!updated) return res.status(404).json({ error: 'Payment not found' });
  res.json({ payment: updated });
});

router.post('/payments/:id/refund', async (req, res) => {
  try {
    const payments = db.getPayments({});
    const payment = payments.find(p => p.id === req.params.id);
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    
    if (payment.razorpay_payment_id) {
      await razorpay.createRefund(payment.razorpay_payment_id, req.body.amount);
    }
    db.updatePayment(payment.id, { status: 'refunded' });
    
    // Update lead spent amount
    const lead = db.getLead(payment.lead_id);
    if (lead) {
      db.updateLead(lead.id, { total_spent: Math.max(0, lead.total_spent - payment.amount) });
    }
    
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ===== REPORTS =====
router.get('/reports', (req, res) => {
  const { lead_id, type, status } = req.query;
  res.json({ reports: db.getReports({ lead_id, type, status }) });
});

router.get('/reports/:id', (req, res) => {
  const reports = db.getReports({});
  const report = reports.find(r => r.id === req.params.id);
  if (!report) return res.status(404).json({ error: 'Report not found' });
  res.json({ report });
});

router.patch('/reports/:id', (req, res) => {
  const updated = db.updateReport(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Report not found' });
  res.json({ report: updated });
});

// ===== BOOKINGS =====
router.post('/bookings', async (req, res) => {
  try {
    const { lead_id, date, time_slot, mode, payment_id, notes } = req.body;
    if (!lead_id || !date || !time_slot) return res.status(400).json({ error: 'Lead ID, date, and time slot required' });
    
    const existing = db.getBookings({ date });
    const conflict = existing.find(b => b.time_slot === time_slot && b.status !== 'cancelled');
    if (conflict) return res.status(409).json({ error: 'Slot already booked' });
    
    const booking = db.createBooking({ lead_id, date, time_slot, mode, payment_id, notes });
    db.updateLead(lead_id, { status: 'consultation_booked' });
    
    // Send confirmation on WhatsApp
    const lead = db.getLead(lead_id);
    if (lead) {
      whatsapp.sendBookingConfirm(lead.phone, lead.name, date, time_slot, mode).catch(console.error);
    }
    
    res.status(201).json({ booking });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/bookings', (req, res) => {
  const { lead_id, status, date } = req.query;
  res.json({ bookings: db.getBookings({ lead_id, status, date }) });
});

router.patch('/bookings/:id', (req, res) => {
  const updated = db.updateBooking(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Booking not found' });
  res.json({ booking: updated });
});

router.get('/bookings/slots/:date', (req, res) => {
  const AVAILABLE_SLOTS = {
    3: ['18:30', '19:00', '19:30'],
    5: ['18:30', '19:00', '19:30'],
    6: ['11:30', '12:00', '12:30', '13:00', '13:30'],
    0: ['11:30', '12:00', '12:30', '13:00', '13:30'],
  };
  const date = new Date(req.params.date);
  const allSlots = AVAILABLE_SLOTS[date.getDay()] || [];
  const booked = db.getBookings({ date: req.params.date }).filter(b => b.status !== 'cancelled').map(b => b.time_slot);
  res.json({ date: req.params.date, slots: allSlots.map(s => ({ time: s, available: !booked.includes(s) })) });
});

// ===== NUMEROLOGY CALCULATOR (standalone) =====
router.post('/calculate', (req, res) => {
  const { name, dob } = req.body;
  if (!name || !dob) return res.status(400).json({ error: 'Name and DOB required' });
  res.json({ numbers: numerology.calcAllNumbers(name, dob) });
});

// ===== ANALYTICS =====
router.get('/stats', (req, res) => res.json(db.getStats()));
router.get('/events', (req, res) => res.json({ events: db.getEvents(parseInt(req.query.limit) || 100) }));

// ===== EXPORT =====
router.get('/export/:table', (req, res) => {
  const { table } = req.params;
  const validTables = ['leads', 'reports', 'payments', 'bookings'];
  if (!validTables.includes(table)) return res.status(400).json({ error: 'Invalid table' });
  
  let data;
  switch(table) {
    case 'leads': data = db.getLeads(); break;
    case 'reports': data = db.getReports(); break;
    case 'payments': data = db.getPayments(); break;
    case 'bookings': data = db.getBookings(); break;
  }
  
  if (req.query.format === 'csv') {
    if (data.length === 0) return res.send('');
    const headers = Object.keys(data[0]);
    const csv = [headers.join(','), ...data.map(row =>
      headers.map(h => {
        let val = row[h]; if (typeof val === 'object') val = JSON.stringify(val);
        if (typeof val === 'string' && val.includes(',')) val = `"${val}"`;
        return val;
      }).join(',')
    )].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${table}_${new Date().toISOString().split('T')[0]}.csv`);
    return res.send(csv);
  }
  res.json({ [table]: data, count: data.length });
});

module.exports = router;
