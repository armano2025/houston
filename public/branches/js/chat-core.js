/* /public/branches/js/chat-core.js
   ליבת צ'אט כללית: מצב/היסטוריה, עזרי UI, ולידציות, רכיבי טופס, ושליחה ל-Google Sheets.
   חשוב: אין כאן שלבים ספציפיים לזרימה (לא מקצוע/תעריף/כיתה וכו'). כל זה ב-Flow ייעודי. */

(() => {
  // ===== DOM =====
  const area    = document.getElementById('area');
  const backBtn = document.getElementById('backBtn');
  const status  = document.getElementById('statusBox');

  // ===== State + History =====
  const State = { history: [], data: {}, token: 0 };
  const last  = () => State.history[State.history.length - 1];
  const push  = (fn) => { State.history.push(fn); updateBack(); };
  const goBack = () => {
    if (State.history.length > 1) {
      State.history.pop();
      updateBack();
      State.token++;
      last()();
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
  function botText(text){ return bubble(String(text), 'bot'); }
  function botHTML(html){ return bubble(html, 'bot'); }
  function userBubble(html){ return bubble(html, 'user'); }
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
  function button(text, onclick, className='btn'){
    const row = document.createElement('div');
    row.className = 'row';
    const b = document.createElement('button');
    b.type = 'button'; b.className = className; b.textContent = text;
    b.onclick = onclick;
    const wrap = document.createElement('div');
    wrap.className = 'bubble user';
    row.appendChild(b); wrap.appendChild(row); area.appendChild(wrap);
    autoscroll();
    return b;
  }
  function chip(text){
    const el = document.createElement('span');
    el.className = 'chip';
    el.textContent = text;
    return el;
  }
  function summaryCard(rows){
    const card = document.createElement('div');
    card.className = 'bubble user';
    const inner = document.createElement('div');
    inner.className = 'summary';
    inner.innerHTML = rows.map(([k,v]) => `<div><strong>${k}:</strong> ${v||'-'}</div>`).join('');
    card.appendChild(inner);
    area.appendChild(card);
    autoscroll();
    return card;
  }
  function inlineError(msg, focusEl){
    setStatus(msg);
    if (focusEl && focusEl.focus) { focusEl.focus(); }
  }
  function showProcessing(text='מעבד…'){
    const row = bubble(`<div class="meta">${text}</div>`, 'bot');
    return () => { row.remove(); };
  }

  // ===== Validators =====
  const Val = {
    nonEmpty: (s) => String(s ?? '').trim().length > 0,
    phoneIL: (s) => /^0\d{1,2}\d{7}$/.test(String(s ?? '').replace(/\D/g,'')), // 0509570866
    date: (s) => /^\d{4}-\d{2}-\d{2}$/.test(s),
    time: (s) => /^\d{2}:\d{2}$/.test(s),
  };

  // ===== UI builders (HTML strings) =====
  function fieldRow({label, name, type='text', placeholder='', value='', required=false, help='', id}) {
    const _id = id || `f_${name}`;
    return `
      <div class="field">
        <label for="${_id}">${label}${required ? ' *' : ''}</label>
        <input id="${_id}" name="${name}" type="${type}" placeholder="${placeholder}" value="${value}"/>
        ${help ? `<div class="meta">${help}</div>` : ''}
      </div>`;
  }
  function selectRow({label, name, options=[], required=false, help='', id}) {
    const _id = id || `f_${name}`;
    const opts = options.map(o => {
      const [val, text] = Array.isArray(o) ? o : [o, o];
      return `<option value="${String(val)}">${String(text)}</option>`;
    }).join('');
    return `
      <div class="field">
        <label for="${_id}">${label}${required ? ' *' : ''}</label>
        <select id="${_id}" name="${name}">
          <option value="">— בחרו —</option>
          ${opts}
        </select>
        ${help ? `<div class="meta">${help}</div>` : ''}
      </div>`;
  }
  function chipRow({label, name, options=[], multi=false, id}) {
    const chips = options.map((t)=>`<button type="button" class="chip" data-name="${name}" data-value="${t}" aria-pressed="false">${t}</button>`).join('');
    const attrId = id ? ` id="${id}"` : '';
    return `
      <div class="field">
        <label>${label}</label>
        <div class="chips"${attrId} data-multi="${multi?'1':'0'}">${chips}</div>
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

  // ===== API helpers =====
  function getApi(){
    const fromCfg = (window.APP_CONFIG||{}).SHEET_API_URL || '';
    const fromLS  = localStorage.getItem('houston_sheet_api_url') || '';
    return fromCfg || fromLS || '';
  }
  async function sendLeadToSheet(payload){
    const url = getApi();
    if (!url) throw new Error('SHEET_API_URL לא הוגדר (אין Webhook).');

    const res = await fetch(url, {
      method: 'POST',
      // text/plain כדי לא לעורר preflight; Apps Script יקרא e.postData.contents
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      mode: 'cors',
      redirect: 'follow',
      keepalive: true
    });

    if (res.type === 'opaque') return { ok: true, opaque: true };
    if (!res.ok) {
      const text = await res.text().catch(()=> '');
      throw new Error(`HTTP ${res.status} ${res.statusText}${text ? ` — ${text.slice(0,140)}` : ''}`);
    }
    const data = await res.json().catch(()=> ({}));
    return data;
  }

  // ===== Prompts גנריים לשימוש בזרימות =====
  // פרטי קשר בסיסיים
  function askContact(init={}){
    return new Promise((resolve)=>{
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
        setStatus('פרטי קשר התקבלו');
        push(() => { clear(); askContact(State.data); });
        resolve({ ...v });
      }, { once:true });

      document.getElementById('cancelBtn').onclick = ()=> { location.href='../../index.html'; };
    });
  }

  // שדה טקסט חופשי/הודעה (עם אפשרות דילוג)
  function askFreeMessage({ titleHtml, messageLabel='הודעה', messagePlaceholder='', requireMessage=false, nextText='המשך', includeNotes=false, showBack=true } = {}){
    return new Promise((resolve)=>{
      const token = ++State.token;
      if (titleHtml) botHTML(titleHtml);

      const html = `
        <form id="freeMsgForm" class="bubble user">
          <div class="field">
            <label for="free_msg">${messageLabel}${requireMessage?' *':''}</label>
            <textarea id="free_msg" name="message" rows="3" placeholder="${messagePlaceholder||''}"></textarea>
          </div>
          <div class="row" style="margin-top:8px">
            ${showBack ? '<button class="btn" type="button" id="backBtnMsg">חזרה</button>' : ''}
            ${!requireMessage ? '<button class="btn" type="button" id="skipMsg">דלג</button>' : ''}
            <button class="btn primary" type="submit" id="okMsg">'+(nextText||'המשך')+'</button>
          </div>
        </form>`;
      area.insertAdjacentHTML('beforeend', html);
      autoscroll();

      const form = document.getElementById('freeMsgForm');
      if (showBack) document.getElementById('backBtnMsg').onclick = ()=> goBack();
      if (!requireMessage) document.getElementById('skipMsg').onclick = ()=> done('');

      form.addEventListener('submit',(ev)=>{
        ev.preventDefault();
        const v = Object.fromEntries(new FormData(form).entries());
        if (requireMessage && !Val.nonEmpty(v.message)) return inlineError('נא למלא הודעה', form.querySelector('#free_msg'));
        done((v.message||'').trim());
      }, { once:true });

      function done(message){
        if (token !== State.token) return;
        const out = { message };
        if (includeNotes) out.notes = message;
        push(()=>{ clear(); askFreeMessage({ titleHtml, messageLabel, messagePlaceholder, requireMessage, nextText, includeNotes, showBack }); });
        resolve(out);
      }
    });
  }

  // בחירת מועדים (צירוף תאריך + שעה אחת או טווח שעות), עם דרישת מינימום ואפשרות Back
  function askDateTimeSlots({
    titleHtml,
    dateLabel='תאריך',
    timeLabel='שעה',
    minToday=false,
    requireAtLeast=1,
    times=[],            // אם לא ריק – מוצג select של שעות מהמערך
    continueText='המשך',
    allowBack=true
  } = {}){
    return new Promise((resolve)=>{
      const token = ++State.token;
      if (titleHtml) botHTML(titleHtml);

      const timeField = times.length
        ? `<label>${timeLabel}</label><select id="ads_time" name="time">${['','',...times].map((t,i)=> i?`<option value="${t}">${t}</option>`:'<option value="">—</option>').join('')}</select>`
        : `${fieldRow({label:timeLabel, name:'time', type:'time', required:true, id:'ads_time'})}`;

      const html = `
        <div class="bubble user" id="ads_wrap">
          <form id="ads_form" class="field">
            ${fieldRow({label:dateLabel, name:'date', type:'date', required:true, id:'ads_date'})}
            <div class="row">${timeField}</div>
            <div class="row" style="margin-top:8px">
              <button class="btn" type="button" id="ads_add">+ הוסף מועד</button>
              <button class="btn ghost" type="button" id="ads_clear">נקה</button>
            </div>
          </form>
          <div class="field">
            <label>מועדים שנבחרו</label>
            <div id="ads_list" style="display:flex;gap:6px;flex-wrap:wrap"></div>
            <div class="meta">${requireAtLeast>0?'נדרש לפחות '+requireAtLeast+' מועד':''}</div>
          </div>
          <div class="row" style="margin-top:8px">
            ${allowBack ? '<button class="btn" type="button" id="ads_back">חזרה</button>' : ''}
            <button class="btn primary" type="button" id="ads_next">${continueText}</button>
          </div>
        </div>`;
      area.insertAdjacentHTML('beforeend', html);
      autoscroll();

      const list = document.getElementById('ads_list');
      const form = document.getElementById('ads_form');
      const dateEl= document.getElementById('ads_date');
      const timeEl= document.getElementById('ads_time');
      const slots = [];

      function redraw(){
        list.innerHTML = '';
        slots.forEach((s, idx)=>{
          const b = document.createElement('button');
          b.type='button'; b.className='chip';
          b.textContent = s.label || `${s.date} ${s.time}`;
          b.title='הסר'; b.onclick = ()=>{ slots.splice(idx,1); redraw(); };
          list.appendChild(b);
        });
      }

      function addSlot(){
        const date = dateEl.value;
        const time = timeEl.value;
        if (!Val.date(date)) return inlineError('בחר/י תאריך תקין', dateEl);
        if (!Val.time(time) && !times.includes(time)) return inlineError('בחר/י שעה תקינה', timeEl);
        if (minToday && date < new Date().toISOString().slice(0,10)) return inlineError('בחר/י תאריך עתידי', dateEl);
        slots.push({ date, time, label: `${date} ${time}` });
        form.reset(); redraw();
      }

      document.getElementById('ads_add').onclick = addSlot;
      document.getElementById('ads_clear').onclick = ()=>{ slots.length = 0; redraw(); };
      if (allowBack) document.getElementById('ads_back').onclick = ()=> goBack();
      document.getElementById('ads_next').onclick = ()=>{
        if (requireAtLeast > 0 && slots.length < requireAtLeast) return inlineError('נדרש לפחות מועד אחד');
        if (token !== State.token) return;
        push(()=>{ clear(); askDateTimeSlots({ titleHtml, dateLabel, timeLabel, minToday, requireAtLeast, times, continueText, allowBack }); });
        resolve({ slots });
      };
    });
  }

  // ===== Public API =====
  const Chat = {
    // state
    State,
    // core
    clear, autoscroll, setStatus, bubble, botText, botHTML, userBubble, typing, push, goBack, last,
    // ui extras
    button, chip, summaryCard, inlineError, showProcessing,
    // validators
    Val,
    // builders (גם נחשפים גלובלית לנוחות בזרימות)
    fieldRow, selectRow, chipRow, onChips, getChipValues,
    // api
    sendLeadToSheet,
    // prompts
    askContact, askFreeMessage, askDateTimeSlots,
  };

  // נחשוף גם כעזרי גלובל לחלוקה בקבצי זרימה
  window.Chat = Chat;
  window.fieldRow = fieldRow;
  window.selectRow = selectRow;
  window.chipRow = chipRow;
  window.onChips = onChips;
})();