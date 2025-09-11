/* /public/branches/js/flows/message.js
   וויזארד "Message – הודעה למזכירות" מקוצר ל-3 מסכים:
   1) הזדהות: תלמיד/הורה + שם פרטי + שם משפחה + טלפון
   2) מלל חופשי בלבד (אין רשימת נושאים)
   3) סיכום ושליחה — status="לטיפול"
   שליחה ב-text/plain ל-GAS או דרך Chat.sendLeadToSheet אם קיים.
*/
window.MessageWizard = (() => {
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

  // Validators + sender (נלקח מ-chat-core אם קיים)
  const Val = (window.Chat && window.Chat.Val) ? window.Chat.Val : {
    nonEmpty: s => String(s??'').trim().length>0,
    phoneIL: s => /^0\d{1,2}\d{7}$/.test(String(s??'').replace(/\D/g,'')),
  };
  const send = (payload) => (window.Chat?.sendLeadToSheet
      ? window.Chat.sendLeadToSheet(payload)
      : fetch((window.APP_CONFIG||{}).SHEET_API_URL, {
          method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'},
          body: JSON.stringify(payload)
        }).then(r=>r.json()));

  /* UI helpers */
  const fieldRow = ({label, name, type='text', placeholder='', value='', required=false, id}) => {
    const _id = id || `f_${name}`;
    return `
      <div class="field">
        <label for="${_id}">${label}${required?' *':''}</label>
        <input id="${_id}" name="${name}" type="${type}" value="${value||''}" placeholder="${placeholder}" ${required?'required':''}/>
      </div>`;
  };
  const textareaRow = ({label, name, placeholder='', rows=4, id})=>{
    const _id = id || `f_${name}`;
    return `
      <div class="field">
        <label for="${_id}">${label}</label>
        <textarea id="${_id}" name="${name}" rows="${rows}" placeholder="${placeholder}"></textarea>
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

  // 1) הזדהות: תפקיד + שם פרטי + שם משפחה + טלפון
  function step1_identity(){
    stepEl.innerHTML = `
      <div class="title-row">
        <h3>הודעה למזכירות 👨‍🚀</h3>
        <div class="muted">שלב 1/3</div>
      </div>
      ${chipsRow({label:'עם מי אני מדבר?', name:'role', options:['תלמיד','הורה']})}
      ${fieldRow({label:'שם פרטי',  name:'firstName', placeholder:'לדוגמה: חן', required:true})}
      ${fieldRow({label:'שם משפחה', name:'lastName',  placeholder:'לדוגמה: בראונשטיין', required:true})}
      ${fieldRow({label:'טלפון',     name:'phone', type:'tel', placeholder:'05XXXXXXXX', required:true})}
      <div class="wizard-actions">
        <button class="btn primary" id="next">המשך</button>
      </div>`;
    push(step1_identity);

    const getRole = bindSingleChips('chips_role');
    el('next').onclick = ()=>{
      const role      = getRole();
      const firstName = el('f_firstName').value.trim();
      const lastName  = el('f_lastName').value.trim();
      const phone     = el('f_phone').value.replace(/[^\d]/g,'');
      if(!Val.nonEmpty(role))      return setStatus('נא לבחור: תלמיד או הורה');
      if(!Val.nonEmpty(firstName)) return setStatus('נא למלא שם פרטי');
      if(!Val.nonEmpty(lastName))  return setStatus('נא למלא שם משפחה');
      if(!Val.phoneIL(phone))      return setStatus('טלפון לא תקין');
      setStatus('');
      Object.assign(State.data, { role, firstName, lastName, phone });
      step2_message();
    };
  }

  // 2) מלל חופשי בלבד
  function step2_message(){
    stepEl.innerHTML = `
      <div class="title-row">
        <h3>מה חשוב שנדע? 👨‍🚀</h3>
        <div class="muted">שלב 2/3</div>
      </div>
      ${textareaRow({label:'כתבו כאן את הפרטים החשובים (רשות)', name:'message', placeholder:'ספרו לנו בקצרה למה אתם פונים / מה צריך לטפל'})}
      <div class="wizard-actions">
        <button class="btn" id="prev">חזרה</button>
        <button class="btn primary" id="next">המשך</button>
      </div>`;
    push(step2_message);

    el('prev').onclick = goBack;
    el('next').onclick = ()=>{
      const message = (el('f_message').value||'').trim();
      Object.assign(State.data, { message });
      setStatus('');
      step3_summary();
    };
  }

  // 3) סיכום ושליחה
  function step3_summary(){
    const d = State.data;
    const rows = [
      ['אני', d.role],
      ['שם פרטי', d.firstName],
      ['שם משפחה', d.lastName],
      ['טלפון', d.phone],
      ...(d.message ? [['הודעה', d.message]] : [])
    ];
    stepEl.innerHTML = `
      <div class="title-row">
        <h3>סיכום ושליחה 👨‍🚀</h3>
        <div class="muted">שלב 3/3</div>
      </div>
      <div class="summary">
        ${rows.map(([k,v])=>`<div><strong>${k}:</strong> ${v||'-'}</div>`).join('')}
      </div>
      <div class="wizard-actions">
        <button class="btn" id="prev">חזרה</button>
        <button class="btn primary" id="send">אישור ושליחה למזכירות 📤</button>
      </div>`;
    push(step3_summary);

    el('prev').onclick = goBack;
    el('send').onclick = submit;
  }

  async function submit(){
    const d = State.data, errs=[];
    if(!Val.nonEmpty(d.role))      errs.push('role');
    if(!Val.nonEmpty(d.firstName)) errs.push('firstName');
    if(!Val.nonEmpty(d.lastName))  errs.push('lastName');
    if(!Val.phoneIL(d.phone))      errs.push('phone');
    if(errs.length) return setStatus('חסר/לא תקין: '+errs.join(', '));

    // תאימות מלאה לגיליון: משאירים שדות לא בשימוש כריקים
    const payload = {
      flow: 'message',
      createdAt: new Date().toISOString(),
      project: (window.APP_CONFIG||{}).PROJECT || 'Houston',
      status: 'לטיפול',
      source: 'יוסטון – אתר',
      // מזדהה
      role: d.role,
      firstName: d.firstName,
      lastName: d.lastName,
      phone: d.phone,
      // שדות שהוסרו – נשארים ריקים לשמירת סכימה קיימת
      studentName: '',
      studentLastName: '',
      subject: '',
      track: '',
      grade: '',
      units: '',
      teacher: '',
      // הודעה חופשית
      message: d.message || ''
    };

    try{
      setStatus('שולח ל־Google Sheets…');
      const res = await send(payload);
      if(res && res.ok){
        setStatus('נשלח בהצלחה');
        stepEl.innerHTML = `
          <div class="bubble ok">ההודעה נקלטה ✅ נחזור אליכם בהקדם 👨‍🚀</div>
          <div class="wizard-actions">
            <button class="btn" onclick="location.href='index.html'">חזרה לתפריט מנוי/ה</button>
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
    step1_identity();
  }

  return { start };
})();