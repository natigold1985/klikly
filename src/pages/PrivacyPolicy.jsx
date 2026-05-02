import React from 'react';

export default function PrivacyPolicy() {
  return (
    <div className="max-w-3xl mx-auto py-8 space-y-6 text-slate-700 leading-relaxed" dir="rtl">
      <h1 className="text-3xl font-extrabold text-slate-900">מדיניות פרטיות</h1>
      <p className="text-sm text-slate-500">עודכן לאחרונה: מאי 2026</p>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">1. כללי</h2>
        <p>
          פלטפורמת Klikly ("האפליקציה", "אנחנו") מופעלת על ידי נתי גולד ומספקת מערכת ניהול
          לידים, פרויקטים, גלריות והעברת קבצים עבור צלמים מקצועיים ולקוחותיהם.
          מדיניות זו מסבירה אילו נתונים נאספים, כיצד הם נשמרים, ולאילו מטרות.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">2. מידע שאנו אוספים</h2>
        <ul className="list-disc pr-5 space-y-1">
          <li>פרטי חשבון: שם מלא, כתובת אימייל, תפקיד במערכת.</li>
          <li>פרטי לידים ולקוחות שהוזנו על-ידי המשתמש (שם, טלפון, אימייל, הערות).</li>
          <li>קבצי מדיה (תמונות/סרטונים) שהועלו למערכת.</li>
          <li>נתוני שימוש טכניים: כתובת IP, סוג דפדפן, פעולות במערכת לצורכי אבטחה.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">3. שימוש במידע</h2>
        <p>השימוש במידע נעשה לצרכים הבאים בלבד:</p>
        <ul className="list-disc pr-5 space-y-1">
          <li>הפעלת השירות ושמירת נתוני המשתמש.</li>
          <li>שליחת התראות ועדכונים תפעוליים.</li>
          <li>מניעת הונאות ושמירה על אבטחת המערכת.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">4. אחסון קבצי מדיה</h2>
        <p>
          קבצי מדיה של צלמים מאוחסנים אצל ספקי אחסון חיצוניים (Bunny CDN / Google Drive
          של הצלם). אנחנו פועלים כשכבת ניהול ואיננו אחראים על תכני הקבצים שהצלם
          מעלה לחשבונו האישי.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">5. זכויות המשתמש</h2>
        <p>
          באפשרותך לבקש בכל עת לעיין במידע שמור עליך, לתקנו או למחקו. ניתן לפנות
          אלינו באימייל: <a className="text-blue-600 underline" href="mailto:natigold04@gmail.com">natigold04@gmail.com</a>.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">6. אבטחת מידע</h2>
        <p>
          אנו נוקטים באמצעי אבטחה מקובלים בתעשייה (הצפנת תקשורת, בקרת גישה
          מבוססת-תפקידים, רישום ניסיונות גישה לא-מורשים) לשמירה על הנתונים.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">7. שינויים במדיניות</h2>
        <p>
          אנו רשאים לעדכן מדיניות זו מעת לעת. גרסה מעודכנת תפורסם תמיד בעמוד זה
          עם תאריך עדכון.
        </p>
      </section>
    </div>
  );
}