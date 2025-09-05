/***************************************
# /public/branches/js/flows/boost-onetime.js
# וויזארד "שיעור חד־פעמי" (לא מנויים) – flow='onetime'
# שלבים:
# 1) הזדהות (תלמיד/הורה + שמות + טלפון[type=tel])
# 2) אם הורה – פרטי תלמיד; אם תלמיד – דילוג
# 3) מקצוע / כיתה / יחידות (אם י-יב)
# 4) מסלול/תעריף + מורה מועדף (חובה: טקסט או "אין לי העדפה"), חסימת "קבוצה" לי״א/י״ב 5 יח׳
# 5) תאריך + טווח שעות (select)
# 6) הערות למזכירות (רשות)
# 7) סיכום ושליחה (text/plain → GAS). הגנות לשגיאת HTML ב־SHEET_API_URL.
***************************************/

window.OneTimeWizard = (() => {
  const $ = (id) => document.getElementById(id);
  const stepEl = $('step');
  const backBtn = $('backBtn');
  const statusEl = $('statusBox');

  const RANGES = [
    { label:'13:00–16:00', from:'13:00', to:'16:00' },
    { label:'16:00–19:00', from:'16:00', to:'19:00' },
    { label:'19:00–21:00', from:'19:00', to:'21:00' }
  ];
  const subjects = ['מתמטיקה','אנגלית','פיזיקה','שפה','הוראה מתקנת','אנגלית מדוברת'];
  const grades   = ['א׳','ב׳','ג׳','ד׳','ה׳','ו׳','ז׳','ח׳','ט׳','י׳','י״א','י״ב','סטודנט'];

  const State = { data:{}, stack:[] };
  const setStatus = (t='') => { statusEl && (statusEl.textContent = t); };
  const push = (fn) => { State.stack.push(fn); backBtn.disabled = State.stack.length<=1; };
  const goBack = () => { if(State.stack.length>1){ State.stack.pop(); backBtn.disabled = State.stack.length<=1; State.stack.at(-1)(); } };
  backBtn.onclick = goBack;

  // עזרי ולידציה/שליחה
  const Val = (window.Chat && window.Chat.Val) ? window.Chat.Val : {
    nonEmpty: s => String(s??'').trim().length>0,
    phoneIL: s => /^0\d{1,2}\d{7}$/.test(String(s??'').replace(/[^\d]/g,'')),
    date: s => /^\d{4}-\d{2}-\d{2}$/.test(s)
  };
  async function send(payload){
    const url = (window.APP_CONFIG||{}).SHEET_API_URL || '';
    if(!url){ throw new Error('SHEET_API_URL חסר'); }
    const res = await fetch(url, {
      method:'POST',
      headers:{'Content-Type':'text/plain;charset=utf-8'},
      body: JSON.stringify(payload)
    });
    const ct = res.headers.get('content-type')||'';
    if(!ct.includes('application/json')){
      const txt = await res.text().catch(()=> '');
      throw new Error('הכתובת אינה Web App תקין (קיבלנו HTML). עדכנו את SHEET_API_URL ל־Deploy האחרון.');
    }
    const data = await res.json();
    if(!res.ok || !data.ok){ throw new Error(data.error||('server_error '+res.status)); }
    return data;
  }

  // builders
  const field = ({label, id, type='text', placeholder='', required=false}) => `
    <div class="field">
      <label for="${id}">${label}${required?' *':''}</label>
      <input id="${id}" type="${type}" placeholder="${placeholder}" ${required?'required':''}/>
    </div>`;
  const select = ({label, id, options=[], required=false}) => `
    <div class="field">
      <label for="${id}">${label}${required?' *':''}</label>
      <select id="${id}" ${required?'required':''}>
        <option value="">— בחרו —</option>
        ${options.map(o=>`<option value="${o}">${o}</option>`).join('')}
      </select>
    </div>`;
  const chips = ({label, id, opts=[]}) => `
    <div class="field">
      <label>${label}</label>
      <div class="chips" id="${id}">
        ${opts.map(v=>`<button type="button" class="chip" data-value="${v}">${v}</button>`).join('')}
      </div>
    </div>`;
  const bindSingleChip = (id) => {
    const c = $(id); let val='';
    c.onclick = (ev)=>{
      const b = ev.target.closest('.chip'); if(!b) return;
      [...c.querySelectorAll('.chip[aria-pressed="true"]')].forEach(x=>x.setAttribute('aria-pressed','false'));
      b.setAttribute('aria-pressed','true'); val = b.dataset.value || b.textContent.trim();
    };
    return ()=> val;
  };

  /* ===== שלבים ===== */

  // 1) הזדהות
  function step1_contact(){
    stepEl.innerHTML = `
      <div class="title-row"><h3>שיעור חד־פעמי 👨‍🚀</h3></div>
      <div class="meta">כדי שאוכל לדייק את הבקשה, נזין כמה פרטים קצרים ונשלח למזכירות 🧑‍🚀</div>
      ${chips({label:'עם מי אני מדבר?', id:'chips_role', opts:['תלמיד','הורה']})}
      ${field({label:'שם פרטי', id:'firstName', placeholder:'לדוגמה: חן', required:true})}
      ${field({label:'שם משפחה', id:'lastName', placeholder:'לדוגמה: בראונשטיין', required:true})}
      ${field({label:'טלפון', id:'phone', type:'tel', placeholder:'05XXXXXXXX', required:true})}
      <div class="wizard-actions"><button class="btn primary" id="next">המשך</button></div>`;
    push(step1_contact);

    const getRole = bindSingleChip('chips_role');
    $('next').onclick = ()=>{
      const role = getRole();
      const firstName = $('firstName').value.trim();
      const lastName  = $('lastName').value.trim();
      const phone     = $('phone').value.replace(/[^\d]/g,'');
      if(!Val.nonEmpty(role))      return setStatus('נא לבחור מי ממלא (תלמיד/הורה)');
      if(!Val.nonEmpty(firstName)) return setStatus('נא למלא שם פרטי');
      if(!Val.nonEmpty(lastName))  return setStatus('נא למלא שם משפחה');
      if(!Val.phoneIL(phone))      return setStatus('טלפון לא תקין');
      Object.assign(State.data, { role, firstName, lastName, phone });
      setStatus('');
      step2_studentIfParent();
    };
  }

  // 2) אם הורה – פרטי תלמיד
  function step2_studentIfParent(){
    if(State.data.role !== 'הורה'){ step3_studyBasics(); return; }
    stepEl.innerHTML = `
      <div class="title-row"><h3>פרטי התלמיד/ה 👨‍🚀</h3><div class="muted">שלב 2/7</div></div>
      ${field({label:'שם פרטי התלמיד/ה', id:'studentName', placeholder:'לדוגמה: נועה', required:true})}
      ${field({label:'שם משפחה התלמיד/ה', id:'studentLastName', placeholder:'לדוגמה: כהן', required:true})}
      <div class="wizard-actions">
        <button class="btn" id="prev">חזרה</button>
        <button class="btn primary" id="next">המשך</button>
      </div>`;
    push(step2_studentIfParent);
    $('prev').onclick = backBtn.onclick;
    $('next').onclick = ()=>{
      const studentName = $('studentName').value.trim();
      const studentLastName = $('studentLastName').value.trim();
      if(!Val.nonEmpty(studentName)) return setStatus('נא למלא שם תלמיד/ה');
      if(!Val.nonEmpty(studentLastName)) return setStatus('נא למלא שם משפחה של התלמיד/ה');
      Object.assign(State.data, { studentName, studentLastName });
      setStatus('');
      step3_studyBasics();
    };
  }

  // 3) מקצוע / כיתה / יחידות
  function step3_studyBasics(){
    stepEl.innerHTML = `
      <div class="title-row"><h3>פרטי לימוד 👨‍🚀</h3><div class="muted">שלב 3/7</div></div>
      ${select({label:'מקצוע', id:'subject', options:subjects, required:true})}
      ${select({label:'כיתה', id:'grade', options:grades, required:true})}
      <div id="unitsWrap" style="display:none">
        ${chips({label:'יחידות (לכיתות י/י״א/י״ב)', id:'chips_units', opts:['3','4','5']})}
      </div>
      <div class="wizard-actions">
        <button class="btn" id="prev">חזרה</button>
        <button class="btn primary" id="next">המשך</button>
      </div>`;
    push(step3_studyBasics);

    const gradeSel = $('grade');
    const unitsWrap = $('unitsWrap');
    const showUnits = ()=> { unitsWrap.style.display = (['י׳','י״א','י״ב'].includes(gradeSel.value)) ? '' : 'none'; };
    gradeSel.addEventListener('change', showUnits); showUnits();
    const getUnits = bindSingleChip('chips_units');

    $('prev').onclick = backBtn.onclick;
    $('next').onclick = ()=>{
      const subject = $('subject').value;
      const grade   = gradeSel.value;
      const needUnits = ['י׳','י״א','י״ב'].includes(grade);
      const units = needUnits ? getUnits() : '';
      if(!Val.nonEmpty(subject)) return setStatus('נא לבחור מקצוע');
      if(!Val.nonEmpty(grade))   return setStatus('נא לבחור כיתה');
      if(needUnits && !Val.nonEmpty(units)) return setStatus('נא לבחור יחידות');
      Object.assign(State.data, { subject, grade, units });
      setStatus('');
      step4_trackRateTeacher();
    };
  }

  // 4) מסלול/מחיר + מורה מועדף (חובה)
  function step4_trackRateTeacher(){
    const isHigh5 = (['י״א','י״ב'].includes(State.data.grade) && State.data.units==='5');
    const tracks = isHigh5
      ? [
          {key:'טריפל', label:'שיעור במסלול טריפל – 100₪', info:'עד 3 תלמידים בקבוצה'},
          {key:'פרטי',  label:'שיעור במסלול פרטי – 160₪', info:'אחד על אחד'}
        ]
      : [
          {key:'קבוצה', label:'שיעור במסלול קבוצה – 80₪',  info:'4–6 תלמידים בקבוצה'},
          {key:'טריפל', label:'שיעור במסלול טריפל – 100₪', info:'עד 3 תלמידים בקבוצה'},
          {key:'פרטי',  label:'שיעור במסלול פרטי – 160₪',  info:'אחד על אחד'}
        ];

    stepEl.innerHTML = `
      <div class="title-row"><h3>מסלול ותעריף 👨‍🚀</h3><div class="muted">שלב 4/7</div></div>
      <div class="field">
        <label>בחרו מסלול</label>
        <div class="chips" id="chips_track">
          ${tracks.map(t=>`<button type="button" class="chip" data-key="${t.key}" title="${t.info}">${t.label}</button>`).join('')}
        </div>
        <div class="help">טיפ: החזקה קצרה על הכפתור תציג הסבר על גודל הקבוצה.</div>
      </div>
      <div class="field">
        <label for="teacherPref">מורה מועדף *</label>
        <div class="row">
          <input id="teacherPref" placeholder="כתבו שם מורה" style="flex:2"/>
          <button type="button" class="chip" id="noPref" style="flex:unset">אין לי העדפה</button>
        </div>
        <div class="meta">חובה: כתבו שם מורה או בחרו "אין לי העדפה".</div>
      </div>
      <div class="wizard-actions">
        <button class="btn" id="prev">חזרה</button>
        <button class="btn primary" id="next">המשך</button>
      </div>`;
    push(step4_trackRateTeacher);

    let track = '', rate = '';
    $('chips_track').onclick = (ev)=>{
      const b = ev.target.closest('.chip'); if(!b) return;
      [...$('chips_track').querySelectorAll('.chip[aria-pressed="true"]')].forEach(x=>x.setAttribute('aria-pressed','false'));
      b.setAttribute('aria-pressed','true');
      track = b.dataset.key;
      const text = b.textContent || '';
      rate = text.includes('160') ? '160₪' : text.includes('100') ? '100₪' : '80₪';
    };

    // חובה: או טקסט או "אין לי העדפה"
    let teacherPreference = '';
    $('noPref').onclick = ()=>{
      $('teacherPref').value = 'אין לי העדפה';
      teacherPreference = 'אין לי העדפה';
    };
    $('teacherPref').addEventListener('input', ()=> { teacherPreference = $('teacherPref').value.trim(); });

    $('prev').onclick = backBtn.onclick;
    $('next').onclick = ()=>{
      if(!Val.nonEmpty(track)) return setStatus('נא לבחור מסלול');
      if(!Val.nonEmpty(teacherPreference)) return setStatus('נא להזין מורה מועדף או לבחור "אין לי העדפה"');
      Object.assign(State.data, { track, rate, teacherPreference });
      setStatus('');
      step5_dateTime();
    };
  }

  // 5) תאריך + טווח שעות (select)
  function step5_dateTime(){
    const opts = ['<option value="">— בחרו טווח —</option>']
      .concat(RANGES.map((r,i)=>`<option value="${i}">${r.label}</option>`)).join('');
    stepEl.innerHTML = `
      <div class="title-row"><h3>תיאום זמן 👨‍🚀</h3><div class="muted">שלב 5/7</div></div>
      ${field({label:'תאריך מבוקש', id:'preferredDate', type:'date', required:true})}
      <div class="field">
        <label for="rangeSel">טווח שעות *</label>
        <select id="rangeSel" required>${opts}</select>
      </div>
      <div class="wizard-actions">
        <button class="btn" id="prev">חזרה</button>
        <button class="btn primary" id="next">המשך</button>
      </div>`;
    push(step5_dateTime);

    $('prev').onclick = backBtn.onclick;
    $('next').onclick = ()=>{
      const preferredDate = $('preferredDate').value;
      const idx = $('rangeSel').value;
      if(!Val.date(preferredDate)) return setStatus('נא לבחור תאריך');
      if(String(idx)==='') return setStatus('נא לבחור טווח שעות');
      const r = RANGES[Number(idx)];
      Object.assign(State.data, { preferredDate, timeRange: { from:r.from, to:r.to } });
      setStatus('');
      step6_notes();
    };
  }

  // 6) הערות למזכירות (רשות) – מסך עצמאי
  function step6_notes(){
    stepEl.innerHTML = `
      <div class="title-row"><h3>הערות למזכירות 👨‍🚀</h3><div class="muted">שלב 6/7</div></div>
      <div class="field">
        <label for="notes">הערות (רשות)</label>
        <textarea id="notes" rows="3" placeholder="אילוצים, העדפות, מידע שיעזור לנו"></textarea>
      </div>
      <div class="wizard-actions">
        <button class="btn" id="prev">חזרה</button>
        <button class="btn primary" id="next">המשך</button>
      </div>`;
    push(step6_notes);

    $('prev').onclick = backBtn.onclick;
    $('next').onclick = ()=>{
      State.data.notes = ($('notes').value||'').trim();
      setStatus('');
      step7_summary();
    };
  }

  // 7) סיכום ושליחה
  function step7_summary(){
    const d = State.data;
    stepEl.innerHTML = `
      <div class="title-row"><h3>סיכום ושליחה 👨‍🚀</h3><div class="muted">שלב 7/7</div></div>
      <div class="bubble user">
        <div class="summary">
          ${[
            ['שם פרטי', d.firstName], ['שם משפחה', d.lastName], ['טלפון', d.phone],
            ['תפקיד', d.role],
            ...(d.role==='הורה' ? [['תלמיד/ה', `${d.studentName||''} ${d.studentLastName||''}`]]: []),
            ['מקצוע', d.subject], ['כיתה', d.grade], ...(d.units? [['יחידות', d.units]] : []),
            ['מסלול', d.track], ['תעריף', d.rate],
            ['מורה מועדף', d.teacherPreference],
            ['תאריך מבוקש', d.preferredDate], ['טווח שעות', `${d.timeRange.from}-${d.timeRange.to}`],
            ...(d.notes ? [['הערות', d.notes]]:[])
          ].map(([k,v])=>`<div><strong>${k}:</strong> ${v||'-'}</div>`).join('')}
        </div>
      </div>
      <div class="wizard-actions">
        <button class="btn" id="prev">חזרה</button>
        <button class="btn primary" id="send">אישור ושליחה למזכירות 📤</button>
      </div>`;
    push(step7_summary);

    $('prev').onclick = backBtn.onclick;
    $('send').onclick = submit;
  }

  async function submit(){
    const d = State.data;
    const errs=[];
    if(!Val.nonEmpty(d.firstName)) errs.push('firstName');
    if(!Val.nonEmpty(d.lastName))  errs.push('lastName');
    if(!Val.phoneIL(d.phone))      errs.push('phone');
    if(d.role==='הורה'){
      if(!Val.nonEmpty(d.studentName)) errs.push('studentName');
      if(!Val.nonEmpty(d.studentLastName)) errs.push('studentLastName');
    }
    if(!Val.nonEmpty(d.subject)) errs.push('subject');
    if(!Val.nonEmpty(d.grade))   errs.push('grade');
    if(['י׳','י״א','י״ב'].includes(d.grade||'') && !Val.nonEmpty(d.units)) errs.push('units');
    if(!Val.nonEmpty(d.track))   errs.push('track');
    if(!Val.nonEmpty(d.rate))    errs.push('rate');
    if(!Val.nonEmpty(d.teacherPreference)) errs.push('teacherPreference');
    if(!Val.date(d.preferredDate)) errs.push('preferredDate');
    if(!d.timeRange || !d.timeRange.from || !d.timeRange.to) errs.push('timeRange');
    if(errs.length){ setStatus('חסר/לא תקין: ' + errs.join(', ')); return; }

    const payload = {
      flow: 'onetime',
      createdAt: new Date().toISOString(),
      project: (window.APP_CONFIG||{}).PROJECT || 'Houston',
      status: 'לטיפול',
      source: 'יוסטון – אתר',
      firstName: d.firstName, lastName: d.lastName, phone: d.phone, role: d.role,
      studentName: d.studentName||'', studentLastName: d.studentLastName||'',
      subject: d.subject, grade: d.grade, units: d.units||'',
      track: d.track, rate: d.rate, teacherPreference: d.teacherPreference,
      preferredDate: d.preferredDate, timeRange: d.timeRange,
      notes: d.notes||''
    };

    try{
      setStatus('שולח ל־Google Sheets…');
      await send(payload);
      setStatus('נשלח בהצלחה');
      stepEl.innerHTML = `
        <div class="bubble bot">הבקשה נקלטה ✅ ניצור קשר בהקדם לתיאום 👨‍🚀</div>
        <div class="wizard-actions"><button class="btn" onclick="location.href='../../index.html'">חזרה לדף הבית</button></div>`;
      backBtn.disabled = true;
      State.stack = [stepEl.innerHTML];
    }catch(err){
      setStatus('שגיאה: ' + err.message);
    }
  }

  function start(){ State.data={}; State.stack=[]; backBtn.disabled=true; setStatus(''); step1_contact(); }
  return { start };
})();