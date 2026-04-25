import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, Camera, Send } from 'lucide-react';

export default function PublicLeadForm() {
  const [form, setForm] = useState({ name: '', phone: '', email: '', shooting_type: '', notes: '' });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.phone) return;
    setLoading(true);
    await base44.entities.Lead.create({
      ...form,
      source: 'Public Form',
      status: 'new',
      last_contact_date: new Date().toISOString(),
    });
    setSubmitted(true);
    setLoading(false);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black flex items-center justify-center p-6" dir="rtl">
        <Card className="max-w-md w-full bg-slate-900/80 border-[#FFD700]/30 backdrop-blur-xl rounded-3xl shadow-2xl">
          <CardContent className="p-10 text-center">
            <div className="w-20 h-20 rounded-full bg-[#FFD700]/20 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-[#FFD700]" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">תודה שפנית אלינו!</h2>
            <p className="text-slate-400">קיבלנו את הפרטים שלך ונחזור אליך בהקדם.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black flex items-center justify-center p-6" dir="rtl">
      <Card className="max-w-md w-full bg-slate-900/80 border-[#FFD700]/30 backdrop-blur-xl rounded-3xl shadow-2xl">
        <CardContent className="p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#FFD700] to-[#C5A028] flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#FFD700]/20">
              <Camera className="w-8 h-8 text-black" />
            </div>
            <h1 className="text-2xl font-bold text-white">צרו איתנו קשר</h1>
            <p className="text-slate-400 text-sm mt-1">מלאו את הפרטים ונחזור אליכם בהקדם</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-300 mb-1 block">שם מלא *</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="השם שלך"
                required
                className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-[#FFD700]"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300 mb-1 block">טלפון *</label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="050-1234567"
                required
                type="tel"
                className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-[#FFD700]"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300 mb-1 block">אימייל</label>
              <Input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="email@example.com"
                type="email"
                className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-[#FFD700]"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300 mb-1 block">סוג צילום</label>
              <Input
                value={form.shooting_type}
                onChange={(e) => setForm({ ...form, shooting_type: e.target.value })}
                placeholder="חתונה, בר מצווה, אירוע..."
                className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-[#FFD700]"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300 mb-1 block">הערות</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="ספרו לנו עוד..."
                rows={3}
                className="w-full px-3 py-2 rounded-xl bg-slate-800/50 border border-slate-700 text-white placeholder:text-slate-500 focus:border-[#FFD700] focus:outline-none"
              />
            </div>
            <Button
              type="submit"
              disabled={loading || !form.name || !form.phone}
              className="w-full h-12 text-base gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  שליחה
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}