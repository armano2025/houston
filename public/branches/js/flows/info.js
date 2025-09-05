/* /public/branches/js/flows/info.js
   INFO Lead – דף נחיתה למתעניינים: איסוף פרטי קשר (תלמיד/הורה, שם, שם משפחה, טלפון)
   + צ'יפים של מקצועות/צרכים. שליחה ל-GAS כ-flow="info".
   תיקון iOS: פתיחת ה-WordPress מתבצעת סינכרונית בלחיצת ה"שליחה" באמצעות <a target="_blank">,
   כך שלא ייחסם בספארי. השליחה ל-GAS רצה במקביל. */

(function(){
  const FORM_ID        = 'leadForm';
  const STATUS_ID      = 'statusBox';
  const THANKS_ID      = 'thanksBox';
  const ROLE_CHIPS_ID  = 'chips_role';
  const SUBJECTS_ID    = 'chips_subjects';
  const NEEDS_ID       = 'chips_needs';
  const WP_URL         = 'https://wordpress-1184560-4777160.cloudwaysapps.com/';

  const el = (id)=>document.getElementById(id);
  const statusEl = el(STATUS_ID);
  const setStatus = (t='')=>{
    if (!statusEl) return;
    statusEl.textContent = t;
    statusEl.classList.remove('err','ok');
  };
  const showErr = (t)=>{
    if (statusEl){ statusEl.textContent=t; statusEl.classList.add('err'); }
    else { alert(t); }
  };
  const showOk = (t)=>{
    if (statusEl){ statusEl.textContent=t; statusEl.classList.add('ok'); }
  };

  const Val = (window.Chat && window.Chat.Val) ? window.Chat.Val : {
    nonEmpty: s => String(s ?? '').trim().length > 0,
    phoneIL: s => /^0\d{1,2}\d{7}$/.test(String(s ?? '').replace(/[^\d]/g,'')),
  };

  function bindChips(chipsId){
    const box = el(chipsId);
    if (!box) return;
    box.addEventListener('click', (ev)=>{
      const b = ev.target.closest('.chip'); if(!b) return;
      b.setAttribute('aria-pressed', b.getAttribute('aria-pressed')==='true' ? 'false' : 'true');
    });
  }
  function getPicked(chipsId){
    const box = el(chipsId);
    if (!box) return [];
    return [...box.querySelectorAll('.chip[aria-pressed="true"]')]
      .map(b => b.dataset.value || b.textContent.trim());
  }

  // iOS-safe: פתיחה סינכרונית באמצעות עוגן עם target=_blank
  function openExternal(url){
    try{
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.style.position = 'absolute';
      a.style.left = '-9999px';
      document.body.appendChild(a);
      a.click();
      setTimeout(()=>{ try{ document.body.removeChild(a); }catch(_){} }, 100);
      return true;
    } catch(_){
      try { window.open(url, '_blank'); return true; } catch(__) {}
    }
    return false;
  }

  async function sendToSheet(payload){
    if (window.Chat?.sendLeadToSheet) return await window.Chat.sendLeadToSheet(payload);
    const url = (window.APP_CONFIG||{}).SHEET_API_URL;
    if (!url) throw new Error('SHEET_API_URL not configured');
    const res = await fetch(url, {
      method:'POST',
      headers:{'Content-Type':'text/plain;charset=utf-8'},
      body: JSON.stringify(payload),
      mode:'cors', redirect:'follow', keepalive:true
    });
    if (res.type === 'opaque') return { ok:true, opaque:true };
    if (!res.ok){
      const t = await res.text().catch(()=> '');
      throw new Error(`HTTP ${res.status} ${res.statusText}${t?` — ${t.slice(0,120)}`:''}`);
    }
    const raw = await res.text();
    try { return JSON.parse(raw); } catch(e){}
    return (/ok/i.test(raw) ? { ok:true, raw } : { ok:false, raw });
  }

  function init(){
    bindChips(ROLE_CHIPS_ID);
    bindChips(SUBJECTS_ID);
    bindChips(NEEDS_ID);

    const form = el(FORM_ID);
    if (!form) return;

    // שיפור מקלדת בטלפון (בעיקר iOS)
    const phoneEl = document.getElementById('f_phone');
    if (phoneEl){
      phoneEl.setAttribute('type','tel');
      phoneEl.setAttribute('inputmode','tel');
      phoneEl.setAttribute('autocomplete','tel');
      phoneEl.setAttribute('pattern','[0-9]*');
    }

    form.addEventListener('submit', async (ev)=>{
      ev.preventDefault();
      setStatus('');

      // איסוף + ולידציה
      const roleBtn  = document.querySelector('#'+ROLE_CHIPS_ID+' .chip[aria-pressed="true"]');
      const role     = roleBtn ? roleBtn.dataset.value : '';
      const firstName= (document.getElementById('f_first')||{}).value?.trim() || '';
      const lastName = (document.getElementById('f_last')||{}).value?.trim() || '';
      const phoneRaw = (document.getElementById('f_phone')||{}).value || '';
      const phone    = String(phoneRaw).replace(/[^\d]/g,'');
      const subjects = getPicked(SUBJECTS_ID);
      const needs    = getPicked(NEEDS_ID);

      if(!Val.nonEmpty(role))      return showErr('בחר/י: תלמיד או הורה');
      if(!Val.nonEmpty(firstName)) return showErr('יש למלא שם פרטי');
      if(!Val.nonEmpty(lastName))  return showErr('יש למלא שם משפחה');
      if(!Val.phoneIL(phone))      return showErr('מספר טלפון לא תקין');

      // חסימת דאבל־קליק
      const submitBtn = form.querySelector('button[type="submit"], .btn.primary');
      if (submitBtn) submitBtn.disabled = true;

      // פותחים את ה-WordPress *מיד* (סינכרוני – עובד גם ב-iOS Safari)
      openExternal(WP_URL);

      // שולחים במקביל למזכירות
      const payload = {
        flow: 'info',
        createdAt: new Date().toISOString(),
        project: (window.APP_CONFIG||{}).PROJECT || 'Houston',
        status: 'לטיפול',
        role, firstName, lastName, phone,
        subjects, needs
      };

      try{
        setStatus('שולח למזכירות…');
        await sendToSheet(payload);
        setStatus('נשלח ✅');
        const thanks = el(THANKS_ID);
        if (thanks) thanks.style.display = 'block';
        // ניקוי
        form.reset();
        [...document.querySelectorAll('.chip[aria-pressed="true"]')].forEach(c=>c.setAttribute('aria-pressed','false'));
      }catch(err){
        showErr('לא הצלחנו לשלוח כרגע, נסו שוב.');
        console.error(err);
      }finally{
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();