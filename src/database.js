const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const localDb = require('./database.local');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const supabase = SUPABASE_URL && SUPABASE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  : null;

function id(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

function now() {
  return new Date().toISOString();
}

function usingSupabase() {
  return Boolean(supabase);
}

function cleanEventData(data = {}) {
  const clone = { ...data };
  delete clone.ai_report;
  delete clone.horosoft_data;
  delete clone.astrology_data;
  delete clone.input_data;
  return clone;
}

async function throwIfError(result, context) {
  if (result.error) throw new Error(`${context}: ${result.error.message}`);
  return result.data;
}

async function logEvent(type, entity, entity_id, data = {}) {
  if (!supabase) return localDb.logEvent(type, entity, entity_id, data);
  const row = {
    id: id('evt'),
    type,
    entity,
    entity_id,
    data: cleanEventData(data),
    created_at: now()
  };
  const result = await supabase.from('events').insert(row).select().single();
  return throwIfError(result, 'Create event failed');
}

async function getLeads(filters = {}) {
  if (!supabase) return localDb.getLeads(filters);
  let query = supabase.from('leads').select('*').order('created_at', { ascending: false });
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.tier) query = query.eq('tier', filters.tier);
  if (filters.from) query = query.gte('created_at', filters.from);
  if (filters.to) query = query.lte('created_at', filters.to);
  const result = await query;
  let rows = await throwIfError(result, 'Fetch leads failed');
  if (filters.search) {
    const q = String(filters.search).toLowerCase();
    rows = rows.filter(row => [row.name, row.phone, row.email].some(v => String(v || '').toLowerCase().includes(q)));
  }
  return rows;
}

async function createLead(data) {
  if (!supabase) return localDb.createLead(data);
  const row = {
    id: id('lead'),
    name: data.name,
    phone: data.phone,
    email: data.email || '',
    dob: data.dob,
    tob: data.tob || '',
    pob: data.pob || '',
    question: data.question || '',
    source: data.source || 'website',
    utm_source: data.utm_source || '',
    utm_medium: data.utm_medium || '',
    utm_campaign: data.utm_campaign || '',
    status: data.status || 'new',
    tier: data.tier || 'free_awareness',
    total_spent: Number(data.total_spent) || 0,
    notes: data.notes || [],
    created_at: now(),
    updated_at: now()
  };
  const result = await supabase.from('leads').insert(row).select().single();
  const created = await throwIfError(result, 'Create lead failed');
  await logEvent('leads.created', 'leads', created.id, created);
  return created;
}

async function getLead(leadId) {
  if (!supabase) return localDb.getLead(leadId);
  const result = await supabase.from('leads').select('*').eq('id', leadId).maybeSingle();
  return throwIfError(result, 'Fetch lead failed');
}

async function updateLead(leadId, updates) {
  if (!supabase) return localDb.updateLead(leadId, updates);
  const result = await supabase.from('leads').update({ ...updates, updated_at: now() }).eq('id', leadId).select().maybeSingle();
  const updated = await throwIfError(result, 'Update lead failed');
  if (updated) await logEvent('leads.updated', 'leads', leadId, updates);
  return updated;
}

async function getReports(filters = {}) {
  if (!supabase) return localDb.getReports(filters);
  let query = supabase.from('reports').select('*').order('created_at', { ascending: false });
  if (filters.lead_id) query = query.eq('lead_id', filters.lead_id);
  if (filters.type) query = query.eq('type', filters.type);
  if (filters.status) query = query.eq('status', filters.status);
  const result = await query;
  return throwIfError(result, 'Fetch reports failed');
}

async function createReport(data) {
  if (!supabase) return localDb.createReport(data);
  const row = {
    id: id('rep'),
    lead_id: data.lead_id,
    type: data.type || 'free_awareness',
    status: data.status || 'created',
    input_data: data.input_data || {},
    horosoft_data: data.horosoft_data || null,
    astrology_data: data.astrology_data || null,
    ai_report: data.ai_report || '',
    ai_insights: data.ai_insights || null,
    generated_by: data.generated_by || '',
    pdf_url: data.pdf_url || '',
    created_at: now(),
    updated_at: now()
  };
  const result = await supabase.from('reports').insert(row).select().single();
  const created = await throwIfError(result, 'Create report failed');
  await logEvent('reports.created', 'reports', created.id, created);
  return created;
}

async function updateReport(reportId, updates) {
  if (!supabase) return localDb.updateReport(reportId, updates);
  const result = await supabase.from('reports').update({ ...updates, updated_at: now() }).eq('id', reportId).select().maybeSingle();
  const updated = await throwIfError(result, 'Update report failed');
  if (updated) await logEvent('reports.updated', 'reports', reportId, updates);
  return updated;
}

async function getPayments(filters = {}) {
  if (!supabase) return localDb.getPayments(filters);
  let query = supabase.from('payments').select('*').order('created_at', { ascending: false });
  if (filters.lead_id) query = query.eq('lead_id', filters.lead_id);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.tier) query = query.eq('tier', filters.tier);
  const result = await query;
  return throwIfError(result, 'Fetch payments failed');
}

async function createPayment(data) {
  if (!supabase) return localDb.createPayment(data);
  const row = {
    id: id('pay'), lead_id: data.lead_id, report_id: data.report_id || '',
    amount: Number(data.amount) || 0, currency: data.currency || 'INR', tier: data.tier || '',
    status: data.status || 'created', razorpay_order_id: data.razorpay_order_id || '',
    razorpay_payment_id: data.razorpay_payment_id || '', razorpay_signature: data.razorpay_signature || '',
    method: data.method || '', created_at: now(), updated_at: now()
  };
  const result = await supabase.from('payments').insert(row).select().single();
  const created = await throwIfError(result, 'Create payment failed');
  await logEvent('payments.created', 'payments', created.id, created);
  return created;
}

async function updatePayment(paymentId, updates) {
  if (!supabase) return localDb.updatePayment(paymentId, updates);
  const result = await supabase.from('payments').update({ ...updates, updated_at: now() }).eq('id', paymentId).select().maybeSingle();
  const payment = await throwIfError(result, 'Update payment failed');
  if (payment && updates.status === 'captured') {
    const lead = await getLead(payment.lead_id);
    if (lead) await updateLead(lead.id, { total_spent: (Number(lead.total_spent) || 0) + (Number(payment.amount) || 0), tier: payment.tier || lead.tier });
  }
  if (payment) await logEvent('payments.updated', 'payments', paymentId, updates);
  return payment;
}

async function getBookings(filters = {}) {
  if (!supabase) return localDb.getBookings(filters);
  let query = supabase.from('bookings').select('*').order('created_at', { ascending: false });
  if (filters.lead_id) query = query.eq('lead_id', filters.lead_id);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.date) query = query.eq('date', filters.date);
  const result = await query;
  return throwIfError(result, 'Fetch bookings failed');
}

async function createBooking(data) {
  if (!supabase) return localDb.createBooking(data);
  const row = {
    id: id('book'), lead_id: data.lead_id, date: data.date, time_slot: data.time_slot,
    mode: data.mode || 'online', payment_id: data.payment_id || '', notes: data.notes || '',
    status: data.status || 'confirmed', created_at: now(), updated_at: now()
  };
  const result = await supabase.from('bookings').insert(row).select().single();
  const created = await throwIfError(result, 'Create booking failed');
  await logEvent('bookings.created', 'bookings', created.id, created);
  return created;
}

async function updateBooking(bookingId, updates) {
  if (!supabase) return localDb.updateBooking(bookingId, updates);
  const result = await supabase.from('bookings').update({ ...updates, updated_at: now() }).eq('id', bookingId).select().maybeSingle();
  const updated = await throwIfError(result, 'Update booking failed');
  if (updated) await logEvent('bookings.updated', 'bookings', bookingId, updates);
  return updated;
}

async function getEvents(limit = 100) {
  if (!supabase) return localDb.getEvents(limit);
  const result = await supabase.from('events').select('*').order('created_at', { ascending: false }).limit(limit);
  return throwIfError(result, 'Fetch events failed');
}

async function getStats() {
  if (!supabase) return localDb.getStats();
  const [leads, reports, payments, bookings, recentEvents] = await Promise.all([
    getLeads(), getReports(), getPayments(), getBookings(), getEvents(20)
  ]);
  const paid = payments.filter(p => p.status === 'captured');
  const revenue = paid.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const today = new Date().toISOString().slice(0, 10);
  return {
    leads: leads.length,
    reports: reports.length,
    payments: payments.length,
    bookings: bookings.length,
    revenue,
    conversion_rate: leads.length ? Math.round((paid.length / leads.length) * 10000) / 100 : 0,
    today: {
      leads: leads.filter(l => l.created_at && l.created_at.startsWith(today)).length,
      reports: reports.filter(r => r.created_at && r.created_at.startsWith(today)).length,
      revenue: paid.filter(p => p.updated_at && p.updated_at.startsWith(today)).reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
    },
    recent_events: recentEvents
  };
}

module.exports = {
  usingSupabase,
  getLeads, createLead, getLead, updateLead,
  getReports, createReport, updateReport,
  getPayments, createPayment, updatePayment,
  getBookings, createBooking, updateBooking,
  getEvents, getStats, logEvent
};
