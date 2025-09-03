/* /public/branches/js/flows/makeup.js
   זרימת "שיעור השלמה (Makeup)" לצ'אט: פרטי קשר → פרטי שיעור → שם מורה → מועדים חלופיים (08:00–22:00, שעות עגולות,
   עם אפשרות דילוג) → הערות → סיכום → שליחה ל-Google Sheets. מתבסס על chat-core הגנרי. */

console.info('[makeup.js] loaded');

window.Flows = window.Flows || {};
window.Flows.Makeup = (() => {
  // 08:00..22:00 שעות עגולות בלבד
  const HOURS = Array.from({ length: 15 }, (_, i) => String(i + 8).padStart(2, '0') + ':00');

  const area = document.getElementById('area');
  const { fieldRow, selectRow, chipRow, onChips } = window;

  function run() {
    console.info('[makeup] run()');
    Chat.clear();
    Chat.setStatus('מוכן');
    Chat.bubble('היי, אשמח לעזור לך לתאם שיעור השלמה 👨‍🚀<br/>נתחיל מפרטי קשר קצרצרים:');
    Chat.push(() => { Chat.clear(); run(); });
    stepContact();
  }

  /* שלב 1: פרטי קשר */
  function stepContact() {
    Chat.askContact().then(() => {
      Chat.push(() => { Chat.clear(); stepContact(); });
      stepLessonDetails();
    });
  }

  /* שלב 2: פרטי שיעור – תלמיד/מקצוע/מסלול/כיתה/יחידות/מועד שהוחמץ/סיבה */
  function stepLessonDetails() {
    const token = ++Chat.State.token;
    const name = (Chat.State.data.firstName || '').trim() || '🙂';
    Chat.bubble(`בכיף ${name}, אשמח לעזור לך לתאם שיעור השלמה 👨‍🚀<br/>נרשום כמה פרטים על השיעור שהוחמץ ✏️`);

    const grades   = ['א׳','ב׳','ג׳','ד׳','ה׳','ו׳','ז׳','ח׳','ט׳','י׳','י״א','י״ב','סטודנט'];
    const subjects = ['מתמטיקה','אנגלית','פיזיקה','שפה','הוראה מתקנת','אנגלית מדוברת'];
    const tracks   = ['קבוצתי','טריפל','פרטי'];

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

    const form       = document.getElementById('detailsForm');
    const cancelBtn  = document.getElementById('cancelBtn');
    const gradeSel   = document.getElementById('f_grade');
    const unitsWrap  = document.getElementById('unitsWrap');
    const chipsUnits = document.getElementById('chips_units');
    const chipsTrack = document.getElementById('chips_track');

    cancelBtn.onclick = () => { location.href = 'index.html'; };

    // הצגת יחידות רק לי/י״א/י״ב
    function toggleUnits() {
      const g = (gradeSel.value || '').replace(/"/g, '');
      const need = ['י׳','י״א','י״ב'].includes(g);
      unitsWrap.hidden = !need;
    }
    gradeSel.addEventListener('change', toggleUnits);
    toggleUnits();

    let trackPicked = '';
    onChips(chipsTrack, (vals) => trackPicked = vals[0] || '');
    let unitsPicked = '';
    onChips(chipsUnits, (vals) => unitsPicked = vals[0] || '');

    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      if (token !== Chat.State.token) return;
      const v = Object.fromEntries(new FormData(form).entries());
      const needUnits = ['י׳','י״א','י״ב'].includes(v.grade || '');

      if (!Chat.Val.nonEmpty(v.studentName))  return Chat.setStatus('נא למלא שם תלמיד/ה');
      if (!Chat.Val.nonEmpty(v.subject))      return Chat.setStatus('נא לבחור מקצוע');
      if (!Chat.Val.nonEmpty(v.grade))        return Chat.setStatus('נא לבחור כיתה');
      if (needUnits && !unitsPicked)          return Chat.setStatus('נא לבחור מספר יחידות');
      if (!Chat.Val.date(v.missedDate))       return Chat.setStatus('אנא בחרו תאריך תקין');
      if (!HOURS.includes(v.missedTime || ''))return Chat.setStatus('אנא בחרו שעה עגולה בין 08:00–22:00');
      if (!Chat.Val.nonEmpty(v.reason))       return Chat.setStatus('אנא בחרו סיבת החמצה');

      Chat.State.data = {
        ...Chat.State.data,
        studentName: v.studentName.trim(),
        subject: v.subject,
        track: trackPicked || '',
        grade: v.grade,
        units: needUnits ? (unitsPicked || '') : '',
        missedDate: v.missedDate,
        missedTime: v.missedTime,
        reason: v.reason
      };

      Chat.push(() => { Chat.clear(); stepLessonDetails(); });
      stepTeacher();
    }, { once: true });
  }

  /* שלב 3: שם המורה (טקסט חופשי) */
  function stepTeacher() {
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

    document.getElementById('backBtn2').onclick = () => Chat.goBack?.();

    document.getElementById('teacherForm').addEventListener('submit', (ev) => {
      ev.preventDefault();
      if (token !== Chat.State.token) return;
      const v = Object.fromEntries(new FormData(ev.currentTarget).entries());
      if (!Chat.Val.nonEmpty(v.teacher)) return Chat.setStatus('נא למלא שם מורה');

      Chat.State.data.teacher = v.teacher.trim();
      Chat.push(() => { Chat.clear(); stepTeacher(); });
      stepDesiredSlots();
    }, { once: true });
  }

  /* שלב 4: מועדים חלופיים — שימוש ב־askDateTimeSlots (עם שעות עגולות ויכולת דילוג) */
  function stepDesiredSlots() {
    Chat.push(() => { Chat.clear(); stepDesiredSlots(); });

    // מציגים בחירת מועדים עם רשימת שעות מוגדרת, ללא דרישת מינימום (דילוג אפשרי).
    Chat.askDateTimeSlots({
      titleHtml:
        'תודה! עכשיו נבחר ימים ושעות שנוחים להשלמה.<br>' +
        '<span class="muted">כדאי לבחור כמה אפשרויות 👨‍🚀</span>',
      dateLabel: 'תאריך להשלמה',
      timeLabel: 'שעה',
      minToday: true,
      requireAtLeast: 0,     // מאפשר דילוג
      times: HOURS,
      continueText: 'המשך',
      allowBack: true
    }).then(({ slots } = {}) => {
      const list = Array.isArray(slots) ? slots : [];
      if (list.length === 0) {
        Chat.State.data.desiredPreference = 'אין העדפה';
        Chat.State.data.desiredSlots = [];
      } else {
        Chat.State.data.desiredPreference = 'יש העדפות';
        // המרה לפורמט from–to של שעה יחידה (שעה-שעה+1) או נשמור כשעה יחידה כ-from=to
        Chat.State.data.desiredSlots = list.map(s => ({ date: s.date, from: s.time, to: s.time }));
      }
      stepNotes();
    });
  }

  /* שלב 5: הערות (רשות) */
  function stepNotes() {
    Chat.askFreeMessage({
      titleHtml: 'רוצים להוסיף הערות למזכירות? (רשות) 👨‍🚀',
      messageLabel: 'הערות',
      messagePlaceholder: 'העדפות, אילוצים, פרטים שיעזרו לנו',
      requireMessage: false,
      nextText: 'המשך',
      includeNotes: true,
      showBack: true
    }).then(({ notes } = {}) => {
      Chat.State.data.notes = notes || '';
      stepSummary();
    });
  }

  /* שלב 6: סיכום ושליחה */
  function stepSummary() {
    Chat.clear();
    const d = Chat.State.data;

    Chat.bubble('<strong>סיכום הבקשה</strong><br><span class="meta">בדקו שהכול נכון לפני שליחה.</span>');
    const rows = [
      ['שם מלא', `${d.firstName || ''} ${d.lastName || ''}`.trim()],
      ['טלפון', d.phone || ''],
      ['שם התלמיד/ה', d.studentName || ''],
      ['מקצוע', d.subject || ''],
      ['מסלול', d.track || ''],
      ['כיתה', d.grade || ''],
      ...(d.units ? [['יחידות', d.units]] : []),
      ['מורה', d.teacher || ''],
      ['השיעור שהוחמץ', `${d.missedDate || ''} • ${d.missedTime || ''}`.trim()],
      ['סיבת ההחמצה', d.reason || ''],
      ...(d.desiredSlots?.length
        ? [['מועדים להשלמה', d.desiredSlots.map(s => `${s.date} ${s.from}-${s.to}`).join(' | ')]]
        : [['מועדים להשלמה', d.desiredPreference || 'אין העדפה']]),
      ...(d.notes ? [['הערות', d.notes]] : [])
    ];

    const html = `
      <div class="bubble user" id="sumCard">
        <div class="summary">
          ${rows.map(([k, v]) => `<div><strong>${k}:</strong> ${v || '-'}</div>`).join('')}
        </div>
        <div class="row" style="margin-top:10px">
          <button class="btn" id="editBtn">עריכה</button>
          <button class="btn primary" id="sendBtn">אישור ושליחה למזכירות 📤</button>
        </div>
      </div>`;
    area.insertAdjacentHTML('beforeend', html);
    Chat.autoscroll?.();

    document.getElementById('editBtn').onclick = () => Chat.goBack?.();
    document.getElementById('sendBtn').onclick = submit;
  }

  async function submit() {
    const d = Chat.State.data;

    // בדיקות אחרונות
    const errs = [];
    if (!Chat.Val.nonEmpty(d.firstName)) errs.push('first');
    if (!Chat.Val.nonEmpty(d.lastName))  errs.push('last');
    if (!Chat.Val.phoneIL(d.phone))      errs.push('phone');
    if (!Chat.Val.nonEmpty(d.studentName)) errs.push('student');
    if (!Chat.Val.nonEmpty(d.subject))     errs.push('subject');
    if (!Chat.Val.nonEmpty(d.grade))       errs.push('grade');
    if (['י׳','י״א','י״ב'].includes(d.grade || '') && !Chat.Val.nonEmpty(d.units)) errs.push('units');
    if (!Chat.Val.date(d.missedDate))      errs.push('missedDate');
    if (!HOURS.includes(d.missedTime || '')) errs.push('missedTime');
    if (!Chat.Val.nonEmpty(d.reason))      errs.push('reason');

    if (errs.length) {
      Chat.setStatus('חסר/לא תקין: ' + errs.join(', '));
      return;
    }

    const payload = {
      flow: 'makeup',
      createdAt: new Date().toISOString(),
      project: (window.APP_CONFIG || {}).PROJECT || 'Houston',
      status: 'לטיפול',
      // מזדהה
      firstName: d.firstName, lastName: d.lastName, phone: d.phone,
      // פרטי שיעור
      studentName: d.studentName, subject: d.subject, track: d.track || '',
      grade: d.grade, units: d.units || '', teacher: d.teacher || '',
      // החמצה
      missedDate: d.missedDate, missedTime: d.missedTime, reason: d.reason,
      // זמינות להשלמה
      desiredPreference: d.desiredPreference || (d.desiredSlots?.length ? 'יש העדפות' : 'אין העדפה'),
      slots: (d.desiredSlots || []).map(s => ({ date: s.date, from: s.from, to: s.to })),
      // הערות
      notes: d.notes || ''
    };

    try {
      Chat.setStatus('שולח ל־Google Sheets…');
      const res = await (window.sendLeadToSheet ? window.sendLeadToSheet(payload) : Chat.sendLeadToSheet(payload));
      if (res && res.ok) {
        Chat.clear();
        const fname = (d.firstName || '').trim() || '🙂';
        Chat.bubble(`היי ${fname}, בקשת ההשלמה נקלטה ✅<br/>ניצור קשר לתיאום מועד מתאים 👨‍🚀`).classList?.add?.('ok');
        const row = document.createElement('div'); row.className = 'bubble user';
        const home = document.createElement('button'); home.className = 'btn'; home.textContent = 'חזרה לתפריט מנוי/ה';
        home.onclick = () => location.href = 'index.html';
        row.appendChild(home); area.appendChild(row);
      } else {
        throw new Error((res && res.error) || 'server_error');
      }
    } catch (err) {
      Chat.bubble('לא הצלחנו לשמור את הבקשה ❌ ניתן לנסות שוב או לחזור לתיקונים.').classList?.add?.('err');
      const row = document.createElement('div'); row.className = 'bubble user';
      const tryBtn = document.createElement('button'); tryBtn.className = 'btn primary'; tryBtn.textContent = 'לנסות שוב'; tryBtn.onclick = submit;
      const editBtn = document.createElement('button'); editBtn.className = 'btn'; editBtn.style.marginInlineStart = '8px'; editBtn.textContent = 'עריכה'; editBtn.onclick = () => Chat.goBack?.();
      row.appendChild(tryBtn); row.appendChild(editBtn); area.appendChild(row);
      Chat.setStatus('שגיאה: ' + err.message);
    }
  }

  return { run };
})();