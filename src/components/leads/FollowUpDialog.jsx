import React, { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export default function FollowUpDialog({ open, onOpenChange, lead, onSave }) {
  const [date, setDate] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (open) {
      setDate('');
      setNote('');
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[430px] bg-white text-slate-900" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-black">
            <Clock className="w-5 h-5 text-[#C5A028]" />
            תזמון פולו-אפ
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-slate-500">בחר מועד ותזכורת פנימית עבור {lead?.name || 'הליד'}.</p>
          <Input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className="bg-white border-slate-200" />
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="הערת פולו-אפ פנימית..." className="min-h-28 bg-white border-slate-200" />
          <Button disabled={!date} onClick={() => onSave(date, note)} className="w-full">
            שמור פולו-אפ
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}