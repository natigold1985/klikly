import React from 'react';
import { Upload, Eye, Palette, Download, CheckCircle2 } from 'lucide-react';

const STAGES = [
  { key: 'shooting_done', label: 'הועלה', icon: Upload },
  { key: 'awaiting_selection', label: 'בחירת לקוח', icon: Eye },
  { key: 'editing', label: 'בעריכה', icon: Palette },
  { key: 'ready_for_download', label: 'מוכן למסירה', icon: Download },
  { key: 'completed', label: 'הושלם', icon: CheckCircle2 },
];

const STATUS_ORDER = {
  pending_payment: 0,
  paid: 0,
  shooting_scheduled: 0,
  shooting_done: 1,
  awaiting_selection: 2,
  editing: 3,
  ready_for_download: 4,
  completed: 5,
};

export default function ProductionStatusTracker({ status }) {
  const currentIndex = STATUS_ORDER[status] ?? 0;

  return (
    <div className="flex items-center gap-1 w-full">
      {STAGES.map((stage, i) => {
        const Icon = stage.icon;
        const isActive = currentIndex >= (i + 1);
        const isCurrent = STATUS_ORDER[status] === (i + 1);
        return (
          <div key={stage.key} className="flex items-center flex-1 min-w-0">
            <div className={`flex flex-col items-center gap-1 flex-shrink-0 ${isCurrent ? 'scale-110' : ''} transition-transform`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                isActive 
                  ? 'bg-[#FFD700] text-black shadow-sm' 
                  : 'bg-slate-100 text-slate-400'
              }`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
              <span className={`text-[9px] text-center leading-tight font-medium ${isActive ? 'text-[#C5A028]' : 'text-slate-400'}`}>
                {stage.label}
              </span>
            </div>
            {i < STAGES.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 rounded-full transition-colors ${
                currentIndex > (i + 1) ? 'bg-[#FFD700]' : 'bg-slate-200'
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
}