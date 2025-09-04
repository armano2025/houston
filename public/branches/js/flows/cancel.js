/* /public/branches/js/flows/cancel.js
   וויזארד "ביטול מנוי (Cancel)" – ללא צ'אט:
   שלבים (עד 3 רכיבים למסך, פשוטים ונגישים):
   1) עם מי אני מדבר? (תלמיד/הורה) + שם פרטי + שם משפחה + טלפון  ← (כן, כאן 4 פריטים כי זה מסך הזדהות)
   2) פרטי המנוי: אם הורה → שם פרטי/משפחה של התלמיד (חובה), לכולם: שם מורה (רשות)
   3) סיבת הביטול: בחירה מרשימה (חובה), ואם "אחר" → טקסט חופשי (חובה)
   4) מועד כניסה לתוקף: תאריך (חובה) או צ'יפ "מיידי" (אם נבחר – אין צורך בתאריך)
   5) הערות נוספות למזכירות (רשות)
   6) סיכום ושליחה — status תמיד "לטיפול". שליחה ל-GAS כ-text/plain (ללא preflight). */

window.CancelWizard = (() => {
  const el = (id) => document.getElementById(id);
  const stepEl = el('step');
  const backBtn = el('backBtn');
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

  // וולידציה + שליחה מהליבה
  const Val = (window.Chat && window.Chat.Val) ? window.Chat.Val : {
    nonEmpty: s => String(s??'').trim().length>0,
    phoneIL: s => /^0\d{1,2}\d{7}$/.test(String(s??'').replace(/\D/g,'')),
    date: s => /^\d{4}-\d{2}-\d{2}$/.test(s)
  };
  const send = (payload) => (window.Chat?.sendLeadToSheet
      ? window.Chat.sendLeadToSheet(payload)
      : fetch((window.APP_CONFIG||{}).SHEET_API_URL, {
          method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'},
          body: JSON.stringify(payload)
        }).then(r=>r.json()));

  /* עזרי UI קצרים */
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
      options.map(o => {
        const v = (typeof o==='string') ? o : (o.value||o.label);
        const t = (typeof o==='string') ? o : (o.label||o.value);
        return `<option value="${String(v)}">${String(t)}</option>`;
      })
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

  /* ===== שלבים ===== */

  // מסך 1: זהות + קשר
  function step1_contact(){
    stepEl.innerHTML = `
      <div class="title-row">
        <h3>ביטול מנוי 👨‍🚀</h3>
        <div class="muted">שלב 1/6</div>
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
      const role = getRole();
      const firstName = el('f_firstName').value.trim();
      const lastName  = el('f_lastName').value.trim();
      const phone     = el('f_phone').value.replace(/[^\d]/g,'');
      if(!Val.nonEmpty(role))      return setStatus('בחר/י: תלמיד או הורה');
      if(!Val.nonEmpty(firstName)) return setStatus('נא למלא שם פרטי');
      if(!Val.nonEmpty(lastName))  return setStatus('נא למלא שם משפחה');
      if(!Val.phoneIL(phone))      return setStatus('טלפון לא תקין');
      setStatus('');
      Object.assign(State.data, { role, firstName, lastName, phone });
      step2_subscriber();
    };
  }

  // מסך 2: פרטי מנוי (אם הורה → שם תלמיד/ה; לכולם → שם מורה רשות)
  function step2_subscriber(){
    const isParent = (State.data.role === 'הורה');
    stepEl.innerHTML = `
      <div class="title-row">
        <h3>פרטי המנוי 👨‍🚀</h3>
        <div class="muted">שלב 2/6</div>
      </div>
      ${isParent ? fieldRow({label:'שם פרטי התלמיד/ה', name:'studentFirst', placeholder:'לדוגמה: נועה', required:true}) : ''}
      ${isParent ? fieldRow({label:'שם משפחה התלמיד/ה', name:'studentLast', placeholder:'לדוגמה: כהן', required:true}) : ''}
      ${fieldRow({label:'שם המורה במרכז (רשות)', name:'teacher', placeholder:'לדוגמה: לירז', required:false})}
      <div class="wizard-actions">
        <button class="btn" id="prev">חזרה</button>
        <button class="btn primary" id="next">המשך</button>
      </div>`;
    push(step2_subscriber);

    el('prev').onclick = goBack;
    el('next').onclick = ()=>{
      const teacher = (el('f_teacher')?.value||'').trim();
      if(isParent){
        const studentFirst = (el('f_studentFirst')?.value||'').trim();
        const studentLast  = (el('f_studentLast')?.value||'').trim();
        if(!Val.nonEmpty(studentFirst)) return setStatus('נא למלא שם פרטי התלמיד/ה');
        if(!Val.nonEmpty(studentLast))  return setStatus('נא למלא שם משפחה התלמיד/ה');
        Object.assign(State.data, { studentFirst, studentLast, teacher });
      } else {
        Object.assign(State.data, { teacher });
      }
      setStatus('');
      step3_reason();
    };
  }

  // מסך 3: סיבת הביטול
  function step3_reason(){
    const reasons = ['סיבות אישיות','קשיי תשלום','שינוי לוח זמנים','חוסר שביעות רצון מהשירות','אחר'];
    stepEl.innerHTML = `
      <div class="title-row">
        <h3>סיבת הביטול 👨‍🚀</h3>
        <div class="muted">שלב 3/6</div>
      </div>
      <p class="muted">תודה ${State.data.firstName||''}, אשמח לדעת מהי סיבת הביטול 👨‍🚀</p>
      ${selectRow({label:'סיבה', name:'reason', options:reasons, required:true})}
      <div id="otherWrap" style="display:none">
        ${fieldRow({label:'פרטו בבקשה', name:'reasonOther', placeholder:'כמה מילים שיעזרו לנו להבין', required:true})}
      </div>
      <div class="wizard-actions">
        <button class="btn" id="prev">חזרה</button>
        <button class="btn primary" id="next">המשך</button>
      </div>`;
    push(step3_reason);

    const reasonSel = el('f_reason');
    const otherWrap = el('otherWrap');
    const toggleOther = ()=>{
      otherWrap.style.display = (reasonSel.value === 'אחר') ? '' : 'none';
    };
    reasonSel.addEventListener('change', toggleOther);
    toggleOther();

    el('prev').onclick = goBack;
    el('next').onclick = ()=>{
      const reason = reasonSel.value;
      if(!Val.nonEmpty(reason)) return setStatus('נא לבחור סיבה');
      let reasonOther = '';
      if(reason === 'אחר'){
        reasonOther = (el('f_reasonOther')?.value||'').trim();
        if(!Val.nonEmpty(reasonOther)) return setStatus('נא לפרט את הסיבה');
      }
      setStatus('');
      Object.assign(State.data, { reason, reasonOther });
      step4_effective();
    };
  }

  // מסך 4: מועד כניסה לתוקף (תאריך או "מיידי")
  function step4_effective(){
    stepEl.innerHTML = `
      <div class="title-row">
        <h3>מתי תרצו שהביטול ייכנס לתוקף? 👨‍🚀</h3>
        <div class="muted">שלב 4/6</div>
      </div>
      ${chipsRow({label:'אפשרות מהירה', name:'when', options:['מיידי']})}
      ${fieldRow({label:'או תאריך יעד', name:'effectiveDate', type:'date', required:false})}
      <div class="wizard-actions">
        <button class="btn" id="prev">חזרה</button>
        <button class="btn primary" id="next">המשך</button>
      </div>`;
    push(step4_effective);

    const getWhen = bindSingleChips('chips_when');
    const dateEl = el('f_effectiveDate');

    // אם בוחרים "מיידי" – ננעל/ננקה תאריך; ואם מבטלים – משחררים
    el('chips_when').addEventListener('click', ()=>{
      const v = getWhen();
      if(v === 'מיידי'){ dateEl.value = ''; dateEl.disabled = true; }
      else { dateEl.disabled = false; }
    });

    el('prev').onclick = goBack;
    el('next').onclick = ()=>{
      const when = getWhen();
      const effectiveDate = dateEl.value;
      if(when !== 'מיידי' && !Val.date(effectiveDate)) return setStatus('בחר/י תאריך או בחר/י "מיידי"');
      setStatus('');
      Object.assign(State.data, {
        effective: (when==='מיידי') ? 'מיידי' : effectiveDate
      });
      step5_notes();
    };
  }

  // מסך 5: הערות (רשות)
  function step5_notes(){
    stepEl.innerHTML = `
      <div class="title-row">
        <h3>הערות נוספות למזכירות 👨‍🚀</h3>
        <div class="muted">שלב 5/6</div>
      </div>
      <div class="field">
        <label for="f_notes">הערות (רשות)</label>
        <textarea id="f_notes" rows="3" placeholder="כל דבר שיעזור לנו לטפל בבקשה"></textarea>
      </div>
      <div class="wizard-actions">
        <button class="btn" id="prev">חזרה</button>
        <button class="btn primary" id="next">המשך</button>
      </div>`;
    push(step5_notes);

    el('prev').onclick = goBack;
    el('next').onclick = ()=>{
      State.data.notes = (el('f_notes')?.value||'').trim();
      step6_summary();
    };
  }

  // מסך 6: סיכום ושליחה
  function step6_summary(){
    const d = State.data;
    const who   = d.role||'';
    const child = (who==='הורה') ? `${d.studentFirst||''} ${d.studentLast||''}`.trim() : '';
    const rows = [
      ['סוג פונה', who],
      ['שם פרטי', d.firstName], ['שם משפחה', d.lastName], ['טלפון', d.phone],
      ...(who==='הורה' ? [['שם התלמיד/ה', child]] : []),
      ['שם המורה', d.teacher||''],
      ['סיבת הביטול', d.reason + (d.reason==='אחר' && d.reasonOther ? ` – ${d.reasonOther}` : '')],
      ['מועד כניסה לתוקף', d.effective||''],
      ...(d.notes ? [['הערות', d.notes]] : [])
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
    const d = State.data, errs = [];
    if(!Val.nonEmpty(d.role))      errs.push('role');
    if(!Val.nonEmpty(d.firstName)) errs.push('firstName');
    if(!Val.nonEmpty(d.lastName))  errs.push('lastName');
    if(!Val.phoneIL(d.phone))      errs.push('phone');
    if(d.role==='הורה'){
      if(!Val.nonEmpty(d.studentFirst)) errs.push('studentFirst');
      if(!Val.nonEmpty(d.studentLast))  errs.push('studentLast');
    }
    if(!Val.nonEmpty(d.reason))    errs.push('reason');
    if(d.reason==='אחר' && !Val.nonEmpty(d.reasonOther)) errs.push('reasonOther');
    if(d.effective!=='מיידי' && !Val.date(d.effective||'')) errs.push('effective');

    if(errs.length){ setStatus('חסר/לא תקין: ' + errs.join(', ')); return; }

    const payload = {
      flow: 'cancel',
      createdAt: new Date().toISOString(),
      project: (window.APP_CONFIG||{}).PROJECT || 'Houston',
      status: 'לטיפול',

      // מזדהה
      role: d.role,
      firstName: d.firstName,
      lastName: d.lastName,
      phone: d.phone,

      // תלמיד אם הורה
      studentFirst: d.studentFirst || '',
      studentLast:  d.studentLast  || '',

      // פרטים נוספים
      teacher: d.teacher || '',

      // ביטול
      reason: d.reason,
      reasonOther: d.reason==='אחר' ? (d.reasonOther||'') : '',
      effective: d.effective,            // 'מיידי' או YYYY-MM-DD

      // הערות
      notes: d.notes || ''
    };

    try{
      setStatus('שולח ל־Google Sheets…');
      const res = await send(payload);
      if(res && res.ok){
        setStatus('נשלח בהצלחה');
        stepEl.innerHTML = `
          <div class="bubble ok">הבקשה לביטול נקלטה ✅ ניצור קשר בהקדם להשלמת התהליך 👨‍🚀</div>
          <div class="wizard-actions">
            <button class="btn" onclick="location.href='index.html'">חזרה לתפריט מנוי/ה</button>
          </div>`;
        backBtn.disabled = true;
        State.stack = [stepEl.innerHTML];
      } else {
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
    step1_contact();
  }

  return { start };
})();