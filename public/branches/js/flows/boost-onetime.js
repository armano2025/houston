/* /public/branches/js/flows/boost-onetime.js
   ויזארד "שיעור חד־פעמי על בסיס מקום פנוי" – ללא צ'אט.
   תואם ל-INTAKE_HEADERS.onetime:
   'preferredDate','timeRange','slots','slotsText' ועוד.
   נשלח ב-Content-Type:text/plain כדי להימנע מ-preflight.
*/

window.OneTimeWizard = (() => {
  const el = (id) => document.getElementById(id);
  const stepEl   = el('step');
  const backBtn  = el('backBtn');
  const statusEl = el('statusBox');

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

  const Val = (window.Chat && window.Chat.Val) ? window.Chat.Val : {
    nonEmpty: s => String(s??'').trim().length>0,
    phoneIL: s => /^0\d{1,2}\d{7}$/.test(String(s??'').replace(/[^\d]/g,'')),
    date: s => /^\d{4}-\d{2}-\d{2}$/.test(s),
  };
  const esc = (window.Chat && window.Chat.esc) ? window.Chat.esc
    : (s => String(s??'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));
  const FRIENDLY_ERR = 'לא הצלחנו לשלוח את הבקשה כרגע 🙁 בדקו את החיבור לאינטרנט ונסו שוב בעוד רגע.';

  // שליחה ל־GAS: text/plain (בלי preflight) + תמיכה בתשובות טקסט/JSON
  async function send(payload){
    if (window.Chat?.sendLeadToSheet) return await window.Chat.sendLeadToSheet(payload);
    const url = (window.APP_CONFIG||{}).SHEET_API_URL;
    if (!url) throw new Error('SHEET_API_URL לא הוגדר');

    const res = await fetch(url, {
      method:'POST',
      headers:{'Content-Type':'text/plain;charset=utf-8'},
      body: JSON.stringify(payload),
      mode:'cors',
      redirect:'follow',
      keepalive:true
    });

    if (res.type === 'opaque') return { ok:true, opaque:true };
    if (!res.ok){
      const t = await res.text().catch(()=> '');
      throw new Error(`HTTP ${res.status} ${res.statusText}${t?` — ${t.slice(0,140)}`:''}`);
    }
    const raw = await res.text();
    try { return JSON.parse(raw); } catch(e){}
    return (/ok/i.test(raw) ? { ok:true, raw } : { ok:false, raw });
  }

  /* ===== UI helpers ===== */
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
      <div class="title-row"><h3>שיעור חד־פעמי 👨‍🚀</h3></div>
      <p class="muted">כדי שאוכל לתאם עבורך שיעור, ארשום כמה פרטים קצרים 🧑‍🚀</p>

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
      if(!Val.nonEmpty(role))     return setStatus('נא לבחור: תלמיד/הורה');
      if(!Val.nonEmpty(firstName))return setStatus('נא למלא שם פרטי');
      if(!Val.nonEmpty(lastName)) return setStatus('נא למלא שם משפחה');
      if(!Val.phoneIL(phone))     return setStatus('טלפון לא תקין');
      setStatus('');
      Object.assign(State.data, { role, firstName, lastName, phone });
      step2_studentIfParent();
    };
  }

  function step2_studentIfParent(){
    if (State.data.role !== 'הורה'){ step3_studyBasics(); return; }

    stepEl.innerHTML = `
      <div class="title-row"><h3>פרטי תלמיד/ה 👨‍🚀</h3><div class="muted">שלב 2/7</div></div>
      ${fieldRow({label:'שם פרטי התלמיד/ה',  name:'studentFirst', placeholder:'לדוגמה: נועה', required:true})}
      ${fieldRow({label:'שם משפחה התלמיד/ה', name:'studentLast',  placeholder:'לדוגמה: כהן', required:true})}
      <div class="wizard-actions">
        <button class="btn" id="prev">חזרה</button>
        <button class="btn primary" id="next">המשך</button>
      </div>`;
    push(step2_studentIfParent);

    el('prev').onclick = goBack;
    el('next').onclick = ()=>{
      const studentFirst = el('f_studentFirst').value.trim();
      const studentLast  = el('f_studentLast').value.trim();
      if(!Val.nonEmpty(studentFirst)) return setStatus('נא למלא שם פרטי של התלמיד/ה');
      if(!Val.nonEmpty(studentLast))  return setStatus('נא למלא שם משפחה של התלמיד/ה');
      setStatus('');
      Object.assign(State.data, { studentFirst, studentLast });
      step3_studyBasics();
    };
  }

  function step3_studyBasics(){
    stepEl.innerHTML = `
      <div class="title-row"><h3>פרטי לימוד 👨‍🚀</h3><div class="muted">שלב 3/7</div></div>
      ${selectRow({label:'מקצוע', name:'subject', options:['מתמטיקה','אנגלית','פיזיקה','שפה','הוראה מתקנת','אנגלית מדוברת'], required:true})}
      ${selectRow({label:'כיתה', name:'grade', options:['א׳','ב׳','ג׳','ד׳','ה׳','ו׳','ז׳','ח׳','ט׳','י׳','י״א','י״ב','סטודנט'], required:true})}
      <div id="unitsWrap" style="display:none">
        ${chipsRow({label:'יחידות (לכיתות י/י״א/י״ב)', name:'units', options:['3','4','5']})}
      </div>
      <div class="wizard-actions">
        <button class="btn" id="prev">חזרה</button>
        <button class="btn primary" id="next">המשך</button>
      </div>`;
    push(step3_studyBasics);

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
      const subject = el('f_subject').value;
      const grade   = gradeSel.value;
      const needUnits = ['י׳','י״א','י״ב'].includes(grade);
      const units  = needUnits ? getUnits() : '';
      if(!Val.nonEmpty(subject)) return setStatus('נא לבחור מקצוע');
      if(!Val.nonEmpty(grade))   return setStatus('נא לבחור כיתה');
      if(needUnits && !Val.nonEmpty(units)) return setStatus('נא לבחור יחידות');
      setStatus('');
      Object.assign(State.data, { subject, grade, units });
      step4_trackRateTeacher();
    };
  }

  function step4_trackRateTeacher(){
    const isHigh5 = (['י״א','י״ב'].includes(State.data.grade) && State.data.units==='5');
    const tracks = isHigh5
      ? ['שיעור במסלול טריפל - 100₪','שיעור במסלול פרטי - 160₪']
      : ['שיעור במסלול קבוצה - 80₪','שיעור במסלול טריפל - 100₪','שיעור במסלול פרטי - 160₪'];

    stepEl.innerHTML = `
      <div class="title-row"><h3>מסלול ותעריף 👨‍🚀</h3><div class="muted">שלב 4/7</div></div>
      ${chipsRow({label:'בחרו מסלול', name:'track', options:tracks})}
      <div class="field">
        <label for="f_teacherPref">מורה מועדף *</label>
        <div class="row">
          <input id="f_teacherPref" placeholder="כתבו שם מורה"/>
          <button type="button" class="chip" id="noPref">אין לי העדפה</button>
        </div>
        <div class="meta">חובה: כתבו שם מורה או בחרו "אין לי העדפה".</div>
      </div>
      <div class="wizard-actions">
        <button class="btn" id="prev">חזרה</button>
        <button class="btn primary" id="next">המשך</button>
      </div>`;
    push(step4_trackRateTeacher);

    const getTrackLbl = bindSingleChips('chips_track');
    let teacherPreference = '';
    el('noPref').onclick = ()=>{ el('f_teacherPref').value='אין לי העדפה'; teacherPreference='אין לי העדפה'; };
    el('f_teacherPref').addEventListener('input', ()=> teacherPreference = el('f_teacherPref').value.trim());

    el('prev').onclick = goBack;
    el('next').onclick = ()=>{
      const picked = getTrackLbl();
      if(!Val.nonEmpty(picked)) return setStatus('נא לבחור מסלול');
      if(!Val.nonEmpty(teacherPreference)) return setStatus('נא להזין מורה מועדף או לבחור "אין לי העדפה"');

      let track='', rate='';
      if (picked.includes('קבוצה')) { track='קבוצה'; rate='80₪'; }
      else if (picked.includes('טריפל')) { track='טריפל'; rate='100₪'; }
      else { track='פרטי'; rate='160₪'; }

      Object.assign(State.data, { track, rate, teacherPreference });
      setStatus('');
      step5_availability();
    };
  }

  function step5_availability(){
    const optHtml = ['<option value="">— בחרו טווח —</option>']
      .concat(RANGES.map((r,i)=>`<option value="${i}">${r.label}</option>`)).join('');
    const chosen = State.data.slots || [];

    stepEl.innerHTML = `
      <div class="title-row"><h3>זמינות לשיעור 👨‍🚀</h3><div class="muted">שלב 5/7</div></div>
      ${fieldRow({label:'תאריך', name:'slotDate', type:'date', required:false})}
      <div class="field">
        <label for="f_slotRange">טווח שעות</label>
        <select id="f_slotRange" name="slotRange">
          ${optHtml}
        </select>
      </div>

      <div class="wizard-actions">
        <button class="btn" id="add">+ הוסף מועד</button>
      </div>

      <div class="field">
        <label>מועדים שנבחרו</label>
        <div id="list" class="slot-list"></div>
        <div class="meta">יש לבחור לפחות מועד אחד. לחיצה על מועד מוחקת אותו מהרשימה</div>
      </div>

      <div class="wizard-actions">
        <button class="btn" id="prev">חזרה</button>
        <button class="btn primary" id="next">המשך</button>
      </div>`;
    push(step5_availability);

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

    el('prev').onclick = goBack;
    el('next').onclick = ()=>{
      if(!chosen.length) return setStatus('הוסיפו לפחות מועד אחד');
      State.data.slots = chosen.slice();
      setStatus('');
      step6_notes();
    };
  }

  function step6_notes(){
    stepEl.innerHTML = `
      <div class="title-row"><h3>הערות למזכירות (רשות) 👨‍🚀</h3><div class="muted">שלב 6/7</div></div>
      <div class="field">
        <label for="f_notes">הערות</label>
        <textarea id="f_notes" rows="3" placeholder="אילוצים, העדפות, פרטים שיעזרו לנו"></textarea>
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
      ['מי ממלא', d.role],
      ['שם יוצר קשר', `${d.firstName||''} ${d.lastName||''}`.trim()],
      ['טלפון', d.phone||''],
      ...(d.role==='הורה' ? [['שם התלמיד/ה', `${d.studentFirst||''} ${d.studentLast||''}`.trim()]]: []),
      ['מקצוע', d.subject||''],
      ['כיתה', d.grade||''],
      ...(d.units ? [['יחידות', d.units]]:[]),
      ['מסלול', d.track||''],
      ['תעריף', d.rate||''],
      ['מורה מועדף', d.teacherPreference||''],
      ['מועדים', (d.slots||[]).map(s=>`${s.date} ${s.from}-${s.to}`).join(' | ')],
      ...(d.notes ? [['הערות', d.notes]]:[])
    ];

    stepEl.innerHTML = `
      <div class="title-row"><h3>סיכום ושליחה 👨‍🚀</h3><div class="muted">שלב 7/7</div></div>
      <p class="muted">רגע לפני השליחה – כדאי לוודא שהכול נכון:</p>
      <div class="summary">${rows.map(([k,v])=>`<div><strong>${k}:</strong> ${esc(v)||'-'}</div>`).join('')}</div>
      <div class="wizard-actions">
        <button class="btn" id="prev">חזרה</button>
        <button class="btn primary" id="send">אישור ושליחה למזכירות 📤</button>
      </div>`;
    push(step7_summary);

    el('prev').onclick = goBack;
    el('send').onclick = submit;
  }

  async function submit(){
    const d = State.data, errs=[];
    if(!Val.nonEmpty(d.role))       errs.push('מי ממלא');
    if(!Val.nonEmpty(d.firstName))  errs.push('שם פרטי');
    if(!Val.nonEmpty(d.lastName))   errs.push('שם משפחה');
    if(!Val.phoneIL(d.phone))       errs.push('טלפון');

    if(d.role==='הורה'){
      if(!Val.nonEmpty(d.studentFirst)) errs.push('שם פרטי התלמיד/ה');
      if(!Val.nonEmpty(d.studentLast))  errs.push('שם משפחה התלמיד/ה');
    }

    if(!Val.nonEmpty(d.subject))   errs.push('מקצוע');
    if(!Val.nonEmpty(d.grade))     errs.push('כיתה');
    if(['י׳','י״א','י״ב'].includes(d.grade||'') && !Val.nonEmpty(d.units)) errs.push('יחידות');

    if(!Val.nonEmpty(d.track))     errs.push('מסלול');
    if(!Val.nonEmpty(d.rate))      errs.push('תעריף');
    if(!Val.nonEmpty(d.teacherPreference)) errs.push('מורה מועדף');

    if(!Array.isArray(d.slots) || !d.slots.length) errs.push('מועדים');

    if(errs.length) return setStatus('חסר או לא תקין: ' + errs.join(', '));

    // לשליחה ל-GAS: שמות שדות תואמים במדויק ל-INTAKE_HEADERS.onetime
    const first = d.slots[0];
    const payload = {
      flow: 'onetime',
      createdAt: new Date().toISOString(),
      project: (window.APP_CONFIG||{}).PROJECT || 'Houston',
      status: 'לטיפול',
      source: 'יוסטון – שיעור חד־פעמי',

      // פרטי יוצר קשר
      role: d.role, firstName: d.firstName, lastName: d.lastName, phone: d.phone,

      // פרטי תלמיד (לפי שמות העמודות בגיליון)
      studentName: d.studentFirst || '',
      studentLastName: d.studentLast || '',

      // לימודים
      subject: d.subject, grade: d.grade, units: d.units || '',

      // מסלול ותעריף
      track: d.track, rate: d.rate, teacherPreference: d.teacherPreference,

      // זמינות — first + כל המועדים (ה-GAS ימלא slotsText)
      preferredDate: first?.date || '',
      timeRange: first ? { from:first.from, to:first.to } : '',
      slots: d.slots.map(s => ({ date:s.date, from:s.from, to:s.to })),

      // הערות
      notes: d.notes || ''
    };

    const sendBtn = el('send');
    try{
      if (sendBtn) sendBtn.disabled = true; // מניעת שליחה כפולה
      setStatus('שולח למזכירות…');
      const res = await send(payload);
      if(res && res.ok){
        setStatus('');
        const fname = (d.firstName||'').trim() || '🙂';
        stepEl.innerHTML = `
          <div class="bubble ok">תודה ${esc(fname)} ✅ הבקשה לשיעור חד־פעמי נקלטה. המזכירות תחזור אליכם לתיאום בהקדם.</div>
          <div class="wizard-actions">
            <button class="btn" onclick="location.href='../../index.html'">חזרה לתפריט הראשי</button>
          </div>`;
        backBtn.disabled = true;
        State.stack = [stepEl.innerHTML];
      }else{
        throw new Error(res && res.raw ? res.raw : 'server_error');
      }
    }catch(err){
      console.error('[Houston] onetime submit failed:', err?.message || err);
      if (sendBtn) sendBtn.disabled = false;
      setStatus(FRIENDLY_ERR);
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