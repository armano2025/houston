// /branches/js/flows/makeup.js
// זרימת "שיעור השלמה (Makeup)" לצ'אט: פרטי קשר → פרטי שיעור → מורה → מועד שהוחמץ → סיבה → מועדים חלופיים (שעות עגולות בלבד 08:00–22:00, עם אפשרות דילוג) → הערות → סיכום → שליחה.

window.Flows = window.Flows || {};
window.Flows.Makeup = (() => {
  const HOURS = Array.from({length: 15}, (_,i)=> String(i+8).padStart(2,'0') + ':00'); // 08:00..22:00

  function run(){
    Chat.clear();
    Chat.setStatus('מוכן');
    Chat.bubble('היי, אשמח לעזור לך לתאם שיעור השלמה 👨‍🚀<br/>נתחיל מפרטי קשר קצרצרים:');
    Chat.push(()=> { Chat.clear(); run(); });
    stepContact();
  }

  /* שלב 1: פרטי קשר */
  function stepContact(){
    Chat.askContact().then(()=>{
      Chat.push(()=> { Chat.clear(); stepContact(); });
      stepLessonDetails();
    });
  }

  /* שלב 2: פרטי שיעור – תלמיד/מקצוע/מסלול/כיתה/יחידות */
  function stepLessonDetails(){
    const token = ++Chat.State.token;
    const name = (Chat.State.data.firstName||'').trim() || '';
    Chat.bubble(`בכיף ${name||'🙂'}, אשמח לעזור לך לתאם שיעור השלמה 👨‍🚀<br/>נרשום כמה פרטים על השיעור שהוחמץ ✏️`);

    const grades = ['א׳','ב׳','ג׳','ד׳','ה׳','ו׳','ז׳','ח׳','ט׳','י׳','י״א','י״ב','סטודנט'];
    const subjects = ['מתמטיקה','אנגלית','פיזיקה','שפה','הוראה מתקנת','אנגלית מדוברת'];
    const tracks = ['קבוצתי','טריפל','פרטי'];

    const html = `
      <form id="detailsForm" class="bubble user" novalidate>
        ${fieldRow({label:'שם התלמיד/ה *', name:'studentName', placeholder:'לדוגמה: נועה כהן', required:true})}
        ${selectRow({label:'מקצוע *', name:'subject', options:subjects, required:true})}
        ${chipRow({label:'מסלול למידה', name:'track', options:tracks, multi:false, id:'chips_track'})}
        <div class="row" style="margin-top:6px">
          <div style="flex:1">${selectRow({label:'כיתה *', name:'grade', options:grades, required:true})}</div>
          <div style="flex:1" id="unitsWrap" hidden>
            ${chipRow({label:'יחידות (לכיתות י/י״א/י״ב) *', name:'units', options:['3','4','5'], multi:false, id:'chips_units'})}
          </div>
        </div>
        <div class="row" style="margin-top:6px">
          <div style="flex:1">${fieldRow({label:'תאריך השיעור שהוחמץ *', name:'missedDate', type:'date', required:true})}</div>
          <div style="flex:1">${selectRow({label:'שעה *', name:'missedTime', options:HOURS, required:true})}</div>
        </div>
        <div class="field">
          <label for="reasonSel">סיבת ההחמצה *</label>
          <select id="reasonSel" name="reason" required>
            <option value="">— בחרו —</option>
            <option>אנחנו ביטלנו</option>
            <option>אתם ביטלתם</option>
          </select>
        </div>
        <div class="row" style="margin-top:10px">
          <button class="btn" type="button" id="cancelBtn">ביטול</button>
          <button class="btn primary" type="submit">המשך</button>
        </div>
      </form>`;
    area.insertAdjacentHTML('beforeend', html);
    Chat.autoscroll?.();

    const form = document.getElementById('detailsForm');
    const gradeSel = document.getElementById('f_grade');
    const unitsWrap = document.getElementById('unitsWrap');
    const chipsUnits = document.getElementById('chips_units');
    const chipsTrack = document.getElementById('chips_track');

    // הצגת יחידות רק לי/י״א/י״ב
    function toggleUnits(){
      const g = (gradeSel.value||'').replace(/"/g,'');
      const need = ['י׳','י״א','י״ב'].includes(g);
      unitsWrap.hidden = !need;
    }
    gradeSel.addEventListener('change', toggleUnits);
    toggleUnits();

    // חיוג צ׳יפים
    let trackPicked = '';
    onChips(chipsTrack, (vals)=> trackPicked = vals[0] || '');
    let unitsPicked = '';
    onChips(chipsUnits, (vals)=> unitsPicked = vals[0] || '');

    form.addEventListener('submit', (ev)=>{
      ev.preventDefault();
      if (token !== Chat.State.token) return;

      const v = Object.fromEntries(new FormData(form).entries());
      const needUnits = ['י׳','י״א','י״ב'].includes(v.grade||'');

      if (!Chat.Val.nonEmpty(v.studentName))  return Chat.setStatus('נא למלא שם תלמיד/ה');
      if (!Chat.Val.nonEmpty(v.subject))      return Chat.setStatus('נא לבחור מקצוע');
      if (!Chat.Val.nonEmpty(v.grade))        return Chat.setStatus('נא לבחור כיתה');
      if (needUnits && !unitsPicked)          return Chat.setStatus('נא לבחור מספר יחידות');
      if (!Chat.Val.date(v.missedDate))       return Chat.setStatus('אנא בחרו תאריך תקין');
      if (!HOURS.includes(v.missedTime||''))  return Chat.setStatus('אנא בחרו שעה עגולה בין 08:00–22:00');
      if (!Chat.Val.nonEmpty(v.reason))       return Chat.setStatus('אנא בחרו סיבת החמצה');

      Chat.State.data = {
        ...Chat.State.data,
        studentName: v.studentName.trim(),
        subject: v.subject,
        track: trackPicked || '',
        grade: v.grade,
        units: needUnits ? (unitsPicked||'') : '',
        missedDate: v.missedDate,
        missedTime: v.missedTime,
        reason: v.reason
      };

      document.getElementById('cancelBtn').onclick = ()=> location.href='index.html';
      Chat.push(()=> { Chat.clear(); stepLessonDetails(); });
      stepTeacher();
    }, { once:true });

    document.getElementById('cancelBtn').onclick = ()=> location.href='index.html';
  }

  /* שלב 3: שם המורה (טקסט חופשי) */
  function stepTeacher(){
    const token = ++Chat.State.token;
    Chat.bubble('ולמי מהמורים במרכז הלמידה היה השיעור? 👨‍🏫');

    const html = `
      <form id="teacherForm" class="bubble user" novalidate>
        ${fieldRow({label:'שם המורה *', name:'teacher', placeholder:'לדוגמה: לירז', required:true})}
        <div class="row" style="margin-top:10px">
          <button class="btn" type="button" id="backBtn2">חזרה</button>
          <button class="btn primary" type="submit">המשך</button>
        </div>
      </form>`;
    area.insertAdjacentHTML('beforeend', html);
    Chat.autoscroll?.();

    const form = document.getElementById('teacherForm');
    document.getElementById('backBtn2').onclick = ()=> Chat.goBack?.();

    form.addEventListener('submit',(ev)=>{
      ev.preventDefault();
      if (token !== Chat.State.token) return;
      const v = Object.fromEntries(new FormData(form).entries());
      if (!Chat.Val.nonEmpty(v.teacher)) return Chat.setStatus('נא למלא שם מורה');

      Chat.State.data.teacher = v.teacher.trim();
      Chat.push(()=> { Chat.clear(); stepTeacher(); });
      stepDesiredSlots();
    }, { once:true });
  }

  /* שלב 4: מועדים חלופיים – שעות עגולות בלבד + אפשרות דילוג */
  function stepDesiredSlots(){
    const token = ++Chat.State.token;
    Chat.State.data.desiredSlots = Chat.State.data.desiredSlots || [];
    Chat.bubble('תודה, עכשיו נבחר ימים וטווחי שעות שנוחים להשלמה.<br/>כדאי לבחור כמה שיותר אפשרויות 👨‍🚀');

    const hourOpts = HOURS.map(h=>`<option value="${h}">${h}</option>`).join('');
    const html = `
      <div id="desiredStep" class="bubble user">
        <form id="slotForm" class="field">
          ${fieldRow({label:'תאריך להשלמה', name:'date', type:'date', required:true})}
          <div class="row">
            <div style="flex:1">
              <label for="fromSel">משעה</label>
              <select id="fromSel" name="from" required>
                <option value="">—</option>${hourOpts}
              </select>
            </div>
            <div style="flex:1">
              <label for="toSel">עד שעה</label>
              <select id="toSel" name="to" required>
                <option value="">—</option>${hourOpts}
              </select>
            </div>
          </div>
          <div class="row" style="margin-top:8px">
            <button class="btn" type="button" id="addSlot">+ הוסף מועד</button>
            <button class="btn ghost" type="button" id="skipNow">דלג כרגע</button>
          </div>
        </form>

        <div class="field">
          <label>מועדים שנבחרו</label>
          <div id="slotList" style="display:flex;gap:6px;flex-wrap:wrap"></div>
          <div class="meta">ניתן להסיר מועד בלחיצה עליו</div>
        </div>

        <div class="row" style="margin-top:8px">
          <button class="btn" type="button" id="backBtn3">חזרה</button>
          <button class="btn primary" type="button" id="nextSlots">המשך</button>
        </div>
      </div>`;
    area.insertAdjacentHTML('beforeend', html);
    Chat.autoscroll?.();

    const list = document.getElementById('slotList');
    const form = document.getElementById('slotForm');

    function redraw(){
      list.innerHTML = '';
      Chat.State.data.desiredSlots.forEach((s, idx)=>{
        const b = document.createElement('button');
        b.type='button'; b.className='chip';
        b.textContent = `${s.date} • ${s.from}-${s.to}`;
        b.title='הסר מועד'; b.onclick = ()=>{ Chat.State.data.desiredSlots.splice(idx,1); redraw(); };
        list.appendChild(b);
      });
    }
    redraw();

    document.getElementById('addSlot').onclick = ()=>{
      const v = Object.fromEntries(new FormData(form).entries());
      if (!Chat.Val.date(v.date)) return Chat.setStatus('יש לבחור תאריך תקין');
      if (!HOURS.includes(v.from||'') || !HOURS.includes(v.to||'')) return Chat.setStatus('יש לבחור שעות עגולות 08:00–22:00');
      if (v.to <= v.from) return Chat.setStatus('טווח שעות לא תקין (עד שעה אחרי משעה)');
      Chat.State.data.desiredSlots.push({ date:v.date, from:v.from, to:v.to });
      form.reset();
      redraw();
    };

    document.getElementById('skipNow').onclick = ()=>{
      Chat.State.data.desiredSlots = [];
      Chat.State.data.desiredPreference = 'אין העדפה';
      if (token !== Chat.State.token) return;
      Chat.push(()=> { Chat.clear(); stepDesiredSlots(); });
      stepNotes();
    };

    document.getElementById('nextSlots').onclick = ()=>{
      if (token !== Chat.State.token) return;
      if (!Chat.State.data.desiredSlots.length){
        // לא דילג ולא הוסיף → נדרוש לפחות מועד אחד
        return Chat.setStatus('בחר/י לפחות מועד אחד להשלמה או דלג/י כרגע');
      }
      Chat.State.data.desiredPreference = 'יש העדפות';
      Chat.push(()=> { Chat.clear(); stepDesiredSlots(); });
      stepNotes();
    };

    document.getElementById('backBtn3').onclick = ()=> Chat.goBack?.();
  }

  /* שלב 5: הערות (רשות) */
  function stepNotes(){
    const token = ++Chat.State.token;
    Chat.bubble('רוצים להוסיף הערות למזכירות? (לא חובה) 👨‍🚀');

    const html = `
      <form id="notesForm" class="bubble user">
        <div class="field">
          <label for="notes">הערות</label>
          <textarea id="notes" name="notes" rows="3" placeholder="העדפות, אילוצים, פרטים שיעזרו לנו"></textarea>
        </div>
        <div class="row" style="margin-top:8px">
          <button class="btn" type="button" id="skipNotes">דלג</button>
          <button class="btn primary" type="submit">המשך</button>
        </div>
      </form>`;
    area.insertAdjacentHTML('beforeend', html);
    Chat.autoscroll?.();

    document.getElementById('skipNotes').onclick = ()=> done('');
    document.getElementById('notesForm').addEventListener('submit',(ev)=>{
      ev.preventDefault();
      const v = Object.fromEntries(new FormData(ev.currentTarget).entries());
      done((v.notes||'').trim());
    }, { once:true });

    function done(notes){
      if (token !== Chat.State.token) return;
      Chat.State.data.notes = notes;
      Chat.push(()=> { Chat.clear(); stepNotes(); });
      stepSummary();
    }
  }

  /* שלב 6: סיכום ושליחה */
  function stepSummary(){
    Chat.clear();
    const d = Chat.State.data;
    const name = (d.firstName||'').trim() || 'שם פרטי';

    Chat.bubble('<strong>סיכום הבקשה</strong><br><span class="meta">בדקו שהכול נכון לפני שליחה.</span>');
    const rows = [
      ['שם מלא', `${d.firstName||''} ${d.lastName||''}`.trim()],
      ['טלפון', d.phone||''],
      ['שם התלמיד/ה', d.studentName||''],
      ['מקצוע', d.subject||''],
      ['מסלול', d.track||''],
      ['כיתה', d.grade||''],
      ...(d.units ? [['יחידות', d.units]] : []),
      ['מורה', d.teacher||''],
      ['השיעור שהוחמץ', `${d.missedDate||''} • ${d.missedTime||''}`.trim()],
      ['סיבת ההחמצה', d.reason||''],
      ...(d.desiredSlots?.length ? [['מועדים להשלמה', d.desiredSlots.map(s=>`${s.date} ${s.from}-${s.to}`).join(' | ')]] : [['מועדים להשלמה', d.desiredPreference||'אין העדפה']]),
      ...(d.notes ? [['הערות', d.notes]] : [])
    ];
    const html = `
      <div class="bubble user" id="sumCard">
        <div class="summary">
          ${rows.map(([k,v]) => `<div><strong>${k}:</strong> ${v||'-'}</div>`).join('')}
        </div>
        <div class="row" style="margin-top:10px">
          <button class="btn" id="editBtn">עריכה</button>
          <button class="btn primary" id="sendBtn">אישור ושליחה למזכירות 📤</button>
        </div>
      </div>`;
    area.insertAdjacentHTML('beforeend', html);
    Chat.autoscroll?.();

    document.getElementById('editBtn').onclick = ()=> Chat.goBack?.();
    document.getElementById('sendBtn').onclick = submit;
  }

  async function submit(){
    const d = Chat.State.data;

    // בדיקות אחרונות
    const errs=[];
    if(!Chat.Val.nonEmpty(d.firstName)) errs.push('first');
    if(!Chat.Val.nonEmpty(d.lastName))  errs.push('last');
    if(!Chat.Val.phoneIL(d.phone))      errs.push('phone');
    if(!Chat.Val.nonEmpty(d.studentName)) errs.push('student');
    if(!Chat.Val.nonEmpty(d.subject))     errs.push('subject');
    if(!Chat.Val.nonEmpty(d.grade))       errs.push('grade');
    if(['י׳','י״א','י״ב'].includes(d.grade||'') && !Chat.Val.nonEmpty(d.units)) errs.push('units');
    if(!Chat.Val.date(d.missedDate))      errs.push('missedDate');
    if(!HOURS.includes(d.missedTime||'')) errs.push('missedTime');
    if(!Chat.Val.nonEmpty(d.reason))      errs.push('reason');
    if((d.desiredPreference||'') !== 'אין העדפה' && (!Array.isArray(d.desiredSlots) || d.desiredSlots.length===0)) errs.push('slots');

    if (errs.length){
      Chat.setStatus('חסר/לא תקין: ' + errs.join(', '));
      return;
    }

    const payload = {
      flow: 'makeup',
      createdAt: new Date().toISOString(),
      project: (window.APP_CONFIG||{}).PROJECT || 'Houston',
      // מזדהה
      firstName: d.firstName, lastName: d.lastName, phone: d.phone,
      // פרטי שיעור
      studentName: d.studentName, subject: d.subject, track: d.track||'',
      grade: d.grade, units: d.units||'',
      teacher: d.teacher||'',
      // החמצה
      missedDate: d.missedDate, missedTime: d.missedTime, reason: d.reason,
      // זמינות להשלמה
      desiredPreference: d.desiredPreference || (d.desiredSlots?.length ? 'יש העדפות' : 'אין העדפה'),
      slots: (d.desiredSlots||[]).map(s=>({ date:s.date, from:s.from, to:s.to })),
      // הערות
      notes: d.notes || ''
    };

    try{
      Chat.setStatus('שולח ל־Google Sheets…');
      const res = await (window.sendLeadToSheet ? window.sendLeadToSheet(payload) : Chat.sendLeadToSheet(payload));
      if (res && res.ok){
        Chat.clear();
        Chat.bubble(`היי ${ (d.firstName||'').trim() || '🙂' }, בקשת ההשלמה נקלטה ✅<br/>ניצור קשר לתיאום מועד מתאים 👨‍🚀`).classList?.add?.('ok');
        const home = document.createElement('button');
        home.className = 'btn'; home.textContent = 'חזרה לתפריט מנוי/ה';
        home.onclick = ()=> location.href='index.html';
        const wrap = document.createElement('div'); wrap.className='bubble user'; wrap.appendChild(home);
        area.appendChild(wrap);
      } else {
        throw new Error((res && res.error) || 'server_error');
      }
    } catch(err){
      Chat.bubble('לא הצלחנו לשמור את הבקשה ❌ ניתן לנסות שוב או לחזור לתיקונים.').classList?.add?.('err');
      const row = document.createElement('div'); row.className='bubble user';
      const tryBtn = document.createElement('button'); tryBtn.className='btn primary'; tryBtn.textContent='לנסות שוב'; tryBtn.onclick = submit;
      const editBtn= document.createElement('button'); editBtn.className='btn'; editBtn.style.marginInlineStart='8px'; editBtn.textContent='עריכה'; editBtn.onclick = ()=> Chat.goBack?.();
      row.appendChild(tryBtn); row.appendChild(editBtn); area.appendChild(row);
      Chat.setStatus('שגיאה: ' + err.message);
    }
  }

  // קיצור לשימוש פנימי של ה-UI builders מהליבה
  const area = document.getElementById('area');
  const { fieldRow, selectRow, chipRow, onChips } = window;

  return { run };
})();