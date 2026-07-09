/* /public/branches/js/flows/cancel.js
   וויזארד "ביטול מנוי (Cancel)" – ללא צ'אט:
   שלבים (עד 3 שדות למסך) לפי התסריט המאושר:
   1) זהות פותח הבקשה 👨‍🚀 — תפקיד (תלמיד/הורה), שם פרטי, שם משפחה, טלפון
   2) פרטי המנוי 👨‍🚀 — אם הורה: שם פרטי/משפחה של התלמיד; לכולם: מקצוע (חובה), מורה (רשות)
   3) סיבת הביטול 👨‍🚀 — בחירה מרובה צ'יפים: קשיי תשלום / אין צורך / חוסר שביעות רצון מהמורה /
      חוסר שביעות רצון מקבוצת הלמידה / חוסר שביעות רצון מצוות הניהול / אחר (פותח טקסט חופשי, לא חובה)
   4) תוקף הביטול 👨‍🚀 — תאריך יעד להפסקה (חובה) או צ'יפ "מיידי"
   5) הערות נוספות 👨‍🚀 — טקסט חופשי (רשות)
   6) סיכום ושליחה 👨‍🚀 — כרטיס סיכום + שליחה. status תמיד "לטיפול".
   שליחה ל-GAS ב-text/plain (ללא preflight). */

window.CancelWizard = (() => {
  const el = (id) => document.getElementById(id);
  const stepEl = el('step');
  const backBtn = el('backBtn');
  const statusEl = el('statusBox');

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

  // ולידציה+שליחה מ-chat-core (fallbackים אם לא נטען)
  const Val = (window.Chat && window.Chat.Val) ? window.Chat.Val : {
    nonEmpty: s => String(s??'').trim().length>0,
    phoneIL: s => /^0\d{1,2}\d{7}$/.test(String(s??'').replace(/[^\d]/g,'')),
    date: s => /^\d{4}-\d{2}-\d{2}$/.test(s),
  };
  const esc = (window.Chat && window.Chat.esc) ? window.Chat.esc
    : (s => String(s??'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));
  const FRIENDLY_ERR = 'לא הצלחנו לשלוח את הבקשה כרגע 🙁 בדקו את החיבור לאינטרנט ונסו שוב בעוד רגע.';
  const send = (payload) => (window.Chat?.sendLeadToSheet
    ? window.Chat.sendLeadToSheet(payload)
    : fetch((window.APP_CONFIG||{}).SHEET_API_URL, {
        method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'},
        body: JSON.stringify(payload)
      }).then(r=>r.json()));

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
  const chipsRow = ({label, name, options=[], multi=false})=>{
    const chips = options
      .map(t=>`<button type="button" class="chip" data-name="${name}" data-value="${t}" aria-pressed="false">${t}</button>`)
      .join('');
    return `
      <div class="field">
        <label>${label}</label>
        <div class="chips" id="chips_${name}" data-multi="${multi?'1':'0'}">${chips}</div>
      </div>`;
  };
  const bindChips = (id) => {
    const cont = el(id);
    let picked = [];
    cont.addEventListener('click', (ev)=>{
      const b = ev.target.closest('.chip'); if(!b) return;
      const multi = cont.dataset.multi === '1';
      if (!multi){
        [...cont.querySelectorAll('.chip[aria-pressed="true"]')].forEach(x=>x.setAttribute('aria-pressed','false'));
      }
      const newVal = b.getAttribute('aria-pressed')!=='true';
      b.setAttribute('aria-pressed', newVal ? 'true':'false');
      const vals = [...cont.querySelectorAll('.chip[aria-pressed="true"]')].map(x=>x.dataset.value);
      picked = vals;
    });
    return ()=> picked.slice();
  };

  /* ===== שלבים ===== */

  // 1) זהות פותח הבקשה
  function step1_contact(){
    stepEl.innerHTML = `
      <div class="title-row"><h3>ביטול מנוי 👨‍🚀</h3><div class="muted">שלב 1/6</div></div>
      <p class="meta">חבל לשמוע! נרשום כמה פרטים כדי שנוכל לטפל בבקשה 🧑‍🚀</p>
      ${chipsRow({label:'עם מי אני מדבר?', name:'role', options:['תלמיד','הורה'], multi:false})}
      ${fieldRow({label:'שם פרטי',  name:'firstName', placeholder:'לדוגמה: חן', required:true})}
      ${fieldRow({label:'שם משפחה', name:'lastName',  placeholder:'לדוגמה: בראונשטיין', required:true})}
      ${fieldRow({label:'טלפון',     name:'phone',     placeholder:'05XXXXXXXX', type:'tel', required:true})}
      <div class="wizard-actions">
        <button class="btn primary" id="next">המשך</button>
      </div>`;
    push(step1_contact);

    const getRole = bindChips('chips_role');

    el('next').onclick = ()=>{
      const role      = (getRole()[0]||'').trim();
      const firstName = el('f_firstName').value.trim();
      const lastName  = el('f_lastName').value.trim();
      const phone     = el('f_phone').value.replace(/[^\d]/g,'');
      if(!Val.nonEmpty(role))      return setStatus('נא לבחור עם מי אני מדבר');
      if(!Val.nonEmpty(firstName)) return setStatus('נא למלא שם פרטי');
      if(!Val.nonEmpty(lastName))  return setStatus('נא למלא שם משפחה');
      if(!Val.phoneIL(phone))      return setStatus('טלפון לא תקין');
      setStatus('');
      Object.assign(State.data, { role, firstName, lastName, phone });
      step2_subscription();
    };
  }

  // 2) פרטי המנוי (שם תלמיד אם הורה) + מקצוע + מורה
  function step2_subscription(){
    const subjects = ['מתמטיקה','אנגלית','פיזיקה','שפה','הוראה מתקנת','אנגלית מדוברת'];
    const isParent = State.data.role === 'הורה';

    stepEl.innerHTML = `
      <div class="title-row"><h3>פרטי המנוי 👨‍🚀</h3><div class="muted">שלב 2/6</div></div>
      ${isParent ? `
        ${fieldRow({label:'שם פרטי התלמיד/ה', name:'studentFirst', placeholder:'לדוגמה: נועה', required:true})}
        ${fieldRow({label:'שם משפחה התלמיד/ה', name:'studentLast', placeholder:'לדוגמה: כהן', required:true})}
      ` : ''}
      ${selectRow({label:'מקצוע הלמידה', name:'subject', options:subjects, required:true})}
      ${fieldRow({label:'שם המורה (רשות)', name:'teacher', placeholder:'לדוגמה: לירז', required:false})}
      <div class="wizard-actions">
        <button class="btn" id="prev">חזרה</button>
        <button class="btn primary" id="next">המשך</button>
      </div>`;
    push(step2_subscription);

    el('prev').onclick = goBack;
    el('next').onclick = ()=>{
      const subject = el('f_subject').value;
      const teacher = (el('f_teacher')?.value||'').trim();

      if(!Val.nonEmpty(subject)) return setStatus('נא לבחור מקצוע');

      if(isParent){
        const studentFirst = el('f_studentFirst').value.trim();
        const studentLast  = el('f_studentLast').value.trim();
        if(!Val.nonEmpty(studentFirst)) return setStatus('נא למלא שם פרטי התלמיד/ה');
        if(!Val.nonEmpty(studentLast))  return setStatus('נא למלא שם משפחה התלמיד/ה');
        Object.assign(State.data, { studentFirst, studentLast });
      }else{
        // אם תלמיד – נשתמש בשם שלו/שלה.
        Object.assign(State.data, { studentFirst: State.data.firstName, studentLast: State.data.lastName });
      }

      Object.assign(State.data, { subject, teacher });
      setStatus('');
      step3_reasons();
    };
  }

  // 3) סיבת הביטול – בחירה מרובה + "אחר" אופציונלי
  function step3_reasons(){
    const REASONS = [
      'קשיי תשלום',
      'אין צורך',
      'חוסר שביעות רצון מהמורה',
      'חוסר שביעות רצון מקבוצת הלמידה',
      'חוסר שביעות רצון מצוות הניהול',
      'אחר'
    ];

    stepEl.innerHTML = `
      <div class="title-row"><h3>סיבת הביטול 👨‍🚀</h3><div class="muted">שלב 3/6</div></div>
      <p class="meta">תודה ${esc(State.data.firstName||'')}, אשמח לדעת מהי סיבת הביטול 👨‍🚀</p>
      ${chipsRow({label:'בחר/י סיבות (אפשר כמה)', name:'reasons', options:REASONS, multi:true})}
      <div class="field hidden" id="otherWrap">
        <label for="f_reasonOther">פירוט (רשות)</label>
        <textarea id="f_reasonOther" rows="3" placeholder="רוצה לפרט קצת יותר? זה יעזור לנו להשתפר"></textarea>
      </div>
      <div class="wizard-actions">
        <button class="btn" id="prev">חזרה</button>
        <button class="btn primary" id="next">המשך</button>
      </div>`;
    push(step3_reasons);

    const getReasons = bindChips('chips_reasons');
    const otherWrap = el('otherWrap');

    // מעקב אחרי בחירה כדי להראות/להסתיר "אחר"
    el('chips_reasons').addEventListener('click', ()=>{
      const picked = getReasons();
      const showOther = picked.includes('אחר');
      otherWrap.classList.toggle('hidden', !showOther);
    });

    el('prev').onclick = goBack;
    el('next').onclick = ()=>{
      const reasons = getReasons();
      if(!reasons.length) return setStatus('נא לבחור לפחות סיבה אחת');
      const reasonOther = reasons.includes('אחר') ? (el('f_reasonOther')?.value||'').trim() : '';
      Object.assign(State.data, { reasons, reasonOther });
      setStatus('');
      step4_effective();
    };
  }

  // 4) תוקף הביטול — תאריך יעד או "מיידי"
  function step4_effective(){
    stepEl.innerHTML = `
      <div class="title-row"><h3>מתי הביטול ייכנס לתוקף? 👨‍🚀</h3><div class="muted">שלב 4/6</div></div>
      ${fieldRow({label:'תאריך יעד להפסקה', name:'effectiveDate', type:'date', required:false})}
      ${chipsRow({label:'או', name:'effective', options:['מיידי'], multi:false})}
      <div class="wizard-actions">
        <button class="btn" id="prev">חזרה</button>
        <button class="btn primary" id="next">המשך</button>
      </div>`;
    push(step4_effective);

    const getEff = bindChips('chips_effective');
    const dateEl = el('f_effectiveDate');

    // אם בוחרים "מיידי" – ננקה תאריך כדי למנוע כפילות
    el('chips_effective').addEventListener('click', ()=>{
      const isImmediate = (getEff()[0]||'') === 'מיידי';
      if (isImmediate) dateEl.value = '';
    });

    el('prev').onclick = goBack;
    el('next').onclick = ()=>{
      const isImmediate = (getEff()[0]||'') === 'מיידי';
      const date        = dateEl.value;
      if(!isImmediate && !Val.date(date)) return setStatus('בחר/י תאריך יעד או סמן/י "מיידי"');
      Object.assign(State.data, { effective: isImmediate ? 'מיידי' : 'בתאריך', effectiveDate: isImmediate ? '' : date });
      setStatus('');
      step5_notes();
    };
  }

  // 5) הערות נוספות (רשות)
  function step5_notes(){
    stepEl.innerHTML = `
      <div class="title-row"><h3>הערות נוספות למזכירות 👨‍🚀</h3><div class="muted">שלב 5/6</div></div>
      <div class="field">
        <label for="f_notes">הערות</label>
        <textarea id="f_notes" rows="3" placeholder="כל פרט שיעזור לנו לטפל בבקשה"></textarea>
      </div>
      <div class="wizard-actions">
        <button class="btn" id="prev">חזרה</button>
        <button class="btn primary" id="next">המשך</button>
      </div>`;
    push(step5_notes);

    el('prev').onclick = goBack;
    el('next').onclick = ()=>{
      State.data.notes = (el('f_notes')?.value||'').trim();
      setStatus('');
      step6_summary();
    };
  }

  // 6) סיכום ושליחה
  function step6_summary(){
    const d = State.data;
    const rows = [
      ['עם מי מדברים', d.role],
      ['שם פרטי', d.firstName], ['שם משפחה', d.lastName], ['טלפון', d.phone],
      ['שם התלמיד/ה', `${d.studentFirst||''} ${d.studentLast||''}`.trim()],
      ['מקצוע', d.subject], ['שם המורה', d.teacher||'-'],
      ['סיבות', (d.reasons||[]).join(' | ')],
      ...(d.reasonOther ? [['פירוט נוסף', d.reasonOther]] : []),
      ['תוקף הביטול', d.effective === 'מיידי' ? 'מיידי' : `בתאריך ${d.effectiveDate}`],
      ...(d.notes ? [['הערות', d.notes]] : [])
    ];
    stepEl.innerHTML = `
      <div class="title-row"><h3>סיכום ושליחה 👨‍🚀</h3><div class="muted">שלב 6/6</div></div>
      <p class="muted">רגע לפני השליחה – כדאי לוודא שהכול נכון:</p>
      <div class="summary">${rows.map(([k,v])=>`<div><strong>${k}:</strong> ${esc(v)||'-'}</div>`).join('')}</div>
      <div class="wizard-actions">
        <button class="btn" id="prev">חזרה</button>
        <button class="btn primary" id="send">אישור ושליחה למזכירות 📤</button>
      </div>`;
    push(step6_summary);

    el('prev').onclick = goBack;
    el('send').onclick = submit;
  }

  async function submit(){
    const d = State.data, errs=[];

    // ולידציות אחרונות
    if(!Val.nonEmpty(d.role))       errs.push('מי ממלא');
    if(!Val.nonEmpty(d.firstName))  errs.push('שם פרטי');
    if(!Val.nonEmpty(d.lastName))   errs.push('שם משפחה');
    if(!Val.phoneIL(d.phone))       errs.push('טלפון');
    if(!Val.nonEmpty(d.studentFirst)) errs.push('שם פרטי התלמיד/ה'); // תלמיד = שוכפל מההורה/תלמיד
    if(!Val.nonEmpty(d.studentLast))  errs.push('שם משפחה התלמיד/ה');
    if(!Val.nonEmpty(d.subject))    errs.push('מקצוע');
    if(!Array.isArray(d.reasons) || d.reasons.length===0) errs.push('סיבת הביטול');
    if(d.effective !== 'מיידי' && !Val.date(d.effectiveDate)) errs.push('תאריך יעד');

    if(errs.length) return setStatus('חסר או לא תקין: ' + errs.join(', '));

    const payload = {
      flow: 'cancel',
      createdAt: new Date().toISOString(),
      project: (window.APP_CONFIG||{}).PROJECT || 'Houston',
      status: 'לטיפול',
      // מזהים
      role: d.role,
      firstName: d.firstName, lastName: d.lastName, phone: d.phone,
      studentFirstName: d.studentFirst, studentLastName: d.studentLast,
      // פרטי מנוי
      subject: d.subject, teacher: d.teacher||'',
      // סיבות
      reasons: d.reasons, reasonOther: d.reasonOther||'',
      // תוקף
      effective: d.effective, effectiveDate: d.effectiveDate||'',
      // הערות
      notes: d.notes||''
    };

    const sendBtn = el('send');
    try{
      if (sendBtn) sendBtn.disabled = true; // מניעת שליחה כפולה
      setStatus('שולח למזכירות…');
      const res = await send(payload);
      if(res && res.ok){
        setStatus('');
        stepEl.innerHTML = `
          <div class="bubble ok">הבקשה נקלטה ✅ המזכירות תיצור קשר להמשך הטיפול.</div>
          <div class="wizard-actions">
            <button class="btn" onclick="location.href='index.html'">חזרה לתפריט מנויים</button>
          </div>`;
        backBtn.disabled = true;
        State.stack = [stepEl.innerHTML]; // נעילה
      }else{
        throw new Error((res && res.error) || 'server_error');
      }
    }catch(err){
      console.error('[Houston] cancel submit failed:', err?.message || err);
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