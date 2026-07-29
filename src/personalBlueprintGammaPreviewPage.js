function renderPersonalBlueprintGammaPreviewPage() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Gamma Report Sample Studio</title>
<style>
:root{color-scheme:dark;--bg:#0f0e12;--panel:#1b191f;--line:#332e39;--text:#f7f2ea;--muted:#aaa3b0;--gold:#d9b15f;--ok:#84d9a7;--bad:#ff9b9b}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at top,#2a2230 0,#0f0e12 46%);color:var(--text);font-family:Inter,system-ui,sans-serif}main{width:min(980px,calc(100% - 32px));margin:auto;padding:48px 0 80px}.eyebrow{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold);font-weight:800}h1{font-size:clamp(34px,6vw,60px);line-height:1;margin:10px 0 14px}.intro{max-width:760px;color:var(--muted);font-size:17px;line-height:1.6}.panel{margin-top:28px;background:rgba(27,25,31,.96);border:1px solid var(--line);border-radius:20px;padding:24px}.config{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.item{background:#121115;border:1px solid var(--line);border-radius:12px;padding:13px}.item small{display:block;color:var(--muted);font-size:11px}.item strong{display:block;margin-top:5px;word-break:break-word}.theme-row{display:grid;grid-template-columns:1fr auto;gap:10px;margin-top:18px}select,button,a.button{border-radius:12px;border:1px solid var(--line);padding:13px 16px;font:inherit}select{background:#121115;color:var(--text)}button,a.button{background:var(--gold);color:#18120d;font-weight:800;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;justify-content:center}.secondary{background:#292630!important;color:var(--text)!important}.samples{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:18px}.sample{background:#121115;border:1px solid var(--line);border-radius:16px;padding:18px}.sample h2{margin:0 0 6px}.sample p{color:var(--muted);line-height:1.5}.actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.status{margin-top:14px;padding-top:14px;border-top:1px solid var(--line);color:var(--muted);white-space:pre-wrap}.ok{color:var(--ok)}.bad{color:var(--bad)}button[disabled]{opacity:.55;cursor:not-allowed}@media(max-width:760px){.config,.samples{grid-template-columns:1fr 1fr}.theme-row{grid-template-columns:1fr}}@media(max-width:520px){.config,.samples{grid-template-columns:1fr}}
</style>
</head>
<body><main>
<div class="eyebrow">Preview environment only</div>
<h1>Gamma Report Sample Studio</h1>
<p class="intro">Generate two under-20-page branded paid-report samples from the already verified report. No astrology or numerology is recalculated here. Gamma only handles the visual output.</p>
<section class="panel">
<div class="config">
<div class="item"><small>Report ID</small><strong id="reportId">Loading</strong></div>
<div class="item"><small>Gamma API</small><strong id="api">Checking</strong></div>
<div class="item"><small>Brand logo</small><strong id="logo">Checking</strong></div>
<div class="item"><small>Target</small><strong>18 A4 cards</strong></div>
</div>
<div class="theme-row"><select id="theme"><option value="">Workspace default theme</option></select><button id="refreshThemes" class="secondary">Refresh themes</button></div>
<div class="samples">
<article class="sample" data-variant="editorial"><h2>Sample A</h2><p>Editorial luxury. Elegant serif typography, asymmetric layouts, quiet gold details and sophisticated whitespace.</p><div class="actions"><button class="generate">Generate Sample A</button><button class="check secondary">Check status</button><a class="button secondary pdf" hidden>Open PDF</a><a class="button secondary gamma" hidden target="_blank">Open Gamma</a></div><div class="status">Not started</div></article>
<article class="sample" data-variant="modern"><h2>Sample B</h2><p>Modern luxury. Stronger grids, oversized numbers, modular dashboards and higher visual contrast.</p><div class="actions"><button class="generate">Generate Sample B</button><button class="check secondary">Check status</button><a class="button secondary pdf" hidden>Open PDF</a><a class="button secondary gamma" hidden target="_blank">Open Gamma</a></div><div class="status">Not started</div></article>
</div>
</section>
</main>
<script>
(()=>{
const params=new URLSearchParams(location.search);const reportId=params.get('reportId')||'rep_de0c87e0f6aaf77d';
document.getElementById('reportId').textContent=reportId;const theme=document.getElementById('theme');
async function j(url,opt){const r=await fetch(url,opt);const t=await r.text();let d={};try{d=t?JSON.parse(t):{}}catch{d={error:t}}if(!r.ok||d.success===false)throw new Error(d.error||'Request failed');return d}
async function config(){try{const d=await j('/api/reports/personal-life-blueprint-v2/gamma/config');document.getElementById('api').textContent=d.configured?'Ready':'Missing key';document.getElementById('api').className=d.configured?'ok':'bad';document.getElementById('logo').textContent=d.header_logo_source==='custom'?'Custom logo URL':'Gamma theme logo';document.getElementById('logo').className='ok'}catch(e){document.getElementById('api').textContent=e.message;document.getElementById('api').className='bad'}}
async function themes(){try{const d=await j('/api/reports/personal-life-blueprint-v2/gamma/themes');const list=d.themes||d.data||d.items||[];theme.innerHTML='<option value="">Workspace default theme</option>'+list.map(x=>'<option value="'+(x.id||x.themeId||'')+'">'+(x.name||x.title||x.id||'Theme')+'</option>').join('')}catch(e){alert(e.message)}}
async function start(card){const variant=card.dataset.variant;const s=card.querySelector('.status');s.textContent='Starting Gamma generation…';try{const d=await j('/api/reports/personal-life-blueprint-v2/'+encodeURIComponent(reportId)+'/gamma/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({variant,themeId:theme.value})});render(card,d.sample);poll(card)}catch(e){s.textContent=e.message;s.className='status bad'}}
async function check(card){const variant=card.dataset.variant;try{const d=await j('/api/reports/personal-life-blueprint-v2/'+encodeURIComponent(reportId)+'/gamma/'+variant+'/status');render(card,d.sample);return d.sample}catch(e){card.querySelector('.status').textContent=e.message;card.querySelector('.status').className='status bad';return null}}
async function refresh(card){const variant=card.dataset.variant;try{const d=await j('/api/reports/personal-life-blueprint-v2/'+encodeURIComponent(reportId)+'/gamma/'+variant+'/refresh');render(card,d.sample);return d.sample}catch(e){card.querySelector('.status').textContent=e.message;card.querySelector('.status').className='status bad';return null}}
function render(card,s){const st=card.querySelector('.status'),pdf=card.querySelector('.pdf'),gamma=card.querySelector('.gamma');if(!s){st.textContent='Not started';return}st.className='status '+(s.status==='completed'?'ok':s.status==='failed'?'bad':'');st.textContent='Status: '+s.status+'\nGeneration: '+(s.generation_id||'')+(s.credits?'\nCredits used: '+(s.credits.deducted??'')+' · Remaining: '+(s.credits.remaining??''):'')+(s.error?'\nError: '+s.error:'');if(s.status==='completed'){pdf.href='/api/reports/personal-life-blueprint-v2/'+encodeURIComponent(reportId)+'/gamma/'+card.dataset.variant+'/pdf';pdf.hidden=false}if(s.gamma_url){gamma.href=s.gamma_url;gamma.hidden=false}}
async function poll(card){for(let i=0;i<80;i++){await new Promise(r=>setTimeout(r,5000));const s=await refresh(card);if(!s||['completed','failed'].includes(s.status))break}}
document.querySelectorAll('.sample').forEach(card=>{card.querySelector('.generate').onclick=()=>start(card);card.querySelector('.check').onclick=()=>check(card);check(card)});document.getElementById('refreshThemes').onclick=themes;config();themes();
})();
</script></body></html>`;
}
module.exports={renderPersonalBlueprintGammaPreviewPage};