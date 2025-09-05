// /public/branches/js/flows/info.js
// דף אינפו (Landing): איסוף ליד קצר → שמירה ל-GAS (flow: "info")
// + פתיחת אתר ה-WordPress בלשונית חדשה באופן בטוח גם באייפון.
// שדות נשמרים: contactRole, firstName, lastName, phone, subjects[], interests[]

window.InfoPage = (() => {
  const WP_URL = 'https://wordpress-1184560-4777160.cloudwaysapps.com/';

  const el = (id) => document.getElementById(id);
  const form = () => el('infoForm');
  const statusEl = () => el('statusBox');

  // Validators (ניקח מ-chat-core אם קיים)
  const Val = (window.Chat && window.Chat.Val) ? window.Chat.Val : {
    nonEmpty: (s) => String(s ?? '').trim().length > 0,
    phoneIL: (s) => /^0\d{1,2}\d{7}$/.test(String(s ?? '').replace(/\D/g,'')),
  };

  // שליחה ל-GAS (text/plain, עמיד ל-preflight)
  async function sendToSheet(payload){
    if (window.Chat?.sendLeadToSheet) return await window.Chat.sendLeadToSheet(payload);

    const url = (window.APP_CONFIG||{}).SHEET_API_URL;
    if (!url) throw new Error('SHEET_API_URL לא הוגדר');

    const res = await fetch(url, {
      method:'POST',
      headers:{ 'Content-Type':'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      mode:'cors',
      redirect:'follow',
      keepalive:true
    });

    if (res.type === 'opaque') return { ok:true, opaque:true };
    const raw = await res.text();
    try { return JSON.parse(raw); } catch(e){}
    return (/ok/i.test(raw) ? { ok:true, raw } : { ok:false, raw });
  }

  // הפעלת צ'יפים (סינגל/מולטי)
  function bindChips(containerId, { multi=false } = {}){
    const cont = el(containerId);
    if (!cont) return ()=> multi ? [] : '';
    cont.addEventListener('click', (ev)=>{
      const b = ev.target.closest('.chip'); if(!b) return;
      if (!multi){
        [...cont.querySelectorAll('.chip[aria-pressed="true"]')].forEach(x=>x.setAttribute('aria-pressed','false'));
      }
      const now = b.getAttribute('aria-pressed') === 'true';
      b.setAttribute('aria-pressed', now ? 'false' : 'true');
    });
    return () => {
      const picked = [...cont.querySelectorAll('.chip[aria-pressed="true"]')].map(b => b.dataset.value);
      return multi ? picked : (picked[0] || '');
    };
  }

  // פתיחה בטוחה של קישור (ידידותי ל-iOS) – בתוך מחוות המשתמש
  function safeOpenNewTab(url){
    // עוגן זמני כדי להבטיח שהפתיחה תיחשב "מחווה" גם בספארי
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function setStatus(msg, type=''){
    const s = statusEl(); if (!s) return;
    s.textContent = msg || '';
    s.classList.remove('ok','err');
    if (type) s.classList.add(type);
  }

  function init(){
    // הפעלת צ'יפים
    const getRole      = bindChips('chips_role',      { multi:false });
    const getSubjects  = bindChips('chips_subjects',  { multi:true  });
    const getInterests = bindChips('chips_interests', { multi:true  });

    // שליחה
    form().addEventListener('submit', async (ev)=>{
      ev.preventDefault();
      setStatus('');

      const contactRole = getRole();
      const firstName = el('f_firstName').value.trim();
      const lastName  = el('f_lastName').value.trim();
      const phoneRaw  = el('f_phone').value;
      const phone     = String(phoneRaw).replace(/[^\d]/g,'');

      if (!Val.nonEmpty(contactRole)) return setStatus('נא לבחור: תלמיד/הורה','err');
      if (!Val.nonEmpty(firstName))   return setStatus('נא למלא שם פרטי','err');
      if (!Val.nonEmpty(lastName))    return setStatus('נא למלא שם משפחה','err');
      if (!Val.phoneIL(phone))        return setStatus('טלפון לא תקין','err');

      const subjects  = getSubjects();
      const interests = getInterests();

      // פותחים את ה-WordPress מיד (מחווה של המשתמש) כדי לא להיחסם באייפון
      safeOpenNewTab(WP_URL);

      // בינתיים – שולחים ל-שיטס
      setStatus('שולח למזכירות…');
      const payload = {
        flow: 'info',
        createdAt: new Date().toISOString(),
        project: (window.APP_CONFIG||{}).PROJECT || 'Houston',
        status: 'לטיפול',
        source: 'Info Landing',
        contactRole, firstName, lastName, phone,
        subjects, interests
      };

      try{
        const res = await sendToSheet(payload);
        if (res && res.ok){
          setStatus('נשלח בהצלחה ✅','ok');
          // ניקוי טופס קל
          form().reset();
          // כיבוי צ'יפים
          ['chips_role','chips_subjects','chips_interests'].forEach(id=>{
            const root = el(id);
            if (!root) return;
            root.querySelectorAll('.chip[aria-pressed="true"]').forEach(b => b.setAttribute('aria-pressed','false'));
          });
        } else {
          throw new Error(res && res.raw ? res.raw : 'server_error');
        }
      } catch(err){
        setStatus('שגיאה בשליחה: ' + err.message, 'err');
      }
    }, { passive:false });
  }

  return { init };
})();