/* =========================================
/public/branches/js/flows/billing.js
וויזארד "Billing – חיוב/חשבוניות":
מסך 1 – הזדהות (תלמיד/הורה, שם פרטי, שם משפחה, טלפון)
מסך 2* – פרטי תלמיד (רק אם נבחר "הורה")
מסך 2 – מקצוע ומורה
מסך 3 – נושא הפנייה בחיוב/חשבוניות (בחירה; אם "אחר" נפתח תיאור חופשי)
מסך 4 – סיכום ושליחה (status="לטיפול")
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
  backBtn.onclick = goBack;

  // עזרי ולידציה/שליחה מתוך chat-core.js (נדרשים מראש ב-HTML)
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

  // עזרי UI קלים (תואמים למה שאתה רגיל)
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
        <div class="muted">שלב 1/4</div>
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

      if (role === 'הורה') step2_student();
      else {
        // אם תלמיד, נמפה שמות תלמיד כברירת מחדל (נוח לעיבוד/דוחות)
        Object.assign(State.data, { studentName: firstName, studentLastName: lastName });
        step2_subjectTeacher();
      }
    };
  }

  // מסך 2* — פרטי תלמיד (רק אם הורה)
  function step2_student(){
    stepEl.innerHTML = `
      <div class="title-row">
        <h3>פרטי התלמיד/ה 👨‍🚀</h3>
        <div class="muted">שלב 2/4</div>
      </div>
      ${fieldRow({label:'שם פרטי התלמיד/ה', name:'studentName', placeholder:'לדוגמה: נועה', required:true})}
      ${fieldRow({label:'שם משפחה התלמיד/ה', name:'studentLastName', placeholder:'לדוגמה: לוי', required:true})}
      <div class="wizard-actions">
        <button class="btn" id="prev">חזרה</button>
        <button class="btn primary" id="next">המשך</button>
      </div>`;
    push(step2_student);

    $('prev').onclick = goBack;
    $('next').onclick = ()=>{
      const studentName      = $('f_studentName').value.trim();
      const studentLastName  = $('f_studentLastName').value.trim();
      if(!Val.nonEmpty(studentName))     return setStatus('נא למלא שם תלמיד/ה');
      if(!Val.nonEmpty(studentLastName)) return setStatus('נא למלא שם משפחה של התלמיד/ה');
      setStatus('');
      Object.assign(State.data, { studentName, studentLastName });
      step2_subjectTeacher();
    };
  }

  // מסך 2 — מקצוע ומורה
  function step2_subjectTeacher(){
    const subjects = ['מתמטיקה','אנגלית','פיזיקה','שפה','הוראה מתקנת','אנגלית מדוברת'];
    stepEl.innerHTML = `
      <div class="title-row">
        <h3>מקצוע ומורה 👨‍🚀</h3>
        <div class="muted">שלב ${State.data.role==='הורה'? '3':'2'}/4</div>
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
      if(!Val.nonEmpty(subject)) return setStatus('נא לבחור מקצוע');
      setStatus('');
      Object.assign(State.data, { subject, teacher });
      step3_topic();
    };
  }

  // מסך 3 — נושא הפנייה (חיוב/חשבוניות)
  function step3_topic(){
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
        <div class="muted">שלב ${State.data.role==='הורה'? '4':'3'}/4</div>
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
    push(step3_topic);

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
      step4_summary();
    };
  }

  // מסך 4 — סיכום ושליחה
  function step4_summary(){
    const d = State.data;
    const rows = [
      ['סוג פונה', d.role],
      ['שם פרטי', d.firstName],
      ['שם משפחה', d.lastName],
      ['טלפון', d.phone],
      ...(d.studentName || d.studentLastName ? [['שם התלמיד/ה', `${d.studentName||''} ${d.studentLastName||''}`.trim()]]: []),
      ['מקצוע', d.subject],
      ['מורה', d.teacher || '-'],
      ['נושא הפנייה', d.topic],
      ...(d.notes ? [['פרטים נוספים', d.notes]] : []),
    ];
    stepEl.innerHTML = `
      <div class="title-row">
        <h3>סיכום ושליחה 👨‍🚀</h3>
        <div class="muted">סיום</div>
      </div>
      <div class="summary">
        ${rows.map(([k,v])=>`<div><strong>${k}:</strong> ${v||'-'}</div>`).join('')}
      </div>
      <div class="wizard-actions">
        <button class="btn" id="prev">חזרה</button>
        <button class="btn primary" id="send">אישור ושליחה למזכירות 📤</button>
      </div>`;
    push(step4_summary);

    $('prev').onclick = goBack;
    $('send').onclick = submit;
  }

  async function submit(){
    // ולידציה אחרונה זהירה
    const d = State.data, errs=[];
    if(!Val.nonEmpty(d.role))      errs.push('role');
    if(!Val.nonEmpty(d.firstName)) errs.push('firstName');
    if(!Val.nonEmpty(d.lastName))  errs.push('lastName');
    if(!Val.phoneIL(d.phone))      errs.push('phone');
    if(d.role==='הורה'){
      if(!Val.nonEmpty(d.studentName))     errs.push('studentName');
      if(!Val.nonEmpty(d.studentLastName)) errs.push('studentLastName');
    }
    if(!Val.nonEmpty(d.subject))   errs.push('subject');
    if(!Val.nonEmpty(d.topic))     errs.push('topic');
    if(errs.length) return setStatus('חסר/לא תקין: '+errs.join(', '));

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

      // תלמיד (אם רלוונטי; לתלמיד נמלא כבר במסך 1 כברירת מחדל)
      studentName: d.studentName || '',
      studentLastName: d.studentLastName || '',

      // הקשר לימודי
      subject: d.subject,
      teacher: d.teacher || '',

      // תוכן בילינג
      topic: d.topic,
      notes: d.notes || ''
    };

    try{
      setStatus('שולח ל־Google Sheets…');
      const res = await send(payload);
      if(res && res.ok){
        setStatus('נשלח בהצלחה');
        stepEl.innerHTML = `
          <div class="bubble ok">הבקשה נקלטה ✅ ניצור קשר בהקדם 👨‍🚀</div>
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
    step1_contact();
  }

  return { start };
})();