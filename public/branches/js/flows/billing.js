/* =========================================
/public/branches/js/flows/billing.js
וויזארד "Billing – חיוב/חשבוניות" (פישוט זרימה):
מסך 1 – הזדהות (תלמיד/הורה, שם פרטי, שם משפחה, טלפון)
מסך 2 – נושא הפנייה בחיוב/חשבוניות (אם "אחר" נפתח תיאור חופשי)
מסך 3 – סיכום ושליחה (status="לטיפול")
נשען על chat-core.js עבור ולידציה ושליחה ל־Google Sheets (text/plain).
========================================= */
window.BillingWizard = (() => {
  const $ = (id) => document.getElementById(id);
  const stepEl   = $('step');
  const backBtn  = $('backBtn');
  const statusEl = $('statusBox');

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
  backBtn && (backBtn.onclick = goBack);

  // עזרי ולידציה/שליחה מתוך chat-core.js (נדרשים מראש ב-HTML)
  const Val  = (window.Chat && window.Chat.Val) ? window.Chat.Val : {
    nonEmpty: s => String(s??'').trim().length>0,
    phoneIL: s => /^0\d{1,2}\d{7}$/.test(String(s??'').replace(/\D/g,'')),
  };
  const esc = (window.Chat && window.Chat.esc) ? window.Chat.esc
    : (s => String(s??'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));
  const FRIENDLY_ERR = 'לא הצלחנו לשלוח את הבקשה כרגע 🙁 בדקו את החיבור לאינטרנט ונסו שוב בעוד רגע.';
  const send = (payload) => (window.Chat?.sendLeadToSheet
    ? window.Chat.sendLeadToSheet(payload)
    : fetch((window.APP_CONFIG||{}).SHEET_API_URL, {
        method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'},
        body: JSON.stringify(payload)
      }).then(r=>r.json()));

  // UI helpers (שורות טופס/צ'יפים)
  const fieldRow = ({label, name, type='text', placeholder='', value='', required=false})=>{
    const id = `f_${name}`;
    return `
      <div class="field">
        <label for="${id}">${label}${required?' *':''}</label>
        <input id="${id}" name="${name}" type="${type}" placeholder="${placeholder}" value="${value||''}" ${required?'required':''}/>
      </div>`;
  };
  const selectRow = ({label, name, options=[], required=false})=>{
    const id = `f_${name}`;
    const opts = ['<option value="">— בחרו —</option>']
      .concat(options.map(o => {
        const v = (typeof o==='string') ? o : (o.value||o.label);
        const t = (typeof o==='string') ? o : (o.label||o.value);
        return `<option value="${String(v)}">${String(t)}</option>`;
      })).join('');
    return `
      <div class="field">
        <label for="${id}">${label}${required?' *':''}</label>
        <select id="${id}" name="${name}" ${required?'required':''}>${opts}</select>
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
  const bindSingleChips = (id)=>{
    const cont = $(id);
    let picked = '';
    cont.addEventListener('click', (ev)=>{
      const b = ev.target.closest('.chip'); if(!b) return;
      [...cont.querySelectorAll('.chip[aria-pressed="true"]')].forEach(x=>x.setAttribute('aria-pressed','false'));
      b.setAttribute('aria-pressed', b.getAttribute('aria-pressed')==='true' ? 'false' : 'true');
      picked = b.getAttribute('aria-pressed')==='true' ? b.dataset.value : '';
    });
    return ()=> picked;
  };

  /* ===== שלבים ===== */

  // מסך 1 — הזדהות
  function step1_contact(){
    stepEl.innerHTML = `
      <div class="title-row">
        <h3>פרטי הזדהות 👨‍🚀</h3>
        <div class="muted">שלב 1/3</div>
      </div>
      ${chipsRow({label:'עם מי אני מדבר?', name:'role', options:['תלמיד','הורה']})}
      ${fieldRow({label:'שם פרטי', name:'firstName', placeholder:'לדוגמה: חן', required:true})}
      ${fieldRow({label:'שם משפחה', name:'lastName', placeholder:'לדוגמה: בראונשטיין', required:true})}
      ${fieldRow({label:'טלפון', name:'phone', type:'tel', placeholder:'05XXXXXXXX', required:true})}
      <div class="wizard-actions">
        <button class="btn primary" id="next">המשך</button>
      </div>`;
    push(step1_contact);

    const getRole = bindSingleChips('chips_role');
    $('next').onclick = ()=>{
      const role = getRole();
      const firstName = $('f_firstName').value.trim();
      const lastName  = $('f_lastName').value.trim();
      const phone     = $('f_phone').value.replace(/[^\d]/g,'');
      if(!Val.nonEmpty(role))     return setStatus('נא לבחור: תלמיד/הורה');
      if(!Val.nonEmpty(firstName))return setStatus('נא למלא שם פרטי');
      if(!Val.nonEmpty(lastName)) return setStatus('נא למלא שם משפחה');
      if(!Val.phoneIL(phone))     return setStatus('טלפון לא תקין');
      setStatus('');
      Object.assign(State.data, { role, firstName, lastName, phone });
      step2_topic();
    };
  }

  // מסך 2 — נושא הפנייה (חיוב/חשבוניות)
  function step2_topic(){
    const topics = [
      'עדכון אמצעי תשלום (כרטיס אשראי)',
      'חיוב כפול / זיכוי חסר',
      'העברת חיוב להורה אחר',
      'קבלת חשבונית/קבלה',
      'שינוי פרטי חשבונית',
      'בירור חיוב',
      'אחר'
    ];
    stepEl.innerHTML = `
      <div class="title-row">
        <h3>על מה תרצו לדבר? 👨‍🚀</h3>
        <div class="muted">שלב 2/3</div>
      </div>
      ${selectRow({label:'נושא הפנייה', name:'topic', options:topics, required:true})}
      <div class="field" id="otherWrap" style="display:none">
        <label for="f_other">פרטו (רשות)</label>
        <textarea id="f_other" rows="3" placeholder="כתבו כאן כל פרט שיעזור לנו לטפל בבקשה"></textarea>
      </div>
      <div class="wizard-actions">
        <button class="btn" id="prev">חזרה</button>
        <button class="btn primary" id="next">המשך</button>
      </div>`;
    push(step2_topic);

    const topicSel  = $('f_topic');
    const otherWrap = $('otherWrap');
    topicSel.addEventListener('change', ()=> {
      otherWrap.style.display = (topicSel.value === 'אחר') ? '' : 'none';
    });

    $('prev').onclick = goBack;
    $('next').onclick = ()=>{
      const topic = topicSel.value;
      const notes = (topic === 'אחר') ? ($('f_other').value || '').trim() : '';
      if(!Val.nonEmpty(topic)) return setStatus('נא לבחור נושא');
      setStatus('');
      Object.assign(State.data, { topic, notes });
      step3_summary();
    };
  }

  // מסך 3 — סיכום ושליחה
  function step3_summary(){
    const d = State.data;
    const rows = [
      ['סוג פונה', d.role],
      ['שם פרטי', d.firstName],
      ['שם משפחה', d.lastName],
      ['טלפון', d.phone],
      ['נושא הפנייה', d.topic],
      ...(d.notes ? [['פרטים נוספים', d.notes]] : []),
    ];
    stepEl.innerHTML = `
      <div class="title-row">
        <h3>סיכום ושליחה 👨‍🚀</h3>
        <div class="muted">סיום</div>
      </div>
      <p class="muted">רגע לפני השליחה – כדאי לוודא שהכול נכון:</p>
      <div class="summary">
        ${rows.map(([k,v])=>`<div><strong>${k}:</strong> ${esc(v)||'-'}</div>`).join('')}
      </div>
      <div class="wizard-actions">
        <button class="btn" id="prev">חזרה</button>
        <button class="btn primary" id="send">אישור ושליחה למזכירות 📤</button>
      </div>`;
    push(step3_summary);

    $('prev').onclick = goBack;
    $('send').onclick = submit;
  }

  async function submit(){
    const d = State.data, errs=[];
    if(!Val.nonEmpty(d.role))      errs.push('מי ממלא');
    if(!Val.nonEmpty(d.firstName)) errs.push('שם פרטי');
    if(!Val.nonEmpty(d.lastName))  errs.push('שם משפחה');
    if(!Val.phoneIL(d.phone))      errs.push('טלפון');
    if(!Val.nonEmpty(d.topic))     errs.push('נושא הפנייה');
    if(errs.length) return setStatus('חסר או לא תקין: '+errs.join(', '));

    const payload = {
      flow: 'billing',
      createdAt: new Date().toISOString(),
      project: (window.APP_CONFIG||{}).PROJECT || 'Houston',
      status: 'לטיפול',
      source: 'יוסטון – אתר',

      // מזדהה
      role: d.role,
      firstName: d.firstName,
      lastName: d.lastName,
      phone: d.phone,

      // שדות שהוסרו בזרימה – נשמרים ריקים לתאימות לגיליון אם קיים
      studentName: '',
      studentLastName: '',
      subject: '',
      teacher: '',

      // תוכן בילינג
      topic: d.topic,
      notes: d.notes || ''
    };

    const sendBtn = $('send');
    try{
      if (sendBtn) sendBtn.disabled = true; // מניעת שליחה כפולה
      setStatus('שולח למזכירות…');
      const res = await send(payload);
      if(res && res.ok){
        setStatus('');
        stepEl.innerHTML = `
          <div class="bubble ok">הבקשה נקלטה ✅ המזכירות תיצור קשר בהקדם.</div>
          <div class="wizard-actions">
            <button class="btn" onclick="location.href='index.html'">חזרה לתפריט מנויים</button>
          </div>`;
        backBtn && (backBtn.disabled = true);
        State.stack = [stepEl.innerHTML];
      }else{
        throw new Error((res && res.error) || 'server_error');
      }
    }catch(err){
      console.error('[Houston] billing submit failed:', err?.message || err);
      if (sendBtn) sendBtn.disabled = false;
      setStatus(FRIENDLY_ERR);
    }
  }

  function start(){
    State.data = {};
    State.stack = [];
    backBtn && (backBtn.disabled = true);
    setStatus('');
    step1_contact();
  }

  return { start };
})();