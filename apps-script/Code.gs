/**
 * יוסטון – Intake מאוחד לכל הטפסים (Google Apps Script)
 * =====================================================
 * קולט את כל 9 הזרימות של אתר יוסטון ורושם כל פנייה בלשונית ייעודית בגיליון.
 * הוראות הקמה מלאות: docs/APPS-SCRIPT.he.md בריפו.
 *
 * עקרונות:
 *  - קבלת POST בלבד (הטפסים שולחים JSON כ-text/plain כדי להימנע מ-CORS preflight).
 *  - ולידציה בסיסית: flow מוכר, שם פרטי, טלפון ישראלי.
 *  - חותמת זמן שרת + מזהה פנייה (caseId) לכל שורה.
 *  - זיהוי שליחה כפולה (אותה פנייה תוך 3 דקות) → מוחזר caseId:'dup' בלי שורה כפולה.
 *  - Honeypot: אם שדה "website" מלא – כנראה בוט; לא נרשם כלום.
 *  - תשובה תמיד JSON נקי: { ok:true, caseId, sheet } או { ok:false, error }.
 */

/* ============ הגדרות ============ */

// לשונית + כותרות לכל זרימה. העמודות הראשונות משותפות לכולן (ראו CORE_HEADERS).
var FLOWS = {
  onetime: {
    sheet: 'שיעור חד־פעמי',
    headers: [
      ['studentName', 'שם פרטי תלמיד/ה'], ['studentLastName', 'שם משפחה תלמיד/ה'],
      ['subject', 'מקצוע'], ['grade', 'כיתה'], ['units', 'יחידות'],
      ['track', 'מסלול'], ['rate', 'תעריף'], ['teacherPreference', 'מורה מועדף'],
      ['preferredDate', 'תאריך מועדף'], ['slotsText', 'מועדים']
    ]
  },
  boost: {
    sheet: 'שיעור תגבור',
    headers: [
      ['studentFirst', 'שם פרטי תלמיד/ה'], ['studentLast', 'שם משפחה תלמיד/ה'],
      ['subject', 'מקצוע'], ['grade', 'כיתה'], ['units', 'יחידות'],
      ['track', 'מסלול'], ['rate', 'תעריף'], ['teacher', 'מורה'],
      ['slotsText', 'מועדים']
    ]
  },
  makeup: {
    sheet: 'השלמת שיעור',
    headers: [
      ['studentName', 'שם תלמיד/ה'], ['subject', 'מקצוע'], ['track', 'מסלול'],
      ['grade', 'כיתה'], ['units', 'יחידות'], ['teacher', 'מורה'],
      ['missedDate', 'תאריך שהוחמץ'], ['missedTime', 'שעה שהוחמצה'],
      ['reason', 'סיבת החמצה'], ['desiredPreference', 'העדפת מועד'],
      ['slotsText', 'מועדים להשלמה']
    ]
  },
  reschedule: {
    sheet: 'שינוי מועד קבוע',
    headers: [
      ['studentName', 'שם תלמיד/ה'], ['studentLast', 'שם משפחה תלמיד/ה'],
      ['subject', 'מקצוע'], ['track', 'מסלול'], ['teacher', 'מורה'],
      ['currentDay', 'יום קבוע כיום'], ['currentTime', 'שעה קבועה כיום'],
      ['desiredPreference', 'העדפת מועד'], ['slotsText', 'מועדים מבוקשים']
    ]
  },
  billing: {
    sheet: 'תשלומים וחשבוניות',
    headers: [ ['topic', 'נושא הפנייה'] ]
  },
  message: {
    sheet: 'הודעות למזכירות',
    headers: [ ['message', 'תוכן ההודעה'] ]
  },
  cancel: {
    sheet: 'ביטולי מנוי',
    headers: [
      ['studentFirstName', 'שם פרטי תלמיד/ה'], ['studentLastName', 'שם משפחה תלמיד/ה'],
      ['subject', 'מקצוע'], ['teacher', 'מורה'],
      ['reasonsText', 'סיבות'], ['reasonOther', 'פירוט נוסף'],
      ['effective', 'תוקף'], ['effectiveDate', 'תאריך יעד']
    ]
  },
  info: {
    sheet: 'לידים – דף מידע',
    headers: [ ['subjectsText', 'מקצועות'], ['interestsText', 'תחומי עניין'] ]
  },
  lead: {
    sheet: 'לידים – השארת פרטים',
    headers: [ ['subject', 'מקצוע'], ['contextText', 'מקור הגעה (UTM)'] ]
  }
};

// עמודות משותפות שמופיעות ראשונות בכל לשונית
var CORE_HEADERS = [
  ['caseId', 'מזהה פנייה'], ['serverTime', 'התקבל בתאריך'], ['flow', 'סוג פנייה'],
  ['status', 'סטטוס'], ['role', 'מי פנה'], ['firstName', 'שם פרטי'],
  ['lastName', 'שם משפחה'], ['phone', 'טלפון']
];
// עמודות סיום בכל לשונית
var TAIL_HEADERS = [ ['notes', 'הערות'], ['raw', 'נתונים מלאים (JSON)'] ];

var DUP_WINDOW_SECONDS = 180; // חלון זיהוי כפילויות

/* ============ נקודות כניסה ============ */

function doGet() {
  // בדיקת חיים בלבד – שליחת נתונים מתבצעת ב-POST
  return jsonResponse_({ ok: true, service: 'Houston intake', hint: 'שליחות מתקבלות ב-POST בלבד' });
}

function doPost(e) {
  try {
    var body = parseBody_(e);
    if (!body) return jsonResponse_({ ok: false, error: 'bad_request' });

    // Honeypot – בוטים ממלאים את השדה הנסתר; עונים "הצלחה" בלי לרשום
    if (String(body.website || '').trim() !== '') {
      return jsonResponse_({ ok: true, caseId: 'ok' });
    }

    // זיהוי הזרימה (טפסים ישנים של lead לא שלחו flow – ברירת מחדל: lead)
    var flow = String(body.flow || 'lead').toLowerCase();
    if (!FLOWS[flow]) return jsonResponse_({ ok: false, error: 'unknown_flow' });

    // ולידציה בסיסית
    var firstName = String(body.firstName || '').trim();
    var phone = String(body.phone || '').replace(/\D/g, '');
    if (!firstName) return jsonResponse_({ ok: false, error: 'missing_firstName' });
    if (!/^0\d{8,9}$/.test(phone)) return jsonResponse_({ ok: false, error: 'invalid_phone' });

    // זיהוי שליחה כפולה
    var dupKey = 'dup_' + flow + '_' + Utilities.base64Encode(
      Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, flow + '|' + phone + '|' + normalizeForDup_(body))
    );
    var cache = CacheService.getScriptCache();
    if (cache.get(dupKey)) {
      return jsonResponse_({ ok: true, caseId: 'dup' });
    }

    // כתיבה לגיליון (עם נעילה נגד כתיבות מקבילות)
    var lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      var caseId = makeCaseId_(flow);
      var row = buildRow_(flow, body, caseId, phone);
      var sheet = ensureSheet_(flow);
      sheet.appendRow(row);
      cache.put(dupKey, '1', DUP_WINDOW_SECONDS);
      return jsonResponse_({ ok: true, caseId: caseId, sheet: FLOWS[flow].sheet });
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    // לא מחזירים פרטים טכניים ללקוח
    console.error('intake error: ' + err);
    return jsonResponse_({ ok: false, error: 'server_error' });
  }
}

/* ============ עזרי עיבוד ============ */

function parseBody_(e) {
  try {
    if (e && e.postData && e.postData.contents) return JSON.parse(e.postData.contents);
  } catch (err) {}
  return null;
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function makeCaseId_(flow) {
  var prefix = { onetime:'OT', boost:'BO', makeup:'MK', reschedule:'RS',
                 billing:'BL', message:'MS', cancel:'CN', info:'IN', lead:'LD' }[flow] || 'HB';
  return prefix + '-' + new Date().getTime().toString(36).toUpperCase() +
         Math.floor(Math.random() * 36).toString(36).toUpperCase();
}

// טקסט קריא מרשימת מועדים – תומך גם בתאריך (date) וגם ביום בשבוע (day)
function slotsToText_(slots) {
  if (!slots || !slots.length) return '';
  return slots.map(function (s) {
    var when = s.date || s.day || '';
    return (when + ' ' + (s.from || '') + '-' + (s.to || '')).trim();
  }).join(' | ');
}

// שדות מחושבים/מוסבים לפני מיפוי לעמודות
function deriveFields_(body) {
  var d = {};
  d.slotsText = slotsToText_(body.slots);
  d.reasonsText = Array.isArray(body.reasons) ? body.reasons.join(' | ') : String(body.reasons || '');
  d.subjectsText = Array.isArray(body.subjects) ? body.subjects.join(' | ') : String(body.subjects || '');
  d.interestsText = Array.isArray(body.interests) ? body.interests.join(' | ') : String(body.interests || '');
  d.role = body.role || body.contactRole || '';
  if (d.role === 'student') d.role = 'תלמיד';
  if (d.role === 'parent') d.role = 'הורה';
  if (body.context && typeof body.context === 'object') {
    d.contextText = ['utm_source', 'utm_medium', 'utm_campaign', 'referrer']
      .map(function (k) { return body.context[k] ? k + '=' + body.context[k] : ''; })
      .filter(String).join(' | ');
  } else {
    d.contextText = '';
  }
  return d;
}

function buildRow_(flow, body, caseId, cleanPhone) {
  var derived = deriveFields_(body);
  var fixed = {
    caseId: caseId,
    serverTime: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss'),
    flow: flow,
    status: String(body.status || 'לטיפול'),
    phone: cleanPhone,
    raw: JSON.stringify(body)
  };
  var headers = CORE_HEADERS.concat(FLOWS[flow].headers, TAIL_HEADERS);
  return headers.map(function (h) {
    var key = h[0];
    var val = (key in fixed) ? fixed[key]
            : (key in derived) ? derived[key]
            : body[key];
    if (val === null || val === undefined) return '';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  });
}

function ensureSheet_(flow) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var name = FLOWS[flow].sheet;
  var sheet = ss.getSheetByName(name);
  var labels = CORE_HEADERS.concat(FLOWS[flow].headers, TAIL_HEADERS).map(function (h) { return h[1]; });
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.setRightToLeft(true);
    sheet.getRange(1, 1, 1, labels.length).setValues([labels]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// נרמול לצורך זיהוי כפילות – מתעלם משדות שמשתנים בין לחיצות (זמן יצירה, הקשר)
function normalizeForDup_(body) {
  var clone = {};
  Object.keys(body).sort().forEach(function (k) {
    if (k === 'createdAt' || k === 'context') return;
    clone[k] = body[k];
  });
  return JSON.stringify(clone);
}
