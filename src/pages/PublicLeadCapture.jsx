import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle2 } from 'lucide-react';

export default function PublicLeadCapture() {
  const [form, setForm] = useState({ name: '', phone: '', notes: '' });
  const [sent, setSent] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    await base44.functions.invoke('publicLeadFormSubmit', form);
    setSent(true);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6" dir="rtl">
      <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl">
        {sent ? (
          <div className="text-center py-8">
            <CheckCircle2 className="w-14 h-14 text-green-600 mx-auto mb-4" />
            <h1 className="text-2xl font-black text-slate-900">הפרטים נשלחו</h1>
            <p className="text-slate-500 mt-2">נחזור אליך בהקדם.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <h1 className="text-2xl font-black text-slate-900">טופס ליד חדש</h1>
            <Input required placeholder="שם מלא" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input required placeholder="טלפון" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <textarea className="w-full rounded-xl border border-slate-200 p-3 text-sm" rows="4" placeholder="הערות" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <Button className="w-full">שליחה</Button>
          </form>
        )}
      </div>
    </div>
  );
}