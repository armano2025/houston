/* /public/branches/js/flows/reschedule.js
   וויזארד "שינוי מועד קבוע (Reschedule)" – ללא צ'אט:
   שלבים (עד 3 שדות במסך):
   1) פרטי קשר 👨‍🚀 — תפקיד (תלמיד/הורה), שם פרטי, שם משפחה, טלפון
   2) פרטי המנוי 👨‍🚀 — אם הורה: שם/שם משפחה של התלמיד; אם תלמיד: מדלגים. + מקצוע + מסלול
   3) מורה 👨‍🚀 — שם המורה (מלל חופשי)
   4) המועד הקבוע כיום 👨‍🚀 — יום בשבוע, שעה (08:00–22:00, ללא "עגולה" בטקסט)
   5) תיאום מועד חדש 👨‍🚀 — הוספת מועדים: יום בשבוע + בלוקים 13–16 / 16–19 / 19–21, אפשר כמה או דילוג ("אין העדפה")
   6) הערות למזכירות 👨‍🚀 — טקסט חופשי (רשות); ניסוח: "[שם פרטי], לפני שאשלח למזכירות, יש עוד משהו שצריך להוסיף 👨‍🚀?"
   7) סיכום ושליחה 👨‍🚀 — מציג הכול. שליחה ל-GAS כ-text/plain (ללא preflight). status תמיד "לטיפול".
*/

window.RescheduleWizard = (() => {
  const el = (id) => document.getElementById(id);
  const stepEl = el('step');
  const backBtn = el('backBtn');
  const statusEl = el('statusBox');

  const HOURS = Array.from({length:15}, (_,i)=>String(i+8).padStart(2,'0')+':00'); // 08:00..22:00
  const DAYS  = ['א׳','ב׳','ג׳','ד׳','ה׳'];
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

  // שימוש בעזרים מ-chat-core אם קיימים
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

  /* עזרי UI קצרים (HTML) */
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

  // מסך 1 — פרטי קשר 👨‍🚀
  function step1_contact(){
    stepEl.innerHTML = `
      <div class="title-row">
        <h3>שינוי מועד קבוע 👨‍🚀</h3>
        <div class="muted">שלב 1/7</div>
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
      const role      = getRole();
      const firstName = el('f_firstName').value.trim();
      const lastName  = el('f_lastName').value.trim();
      const phone     = el('f_phone').value.replace(/[^\d]/g,'');
      if(!Val.nonEmpty(role))     return setStatus('בחר/י תלמיד או הורה');
      if(!Val.nonEmpty(firstName))return setStatus('נא למלא שם פרטי');
      if(!Val.nonEmpty(lastName)) return setStatus('נא למלא שם משפחה');
      if(!Val.phoneIL(phone))     return setStatus('טלפון לא תקין');
      setStatus('');
      Object.assign(State.data, { role, firstName, lastName, phone });
      step2_subscriber();
    };
  }

  // מסך 2 — פרטי המנוי 👨‍🚀 (שם תלמיד אם הורה) + מקצוע + מסלול
  function step2_subscriber(){
    const subjects = ['מתמטיקה','אנגלית','פיזיקה','שפה','הוראה מתקנת','אנגלית מדוברת'];
    const isParent = (State.data.role === 'הורה');

    stepEl.innerHTML = `
      <div class="title-row">
        <h3>פרטי המנוי 👨‍🚀</h3>
        <div class="muted">שלב 2/7</div>
      </div>
      ${isParent ? fieldRow({label:'שם התלמיד/ה', name:'studentName', placeholder:'לדוגמה: נועה', required:true}) : ''}
      ${isParent ? fieldRow({label:'שם משפחה התלמיד/ה (רשות)', name:'studentLast', placeholder:'לדוגמה: כהן', required:false}) : ''}
      ${selectRow({label:'מקצוע', name:'subject', options:subjects, required:true})}
      ${chipsRow({label:'מסלול למידה', name:'track', options:['קבוצתי','טריפל','פרטי']})}
      <div class="wizard-actions">
        <button class="btn" id="prev">חזרה</button>
        <button class="btn primary" id="next">המשך</button>
      </div>`;
    push(step2_subscriber);

    const getTrack = bindSingleChips('chips_track');
    el('prev').onclick = goBack;
    el('next').onclick = ()=>{
      const subject = el('f_subject').value;
      const track   = getTrack();

      // אם הורה – חובה למלא שם תלמיד
      let studentName='', studentLast='';
      if (State.data.role === 'הורה'){
        studentName = (el('f_studentName')?.value || '').trim();
        studentLast = (el('f_studentLast')?.value || '').trim();
        if(!Val.nonEmpty(studentName)) return setStatus('נא למלא שם תלמיד/ה');
      } else {
        // תלמיד: משתמשים בשם הממלא
        studentName = `${State.data.firstName||''} ${State.data.lastName||''}`.trim();
      }

      if(!Val.nonEmpty(subject))  return setStatus('נא לבחור מקצוע');
      setStatus('');
      Object.assign(State.data, { studentName, studentLast, subject, track });
      step3_teacher();
    };
  }

  // מסך 3 — מורה 👨‍🚀
  function step3_teacher(){
    const fname = (State.data.firstName||'').trim() || '';
    const studentLabel = (State.data.studentName||'').trim() || 'התלמיד/ה';

    stepEl.innerHTML = `
      <div class="title-row">
        <h3>מורה 👨‍🚀</h3>
        <div class="muted">שלב 3/7</div>
      </div>
      <p class="muted">תודה ${fname}, עכשיו אני צריך לדעת מי המורה של ${studentLabel} 👨‍🚀</p>
      ${fieldRow({label:'שם המורה במרכז הלמידה', name:'teacher', placeholder:'לדוגמה: לירז', required:true})}
      <div class="wizard-actions">
        <button class="btn" id="prev">חזרה</button>
        <button class="btn primary" id="next">המשך</button>
      </div>`;
    push(step3_teacher);

    el('prev').onclick = goBack;
    el('next').onclick = ()=>{
      const teacher = el('f_teacher').value.trim();
      if(!Val.nonEmpty(teacher)) return setStatus('נא למלא שם מורה');
      setStatus('');
      Object.assign(State.data, { teacher });
      step4_currentSlot();
    };
  }

  // מסך 4 — המועד הקבוע כיום 👨‍🚀
  function step4_currentSlot(){
    stepEl.innerHTML = `
      <div class="title-row">
        <h3>המועד הקבוע כיום 👨‍🚀</h3>
        <div class="muted">שלב 4/7</div>
      </div>
      ${selectRow({label:'יום בשבוע', name:'currentDay', options:DAYS, required:true})}
      ${selectRow({label:'שעה', name:'currentTime', options:HOURS, required:true})}
      <div class="wizard-actions">
        <button class="btn" id="prev">חזרה</button>
        <button class="btn primary" id="next">המשך</button>
      </div>`;
    push(step4_currentSlot);

    el('prev').onclick = goBack;
    el('next').onclick = ()=>{
      const currentDay  = el('f_currentDay').value;
      const currentTime = el('f_currentTime').value;
      if(!Val.nonEmpty(currentDay))     return setStatus('נא לבחור יום בשבוע');
      if(!HOURS.includes(currentTime))  return setStatus('נא לבחור שעה תקפה');
      setStatus('');
      Object.assign(State.data, { currentDay, currentTime });
      step5_desiredSlots();
    };
  }

  // מסך 5 — תיאום מועד חדש 👨‍🚀
  function step5_desiredSlots(){
    const fname = (State.data.firstName||'').trim() || '';
    const optHtml = ['<option value="">— בחרו טווח —</option>']
      .concat(RANGES.map((r,i)=>`<option value="${i}">${r.label}</option>`)).join('');
    const chosen = State.data.slots || [];

    stepEl.innerHTML = `
      <div class="title-row">
        <h3>תיאום מועד חדש 👨‍🚀</h3>
        <div class="muted">שלב 5/7</div>
      </div>
      <p class="muted">תודה ${fname}, אעביר אל המזכירות את כל הזמנים שנוחים לך. כדאי לבחור כמה שיותר אפשרויות 👨‍🚀</p>
      ${selectRow({label:'יום בשבוע', name:'slotDay', options:DAYS, required:false})}
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
        b.textContent = `${s.day} • ${s.from}-${s.to}`;
        b.title='הסר'; b.onclick = ()=>{ chosen.splice(idx,1); redraw(); };
        listEl.appendChild(b);
      });
    };
    redraw();

    el('add').onclick = ()=>{
      const day = el('f_slotDay').value;
      const idx  = el('f_slotRange').value;
      if(!Val.nonEmpty(day)) return setStatus('נא לבחור יום בשבוע');
      if(String(idx)==='')   return setStatus('נא לבחור טווח שעות');
      const r = RANGES[Number(idx)];
      chosen.push({ day, from:r.from, to:r.to });
      setStatus('');
      el('f_slotDay').value=''; el('f_slotRange').value='';
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

  // מסך 6 — הערות למזכירות 👨‍🚀
  function step6_notes(){
    const fname = (State.data.firstName||'').trim() || '';
    stepEl.innerHTML = `
      <div class="title-row">
        <h3>הערות למזכירות 👨‍🚀</h3>
        <div class="muted">שלב 6/7</div>
      </div>
      <p class="muted">${fname}, לפני שאשלח למזכירות, יש עוד משהו שצריך להוסיף 👨‍🚀?</p>
      <div class="field">
        <label for="f_notes">הערות (רשות)</label>
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

  // מסך 7 — סיכום ושליחה 👨‍🚀
  function step7_summary(){
    const d = State.data;
    const rows = [
      ['תפקיד', d.role],
      ['שם פרטי', d.firstName], ['שם משפחה', d.lastName], ['טלפון', d.phone],
      ['שם התלמיד/ה', d.studentName || '—'],
      ...(d.studentLast ? [['שם משפחה התלמיד/ה', d.studentLast]]:[]),
      ['מקצוע', d.subject], ['מסלול', d.track||''],
      ['מורה', d.teacher],
      ['המועד הקבוע כיום', `${d.currentDay} • ${d.currentTime}`],
      ['מועדים למועד חדש', (d.slots&&d.slots.length) ? d.slots.map(s=>`${s.day} ${s.from}-${s.to}`).join(' | ') : (d.desiredPreference||'אין העדפה')],
      ...(d.notes ? [['הערות', d.notes]]:[])
    ];
    stepEl.innerHTML = `
      <div class="title-row">
        <h3>סיכום ושליחה 👨‍🚀</h3>
        <div class="muted">שלב 7/7</div>
      </div>
      <div class="summary">${rows.map(([k,v])=>`<div><strong>${k}:</strong> ${v||'-'}</div>`).join('')}</div>
      <div class="wizard-actions">
        <button class="btn" id="prev">חזרה</button>
        <button class="btn primary" id="send">אישור ושליחה למזכירות 📤</button>
      </div>`;
    push(step7_summary);

    el('prev').onclick = goBack;
    el('send').onclick = submit;
  }

  // שליחה
  async function submit(){
    const d = State.data, errs=[];
    if(!Val.nonEmpty(d.role))       errs.push('role');
    if(!Val.nonEmpty(d.firstName))  errs.push('firstName');
    if(!Val.nonEmpty(d.lastName))   errs.push('lastName');
    if(!Val.phoneIL(d.phone))       errs.push('phone');
    if(d.role==='הורה' && !Val.nonEmpty(d.studentName)) errs.push('studentName');
    if(!Val.nonEmpty(d.subject))    errs.push('subject');
    if(!Val.nonEmpty(d.teacher))    errs.push('teacher');
    if(!Val.nonEmpty(d.currentDay)) errs.push('currentDay');
    if(!HOURS.includes(d.currentTime||'')) errs.push('currentTime');
    if(errs.length) return setStatus('חסר/לא תקין: ' + errs.join(', '));

    const payload = {
      flow: 'reschedule',
      createdAt: new Date().toISOString(),
      project: (window.APP_CONFIG||{}).PROJECT || 'Houston',
      status: 'לטיפול',

      // מזהה
      role: d.role,
      firstName: d.firstName,
      lastName: d.lastName,
      phone: d.phone,

      // פרטי מנוי
      studentName: d.studentName || `${d.firstName||''} ${d.lastName||''}`.trim(),
      studentLast: d.studentLast || '',
      subject: d.subject,
      track: d.track || '',
      teacher: d.teacher,

      // המועד הקבוע כיום
      currentDay: d.currentDay,
      currentTime: d.currentTime,

      // בקשה למועד חדש
      desiredPreference: d.desiredPreference || (d.slots?.length ? 'יש העדפות' : 'אין העדפה'),
      slots: (d.slots||[]).map(s=>({ day:s.day, from:s.from, to:s.to })),

      // הערות
      notes: d.notes || ''
    };

    try{
      setStatus('שולח ל־Google Sheets…');
      const res = await send(payload);
      if(res && res.ok){
        setStatus('נשלח בהצלחה');
        stepEl.innerHTML = `
          <div class="bubble ok">הבקשה נקלטה ✅ ניצור קשר לתיאום מועד חדש 👨‍🚀</div>
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
    step1_contact();
  }

  return { start };
})();