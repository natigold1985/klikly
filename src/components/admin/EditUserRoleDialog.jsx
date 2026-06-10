import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';

export default function EditUserRoleDialog({ open, onOpenChange, user, photographers = [], onSaved }) {
  const [role, setRole] = useState('user');
  const [photographerEmail, setPhotographerEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [emails, setEmails] = useState(['']);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setRole(user.role || 'user');
      setPhotographerEmail(user.assigned_photographer_email || '');
      setFullName(user.full_name || '');
      setPhone(user.phone || '');
      const allEmails = [user.email, ...(Array.isArray(user.emails) ? user.emails : [])].filter(Boolean);
      setEmails(allEmails.length ? allEmails : [user.email || '']);
    }
  }, [user]);

  if (!user) return null;

  const handleSave = async () => {
    setLoading(true);
    try {
      // Update role
      const roleRes = await base44.functions.invoke('updateUserRole', {
        user_id: user.id,
        role,
        assigned_photographer_email: role === 'client' ? photographerEmail : null,
      });
      if (!roleRes.data?.success) throw new Error(roleRes.data?.error || 'שגיאה בעדכון תפקיד');

      // Update TeamMember fields (phone, full_name, emails)
      const extraEmails = emails.filter((e, i) => i > 0 && e.trim());
      await base44.entities.TeamMember.update(user.id, {
        phone: phone.trim() || null,
        full_name: fullName.trim() || user.full_name,
        emails: extraEmails,
      });

      // Update emails via dedicated function if client
      if (role === 'client' && emails.length > 0) {
        await base44.functions.invoke('updateClientEmails', {
          user_id: user.id,
          emails: emails.filter(Boolean),
        });
      }

      toast.success('המשתמש עודכן בהצלחה');
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(e.message || 'שגיאה בעדכון');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-5 h-5 text-[#FFD700]" />
            עריכת משתמש
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Full Name */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">שם מלא</label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="שם מלא" />
          </div>

          {/* Phone */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">טלפון / WhatsApp</label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="05X-XXXXXXX"
              dir="ltr"
            />
          </div>

          {/* Emails */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">כתובות מייל</label>
            <div className="space-y-2">
              {emails.map((email, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={email}
                    onChange={(e) => setEmails(prev => prev.map((v, idx) => idx === i ? e.target.value : v))}
                    placeholder="email@example.com"
                    dir="ltr"
                    className="flex-1 text-sm"
                    disabled={i === 0}
                  />
                  {i > 0 && (
                    <button
                      onClick={() => setEmails(prev => prev.filter((_, idx) => idx !== i))}
                      className="w-9 h-9 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center flex-shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => setEmails(prev => [...prev, ''])}
                className="text-xs text-blue-700 hover:text-blue-900 font-bold flex items-center gap-1 mt-1"
              >
                <Plus className="w-3 h-3" />
                הוסף מייל נוסף
              </button>
            </div>
          </div>

          {/* Role */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">תפקיד</label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">מנהל מערכת</SelectItem>
                <SelectItem value="user">צלם</SelectItem>
                <SelectItem value="client">לקוח</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Assigned photographer (clients only) */}
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

          <Button onClick={handleSave} disabled={loading} className="w-full mt-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'שמור שינויים'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}