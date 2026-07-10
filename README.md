# יוסטון 👨‍🚀 – מרכז הלמידה בראונשטיין

אתר סטטי (Firebase Hosting) המשמש כ"עוזר דיגיטלי" של מרכז הלמידה בראונשטיין:
תיאום שיעורים, פניות מנויים, תשלומים, הודעות ואיסוף לידים. כל הטפסים נשלחים
ל-Google Sheets דרך Google Apps Script.

## מבנה הפרויקט

```
public/
  index.html                  דף הבית – תפריט ראשי
  lead.html                   טופס השארת פרטים (עמוד עצמאי לקמפיינים)
  thanks.html                 עמוד תודה (אחרי lead)
  404.html                    עמוד "לא נמצא"
  styles.light.css            מערכת העיצוב המשותפת לכל הדפים
  assets/                     לוגו ותמונות
  branches/
    branch1/boost-onetime.html   שיעור חד־פעמי (למי שאינם מנויים)
    branch1/boost.html           שיעור תגבור (למנויים)
    branch3/index.html           תפריט מנויים
    branch3/makeup.html          השלמת שיעור
    branch3/reschedule.html      שינוי מועד קבוע
    branch3/billing.html         תשלומים וחשבוניות
    branch3/message.html         הודעה למזכירות
    branch3/cancel.html          ביטול מנוי
    info/index.html              דף נחיתה שיווקי + טופס ליד
    js/
      config.js                  ⚙️ קונפיגורציה מרכזית – כתובות Apps Script
      chat-core.js               ולידציה + שליחה ל-Google Sheets
      flows/*.js                 הלוגיקה של כל טופס (ויזארד)
scripts/
  check-links.mjs             בודק קישורים פנימיים
docs/
  AUDIT.he.md                 דוח ביקורת ושדרוג (עברית)
```

## יעד השליחה (Apps Script)

כל כתובות ה-Webhook מרוכזות בקובץ אחד: `public/branches/js/config.js`.

- **איחוד היעדים:** כרגע קיימים שני דיפלויים ישנים (חוב טכני – "שיעור חד־פעמי"
  שולח לדיפלוי נפרד). כדי לאחד את כל הטפסים ליעד חדש ונקי אחד, מקימים
  גיליון + Apps Script לפי המדריך `docs/APPS-SCRIPT.he.md` ומדביקים את כתובת
  ה-Web App בשדה `UNIFIED_INTAKE_URL` שבראש `config.js`. כל עוד השדה ריק –
  האתר ממשיך לעבוד עם היעדים הישנים.
- מיפוי מלא של מי-שולח-לאן: `docs/ENDPOINTS.he.md`.

## בדיקה מקומית

דרושה סביבת Node (או כל שרת סטטי):

```bash
# הרצת האתר מקומית
npx serve public
# או:
python3 -m http.server 8080 --directory public

# בדיקת קישורים פנימיים
node scripts/check-links.mjs
```

לאחר מכן נכנסים ל-http://localhost:8080 ועוברים על הדפים.

## פריסה (Deploy)

הפריסה אוטומטית: כל push ל-branch‏ `main` מפעיל GitHub Action
(`.github/workflows/firebase-hosting.yml`) שמפרסם ל-Firebase Hosting
(פרויקט `houston-69822`).

פריסה ידנית (אם צריך):

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only hosting
```

## אבטחה ופרטיות – חשוב לדעת

- כתובות ה-Apps Script הן **ציבוריות מטבען** (כל מי שפותח את קוד האתר רואה אותן).
  לכן חשוב שהסקריפט בצד Google יבצע: ולידציה של שדות, הגבלת קצב (rate-limit),
  בדיקת מקור (origin) וזיהוי כפילויות.
- האתר לא שומר פרטים אישיים בדפדפן, ולוגים בקונסול אינם כוללים טלפונים או שמות.
- בטופס הלידים יש שדה Honeypot נסתר לסינון בוטים.
