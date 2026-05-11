import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function LeadsDashboard() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/Leads', { replace: true });
  }, [navigate]);

  return (
    <div className="min-h-[50vh] flex items-center justify-center" dir="rtl">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-[#D4AF37] rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-slate-500">מעביר לדשבורד הלידים המרכזי...</p>
      </div>
    </div>
  );
}