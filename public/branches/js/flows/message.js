/* /public/branches/js/flows/message.js
   Message – הודעה למזכירות (זרימה קצרה 2025)
   מסך 1: הזדהות (תלמיד/הורה, שם, שם משפחה, טלפון)
   מסך 2: מלל חופשי
   מסך 3: סיכום ושליחה (status="לטיפול")
   אחיד עם 👨‍🚀 ולוגו B צף בפינה הימנית-עליונה.
*/
window.MessageWizard = (() => {
  const $ = (id) => document.getElementById(id);
  const stepEl   = $('step');
  const backBtn  = $('backBtn');
  const statusEl = $('statusBox');

  // מצמיד לוגו "B" קבוע לפינה הימנית העליונה (תואם styles.light.css .logo)
  (function ensureTopLogo(){
    if (document.querySelector('.logo')) return;
    const d = document.createElement('div');
    d.className = 'logo';
    d.setAttribute('aria-label','בראונשטיין');
    document.body.appendChild(d);
  })();

  const State = { data:{}, stack:[] };
  const setStatus = (t='') => { if(statusEl) statusEl.textContent = t; };
  const push = (fn) => { State.stack.push(fn); if(backBtn) backBtn.disabled = State.stack.length<=1; };
  const goBack = () => {
    if (State.stack.length>1){
      State.stack.pop();
      if(backBtn) backBtn.disabled = State.stack.length<=1;
      State.stack.at(-1)();
    }
  };
  if (backBtn) backBtn.onclick = goBack;

  // Validators + sender (כמו בצ'אט)
  const Val = (window.Chat && window.Chat.Val) ? window.Chat.Val : {
    nonEmpty: s => String(s??'').trim().length>0,
    phoneIL : s => /^0\d{1,2}\d{7}$/.test(String(s??'').replace(/\D/g,'')),
  };
  const send = (payload) => (window.Chat?.sendLeadToSheet
    ? window.Chat.sendLeadToSheet(payload)
    : fetch((window.APP_CONFIG||{}).SHEET_API_URL, {
        method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'},
        body: JSON.stringify(payload)
      }).then(r=>r.json()));

  /* ===== UI helpers ===== */
  const fieldRow = ({label, name, type='text', placeholder='', value='', required=false}) => `
    <div class="field">
      <label for="f_${name}">${label}${required?' *':''}</label>
      <input id="f_${name}" name="${name}" type="${type}" value="${value||''}" placeholder="${placeholder}" ${required?'required':''}/>
    </div>`;

  const chipsRow = ({label, name, options=[]})=>{
    const chips = options.map(t=>`<button type="button" class="chip" data-name="${name}" data-value="${t}" aria-pressed="false">${t}</button>`).join('');
    return `<div class="field"><label>${label}</label><div class="chips role" id="chips_${name}">${chips}</div></div>`;
  };

  const bindSingleChips = (id)=>{
    const cont = $(id); let picked = '';
    cont.addEventListener('click', (ev)=>{
      const b = ev.target.closest('.chip'); if(!b) return;
      [...cont.querySelectorAll('.chip[aria-pressed="true"]')].forEach(x=>x.setAttribute('aria-pressed','false'));
      b.setAttribute('aria-pressed', b.getAttribute('aria-pressed')==='true'?'false':'true');
      picked = (b.getAttribute('aria-pressed')==='true') ? b.dataset.value : '';
    });
    return ()=> picked;
  };

  /* ===== Steps ===== */

  // 1) הזדהות קצרה
  function step1_identity(){
    stepEl.innerHTML = `
      <div class="title-row">
        <h3>הודעה למזכירות 👨‍🚀</h3>
        <div class="muted">שלב 1/3</div>
      </div>
      ${chipsRow({label:'עם מי אנחנו מדברים?', name:'role', options:['תלמיד','הורה']})}
      ${fieldRow({label:'שם פרטי',  name:'firstName', placeholder:'לדוגמה: חן', required:true})}
      ${fieldRow({label:'שם משפחה', name:'lastName',  placeholder:'לדוגמה: בראונשטיין', required:true})}
      ${fieldRow({label:'טלפון',    name:'phone',     type:'tel', placeholder:'05XXXXXXXX', required:true})}
      <div class="wizard-actions">
        <button class="btn primary" id="next">המשך</button>
      </div>`;
    push(step1_identity);

    const getRole = bindSingleChips('chips_role');
    $('next').onclick = ()=>{
      const role      = getRole();
      const firstName = $('f_firstName').value.trim();
      const lastName  = $('f_lastName').value.trim();
      const phone     = $('f_phone').value.replace(/[^\d]/g,'');
      if(!Val.nonEmpty(role))      return setStatus('👨‍🚀 נא לבחור: תלמיד או הורה');
      if(!Val.nonEmpty(firstName)) return setStatus('👨‍🚀 נא למלא שם פרטי');
      if(!Val.nonEmpty(lastName))  return setStatus('👨‍🚀 נא למלא שם משפחה');
      if(!Val.phoneIL(phone))      return setStatus('👨‍🚀 טלפון לא תקין');
      setStatus('');
      Object.assign(State.data, { role, firstName, lastName, phone });
      step2_message();
    };
  }

  // 2) שדה מלל חופשי
  function step2_message(){
    stepEl.innerHTML = `
      <div class="title-row">
        <h3>מה חשוב שנדע? 👨‍🚀</h3>
        <div class="muted">שלב 2/3</div>
      </div>
      <div class="field">
        <label for="f_message">כתבו כאן בקצרה (רשות)</label>
        <textarea id="f_message" rows="5" placeholder="הקלידו כל פרט שיעזור לנו לטפל בבקשה"></textarea>
      </div>
      <div class="wizard-actions">
        <button class="btn" id="prev">חזרה</button>
        <button class="btn primary" id="next">המשך</button>
      </div>`;
    push(step2_message);

    $('prev').onclick = goBack;
    $('next').onclick = ()=>{
      const message = ( $('f_message').value || '' ).trim();
      Object.assign(State.data, { message });
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

    $('prev').onclick = goBack;
    $('send').onclick = submit;
  }

  async function submit(){
    const d = State.data, errs=[];
    if(!Val.nonEmpty(d.role))       errs.push('role');
    if(!Val.nonEmpty(d.firstName))  errs.push('firstName');
    if(!Val.nonEmpty(d.lastName))   errs.push('lastName');
    if(!Val.phoneIL(d.phone))       errs.push('phone');
    if(errs.length) return setStatus('👨‍🚀 חסר/לא תקין: ' + errs.join(', '));

    const payload = {
      flow: 'message',
      createdAt: new Date().toISOString(),
      project: (window.APP_CONFIG||{}).PROJECT || 'Houston',
      status: 'לטיפול',
      source: 'יוסטון – אתר',
      role: d.role,
      firstName: d.firstName,
      lastName: d.lastName,
      phone: d.phone,
      message: d.message || ''
    };

    try{
      setStatus('👨‍🚀 שולח…');
      const res = await send(payload);
      if(res && res.ok){
        setStatus('נשלח בהצלחה');
        stepEl.innerHTML = `
          <div class="bubble ok">ההודעה נקלטה ✅ נחזור אליכם בהקדם 👨‍🚀</div>
          <div class="wizard-actions">
            <button class="btn primary" onclick="location.href='index.html'">לתפריט מנויים</button>
          </div>`;
        if(backBtn) backBtn.disabled = true;
        State.stack = [stepEl.innerHTML];
      }else{
        throw new Error((res && res.error) || 'server_error');
      }
    }catch(err){
      setStatus('שגיאה: ' + (err?.message || err));
    }
  }

  function start(){
    State.data = {};
    State.stack = [];
    if(backBtn) backBtn.disabled = true;
    setStatus('');
    step1_identity();
  }

  return { start };
})();