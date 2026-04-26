import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Pencil } from 'lucide-react';

export default function EditUserRoleDialog({ open, onOpenChange, user, photographers = [], onSaved }) {
  const [role, setRole] = useState('user');
  const [photographerEmail, setPhotographerEmail] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setRole(user.role || 'user');
      setPhotographerEmail(user.assigned_photographer_email || '');
    }
  }, [user]);

  if (!user) return null;

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('updateUserRole', {
        user_id: user.id,
        role,
        assigned_photographer_email: role === 'client' ? photographerEmail : null,
      });
      if (res.data?.success) {
        toast.success('התפקיד עודכן');
        onSaved?.();
        onOpenChange(false);
      } else {
        toast.error(res.data?.error || 'שגיאה בעדכון');
      }
    } catch (e) {
      toast.error(e.message || 'שגיאה בעדכון');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-5 h-5 text-[#FFD700]" />
            עריכת תפקיד
          </DialogTitle>
          <DialogDescription>
            {user.full_name} ({user.email})
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">תפקיד</label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">מנהל מערכת</SelectItem>
                <SelectItem value="user">צלם</SelectItem>
                <SelectItem value="client">לקוח</SelectItem>
                <SelectItem value="pending">ממתין לאישור / חסום</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {role === 'client' && (
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">משויך לצלם</label>
              <Select value={photographerEmail} onValueChange={setPhotographerEmail}>
                <SelectTrigger><SelectValue placeholder="בחר צלם" /></SelectTrigger>
                <SelectContent>
                  {photographers.map(p => (
                    <SelectItem key={p.id} value={p.email}>
                      {p.full_name} ({p.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button onClick={handleSave} disabled={loading} className="w-full">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'שמור שינויים'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}