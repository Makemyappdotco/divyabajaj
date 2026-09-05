// Read-only analytics for the admin panel.
//
// Two rules shape this file.
//
// 1. Never pull whole rows. A report row carries ai_report, report_json,
//    astrology_data and ai_insights - ai_insights alone averages 10 kB, the row
//    around 60 kB. The old dashboard fetched every column of every row just to
//    count them, which is fine at 30 reports and falls over well before 10,000.
//    Report reads therefore go through the admin_report_metrics view, which
//    exposes the scalar fields (including generation_seconds, lifted out of
//    ai_insights) and joins the lead name, with no JSONB crossing the wire.
//
// 2. Never mix environments. Rows carry environment 'production' or 'test', and
//    the old dashboard counted both, so 24 test reports were being presented as
//    real volume. Every query takes an explicit environment scope.

const { getSupabaseClient } = require('../database');

const METRICS_VIEW = 'admin_report_metrics';
const DAY_MS = 24 * 60 * 60 * 1000;

const LIST_COLUMNS = [
  'id', 'lead_id', 'lead_name', 'lead_email', 'type', 'category', 'status',
  'environment', 'created_at', 'completed_at', 'generation_seconds',
  'generated_by', 'pdf_url', 'pdf_template_version', 'failure_code', 'failure_message'
].join(', ');

function isoDaysAgo(days) {
  return new Date(Date.now() - days * DAY_MS).toISOString();
}

function dayKey(iso) {
  return String(iso || '').slice(0, 10);
}

function toSeconds(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function percentile(sorted, fraction) {
  if (!sorted.length) return null;
  return sorted[Math.min(sorted.length - 1, Math.floor(fraction * sorted.length))];
}

function summariseDurations(values) {
  const clean = values.map(toSeconds).filter(v => v !== null).sort((a, b) => a - b);
  if (!clean.length) return { measured: 0, average: null, median: null, p90: null, slowest: null };
  const total = clean.reduce((sum, v) => sum + v, 0);
  const round = n => Math.round(n * 10) / 10;
  return {
    measured: clean.length,
    average: round(total / clean.length),
    median: round(percentile(clean, 0.5)),
    p90: round(percentile(clean, 0.9)),
    slowest: round(clean[clean.length - 1])
  };
}

function countBy(rows, keyFn) {
  const out = {};
  rows.forEach(row => {
    const key = keyFn(row);
    out[key] = (out[key] || 0) + 1;
  });
  return out;
}

function applyEnvironment(query, environment) {
  return environment === 'all' ? query : query.eq('environment', environment);
}

async function unwrap(promise, context) {
  const { data, error, count } = await promise;
  if (error) throw new Error(`${context}: ${error.message}`);
  return { data: data || [], count: count ?? null };
}

/** Everything the overview screen needs, in a handful of small queries. */
async function getOverview({ environment = 'production', days = 30 } = {}) {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const since = isoDaysAgo(days);

  const [reports, leads, payments, bookings, appointments] = await Promise.all([
    unwrap(
      applyEnvironment(
        supabase.from(METRICS_VIEW).select('id, category, status, created_at, generated_by, generation_seconds'),
        environment
      ).gte('created_at', since).order('created_at', { ascending: true }),
      'overview reports'
    ),
    unwrap(
      applyEnvironment(
        supabase.from('leads').select('id, created_at, status, tier, source, utm_source'),
        environment
      ).gte('created_at', since),
      'overview leads'
    ),
    unwrap(supabase.from('payments').select('amount, status, created_at').gte('created_at', since), 'overview payments'),
    unwrap(supabase.from('bookings').select('id, status, created_at').gte('created_at', since), 'overview bookings'),
    unwrap(supabase.from('appointments').select('id, status, starts_at').gte('created_at', since), 'overview appointments')
  ]);

  const rows = reports.data;
  const completed = rows.filter(r => r.status === 'completed');
  const failed = rows.filter(r => r.status === 'failed');
  const free = rows.filter(r => r.category === 'free');
  const paid = rows.filter(r => r.category === 'paid');

  // zero-filled daily series so the chart has no gaps
  const series = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    series.push({ date: dayKey(new Date(Date.now() - i * DAY_MS).toISOString()), free: 0, paid: 0, failed: 0, leads: 0 });
  }
  const byDate = new Map(series.map(p => [p.date, p]));
  rows.forEach(r => {
    const point = byDate.get(dayKey(r.created_at));
    if (!point) return;
    if (r.status === 'failed') point.failed += 1;
    else if (r.category === 'free') point.free += 1;
    else point.paid += 1;
  });
  leads.data.forEach(l => {
    const point = byDate.get(dayKey(l.created_at));
    if (point) point.leads += 1;
  });

  const captured = payments.data.filter(p => p.status === 'captured');
  const today = dayKey(new Date().toISOString());
  const nowIso = new Date().toISOString();

  return {
    window_days: days,
    environment,
    generated_at: nowIso,
    reports: {
      total: rows.length,
      free: free.length,
      paid: paid.length,
      completed: completed.length,
      failed: failed.length,
      success_rate: rows.length ? Math.round((completed.length / rows.length) * 1000) / 10 : null,
      today: rows.filter(r => dayKey(r.created_at) === today).length
    },
    generation_time_seconds: {
      all: summariseDurations(completed.map(r => r.generation_seconds)),
      free: summariseDurations(completed.filter(r => r.category === 'free').map(r => r.generation_seconds)),
      paid: summariseDurations(completed.filter(r => r.category === 'paid').map(r => r.generation_seconds))
    },
    leads: {
      total: leads.data.length,
      today: leads.data.filter(l => dayKey(l.created_at) === today).length,
      by_status: countBy(leads.data, l => l.status || 'unknown'),
      by_source: countBy(leads.data, l => l.utm_source || l.source || 'direct')
    },
    consultations: {
      bookings: bookings.data.length,
      appointments: appointments.data.length,
      upcoming: appointments.data.filter(a => a.starts_at && a.starts_at > nowIso).length
    },
    revenue: {
      captured: captured.reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
      transactions: captured.length,
      currency: 'INR'
    },
    models: countBy(rows, r => r.generated_by || 'unknown'),
    series
  };
}

/**
 * Paginated report list. The row count comes back from the database rather than
 * from measuring a fetched array, so paging stays cheap at any table size.
 */
async function listReports({
  environment = 'production', category = 'all', status = 'all',
  search = '', page = 1, pageSize = 25
} = {}) {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const size = Math.min(Math.max(1, Number(pageSize) || 25), 200);
  const from = (Math.max(1, Number(page) || 1) - 1) * size;

  let query = applyEnvironment(
    supabase.from(METRICS_VIEW).select(LIST_COLUMNS, { count: 'exact' }),
    environment
  );
  if (status !== 'all') query = query.eq('status', status);
  if (category !== 'all') query = query.eq('category', category);
  const term = String(search || '').trim();
  if (term) query = query.or(`lead_name.ilike.%${term}%,lead_email.ilike.%${term}%,id.ilike.%${term}%`);

  const { data, count } = await unwrap(
    query.order('created_at', { ascending: false }).range(from, from + size - 1),
    'list reports'
  );
  return { page: Number(page) || 1, page_size: size, total: count, rows: data };
}

/**
 * Customer list, with each lead's report counts folded in so the table is
 * useful without opening every record.
 */
async function listCustomers({ environment = 'production', search = '', page = 1, pageSize = 25 } = {}) {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const size = Math.min(Math.max(1, Number(pageSize) || 25), 200);
  const from = (Math.max(1, Number(page) || 1) - 1) * size;

  let query = applyEnvironment(
    supabase.from('leads').select(
      'id, name, email, phone, dob, tob, pob, status, tier, source, utm_source, total_spent, created_at, last_activity_at',
      { count: 'exact' }
    ),
    environment
  );
  const term = String(search || '').trim();
  if (term) query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`);

  const { data, count } = await unwrap(
    query.order('created_at', { ascending: false }).range(from, from + size - 1),
    'list customers'
  );

  const ids = data.map(l => l.id);
  const reportRows = ids.length
    ? (await unwrap(
        supabase.from(METRICS_VIEW).select('lead_id, category, status, created_at').in('lead_id', ids),
        'customer report counts'
      )).data
    : [];

  // Consultations live in their own table, so a customer who has only ever
  // booked a call would otherwise show as having nothing.
  const consultRows = ids.length
    ? (await unwrap(
        applyEnvironment(
          supabase.from('appointments').select('lead_id, status').in('lead_id', ids),
          environment
        ),
        'customer consultation counts'
      )).data
    : [];

  const blank = () => ({ total: 0, free: 0, paid: 0, failed: 0, consultations: 0, last: null });
  const byLead = new Map();
  reportRows.forEach(r => {
    const entry = byLead.get(r.lead_id) || blank();
    entry.total += 1;
    if (r.status === 'failed') entry.failed += 1;
    else if (r.category === 'free') entry.free += 1;
    else entry.paid += 1;
    if (!entry.last || r.created_at > entry.last) entry.last = r.created_at;
    byLead.set(r.lead_id, entry);
  });
  consultRows.forEach(a => {
    if (a.status === 'cancelled') return;
    const entry = byLead.get(a.lead_id) || blank();
    entry.consultations += 1;
    byLead.set(a.lead_id, entry);
  });

  return {
    page: Number(page) || 1, page_size: size, total: count,
    rows: data.map(l => ({ ...l, reports: byLead.get(l.id) || blank() }))
  };
}

/** Everything known about one customer, for the detail view. */
async function getCustomer(leadId) {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const [lead, reports, events, payments, bookings, appointments, messages] = await Promise.all([
    unwrap(supabase.from('leads').select('*').eq('id', leadId).limit(1), 'customer lead'),
    unwrap(
      supabase.from(METRICS_VIEW).select(LIST_COLUMNS).eq('lead_id', leadId).order('created_at', { ascending: false }),
      'customer reports'
    ),
    unwrap(
      supabase.from('events').select('id, type, entity, entity_id, created_at')
        .eq('entity_id', leadId).order('created_at', { ascending: false }).limit(50),
      'customer events'
    ),
    unwrap(supabase.from('payments').select('*').eq('lead_id', leadId), 'customer payments'),
    unwrap(supabase.from('bookings').select('*').eq('lead_id', leadId), 'customer bookings'),
    unwrap(supabase.from('appointments').select('*').eq('lead_id', leadId), 'customer appointments'),
    unwrap(
      supabase.from('communication_messages')
        .select('id, channel, status, subject, recipient, queued_at, sent_at, failed_at, error_message')
        .eq('lead_id', leadId).order('queued_at', { ascending: false }).limit(50),
      'customer messages'
    )
  ]);

  if (!lead.data.length) return { found: false };
  return {
    found: true,
    lead: lead.data[0],
    reports: reports.data,
    generation_time_seconds: summariseDurations(reports.data.map(r => r.generation_seconds)),
    events: events.data,
    payments: payments.data,
    bookings: bookings.data,
    appointments: appointments.data,
    messages: messages.data
  };
}

/**
 * Consultations. These tables are not populated yet, so this reports honestly
 * on an empty pipeline rather than implying otherwise.
 */
async function getConsultations({ environment = 'production' } = {}) {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const [appointments, bookings, holds] = await Promise.all([
    unwrap(
      applyEnvironment(
        supabase.from('appointments').select('id, lead_id, starts_at, ends_at, mode, status, meeting_url, customer_question, created_at'),
        environment
      ).order('starts_at', { ascending: true }).limit(200),
      'appointments'
    ),
    unwrap(
      supabase.from('bookings').select('id, lead_id, date, time_slot, mode, status, notes, created_at')
        .order('created_at', { ascending: false }).limit(200),
      'bookings'
    ),
    unwrap(
      applyEnvironment(supabase.from('slot_holds').select('id, slot_key, starts_at, status, expires_at'), environment).limit(100),
      'slot holds'
    )
  ]);

  const ids = [...new Set([...appointments.data.map(a => a.lead_id), ...bookings.data.map(b => b.lead_id)].filter(Boolean))];
  const names = ids.length
    ? new Map((await unwrap(supabase.from('leads').select('id, name').in('id', ids), 'consultation leads')).data.map(l => [l.id, l.name]))
    : new Map();
  const nowIso = new Date().toISOString();

  return {
    appointments: appointments.data.map(a => ({ ...a, lead_name: names.get(a.lead_id) || '' })),
    bookings: bookings.data.map(b => ({ ...b, lead_name: names.get(b.lead_id) || '' })),
    active_holds: holds.data.filter(h => h.status === 'active' && h.expires_at > nowIso).length,
    upcoming: appointments.data.filter(a => a.starts_at > nowIso).length,
    past: appointments.data.filter(a => a.starts_at <= nowIso).length
  };
}

/** Operational health: what is broken, and what is getting slow. */
async function getHealth({ environment = 'production', days = 30 } = {}) {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const since = isoDaysAgo(days);

  const [failures, completed, jobs, webhooks] = await Promise.all([
    unwrap(
      applyEnvironment(supabase.from(METRICS_VIEW).select(LIST_COLUMNS).eq('status', 'failed'), environment)
        .gte('created_at', since).order('created_at', { ascending: false }).limit(100),
      'failed reports'
    ),
    unwrap(
      applyEnvironment(
        supabase.from(METRICS_VIEW).select('id, type, category, created_at, generation_seconds, lead_name').eq('status', 'completed'),
        environment
      ).gte('created_at', since),
      'completed reports'
    ),
    unwrap(
      supabase.from('background_jobs').select('id, job_type, status, attempts, last_error, created_at')
        .neq('status', 'completed').limit(50),
      'jobs'
    ),
    unwrap(
      supabase.from('webhook_events').select('id, provider, event_type, status, error_message, received_at')
        .neq('status', 'processed').limit(50),
      'webhooks'
    )
  ]);

  const timed = completed.data
    .filter(r => toSeconds(r.generation_seconds) !== null)
    .sort((a, b) => Number(b.generation_seconds) - Number(a.generation_seconds));

  return {
    window_days: days,
    environment,
    failed_reports: failures.data,
    failure_reasons: countBy(failures.data, r => r.failure_code || r.failure_message || 'unspecified'),
    slowest_reports: timed.slice(0, 10),
    generation_time_seconds: summariseDurations(timed.map(r => r.generation_seconds)),
    stuck_jobs: jobs.data,
    unprocessed_webhooks: webhooks.data
  };
}

/** Recent system activity, straight from the events audit trail. */
async function getActivity({ limit = 60 } = {}) {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data } = await unwrap(
    supabase.from('events').select('id, type, entity, entity_id, created_at')
      .order('created_at', { ascending: false }).limit(Math.min(Number(limit) || 60, 200)),
    'activity'
  );
  return data;
}

module.exports = {
  getOverview, listReports, listCustomers, getCustomer,
  getConsultations, getHealth, getActivity, summariseDurations
};
