/* /public/branches/js/flows/billing.js
   נתיב: "Billing – עדכון תשלום / חשבוניות"
   הסבר: מימוש וויזארד מרובה-מסכים בהתאם לתסריט: 
   1) זהות (תלמיד/הורה) + שם פרטי/משפחה, 2) טלפון (+ פרטי תלמיד אם הורה),
   3) מקצוע/מסלול, 4) כיתה/יחידות/מורה, 5) נושא פנייה (כולל "אחר"), 
   6) הערות, 7) סיכום ושליחה. 
   שליחה ל-Google Sheets כ-POST text/plain עם status="לטיפול". */

window.BillingWizard = (() => {
  // ===== DOM refs =====
  const $ = (id)=> document.getElementById(id);
  const stepEl   = $('step');
  const backBtn  = $('backBtn');
  const statusEl = $('statusBox');

  // ===== State & nav =====
  const State = { data:{}, stack:[] };
  const setStatus = (t='')=> { if(statusEl) statusEl.textContent = t; };
  const push = (fn)=> { State.stack.push(fn); backBtn.disabled = State.stack.length<=1; };
  const goBack = ()=> {
    if (State.stack.length>1){
      State.stack.pop();
      backBtn.disabled = State.stack.length<=1;
      const last = State.stack[State.stack.length-1];
      last && last();
    }
  };
  backBtn.onclick = goBack;

  // ===== Validators & sender (מ-chat-core אם נטען) =====
  const Val = (window.Chat && window.Chat.Val) ? window.Chat.Val : {
    nonEmpty: s => String(s??'').trim().length>0,
    phoneIL:  s => /^0\d{1,2}\d{7}$/.test(String(s??'').replace(/\D/g,'')),
    date:     s => /^\d{4}-\d{2}-\d{2}$/.test(s),
    time:     s => /^\d{2}:\d{2}$/.test(s),
  };
  const sendLead = (payload) => (window.Chat?.sendLeadToSheet
    ? window.Chat.sendLeadToSheet(payload)
    : fetch((window.APP_CONFIG||{}).SHEET_API_URL, {
        method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'},
        body: JSON.stringify(payload)
      }).then(r=>r.json())
  );

  // ===== Tiny UI helpers (HTML strings) =====
  const fieldRow = ({label,name,type='text',placeholder='',value='',required=false,id})=>{
    const _id = id || `f_${name}`;
    return `
      <div class="field">
        <label for="${_id}">${label}${required?' *':''}</label>
        <input id="${_id}" name="${name}" type="${type}" value="${value||''}" placeholder="${placeholder||''}" ${required?'required':''}/>
      </div>`;
  };
  const selectRow = ({label,name,options=[],required=false,id})=>{
    const _id = id || `f_${name}`;
    const opts = ['<option value="">— בחרו —</option>'].concat(
      options.map(o=>{
        const v = (typeof o==='string') ? o : (o.value ?? o.label);
        const t = (typeof o==='string') ? o : (o.label ?? o.value);
        return `<option value="${String(v)}">${String(t)}</option>`;
      })
    ).join('');
    return `
      <div class="field">
        <label for="${_id}">${label}${required?' *':''}</label>
        <select id="${_id}" name="${name}" ${required?'required':''}>${opts}</select>
      </div>`;
  };
  const chipsRow = ({label,name,options=[],id})=>{
    const chips = options.map(t=>`<button type="button" class="chip" data-value="${t}" aria-pressed="false">${t}</button>`).join('');
    return `
      <div class="field">
        <label>${label}</label>
        <div class="chips" id="${id||('chips_'+name)}">${chips}</div>
      </div>`;
  };
  const bindSingleChips = (containerId)=>{
    const cont = $(containerId);
    let picked = '';
    cont.addEventListener('click',(ev)=>{
      const b = ev.target.closest('.chip'); if(!b) return;
      [...cont.querySelectorAll('.chip[aria-pressed="true"]')].forEach(x=>x.setAttribute('aria-pressed','false'));
      b.setAttribute('aria-pressed', b.getAttribute('aria-pressed')==='true' ? 'false':'true');
      picked = (b.getAttribute('aria-pressed')==='true') ? (b.dataset.value||'') : '';
    });
    return ()=> picked;
  };

  // ===== Options =====
  const subjects = ['מתמטיקה','אנגלית','פיזיקה','שפה','הוראה מתקנת','אנגלית מדוברת'];
  const tracks   = ['קבוצתי','טריפל','פרטי'];
  const grades   = ['א׳','ב׳','ג׳','ד׳','ה׳','ו׳','ז׳','ח׳','ט׳','י׳','י״א','י״ב','סטודנט'];
  const topics   = [
    'עדכון אמצעי תשלום (כרטיס אשראי)',
    'חיוב כפול / זיכוי חסר',
    'העברת חיוב להורה אחר',
    'קבלת חשבונית/קבלה',
    'שינוי פרטי חשבונית',
    'בירור חיוב',
    'אחר'
  ];

  // ===== Steps =====
  function step1_identity(){
    stepEl.innerHTML = `
      <div class="title-row">
        <h3>עדכון תשלום / חשבוניות 👨‍🚀</h3>
        <div class="muted">שלב 1/7</div>
      </div>
      <div class="meta">ארשום כמה פרטים כדי שאוכל לעזור במהירות 🧑‍🚀</div>
      ${chipsRow({label:'עם מי אני מדבר?', name:'role', options:['תלמיד','הורה'], id:'chips_role'})}
      ${fieldRow({label:'שם פרטי',  name:'firstName', placeholder:'לדוגמה: חן', required:true})}
      ${fieldRow({label:'שם משפחה', name:'lastName',  placeholder:'לדוגמה: בראונשטיין', required:true})}
      <div class="wizard-actions">
        <button class="btn primary" id="next">המשך</button>
      </div>`;
    push(step1_identity);

    const getRole = bindSingleChips('chips_role');
    $('next').onclick = ()=>{
      const role = getRole();
      const firstName = $('f_firstName').value.trim();
      const lastName  = $('f_lastName').value.trim();
      if(!Val.nonEmpty(role))      return setStatus('נא לבחור עם מי מדברים');
      if(!Val.nonEmpty(firstName)) return setStatus('נא למלא שם פרטי');
      if(!Val.nonEmpty(lastName))  return setStatus('נא למלא שם משפחה');
      setStatus('');
      Object.assign(State.data, { role, firstName, lastName });
      step2_contactStudent();
    };
  }

  function step2_contactStudent(){
    const isParent = (State.data.role === 'הורה');
    stepEl.innerHTML = `
      <div class="title-row">
        <h3>פרטי קשר 👨‍🚀</h3>
        <div class="muted">שלב 2/7</div>
      </div>
      ${fieldRow({label:'טלפון', name:'phone', type:'tel', placeholder:'05XXXXXXXX', required:true})}
      ${isParent ? fieldRow({label:'שם פרטי התלמיד/ה', name:'studentName', placeholder:'לדוגמה: נועה', required:true}) : ''}
      ${isParent ? fieldRow({label:'שם משפחה התלמיד/ה', name:'studentLastName', placeholder:'לדוגמה: כהן', required:true}) : ''}
      <div class="wizard-actions">
        <button class="btn" id="prev">חזרה</button>
        <button class="btn primary" id="next">המשך</button>
      </div>`;
    push(step2_contactStudent);

    $('prev').onclick = goBack;
    $('next').onclick = ()=>{
      const phone = $('f_phone').value.replace(/[^\d]/g,'');
      if(!Val.phoneIL(phone)) return setStatus('טלפון לא תקין');
      const patch = { phone };
      if (isParent){
        const sn = $('f_studentName').value.trim();
        const sl = $('f_studentLastName').value.trim();
        if(!Val.nonEmpty(sn)) return setStatus('נא למלא שם פרטי התלמיד/ה');
        if(!Val.nonEmpty(sl)) return setStatus('נא למלא שם משפחה התלמיד/ה');
        patch.studentName = sn;
        patch.studentLastName = sl;
      }
      setStatus('');
      Object.assign(State.data, patch);
      step3_subjectTrack();
    };
  }

  function step3_subjectTrack(){
    stepEl.innerHTML = `
      <div class="title-row">
        <h3>פרטי המנוי 👨‍🚀</h3>
        <div class="muted">שלב 3/7</div>
      </div>
      ${selectRow({label:'מקצוע', name:'subject', options:subjects, required:true})}
      ${chipsRow({label:'מסלול למידה (רשות)', name:'track', options:tracks, id:'chips_track'})}
      <div class="wizard-actions">
        <button class="btn" id="prev">חזרה</button>
        <button class="btn primary" id="next">המשך</button>
      </div>`;
    push(step3_subjectTrack);

    const getTrack = bindSingleChips('chips_track');
    $('prev').onclick = goBack;
    $('next').onclick = ()=>{
      const subject = $('f_subject').value;
      const track   = getTrack();
      if(!Val.nonEmpty(subject)) return setStatus('נא לבחור מקצוע');
      setStatus('');
      Object.assign(State.data, { subject, track });
      step4_gradeUnitsTeacher();
    };
  }

  function step4_gradeUnitsTeacher(){
    stepEl.innerHTML = `
      <div class="title-row">
        <h3>כיתה / יחידות / מורה 👨‍🚀</h3>
        <div class="muted">שלב 4/7</div>
      </div>
      ${selectRow({label:'כיתה', name:'grade', options:grades, required:true})}
      <div id="unitsWrap" style="display:none">
        ${chipsRow({label:'יחידות (לכיתות י/י״א/י״ב)', name:'units', options:['3','4','5'], id:'chips_units'})}
      </div>
      ${fieldRow({label:'שם המורה במרכז הלמידה (רשות)', name:'teacher', placeholder:'לדוגמה: לירז'})}
      <div class="wizard-actions">
        <button class="btn" id="prev">חזרה</button>
        <button class="btn primary" id="next">המשך</button>
      </div>`;
    push(step4_gradeUnitsTeacher);

    const gradeSel = $('f_grade');
    const unitsWrap = $('unitsWrap');
    const getUnits = bindSingleChips('chips_units');

    const toggleUnits = ()=>{
      const g = gradeSel.value;
      unitsWrap.style.display = (['י׳','י״א','י״ב'].includes(g)) ? '' : 'none';
    };
    gradeSel.addEventListener('change', toggleUnits);
    toggleUnits();

    $('prev').onclick = goBack;
    $('next').onclick = ()=>{
      const grade = gradeSel.value;
      const needUnits = ['י׳','י״א','י״ב'].includes(grade);
      const units = needUnits ? getUnits() : '';
      const teacher = $('f_teacher').value.trim();
      if(!Val.nonEmpty(grade)) return setStatus('נא לבחור כיתה');
      if(needUnits && !Val.nonEmpty(units)) return setStatus('נא לבחור מספר יחידות');
      setStatus('');
      Object.assign(State.data, { grade, units, teacher });
      step5_topic();
    };
  }

  function step5_topic(){
    stepEl.innerHTML = `
      <div class="title-row">
        <h3>נושא הפנייה 👨‍🚀</h3>
        <div class="muted">שלב 5/7</div>
      </div>
      ${selectRow({label:'נושא', name:'topic', options:topics, required:true})}
      ${fieldRow({label:'פרטו (אם בחרתם "אחר")', name:'topicOther', placeholder:'רשות', id:'f_topicOther'})}
      <div class="wizard-actions">
        <button class="btn" id="prev">חזרה</button>
        <button class="btn primary" id="next">המשך</button>
      </div>`;
    push(step5_topic);

    const topicSel = $('f_topic');
    const otherEl  = $('f_topicOther');
    const toggleOther = ()=>{
      const isOther = (topicSel.value === 'אחר');
      otherEl.parentElement.style.display = isOther ? '' : 'none';
    };
    toggleOther();
    topicSel.addEventListener('change', toggleOther);

    $('prev').onclick = goBack;
    $('next').onclick = ()=>{
      const topic = topicSel.value;
      if(!Val.nonEmpty(topic)) return setStatus('נא לבחור נושא פנייה');
      const topicOther = (topic==='אחר') ? (otherEl.value||'').trim() : '';
      setStatus('');
      Object.assign(State.data, { topic, topicOther });
      step6_notes();
    };
  }

  function step6_notes(){
    stepEl.innerHTML = `
      <div class="title-row">
        <h3>הערות נוספות למזכירות 👨‍🚀</h3>
        <div class="muted">שלב 6/7</div>
      </div>
      <div class="field">
        <label for="f_notes">הערות (רשות)</label>
        <textarea id="f_notes" rows="3" placeholder="פרטים שיעזרו לנו לטפל מהר יותר"></textarea>
      </div>
      <div class="wizard-actions">
        <button class="btn" id="prev">חזרה</button>
        <button class="btn primary" id="next">המשך</button>
      </div>`;
    push(step6_notes);

    $('prev').onclick = goBack;
    $('next').onclick = ()=>{
      State.data.notes = ($('f_notes').value||'').trim();
      setStatus('');
      step7_summary();
    };
  }

  function step7_summary(){
    const d = State.data;
    const summaryRows = [
      ['מי מדבר', d.role],
      ['שם פרטי', d.firstName],
      ['שם משפחה', d.lastName],
      ['טלפון', d.phone],
      ...(d.role==='הורה' ? [['שם התלמיד/ה', d.studentName], ['שם משפחה התלמיד/ה', d.studentLastName]] : []),
      ['מקצוע', d.subject],
      ['מסלול', d.track||''],
      ['כיתה', d.grade],
      ...(d.units ? [['יחידות', d.units]] : []),
      ['שם מורה', d.teacher||''],
      ['נושא', d.topic],
      ...(d.topic==='אחר' && d.topicOther ? [['פירוט (אחר)', d.topicOther]] : []),
      ...(d.notes ? [['הערות', d.notes]] : [])
    ];

    stepEl.innerHTML = `
      <div class="title-row">
        <h3>סיכום ושליחה 👨‍🚀</h3>
        <div class="muted">שלב 7/7</div>
      </div>
      <div class="summary">
        ${summaryRows.map(([k,v])=>`<div><strong>${k}:</strong> ${v||'-'}</div>`).join('')}
      </div>
      <div class="wizard-actions">
        <button class="btn" id="prev">חזרה</button>
        <button class="btn primary" id="send">אישור ושליחה למזכירות 📤</button>
      </div>`;
    push(step7_summary);

    $('prev').onclick = goBack;
    $('send').onclick = submit;
  }

  async function submit(){
    // ולידציות אחרונות
    const d = State.data, errs=[];
    if(!Val.nonEmpty(d.role))       errs.push('role');
    if(!Val.nonEmpty(d.firstName))  errs.push('firstName');
    if(!Val.nonEmpty(d.lastName))   errs.push('lastName');
    if(!Val.phoneIL(d.phone))       errs.push('phone');
    if(d.role==='הורה'){
      if(!Val.nonEmpty(d.studentName))      errs.push('studentName');
      if(!Val.nonEmpty(d.studentLastName))  errs.push('studentLastName');
    }
    if(!Val.nonEmpty(d.subject))    errs.push('subject');
    if(!Val.nonEmpty(d.grade))      errs.push('grade');
    if(['י׳','י״א','י״ב'].includes(d.grade||'') && !Val.nonEmpty(d.units)) errs.push('units');
    if(!Val.nonEmpty(d.topic))      errs.push('topic');
    if(errs.length) return setStatus('חסר/לא תקין: ' + errs.join(', '));

    const payload = {
      flow: 'billing',
      createdAt: new Date().toISOString(),
      project: (window.APP_CONFIG||{}).PROJECT || 'Houston',
      status: 'לטיפול',
      source: 'יוסטון – אתר',
      // מזהה פונה
      firstName: d.firstName, lastName: d.lastName, phone: d.phone,
      role: d.role || '',
      // פרטי תלמיד אם הורה
      studentName: d.studentName || '',
      studentLastName: d.studentLastName || '',
      // פרטי מנוי
      subject: d.subject, track: d.track || '',
      grade: d.grade, units: d.units || '', teacher: d.teacher || '',
      // נושא
      topic: d.topic, topicOther: d.topic==='אחר' ? (d.topicOther||'') : '',
      // הערות
      notes: d.notes || ''
    };

    try{
      setStatus('שולח ל־Google Sheets…');
      const res = await sendLead(payload);
      if(res && res.ok){
        setStatus('נשלח בהצלחה');
        stepEl.innerHTML = `
          <div class="bubble ok">הבקשה נקלטה ✅ ניצור קשר בהקדם 👨‍🚀</div>
          <div class="wizard-actions">
            <button class="btn" onclick="location.href='index.html'">חזרה לתפריט מנוי/ה</button>
          </div>`;
        backBtn.disabled = true;
        State.stack = [stepEl.innerHTML]; // נועלים ניווט לאחור אחרי שליחה
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