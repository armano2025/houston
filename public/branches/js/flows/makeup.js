/* /public/branches/js/flows/makeup.js
   וויזארד "שיעור השלמה (Makeup)" – ללא צ'אט:
   שלבים (עד 3 שדות במסך):
   1) פרטי קשר — שם פרטי, שם משפחה, טלפון
   2) פרטי שיעור — שם תלמיד/ה, מקצוע, מסלול
   3) כיתה/יחידות/שם מורה — כיתה (+יחידות אם צריך), שם מורה
   4) שיעור שהוחמץ — תאריך, שעה עגולה, סיבת ההחמצה
   5) מועדים להשלמה — תאריך + טווח שעות מתוך: 13–16 / 16–19 / 19–21 (אפשר להוסיף כמה או לדלג)
   6) הערות (רשות)
   7) סיכום ושליחה.  השדה status תמיד "לטיפול".  שליחה ב-text/plain ל-GAS (ללא preflight). */

window.MakeupWizard = (() => {
  const el = (id) => document.getElementById(id);
  const stepEl = el('step');
  const backBtn = el('backBtn');
  const statusEl = el('statusBox');

  const HOURS = Array.from({length:15}, (_,i)=>String(i+8).padStart(2,'0')+':00'); // 08:00..22:00
  const RANGES = [
    { label: '13:00–16:00', from: '13:00', to: '16:00' },
    { label: '16:00–19:00', from: '16:00', to: '19:00' },
    { label: '19:00–21:00', from: '19:00', to: '21:00' },
  ];

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

  // קיצור לולידציה ושילוח מתוך chat-core
  const Val = (window.Chat && window.Chat.Val) ? window.Chat.Val : {
    nonEmpty: s => String(s??'').trim().length>0,
    phoneIL: s => /^0\d{1,2}\d{7}$/.test(String(s??'').replace(/\D/g,'')),
    date: s => /^\d{4}-\d{2}-\d{2}$/.test(s),
    time: s => /^\d{2}:\d{2}$/.test(s),
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
  function step1_contact(){
    stepEl.innerHTML = `
      <div class="title-row"><h3>פרטי קשר</h3></div>
      ${fieldRow({label:'שם פרטי',  name:'firstName', placeholder:'לדוגמה: חן', required:true})}
      ${fieldRow({label:'שם משפחה', name:'lastName',  placeholder:'לדוגמה: בראונשטיין', required:true})}
      ${fieldRow({label:'טלפון',     name:'phone',     placeholder:'05XXXXXXXX', type:'tel', required:true})}
      <div class="wizard-actions">
        <button class="btn primary" id="next">המשך</button>
      </div>`;
    push(step1_contact);

    el('next').onclick = ()=>{
      const firstName = el('f_firstName').value.trim();
      const lastName  = el('f_lastName').value.trim();
      const phone     = el('f_phone').value.replace(/[^\d]/g,'');
      if(!Val.nonEmpty(firstName)) return setStatus('נא למלא שם פרטי');
      if(!Val.nonEmpty(lastName))  return setStatus('נא למלא שם משפחה');
      if(!Val.phoneIL(phone))      return setStatus('טלפון לא תקין');
      setStatus('');
      Object.assign(State.data, { firstName, lastName, phone });
      step2_lessonBasics();
    };
  }

  function step2_lessonBasics(){
    const subjects = ['מתמטיקה','אנגלית','פיזיקה','שפה','הוראה מתקנת','אנגלית מדוברת'];
    stepEl.innerHTML = `
      <div class="title-row"><h3>פרטי שיעור</h3><div class="muted">שלב 2/7</div></div>
      ${fieldRow({label:'שם התלמיד/ה', name:'studentName', placeholder:'לדוגמה: נועה כהן', required:true})}
      ${selectRow({label:'מקצוע', name:'subject', options:subjects, required:true})}
      ${chipsRow({label:'מסלול למידה', name:'track', options:['קבוצתי','טריפל','פרטי']})}
      <div class="wizard-actions">
        <button class="btn" id="prev">חזרה</button>
        <button class="btn primary" id="next">המשך</button>
      </div>`;
    push(step2_lessonBasics);

    const getTrack = bindSingleChips('chips_track');
    el('prev').onclick = goBack;
    el('next').onclick = ()=>{
      const studentName = el('f_studentName').value.trim();
      const subject     = el('f_subject').value;
      const track       = getTrack();
      if(!Val.nonEmpty(studentName)) return setStatus('נא למלא שם תלמיד/ה');
      if(!Val.nonEmpty(subject))     return setStatus('נא לבחור מקצוע');
      setStatus('');
      Object.assign(State.data, { studentName, subject, track });
      step3_gradeUnitsTeacher();
    };
  }

  function step3_gradeUnitsTeacher(){
    const grades = ['א׳','ב׳','ג׳','ד׳','ה׳','ו׳','ז׳','ח׳','ט׳','י׳','י״א','י״ב','סטודנט'];
    stepEl.innerHTML = `
      <div class="title-row"><h3>כיתה / יחידות / מורה</h3><div class="muted">שלב 3/7</div></div>
      ${selectRow({label:'כיתה', name:'grade', options:grades, required:true})}
      <div id="unitsWrap" style="display:none">
        ${chipsRow({label:'יחידות (לכיתות י/י״א/י״ב)', name:'units', options:['3','4','5']})}
      </div>
      ${fieldRow({label:'שם המורה במרכז הלמידה', name:'teacher', placeholder:'לדוגמה: לירז', required:true})}
      <div class="wizard-actions">
        <button class="btn" id="prev">חזרה</button>
        <button class="btn primary" id="next">המשך</button>
      </div>`;
    push(step3_gradeUnitsTeacher);

    const gradeSel = el('f_grade');
    const unitsWrap = el('unitsWrap');
    const showUnits = ()=> {
      const g = gradeSel.value;
      unitsWrap.style.display = (['י׳','י״א','י״ב'].includes(g)) ? '' : 'none';
    };
    gradeSel.addEventListener('change', showUnits);
    showUnits();

    const getUnits = bindSingleChips('chips_units');

    el('prev').onclick = goBack;
    el('next').onclick = ()=>{
      const grade   = gradeSel.value;
      const teacher = el('f_teacher').value.trim();
      const needUnits = ['י׳','י״א','י״ב'].includes(grade);
      const units  = needUnits ? getUnits() : '';
      if(!Val.nonEmpty(grade))   return setStatus('נא לבחור כיתה');
      if(needUnits && !Val.nonEmpty(units)) return setStatus('נא לבחור מספר יחידות');
      if(!Val.nonEmpty(teacher)) return setStatus('נא למלא שם מורה');
      setStatus('');
      Object.assign(State.data, { grade, units, teacher });
      step4_missedLesson();
    };
  }

  function step4_missedLesson(){
    stepEl.innerHTML = `
      <div class="title-row"><h3>השיעור שהוחמץ</h3><div class="muted">שלב 4/7</div></div>
      ${fieldRow({label:'תאריך השיעור שהוחמץ', name:'missedDate', type:'date', required:true})}
      ${selectRow({label:'שעה (עגולה)', name:'missedTime', options:HOURS, required:true})}
      ${selectRow({label:'סיבת ההחמצה', name:'reason', options:['אנחנו ביטלנו','אתם ביטלתם'], required:true})}
      <div class="wizard-actions">
        <button class="btn" id="prev">חזרה</button>
        <button class="btn primary" id="next">המשך</button>
      </div>`;
    push(step4_missedLesson);

    el('prev').onclick = goBack;
    el('next').onclick = ()=>{
      const missedDate = el('f_missedDate').value;
      const missedTime = el('f_missedTime').value;
      const reason     = el('f_reason').value;
      if(!Val.date(missedDate))          return setStatus('נא לבחור תאריך תקין');
      if(!HOURS.includes(missedTime))    return setStatus('נא לבחור שעה עגולה');
      if(!Val.nonEmpty(reason))          return setStatus('נא לבחור סיבה');
      setStatus('');
      Object.assign(State.data, { missedDate, missedTime, reason });
      step5_desiredSlots();
    };
  }

  function step5_desiredSlots(){
    const optHtml = ['<option value="">— בחרו טווח —</option>']
      .concat(RANGES.map((r,i)=>`<option value="${i}">${r.label}</option>`)).join('');
    const chosen = State.data.slots || [];

    stepEl.innerHTML = `
      <div class="title-row"><h3>מועדים נוחים להשלמה</h3><div class="muted">שלב 5/7</div></div>
      ${fieldRow({label:'תאריך', name:'slotDate', type:'date', required:false})}
      <div class="field">
        <label for="f_slotRange">טווח שעות</label>
        <select id="f_slotRange" name="slotRange">
          ${optHtml}
        </select>
      </div>

      <div class="wizard-actions">
        <button class="btn" id="add">+ הוסף מועד</button>
        <button class="btn ghost" id="skip">דלג (אין העדפה)</button>
      </div>

      <div class="field">
        <label>מועדים שנבחרו</label>
        <div id="list" class="slot-list"></div>
        <div class="meta">לחיצה על מועד מוחקת אותו מהרשימה</div>
      </div>

      <div class="wizard-actions">
        <button class="btn" id="prev">חזרה</button>
        <button class="btn primary" id="next">המשך</button>
      </div>`;
    push(step5_desiredSlots);

    const listEl = el('list');
    const redraw = ()=>{
      listEl.innerHTML = '';
      chosen.forEach((s,idx)=>{
        const b = document.createElement('button');
        b.type='button'; b.className='chip del';
        b.textContent = `${s.date} • ${s.from}-${s.to}`;
        b.title='הסר'; b.onclick = ()=>{ chosen.splice(idx,1); redraw(); };
        listEl.appendChild(b);
      });
    };
    redraw();

    el('add').onclick = ()=>{
      const date = el('f_slotDate').value;
      const idx  = el('f_slotRange').value;
      if(!Val.date(date)) return setStatus('נא לבחור תאריך');
      if(String(idx)==='') return setStatus('נא לבחור טווח שעות');
      const r = RANGES[Number(idx)];
      chosen.push({ date, from:r.from, to:r.to });
      setStatus('');
      el('f_slotDate').value=''; el('f_slotRange').value='';
      redraw();
    };
    el('skip').onclick = ()=>{
      State.data.desiredPreference = 'אין העדפה';
      State.data.slots = [];
      setStatus('');
      step6_notes();
    };

    el('prev').onclick = goBack;
    el('next').onclick = ()=>{
      if(!chosen.length){
        return setStatus('הוסיפו לפחות מועד אחד או בחרו דילוג');
      }
      State.data.desiredPreference = 'יש העדפות';
      State.data.slots = chosen.slice();
      setStatus('');
      step6_notes();
    };
  }

  function step6_notes(){
    stepEl.innerHTML = `
      <div class="title-row"><h3>הערות למזכירות (רשות)</h3><div class="muted">שלב 6/7</div></div>
      <div class="field">
        <label for="f_notes">הערות</label>
        <textarea id="f_notes" rows="3" placeholder="העדפות, אילוצים, פרטים שיעזרו לנו"></textarea>
      </div>
      <div class="wizard-actions">
        <button class="btn" id="prev">חזרה</button>
        <button class="btn primary" id="next">המשך</button>
      </div>`;
    push(step6_notes);

    el('prev').onclick = goBack;
    el('next').onclick = ()=>{
      State.data.notes = (el('f_notes').value||'').trim();
      step7_summary();
    };
  }

  function step7_summary(){
    const d = State.data;
    const rows = [
      ['שם פרטי', d.firstName], ['שם משפחה', d.lastName], ['טלפון', d.phone],
      ['שם התלמיד/ה', d.studentName], ['מקצוע', d.subject], ['מסלול', d.track||''],
      ['כיתה', d.grade], ...(d.units ? [['יחידות', d.units]]:[]),
      ['שם המורה', d.teacher],
      ['שיעור שהוחמץ', `${d.missedDate} • ${d.missedTime}`],
      ['סיבת ההחמצה', d.reason],
      ['מועדים להשלמה', (d.slots&&d.slots.length) ? d.slots.map(s=>`${s.date} ${s.from}-${s.to}`).join(' | ') : (d.desiredPreference||'אין העדפה')],
      ...(d.notes ? [['הערות', d.notes]]:[])
    ];
    stepEl.innerHTML = `
      <div class="title-row"><h3>סיכום ושליחה</h3><div class="muted">שלב 7/7</div></div>
      <div class="summary">${rows.map(([k,v])=>`<div><strong>${k}:</strong> ${v||'-'}</div>`).join('')}</div>
      <div class="wizard-actions">
        <button class="btn" id="prev">חזרה</button>
        <button class="btn primary" id="send">אישור ושליחה למזכירות 📤</button>
      </div>`;
    push(step7_summary);

    el('prev').onclick = goBack;
    el('send').onclick = submit;
  }

  async function submit(){
    // ולידציות אחרונות (הגיוניות)
    const d = State.data, errs=[];
    if(!Val.nonEmpty(d.firstName)) errs.push('firstName');
    if(!Val.nonEmpty(d.lastName))  errs.push('lastName');
    if(!Val.phoneIL(d.phone))      errs.push('phone');
    if(!Val.nonEmpty(d.studentName)) errs.push('studentName');
    if(!Val.nonEmpty(d.subject))     errs.push('subject');
    if(!Val.nonEmpty(d.grade))       errs.push('grade');
    if(['י׳','י״א','י״ב'].includes(d.grade||'') && !Val.nonEmpty(d.units)) errs.push('units');
    if(!Val.nonEmpty(d.teacher))     errs.push('teacher');
    if(!Val.date(d.missedDate))      errs.push('missedDate');
    if(!HOURS.includes(d.missedTime||'')) errs.push('missedTime');
    if(!Val.nonEmpty(d.reason))      errs.push('reason');
    if(errs.length) return setStatus('חסר/לא תקין: ' + errs.join(', '));

    const payload = {
      flow: 'makeup',
      createdAt: new Date().toISOString(),
      project: (window.APP_CONFIG||{}).PROJECT || 'Houston',
      status: 'לטיפול',
      // מזהה
      firstName: d.firstName, lastName: d.lastName, phone: d.phone,
      // פרטי שיעור
      studentName: d.studentName, subject: d.subject, track: d.track||'',
      grade: d.grade, units: d.units||'', teacher: d.teacher||'',
      // ההחמצה
      missedDate: d.missedDate, missedTime: d.missedTime, reason: d.reason,
      // זמינות
      desiredPreference: d.desiredPreference || (d.slots?.length ? 'יש העדפות' : 'אין העדפה'),
      slots: (d.slots||[]).map(s=>({date:s.date, from:s.from, to:s.to})),
      // הערות
      notes: d.notes||''
    };

    try{
      setStatus('שולח ל־Google Sheets…');
      const res = await send(payload);
      if(res && res.ok){
        setStatus('נשלח בהצלחה');
        stepEl.innerHTML = `
          <div class="bubble ok">הבקשה נקלטה ✅ ניצור קשר לתיאום מועד מתאים 👨‍🚀</div>
          <div class="wizard-actions">
            <button class="btn" onclick="location.href='index.html'">חזרה לתפריט מנוי/ה</button>
          </div>`;
        backBtn.disabled = true;
        State.stack = [stepEl.innerHTML]; // לנעילה
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
    step1_contact();
  }

  return { start };
})();