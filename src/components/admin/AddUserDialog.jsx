import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { UserPlus, Loader2 } from 'lucide-react';

export default function AddUserDialog({ open, onOpenChange, onCreated }) {
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', role: 'user' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!form.full_name || !form.email || !form.role) {
      toast.error('נא למלא את כל השדות');
      return;
    }
    setLoading(true);
    try {
      const res = await base44.functions.invoke('invitePhotographer', form);
      if (res.data?.success) {
        toast.success('המשתמש הוזמן בהצלחה — מייל הזמנה נשלח');
        setForm({ full_name: '', email: '', phone: '', role: 'user' });
        onCreated?.();
        onOpenChange(false);
      } else {
        toast.error(res.data?.error || 'שגיאה ביצירת המשתמש');
      }
    } catch (e) {
      toast.error(e?.response?.data?.error || e.message || 'שגיאה ביצירת המשתמש');
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
            הוספת משתמש חדש
          </DialogTitle>
          <DialogDescription>
            המשתמש יקבל מייל הזמנה לכניסה למערכת
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">שם מלא *</label>
            <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="ישראל ישראלי" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">מייל (מזהה כניסה) *</label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="user@gmail.com" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">טלפון</label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="050-1234567" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">תפקיד *</label>
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">מנהל מערכת</SelectItem>
                <SelectItem value="user">צלם</SelectItem>
                <SelectItem value="client">לקוח</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleSubmit} disabled={loading} className="w-full">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><UserPlus className="w-4 h-4" /> צור משתמש</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}