import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LEAD_STATUSES, STATUS_LABELS } from './statusConfig';

export default function LeadEditDialog({ lead, open, onOpenChange, onSave }) {
  const [status, setStatus] = useState('New Lead');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (lead) {
      setStatus(lead.status || 'New Lead');
      setNotes(lead.full_name_notes || '');
    }
  }, [lead]);

  if (!lead) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white text-slate-900" dir="rtl">
        <DialogHeader>
          <DialogTitle>עריכת ליד</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-xl bg-slate-50 p-4 text-sm space-y-1">
            <p><span className="font-bold">שם:</span> {lead.first_name || '—'}</p>
            <p><span className="font-bold">טלפון:</span> {lead.phone_number}</p>
            <p><span className="font-bold">מקור:</span> {lead.source || '—'}</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold">סטטוס</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="bg-white text-slate-900 border-slate-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEAD_STATUSES.map((item) => (
                  <SelectItem key={item} value={item}>{STATUS_LABELS[item]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold">שם מלא והערות פנימיות</label>
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="min-h-32 bg-white text-slate-900 border-slate-200"
              placeholder="כתוב הערות פנימיות..."
            />
          </div>
          <Button className="w-full" onClick={() => onSave(lead.id, { status, full_name_notes: notes })}>
            שמירה
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}