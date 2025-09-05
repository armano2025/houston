/* /public/branches/js/flows/info.js
   "פרטי מנוי חודשי" – פתיחה מיידית של עמוד המידע + איסוף פרטי קשר קצרים (רשות).
   חשוב:
   - נפתח את עמוד הוורדפרס *מיד* בתוך אירוע המשתמש (submit / click) כדי לעבור חוסמי פופ־אפ במובייל.
   - שליחה ל-Google Sheets לא חוסמת את הניווט (נעשית ברקע). נשתמש ב-Chat.sendLeadToSheet אם קיים.
   - מזהה זרימה: flow: "info" (הוסף טאב מתאים ב-GAS אם תרצה לנתב לרשימת מתעניינים).
*/

(() => {
  const INFO_URL = 'https://wordpress-1184560-4777160.cloudwaysapps.com/';

  // ===== DOM helpers =====
  const $ = (id) => document.getElementById(id);
  const statusEl = $('statusBox');

  // ===== Validation (ניקח מה-Chat אם זמין) =====
  const Val = (window.Chat && window.Chat.Val) ? window.Chat.Val : {
    nonEmpty: (s) => String(s ?? '').trim().length > 0,
    phoneIL:  (s) => /^0\d{1,2}\d{7}$/.test(String(s ?? '').replace(/\D/g,'')),
  };

  // ===== Chips (תלמיד/הורה) – יחיד =====
  (function bindChips(){
    const cont = $('chips_role'); if (!cont) return;
    cont.addEventListener('click', (ev)=>{
      const b = ev.target.closest('.chip'); if(!b) return;
      [...cont.querySelectorAll('.chip[aria-pressed="true"]')]
        .forEach(x=>x.setAttribute('aria-pressed','false'));
      b.setAttribute('aria-pressed','true');
    });
  })();
  function getRole(){
    const btn = document.querySelector('#chips_role .chip[aria-pressed="true"]');
    return btn ? btn.dataset.value : '';
  }

  // ===== Open info page NOW (must be inside user gesture) =====
  function openInfoNow(){
    const win = window.open(INFO_URL, '_blank', 'noopener');
    if (!win) {
      // Popup blocked – navigate current tab
      location.href = INFO_URL;
      return false;
    }
    return true;
  }

  // ===== Send to Google Sheets (fire-and-forget) =====
  async function sendLead(payload){
    try{
      if (window.Chat?.sendLeadToSheet) {
        await window.Chat.sendLeadToSheet(payload);
        return;
      }
      const url = (window.APP_CONFIG||{}).SHEET_API_URL;
      if (!url) return; // no webhook configured – skip silently
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // no preflight
        body: JSON.stringify(payload),
        mode: 'cors',
        redirect: 'follow',
        keepalive: true
      });
      // ignore response format; do not block navigation
      await res.text().catch(()=>{});
    } catch (e){
      // log only; never surface an error to the user here
      console.warn('[info] sendLead failed:', e);
    }
  }

  // ===== Submit (open first, then optionally send) =====
  const form = $('infoForm');
  if (form){
    form.addEventListener('submit', (ev)=>{
      ev.preventDefault();

      // 1) open the info page immediately (to pass popup blockers)
      openInfoNow();

      // 2) if fields are valid – send details in the background
      const role = getRole();
      const firstName = $('f_first') ? $('f_first').value.trim() : '';
      const lastName  = $('f_last')  ? $('f_last').value.trim()  : '';
      const phone     = $('f_phone') ? $('f_phone').value.replace(/[^\d]/g,'') : '';

      if (Val.nonEmpty(firstName) && Val.nonEmpty(lastName) && Val.phoneIL(phone)) {
        if (statusEl) statusEl.textContent = 'פותח את עמוד המידע… ושולח את הפרטים למזכירות.';
        const payload = {
          flow: 'info',
          createdAt: new Date().toISOString(),
          project: (window.APP_CONFIG||{}).PROJECT || 'Houston',
          source: 'יוסטון – דף מידע',
          role: role || '',
          firstName, lastName, phone
        };
        // fire-and-forget
        sendLead(payload);
      } else {
        if (statusEl) statusEl.textContent = 'פותח את עמוד המידע… (אפשר להשאיר פרטים כדי שנחזור במהירות)';
      }
    });
  }

  // ===== "Open without details" button =====
  const openOnlyBtn = $('openOnly');
  if (openOnlyBtn){
    openOnlyBtn.addEventListener('click', ()=>{
      openInfoNow();
      if (statusEl) statusEl.textContent = 'פותח את עמוד המידע…';
    });
  }
})();