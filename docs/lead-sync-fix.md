# תיקון סנכרון לידים אוטומטי מ-Google Sheet

## רקע

המשתמש מפעיל סוכן חיצוני שאוסף לידים מגוגל ופלטפורמות שונות לתוך Google Sheet מאסטר:
```
https://docs.google.com/spreadsheets/d/1Acz_kFz4d2oGyJflAWyrY4yiAAlbvWVqR7UNgKHCdD4
```

הצורך: לסנכרן את ה-Sheet לתוך Klikly אחת ביום, עם כללי ולידציה קשיחים.

---

## כללי הולידציה הנדרשים

| כלל | תנאי |
|-----|------|
| **שם + קשר** | חייב: שם אמיתי + (טלפון OR אימייל). אם חסר — דלג |
| **URL לאתרי דרושים** | מקורות: drushim, alljobs, linkedin.com/jobs, yad2, gov.il, mod.gov.il, ביטחון — חייב URL מדויק למודעה. אם אין — דלג |

---

## בעיות שנמצאו בקוד המקורי

### בעיה 1 — `syncFromGoogleSheets`: ולידציה שגויה (דרש גם וגם, לא אחד מהם)

**קובץ:** `base44/functions/syncFromGoogleSheets/entry.ts`, שורה 321

**קוד לפני:**
```typescript
if (!name || !phone || !email || !isRealLeadName(...) || !isValidPhone(phone) || !isValidEmail(email)) {
```

**הבעיה:** הדרישה `!phone || !email` פסלה כל ליד שחסר לו אחד מהשניים. ליד עם טלפון בלבד — נפסל. ליד עם אימייל בלבד — נפסל.

**קוד אחרי:**
```typescript
if (!name || (!isValidPhone(phone) && !isValidEmail(email)) || !isRealLeadName(...)) {
```

---

### בעיה 2 — `syncFromGoogleSheets`: `detectJunkLead` חסם כל ליד ללא URL

**קובץ:** `base44/functions/syncFromGoogleSheets/entry.ts`, פונקציה `detectJunkLead`

**קוד לפני:**
```typescript
if (!sourceUrl || !/^https?:\/\//i.test(sourceUrl)) {
    return { isJunk: true, reason: 'missing_source_url' };
}
```

**הבעיה:** פסלה כל ליד ללא URL — גם לידים מ-WhatsApp, אינסטגרם, המלצה. צריך URL רק לאתרי דרושים.

**תיקון:** הוסר הבלוק הזה לחלוטין. הוסף כלל נפרד לאחר הולידציה הבסיסית שבודק URL רק אם המקור הוא אתר דרושים.

---

### בעיה 3 — `syncFromGoogleSheets`: `detectJunkLead` סימן דרושים/לינקדין כ-junk

**קובץ:** `base44/functions/syncFromGoogleSheets/entry.ts`, מערך `junkTextPatterns`

**קוד לפני:**
```typescript
const junkTextPatterns = [
    ...
    'linkedin.com/jobs',
    'דרושים',
];
```

**הבעיה:** לידים ממשרות לינקדין ומאתר דרושים נחסמו גם כשהיה להם URL תקין.

**תיקון:** הוסרו `'linkedin.com/jobs'` ו-`'דרושים'` מרשימת ה-junk. כעת לידים אלו מתקבלים אם עוברים את כלל ה-URL.

---

### בעיה 4 — `runScheduledSheetsSync`: URL שגוי לקריאת ה-Sheet (Bug קריטי)

**קובץ:** `base44/functions/runScheduledSheetsSync/entry.ts`, שורה 77

**קוד לפני:**
```typescript
const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/2039667077!A:Z`;
```

**הבעיה:** `2039667077` הוא ה-GID (מזהה הטאב), לא שם הטאב. ה-Google Sheets API v4 לא מקבל GID כ-range name — הוא מקבל **שם הטאב** (כגון `'Sheet1'!A1:Z`). כתוצאה: הסנכרון האוטומטי של כל יום **לא קרא שום נתונים** ולא הכניס לידים.

**תיקון:** שונה ל-flow נכון:
1. קרא metadata מ-`/spreadsheets/{id}?fields=sheets.properties` → מקבל שמות כל הטאבים
2. Batch GET לכל הטאבים לפי שמותיהם האמיתיים: `'TabName'!A1:Z1000`
3. עיבוד כל הטאבים

---

### בעיה 5 — `runScheduledSheetsSync`: חסרות עמודת URL ו-dedup לפי אימייל

**קובץ:** `base44/functions/runScheduledSheetsSync/entry.ts`

**הבעיה:**
- לא מיפה עמודת link/קישור/url — לא שמר את ה-URL במודעה
- Dedup רק לפי טלפון, לא לפי אימייל — גרם ללידים כפולים כשהיה אימייל בלבד

**תיקון:**
- נוסף `idx.link` למיפוי העמודות
- ה-URL מחולץ מהעמודה ונשמר ב-`source_post_url`
- Dedup עם שני maps: `phoneMap` ו-`emailMap`

---

## כלל חדש שנוסף לשני הפונקציות

```typescript
const JOB_BOARD_INDICATORS = [
    'drushim', 'alljobs', 'job.co.il', 'linkedin.com/jobs',
    'yad2', 'gov.il', 'mod.gov.il', 'industry.co.il', 'ביטחון', 'דרושים'
];

// מחפש בכל שדות המקור והקישור
const allSourceText = [detectedSource, sourceCol, linkCol, notesCol].join(' ').toLowerCase();

if (JOB_BOARD_INDICATORS.some(k => allSourceText.includes(k)) && !sourceUrl) {
    tabSkipped++;
    skipped++;
    continue; // דלג — אתר דרושים ללא URL מדויק
}
```

---

## שינוי ב-UI — דף LeadImport

**קובץ:** `src/pages/LeadImport.jsx`

**מה נוסף:** כרטיס "סנכרון לידים אוטומטי" (צבע ירוק, אייקון ⚡) בראש רשימת ה-channels.

- לחיצה על הכרטיס → מריץ ישירות את `runScheduledSheetsSync` עם ה-Sheet המאסטר
- אין dialog — סנכרון מיידי
- מציג spinner בזמן ריצה
- Toast עם סיכום: `X לידים חדשים, Y עודכנו`
- שומר timestamp של הסנכרון האחרון

---

## Push Notification — נוסף ל-`runScheduledSheetsSync`

```typescript
if (totalAdded > 0) {
    await base44.asServiceRole.functions.invoke('sendPushNotification', {
        title: 'לידים חדשים 🎯',
        body: `${totalAdded} לידים חדשים נוספו מהסנכרון האוטומטי`,
    });
}
```

---

## קבצים שעודכנו

| קובץ | שינוי |
|------|-------|
| `base44/functions/syncFromGoogleSheets/entry.ts` | תיקון ולידציה (OR במקום AND), הסרת חסימת URL גלובלית, הוספת כלל URL לאתרי דרושים |
| `base44/functions/runScheduledSheetsSync/entry.ts` | תיקון URL קריאת ה-Sheet, הוספת עמודת link, dedup לפי אימייל, כלל URL לדרושים, push notification |
| `src/pages/LeadImport.jsx` | הוספת channel "סנכרון לידים אוטומטי" עם directSync |

---

## בדיקה אחרי ה-Deploy

1. היכנס ל-**Import Hub** → לחץ על **"סנכרון לידים אוטומטי"**
2. וודא שמגיע toast עם ספירה
3. בדוק בטבלת לידים: לידים עם טלפון בלבד (ללא אימייל) נכנסים
4. בדוק שלידים מ-drushim/linkedin **עם URL** — נכנסים
5. בדוק שלידים מ-drushim/linkedin **ללא URL** — לא נכנסים
6. בדוק שאין כפולים (אותו טלפון = עדכון, לא יצירה חדשה)

---

## Flow מלא אחרי התיקון

```
Google Sheet (מתעדכן ע"י סוכן חיצוני)
        ↓  (כל יום 09:00 + 21:00 — runScheduledSheetsSync)
  קריאת metadata → שמות כל הטאבים
        ↓
  batchGet כל הטאבים לפי שמות אמיתיים
        ↓
  לכל שורה:
    ✅ שם אמיתי + (טלפון OR אימייל)? — המשך
    ✅ אתר דרושים → יש URL? — המשך
    ❌ חסר קשר / חסר URL לדרושים → דלג
        ↓
  dedup: phone OR email → עדכן / צור חדש
        ↓
  Lead (status: 'new', source_post_url שמור)
        ↓
  Push Notification: "X לידים חדשים נוספו"
```
