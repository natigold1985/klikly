import React from 'react';

export default function TermsOfService() {
  return (
    <div className="max-w-3xl mx-auto py-8 space-y-6 text-slate-700 leading-relaxed" dir="rtl">
      <h1 className="text-3xl font-extrabold text-slate-900">תנאי שימוש</h1>
      <p className="text-sm text-slate-500">עודכן לאחרונה: מאי 2026</p>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">1. הסכמה לתנאים</h2>
        <p>
          השימוש בפלטפורמת Klikly מהווה הסכמה לתנאים המפורטים להלן. אם אינך
          מסכים — נא להפסיק את השימוש במערכת.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">2. החשבון שלך</h2>
        <ul className="list-disc pr-5 space-y-1">
          <li>הינך מחויב לשמור על סודיות פרטי הכניסה לחשבון.</li>
          <li>הינך אחראי באופן בלעדי לכל פעולה המתבצעת תחת חשבונך.</li>
          <li>אסור להעביר את הגישה לחשבון לגורם צד שלישי ללא אישור.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">3. אחריות הצלם על תכנים</h2>
        <p>
          הצלם המשתמש במערכת אחראי באופן מלא לתכנים שהוא מעלה (תמונות, סרטונים,
          פרטי לקוחות) ולעמידתם בחוקי זכויות יוצרים, פרטיות ועמידה בתנאי השימוש
          של ספקי האחסון החיצוניים.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">4. הגבלת אחריות</h2>
        <p>
          השירות מוצע "כפי שהוא" (AS-IS). איננו אחראים לכל נזק ישיר או עקיף
          הנובע מאובדן מידע, השבתות מערכת, או פעולות צד שלישי. הצלם נדרש לשמור
          גיבויים עצמאיים לתכנים החשובים שלו.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">5. שימוש אסור</h2>
        <ul className="list-disc pr-5 space-y-1">
          <li>אסור להעלות תכנים בלתי-חוקיים, פוגעניים או מפרי זכויות.</li>
          <li>אסור לבצע ניסיונות פריצה, סריקה אוטומטית או הנדסה לאחור.</li>
          <li>אסור לשלוח דואר זבל ללקוחות באמצעות המערכת.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">6. סיום שימוש</h2>
        <p>
          אנו שומרים את הזכות להשעות או להסיר חשבון בעת הפרת התנאים, או לפי
          שיקול דעתנו במקרים של שימוש לרעה.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">7. דין וסמכות שיפוט</h2>
        <p>
          תנאים אלו כפופים לדין הישראלי. סמכות השיפוט הבלעדית נתונה לבתי המשפט
          המוסמכים במחוז תל-אביב.
        </p>
      </section>
    </div>
  );
}