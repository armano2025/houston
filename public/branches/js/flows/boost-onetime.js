/***************************************
# /public/branches/js/flows/boost-onetime.js
# וויזארד "שיעור חד־פעמי" (לא מנויים) – flow='onetime'
# מה הקובץ עושה?
# וויזארד קצר: הזדהות → (אם הורה: פרטי תלמיד) → מקצוע/כיתה/יחידות → מסלול/תעריף + מורה מועדף
# → תאריך+טווח שעות → הערות → סיכום ושליחה (text/plain) → Google Apps Script.
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

  // עזרי UI (שואבים מאותה שפה של chat-core)
  const Val = (window.Chat && window.Chat.Val) ? window.Chat.Val : {
    nonEmpty: s => String(s??'').trim().length>0,
    phoneIL: s => /^0\d{1,2}\d{7}$/.test(String(s??'').replace(/[^\d]/g,'')),
    date: s => /^\d{4}-\d{2}-\d{2}$/.test(s)
  };
  const send = (payload) => (window.Chat?.sendLeadToSheet
    ? window.Chat.sendLeadToSheet(payload)
    : fetch((window.APP_CONFIG||{}).SHEET_API_URL, {
        method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'},
        body: JSON.stringify(payload)
      }).then(r=>r.json()));

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
      b.setAttribute('aria-pressed', 'true'); val = b.dataset.value || b.textContent.trim();
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
      ${field({label:'טלפון', id:'phone', placeholder:'05XXXXXXXX', required:true})}
      <div class="wizard-actions">
        <button class="btn primary" id="next">המשך</button>
      </div>`;
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

  // 2) אם הורה — פרטי תלמיד; אם תלמיד — דילוג למסך מקצוע/כיתה/יחידות
  function step2_studentIfParent(){
    if(State.data.role !== 'הורה'){ step3_studyBasics(); return; }
    stepEl.innerHTML = `
      <div class="title-row"><h3>פרטי התלמיד/ה 👨‍🚀</h3><div class="muted">שלב 2/6</div></div>
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
      <div class="title-row"><h3>פרטי לימוד 👨‍🚀</h3><div class="muted">שלב 3/6</div></div>
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
    const showUnits = ()=> { const g = gradeSel.value; unitsWrap.style.display = (['י׳','י״א','י״ב'].includes(g)) ? '' : 'none'; };
    gradeSel.addEventListener('change', showUnits);
    showUnits();
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

  // 4) מסלול/מחיר + מורה מועדף (כולל חסימת "קבוצתי" עבור י״א/י״ב 5 יחידות)
  function step4_trackRateTeacher(){
    const isHigh5 = (['י״א','י״ב'].includes(State.data.grade) && State.data.units==='5');
    // רשימת המסלולים
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
      <div class="title-row"><h3>מסלול ותעריף 👨‍🚀</h3><div class="muted">שלב 4/6</div></div>
      <div class="field">
        <label>בחרו מסלול</label>
        <div class="chips" id="chips_track">
          ${tracks.map(t=>`<button type="button" class="chip" data-key="${t.key}" title="${t.info}">${t.label}</button>`).join('')}
        </div>
        <div class="help">רמז: לחצו/החזיקו לקבלת הסבר קצר על גודל הקבוצה.</div>
      </div>
      <div class="field">
        <label for="teacherPref">מורה מועדף (רשות)</label>
        <input id="teacherPref" placeholder="כתבו שם מורה או השאירו ריק" />
        <div class="meta">או כתבו: "אין לי העדפה"</div>
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

    $('prev').onclick = backBtn.onclick;
    $('next').onclick = ()=>{
      if(!Val.nonEmpty(track)) return setStatus('נא לבחור מסלול');
      const teacherPreference = $('teacherPref').value.trim();
      Object.assign(State.data, { track, rate, teacherPreference });
      setStatus('');
      step5_dateTime();
    };
  }

  // 5) תאריך + טווח שעות
  function step5_dateTime(){
    stepEl.innerHTML = `
      <div class="title-row"><h3>תיאום זמן 👨‍🚀</h3><div class="muted">שלב 5/6</div></div>
      ${field({label:'תאריך מבוקש', id:'preferredDate', type:'date', required:true})}
      <div class="field">
        <label>טווח שעות</label>
        <div class="chips" id="chips_range">
          ${RANGES.map((r,i)=>`<button type="button" class="chip" data-i="${i}">${r.label}</button>`).join('')}
        </div>
      </div>
      <div class="wizard-actions">
        <button class="btn" id="prev">חזרה</button>
        <button class="btn primary" id="next">המשך</button>
      </div>`;
    push(step5_dateTime);

    let picked = null;
    $('chips_range').onclick = (ev)=>{
      const b = ev.target.closest('.chip'); if(!b) return;
      [...$('chips_range').querySelectorAll('.chip[aria-pressed="true"]')].forEach(x=>x.setAttribute('aria-pressed','false'));
      b.setAttribute('aria-pressed','true');
      picked = RANGES[Number(b.dataset.i)];
    };

    $('prev').onclick = backBtn.onclick;
    $('next').onclick = ()=>{
      const preferredDate = $('preferredDate').value;
      if(!Val.date(preferredDate)) return setStatus('נא לבחור תאריך');
      if(!picked) return setStatus('נא לבחור טווח שעות');
      Object.assign(State.data, { preferredDate, timeRange: { from:picked.from, to:picked.to } });
      setStatus('');
      step6_notesSummary();
    };
  }

  // 6) הערות + סיכום/שליחה
  function step6_notesSummary(){
    const d = State.data;
    stepEl.innerHTML = `
      <div class="title-row"><h3>הערות + סיכום 👨‍🚀</h3><div class="muted">שלב 6/6</div></div>
      <div class="field">
        <label for="notes">הערות למזכירות (רשות)</label>
        <textarea id="notes" rows="3" placeholder="אילוצים, העדפות, מידע שיעזור לנו"></textarea>
      </div>
      <div class="bubble user">
        <div class="summary">
          ${[
            ['שם פרטי', d.firstName], ['שם משפחה', d.lastName], ['טלפון', d.phone],
            ['תפקיד', d.role],
            ...(d.role==='הורה' ? [['תלמיד/ה', `${d.studentName||''} ${d.studentLastName||''}`]]: []),
            ['מקצוע', d.subject], ['כיתה', d.grade], ...(d.units? [['יחידות', d.units]] : []),
            ['מסלול', d.track], ['תעריף', d.rate],
            ['מורה מועדף', d.teacherPreference||''],
            ['תאריך מבוקש', d.preferredDate], ['טווח שעות', `${d.timeRange.from}-${d.timeRange.to}`]
          ].map(([k,v])=>`<div><strong>${k}:</strong> ${v||'-'}</div>`).join('')}
        </div>
      </div>
      <div class="wizard-actions">
        <button class="btn" id="prev">חזרה</button>
        <button class="btn primary" id="send">אישור ושליחה למזכירות 📤</button>
      </div>`;
    push(step6_notesSummary);

    $('prev').onclick = backBtn.onclick;
    $('send').onclick = submit;
  }

  async function submit(){
    const d = State.data;
    // ולידציה אחרונה
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
    if(!Val.date(d.preferredDate)) errs.push('preferredDate');
    if(!d.timeRange || !d.timeRange.from || !d.timeRange.to) errs.push('timeRange');

    if(errs.length){ setStatus('חסר/לא תקין: ' + errs.join(', ')); return; }

    const payload = {
      flow: 'onetime',                       // ← חשוב: זרימה נפרדת
      createdAt: new Date().toISOString(),
      project: (window.APP_CONFIG||{}).PROJECT || 'Houston',
      status: 'לטיפול',
      source: 'יוסטון – אתר',

      // מזדהה
      firstName: d.firstName, lastName: d.lastName, phone: d.phone, role: d.role,
      studentName: d.studentName||'', studentLastName: d.studentLastName||'',

      // לימוד
      subject: d.subject, grade: d.grade, units: d.units||'',

      // מסלול/תמחור
      track: d.track, rate: d.rate,

      // העדפת מורה + הערות
      teacherPreference: d.teacherPreference||'',
      notes: (document.getElementById('notes')?.value||'').trim(),

      // תיאום
      preferredDate: d.preferredDate,
      timeRange: d.timeRange
    };

    try{
      setStatus('שולח ל־Google Sheets…');
      const res = await send(payload);
      if(res && res.ok){
        setStatus('נשלח בהצלחה');
        stepEl.innerHTML = `
          <div class="bubble bot">הבקשה נקלטה ✅ ניצור קשר בהקדם לתיאום 👨‍🚀</div>
          <div class="wizard-actions"><button class="btn" onclick="location.href='../../index.html'">חזרה לדף הבית</button></div>`;
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
    step1_contact();
  }

  return { start };
})();