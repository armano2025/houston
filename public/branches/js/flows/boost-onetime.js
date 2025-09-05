// /public/branches/js/flows/boost-onetime.js
// נתיב: שיעור חד־פעמי על בסיס מקום פנוי
// הסבר: וויזארד מסכים לפי הכללים החדשים: הזדהות → (פרטי תלמיד אם הורה) → מקצוע/כיתה/יחידות → מסלול+מורה
//       → מועד מבוקש (תאריך + טווח 13–16 / 16–19 / 19–21) → הערות → סיכום+שליחה.
//       מימוש חוקים: יחידות חובה רק בי׳/י״א/י״ב; אם י״א/י״ב 5 יח׳ — לא מאפשרים לבחור "קבוצה" (רק טריפל/פרטי).
//       לכל מסלול יש מחיר ותיאור קצר בלחיצה. שליחה ל־GAS כ־text/plain, status="לטיפול".

window.BoostOneTime = (() => {
  const el = id => document.getElementById(id);
  const stepEl   = el('step');
  const backBtn  = el('backBtn');
  const statusEl = el('statusBox');

  const setStatus = (t='') => { if(statusEl) statusEl.textContent = t; };
  const clearStatus = ()=> setStatus('');

  const State = { data:{}, stack:[] };
  const push = (fn)=> { State.stack.push(fn); backBtn.disabled = State.stack.length<=1; };
  const goBack = ()=> {
    if(State.stack.length>1){
      State.stack.pop();
      backBtn.disabled = State.stack.length<=1;
      State.stack[State.stack.length-1]();
    }
  };
  backBtn.onclick = goBack;

  // עזרי UI קצרים
  const Val = (window.Chat && window.Chat.Val) ? window.Chat.Val : {
    nonEmpty: s => String(s??'').trim().length>0,
    phoneIL: s => /^0\d{1,2}\d{7}$/.test(String(s??'').replace(/\D/g,'')),
    date: s => /^\d{4}-\d{2}-\d{2}$/.test(s)
  };

  const fieldRow = ({label, name, type='text', placeholder='', value='', required=false, id})=>{
    const _id = id || `f_${name}`;
    return `
      <div class="field">
        <label for="${_id}">${label}${required?' *':''}</label>
        <input id="${_id}" name="${name}" type="${type}" value="${value||''}" placeholder="${placeholder||''}" ${required?'required':''}/>
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
        <select id="${_id}" ${required?'required':''}>${opts}</select>
      </div>`;
  };
  const chipsRow = ({label, id, options=[]})=>{
    const chips = options.map(t=>`<button type="button" class="chip" data-value="${t}" aria-pressed="false">${t}</button>`).join('');
    return `
      <div class="field">
        <label>${label}</label>
        <div class="chips" id="${id}">${chips}</div>
      </div>`;
  };
  const bindSingleChips = (id, onPick)=>{
    const cont = el(id);
    let picked = '';
    cont.addEventListener('click',(ev)=>{
      const b = ev.target.closest('.chip'); if(!b) return;
      [...cont.querySelectorAll('.chip[aria-pressed="true"]')].forEach(x=> x.setAttribute('aria-pressed','false'));
      b.setAttribute('aria-pressed', b.getAttribute('aria-pressed')==='true'?'false':'true');
      picked = (b.getAttribute('aria-pressed')==='true') ? b.dataset.value : '';
      onPick && onPick(picked, b);
    });
    return ()=> picked;
  };

  const SUBJECTS = ['מתמטיקה','אנגלית','פיזיקה','שפה','הוראה מתקנת','אנגלית מדוברת'];
  const GRADES   = ['א׳','ב׳','ג׳','ד׳','ה׳','ו׳','ז׳','ח׳','ט׳','י׳','י״א','י״ב','סטודנט'];
  const UNITS    = ['3','4','5'];
  const RANGES   = [
    { label:'13:00–16:00', from:'13:00', to:'16:00' },
    { label:'16:00–19:00', from:'16:00', to:'19:00' },
    { label:'19:00–21:00', from:'19:00', to:'21:00' },
  ];

  const TRACKS_ALL = [
    { key:'קבוצה',  price:'80₪',  hint:'עד ~6–8 תלמידים בקבוצה' },
    { key:'טריפל',  price:'100₪', hint:'עד 3 תלמידים' },
    { key:'פרטי',   price:'160₪', hint:'שיעור 1 על 1' },
  ];
  const PRICE_BY_TRACK = { 'קבוצה':'80₪', 'טריפל':'100₪', 'פרטי':'160₪' };

  /* ================== שלבים ================== */

  // מסך 1: הזדהות
  function step1_identity(){
    stepEl.innerHTML = `
      <div class="title-row"><h3>שיעור חד־פעמי – פרטי קשר 👨‍🚀</h3><div class="muted">שלב 1/7</div></div>
      ${chipsRow({label:'עם מי אני מדבר?', id:'chips_role', options:['תלמיד','הורה']})}
      ${fieldRow({label:'שם פרטי',  name:'firstName', placeholder:'לדוגמה: חן', required:true})}
      ${fieldRow({label:'שם משפחה', name:'lastName',  placeholder:'לדוגמה: בראונשטיין', required:true})}
      ${fieldRow({label:'טלפון',     name:'phone',     placeholder:'05XXXXXXXX', type:'tel', required:true})}
      <div class="wizard-actions">
        <button class="btn primary" id="next">המשך</button>
      </div>`;
    push(step1_identity);

    const getRole = bindSingleChips('chips_role');
    el('next').onclick = ()=>{
      const role = getRole();
      const firstName = el('f_firstName').value.trim();
      const lastName  = el('f_lastName').value.trim();
      const phone     = el('f_phone').value.replace(/[^\d]/g,'');
      if(!Val.nonEmpty(role))      return setStatus('בחר/י: תלמיד או הורה');
      if(!Val.nonEmpty(firstName)) return setStatus('נא למלא שם פרטי');
      if(!Val.nonEmpty(lastName))  return setStatus('נא למלא שם משפחה');
      if(!Val.phoneIL(phone))      return setStatus('מספר טלפון לא תקין');
      clearStatus();
      Object.assign(State.data, { role, firstName, lastName, phone });
      (role === 'הורה') ? step2_studentOfParent() : step3_subjectGradeUnits();
    };
  }

  // מסך 2 (רק הורה): פרטי התלמיד
  function step2_studentOfParent(){
    stepEl.innerHTML = `
      <div class="title-row"><h3>פרטי תלמיד 👨‍🚀</h3><div class="muted">שלב 2/7</div></div>
      ${fieldRow({label:'שם פרטי התלמיד/ה',  name:'studentName',      placeholder:'לדוגמה: נועה', required:true})}
      ${fieldRow({label:'שם משפחה התלמיד/ה', name:'studentLastName',  placeholder:'לדוגמה: כהן', required:true})}
      <div class="wizard-actions">
        <button class="btn" id="prev">חזרה</button>
        <button class="btn primary" id="next">המשך</button>
      </div>`;
    push(step2_studentOfParent);

    el('prev').onclick = goBack;
    el('next').onclick = ()=>{
      const studentName = el('f_studentName').value.trim();
      const studentLastName = el('f_studentLastName').value.trim();
      if(!Val.nonEmpty(studentName))     return setStatus('נא למלא שם תלמיד/ה');
      if(!Val.nonEmpty(studentLastName)) return setStatus('נא למלא שם משפחה של התלמיד/ה');
      clearStatus();
      Object.assign(State.data, { studentName, studentLastName });
      step3_subjectGradeUnits();
    };
  }

  // מסך 3: מקצוע + כיתה + יחידות (אם נדרש)
  function step3_subjectGradeUnits(){
    stepEl.innerHTML = `
      <div class="title-row"><h3>מקצוע וכיתה 👨‍🚀</h3><div class="muted">שלב ${State.data.role==='הורה'?3:2}/7</div></div>
      ${selectRow({label:'מקצוע', name:'subject', options:SUBJECTS, required:true})}
      ${selectRow({label:'כיתה',  name:'grade',   options:GRADES,   required:true})}
      <div id="unitsWrap" style="display:none">
        ${selectRow({label:'יחידות לימוד', name:'units', options:UNITS, required:true, id:'f_units'})}
      </div>
      <div class="wizard-actions">
        <button class="btn" id="prev">חזרה</button>
        <button class="btn primary" id="next">המשך</button>
      </div>`;
    push(step3_subjectGradeUnits);

    const gradeSel = el('f_grade');
    const unitsWrap= el('unitsWrap');
    const showUnits = ()=>{
      const g = gradeSel.value;
      unitsWrap.style.display = (['י׳','י״א','י״ב'].includes(g)) ? '' : 'none';
    };
    gradeSel.addEventListener('change', showUnits);
    showUnits();

    el('prev').onclick = goBack;
    el('next').onclick = ()=>{
      const subject = el('f_subject').value;
      const grade   = gradeSel.value;
      const needUnits = ['י׳','י״א','י״ב'].includes(grade);
      const units  = needUnits ? (el('f_units')?.value || '') : '';
      if(!Val.nonEmpty(subject)) return setStatus('נא לבחור מקצוע');
      if(!Val.nonEmpty(grade))   return setStatus('נא לבחור כיתה');
      if(needUnits && !Val.nonEmpty(units)) return setStatus('נא לבחור יחידות');
      clearStatus();
      Object.assign(State.data, { subject, grade, units });
      step4_trackTeacher();
    };
  }

  // מסך 4: מסלול + מורה (אין העדפה/מלל חופשי) + חסימת "קבוצה" בי״א/י״ב 5 יח'
  function step4_trackTeacher(){
    const isGroupBlocked = (State.data.grade==='י״א' || State.data.grade==='י״ב') && State.data.units==='5';
    const tracks = isGroupBlocked ? TRACKS_ALL.filter(t => t.key!=='קבוצה') : TRACKS_ALL;

    const chipsHtml = tracks.map(t => {
      const label = `שיעור במסלול ${t.key} – ${t.price}`;
      return `<button type="button" class="chip" data-value="${t.key}" data-hint="${t.hint}" aria-pressed="false">${label}</button>`;
    }).join('');

    const blockedNote = isGroupBlocked
      ? `<div class="hint">לתלמידי י״א/י״ב 5 יח׳ אין קבוצות – ניתן לבחור טריפל או פרטי.</div>`
      : '';

    stepEl.innerHTML = `
      <div class="title-row"><h3>מסלול ומורה 👨‍🚀</h3><div class="muted">שלב ${State.data.role==='הורה'?4:3}/7</div></div>
      <div class="field">
        <label>מסלול למידה (חובה)</label>
        <div class="chips" id="chips_track">${chipsHtml}</div>
        ${blockedNote}
        <div id="trackHint" class="hint"></div>
      </div>

      <div class="field">
        <label for="f_teacherPref">מורה מבוקש</label>
        <div class="row">
          <button type="button" class="chip" id="chip_no_pref">אין לי העדפה</button>
        </div>
        <input id="f_teacherPref" type="text" placeholder="לדוגמה: לירז (רשות)"/>
      </div>

      <div class="wizard-actions">
        <button class="btn" id="prev">חזרה</button>
        <button class="btn primary" id="next">המשך</button>
      </div>`;
    push(step4_trackTeacher);

    // בחירת מסלול + הצגת הסבר קצר בלחיצה
    const cont = el('chips_track');
    let picked = '';
    cont.addEventListener('click', (ev)=>{
      const b = ev.target.closest('.chip'); if(!b) return;
      [...cont.querySelectorAll('.chip[aria-pressed="true"]')].forEach(x=> x.setAttribute('aria-pressed','false'));
      b.setAttribute('aria-pressed', b.getAttribute('aria-pressed')==='true' ? 'false' : 'true');
      picked = b.getAttribute('aria-pressed')==='true' ? b.dataset.value : '';
      el('trackHint').textContent = picked ? `מידע: ${b.dataset.hint}` : '';
    });

    // "אין לי העדפה" – מנקה קלט
    el('chip_no_pref').onclick = ()=>{
      el('f_teacherPref').value = 'אין העדפה';
      el('f_teacherPref').focus();
    };

    el('prev').onclick = goBack;
    el('next').onclick = ()=>{
      const teacher = (el('f_teacherPref').value||'').trim();
      if(!Val.nonEmpty(picked)) return setStatus('נא לבחור מסלול למידה');
      clearStatus();
      Object.assign(State.data, { track: picked, teacher: teacher });
      step5_when();
    };
  }

  // מסך 5: מועד מבוקש – תאריך + טווח שעות
  function step5_when(){
    const optHtml = ['<option value="">— בחרו טווח —</option>']
      .concat(RANGES.map((r,i)=>`<option value="${i}">${r.label}</option>`)).join('');

    stepEl.innerHTML = `
      <div class="title-row"><h3>מועד מבוקש 👨‍🚀</h3><div class="muted">שלב ${State.data.role==='הורה'?5:4}/7</div></div>
      ${fieldRow({label:'תאריך מבוקש', name:'date', type:'date', required:true})}
      <div class="field">
        <label for="f_range">טווח שעות</label>
        <select id="f_range">${optHtml}</select>
      </div>
      <div class="wizard-actions">
        <button class="btn" id="prev">חזרה</button>
        <button class="btn primary" id="next">המשך</button>
      </div>`;
    push(step5_when);

    el('prev').onclick = goBack;
    el('next').onclick = ()=>{
      const date = el('f_date').value;
      const idx  = el('f_range').value;
      if(!Val.date(date)) return setStatus('נא לבחור תאריך תקין');
      if(String(idx)==='') return setStatus('נא לבחור טווח שעות');
      const r = RANGES[Number(idx)];
      clearStatus();
      Object.assign(State.data, { date, timeRange: { from:r.from, to:r.to }, timeRangeLabel: r.label });
      step6_notes();
    };
  }

  // מסך 6: הערות
  function step6_notes(){
    stepEl.innerHTML = `
      <div class="title-row"><h3>הערות למזכירות (רשות) 👨‍🚀</h3><div class="muted">שלב ${State.data.role==='הורה'?6:5}/7</div></div>
      <div class="field">
        <label for="f_notes">הערות</label>
        <textarea id="f_notes" rows="3" placeholder="כל דבר שיעזור לנו לשבץ אותך במהירות"></textarea>
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

  // מסך 7: סיכום ושליחה
  function step7_summary(){
    const d = State.data;
    const rows = [
      ['מי ממלא', d.role],
      ['שם', `${d.firstName||''} ${d.lastName||''}`.trim()],
      ['טלפון', d.phone],
      ...(d.role==='הורה' ? [['שם התלמיד/ה', `${d.studentName||''} ${d.studentLastName||''}`.trim()]] : []),
      ['מקצוע', d.subject],
      ['כיתה', d.grade],
      ...(d.units ? [['יחידות', d.units]] : []),
      ['מסלול', d.track ? `${d.track} (${PRICE_BY_TRACK[d.track]||''})` : ''],
      ['מורה מבוקש', d.teacher||''],
      ['מועד', `${d.date||''} • ${d.timeRangeLabel||''}`],
      ...(d.notes ? [['הערות', d.notes]]:[])
    ];

    stepEl.innerHTML = `
      <div class="title-row"><h3>סיכום ושליחה 👨‍🚀</h3><div class="muted">שלב ${State.data.role==='הורה'?7:6}/7</div></div>
      <div class="summary">
        ${rows.map(([k,v])=>`<div><strong>${k}:</strong> ${v||'-'}</div>`).join('')}
      </div>
      <div class="wizard-actions">
        <button class="btn" id="prev">חזרה</button>
        <button class="btn primary" id="send">אישור ושליחה למזכירות 📤</button>
      </div>`;
    push(step7_summary);

    el('prev').onclick = goBack;
    el('send').onclick = submit;
  }

  async function submit(){
    const d = State.data;
    const errs = [];
    if(!Val.nonEmpty(d.role)) errs.push('role');
    if(!Val.nonEmpty(d.firstName)) errs.push('firstName');
    if(!Val.nonEmpty(d.lastName))  errs.push('lastName');
    if(!Val.phoneIL(d.phone))      errs.push('phone');
    if(d.role==='הורה'){
      if(!Val.nonEmpty(d.studentName)) errs.push('studentName');
      if(!Val.nonEmpty(d.studentLastName)) errs.push('studentLastName');
    }
    if(!Val.nonEmpty(d.subject)) errs.push('subject');
    if(!Val.nonEmpty(d.grade))   errs.push('grade');
    if(['י׳','י״א','י״ב'].includes(d.grade) && !Val.nonEmpty(d.units)) errs.push('units');
    if(!Val.nonEmpty(d.track))   errs.push('track');
    if(!Val.date(d.date))        errs.push('date');
    if(!d.timeRange || !d.timeRange.from) errs.push('timeRange');

    if(errs.length){ setStatus('חסר/לא תקין: ' + errs.join(', ')); return; }

    const payload = {
      flow: 'boost',                 // נשאר "boost" כדי להתאים ל־GAS/Headers
      createdAt: new Date().toISOString(),
      project: (window.APP_CONFIG||{}).PROJECT || 'Houston',
      status: 'לטיפול',
      source: 'יוסטון – אתר',
      // מזהה ממלא
      role: d.role,
      firstName: d.firstName, lastName: d.lastName, phone: String(d.phone).replace(/[^\d]/g,''),
      // תלמיד
      studentName: d.studentName||'', studentLastName: d.studentLastName||'',
      // פרטים אקדמיים
      subject: d.subject, grade: d.grade, units: d.units||'',
      // מסלול + מורה
      track: d.track, rate: PRICE_BY_TRACK[d.track] || '',
      teacher: d.teacher||'',
      // מועד
      date: d.date,
      timeRange: { ...d.timeRange },       // GAS ינרמל ל-"from-to"
      // הערות
      notes: d.notes||''
    };

    try{
      setStatus('שולח ל־Google Sheets…');
      const send = window.Chat?.sendLeadToSheet;
      const res = await (send ? send(payload) : fetch((window.APP_CONFIG||{}).SHEET_API_URL, {
        method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body: JSON.stringify(payload)
      }).then(r=>r.json()));
      if(res && res.ok){
        setStatus('נשלח בהצלחה');
        stepEl.innerHTML = `
          <div class="bubble ok">הבקשה נקלטה ✅ נתאם את השיעור על בסיס מקום פנוי 👨‍🚀</div>
          <div class="wizard-actions">
            <button class="btn" onclick="location.href='../../index.html'">חזרה לתפריט ראשי</button>
          </div>`;
        backBtn.disabled = true;
        State.stack = [stepEl.innerHTML];
      } else {
        throw new Error((res && res.error) || 'server_error');
      }
    } catch(err){
      setStatus('שגיאה: ' + err.message);
    }
  }

  function start(){
    State.data = {};
    State.stack = [];
    backBtn.disabled = true;
    clearStatus();
    step1_identity();
  }

  return { start };
})();