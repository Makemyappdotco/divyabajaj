const express = require('express');
const db = require('./database');

const router = express.Router();

function num(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function iso(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : '';
}

function dateKey(value) {
  const valueIso = iso(value);
  return valueIso ? valueIso.slice(0, 10) : '';
}

function daysFromQuery(value, fallback = 30) {
  const days = Math.max(1, Math.min(Number(value) || fallback, 365));
  return days;
}

function rangeStart(days) {
  return new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10);
}

function inRange(row, start) {
  return dateKey(row.created_at || row.updated_at || row.date) >= start;
}

function percent(a, b) {
  return b ? Math.round((a / b) * 10000) / 100 : 0;
}

function compactLead(lead, aggregates = {}) {
  return {
    id: lead.id,
    name: lead.name || '',
    email: lead.email || '',
    phone: lead.phone || '',
    dob: lead.dob || '',
    tob: lead.tob || '',
    pob: lead.pob || '',
    question: lead.question || '',
    source: lead.source || '',
    status: lead.status || '',
    tier: lead.tier || '',
    total_spent: num(lead.total_spent),
    notes: Array.isArray(lead.notes) ? lead.notes : [],
    utm_source: lead.utm_source || '',
    utm_medium: lead.utm_medium || '',
    utm_campaign: lead.utm_campaign || '',
    created_at: lead.created_at || '',
    updated_at: lead.updated_at || '',
    reports_count: aggregates.reports_count || 0,
    paid_reports_count: aggregates.paid_reports_count || 0,
    payments_count: aggregates.payments_count || 0,
    bookings_count: aggregates.bookings_count || 0,
    captured_revenue: aggregates.captured_revenue || 0,
    last_activity_at: aggregates.last_activity_at || lead.updated_at || lead.created_at || ''
  };
}

function compactReport(report, lead = {}) {
  const text = String(report.ai_report || '');
  const qa = report.ai_insights?.qa || null;
  return {
    id: report.id,
    lead_id: report.lead_id,
    customer_name: lead.name || '',
    customer_email: lead.email || '',
    customer_phone: lead.phone || '',
    type: report.type || '',
    status: report.status || '',
    generated_by: report.generated_by || '',
    pdf_url: report.pdf_url || '',
    word_count: text ? text.split(/\s+/).filter(Boolean).length : 0,
    report_contract_version: report.ai_insights?.report_contract_version || '',
    qa,
    generation_ms: num(report.ai_insights?.generation_ms),
    created_at: report.created_at || '',
    updated_at: report.updated_at || ''
  };
}

function buildLeadAggregates(leads, reports, payments, bookings) {
  const map = new Map(leads.map(lead => [lead.id, {
    reports_count: 0,
    paid_reports_count: 0,
    payments_count: 0,
    bookings_count: 0,
    captured_revenue: 0,
    last_activity_at: lead.updated_at || lead.created_at || ''
  }]));

  function touch(leadId, timestamp) {
    const item = map.get(leadId);
    if (!item) return;
    if (timestamp && (!item.last_activity_at || timestamp > item.last_activity_at)) item.last_activity_at = timestamp;
  }

  reports.forEach(report => {
    const item = map.get(report.lead_id);
    if (!item) return;
    item.reports_count += 1;
    if (String(report.type || '').includes('paid')) item.paid_reports_count += 1;
    touch(report.lead_id, report.updated_at || report.created_at);
  });
  payments.forEach(payment => {
    const item = map.get(payment.lead_id);
    if (!item) return;
    item.payments_count += 1;
    if (payment.status === 'captured') item.captured_revenue += num(payment.amount);
    touch(payment.lead_id, payment.updated_at || payment.created_at);
  });
  bookings.forEach(booking => {
    const item = map.get(booking.lead_id);
    if (!item) return;
    item.bookings_count += 1;
    touch(booking.lead_id, booking.updated_at || booking.created_at || booking.date);
  });
  return map;
}

function dailySeries(days, leads, reports, payments, bookings) {
  const rows = [];
  const byDate = new Map();
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(Date.now() - offset * 86400000).toISOString().slice(0, 10);
    const row = { date, customers: 0, reports: 0, revenue: 0, bookings: 0 };
    rows.push(row);
    byDate.set(date, row);
  }
  leads.forEach(item => { const row = byDate.get(dateKey(item.created_at)); if (row) row.customers += 1; });
  reports.forEach(item => { const row = byDate.get(dateKey(item.created_at)); if (row) row.reports += 1; });
  payments.filter(item => item.status === 'captured').forEach(item => {
    const row = byDate.get(dateKey(item.updated_at || item.created_at));
    if (row) row.revenue += num(item.amount);
  });
  bookings.forEach(item => { const row = byDate.get(dateKey(item.created_at || item.date)); if (row) row.bookings += 1; });
  return rows;
}

function distribution(rows, getter, limit = 8) {
  const counts = new Map();
  rows.forEach(row => {
    const key = String(getter(row) || 'Unknown').trim() || 'Unknown';
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, value]) => ({ label, value }));
}

function paginate(rows, page, limit) {
  const safeLimit = Math.max(10, Math.min(Number(limit) || 25, 100));
  const safePage = Math.max(1, Number(page) || 1);
  const total = rows.length;
  const start = (safePage - 1) * safeLimit;
  return {
    rows: rows.slice(start, start + safeLimit),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      pages: Math.max(1, Math.ceil(total / safeLimit))
    }
  };
}

async function allCoreData() {
  const [leads, reports, payments, bookings, events] = await Promise.all([
    db.getLeads(), db.getReports(), db.getPayments(), db.getBookings(), db.getEvents(500)
  ]);
  return { leads, reports, payments, bookings, events };
}

router.get('/dashboard', async (req, res) => {
  try {
    const days = daysFromQuery(req.query.days, 30);
    const start = rangeStart(days);
    const { leads, reports, payments, bookings, events } = await allCoreData();
    const captured = payments.filter(payment => payment.status === 'captured');
    const periodCaptured = captured.filter(payment => inRange(payment, start));
    const periodLeads = leads.filter(lead => inRange(lead, start));
    const periodReports = reports.filter(report => inRange(report, start));
    const periodBookings = bookings.filter(booking => inRange(booking, start));
    const customersWithPayment = new Set(captured.map(payment => payment.lead_id).filter(Boolean));
    const completedReports = reports.filter(report => report.status === 'completed').length;
    const paidReports = reports.filter(report => String(report.type || '').includes('paid'));
    const freeReports = reports.filter(report => String(report.type || '').includes('free'));
    const upcomingBookings = bookings.filter(booking => {
      const date = String(booking.date || '').slice(0, 10);
      return date >= new Date().toISOString().slice(0, 10) && !['cancelled', 'completed'].includes(booking.status);
    });

    return res.json({
      success: true,
      storage: db.storageHealth(),
      range: { days, start, end: new Date().toISOString().slice(0, 10) },
      kpis: {
        total_customers: leads.length,
        new_customers: periodLeads.length,
        total_reports: reports.length,
        reports_in_range: periodReports.length,
        paid_reports: paidReports.length,
        free_reports: freeReports.length,
        report_success_rate: percent(completedReports, reports.length),
        revenue_total: captured.reduce((sum, payment) => sum + num(payment.amount), 0),
        revenue_in_range: periodCaptured.reduce((sum, payment) => sum + num(payment.amount), 0),
        average_order_value: captured.length ? Math.round(captured.reduce((sum, payment) => sum + num(payment.amount), 0) / captured.length) : 0,
        paid_conversion: percent(customersWithPayment.size, leads.length),
        bookings_total: bookings.length,
        bookings_in_range: periodBookings.length,
        upcoming_bookings: upcomingBookings.length
      },
      trends: dailySeries(days, leads, reports, payments, bookings),
      report_types: distribution(reports, report => report.type),
      customer_sources: distribution(leads, lead => lead.source || lead.utm_source),
      payment_statuses: distribution(payments, payment => payment.status),
      recent_activity: events.slice(0, 30)
    });
  } catch (error) {
    console.error('[Admin dashboard error]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/customers', async (req, res) => {
  try {
    const [leads, reports, payments, bookings] = await Promise.all([
      db.getLeads(), db.getReports(), db.getPayments(), db.getBookings()
    ]);
    const aggregates = buildLeadAggregates(leads, reports, payments, bookings);
    let rows = leads.map(lead => compactLead(lead, aggregates.get(lead.id)));
    const search = String(req.query.search || '').trim().toLowerCase();
    if (search) {
      rows = rows.filter(row => [row.name, row.email, row.phone, row.pob, row.question, row.source]
        .some(value => String(value || '').toLowerCase().includes(search)));
    }
    if (req.query.status) rows = rows.filter(row => row.status === req.query.status);
    if (req.query.tier) rows = rows.filter(row => row.tier === req.query.tier);
    rows.sort((a, b) => String(b.last_activity_at).localeCompare(String(a.last_activity_at)));
    const result = paginate(rows, req.query.page, req.query.limit);
    return res.json({ success: true, storage: db.storageHealth(), customers: result.rows, pagination: result.pagination });
  } catch (error) {
    console.error('[Admin customers error]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/customers/:id', async (req, res) => {
  try {
    const lead = await db.getLead(req.params.id);
    if (!lead) return res.status(404).json({ success: false, error: 'Customer not found' });
    const [reports, payments, bookings, events] = await Promise.all([
      db.getReports({ lead_id: lead.id }),
      db.getPayments({ lead_id: lead.id }),
      db.getBookings({ lead_id: lead.id }),
      db.getEvents(1000)
    ]);
    const leadEvents = events.filter(event => event.entity_id === lead.id || reports.some(report => event.entity_id === report.id));
    const timeline = [
      ...reports.map(item => ({ kind: 'report', id: item.id, title: item.type, status: item.status, at: item.created_at, data: compactReport(item, lead) })),
      ...payments.map(item => ({ kind: 'payment', id: item.id, title: `${item.status} payment`, status: item.status, at: item.created_at, data: item })),
      ...bookings.map(item => ({ kind: 'booking', id: item.id, title: 'Consultation booking', status: item.status, at: item.created_at || item.date, data: item })),
      ...leadEvents.map(item => ({ kind: 'activity', id: item.id, title: item.type, status: '', at: item.created_at, data: item.data }))
    ].sort((a, b) => String(b.at).localeCompare(String(a.at)));

    const aggregates = buildLeadAggregates([lead], reports, payments, bookings).get(lead.id);
    return res.json({
      success: true,
      customer: compactLead(lead, aggregates),
      reports: reports.map(report => compactReport(report, lead)),
      payments,
      bookings,
      timeline
    });
  } catch (error) {
    console.error('[Admin customer detail error]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.patch('/customers/:id', async (req, res) => {
  try {
    const allowed = {};
    if (typeof req.body.status === 'string') allowed.status = req.body.status.trim();
    if (typeof req.body.tier === 'string') allowed.tier = req.body.tier.trim();
    if (Array.isArray(req.body.notes)) allowed.notes = req.body.notes.slice(-100);
    if (!Object.keys(allowed).length) return res.status(400).json({ success: false, error: 'No supported customer fields supplied' });
    const customer = await db.updateLead(req.params.id, allowed);
    if (!customer) return res.status(404).json({ success: false, error: 'Customer not found' });
    return res.json({ success: true, customer });
  } catch (error) {
    console.error('[Admin customer update error]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/reports', async (req, res) => {
  try {
    const [reports, leads] = await Promise.all([db.getReports(), db.getLeads()]);
    const leadMap = new Map(leads.map(lead => [lead.id, lead]));
    let rows = reports.map(report => compactReport(report, leadMap.get(report.lead_id) || {}));
    const search = String(req.query.search || '').trim().toLowerCase();
    if (search) rows = rows.filter(row => [row.id, row.customer_name, row.customer_email, row.customer_phone, row.type, row.status, row.generated_by]
      .some(value => String(value || '').toLowerCase().includes(search)));
    if (req.query.type) rows = rows.filter(row => row.type === req.query.type);
    if (req.query.status) rows = rows.filter(row => row.status === req.query.status);
    const result = paginate(rows, req.query.page, req.query.limit);
    return res.json({ success: true, reports: result.rows, pagination: result.pagination });
  } catch (error) {
    console.error('[Admin reports error]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/reports/:id', async (req, res) => {
  try {
    const report = await db.getReport(req.params.id);
    if (!report) return res.status(404).json({ success: false, error: 'Report not found' });
    const [lead, documents] = await Promise.all([
      db.getLead(report.lead_id),
      db.getGeneratedDocuments({ report_id: report.id })
    ]);
    return res.json({ success: true, report, customer: lead || null, documents });
  } catch (error) {
    console.error('[Admin report detail error]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/payments', async (req, res) => {
  try {
    const [payments, leads] = await Promise.all([db.getPayments(), db.getLeads()]);
    const leadMap = new Map(leads.map(lead => [lead.id, lead]));
    let rows = payments.map(payment => ({
      ...payment,
      customer_name: leadMap.get(payment.lead_id)?.name || '',
      customer_phone: leadMap.get(payment.lead_id)?.phone || ''
    }));
    if (req.query.status) rows = rows.filter(row => row.status === req.query.status);
    const result = paginate(rows, req.query.page, req.query.limit);
    return res.json({ success: true, payments: result.rows, pagination: result.pagination });
  } catch (error) {
    console.error('[Admin payments error]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/bookings', async (req, res) => {
  try {
    const [bookings, leads] = await Promise.all([db.getBookings(), db.getLeads()]);
    const leadMap = new Map(leads.map(lead => [lead.id, lead]));
    let rows = bookings.map(booking => ({
      ...booking,
      customer_name: leadMap.get(booking.lead_id)?.name || '',
      customer_phone: leadMap.get(booking.lead_id)?.phone || ''
    }));
    if (req.query.status) rows = rows.filter(row => row.status === req.query.status);
    const result = paginate(rows, req.query.page, req.query.limit);
    return res.json({ success: true, bookings: result.rows, pagination: result.pagination });
  } catch (error) {
    console.error('[Admin bookings error]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/activity', async (req, res) => {
  try {
    const events = await db.getEvents(Math.min(Number(req.query.limit) || 200, 1000));
    return res.json({ success: true, events });
  } catch (error) {
    console.error('[Admin activity error]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/system', async (req, res) => {
  try {
    const health = db.storageHealth();
    let storage_probe = { ok: false, message: health.warning || '' };
    try {
      await db.getLeads({});
      storage_probe = { ok: true, message: health.persistent ? 'Persistent database read succeeded.' : 'Local development storage read succeeded.' };
    } catch (error) {
      storage_probe = { ok: false, message: error.message };
    }
    return res.json({
      success: true,
      storage: health,
      storage_probe,
      services: {
        openai_configured: Boolean(process.env.OPENAI_API_KEY),
        astrologyapi_configured: Boolean(process.env.ASTROLOGYAPI_V2_ACCESS_TOKEN || process.env.ASTROLOGYAPI_ACCESS_TOKEN),
        admin_credentials_configured: Boolean(process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD),
        environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'local'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Admin system error]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
