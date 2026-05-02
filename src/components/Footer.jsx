import React from 'react';
import { Link } from 'react-router-dom';

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-slate-200 bg-white text-slate-600 py-4 px-4 md:px-8" dir="rtl">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2 text-xs">
        <p className="text-slate-500">
          © {year} <span className="font-bold text-slate-700">Klikly</span> · כל הזכויות שמורות לנתי גולד
        </p>
        <div className="flex items-center gap-4">
          <Link to="/PrivacyPolicy" className="hover:text-[#C5A028] transition-colors">מדיניות פרטיות</Link>
          <span className="text-slate-300">|</span>
          <Link to="/TermsOfService" className="hover:text-[#C5A028] transition-colors">תנאי שימוש</Link>
          <span className="text-slate-300">|</span>
          <Link to="/Accessibility" className="hover:text-[#C5A028] transition-colors">הצהרת נגישות</Link>
        </div>
      </div>
    </footer>
  );
}