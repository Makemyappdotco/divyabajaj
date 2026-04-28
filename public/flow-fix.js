function dqs(selector){return document.querySelector(selector)}
function dqsa(selector){return Array.prototype.slice.call(document.querySelectorAll(selector))}
function openReportPopup(){
  var popup=document.getElementById('freeReportPopup') || dqs('.popup-overlay') || dqs('.popup') || dqs('.lead-popup');
  if(popup){
    popup.classList.add('show','active','open');
    popup.style.display='flex';
    document.body.style.overflow='hidden';
    return;
  }
  var section=document.getElementById('free-report');
  if(section) section.scrollIntoView({behavior:'smooth'});
}
function addPopupField(id,type,placeholder){
  if(document.getElementById(id)) return;
  var form=dqs('.popup-form');
  if(!form) return;
  var input=document.createElement('input');
  input.type=type;
  input.id=id;
  input.placeholder=placeholder;
  input.required=true;
  var button=dqs('.popup-submit');
  form.insertBefore(input,button || null);
}
function ensurePopupFields(){
  addPopupField('popPob','text','Place of Birth');
  addPopupField('popTob','time','Time of Birth');
  dqsa('.popup-get').forEach(function(item){
    if(item.textContent.indexOf('Delivered on WhatsApp')>-1){
      item.innerHTML='<span class="popup-get-icon">✓</span>Instant PDF download after generation';
    }
  });
}
function inputValue(id){
  var el=document.getElementById(id);
  return el ? String(el.value || '').trim() : '';
}
function wireFreeReportButtons(){
  dqsa('a[href="#free-report"], .nav-free, .hero-free-btn, .free-cta-btn, .st-free').forEach(function(btn){
    btn.addEventListener('click',function(event){
      event.preventDefault();
      ensurePopupFields();
      openReportPopup();
    });
  });
  dqsa('button').forEach(function(btn){
    var text=String(btn.textContent || '').toLowerCase();
    if(text.indexOf('free report')>-1){
      btn.addEventListener('click',function(event){
        event.preventDefault();
        ensurePopupFields();
        openReportPopup();
      });
    }
  });
}
window.submitPopup=async function(){
  ensurePopupFields();
  var payload={
    name:inputValue('popName'),
    dob:inputValue('popDob'),
    phone:inputValue('popPhone'),
    pob:inputValue('popPob'),
    tob:inputValue('popTob'),
    question:'General life clarity from astrology and numerology',
    source:'landing_page_popup'
  };
  if(!payload.name || !payload.dob || !payload.phone || !payload.pob || !payload.tob){
    alert('Please fill Full Name, Date of Birth, Place of Birth, Time of Birth, and WhatsApp Number.');
    return;
  }
  var button=dqs('.popup-submit');
  if(button){button.textContent='Generating PDF Report...';button.disabled=true;}
  try{
    var response=await fetch('/api/reports/free',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(payload)
    });
    var data=await response.json();
    if(!response.ok) throw new Error(data.error || 'Report generation failed');
    if(button){button.textContent='Report Generated';}
    var old=document.getElementById('generatedReportBox');
    if(old) old.remove();
    var box=document.createElement('div');
    box.id='generatedReportBox';
    box.style.cssText='margin-top:16px;padding:16px;border:1px solid rgba(201,169,110,.25);background:rgba(201,169,110,.07);color:var(--text);font-size:13px;line-height:1.65;max-height:330px;overflow:auto;white-space:pre-wrap;';
    var pdfUrl=data.pdf_url || ('/api/reports/'+data.report_id+'/pdf');
    box.innerHTML='<strong style="color:var(--gold);display:block;margin-bottom:10px;">Your free report is ready</strong><div style="white-space:pre-wrap;"></div><a href="'+pdfUrl+'" target="_blank" style="display:block;margin-top:14px;padding:13px;background:var(--gold);color:var(--bg);text-align:center;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Download PDF Report</a>';
    box.querySelector('div').textContent=data.report_text || 'Report generated successfully.';
    var form=dqs('.popup-form');
    if(form) form.appendChild(box);
  }catch(error){
    if(button){button.textContent='Try Again';button.disabled=false;}
    alert(error.message);
  }
};
window.addEventListener('DOMContentLoaded',function(){
  ensurePopupFields();
  wireFreeReportButtons();
});
