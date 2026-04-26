import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { UserPlus, Loader2 } from 'lucide-react';

export default function CreateClientDialog({ open, onOpenChange, onCreated }) {
  const [form, setForm] = useState({ full_name: '', email: '', phone: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!form.full_name || !form.email) {
      toast.error('נא למלא שם ומייל');
      return;
    }
    setLoading(true);
    try {
      const res = await base44.functions.invoke('inviteClient', form);
      if (res.data?.success) {
        toast.success(
          res.data.alreadyExisted
            ? 'הלקוח כבר היה קיים — שויך אליך בהצלחה'
            : 'הלקוח הוזמן בהצלחה — מייל הזמנה נשלח'
        );
        setForm({ full_name: '', email: '', phone: '' });
        onCreated?.();
        onOpenChange(false);
      } else {
        toast.error(res.data?.error || 'שגיאה ביצירת הלקוח');
      }
    } catch (e) {
      toast.error(e.message || 'שגיאה ביצירת הלקוח');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-[#FFD700]" />
            הוספת לקוח חדש
          </DialogTitle>
          <DialogDescription>
            הלקוח יקבל מייל הזמנה לכניסה למערכת דרך חשבון Google שלו
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">שם מלא *</label>
            <Input
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              placeholder="ישראל ישראלי"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">מייל (Gmail) *</label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="client@gmail.com"
            />
            <p className="text-xs text-slate-400 mt-1">זה יהיה המייל שדרכו הלקוח יתחבר למערכת</p>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">טלפון</label>
            <Input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="050-1234567"
            />
          </div>
          <Button onClick={handleSubmit} disabled={loading} className="w-full">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><UserPlus className="w-4 h-4" /> צור והזמן לקוח</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}