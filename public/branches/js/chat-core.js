// /branches/js/chat-core.js
(() => {
  const cfg = window.APP_CONFIG || {};

  // ===== DOM =====
  const area    = document.getElementById('area');
  const backBtn = document.getElementById('backBtn');
  const status  = document.getElementById('statusBox');

  // ===== State + History =====
  const State = {
    history: [],
    data: {},
    token: 0,          // ביטול ריצה אסינכרונית קודמת
    autoScroll: true,
  };
  const last = () => State.history[State.history.length - 1];
  const push = (fn) => { State.history.push(fn); updateBack(); };
  const goBack = () => {
    if (State.history.length > 1) {
      State.history.pop();
      updateBack();
      State.token++;
      last()();        // מריץ את המסך הקודם מחדש
    }
  };
  function updateBack(){ if (backBtn) backBtn.disabled = State.history.length <= 1; }
  if (backBtn) backBtn.onclick = goBack;

  // ===== Utilities =====
  function clear(){ State.token++; if (area) area.innerHTML=''; }
  function autoscroll(){ if (area) area.scrollTo({ top: area.scrollHeight, behavior: 'smooth' }); }
  function setStatus(msg){ if (status) status.textContent = msg; }

  function bubble(html, who='bot'){
    const el = document.createElement('div');
    el.className = `bubble ${who}`;
    el.innerHTML = html;
    area.appendChild(el);
    autoscroll();
    return el;
  }

  function typing(on=true){
    let el = document.getElementById('typingRow');
    if (on){
      if (!el){
        el = document.createElement('div');
        el.id = 'typingRow';
        el.className = 'bubble bot';
        el.setAttribute('role','status');
        el.setAttribute('aria-live','polite');
        el.innerHTML = 'יוסטון מקליד 👨‍🚀…';
        area.appendChild(el);
      }
    } else {
      el && el.remove();
    }
    autoscroll();
  }

  // ===== Validators =====
  const Val = {
    nonEmpty: (s) => String(s ?? '').trim().length > 0,
    phoneIL: (s) => /^0\d{1,2}\d{7}$/.test(String(s ?? '').replace(/\D/g,'')), // 0509570866
    date: (s) => /^\d{4}-\d{2}-\d{2}$/.test(s),
    time: (s) => /^\d{2}:\d{2}$/.test(s),
  };

  // ===== UI builders =====
  function fieldRow({label, name, type='text', placeholder='', value='', required=false, help=''}) {
    const id = `f_${name}`;
    return `
      <div class="field">
        <label for="${id}">${label}${required ? ' *' : ''}</label>
        <input id="${id}" name="${name}" type="${type}" placeholder="${placeholder}" value="${value}"/>
        ${help ? `<div class="meta">${help}</div>` : ''}
      </div>`;
  }

  function selectRow({label, name, options=[], required=false, help=''}) {
    const id = `f_${name}`;
    const opts = options.map(o => {
      const [val, text] = Array.isArray(o) ? o : [o, o];
      return `<option value="${String(val)}">${String(text)}</option>`;
    }).join('');
    return `
      <div class="field">
        <label for="${id}">${label}${required ? ' *' : ''}</label>
        <select id="${id}" name="${name}">
          <option value="">— בחרו —</option>
          ${opts}
        </select>
        ${help ? `<div class="meta">${help}</div>` : ''}
      </div>`;
  }

  function chipRow({label, name, options=[], multi=false}){
    const chips = options.map((t,i)=>`<button type="button" class="chip" data-name="${name}" data-value="${t}" aria-pressed="false">${t}</button>`).join('');
    return `
      <div class="field">
        <label>${label}</label>
        <div class="chips" data-multi="${multi?'1':'0'}">${chips}</div>
      </div>`;
  }

  function onChips(container, onChange){
    container.addEventListener('click', (ev)=>{
      const btn = ev.target.closest('.chip');
      if (!btn) return;
      const multi = container.dataset.multi === '1';
      if (!multi){
        [...container.querySelectorAll('.chip[aria-pressed="true"]')].forEach(b => b.setAttribute('aria-pressed','false'));
      }
      btn.setAttribute('aria-pressed', btn.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
      onChange && onChange(getChipValues(container));
    });
  }
  function getChipValues(container){
    return [...container.querySelectorAll('.chip[aria-pressed="true"]')].map(b => b.dataset.value);
  }

  async function sendLeadToSheet(payload){
    if (!cfg.SHEET_API_URL || /REPLACE_WITH_YOUR_WEB_APP/.test(cfg.SHEET_API_URL)) {
      throw new Error('SHEET_API_URL לא הוגדר. יש להחליף ל־Webhook של ה־Apps Script.');
    }
    const res = await fetch(cfg.SHEET_API_URL, {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`שגיאת רשת (${res.status})`);
    const data = await res.json().catch(()=> ({}));
    return data;
  }

  // ===== Chat — composable steps =====
  const Chat = {
    clear, bubble, typing, setStatus, push, goBack, last, Val,
    async askContact(init={}){
      const token = ++State.token;
      bubble('נתחיל מפרטי קשר 👨‍🚀');
      const html = `
        <form class="bubble user" id="contactForm" novalidate>
          ${fieldRow({label:'שם פרטי', name:'firstName', placeholder:'דוגמה: דנה', value:init.firstName||'', required:true})}
          ${fieldRow({label:'שם משפחה', name:'lastName', placeholder:'דוגמה: ישראלי', value:init.lastName||'', required:true})}
          ${fieldRow({label:'טלפון', name:'phone', type:'tel', placeholder:'דוגמה: 0509570866', value:init.phone||'', required:true, help:'מספר ישראלי ללא רווחים'})}
          <div class="row">
            <button class="btn" type="button" id="cancelBtn">ביטול</button>
            <button class="btn primary" type="submit" id="okBtn">המשך</button>
          </div>
        </form>`;
      area.insertAdjacentHTML('beforeend', html);
      autoscroll();

      const form = document.getElementById('contactForm');
      form.addEventListener('submit', (ev)=>{
        ev.preventDefault();
        const v = Object.fromEntries(new FormData(form).entries());
        if (!Val.nonEmpty(v.firstName) || !Val.nonEmpty(v.lastName) || !Val.phoneIL(v.phone)){
          setStatus('בדיקה נכשלה — ודאו שמילאתם שם פרטי, שם משפחה וטלפון תקין');
          return;
        }
        if (token !== State.token) return;
        State.data = { ...State.data, ...v };
        Chat.setStatus('פרטי קשר התקבלו ✔️');
        Chat.typing(true);
        setTimeout(()=>Chat.typing(false), 400);
        runNext();
      }, { once:false });

      const cancel = document.getElementById('cancelBtn');
      cancel.onclick = ()=> { location.href='../../index.html'; };

      function runNext(){
        if (typeof Chat._afterContact === 'function') Chat._afterContact();
      }

      // מאפשר Back לחזור לכאן
      push(() => { clear(); Chat.askContact(State.data); });
    },

    async selectSubject(){
      const token = ++State.token;
      bubble('באיזה מקצוע תרצו תגבור? 👨‍🚀');
      const html = `
        <div class="bubble user">
          ${chipRow({label:'בחרו מקצוע', name:'subject', options:['מתמטיקה','אנגלית','פיזיקה','שפה','הוראה מתקנת'], multi:false})}
          <div class="row" style="margin-top:8px">
            <button class="btn primary" id="next">המשך</button>
          </div>
        </div>`;
      area.insertAdjacentHTML('beforeend', html);
      autoscroll();

      const chips = area.querySelector('.chips');
      onChips(chips);

      document.getElementById('next').onclick = ()=>{
        const picked = getChipValues(chips)[0];
        if (!picked){ setStatus('אנא בחרו מקצוע'); return; }
        if (token !== State.token) return;
        State.data.subject = picked;
        push(() => { clear(); Chat.selectSubject(); });
        runNext();
      };

      function runNext(){
        Chat.typing(true);
        setTimeout(()=>{ Chat.typing(false); Chat.selectGrade(); }, 300);
      }
    },

    async selectGrade(){
      const token = ++State.token;
      const grades = ['א׳','ב׳','ג׳','ד׳','ה׳','ו׳','ז׳','ח׳','ט׳','י׳','י״א','י״ב','סטודנט'];
      bubble('באיזו כיתה? 👨‍🚀');
      const html = `
        <div class="bubble user">
          ${selectRow({label:'כיתה', name:'grade', options:grades, required:true})}
          <div class="row" style="margin-top:8px">
            <button class="btn primary" id="next">המשך</button>
          </div>
        </div>`;
      area.insertAdjacentHTML('beforeend', html);
      autoscroll();

      document.getElementById('next').onclick = ()=>{
        const grade = (document.getElementById('f_grade')||{}).value || '';
        if (!Val.nonEmpty(grade)){ setStatus('אנא בחרו כיתה'); return; }
        if (token !== State.token) return;
        State.data.grade = grade;
        push(() => { clear(); Chat.selectGrade(); });
        if (['י׳','י״א','י״ב'].includes(grade)) {
          Chat.typing(true);
          setTimeout(()=>{ Chat.typing(false); Chat.selectUnits(); }, 250);
        } else {
          Chat.typing(true);
          setTimeout(()=>{ Chat.typing(false); Chat.selectRate(); }, 250);
        }
      };
    },

    async selectUnits(){
      const token = ++State.token;
      bubble('כמה יחידות? 👨‍🚀');
      const html = `
        <div class="bubble user">
          ${chipRow({label:'יחידות בגרות', name:'units', options:['3','4','5'], multi:false})}
          <div class="row" style="margin-top:8px">
            <button class="btn primary" id="next">המשך</button>
          </div>
        </div>`;
      area.insertAdjacentHTML('beforeend', html);
      autoscroll();

      const chips = area.querySelector('.chips');
      onChips(chips);

      document.getElementById('next').onclick = ()=>{
        const units = getChipValues(chips)[0];
        if (!units){ setStatus('אנא בחרו מספר יחידות'); return; }
        if (token !== State.token) return;
        State.data.units = units;
        push(() => { clear(); Chat.selectUnits(); });
        Chat.typing(true);
        setTimeout(()=>{ Chat.typing(false); Chat.selectRate(); }, 250);
      };
    },

    async selectRate(){
      const token = ++State.token;
      bubble('נא לבחור תעריף תגבור 👨‍🚀');
      const html = `
        <div class="bubble user">
          ${chipRow({label:'תעריף', name:'rate', options:['70₪','90₪','160₪'], multi:false})}
          <div class="row" style="margin-top:8px">
            <button class="btn primary" id="next">המשך</button>
          </div>
        </div>`;
      area.insertAdjacentHTML('beforeend', html);
      autoscroll();

      const chips = area.querySelector('.chips');
      onChips(chips);

      document.getElementById('next').onclick = ()=>{
        const rate = getChipValues(chips)[0];
        if (!rate){ setStatus('אנא בחרו תעריף'); return; }
        if (token !== State.token) return;
        State.data.rate = rate;
        push(() => { clear(); Chat.selectRate(); });
        Chat.typing(true);
        setTimeout(()=>{ Chat.typing(false); Chat.askSlots(); }, 250);
      };
    },

    async askSlots(){
      const token = ++State.token;
      State.data.slots = State.data.slots || [];
      bubble('בחרו תאריכים וטווחי שעות מועדפים 👨‍🚀 (ניתן להוסיף כמה)');
      render();

      push(() => { clear(); Chat.askSlots(); });

      function render(){
        const html = `
          <div class="bubble user" id="slotsBox">
            <form id="slotForm" class="field">
              ${fieldRow({label:'תאריך', name:'date', type:'date', required:true})}
              <div class="row">
                ${fieldRow({label:'משעה', name:'from', type:'time', required:true})}
                ${fieldRow({label:'עד שעה', name:'to', type:'time', required:true})}
              </div>
              <div class="row">
                <button class="btn" type="button" id="addSlot">הוסף מועד</button>
                <button class="btn ghost" type="button" id="clearAll">נקה הכל</button>
              </div>
            </form>

            <div class="field">
              <label>מועדים שנבחרו</label>
              <div class="slot-preview" id="slotList" style="display:flex; gap:6px; flex-wrap:wrap"></div>
              <div class="meta">יש לבחור לפחות מועד אחד כדי להתקדם</div>
            </div>

            <div class="row" style="margin-top:8px">
              <button class="btn primary" type="button" id="next">המשך</button>
            </div>
          </div>`;
        area.insertAdjacentHTML('beforeend', html);
        autoscroll();

        const list = document.getElementById('slotList');
        const add  = document.getElementById('addSlot');
        const clr  = document.getElementById('clearAll');
        const form = document.getElementById('slotForm');

        function redraw(){
          list.innerHTML = '';
          State.data.slots.forEach((s, idx)=>{
            const b = document.createElement('button');
            b.type='button';
            b.className='chip';
            b.textContent = `${s.date} • ${s.from}–${s.to}`;
            b.title='הסר';
            b.onclick = ()=>{ State.data.slots.splice(idx,1); redraw(); };
            list.appendChild(b);
          });
        }
        redraw();

        add.onclick = ()=>{
          const v = Object.fromEntries(new FormData(form).entries());
          if (!Val.date(v.date) || !Val.time(v.from) || !Val.time(v.to)){
            setStatus('יש למלא תאריך וזמני "משעה" ו"עד שעה"');
            return;
          }
          if (v.to <= v.from){
            setStatus('טווח שעות לא תקין');
            return;
          }
          State.data.slots.push({ date:v.date, from:v.from, to:v.to });
          form.reset();
          redraw();
        };

        clr.onclick = ()=>{ State.data.slots.length = 0; redraw(); };

        document.getElementById('next').onclick = ()=>{
          if (!State.data.slots.length){ setStatus('יש להוסיף לפחות מועד אחד'); return; }
          if (token !== State.token) return;
          Chat.typing(true);
          setTimeout(()=>{ Chat.typing(false); Chat.askStudentName(); }, 250);
        };
      }
    },

    async askStudentName(){
      const token = ++State.token;
      bubble('שם התלמיד/ה ✏️');
      const html = `
        <form class="bubble user" id="studentForm" novalidate>
          ${fieldRow({label:'שם התלמיד/ה', name:'studentName', placeholder:'דוגמה: נועה כהן', required:true})}
          <div class="row">
            <button class="btn primary" type="submit">המשך</button>
          </div>
        </form>`;
      area.insertAdjacentHTML('beforeend', html);
      autoscroll();

      document.getElementById('studentForm').addEventListener('submit', (ev)=>{
        ev.preventDefault();
        const v = Object.fromEntries(new FormData(ev.currentTarget).entries());
        if (!Val.nonEmpty(v.studentName)){ setStatus('נא למלא שם תלמיד/ה'); return; }
        if (token !== State.token) return;
        State.data.studentName = v.studentName;
        push(() => { clear(); Chat.askStudentName(); });
        Chat.typing(true);
        setTimeout(()=>{ Chat.typing(false); Chat.askFreeMessage(); }, 250);
      }, { once:true });
    },

    async askFreeMessage(){
      const token = ++State.token;
      bubble('רוצים לצרף הערות למזכירות? (לא חובה) 👨‍🚀');
      const html = `
        <form class="bubble user" id="notesForm">
          <div class="field">
            <label for="f_notes">הערות</label>
            <textarea id="f_notes" name="notes" rows="3" placeholder="העדפות, רקע, קשיים, או כל דבר שרלוונטי"></textarea>
          </div>
          <div class="row">
            <button class="btn" type="button" id="skip">דלג</button>
            <button class="btn primary" type="submit">המשך</button>
          </div>
        </form>`;
      area.insertAdjacentHTML('beforeend', html);
      autoscroll();

      const form = document.getElementById('notesForm');
      document.getElementById('skip').onclick = ()=> done('');
      form.addEventListener('submit', (ev)=>{
        ev.preventDefault();
        const v = Object.fromEntries(new FormData(form).entries());
        done(v.notes||'');
      }, { once:true });

      function done(notes){
        if (token !== State.token) return;
        State.data.notes = notes;
        push(() => { clear(); Chat.askFreeMessage(); });
        Chat.typing(true);
        setTimeout(()=>{ Chat.typing(false); Chat.summary(); }, 250);
      }
    },

    async summary(){
      const d = State.data;
      const rows = [
        ['שם פרטי', d.firstName],
        ['שם משפחה', d.lastName],
        ['טלפון', d.phone],
        ['מקצוע', d.subject],
        ['כיתה', d.grade],
        ...(d.units ? [['יחידות', d.units]] : []),
        ['תעריף', d.rate],
        ['תלמיד/ה', d.studentName],
        ['מועדים', (d.slots||[]).map(s=>`${s.date} ${s.from}-${s.to}`).join(' | ')],
        ...(d.notes ? [['הערות', d.notes]] : []),
      ];
      const html = `
        <div class="bubble bot">
          <strong>סיכום בקשה 👨‍🚀</strong>
          <div class="meta">אנא אשרו לפני שליחה</div>
        </div>
        <div class="bubble user" id="sum">
          <div class="summary">
            ${rows.map(([k,v]) => `<div><strong>${k}:</strong> ${v||'-'}</div>`).join('')}
          </div>
          <div class="row" style="margin-top:10px">
            <button class="btn" id="edit">חזרה לתיקונים</button>
            <button class="btn primary" id="send">שליחה</button>
          </div>
        </div>`;
      area.insertAdjacentHTML('beforeend', html);
      autoscroll();

      document.getElementById('edit').onclick = ()=> goBack();
      document.getElementById('send').onclick = async ()=>{
        try {
          setStatus('שולח ל־Google Sheets…');
          const payload = {
            flow: 'boost',
            createdAt: new Date().toISOString(),
            project: (window.APP_CONFIG||{}).PROJECT || 'Houston',
            ...State.data,
          };
          const res = await sendLeadToSheet(payload);
          setStatus('נשלח בהצלחה ✔️');
          bubble(`<div class="notice success">הבקשה נקלטה! נחזור אליכם בהקדם 🙏</div>`);
        } catch (err){
          setStatus('שגיאה בשליחה');
          bubble(`<div class="notice danger">לא הצלחנו לשלוח כרגע: ${err.message}</div>`);
        }
      };
      push(() => { clear(); Chat.summary(); });
    },

    // Flow runner
    runFlow: async (fn) => {
      clear();
      setStatus('מוכן 🙂');
      await fn();
    }
  };

  window.Chat = Chat;
})();