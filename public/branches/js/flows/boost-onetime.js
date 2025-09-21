/* /public/branches/js/flows/boost-onetime.js
   ויזארד "שיעור חד־פעמי על בסיס מקום פנוי" – ללא צ'אט.
   חשוב: שמות השדות המועברים ל־Webhook מותאמים ל־INTAKE_HEADERS.onetime:
   - studentName / studentLastName (לא studentFirst/Last)
   - preferredDate (לא date)
   - timeRange כאובייקט {from,to} – ה־GAS ממיר למחרוזת
   - slots כמערך אובייקטים – ה־GAS מייצר slotsText לבד
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

  // ולידציה בסיסית; אם chat-core טעון – משתמשים בו כדי לשמור אחידות בין זרימות
  const Val = (window.Chat && window.Chat.Val) ? window.Chat.Val : {
    nonEmpty: s => String(s??'').trim().length>0,
    phoneIL: s => /^0\d{1,2}\d{7}$/.test(String(s??'').replace(/[^\d]/g,'')),
    date:     s => /^\d{4}-\d{2}-\d{2}$/.test(s),
  };

  // שליחה עמידה ל־GAS: ללא preflight (text/plain), תומך גם בתשובת טקסט
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

  /* ===== עזרי UI קצרים ===== */
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
      if(!Val.nonEmpty(role))      return setStatus('נא לבחור: תלמיד/הורה');
      if(!Val.nonEmpty(firstName)) return setStatus('נא למלא שם פרטי');
      if(!Val.nonEmpty(lastName))  return setStatus('נא למלא שם משפחה');
      if(!Val.phoneIL(phone))      return setStatus('טלפון לא תקין');
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
    // אם י״א/י״ב 5 יח' — אין "קבוצה"
    const isHigh5 = (['י״א','י״ב'].includes(State.data.grade) && State.data.units==='5');
    const tracks = isHigh5
      ? ['שיעור במסלול טריפל -]()
