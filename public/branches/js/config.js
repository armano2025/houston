/* /public/branches/js/config.js
   קונפיגורציה מרכזית של יוסטון – היעד היחיד שאליו נשלחים כל הטפסים.

   ================================================================
   🎯 איחוד יעד השליחה (ראו docs/APPS-SCRIPT.he.md + docs/ENDPOINTS.he.md):
   אחרי הקמת הגיליון וה-Apps Script החדשים, מדביקים את כתובת ה-Web App
   בשורה של UNIFIED_INTAKE_URL למטה – וכל 9 הזרימות עוברות אליה אוטומטית.
   כל עוד השדה ריק – האתר ממשיך לעבוד בדיוק כמו היום.
   ================================================================

   הערה: אלו כתובות ציבוריות מטבען (כל מבקר באתר רואה אותן).
   ההגנה על הנתונים נעשית בצד ה-Apps Script (ולידציה, זיהוי כפילויות, honeypot). */
(function () {
  // ← מדביקים כאן את כתובת ה-Web App החדשה, בין הגרשיים:
  var UNIFIED_INTAKE_URL = '';

  // מצב ביניים (חוב טכני, עד הפעלת היעד המאוחד) – הכתובות הפעילות היום:
  var LEGACY_ENDPOINTS = {
    // הדיפלוי הראשי – משרת את רוב הזרימות (מנויים, מידע, לידים)
    default: 'https://script.google.com/macros/s/AKfycbxRiJ_uMNpIJru-nNClAi787sA07hQSu7TX4cQEAm3_w3-dO2Hmp39ISxh81SqudA/exec',
    // דיפלוי נפרד שנותר לזרימת "שיעור חד־פעמי" בלבד (לא מכוון – יבוטל עם האיחוד)
    onetime: 'https://script.google.com/macros/s/AKfycbxagWMbWh-tmxa03Z_6Z7AQK1Hgp3G8AkcBPgvj6eYLQxBm5aNMrPB7FfEEzHp0BT0H/exec'
  };

  // דף שצריך את החריג הזמני מסמן data-endpoint="onetime" על תג הסקריפט.
  // כשה-UNIFIED מוגדר – הסימון מתעלם וכולם מאוחדים.
  var key = (document.currentScript && document.currentScript.dataset.endpoint) || 'default';
  var url = UNIFIED_INTAKE_URL || LEGACY_ENDPOINTS[key] || LEGACY_ENDPOINTS.default;

  window.HOUSTON_CONFIG = {
    PROJECT: 'Houston',
    UNIFIED_INTAKE_URL: UNIFIED_INTAKE_URL,
    LEGACY_ENDPOINTS: LEGACY_ENDPOINTS
  };
  window.APP_CONFIG = {
    SHEET_API_URL: url,
    PROJECT: 'Houston'
  };
})();
