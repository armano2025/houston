/* /public/branches/js/flows/billing.js
   Billing – חיוב/חשבוניות (2025)
   שיפורים: לוגו קבוע בפינה, כפתורים אחידים גדולים, 👨‍🚀 בכל טקסט,
   ובלי זום מעצבן – נשען על styles.light.css (16px+ לשדות).
*/
window.BillingWizard = (() => {
  const $ = (id) => document.getElementById(id);
  const stepEl   = $('step');
  const backBtn  = $('backBtn');
  const statusEl = $('statusBox');

  /* לוגו קבוע בפינה הימנית־עליונה (B, ללא שחור) – מוזרק ללא תלות ב-HTML */
  function ensureTopLogo(){
    if (document.getElementById('toplogo')) return;
    const d = document.createElement('div');
    d.id='toplogo'; d.className='toplogo'; d.setAttribute('aria-label','בראונשטיין');
    document.body.appendChild(d);
    document.body.classList.add('has-toplogo');
  }
  ensureTopLogo();

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

  // Validators / Sender
  const Val  = (window.Chat && window.Chat.Val) ? window.Chat.Val : {
    nonEmpty: s => String(s??'').trim().length>0,
    phoneIL: s => /^0\d{1,2}\d{7}$/.test(String(s??'').replace(/\D/g,'')),
  };
  const send = (payload) => (window.Chat?.sendLeadToSheet
    ? window.Chat.sendLeadToSheet(payload)
    : fetch((window.APP_CONFIG||{}).SHEET_API_URL, {
        method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'},
        body: JSON.stringify(payload)
      }).then(r=>r.json()));

  // UI helpers
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

  // 1 — הזדהות
  function step1_contact(){
    stepEl.innerHTML = `
      <div class="title-row">
        <h3>פרטי הזדהות 👨‍🚀</h3>
        <div class="muted">שלב 1/3</div>
      </div>
      ${chipsRow({label:'עם מי אנחנו מדברים?', name:'role', options:['תלמיד','הורה']})}
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
      if(!Val.nonEmpty(role))     return setStatus('👨‍🚀 נא לבחור: תלמיד/הורה');
      if(!Val.nonEmpty(firstName))return setStatus('👨‍🚀 נא למלא שם פרטי');
      if(!Val.nonEmpty(lastName)) return setStatus('👨‍🚀 נא למלא שם משפחה');
      if(!Val.phoneIL(phone))     return setStatus('👨‍🚀 טלפון לא תקין');
      setStatus('');
      Object.assign(State.data, { role, firstName, lastName, phone });
      step2_subjectTeacher();
    };
  }

  // 2 — מקצוע ומורה
  function step2_subjectTeacher(){
    const subjects = ['מתמטיקה','אנגלית','פיזיקה','שפה','הוראה מתקנת','אנגלית מדוברת לקטנטנים'];
    stepEl.innerHTML = `
      <div class="title-row">
        <h3>פרטי השירות 👨‍🚀</h3>
        <div class="muted">שלב 2/3</div>
      </div>
      ${selectRow({label:'מקצוע', name:'subject', options:subjects, required:true})}
      ${fieldRow({label:'שם המורה במרכז בראונשטיין (רשות)', name:'teacher', placeholder:'לדוגמה: לירז', required:false})}
      <div class="wizard-actions">
        <button class="btn" id="prev">חזרה</button>
        <button class="btn primary" id="next">המשך</button>
      </div>`;
    push(step2_subjectTeacher);

    $('prev').onclick = goBack;
    $('next').onclick = ()=>{
      const subject = $('f_subject').value;
      const teacher = $('f_teacher').value.trim();
      if(!Val.nonEmpty(subject)) return setStatus('👨‍🚀 נא לבחור מקצוע');
      setStatus('');
      Object.assign(State.data, { subject, teacher });
      step3_message();
    };
  }

  // 3 — תיאור חופשי (במקום רשימת נושאים)
  function step3_message(){
    stepEl.innerHTML = `
      <div class="title-row">
        <h3>איך נוכל לעזור? 👨‍🚀</h3>
        <div class="muted">שלב 3/3</div>
      </div>
      <div class="field">
        <label for="f_msg">כתבו לנו בקצרה (חיוב/חשבוניות/עדכון אמצעי תשלום וכו׳)</label>
        <textarea id="f_msg" rows="4" placeholder="כל מה שיעזור לנו לטפל בפנייה במהירות"></textarea>
      </div>
      <div class="wizard-actions">
        <button class="btn" id="prev">חזרה</button>
        <button class="btn primary" id="send">אישור ושליחה למזכירות 📤</button>
      </div>`;
    push(step3_message);

    $('prev').onclick = goBack;
    $('send').onclick = submit;
  }

  async function submit(){
    const d = State.data, errs=[];
    if(!Val.nonEmpty(d.role))      errs.push('role');
    if(!Val.nonEmpty(d.firstName)) errs.push('firstName');
    if(!Val.nonEmpty(d.lastName))  errs.push('lastName');
    if(!Val.phoneIL(d.phone))      errs.push('phone');
    if(!Val.nonEmpty(d.subject))   errs.push('subject');
    if(errs.length) return setStatus('👨‍🚀 חסר/לא תקין: '+errs.join(', '));

    const payload = {
      flow: 'billing',
      createdAt: new Date().toISOString(),
      project: (window.APP_CONFIG||{}).PROJECT || 'Houston',
      status: 'לטיפול',
      source: 'יוסטון – אתר',
      role: d.role, firstName: d.firstName, lastName: d.lastName, phone: d.phone,
      subject: d.subject, teacher: d.teacher || '',
      topic: 'טקסט חופשי', notes: ($('f_msg').value||'').trim()
    };

    try{
      setStatus('👨‍🚀 שולח…');
      const res = await send(payload);
      if(res && res.ok){
        setStatus('נשלח בהצלחה');
        stepEl.innerHTML = `
          <div class="bubble ok">הבקשה נקלטה ✅ נחזור אליכם בהקדם 👨‍🚀</div>
          <div class="wizard-actions">
            <button class="btn primary" onclick="location.href='index.html'">לתפריט מנויים</button>
          </div>`;
        backBtn.disabled = true;
        State.stack = [stepEl.innerHTML];
      }else{
        throw new Error((res && res.error) || 'server_error');
      }
    }catch(err){
      setStatus('שגיאה: ' + (err && err.message || err));
    }
  }

  function start(){
    State.data = {};
    State.stack = [];
    backBtn.disabled = true;
    setStatus('');
    step1_contact();
  }

  return { start };
})();