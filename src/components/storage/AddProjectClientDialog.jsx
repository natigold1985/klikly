import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { UserPlus, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

export default function AddProjectClientDialog({ open, onOpenChange, project, onClientAdded }) {
  const [clientEmail, setClientEmail] = useState('');
  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [mode, setMode] = useState('existing');
  const [loading, setLoading] = useState(false);

  const { data: clients = [] } = useQuery({
    queryKey: ['projectClients'],
    queryFn: () => base44.entities.TeamMember.filter({ role: 'client' }, 'full_name', 300),
    enabled: open && mode === 'existing',
  });

  const handleSubmit = async () => {
    try {
      setLoading(true);

      if (mode === 'existing') {
        // Add existing client
        if (!clientEmail) {
          toast.error('בחר לקוח מהרשימה');
          return;
        }

        const selectedClient = clients.find((c) => c.email === clientEmail);
        if (!selectedClient) {
          toast.error('הלקוח לא נמצא');
          return;
        }

        // Update project with client email
        const existingEmails = Array.isArray(project.client_emails) ? project.client_emails : [];
        const updatedEmails = [...new Set([...existingEmails, clientEmail])];

        await base44.entities.Project.update(project.id, {
          client_emails: updatedEmails,
        });

        toast.success(`${selectedClient.full_name} נוסף לפרויקט בהצלחה`);
      } else {
        // Create and add new client
        if (!newClientName || !newClientEmail) {
          toast.error('נא למלא שם ומייל');
          return;
        }

        const res = await base44.functions.invoke('inviteClient', {
          full_name: newClientName,
          email: newClientEmail,
          phone: '',
        });

        if (!res.data?.success) {
          toast.error(res.data?.error || 'שגיאה ביצירת הלקוח');
          return;
        }

        // Add to project
        const existingEmails = Array.isArray(project.client_emails) ? project.client_emails : [];
        const updatedEmails = [...new Set([...existingEmails, newClientEmail])];

        await base44.entities.Project.update(project.id, {
          client_emails: updatedEmails,
        });

        toast.success('הלקוח החדש נוסף לפרויקט בהצלחה');
      }

      onClientAdded?.();
      setClientEmail('');
      setNewClientName('');
      setNewClientEmail('');
      setMode('existing');
      onOpenChange(false);
    } catch (e) {
      toast.error(e.message || 'שגיאה בתהליך');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-[#FFD700]" />
            הוסף לקוח לפרויקט
          </DialogTitle>
          <DialogDescription>
            בחר לקוח קיים או צור לקוח חדש — הוא יוכל לראות את כל הקבצים והגלריה שלו
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Mode toggle */}
          <div className="flex gap-2 border rounded-lg p-1 bg-slate-50">
            <button
              onClick={() => setMode('existing')}
              className={`flex-1 px-3 py-2 rounded font-medium text-sm transition-colors ${
                mode === 'existing'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              בחר קיים
            </button>
            <button
              onClick={() => setMode('new')}
              className={`flex-1 px-3 py-2 rounded font-medium text-sm transition-colors ${
                mode === 'new'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              צור חדש
            </button>
          </div>

          {mode === 'existing' ? (
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">בחר לקוח *</label>
              <Select value={clientEmail} onValueChange={setClientEmail}>
                <SelectTrigger>
                  <SelectValue placeholder="בחר לקוח מהרשימה..." />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.email}>
                      {client.full_name || client.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">שם מלא *</label>
                <Input
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="ישראל ישראלי"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">מייל (Gmail) *</label>
                <Input
                  type="email"
                  value={newClientEmail}
                  onChange={(e) => setNewClientEmail(e.target.value)}
                  placeholder="client@gmail.com"
                />
                <p className="text-xs text-slate-400 mt-1">יוא יקבל הזמנה לתחבר דרך Google שלו</p>
              </div>
            </>
          )}

          <Button onClick={handleSubmit} disabled={loading} className="w-full gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            {loading ? 'מוסיף...' : 'הוסף לפרויקט'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}