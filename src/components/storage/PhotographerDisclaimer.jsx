import React, { useState, useEffect } from 'react';
import { ShieldAlert, X, ChevronDown, ChevronUp } from 'lucide-react';

// Disclaimer shown ONLY to the photographer/admin in FileStorage.
// Clarifies that files are stored in their own Google Drive — Klikly is not responsible
// for storage limits, security breaches, or data exposure. Dismissible & remembered locally.
export default function PhotographerDisclaimer() {
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setDismissed(false);
  }, []);

  const handleDismiss = () => {
    setExpanded(false);
  };

  if (dismissed) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 relative" dir="rtl">
      <button
        onClick={handleDismiss}
        className="absolute left-3 top-3 text-amber-600 hover:text-amber-800 transition-colors"
        aria-label="סגור"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-start gap-3 pl-6">
        <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
          <ShieldAlert className="w-5 h-5 text-amber-700" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-amber-900 text-sm mb-1">
            הקבצים מאוחסנים ב-Google Drive שלך
          </p>
          <p className="text-xs text-amber-800 leading-relaxed">
            הקבצים שאתה מעלה נשמרים ישירות בחשבון ה-Google Drive שלך — לא בשרתי האפליקציה.
          </p>

          {expanded && (
            <ul className="text-xs text-amber-800 leading-relaxed mt-3 space-y-1.5 list-disc pr-4">
              <li>אתה האחראי הבלעדי לקבצים, לגיבויים ולשמירתם.</li>
              <li>נפח האחסון תלוי בחשבון Google Drive שלך — אם נגמר, עליך לרכוש שדרוג ישירות מ-Google.</li>
              <li>כל חדירת מידע, חשיפה, מחיקה או אובדן נתונים — באחריותך הבלעדית, ולא באחריות האפליקציה או מפעיליה.</li>
              <li>הגישה של לקוחות לקבצים מתבצעת דרך הרשאות שאתה מגדיר בחשבון Google שלך.</li>
              <li>בעת ניתוק חשבון Google Drive — הקבצים נשארים אצלך, אך הלקוחות לא יוכלו לגשת אליהם דרך האפליקציה.</li>
            </ul>
          )}

          <button
            onClick={() => setExpanded(v => !v)}
            className="text-xs font-medium text-amber-700 hover:text-amber-900 mt-2 flex items-center gap-1"
          >
            {expanded ? (
              <>הסתר פרטים <ChevronUp className="w-3 h-3" /></>
            ) : (
              <>הצג תנאים מלאים <ChevronDown className="w-3 h-3" /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}