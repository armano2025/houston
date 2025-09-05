/* /public/branches/js/flows/message.js
   וויזארד "Message – הודעה למזכירות" ללא צ'אט.
   שלבים (עד 3 שדות למסך):
   1) זיהוי (אני ה… תלמיד/הורה) + שם פרטי + שם משפחה
   2) טלפון (+ אם "הורה": שם פרטי התלמיד + שם משפחה התלמיד)
   3) פרופיל – מקצוע, מסלול, כיתה
   4) השלמות פרופיל – יחידות (אם צריך), שם מורה (רשות)
   5) מלל חופשי למזכירות (רשות)
   6) סיכום ושליחה — status תמיד "לטיפול". שיגור ב-text/plain ל-GAS.
*/
window.MessageWizard = (() => {
  const el = (id) => document.getElementById(id);
  const stepEl = el('step');
  const backBtn = el('backBtn');
  const statusEl = el('statusBox');

  const subjects = ['מתמטיקה','אנגלית','פיזיקה','שפה','הוראה מתקנת','אנגלית מדוברת'];
  const tracks   = ['קבוצתי','טריפל','פרטי'];
  const grades   = ['א׳','ב׳','ג׳','ד׳','ה׳','ו׳','ז׳','ח׳','ט׳','י׳','י״א','י״ב','סטודנט'];

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

  // Validators + sender (מ-chat-core אם קיים)
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

  /* UI helpers (תואמים לקיים) */
  const fieldRow = ({label, name, type='text', placeholder='', value='', required=false, id}) => {
    const _id = id || `f_${name}`;
    return `
      <div class="field">
        <label for="${_id}">${label}${required?' *':''}</label>
        <input id="${_id}" name="${name}" type="${type}" value="${value||''}" placeholder="${placeholder}" ${required?'required':''}/>
      </div>`;
  };
  const selectRow = ({label, name, options=[], required=false, id})=>{
    const _id = id || `f_${name}`;
    const opts = ['<option value="">— בחרו —</option>'].concat(
      options.map(o => `<option value="${String(o)}">${String(o)}</option>`)
    ).join('');
    return `
      <div class="field">
        <label for="${_id}">${label}${required?' *':''}</label>
        <select id="${_id}" name="${name}" ${required?'required':''}>${opts}</select>
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

  /* ===== Steps ===== */

  // 1) Role + First/Last
  function step1_identity(){
    stepEl.innerHTML = `
      <div class="title-row">
        <h3>הודעה למזכירות 👨‍🚀</h3>
        <div class="muted">שלב 1/6</div>
      </div>
      ${chipsRow({label:'עם מי אני מדבר?', name:'role', options:['תלמיד','הורה']})}
      ${fieldRow({label:'שם פרטי',  name:'firstName', placeholder:'לדוגמה: חן', required:true})}
      ${fieldRow({label:'שם משפחה', name:'lastName',  placeholder:'לדוגמה: בראונשטיין', required:true})}
      <div class="wizard-actions">
        <button class="btn primary" id="next">המשך</button>
      </div>`;
    push(step1_identity);

    const getRole = bindSingleChips('chips_role');
    el('next').onclick = ()=>{
      const role      = getRole();
      const firstName = el('f_firstName').value.trim();
      const lastName  = el('f_lastName').value.trim();
      if(!Val.nonEmpty(role))      return setStatus('נא לבחור: תלמיד או הורה');
      if(!Val.nonEmpty(firstName)) return setStatus('נא למלא שם פרטי');
      if(!Val.nonEmpty(lastName))  return setStatus('נא למלא שם משפחה');
      setStatus('');
      Object.assign(State.data, { role, firstName, lastName });
      step2_contactAndStudent();
    };
  }

  // 2) Phone (+ student names if parent)
  function step2_contactAndStudent(){
    const isParent = (State.data.role === 'הורה');
    stepEl.innerHTML = `
      <div class="title-row">
        <h3>פרטי קשר 👨‍🚀</h3>
        <div class="muted">שלב 2/6</div>
      </div>
      ${fieldRow({label:'טלפון', name:'phone', type:'tel', placeholder:'05XXXXXXXX', required:true})}
      ${isParent ? fieldRow({label:'שם פרטי התלמיד/ה', name:'studentName', placeholder:'לדוגמה: נועה', required:true}) : ''}
      ${isParent ? fieldRow({label:'שם משפחה התלמיד/ה', name:'studentLastName', placeholder:'לדוגמה: כהן', required:true}) : ''}
      <div class="wizard-actions">
        <button class="btn" id="prev">חזרה</button>
        <button class="btn primary" id="next">המשך</button>
      </div>`;
    push(step2_contactAndStudent);

    el('prev').onclick = goBack;
    el('next').onclick = ()=>{
      const phone = el('f_phone').value.replace(/[^\d]/g,'');
      if(!Val.phoneIL(phone)) return setStatus('טלפון לא תקין');
      const patch = { phone };
      if (isParent){
        const sn  = el('f_studentName').value.trim();
        const sln = el('f_studentLastName').value.trim();
        if(!Val.nonEmpty(sn))  return setStatus('נא למלא שם פרטי של התלמיד/ה');
        if(!Val.nonEmpty(sln)) return setStatus('נא למלא שם משפחה של התלמיד/ה');
        patch.studentName = sn;
        patch.studentLastName = sln;
      } else {
        // תלמיד: נאכלס אוטומטית מהמזדהה
        patch.studentName = State.data.firstName;
        patch.studentLastName = State.data.lastName;
      }
      setStatus('');
      Object.assign(State.data, patch);
      step3_profileA();
    };
  }

  // 3) subject, track, grade
  function step3_profileA(){
    stepEl.innerHTML = `
      <div class="title-row">
        <h3>פרטי המנוי 👨‍🚀</h3>
        <div class="muted">שלב 3/6</div>
      </div>
      ${selectRow({label:'מקצוע', name:'subject', options:subjects, required:true})}
      ${chipsRow({label:'מסלול למידה', name:'track', options:tracks})}
      ${selectRow({label:'כיתה', name:'grade', options:grades, required:true})}
      <div class="wizard-actions">
        <button class="btn" id="prev">חזרה</button>
        <button class="btn primary" id="next">המשך</button>
      </div>`;
    push(step3_profileA);

    const getTrack = bindSingleChips('chips_track');

    el('prev').onclick = goBack;
    el('next').onclick = ()=>{
      const subject = el('f_subject').value;
      const grade   = el('f_grade').value;
      const track   = getTrack();
      if(!Val.nonEmpty(subject)) return setStatus('נא לבחור מקצוע');
      if(!Val.nonEmpty(grade))   return setStatus('נא לבחור כיתה');
      setStatus('');
      Object.assign(State.data, { subject, grade, track });
      step4_profileB();
    };
  }

  // 4) units (if needed), teacher (optional)
  function step4_profileB(){
    const needsUnits = ['י׳','י״א','י״ב'].includes(State.data.grade||'');
    stepEl.innerHTML = `
      <div class="title-row">
        <h3>השלמות פרופיל 👨‍🚀</h3>
        <div class="muted">שלב 4/6</div>
      </div>
      <div id="unitsWrap" style="${needsUnits ? '' : 'display:none'}">
        ${chipsRow({label:'יחידות (לכיתות י/י״א/י״ב)', name:'units', options:['3','4','5']})}
      </div>
      ${fieldRow({label:'שם המורה במרכז הלמידה (רשות)', name:'teacher', placeholder:'לדוגמה: לירז', required:false})}
      <div class="wizard-actions">
        <button class="btn" id="prev">חזרה</button>
        <button class="btn primary" id="next">המשך</button>
      </div>`;
    push(step4_profileB);

    const getUnits = needsUnits ? bindSingleChips('chips_units') : (()=>'');

    el('prev').onclick = goBack;
    el('next').onclick = ()=>{
      const teacher = el('f_teacher').value.trim();
      const units   = needsUnits ? getUnits() : '';
      if (needsUnits && !Val.nonEmpty(units)) return setStatus('נא לבחור מספר יחידות');
      setStatus('');
      Object.assign(State.data, { units, teacher });
      step5_message();
    };
  }

  // 5) free message (optional)
  function step5_message(){
    stepEl.innerHTML = `
      <div class="title-row">
        <h3>הודעה למזכירות 👨‍🚀</h3>
        <div class="muted">שלב 5/6</div>
      </div>
      <div class="field">
        <label for="f_message">מה תרצו להוסיף? (רשות)</label>
        <textarea id="f_message" rows="4" placeholder="העדפות/אילוצים/כל פרט שיעזור לנו"></textarea>
      </div>
      <div class="wizard-actions">
        <button class="btn" id="prev">חזרה</button>
        <button class="btn primary" id="next">המשך</button>
      </div>`;
    push(step5_message);

    el('prev').onclick = goBack;
    el('next').onclick = ()=>{
      const message = (el('f_message').value||'').trim();
      Object.assign(State.data, { message });
      step6_summary();
    };
  }

  // 6) Summary + submit
  function step6_summary(){
    const d = State.data;
    const rows = [
      ['אני', d.role],
      ['שם פרטי', d.firstName], ['שם משפחה', d.lastName], ['טלפון', d.phone],
      ['שם התלמיד/ה', `${d.studentName||''} ${d.studentLastName||''}`.trim()],
      ['מקצוע', d.subject], ['מסלול', d.track||''],
      ['כיתה', d.grade], ...(d.units ? [['יחידות', d.units]] : []),
      ['מורה', d.teacher||''],
      ...(d.message ? [['הודעה', d.message]] : [])
    ];
    stepEl.innerHTML = `
      <div class="title-row">
        <h3>סיכום ושליחה 👨‍🚀</h3>
        <div class="muted">שלב 6/6</div>
      </div>
      <div class="summary">${rows.map(([k,v])=>`<div><strong>${k}:</strong> ${v||'-'}</div>`).join('')}</div>
      <div class="wizard-actions">
        <button class="btn" id="prev">חזרה</button>
        <button class="btn primary" id="send">אישור ושליחה למזכירות 📤</button>
      </div>`;
    push(step6_summary);

    el('prev').onclick = goBack;
    el('send').onclick = submit;
  }

  async function submit(){
    const d = State.data, errs=[];
    if(!Val.nonEmpty(d.role))       errs.push('role');
    if(!Val.nonEmpty(d.firstName))  errs.push('firstName');
    if(!Val.nonEmpty(d.lastName))   errs.push('lastName');
    if(!Val.phoneIL(d.phone))       errs.push('phone');
    if(!Val.nonEmpty(d.studentName))      errs.push('studentName');
    if(!Val.nonEmpty(d.studentLastName))  errs.push('studentLastName');
    if(!Val.nonEmpty(d.subject))    errs.push('subject');
    if(!Val.nonEmpty(d.grade))      errs.push('grade');
    if(['י׳','י״א','י״ב'].includes(d.grade||'') && !Val.nonEmpty(d.units)) errs.push('units');
    if(errs.length) return setStatus('חסר/לא תקין: ' + errs.join(', '));

    const payload = {
      flow: 'message',
      createdAt: new Date().toISOString(),
      project: (window.APP_CONFIG||{}).PROJECT || 'Houston',
      status: 'לטיפול',
      source: 'יוסטון – אתר',
      // מזדהה + תלמיד
      role: d.role,
      firstName: d.firstName, lastName: d.lastName, phone: d.phone,
      studentName: d.studentName, studentLastName: d.studentLastName,
      // פרופיל
      subject: d.subject, track: d.track||'', grade: d.grade, units: d.units||'',
      teacher: d.teacher||'',
      // הודעה
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
      setStatus('שגיאה: ' + err.message);
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