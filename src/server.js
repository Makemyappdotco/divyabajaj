const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const routes = require('./routes');
const { adminAuth } = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;
const publicDir = path.join(__dirname, '..', 'public');

const navPatchCss = `
<style id="mma-nav-patch">
.nav-links{gap:34px!important}
.nav-links a{font-size:14px!important;font-weight:600!important;color:rgba(250,247,242,.82)!important;letter-spacing:.7px!important;line-height:1!important;position:relative!important;padding:10px 2px!important;text-shadow:0 0 14px rgba(201,169,110,.08)!important}
.nav-links a::after{content:'';position:absolute;left:0;right:0;bottom:3px;height:1px;background:linear-gradient(90deg,transparent,var(--gold),transparent);opacity:0;transform:scaleX(.35);transition:all .28s ease}
.nav-links a:hover{color:var(--gold-l)!important}.nav-links a:hover::after{opacity:1;transform:scaleX(1)}
body.light .nav-links a{color:rgba(42,37,32,.82)!important}body.light .nav-links a:hover{color:var(--gold-d)!important}
@media(min-width:1100px){.nav-links a{font-size:15px!important}.nav-links{gap:40px!important}.nav-book,.nav-free{font-size:11px!important;padding:12px 22px!important}}
.mobile-menu-btn{display:none;width:42px;height:42px;border:1px solid rgba(201,169,110,.22);background:rgba(201,169,110,.06);border-radius:999px;align-items:center;justify-content:center;flex-direction:column;gap:5px;cursor:pointer;transition:all .3s ease;flex-shrink:0}
.mobile-menu-btn span{width:17px;height:1.5px;background:var(--gold);display:block;border-radius:99px;transition:all .3s ease}.mobile-menu-btn:hover{background:rgba(201,169,110,.12);border-color:rgba(201,169,110,.42)}
body.menu-open .mobile-menu-btn span:nth-child(1){transform:translateY(6.5px) rotate(45deg)}body.menu-open .mobile-menu-btn span:nth-child(2){opacity:0}body.menu-open .mobile-menu-btn span:nth-child(3){transform:translateY(-6.5px) rotate(-45deg)}
.mobile-menu-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.55);backdrop-filter:blur(10px);z-index:98;opacity:0;pointer-events:none;transition:opacity .35s ease}
.mobile-menu{position:fixed;top:0;right:0;bottom:0;width:min(88vw,390px);z-index:99;pointer-events:none;transform:translateX(105%);transition:transform .45s cubic-bezier(.22,1,.36,1)}
.mobile-menu-panel{height:100%;position:relative;padding:22px 20px 24px;background:linear-gradient(155deg,rgba(20,19,26,.98),rgba(8,7,10,.96));border-left:1px solid rgba(201,169,110,.16);box-shadow:-22px 0 70px rgba(0,0,0,.35);display:flex;flex-direction:column;gap:22px;overflow-y:auto}.mobile-menu-panel::before{content:'';position:absolute;top:0;right:0;width:100%;height:2px;background:linear-gradient(90deg,transparent,var(--gold),transparent);opacity:.75}
.mobile-menu-head{display:flex;align-items:center;justify-content:space-between;gap:14px;padding-bottom:18px;border-bottom:1px solid rgba(201,169,110,.1)}.mobile-menu-kicker{display:flex;align-items:center;gap:9px;font-size:10px;font-weight:700;letter-spacing:2.4px;text-transform:uppercase;color:var(--gold)}.mobile-menu-kicker span{width:8px;height:8px;border-radius:50%;background:#39d879;box-shadow:0 0 12px rgba(57,216,121,.45)}
.mobile-menu-close{width:42px;height:42px;border-radius:50%;border:1px solid rgba(201,169,110,.22);background:rgba(201,169,110,.04);color:var(--gold-l);font-size:24px;line-height:1;cursor:pointer}.mobile-menu-title{font-family:var(--serif);font-size:26px;line-height:1.15;color:var(--ivory);max-width:270px}.mobile-menu-links{display:flex;flex-direction:column;gap:10px}
.mobile-menu-links a{display:flex;align-items:center;gap:14px;padding:16px 14px;border:1px solid rgba(201,169,110,.1);background:rgba(201,169,110,.035);color:var(--text);transition:all .28s ease;animation:mobileLinkIn .45s ease both}.mobile-menu-links a:nth-child(2){animation-delay:.05s}.mobile-menu-links a:nth-child(3){animation-delay:.1s}.mobile-menu-links a:nth-child(4){animation-delay:.15s}.mobile-menu-links a small{font-family:var(--serif);font-size:13px;color:var(--gold);opacity:.75;min-width:26px}.mobile-menu-links a span{font-size:16px;font-weight:600;letter-spacing:.3px}.mobile-menu-links a:hover{border-color:rgba(201,169,110,.34);background:rgba(201,169,110,.09);transform:translateX(4px)}
.mobile-menu-actions{margin-top:auto;display:grid;grid-template-columns:1fr;gap:10px;padding-top:14px}.mobile-menu-actions a{display:block;text-align:center;padding:15px 16px;font-size:12px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase}.mobile-menu-free{background:linear-gradient(135deg,var(--gold),var(--gold-l));color:#08070A!important;box-shadow:0 12px 32px rgba(201,169,110,.2)}.mobile-menu-book{border:1px solid rgba(201,169,110,.35);color:var(--gold-l)!important;background:rgba(201,169,110,.04)}
body.menu-open .mobile-menu-backdrop{opacity:1;pointer-events:auto}body.menu-open .mobile-menu{transform:translateX(0);pointer-events:auto}body.menu-open{overflow:hidden}
body.light .mobile-menu-panel{background:linear-gradient(155deg,rgba(253,251,247,.98),rgba(246,243,236,.96));box-shadow:-22px 0 70px rgba(42,37,32,.12)}body.light .mobile-menu-links a{background:rgba(176,141,74,.045);border-color:rgba(176,141,74,.12);color:var(--text)}body.light .mobile-menu-close,body.light .mobile-menu-btn{background:rgba(176,141,74,.06);border-color:rgba(176,141,74,.22)}
@keyframes mobileLinkIn{from{opacity:0;transform:translateX(22px)}to{opacity:1;transform:none}}
@media(max-width:899px){.mobile-menu-btn{display:flex}.nav-links{display:none!important}.nav-book{display:none!important}.nav-inner{gap:12px}.nav-logo img{height:46px}.nav-right{gap:8px}}
@media(max-width:420px){.nav-free{padding:9px 12px!important;font-size:9px!important;letter-spacing:1.1px}.theme-toggle{width:36px}.mobile-menu-btn{width:39px;height:39px}.nav-logo img{height:40px}.mobile-menu{width:92vw}.mobile-menu-panel{padding:20px 16px 22px}}
</style>`;

const navPatchJs = `
<script id="mma-nav-patch-js">
(function(){
  function byText(selector,text){return Array.prototype.find.call(document.querySelectorAll(selector),function(el){return (el.textContent||'').trim().toLowerCase()===text.toLowerCase();});}
  function setLink(text,href){var a=byText('.nav-links a',text);if(a){a.href=href;a.removeAttribute('onclick');}}
  setLink('About','#meet-divya');setLink('Services','#services');setLink('Pricing','#pricing');setLink('FAQ','#faq');
  var logo=document.querySelector('.nav-logo');if(logo)logo.setAttribute('href','#hero');
  var book=document.querySelector('.nav-book');if(book)book.setAttribute('href','#booking');
  var navRight=document.querySelector('.nav-right');
  if(navRight && !document.getElementById('mobileMenuBtn')){
    var btn=document.createElement('button');btn.className='mobile-menu-btn';btn.id='mobileMenuBtn';btn.type='button';btn.setAttribute('aria-label','Open navigation menu');btn.setAttribute('aria-controls','mobileMenu');btn.setAttribute('aria-expanded','false');btn.innerHTML='<span></span><span></span><span></span>';navRight.appendChild(btn);
    var backdrop=document.createElement('div');backdrop.className='mobile-menu-backdrop';backdrop.id='mobileMenuBackdrop';
    var menu=document.createElement('div');menu.className='mobile-menu';menu.id='mobileMenu';menu.setAttribute('aria-hidden','true');menu.innerHTML='<div class="mobile-menu-panel"><div class="mobile-menu-head"><div class="mobile-menu-kicker"><span></span> Divya Bajaj</div><button class="mobile-menu-close" id="mobileMenuClose" type="button" aria-label="Close navigation menu">&times;</button></div><div class="mobile-menu-title">Choose where you want to go</div><div class="mobile-menu-links"><a href="#meet-divya"><small>01</small><span>About Divya</span></a><a href="#services"><small>02</small><span>Services</span></a><a href="#pricing"><small>03</small><span>Pricing</span></a><a href="#faq"><small>04</small><span>FAQ</span></a></div><div class="mobile-menu-actions"><a href="javascript:void(0)" class="mobile-menu-free" id="mobileMenuFree">Free Report</a><a href="#booking" class="mobile-menu-book">Book Now</a></div></div>';
    document.body.appendChild(backdrop);document.body.appendChild(menu);
  }
  window.openMobileMenu=function(){document.body.classList.add('menu-open');var b=document.getElementById('mobileMenuBtn'),m=document.getElementById('mobileMenu');if(b)b.setAttribute('aria-expanded','true');if(m)m.setAttribute('aria-hidden','false');};
  window.closeMobileMenu=function(){document.body.classList.remove('menu-open');var b=document.getElementById('mobileMenuBtn'),m=document.getElementById('mobileMenu');if(b)b.setAttribute('aria-expanded','false');if(m)m.setAttribute('aria-hidden','true');};
  var btn=document.getElementById('mobileMenuBtn'), close=document.getElementById('mobileMenuClose'), backdrop=document.getElementById('mobileMenuBackdrop'), free=document.getElementById('mobileMenuFree');
  if(btn)btn.addEventListener('click',function(){document.body.classList.contains('menu-open')?window.closeMobileMenu():window.openMobileMenu();});
  if(close)close.addEventListener('click',window.closeMobileMenu);if(backdrop)backdrop.addEventListener('click',window.closeMobileMenu);
  if(free)free.addEventListener('click',function(){window.closeMobileMenu();if(typeof openFreeReportPopup==='function')openFreeReportPopup();});
  document.querySelectorAll('.mobile-menu a[href^="#"]').forEach(function(a){a.addEventListener('click',function(){window.closeMobileMenu();});});
  document.addEventListener('keydown',function(e){if(e.key==='Escape')window.closeMobileMenu();});
})();
</script>`;

function serveLanding(req, res) {
  const landingPath = path.join(publicDir, 'landing.html');
  if (!fs.existsSync(landingPath)) return res.status(404).send('Landing page not found');
  let html = fs.readFileSync(landingPath, 'utf8');
  if (!html.includes('id="mma-nav-patch"')) html = html.replace('</head>', `${navPatchCss}\n</head>`);
  if (!html.includes('id="mma-nav-patch-js"')) html = html.replace('</body>', `${navPatchJs}\n</body>`);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

app.use('/api', adminAuth, routes);

app.get('/admin', adminAuth, (req, res) => {
  res.sendFile(path.join(publicDir, 'admin.html'));
});

app.use('/admin', adminAuth, express.static(publicDir));
app.get('/', serveLanding);
app.get('/landing.html', serveLanding);
app.use(express.static(publicDir));

app.use((err, req, res, next) => {
  console.error('[Global server error]', err);
  if (res.headersSent) return next(err);
  const isApi = req.path.startsWith('/api');
  if (isApi) {
    return res.status(err.status || 500).json({
      success: false,
      error: err.message || 'Something went wrong while processing the request.'
    });
  }
  return res.status(err.status || 500).send('Something went wrong while loading the page.');
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`Divya Bajaj Backend System running on ${PORT}`));
}

module.exports = app;