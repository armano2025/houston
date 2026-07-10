/* /public/branches/js/chat-core.js
   ליבת עזר ל־Front-End: ולידציה + שליחה ל־Google Apps Script.
   שליחה כ-text/plain (ללא preflight CORS) ופענוח תשובה גם אם אינה JSON תקין. */
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

  // בריחת HTML – למניעת הזרקת תגיות דרך קלט משתמש שמוצג ב-innerHTML
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g,
    (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

  const Val = {
    nonEmpty: (s) => String(s ?? '').trim().length > 0,
    phoneIL: (s) => /^0\d{1,2}\d{7}$/.test(String(s ?? '').replace(/\D/g,'')),
    date:     (s) => /^\d{4}-\d{2}-\d{2}$/.test(s),
    time:     (s) => /^\d{2}:\d{2}$/.test(s),
  };

  function getApi(){
    return (window.APP_CONFIG || {}).SHEET_API_URL || '';
  }

  async function sendLeadToSheet(payload){
    const base = getApi();
    if (!base) throw new Error('missing_endpoint');
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
      // לוג טכני ללא פרטים אישיים (ללא payload)
      console.error('[Houston] submit failed', { flow: payload?.flow, status: res.status, error: data?.error || rawText.slice(0, 120) });
      throw new Error(data?.error || ('HTTP ' + res.status));
    }

    return data; // { ok:true, caseId, sheet, ... }
  }

  window.Chat = { State, clear, autoscroll, setStatus, bubble, push, goBack, last, Val, esc, sendLeadToSheet };
})();
