/* /public/branches/js/chat-core.js
   ליבת עזר ל־Front-End: ולידציה בסיסית + שליחה ל־Google Apps Script.
   שומרת על ממשק אחיד: Chat.Val ול־Chat.sendLeadToSheet.
*/
(() => {
  const area    = document.getElementById('area');
  const backBtn = document.getElementById('backBtn');
  const status  = document.getElementById('statusBox');

  const State = { history: [], data: {}, token: 0 };
  const last  = () => State.history[State.history.length - 1];
  const push  = (fn) => { State.history.push(fn); updateBack(); };
  const goBack = () => { if (State.history.length > 1) { State.history.pop(); updateBack(); State.token++; last()(); } };
  function updateBack(){ if (backBtn) backBtn.disabled = State.history.length <= 1; }
  if (backBtn) backBtn.onclick = goBack;

  function clear(){ State.token++; if (area) area.innerHTML=''; }
  function autoscroll(){ if (area) area.scrollTo?.({ top: area.scrollHeight, behavior: 'smooth' }); }
  function setStatus(msg){ if (status) status.textContent = msg; }
  function bubble(html, who='bot'){ if (!area) return null; const el=document.createElement('div'); el.className=`bubble ${who}`; el.innerHTML=html; area.appendChild(el); autoscroll(); return el; }

  const Val = {
    nonEmpty: (s) => String(s ?? '').trim().length > 0,
    phoneIL: (s) => /^0\d{1,2}\d{7}$/.test(String(s ?? '').replace(/\D/g,'')),
    date:     (s) => /^\d{4}-\d{2}-\d{2}$/.test(s),
    time:     (s) => /^\d{2}:\d{2}$/.test(s),
  };

  function getApi(){
    const fromCfg = (window.APP_CONFIG||{}).SHEET_API_URL || '';
    const fromLS  = localStorage.getItem('houston_sheet_api_url') || '';
    return fromCfg || fromLS || '';
  }

  async function sendLeadToSheet(payload){
    const base = getApi();
    if (!base) throw new Error('SHEET_API_URL חסר (Webhook לא מוגדר).');
    const url = base + (base.includes('?') ? '&' : '?') + 'origin=' + encodeURIComponent(location.origin);

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // text/plain → בלי preflight
      body: JSON.stringify(payload),
      mode: 'cors',
      redirect: 'follow',
      keepalive: true
    });

    let rawText = '';
    try { rawText = await res.text(); } catch(_) {}

    let data = {};
    try { data = rawText ? JSON.parse(rawText) : {}; } catch(e){ /* ignore */ }

    if (!res.ok || data?.ok !== true){
      const msg = data?.error || `HTTP ${res.status} ${res.statusText}` + (rawText ? ` — ${rawText.slice(0,180)}` : '');
      console.error('[Sheets Error]', { url, status:res.status, rawText, data, payload });
      throw new Error(msg);
    }

    // לוג זעיר לזיהוי טאב היעד (מופיע ב־DevTools בלבד)
    if (data.sheet) console.info('[Sheets OK]', { flow: payload.flow, sheet: data.sheet, caseId: data.caseId });

    return data; // { ok:true, caseId, sheet, ... }
  }

  window.Chat = { State, clear, autoscroll, setStatus, bubble, push, goBack, last, Val, sendLeadToSheet };
})();
