/* /public/branches/js/flows/cancel.js
   וויזארד "ביטול מנוי" – קטן, יציב, ושולח דרך Chat.sendLeadToSheet (כמו Makeup).
   מסכים (3–4 בלבד):
   1) מי ממלא + פרטי קשר (שם/שם משפחה/טלפון)
   2) פרטי תלמיד (אם "הורה": שם תלמיד + שם משפחה תלמיד; אם "תלמיד": דילוג)
   3) סיבת ביטול (Dropdown) — כותרת לפי הדרישה
   4) הערות (רשות) + סיכום ושליחה
   ה־status תמיד "לטיפול".
*/
window.CancelWizard = (() => {
  const el = (id) => document.getElementById(id);
  const stepEl = el('step');
  const backBtn = el('backBtn');
  const statusEl = el('statusBox');

  const State = { data:{ role:'תלמיד' }, stack:[] };
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

  // Validators ו־API מהליבה
  const Val = window.Chat?.Val;
  const send = window.Chat?.sendLeadToSheet;

  // ===== UI helpers =====
  const fieldRow = ({label, name, type='text', placeholder='', value='', required=false}) => {
    const id = `f_${name}`;
    return `
      <div class="field">
        <label for="${id}">${label}${required?' *':''}</label>
        <input id="${id}" name="${name}" type="${type}" value="${value||''}" placeholder="${placeholder}" ${required?'required':''}/>
      </div>`;
  };
  const selectRow = ({label, name, options=[], required=false})=>{
    const id = `f_${name}`;
    const opts = ['<option value="">— בחרו —</option>'].concat(
      options.map(o => `<option value="${String(o)}">${String(o)}</option>`)
    ).join('');
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

  // ===== Steps =====
  function step1_contact(){
    stepEl.innerHTML = `
      <div class="title-row">
        <h3>ביטול מנוי 👨‍🚀</h3>
        <div class="muted">שלב 1/4</div>
      </div>
      <p class="muted">ארשום לי כמה פרטים חשובים כדי שאוכל לעזור לך 🧑‍🚀</p>
      ${chipsRow({label:'עם מי אני מדבר?', name:'role', options:['תלמיד','הורה']})}
      ${fieldRow({label:'שם פרטי',  name:'firstName', placeholder:'לדוגמה: חן', required:true})}
      ${fieldRow({label:'שם משפחה', name:'lastName',  placeholder:'לדוגמה: בראונשטיין', required:true})}
      ${fieldRow({label:'טלפון',     name:'phone',     placeholder:'05XXXXXXXX', type:'tel', required:true})}
      <div class="wizard-actions">
        <button class="btn primary" id="next">המשך</button>
      </div>`;
    push(step1_contact);

    const getRole = bindSingleChips('chips_role');
    el('next').onclick = ()=>{
      const role      = getRole() || 'תלמיד';
      const firstName = el('f_firstName').value.trim();
      const lastName  = el('f_lastName').value.trim();
      const phone     = el('f_phone').value.replace(/[^\d]/g,'');
      if(!Val.nonEmpty(firstName)) return setStatus('נא למלא שם פרטי');
      if(!Val.nonEmpty(lastName))  return setStatus('נא למלא שם משפחה');
      if(!Val.phoneIL(phone))      return setStatus('טלפון לא תקין');
      setStatus('');
      Object.assign(State.data, { role, firstName, lastName, phone });
      step2_whoIsStudent();
    };
  }

  function step2_whoIsStudent(){
    // אם ההורה ממלא → נשאל שם תלמיד/שם משפחה תלמיד; אם תלמיד → נדלג
    if (State.data.role === 'הורה'){
      stepEl.innerHTML = `
        <div class="title-row">
          <h3>פרטי תלמיד 👨‍🚀</h3>
          <div class="muted">שלב 2/4</div>
        </div>
        ${fieldRow({label:'שם פרטי התלמיד/ה', name:'studentName', placeholder:'לדוגמה: נועה', required:true})}
        ${fieldRow({label:'שם משפחה התלמיד/ה', name:'studentLastName', placeholder:'לדוגמה: כהן', required:true})}
        <div class="wizard-actions">
          <button class="btn" id="prev">חזרה</button>
          <button class="btn primary" id="next">המשך</button>
        </div>`;
      push(step2_whoIsStudent);

      el('prev').onclick = goBack;
      el('next').onclick = ()=>{
        const studentName      = el('f_studentName').value.trim();
        const studentLastName  = el('f_studentLastName').value.trim();
        if(!Val.nonEmpty(studentName))     return setStatus('נא למלא שם תלמיד/ה');
        if(!Val.nonEmpty(studentLastName)) return setStatus('נא למלא שם משפחה תלמיד/ה');
        setStatus('');
        Object.assign(State.data, { studentName, studentLastName });
        step3_reason();
      };
    } else {
      // תלמיד ממלא → אפשר להמשיך ישר לסיבה (לא שואלים שוב את שמו)
      Object.assign(State.data, { studentName:'', studentLastName:'' });
      step3_reason();
    }
  }

  function step3_reason(){
    const fname = (State.data.firstName||'').trim() || 'שם פרטי';
    stepEl.innerHTML = `
      <div class="title-row">
        <h3>סיבת ביטול 👨‍🚀</h3>
        <div class="muted">שלב 3/4</div>
      </div>
      <p class="muted">תודה ${fname}, אשמח לדעת מהי סיבת הביטול 👨‍🚀</p>
      ${selectRow({label:'סיבת הביטול', name:'reason', options:[
        'מעבר מסלול/הפסקה זמנית',
        'קושי בשילוב זמנים',
        'החלטה אישית/אחר',
        'חוסר התאמה מקצועית',
        'אחר'
      ], required:true})}
      <div class="wizard-actions">
        <button class="btn" id="prev">חזרה</button>
        <button class="btn primary" id="next">המשך</button>
      </div>`;
    push(step3_reason);

    el('prev').onclick = goBack;
    el('next').onclick = ()=>{
      const reason = el('f_reason').value;
      if(!Val.nonEmpty(reason)) return setStatus('נא לבחור סיבת ביטול');
      setStatus('');
      Object.assign(State.data, { reason });
      step4_notesSummary();
    };
  }

  function step4_notesSummary(){
    const fname = (State.data.firstName||'').trim() || '🙂';
    stepEl.innerHTML = `
      <div class="title-row">
        <h3>הערות אחרונות 👨‍🚀</h3>
        <div class="muted">שלב 4/4</div>
      </div>
      <p class="muted">${fname}, לפני שאשלח למזכירות — יש משהו שחשוב להוסיף?</p>
      <div class="field">
        <label for="f_notes">הערות (רשות)</label>
        <textarea id="f_notes" rows="3" placeholder="כל דבר שיעזור לנו לסגור את התהליך בצורה מסודרת"></textarea>
      </div>

      <div class="wizard-actions">
        <button class="btn" id="prev">חזרה</button>
        <button class="btn primary" id="send">אישור ושליחה למזכירות 📤</button>
      </div>`;
    push(step4_notesSummary);

    el('prev').onclick = goBack;
    el('send').onclick = submit;
  }

  async function submit(){
    // ולידציות בסיסיות: כמו ב-Makeup, כדי למנוע "Server error"
    const d = State.data, errs=[];
    if(!Val.nonEmpty(d.firstName)) errs.push('firstName');
    if(!Val.nonEmpty(d.lastName))  errs.push('lastName');
    if(!Val.phoneIL(d.phone))      errs.push('phone');
    if(!Val.nonEmpty(d.reason))    errs.push('reason');
    // אם הורה — נוודא שמילא תלמיד
    if(d.role==='הורה'){
      if(!Val.nonEmpty(d.studentName))     errs.push('studentName');
      if(!Val.nonEmpty(d.studentLastName)) errs.push('studentLastName');
    }
    if (errs.length) return setStatus('חסר/לא תקין: ' + errs.join(', '));

    const payload = {
      flow: 'cancel',
      createdAt: new Date().toISOString(),
      project: (window.APP_CONFIG||{}).PROJECT || 'Houston',
      status: 'לטיפול',

      // מזהה
      firstName: d.firstName, lastName: d.lastName, phone: d.phone,
      role: d.role,

      // תלמיד (אם רלוונטי)
      studentName: d.studentName || '',
      studentLastName: d.studentLastName || '',

      // סיבה + הערות
      reason: d.reason,
      notes: (el('f_notes')?.value || '').trim()
    };

    try{
      setStatus('שולח ל־Google Sheets…');
      const res = await send(payload); // אותו API בדיוק כמו ב-Makeup
      if (res && res.ok){
        setStatus('נשלח בהצלחה');
        stepEl.innerHTML = `
          <div class="bubble ok">הבקשה לביטול נקלטה ✅ ניצור קשר להשלמת התהליך 👨‍🚀</div>
          <div class="wizard-actions">
            <button class="btn" onclick="location.href='index.html'">חזרה לתפריט מנוי/ה</button>
          </div>`;
        backBtn.disabled = true;
        State.stack = [stepEl.innerHTML];
      } else {
        throw new Error((res && res.error) || 'server_error');
      }
    } catch(err){
      // כאן לא נזרוק “Server error” גנרי — נציג הודעה מפורטת עם הטקסט שהתקבל.
      setStatus('שגיאה בשליחה: ' + (err?.message || String(err)));
    }
  }

  function start(){
    State.data = { role:'תלמיד' };
    State.stack = [];
    backBtn.disabled = true;
    setStatus('');
    step1_contact();
  }

  return { start };
})();