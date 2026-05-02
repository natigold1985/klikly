import React from 'react';

export default function Accessibility() {
  return (
    <div className="max-w-3xl mx-auto py-8 space-y-6 text-slate-700 leading-relaxed" dir="rtl">
      <h1 className="text-3xl font-extrabold text-slate-900">הצהרת נגישות</h1>
      <p className="text-sm text-slate-500">עודכן לאחרונה: מאי 2026</p>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">המחויבות שלנו</h2>
        <p>
          פלטפורמת Klikly שואפת להנגיש את שירותיה לכלל המשתמשים, לרבות אנשים
          עם מוגבלויות, ופועלת בהתאם לתקן הישראלי ת"י 5568 ולהנחיות
          WCAG 2.1 ברמה AA.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">תוסף הנגישות באתר</h2>
        <p>בכל עמוד באתר זמין תפריט נגישות (כפתור עגול בצד שמאל) המאפשר:</p>
        <ul className="list-disc pr-5 space-y-1">
          <li>הגדלה / הקטנה של גודל הטקסט.</li>
          <li>החלפה לתצוגת ניגודיות גבוהה.</li>
          <li>מצב גווני אפור.</li>
          <li>הדגשת קישורים בקו תחתון.</li>
          <li>החלפה לפונט קריא יותר (משפחת sans-serif).</li>
          <li>איפוס הגדרות ההצגה לערכי ברירת המחדל.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">התאמות שבוצעו</h2>
        <ul className="list-disc pr-5 space-y-1">
          <li>תמיכה מלאה בניווט באמצעות מקלדת (Tab / Shift+Tab / Enter).</li>
          <li>סימון ויזואלי ברור של אלמנט בפוקוס.</li>
          <li>טקסטים חלופיים (alt) לתמונות עיקריות.</li>
          <li>תוויות (aria-label) לכפתורים ופקדים אינטראקטיביים.</li>
          <li>תמיכה בכיווניות RTL לעברית.</li>
          <li>ניגודיות צבעים תואמת לתקן בכלל הטקסטים העיקריים.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">חלקים שעדיין בשיפור</h2>
        <p>
          חלק מהתכנים החיצוניים (קבצי מדיה, מפות אינטראקטיביות, גלריות תמונות)
          עשויים שלא להיות נגישים במלואם בשל מקורם הטכני. אנחנו פועלים לשיפור
          מתמיד.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">פנייה לרכז הנגישות</h2>
        <p>אם נתקלת בבעיית נגישות, נשמח לעזור ולתקן. ניתן לפנות אלינו ב:</p>
        <ul className="list-disc pr-5 space-y-1">
          <li>שם רכז נגישות: נתי גולד</li>
          <li>אימייל: <a className="text-blue-600 underline" href="mailto:natigold04@gmail.com">natigold04@gmail.com</a></li>
          <li>זמן מענה ממוצע: עד 5 ימי עסקים.</li>
        </ul>
      </section>
    </div>
  );
}