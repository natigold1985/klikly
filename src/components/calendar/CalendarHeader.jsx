import React from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function CalendarHeader({ monthLabel, onPrev, onNext, onToday }) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-black text-white p-6 shadow-2xl shadow-slate-300/40">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-[#FFD700] text-black flex items-center justify-center shadow-lg shadow-yellow-500/20">
          <CalendarDays className="w-7 h-7" />
        </div>
        <div>
          <p className="text-sm text-white/50 font-bold">יומן לידים סגורים</p>
          <h1 className="text-3xl md:text-4xl font-black">{monthLabel}</h1>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button onClick={onNext} variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
          <ChevronRight className="w-4 h-4" />
        </Button>
        <Button onClick={onToday} className="bg-[#FFD700] hover:bg-[#E5B800] text-black font-bold">היום</Button>
        <Button onClick={onPrev} variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
          <ChevronLeft className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}