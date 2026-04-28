const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const DATA_DIR = isVercel ? '/tmp/divya-bajaj-data' : path.join(__dirname, '..', 'data');
const TABLES = ['leads', 'reports', 'payments', 'bookings', 'events'];

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  for (const table of TABLES) {
    const file = filePath(table);
    if (!fs.existsSync(file)) fs.writeFileSync(file, '[]');
  }
}

function filePath(table) {
  return path.join(DATA_DIR, `${table}.json`);
}

function id(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

function now() {
  return new Date().toISOString();
}

function read(table) {
  ensureStore();
  try {
    return JSON.parse(fs.readFileSync(filePath(table), 'utf8') || '[]');
  } catch (error) {
    return [];
  }
}

function write(table, rows) {
  ensureStore();
  fs.writeFileSync(filePath(table), JSON.stringify(rows, null, 2));
}

function logEvent(type, entity, entity_id, data = {}) {
  const events = read('events');
  const event = { id: id('evt'), type, entity, entity_id, data, created_at: now() };
  events.unshift(event);
  write('events', events.slice(0, 1000));
  return event;
}

function create(table, prefix, data) {
  const rows = read(table);
  const row = { id: id(prefix), ...data, created_at: now(), updated_at: now() };
  rows.unshift(row);
  write(table, rows);
  logEvent(`${table}.created`, table, row.id, row);
  return row;
}

function update(table, rowId, updates) {
  const rows = read(table);
  const index = rows.findIndex(row => row.id === rowId);
  if (index === -1) return null;
  rows[index] = { ...rows[index], ...updates, updated_at: now() };
  write(table, rows);
  logEvent(`${table}.updated`, table, rowId, updates);
  return rows[index];
}

function getLeads(filters = {}) {
  let leads = read('leads');
  if (filters.status) leads = leads.filter(l => l.status === filters.status);
  if (filters.tier) leads = leads.filter(l => l.tier === filters.tier);
  if (filters.from) leads = leads.filter(l => l.created_at >= filters.from);
  if (filters.to) leads = leads.filter(l => l.created_at <= filters.to);
  if (filters.search) {
    const q = String(filters.search).toLowerCase();
    leads = leads.filter(l => [l.name, l.phone, l.email].some(v => String(v || '').toLowerCase().includes(q)));
  }
  return leads;
}

function createLead(data) {
  return create('leads', 'lead', {
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
    total_spent: data.total_spent || 0,
    notes: data.notes || []
  });
}

function getLead(leadId) {
  return read('leads').find(l => l.id === leadId) || null;
}

function updateLead(leadId, updates) {
  return update('leads', leadId, updates);
}

function getReports(filters = {}) {
  let reports = read('reports');
  if (filters.lead_id) reports = reports.filter(r => r.lead_id === filters.lead_id);
  if (filters.type) reports = reports.filter(r => r.type === filters.type);
  if (filters.status) reports = reports.filter(r => r.status === filters.status);
  return reports;
}

function createReport(data) {
  return create('reports', 'rep', {
    lead_id: data.lead_id,
    type: data.type || 'free_awareness',
    status: data.status || 'created',
    input_data: data.input_data || {},
    horosoft_data: data.horosoft_data || null,
    ai_report: data.ai_report || '',
    ai_insights: data.ai_insights || null
  });
}

function updateReport(reportId, updates) {
  return update('reports', reportId, updates);
}

function getPayments(filters = {}) {
  let payments = read('payments');
  if (filters.lead_id) payments = payments.filter(p => p.lead_id === filters.lead_id);
  if (filters.status) payments = payments.filter(p => p.status === filters.status);
  if (filters.tier) payments = payments.filter(p => p.tier === filters.tier);
  return payments;
}

function createPayment(data) {
  return create('payments', 'pay', {
    lead_id: data.lead_id,
    report_id: data.report_id || '',
    amount: data.amount || 0,
    currency: data.currency || 'INR',
    tier: data.tier || '',
    status: data.status || 'created',
    razorpay_order_id: data.razorpay_order_id || '',
    razorpay_payment_id: data.razorpay_payment_id || '',
    razorpay_signature: data.razorpay_signature || '',
    method: data.method || ''
  });
}

function updatePayment(paymentId, updates) {
  const payment = update('payments', paymentId, updates);
  if (payment && updates.status === 'captured') {
    const lead = getLead(payment.lead_id);
    if (lead) updateLead(lead.id, { total_spent: (lead.total_spent || 0) + (payment.amount || 0), tier: payment.tier || lead.tier });
  }
  return payment;
}

function getBookings(filters = {}) {
  let bookings = read('bookings');
  if (filters.lead_id) bookings = bookings.filter(b => b.lead_id === filters.lead_id);
  if (filters.status) bookings = bookings.filter(b => b.status === filters.status);
  if (filters.date) bookings = bookings.filter(b => b.date === filters.date);
  return bookings;
}

function createBooking(data) {
  return create('bookings', 'book', {
    lead_id: data.lead_id,
    date: data.date,
    time_slot: data.time_slot,
    mode: data.mode || 'online',
    payment_id: data.payment_id || '',
    notes: data.notes || '',
    status: data.status || 'confirmed'
  });
}

function updateBooking(bookingId, updates) {
  return update('bookings', bookingId, updates);
}

function getEvents(limit = 100) {
  return read('events').slice(0, limit);
}

function getStats() {
  const leads = read('leads');
  const reports = read('reports');
  const payments = read('payments');
  const bookings = read('bookings');
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
    recent_events: getEvents(20)
  };
}

module.exports = {
  getLeads, createLead, getLead, updateLead,
  getReports, createReport, updateReport,
  getPayments, createPayment, updatePayment,
  getBookings, createBooking, updateBooking,
  getEvents, getStats, logEvent
};
