(function(){
'use strict';

const state={view:'overview',days:30,dashboard:null,customerPage:1,reportPage:1,paymentPage:1,bookingPage:1,searchTimers:{}};
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));

function esc(value){return String(value==null?'':value).replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));}
function money(value){return '₹'+Number(value||0).toLocaleString('en-IN',{maximumFractionDigits:0});}
function pct(value){return Number(value||0).toLocaleString('en-IN',{maximumFractionDigits:1})+'%';}
function dateTime(value){if(!value)return '—';const d=new Date(value);return Number.isNaN(d.getTime())?'—':d.toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});}
function shortDate(value){if(!value)return '—';const d=new Date(value);return Number.isNaN(d.getTime())?'—':d.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});}
function duration(ms){const sec=Math.round(Number(ms||0)/1000);if(!sec)return '—';if(sec<60)return sec+'s';return Math.floor(sec/60)+'m '+(sec%60)+'s';}
function statusClass(value){const s=String(value||'').toLowerCase();if(/completed|captured|confirmed|success|active|generated/.test(s))return 'green';if(/failed|cancelled|error|refunded/.test(s))return 'red';return 'gold';}
function pill(value){return `<span class="pill ${statusClass(value)}">${esc(value||'Unknown')}</span>`;}
function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),2600);}

async function api(path,options){
  const res=await fetch(path,Object.assign({cache:'no-store'},options||{}));
  const raw=await res.text();let data;
  try{data=raw?JSON.parse(raw):{};}catch(e){data={error:raw||'Invalid server response'};}
  if(!res.ok||data.success===false)throw new Error(data.error||`Request failed (${res.status})`);
  return data;
}

function setLoading(value){document.body.classList.toggle('loading',Boolean(value));}
function setTitle(view){
  const meta={overview:['Operations Overview','Business, customers and report health at a glance.'],customers:['Customers','Every customer, report, payment and interaction in one timeline.'],reports:['Report Archive','Search, inspect and download every generated report.'],revenue:['Revenue','Payments, conversion and commercial performance.'],bookings:['Bookings','Consultations and upcoming customer sessions.'],activity:['Activity','System and customer event history.'],system:['System Health','Persistent storage, integrations and operational readiness.']};
  const item=meta[view]||meta.overview;$('#pageTitle').textContent=item[0];$('#pageEyebrow').textContent=item[1];
}

function showView(view){
  state.view=view;setTitle(view);
  $$('.nav-btn').forEach(btn=>btn.classList.toggle('active',btn.dataset.view===view));
  $$('.view').forEach(el=>el.classList.toggle('active',el.id===`view-${view}`));
  $('#sidebar').classList.remove('open');
  loadView(view).catch(error=>renderError(view,error));
}

function renderStorage(storage){
  const box=$('#storageAlert');
  if(!storage){box.className='storage-alert';box.innerHTML='<div><strong><span class="status-dot"></span>Storage status unavailable</strong><p>Could not determine persistence mode.</p></div>';return;}
  const ok=storage.persistent;
  box.className='storage-alert'+(ok?' ok':'');
  box.innerHTML=`<div><strong><span class="status-dot"></span>${ok?'Persistent history protected':'Historical data at risk'}</strong><p>${ok?'Supabase persistent storage is active. Customer and report history can survive deployments and server restarts.':esc(storage.warning||'Persistent storage is not active.')}</p></div><div>${pill(ok?'Supabase':'Local fallback')}</div>`;
}

function lineChart(series,key){
  if(!series||!series.length)return '<div class="empty"><strong>No trend data</strong></div>';
  const values=series.map(row=>Number(row[key]||0));const max=Math.max(...values,1);const w=760,h=205,pad=20;
  const points=values.map((v,i)=>{const x=pad+(i/(Math.max(values.length-1,1)))*(w-pad*2);const y=h-pad-(v/max)*(h-pad*2);return [x,y];});
  const path=points.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ');
  const area=path+` L${points[points.length-1][0]},${h-pad} L${points[0][0]},${h-pad} Z`;
  const grid=[.25,.5,.75,1].map(fr=>{const y=h-pad-fr*(h-pad*2);return `<line class="chart-grid" x1="${pad}" y1="${y}" x2="${w-pad}" y2="${y}"/>`;}).join('');
  const labels=series.filter((_,i)=>i===0||i===series.length-1||i===Math.floor(series.length/2)).map(row=>{const i=series.indexOf(row),x=pad+(i/(Math.max(series.length-1,1)))*(w-pad*2);return `<text class="chart-label" x="${x}" y="${h-2}" text-anchor="middle">${esc(row.date.slice(5))}</text>`;}).join('');
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><defs><linearGradient id="goldFade" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#d5b16d" stop-opacity=".28"/><stop offset="1" stop-color="#d5b16d" stop-opacity="0"/></linearGradient></defs>${grid}<path class="chart-area" d="${area}"/><path class="chart-line" d="${path}"/>${labels}</svg>`;
}

function distributionList(items){
  if(!items||!items.length)return '<div class="empty"><strong>No data yet</strong><span>Activity will appear here as records accumulate.</span></div>';
  const max=Math.max(...items.map(x=>x.value),1);
  return `<div class="mini-list">${items.map(item=>`<div><div class="mini-row"><div class="mini-row-label">${esc(item.label)}</div><div class="mini-row-value">${item.value}</div></div><div class="progress"><span style="width:${(item.value/max)*100}%"></span></div></div>`).join('')}</div>`;
}

function activityList(items,limit=12){
  const rows=(items||[]).slice(0,limit);if(!rows.length)return '<div class="empty"><strong>No recent activity</strong></div>';
  return `<div class="activity-list">${rows.map(item=>`<div class="activity-item"><span class="activity-dot"></span><div class="activity-main">${esc(item.type||item.title||item.kind||'Activity')}<span>${esc(item.entity||item.status||'')} ${item.entity_id?`· ${esc(item.entity_id)}`:''}</span></div><div class="activity-time">${shortDate(item.created_at||item.at)}</div></div>`).join('')}</div>`;
}

function overviewHtml(data){
  const k=data.kpis||{};
  return `<div class="section-head"><div><h2>Business pulse</h2><p>${data.range?.days||30}-day view with lifetime totals where relevant.</p></div></div>
  <div class="kpi-grid">
    <div class="kpi"><div class="kpi-label">Customers</div><div class="kpi-value">${k.total_customers||0}</div><div class="kpi-note"><span class="positive">+${k.new_customers||0}</span> in selected range</div></div>
    <div class="kpi"><div class="kpi-label">Reports</div><div class="kpi-value">${k.total_reports||0}</div><div class="kpi-note">${k.paid_reports||0} paid · ${k.free_reports||0} free</div></div>
    <div class="kpi"><div class="kpi-label">Revenue</div><div class="kpi-value gold">${money(k.revenue_total)}</div><div class="kpi-note">${money(k.revenue_in_range)} in selected range</div></div>
    <div class="kpi"><div class="kpi-label">Paid conversion</div><div class="kpi-value">${pct(k.paid_conversion)}</div><div class="kpi-note">Customers with captured payment</div></div>
    <div class="kpi"><div class="kpi-label">Report success</div><div class="kpi-value">${pct(k.report_success_rate)}</div><div class="kpi-note">Completed vs all report records</div></div>
    <div class="kpi"><div class="kpi-label">Upcoming sessions</div><div class="kpi-value">${k.upcoming_bookings||0}</div><div class="kpi-note">${k.bookings_total||0} bookings lifetime</div></div>
  </div>
  <div class="grid-2"><div class="panel"><div class="panel-title"><h3>Customer acquisition</h3><span>Daily new customers</span></div><div class="chart-wrap">${lineChart(data.trends,'customers')}</div></div><div class="panel"><div class="panel-title"><h3>Report mix</h3><span>Lifetime</span></div>${distributionList(data.report_types)}</div></div>
  <div class="grid-3"><div class="panel"><div class="panel-title"><h3>Revenue trend</h3><span>Selected range</span></div><div class="chart-wrap">${lineChart(data.trends,'revenue')}</div></div><div class="panel"><div class="panel-title"><h3>Acquisition sources</h3><span>Top sources</span></div>${distributionList(data.customer_sources)}</div><div class="panel"><div class="panel-title"><h3>Recent activity</h3><span>Latest events</span></div>${activityList(data.recent_activity,10)}</div></div></div>`;
}

async function loadOverview(){setLoading(true);try{const data=await api(`/api/admin/dashboard?days=${state.days}`);state.dashboard=data;renderStorage(data.storage);$('#view-overview').innerHTML=overviewHtml(data);}finally{setLoading(false);}}

function tableEmpty(cols,title='No records found'){return `<tr><td colspan="${cols}"><div class="empty"><strong>${esc(title)}</strong><span>Try another filter or wait for new activity.</span></div></td></tr>`;}
function paginationHtml(p,kind){return `<div class="pagination"><span>Page ${p.page} of ${p.pages} · ${p.total} records</span><div class="page-actions"><button class="page-btn" data-page-kind="${kind}" data-page="${Math.max(1,p.page-1)}" ${p.page<=1?'disabled':''}>‹</button><button class="page-btn" data-page-kind="${kind}" data-page="${Math.min(p.pages,p.page+1)}" ${p.page>=p.pages?'disabled':''}>›</button></div></div>`;}

async function loadCustomers(){
  const view=$('#view-customers');
  if(!view.dataset.ready)view.innerHTML=`<div class="section-head"><div><h2>Customer intelligence</h2><p>One profile per customer with every report, payment and booking attached.</p></div><a class="btn btn-ghost" href="/api/export/all.xlsx">Export all data</a></div><div class="toolbar"><div class="search"><input id="customerSearch" class="input" placeholder="Search name, phone, email, city or concern"></div><select id="customerTier" class="select"><option value="">All tiers</option><option value="free_awareness">Free awareness</option><option value="paid_blueprint_v2_preview">Paid blueprint</option></select></div><div id="customersTable"></div>`,view.dataset.ready='1';
  const search=encodeURIComponent($('#customerSearch')?.value||'');const tier=encodeURIComponent($('#customerTier')?.value||'');
  const data=await api(`/api/admin/customers?page=${state.customerPage}&limit=30&search=${search}&tier=${tier}`);renderStorage(data.storage);
  const rows=(data.customers||[]).map(c=>`<tr class="clickable" data-customer-id="${esc(c.id)}"><td class="name-cell"><strong>${esc(c.name)}</strong><span>${esc(c.email)}</span></td><td>${esc(c.phone)}</td><td>${esc(c.pob||'—')}</td><td>${pill(c.tier||'unclassified')}</td><td>${c.reports_count}</td><td>${money(c.captured_revenue||c.total_spent)}</td><td>${pill(c.status||'new')}</td><td>${shortDate(c.last_activity_at)}</td></tr>`).join('');
  $('#customersTable').innerHTML=`<div class="table-card"><div class="table-scroll"><table class="table"><thead><tr><th>Customer</th><th>Phone</th><th>Birthplace</th><th>Tier</th><th>Reports</th><th>Revenue</th><th>Status</th><th>Last activity</th></tr></thead><tbody>${rows||tableEmpty(8)}</tbody></table></div>${paginationHtml(data.pagination,'customers')}</div>`;
}

async function openCustomer(id){
  openDrawer('Loading customer…','Building complete history');
  try{const data=await api(`/api/admin/customers/${encodeURIComponent(id)}`);const c=data.customer||{};const reportRows=(data.reports||[]).map(r=>`<div class="system-row clickable" data-report-id="${esc(r.id)}"><span class="system-name">${esc(r.type)} · ${shortDate(r.created_at)}</span><span>${pill(r.status)}</span></div>`).join('')||'<div class="empty"><strong>No reports yet</strong></div>';
  const timeline=(data.timeline||[]).slice(0,80).map(item=>`<div class="timeline-item"><strong>${esc(item.title||item.kind)}</strong><span>${esc(item.status||'')} · ${dateTime(item.at)}</span></div>`).join('')||'<div class="empty">No timeline activity</div>';
  setDrawer(`<h3>${esc(c.name)}</h3><p>${esc(c.email)} · ${esc(c.phone)}</p>`,`<div class="detail-grid"><div class="detail-card"><label>Date of birth</label><div>${esc(c.dob||'—')} ${c.tob?`· ${esc(c.tob)}`:''}</div></div><div class="detail-card"><label>Place of birth</label><div>${esc(c.pob||'—')}</div></div><div class="detail-card"><label>Main concern</label><div>${esc(c.question||'—')}</div></div><div class="detail-card"><label>Source</label><div>${esc(c.source||'—')}</div></div><div class="detail-card"><label>Customer tier</label><div>${pill(c.tier||'unclassified')}</div></div><div class="detail-card"><label>Lifetime captured revenue</label><div class="gold">${money(c.captured_revenue||c.total_spent)}</div></div></div><div class="subsection"><h4>Reports (${c.reports_count||0})</h4>${reportRows}</div><div class="subsection"><h4>Customer timeline</h4><div class="timeline">${timeline}</div></div>`);
  }catch(error){setDrawer('<h3>Customer unavailable</h3>','<div class="empty"><strong>Could not load customer</strong><span>'+esc(error.message)+'</span></div>');}
}

async function loadReports(){
  const view=$('#view-reports');
  if(!view.dataset.ready)view.innerHTML=`<div class="section-head"><div><h2>Historical report archive</h2><p>Full report text, QA, generation metadata and downloadable PDFs.</p></div></div><div class="toolbar"><div class="search"><input id="reportSearch" class="input" placeholder="Search report ID, customer, phone, type or model"></div><select id="reportStatus" class="select"><option value="">All statuses</option><option value="completed">Completed</option><option value="generating">Generating</option><option value="failed">Failed</option></select></div><div id="reportsTable"></div>`,view.dataset.ready='1';
  const search=encodeURIComponent($('#reportSearch')?.value||'');const status=encodeURIComponent($('#reportStatus')?.value||'');
  const data=await api(`/api/admin/reports?page=${state.reportPage}&limit=30&search=${search}&status=${status}`);
  const rows=(data.reports||[]).map(r=>`<tr class="clickable" data-report-id="${esc(r.id)}"><td class="name-cell"><strong>${esc(r.customer_name||'Unknown')}</strong><span>${esc(r.customer_phone||r.customer_email||'')}</span></td><td>${esc(r.type)}</td><td>${pill(r.status)}</td><td>${Number(r.word_count||0).toLocaleString('en-IN')}</td><td>${r.qa?.passed?'<span class="positive">Passed</span>':'—'}</td><td>${duration(r.generation_ms)}</td><td>${esc(r.generated_by||'—')}</td><td>${shortDate(r.created_at)}</td></tr>`).join('');
  $('#reportsTable').innerHTML=`<div class="table-card"><div class="table-scroll"><table class="table"><thead><tr><th>Customer</th><th>Report type</th><th>Status</th><th>Words</th><th>QA</th><th>Time</th><th>Model</th><th>Created</th></tr></thead><tbody>${rows||tableEmpty(8)}</tbody></table></div>${paginationHtml(data.pagination,'reports')}</div>`;
}

async function openReport(id){
  openDrawer('Loading report…','Fetching stored report content');
  try{const data=await api(`/api/admin/reports/${encodeURIComponent(id)}`);const r=data.report||{},c=data.customer||{},ins=r.ai_insights||{},qa=ins.qa||{};const docs=data.documents||[];
  setDrawer(`<h3>${esc(c.name||'Report')}</h3><p>${esc(r.type||'')} · ${dateTime(r.created_at)}</p>`,`<div class="detail-grid"><div class="detail-card"><label>Report ID</label><div>${esc(r.id)}</div></div><div class="detail-card"><label>Status</label><div>${pill(r.status)}</div></div><div class="detail-card"><label>Generated by</label><div>${esc(r.generated_by||'—')}</div></div><div class="detail-card"><label>QA</label><div>${qa.passed?'<span class="positive">Passed</span>':'Not recorded'} ${qa.word_count?`· ${Number(qa.word_count).toLocaleString('en-IN')} words`:''}</div></div><div class="detail-card"><label>Contract</label><div>${esc(ins.report_contract_version||'—')}</div></div><div class="detail-card"><label>Archived documents</label><div>${docs.length}</div></div></div><div class="toolbar"><a class="btn btn-primary" href="/api/reports/${encodeURIComponent(r.id)}/pdf">Download PDF</a><button class="btn btn-secondary" id="copyReportBtn">Copy report text</button></div><div class="subsection"><h4>Stored report</h4><div class="report-preview" id="drawerReportText">${esc(r.ai_report||'No stored report text.')}</div></div>`);
  $('#copyReportBtn')?.addEventListener('click',()=>navigator.clipboard.writeText(r.ai_report||'').then(()=>toast('Report copied')));
  }catch(error){setDrawer('<h3>Report unavailable</h3>','<div class="empty"><strong>Could not load report</strong><span>'+esc(error.message)+'</span></div>');}
}

async function loadRevenue(){
  const [dash,data]=await Promise.all([api(`/api/admin/dashboard?days=${state.days}`),api('/api/admin/payments?page=1&limit=100')]);renderStorage(dash.storage);const k=dash.kpis||{};const payments=data.payments||[];
  $('#view-revenue').innerHTML=`<div class="section-head"><div><h2>Commercial performance</h2><p>Captured revenue, order value and payment history.</p></div></div><div class="revenue-hero"><div class="panel"><div class="kpi-label">Lifetime captured revenue</div><div class="big-money">${money(k.revenue_total)}</div><div class="kpi-note">${money(k.revenue_in_range)} in the last ${state.days} days</div></div><div class="panel"><div class="kpi-label">Average order value</div><div class="big-money">${money(k.average_order_value)}</div><div class="kpi-note">Paid conversion ${pct(k.paid_conversion)}</div></div></div><div class="panel" style="margin-top:14px"><div class="panel-title"><h3>Revenue trend</h3><span>Captured payments</span></div><div class="chart-wrap">${lineChart(dash.trends,'revenue')}</div></div><div class="section-head" style="margin-top:24px"><div><h2>Payments</h2><p>Latest payment records.</p></div></div><div class="table-card"><div class="table-scroll"><table class="table"><thead><tr><th>Customer</th><th>Amount</th><th>Tier</th><th>Status</th><th>Method</th><th>Created</th></tr></thead><tbody>${payments.map(p=>`<tr><td class="name-cell"><strong>${esc(p.customer_name||'Unknown')}</strong><span>${esc(p.customer_phone||'')}</span></td><td class="gold">${money(p.amount)}</td><td>${esc(p.tier||'—')}</td><td>${pill(p.status)}</td><td>${esc(p.method||'—')}</td><td>${dateTime(p.created_at)}</td></tr>`).join('')||tableEmpty(6)}</tbody></table></div></div>`;
}

async function loadBookings(){
  const view=$('#view-bookings');if(!view.dataset.ready)view.innerHTML=`<div class="section-head"><div><h2>Consultation bookings</h2><p>Upcoming, completed and cancelled sessions.</p></div></div><div class="toolbar"><select id="bookingStatus" class="select"><option value="">All statuses</option><option value="confirmed">Confirmed</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></div><div id="bookingsTable"></div>`,view.dataset.ready='1';
  const status=encodeURIComponent($('#bookingStatus')?.value||'');const data=await api(`/api/admin/bookings?page=${state.bookingPage}&limit=40&status=${status}`);const rows=(data.bookings||[]).map(b=>`<tr><td class="name-cell"><strong>${esc(b.customer_name||'Unknown')}</strong><span>${esc(b.customer_phone||'')}</span></td><td>${esc(b.date||'—')}</td><td>${esc(b.time_slot||'—')}</td><td>${esc(b.mode||'—')}</td><td>${pill(b.status)}</td><td>${esc(b.notes||'—')}</td></tr>`).join('');$('#bookingsTable').innerHTML=`<div class="table-card"><div class="table-scroll"><table class="table"><thead><tr><th>Customer</th><th>Date</th><th>Time</th><th>Mode</th><th>Status</th><th>Notes</th></tr></thead><tbody>${rows||tableEmpty(6)}</tbody></table></div>${paginationHtml(data.pagination,'bookings')}</div>`;
}

async function loadActivity(){const data=await api('/api/admin/activity?limit=500');$('#view-activity').innerHTML=`<div class="section-head"><div><h2>Operational activity</h2><p>Latest system and customer events, newest first.</p></div></div><div class="panel">${activityList(data.events,500)}</div>`;}

async function loadSystem(){const data=await api('/api/admin/system');renderStorage(data.storage);const s=data.services||{},st=data.storage||{},probe=data.storage_probe||{};$('#view-system').innerHTML=`<div class="section-head"><div><h2>System health</h2><p>Persistence and integration readiness.</p></div></div><div class="system-grid"><div class="panel"><div class="panel-title"><h3>Persistent storage</h3><span>${st.mode||'unknown'}</span></div><div class="system-row"><span class="system-name">Supabase URL</span><span class="system-value ${st.supabase_url_configured?'positive':'negative'}">${st.supabase_url_configured?'Configured':'Missing'}</span></div><div class="system-row"><span class="system-name">Service role credential</span><span class="system-value ${st.supabase_service_role_configured?'positive':'negative'}">${st.supabase_service_role_configured?'Configured':'Missing'}</span></div><div class="system-row"><span class="system-name">Persistent read probe</span><span class="system-value ${probe.ok?'positive':'negative'}">${probe.ok?'Passed':'Failed'}</span></div><div class="system-row"><span class="system-name">Historical data safe</span><span class="system-value ${st.safe_for_historical_data?'positive':'negative'}">${st.safe_for_historical_data?'Yes':'No'}</span></div></div><div class="panel"><div class="panel-title"><h3>Services</h3><span>${esc(s.environment||'')}</span></div><div class="system-row"><span class="system-name">OpenAI</span><span class="system-value ${s.openai_configured?'positive':'negative'}">${s.openai_configured?'Configured':'Missing'}</span></div><div class="system-row"><span class="system-name">AstrologyAPI</span><span class="system-value ${s.astrologyapi_configured?'positive':'negative'}">${s.astrologyapi_configured?'Configured':'Missing'}</span></div><div class="system-row"><span class="system-name">Admin credentials</span><span class="system-value ${s.admin_credentials_configured?'positive':'negative'}">${s.admin_credentials_configured?'Configured':'Using fallback / missing'}</span></div><div class="system-row"><span class="system-name">Last checked</span><span class="system-value">${dateTime(data.timestamp)}</span></div></div></div><div class="panel" style="margin-top:14px"><div class="panel-title"><h3>Retention policy</h3><span>Required state</span></div><p style="color:#aaa198;font-size:12px;line-height:1.7;margin:0">Production must run on persistent Supabase storage. Browser downloads and Vercel <code>/tmp</code> storage are not historical archives. Report text, structured report data, source calculations, payment records, booking history and immutable document artifacts should remain tied to the customer profile.</p></div>`;}

async function loadView(view){if(view==='overview')return loadOverview();if(view==='customers')return loadCustomers();if(view==='reports')return loadReports();if(view==='revenue')return loadRevenue();if(view==='bookings')return loadBookings();if(view==='activity')return loadActivity();if(view==='system')return loadSystem();}
function renderError(view,error){const el=$(`#view-${view}`);if(el)el.innerHTML=`<div class="panel"><div class="empty"><strong>Could not load ${esc(view)}</strong><span>${esc(error.message)}</span></div></div>`;toast(error.message);}

function openDrawer(title,subtitle){$('#drawerTitle').innerHTML=title;$('#drawerSubtitle').textContent=subtitle||'';$('#drawerBody').innerHTML='<div class="skeleton" style="height:120px"></div><div class="skeleton" style="height:260px;margin-top:12px"></div>';$('#drawer').classList.add('open');$('#drawerBackdrop').classList.add('open');}
function setDrawer(titleHtml,bodyHtml){$('#drawerTitle').innerHTML=titleHtml;$('#drawerBody').innerHTML=bodyHtml;}
function closeDrawer(){$('#drawer').classList.remove('open');$('#drawerBackdrop').classList.remove('open');}

function bind(){
  $$('.nav-btn').forEach(btn=>btn.addEventListener('click',()=>showView(btn.dataset.view)));
  $('#mobileMenu').addEventListener('click',()=>$('#sidebar').classList.toggle('open'));
  $('#refreshBtn').addEventListener('click',()=>loadView(state.view).then(()=>toast('Dashboard refreshed')).catch(e=>toast(e.message)));
  $('#rangeSelect').addEventListener('change',e=>{state.days=Number(e.target.value)||30;if(['overview','revenue'].includes(state.view))loadView(state.view);});
  $('#drawerClose').addEventListener('click',closeDrawer);$('#drawerBackdrop').addEventListener('click',closeDrawer);
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeDrawer();});
  document.addEventListener('click',e=>{const customer=e.target.closest('[data-customer-id]');if(customer)return openCustomer(customer.dataset.customerId);const report=e.target.closest('[data-report-id]');if(report)return openReport(report.dataset.reportId);const page=e.target.closest('[data-page-kind]');if(page&&!page.disabled){const kind=page.dataset.pageKind,n=Number(page.dataset.page);if(kind==='customers'){state.customerPage=n;loadCustomers();}if(kind==='reports'){state.reportPage=n;loadReports();}if(kind==='bookings'){state.bookingPage=n;loadBookings();}}});
  document.addEventListener('input',e=>{if(e.target.id==='customerSearch'){clearTimeout(state.searchTimers.customers);state.searchTimers.customers=setTimeout(()=>{state.customerPage=1;loadCustomers();},250);}if(e.target.id==='reportSearch'){clearTimeout(state.searchTimers.reports);state.searchTimers.reports=setTimeout(()=>{state.reportPage=1;loadReports();},250);}});
  document.addEventListener('change',e=>{if(e.target.id==='customerTier'){state.customerPage=1;loadCustomers();}if(e.target.id==='reportStatus'){state.reportPage=1;loadReports();}if(e.target.id==='bookingStatus'){state.bookingPage=1;loadBookings();}});
}

bind();showView('overview');
})();
