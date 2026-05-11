import React from 'react';

export default function LeadCategoryTabs({ value, onChange, counts }) {
  const tabs = [
    { value: 'general', label: 'לידים כלליים', count: counts.general || 0 },
    { value: 'course', label: 'קורס צילום', count: counts.course || 0 },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2" dir="rtl">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={`px-4 py-2.5 rounded-2xl text-sm font-black border transition-all ${
            value === tab.value
              ? 'bg-black text-white border-black shadow-lg shadow-black/10'
              : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
          }`}
        >
          {tab.label}
          <span className={`mr-2 px-2 py-0.5 rounded-full text-xs ${value === tab.value ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-600'}`}>
            {tab.count}
          </span>
        </button>
      ))}
    </div>
  );
}