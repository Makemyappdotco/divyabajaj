const express = require('express');
const db = require('./database');

const router = express.Router();

function num(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function reportTypesFor(reports) {
  const map = new Map();
  reports.forEach(report => {
    if (!report.lead_id) return;
    if (!map.has(report.lead_id)) map.set(report.lead_id, new Set());
    if (report.type) map.get(report.lead_id).add(String(report.type));
  });
  return map;
}

function tierMatchesHistory(requestedTier, lead, types) {
  const tier = String(requestedTier || '').trim();
  if (!tier) return true;
  if (String(lead.tier || '') === tier) return true;

  const history = types || new Set();
  if (tier === 'free_awareness') {
    return history.has('free_numerology_awareness') || history.has('free_awareness');
  }
  return history.has(tier);
}

function buildAggregates(leads, reports, payments, bookings) {
  const map = new Map(leads.map(lead => [lead.id, {
    reports_count: 0,
    paid_reports_count: 0,
    payments_count: 0,
    bookings_count: 0,
    captured_revenue: 0,
    last_activity_at: lead.updated_at || lead.created_at || ''
  }]));

  function touch(leadId, at) {
    const row = map.get(leadId);
    if (!row || !at) return;
    if (!row.last_activity_at || String(at) > String(row.last_activity_at)) row.last_activity_at = at;
  }

  reports.forEach(report => {
    const row = map.get(report.lead_id);
    if (!row) return;
    row.reports_count += 1;
    if (String(report.type || '').includes('paid') || String(report.type || '').includes('personal_life_blueprint')) {
      row.paid_reports_count += 1;
    }
    touch(report.lead_id, report.updated_at || report.created_at);
  });

  payments.forEach(payment => {
    const row = map.get(payment.lead_id);
    if (!row) return;
    row.payments_count += 1;
    if (payment.status === 'captured') row.captured_revenue += num(payment.amount);
    touch(payment.lead_id, payment.updated_at || payment.created_at);
  });

  bookings.forEach(booking => {
    const row = map.get(booking.lead_id);
    if (!row) return;
    row.bookings_count += 1;
    touch(booking.lead_id, booking.updated_at || booking.created_at || booking.date);
  });
  return map;
}

function customerRow(lead, aggregate, reportTypes) {
  const stats = aggregate || {};
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
    report_types: Array.from(reportTypes || []).sort(),
    total_spent: num(lead.total_spent),
    notes: Array.isArray(lead.notes) ? lead.notes : [],
    utm_source: lead.utm_source || '',
    utm_medium: lead.utm_medium || '',
    utm_campaign: lead.utm_campaign || '',
    created_at: lead.created_at || '',
    updated_at: lead.updated_at || '',
    reports_count: stats.reports_count || 0,
    paid_reports_count: stats.paid_reports_count || 0,
    payments_count: stats.payments_count || 0,
    bookings_count: stats.bookings_count || 0,
    captured_revenue: stats.captured_revenue || 0,
    last_activity_at: stats.last_activity_at || lead.updated_at || lead.created_at || ''
  };
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

// Intercept only tier-filtered customer requests. The main admin router continues
// to own unfiltered customer lists and all customer detail/update routes.
router.get('/customers', async (req, res, next) => {
  const requestedTier = String(req.query.tier || '').trim();
  if (!requestedTier) return next();

  try {
    const [leads, reports, payments, bookings] = await Promise.all([
      db.getLeads(),
      db.getReports(),
      db.getPayments(),
      db.getBookings()
    ]);

    const typeMap = reportTypesFor(reports);
    const aggregates = buildAggregates(leads, reports, payments, bookings);
    let rows = leads
      .filter(lead => tierMatchesHistory(requestedTier, lead, typeMap.get(lead.id)))
      .map(lead => customerRow(lead, aggregates.get(lead.id), typeMap.get(lead.id)));

    const search = String(req.query.search || '').trim().toLowerCase();
    if (search) {
      rows = rows.filter(row => [row.name, row.email, row.phone, row.pob, row.question, row.source]
        .some(value => String(value || '').toLowerCase().includes(search)));
    }
    if (req.query.status) rows = rows.filter(row => row.status === req.query.status);

    rows.sort((a, b) => String(b.last_activity_at).localeCompare(String(a.last_activity_at)));
    const result = paginate(rows, req.query.page, req.query.limit);
    return res.json({
      success: true,
      storage: db.storageHealth(),
      filter_semantics: 'report_history_membership',
      customers: result.rows,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('[Admin customer tier-history filter error]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
