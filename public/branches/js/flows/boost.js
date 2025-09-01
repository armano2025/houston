// /branches/js/flows/boost.js
window.Flows = window.Flows || {};
window.Flows.Boost = (() => {
  async function run(){
    // להתחיל מ"פרטי קשר" → מקצוע → כיתה → יחידות (אם צריך) → תעריף → מועדים → שם תלמיד → הערות → סיכום
    Chat._afterContact = () => {
      Chat.selectSubject();
    };

    Chat.clear();
    Chat.bubble('ברוכים הבאים לזרימת שיעור תגבור 👨‍🚀');
    await Chat.askContact({
      // ערכי התחלה אופציונליים, שימושי בזמן דיבוג
      // firstName:'', lastName:'', phone:''
    });
  }

  return { run };
})();