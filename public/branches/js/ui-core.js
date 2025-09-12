/* /public/js/ui-core.js – Rev 2025.03
   • אחידות לחיצה (pressed + ripple) ל- .btn, .tile, .chip
   • תיקון viewport לאייפון: מבטל זום־אין/אאוט ע"י maximum-scale=1
   • לא נוגע בלוגיקה של הצ'יפים שלכם – רק UX
*/
(function(){
  // 1) ודא viewport ללא זום (אם חסר בעמודים ישנים)
  const meta = document.querySelector('meta[name="viewport"]');
  if(meta){
    const c = meta.getAttribute('content') || '';
    if(!/maximum-scale/i.test(c)){
      meta.setAttribute('content', c.replace(/\s+/g,'') ? (c + ', maximum-scale=1') : 'width=device-width, initial-scale=1, maximum-scale=1');
    }
  }else{
    const m = document.createElement('meta');
    m.name = 'viewport';
    m.content = 'width=device-width, initial-scale=1, maximum-scale=1';
    document.head.appendChild(m);
  }

  // 2) הוסף לחצן "pressable" לכל אלמנט רלוונטי
  function markPressables(){
    document.querySelectorAll('.btn, .tile, .chip').forEach(el=>{
      el.classList.add('pressable');
    });
  }
  markPressables();

  // 3) ripple + pressed
  function addRipple(e, el){
    const r = document.createElement('span');
    r.className = 'ripple';
    const rect = el.getBoundingClientRect();
    r.style.left = (e.clientX - rect.left) + 'px';
    r.style.top  = (e.clientY - rect.top)  + 'px';
    el.appendChild(r);
    setTimeout(()=> r.remove(), 600);
  }
  function onDown(e){
    const t = e.target.closest('.pressable'); if(!t) return;
    t.classList.add('pressed');
    // אל תוסיף ripple לקישורי מקלדת
    if(e.pointerType !== '' && e.isPrimary !== false){
      addRipple(e, t);
    }
  }
  function onUp(){
    document.querySelectorAll('.pressable.pressed').forEach(el=> el.classList.remove('pressed'));
  }
  document.addEventListener('pointerdown', onDown, {passive:true});
  document.addEventListener('pointerup', onUp, {passive:true});
  document.addEventListener('pointercancel', onUp, {passive:true});
  document.addEventListener('keydown', (e)=>{
    if((e.key==='Enter' || e.key===' ') && document.activeElement?.classList.contains('pressable')){
      document.activeElement.classList.add('pressed');
      setTimeout(onUp, 150);
    }
  });

  // 4) אם יש קבוצת צ'יפים ללא סקריפט – אפשר חד-בחירה לפי data-name
  document.addEventListener('click', (e)=>{
    const chip = e.target.closest('.chip[data-name]');
    if(!chip) return;
    const name = chip.getAttribute('data-name');
    const cont = chip.closest('.chips') || document;
    [...cont.querySelectorAll(`.chip[data-name="${name}"]`)]
      .forEach(x => x.setAttribute('aria-pressed','false'));
    chip.setAttribute('aria-pressed', 'true');
  });
})();