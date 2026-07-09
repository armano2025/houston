/* /public/branches/js/config.js
   קונפיגורציה מרכזית של יוסטון – כתובות ה-Webhook של Google Apps Script.
   אם כתובת דיפלוי משתנה – מעדכנים *רק כאן*.

   הערה: אלו כתובות ציבוריות מטבען (כל מבקר באתר רואה אותן).
   ההגנה על הנתונים חייבת להיעשות בצד ה-Apps Script (ולידציה, rate-limit, בדיקת origin). */
(function () {
  var ENDPOINTS = {
    // הדיפלוי הראשי – משרת את רוב הזרימות (מנויים, מידע, לידים)
    default: 'https://script.google.com/macros/s/AKfycbxRiJ_uMNpIJru-nNClAi787sA07hQSu7TX4cQEAm3_w3-dO2Hmp39ISxh81SqudA/exec',
    // דיפלוי נפרד לזרימת "שיעור חד־פעמי" (onetime)
    onetime: 'https://script.google.com/macros/s/AKfycbxagWMbWh-tmxa03Z_6Z7AQK1Hgp3G8AkcBPgvj6eYLQxBm5aNMrPB7FfEEzHp0BT0H/exec'
  };

  window.HOUSTON_CONFIG = { PROJECT: 'Houston', ENDPOINTS: ENDPOINTS };

  // ברירת מחדל לכל הדפים; דף שצריך endpoint אחר מגדיר data-endpoint על תג הסקריפט
  var key = (document.currentScript && document.currentScript.dataset.endpoint) || 'default';
  window.APP_CONFIG = {
    SHEET_API_URL: ENDPOINTS[key] || ENDPOINTS.default,
    PROJECT: 'Houston'
  };
})();
