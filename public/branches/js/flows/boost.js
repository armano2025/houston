/* /public/branches/js/flows/boost.js
   ויזארד "שיעור תגבור (Boost)" – ללא צ'אט.
   עדכון: תיקון שליחה עמיד ל-GAS (ללא preflight + תמיכה ב-opaque/טקסט), והפרדת שלב "תעריף" משלב "הערות".
   שלבים:
   1) פרטי קשר — אני: תלמיד/הורה, שם פרטי, שם משפחה, טלפון
   2) אם הורה: שם פרטי/משפחה של התלמיד | אם תלמיד: מקצוע + מסלול (קבוצתי/טריפל/פרטי)
   3) כיתה / יחידות אם צריך (י׳/י״א/י״ב) / שם המורה (רשות)
   4) זמינות — תאריך + טווח שעות (13–16 / 16–19 / 19–21), ניתן להוסיף כמה מועדים
   5) תעריף — "איזה מסלול תרצה/תרצי?"
   6) הערות — (רשות)
   7) סיכום ושליחה — status תמיד "לטיפול". */

window.BoostWizard = (() => {
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

  // ולידציה
  const Val = (window.Chat && window.Chat.Val) ? window.Chat.Val : {
    nonEmpty: s => String(s??'').trim().length>0,
    phoneIL: s => /^0\d{1,2}\d{7}$/.test(String(s??'').replace(/\D/g,'')),
    date: s => /^\d{4}-\d{2}-\d{2}$/.test(s),
  };
  const esc = (window.Chat && window.Chat.esc) ? window.Chat.esc
    : (s => String(s??'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));
  const FRIENDLY_ERR = 'לא הצלחנו לשלוח את הבקשה כרגע 🙁 בדקו את החיבור לאינטרנט ונסו שוב בעוד רגע.';

  // שליחה עמידה ל-GAS (ללא preflight + תמיכה ב-opaque/טקסט/JSON)
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

    // ננסה קודם JSON, ואם לא — טקסט
    const raw = await res.text();
    try { return JSON.parse(raw); } catch(e){}
    return (/ok/i.test(raw) ? { ok:true, raw } : { ok:false, raw });
  }

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

  // 1) פרטי קשר
  function step1_contact(){
    stepEl.innerHTML = `
      <div class="title-row"><h3>שיעור תגבור 👨‍🚀</h3></div>
      <p class="muted">כדי שאוכל לתאם עבורך שיעור תגבור, ארשום כמה פרטים קצרים 🧑‍🚀</p>

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
      Object.assign(State.data, { contactRole: role, firstName, lastName, phone });
      step2_branch();
    };
  }

  // 2) פיצול: הורה (פרטי תלמיד) / תלמיד (מקצוע+מסלול)
  function step2_branch(){
    const role = State.data.contactRole;

    if (role === 'הורה'){
      stepEl.innerHTML = `
        <div class="title-row"><h3>פרטי תלמיד/ה 👨‍🚀</h3><div class="muted">שלב 2/7</div></div>
        ${fieldRow({label:'שם פרטי התלמיד/ה',  name:'studentFirst', placeholder:'לדוגמה: נועה', required:true})}
        ${fieldRow({label:'שם משפחה התלמיד/ה', name:'studentLast',  placeholder:'לדוגמה: כהן', required:true})}
        <div class="wizard-actions">
          <button class="btn" id="prev">חזרה</button>
          <button class="btn primary" id="next">המשך</button>
        </div>`;
      push(step2_branch);

      el('prev').onclick = goBack;
      el('next').onclick = ()=>{
        const studentFirst = el('f_studentFirst').value.trim();
        const studentLast  = el('f_studentLast').value.trim();
        if(!Val.nonEmpty(studentFirst)) return setStatus('נא למלא שם פרטי של התלמיד/ה');
        if(!Val.nonEmpty(studentLast))  return setStatus('נא למלא שם משפחה של התלמיד/ה');
        setStatus('');
        Object.assign(State.data, { studentFirst, studentLast });
        step3_gradeUnitsTeacher();
      };
      return;
    }

    stepEl.innerHTML = `
      <div class="title-row"><h3>פרטי מסלול 👨‍🚀</h3><div class="muted">שלב 2/7</div></div>
      ${selectRow({label:'מקצוע', name:'subject', options:['מתמטיקה','אנגלית','פיזיקה','שפה','הוראה מתקנת','אנגלית מדוברת'], required:true})}
      ${chipsRow({label:'מסלול לימוד', name:'track', options:['קבוצתי','טריפל','פרטי']})}
      <div class="wizard-actions">
        <button class="btn" id="prev">חזרה</button>
        <button class="btn primary" id="next">המשך</button>
      </div>`;
    push(step2_branch);

    const getTrack = bindSingleChips('chips_track');
    el('prev').onclick = goBack;
    el('next').onclick = ()=>{
      const subject = el('f_subject').value;
      const track   = getTrack();
      if(!Val.nonEmpty(subject)) return setStatus('נא לבחור מקצוע');
      if(!Val.nonEmpty(track))   return setStatus('נא לבחור מסלול לימוד');
      setStatus('');
      Object.assign(State.data, {
        subject, track,
        studentFirst: State.data.firstName,
        studentLast:  State.data.lastName
      });
      step3_gradeUnitsTeacher();
    };
  }

  // 3) כיתה / יחידות (אם צריך) / מורה (רשות)
  function step3_gradeUnitsTeacher(){
    stepEl.innerHTML = `
      <div class="title-row"><h3>כיתה, יחידות, מורה 👨‍🚀</h3><div class="muted">שלב 3/7</div></div>
      ${selectRow({label:'כיתה', name:'grade', options:['א׳','ב׳','ג׳','ד׳','ה׳','ו׳','ז׳','ח׳','ט׳','י׳','י״א','י״ב','סטודנט'], required:true})}
      <div id="unitsWrap" style="display:none">
        ${chipsRow({label:'יחידות (לכיתות י/י״א/י״ב)', name:'units', options:['3','4','5']})}
      </div>
      ${fieldRow({label:'שם המורה במרכז בראונשטיין (רשות)', name:'teacher', placeholder:'לדוגמה: לירז', required:false})}
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
      const needUnits = ['י׳','י״א','י״ב'].includes(grade);
      const units  = needUnits ? getUnits() : '';
      const teacher= el('f_teacher').value.trim(); // רשות
      if(!Val.nonEmpty(grade))   return setStatus('נא לבחור כיתה');
      if(needUnits && !Val.nonEmpty(units)) return setStatus('נא לבחור מספר יחידות');
      setStatus('');
      Object.assign(State.data, { grade, units, teacher });
      step4_availability();
    };
  }

  // 4) זמינות (תאריך + טווח שעות; אפשר כמה)
  function step4_availability(){
    const optHtml = ['<option value="">— בחרו טווח —</option>']
      .concat(RANGES.map((r,i)=>`<option value="${i}">${r.label}</option>`)).join('');
    const chosen = State.data.slots || [];

    stepEl.innerHTML = `
      <div class="title-row"><h3>זמינות לשיעור 👨‍🚀</h3><div class="muted">שלב 4/7</div></div>
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
        <div class="meta">לחיצה על מועד מוחקת אותו מהרשימה</div>
      </div>

      <div class="wizard-actions">
        <button class="btn" id="prev">חזרה</button>
        <button class="btn primary" id="next">המשך</button>
      </div>`;
    push(step4_availability);

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
      if(!Val.date(date))         return setStatus('נא לבחור תאריך');
      if(String(idx)==='')        return setStatus('נא לבחור טווח שעות');
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
      step5_rate();
    };
  }

  // 5) תעריף — שאלה מפורשת
  function step5_rate(){
    stepEl.innerHTML = `
      <div class="title-row"><h3>בחירת מסלול/תעריף 👨‍🚀</h3><div class="muted">שלב 5/7</div></div>
      <p>איזה מסלול תרצה/תרצי?</p>
      ${chipsRow({label:'תעריף', name:'rate', options:[
        'מסלול קבוצתי 70₪','מסלול זוגי 90₪','מסלול פרטי 160₪'
      ]})}
      <div class="wizard-actions">
        <button class="btn" id="prev">חזרה</button>
        <button class="btn primary" id="next">המשך</button>
      </div>`;
    push(step5_rate);

    const getRate = bindSingleChips('chips_rate');

    el('prev').onclick = goBack;
    el('next').onclick = ()=>{
      const rate  = getRate();
      if(!Val.nonEmpty(rate)) return setStatus('נא לבחור תעריף');
      setStatus('');
      Object.assign(State.data, { rate });
      step6_notes();
    };
  }

  // 6) הערות — רשות
  function step6_notes(){
    stepEl.innerHTML = `
      <div class="title-row"><h3>הערות למזכירות (רשות) 👨‍🚀</h3><div class="muted">שלב 6/7</div></div>
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

  // 7) סיכום ושליחה
  function step7_summary(){
    const d = State.data;
    const rows = [
      ['מי ממלא', d.contactRole],
      ['שם יוצר קשר', `${d.firstName||''} ${d.lastName||''}`.trim()],
      ['טלפון', d.phone||''],
      ['שם התלמיד/ה', `${d.studentFirst||''} ${d.studentLast||''}`.trim()],
      ...(d.subject ? [['מקצוע', d.subject]] : []),
      ...(d.track   ? [['מסלול לימוד', d.track]] : []),
      ['כיתה', d.grade||''],
      ...(d.units ? [['יחידות', d.units]]:[]),
      ...(d.teacher ? [['שם המורה', d.teacher]]:[]),
      ['מועדים שנבחרו', (d.slots||[]).map(s=>`${s.date} ${s.from}-${s.to}`).join(' | ')],
      ['תעריף', d.rate||''],
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
    if(!Val.nonEmpty(d.contactRole)) errs.push('מי ממלא');
    if(!Val.nonEmpty(d.firstName))   errs.push('שם פרטי');
    if(!Val.nonEmpty(d.lastName))    errs.push('שם משפחה');
    if(!Val.phoneIL(d.phone))        errs.push('טלפון');

    if(d.contactRole === 'הורה'){
      if(!Val.nonEmpty(d.studentFirst)) errs.push('שם פרטי התלמיד/ה');
      if(!Val.nonEmpty(d.studentLast))  errs.push('שם משפחה התלמיד/ה');
    } else {
      if(!Val.nonEmpty(d.subject)) errs.push('מקצוע');
      if(!Val.nonEmpty(d.track))   errs.push('מסלול');
      if(!Val.nonEmpty(d.studentFirst)) errs.push('שם פרטי התלמיד/ה');
      if(!Val.nonEmpty(d.studentLast))  errs.push('שם משפחה התלמיד/ה');
    }

    if(!Val.nonEmpty(d.grade)) errs.push('כיתה');
    if(['י׳','י״א','י״ב'].includes(d.grade||'') && !Val.nonEmpty(d.units)) errs.push('יחידות');
    if(!Array.isArray(d.slots) || !d.slots.length) errs.push('מועדים');
    if(!Val.nonEmpty(d.rate)) errs.push('תעריף');

    if(errs.length) return setStatus('חסר או לא תקין: ' + errs.join(', '));

    const payload = {
      flow: 'boost',
      createdAt: new Date().toISOString(),
      project: (window.APP_CONFIG||{}).PROJECT || 'Houston',
      status: 'לטיפול',
      // יוצר קשר
      contactRole: d.contactRole, firstName: d.firstName, lastName: d.lastName, phone: d.phone,
      // תלמיד
      studentFirst: d.studentFirst, studentLast: d.studentLast,
      // לימודים
      subject: d.subject || '', track: d.track || '',
      grade: d.grade, units: d.units || '', teacher: d.teacher || '',
      // זמינות
      slots: d.slots.map(s=>({date:s.date, from:s.from, to:s.to})),
      // תעריף + הערות
      rate: d.rate, notes: d.notes || ''
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
          <div class="bubble ok">תודה ${esc(fname)} ✅ הבקשה לשיעור תגבור נקלטה. המזכירות תחזור אליכם לתיאום בהקדם.</div>
          <div class="wizard-actions">
            <button class="btn" onclick="location.href='../../index.html'">חזרה לתפריט הראשי</button>
          </div>`;
        backBtn.disabled = true;
        State.stack = [stepEl.innerHTML];
      }else{
        // אם קיבלנו טקסט בלי ok מפורש
        throw new Error(res && res.raw ? res.raw : 'server_error');
      }
    }catch(err){
      console.error('[Houston] boost submit failed:', err?.message || err);
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