/* /public/branches/js/flows/billing.js */
window.BillingWizard = (() => {
  const $ = (id) => document.getElementById(id);
  const stepEl = $('step'), backBtn = $('backBtn'), statusEl = $('statusBox');
  const State = { data:{}, stack:[] };
  const setStatus = (t='') => { if(statusEl) statusEl.textContent = t; };
  const push = (fn)=>{ State.stack.push(fn); backBtn.disabled = State.stack.length<=1; };
  const goBack = ()=>{ if(State.stack.length>1){ State.stack.pop(); backBtn.disabled = State.stack.length<=1; State.stack.at(-1)(); } };
  backBtn && (backBtn.onclick = goBack);

  const Val  = (window.Chat && window.Chat.Val) ? window.Chat.Val : {
    nonEmpty: s => String(s??'').trim().length>0,
    phoneIL : s => /^0\d{1,2}\d{7}$/.test(String(s??'').replace(/\D/g,'')),
  };
  const send = (payload) => (window.Chat?.sendLeadToSheet
    ? window.Chat.sendLeadToSheet(payload)
    : fetch((window.APP_CONFIG||{}).SHEET_API_URL, {
        method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'},
        body: JSON.stringify(payload)
      }).then(r=>r.json()));

  const fieldRow = ({label, name, type='text', placeholder='', value='', required=false})=>`
    <div class="field"><label for="f_${name}">${label}${required?' *':''}</label>
    <input id="f_${name}" name="${name}" type="${type}" placeholder="${placeholder}" value="${value||''}" ${required?'required':''}/></div>`;
  const chipsRow = ({label, name, options=[]})=>{
    const chips = options.map(t=>`<button type="button" class="chip" data-name="${name}" data-value="${t}" aria-pressed="false">${t}</button>`).join('');
    return `<div class="field"><label>${label}</label><div class="chips role" id="chips_${name}">${chips}</div></div>`;
  };
  const bindSingleChips = (id)=>{
    const cont = $(id); let picked='';
    cont.addEventListener('click', ev=>{
      const b = ev.target.closest('.chip'); if(!b) return;
      [...cont.querySelectorAll('.chip[aria-pressed="true"]')].forEach(x=>x.setAttribute('aria-pressed','false'));
      b.setAttribute('aria-pressed', b.getAttribute('aria-pressed')==='true'?'false':'true');
      picked = b.getAttribute('aria-pressed')==='true' ? b.dataset.value : '';
    });
    return ()=> picked;
  };

  /* === שלבים === */

  // 1) הזדהות אחידה
  function step1(){
    stepEl.innerHTML = `
      <div class="title-row"><h3>עדכון תשלום 👨‍🚀</h3><div class="muted">שלב 1/3</div></div>
      ${chipsRow({label:'עם מי אנחנו מדברים?', name:'role', options:['תלמיד','הורה']})}
      ${fieldRow({label:'שם פרטי', name:'firstName', placeholder:'לדוגמה: חן', required:true})}
      ${fieldRow({label:'שם משפחה', name:'lastName', placeholder:'לדוגמה: בראונשטיין', required:true})}
      ${fieldRow({label:'טלפון', name:'phone', type:'tel', placeholder:'05XXXXXXXX', required:true})}
      <div class="wizard-actions"><button class="btn primary" id="next">המשך</button></div>`;
    push(step1);
    const getRole = bindSingleChips('chips_role');
    $('next').onclick = ()=>{
      const role=$('chips_role')?getRole():'';
      const firstName=$('f_firstName').value.trim();
      const lastName