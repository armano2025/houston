// /public/branches/js/flows/info.js
// ויזארד "פרטי מנוי חודשי – מתעניינים": מינימום פרטים → שליחה ל-GAS → הפניה לאתר המידע.
// שלבים:
// 1) אני: תלמיד/הורה + שם פרטי + שם משפחה + טלפון (type=tel) – עד 3 פריטים למסך + כפתור המשך
// 2) סיכום קצר + כפתור "עבור לאתר המידע" (מבצע שליחה ואז מפנה)
//
// שמירה לגיליון: flow="info", status="לטיפול", source="יוסטון – אתר", וגם redirectUrl (למעקב).
// הפניה: לאתר הוורדפרס, עם פרמטרים בשאילתה (role/first/last/phone/source=houston).

window.InfoWizard = (() => {
  const el = (id) => document.getElementById(id);
  const stepEl   = el('step');
  const backBtn  = el('backBtn');
  const statusEl = el('statusBox');

  const State = { data:{}, stack:[] };
  const setStatus = (t='') => { statusEl && (statusEl.textContent = t); };
  const push = (fn) => { State.stack.push(fn); backBtn.disabled = State.stack.length<=1; };
  const goBack = () => {
    if (State.stack.length>1){
      State.stack.pop();
      backBtn.disabled = State.stack.length<=1;
      State.stack[State.stack.length-1]();
    }
  };
  backBtn.onclick = goBack;

  // ולידציה (מהליבה, עם fallback)
  const Val = (window.Chat && window.Chat.Val) ? window.Chat.Val : {
    nonEmpty: s => String(s??'').trim().length>0,
    phoneIL: s => /^0\d{1,2}\d{7}$/.test(String(s??'').replace(/\D/g,'')),
  };

  // שליחה עמידה ל-GAS (ללא preflight + תמיכה ב-opaque/טקסט/JSON)
  async function send(payload){
    if (window.Chat?.sendLeadToSheet) return await window.Chat.sendLeadToSheet(payload);
    const url = (window.APP_CONFIG||{}).SHEET_API_URL;
    if (!url) throw new Error('SHEET_API_URL לא הוגדר');

    const res = await fetch(url, {
      method:'POST',
      headers:{'Content-Type':'text/plain;charset=utf-8'},
      body: JSON.stringify(payload),
      mode:'cors',
      redirect:'follow',
      keepalive:true
    });

    if (res.type === 'opaque') return { ok:true, opaque:true };
    if (!res.ok){
      const t = await res.text().catch(()=> '');
      throw new Error(`HTTP ${res.status} ${res.statusText}${t?` — ${t.slice(0,140)}`:''}`);
    }

    const raw = await res.text();
    try { return JSON.parse(raw); } catch(e){}
    return (/ok/i.test(raw) ? { ok:true, raw } : { ok:false, raw });
  }

  /* עזרי UI קצרים */
  const fieldRow = ({label, name, type='text', placeholder='', value='', required=false}) => {
    const id = `f_${name}`;
    return `
      <div class="field">
        <label for="${id}">${label}${required?' *':''}</label>
        <input id="${id}" name="${name}" type="${type}" value="${value||''}" placeholder="${placeholder}" ${required?'required':''}/>
      </div>`;
  };
  const chipsRow = ({label, name, options=[]})=>{
    const chips = options.map(t=>`<button type="button" class="chip" data-name="${name}" data-value="${t}" aria-pressed="false">${t}</button>`).join('');
    return `
      <div class="field">
        <label>${label}</label>
        <div class="chips" id="chips_${name}">${chips}</div>
      </div>`;
  };
  const bindSingleChips = (id) => {
    const cont = el(id);
    let picked = '';
    cont.addEventListener('click', (ev)=>{
      const b = ev.target.closest('.chip'); if(!b) return;
      [...cont.querySelectorAll('.chip[aria-pressed="true"]')].forEach(x=>x.setAttribute('aria-pressed','false'));
      b.setAttribute('aria-pressed', b.getAttribute('aria-pressed')==='true'?'false':'true');
      picked = (b.getAttribute('aria-pressed')==='true') ? b.dataset.value : '';
    });
    return ()=> picked;
  };

  /* ===== שלבים ===== */
  function step1_minimal(){
    stepEl.innerHTML = `
      <div class="title-row"><h3>פרטי מנוי חודשי 👨‍🚀</h3></div>
      <p class="muted">נזין 3 פרטים קצרים ואז נעבור לעמוד המידע 🧑‍🚀</p>

      ${chipsRow({label:'עם מי אני מדבר?', name:'role', options:['תלמיד','הורה']})}
      ${fieldRow({label:'שם פרטי',  name:'firstName', placeholder:'לדוגמה: חן', required:true})}
      ${fieldRow({label:'שם משפחה', name:'lastName',  placeholder:'לדוגמה: בראונשטיין', required:true})}
      ${fieldRow({label:'טלפון',     name:'phone',     placeholder:'05XXXXXXXX', type:'tel', required:true})}

      <div class="wizard-actions">
        <button class="btn primary" id="next">המשך לעמוד המידע</button>
      </div>`;
    push(step1_minimal);

    const getRole = bindSingleChips('chips_role');
    el('next').onclick = ()=>{
      const role = getRole();
      const firstName = el('f_firstName').value.trim();
      const lastName  = el('f_lastName').value.trim();
      const phone     = el('f_phone').value.replace(/[^\d]/g,'');
      if(!Val.nonEmpty(role))     return setStatus('נא לבחור: תלמיד/הורה');
      if(!Val.nonEmpty(firstName))return setStatus('נא למלא שם פרטי');
      if(!Val.nonEmpty(lastName)) return setStatus('נא למלא שם משפחה');
      if(!Val.phoneIL(phone))     return setStatus('טלפון לא תקין');
      setStatus('');
      Object.assign(State.data, { role, firstName, lastName, phone });
      step2_redirect();
    };
  }

  function step2_redirect(){
    const d = State.data;
    const rows = [
      ['אני', d.role],
      ['שם', `${d.firstName} ${d.lastName}`.trim()],
      ['טלפון', d.phone]
    ].map(([k,v])=>`<div><strong>${k}:</strong> ${v}</div>`).join('');

    stepEl.innerHTML = `
      <div class="title-row"><h3>מעבר לעמוד המידע 👨‍🚀</h3></div>
      <div class="summary">${rows}</div>
      <p class="muted">נפתח את עמוד המידע בחלון חדש, ונשמור את הפרטים שלך כדי שנוכל לחזור אליך.</p>
      <div class="wizard-actions">
        <button class="btn" id="prev">חזרה</button>
        <button class="btn primary" id="go">לעמוד המידע</button>
      </div>`;
    push(step2_redirect);

    el('prev').onclick = goBack;
    el('go').onclick = submitAndRedirect;
  }

  async function submitAndRedirect(){
    const d = State.data;

    const payload = {
      flow: 'info',
      createdAt: new Date().toISOString(),
      project: (window.APP_CONFIG||{}).PROJECT || 'Houston',
      status: 'לטיפול',
      source: 'יוסטון – אתר',
      role: d.role,
      firstName: d.firstName,
      lastName: d.lastName,
      phone: d.phone,
      redirectUrl: (window.APP_CONFIG||{}).INFO_REDIRECT || ''
    };

    try{
      setStatus('שומר ועובר לעמוד המידע…');
      await send(payload); // גם אם opaque — נמשיך להפניה
    }catch(err){
      // לא חוסמים מעבר — רק מראים שגיאה קטנה
      setStatus('שגיאה בשמירה: ' + err.message + ' — ממשיכים להפניה.');
    }

    // הפניה עם פרמטרים (URL-encoded)
    const base = (window.APP_CONFIG||{}).INFO_REDIRECT || 'https://wordpress-1184560-4777160.cloudwaysapps.com/';
    const q = new URLSearchParams({
      source: 'houston',
      role: d.role,
      first: d.firstName,
      last: d.lastName,
      phone: d.phone
    }).toString();

    // פותחים בטאב חדש כדי לא לאבד את המשתמש
    window.open(`${base}?${q}`, '_blank', 'noopener');
    // וגם מציגים “תודה”
    const fname = (d.firstName||'').trim() || '🙂';
    stepEl.innerHTML = `
      <div class="bubble ok">תודה ${fname}! פתחנו לך את עמוד המידע בחלון חדש 👨‍🚀</div>
      <div class="wizard-actions">
        <button class="btn" onclick="location.href='../../index.html'">חזרה לתפריט</button>
      </div>`;
    backBtn.disabled = true;
    State.stack = [stepEl.innerHTML];
    setStatus('');
  }

  function start(){
    State.data = {};
    State.stack = [];
    backBtn.disabled = true;
    setStatus('');
    step1_minimal();
  }

  return { start };
})();