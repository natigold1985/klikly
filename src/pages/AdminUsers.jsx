import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Shield, User, Mail, Phone, UserPlus, Calendar, Camera, Users as UsersIcon, Pencil, Trash2, MessageCircle, FolderOpen, Merge, Plus, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import AddUserDialog from '../components/admin/AddUserDialog';
import EditUserRoleDialog from '../components/admin/EditUserRoleDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function AdminUsers() {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [deletingUser, setDeletingUser] = useState(null);
  const [mergePrimary, setMergePrimary] = useState(null);
  const [isMerging, setIsMerging] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const queryClient = useQueryClient();

  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    setIsDeleting(true);
    try {
      const res = await base44.functions.invoke('deleteUser', { user_id: deletingUser.id });
      if (res.data?.error) throw new Error(res.data.error);
      toast.success('המשתמש נמחק מהמערכת');
      queryClient.invalidateQueries({ queryKey: ['adminAllUsers'] });
      setDeletingUser(null);
    } catch (e) {
      toast.error(e.message || 'שגיאה במחיקה');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleMergeClients = async (secondaryUser) => {
    if (!mergePrimary || !secondaryUser || mergePrimary.id === secondaryUser.id) return;
    setIsMerging(true);
    const res = await base44.functions.invoke('mergeClients', {
      primary_user_id: mergePrimary.id,
      secondary_user_id: secondaryUser.id,
    });
    if (res.data?.success) {
      toast.success(`לקוחות אוחדו — ${res.data.emails?.length || 0} מיילים נשמרו`);
      setMergePrimary(null);
      queryClient.invalidateQueries({ queryKey: ['adminAllUsers'] });
      queryClient.invalidateQueries({ queryKey: ['adminClientProjects'] });
    } else {
      toast.error(res.data?.error || 'שגיאה באיחוד לקוחות');
    }
    setIsMerging(false);
  };

  const handleClientEmailsSaved = () => {
    queryClient.invalidateQueries({ queryKey: ['adminAllUsers'] });
    queryClient.invalidateQueries({ queryKey: ['adminClientProjects'] });
  };

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const isAdmin = user?.role === 'admin' || user?.email === 'natigold04@gmail.com';

  const { data: allUsers = [], isLoading, refetch: refetchUsers } = useQuery({
    queryKey: ['adminAllUsers'],
    queryFn: async () => {
      try {
        const res = await base44.functions.invoke('getAllUsers', {});
        return res.data?.users || [];
      } catch {
        toast.error('שגיאה בטעינת משתמשים');
        return [];
      }
    },
    enabled: !!isAdmin,
  });

  const { data: clientProjects = [] } = useQuery({
    queryKey: ['adminClientProjects'],
    queryFn: () => base44.entities.Project.list('-created_date', 300),
    enabled: !!isAdmin,
  });

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center space-y-4">
          <Shield className="w-16 h-16 text-red-500 mx-auto" />
          <h2 className="text-2xl font-bold text-slate-800">גישה נדחתה</h2>
          <p className="text-slate-600">רק מנהל מערכת מורשה לצפות בעמוד זה.</p>
        </div>
      </div>
    );
  }

  const photographers = allUsers.filter(u => u.role === 'admin' || u.role === 'user');
  const clients = allUsers.filter(u => u.role === 'client' && u.is_active !== false);

  return (
    <div className="space-y-6 pb-20" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-extrabold text-[#FFD700] drop-shadow-[0_0_8px_rgba(255,215,0,0.4)] tracking-wider mb-1">ניהול משתמשים</h1>
          <p className="text-slate-600 text-sm">צלמים ולקוחות במערכת</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)} className="gap-2">
          <UserPlus className="w-4 h-4" />
          משתמש חדש
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-[#FFD700] rounded-full animate-spin" />
        </div>
      ) : (
        <Tabs defaultValue="photographers" className="space-y-4">
          <TabsList className="bg-slate-100">
            <TabsTrigger value="photographers" className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#D4AF37] data-[state=active]:to-[#C5A028] data-[state=active]:text-black">
              <Camera className="w-4 h-4" /> צלמים ({photographers.length})
            </TabsTrigger>
            <TabsTrigger value="clients" className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#D4AF37] data-[state=active]:to-[#C5A028] data-[state=active]:text-black">
              <UsersIcon className="w-4 h-4" /> לקוחות ({clients.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="photographers">
            <UserGrid users={photographers} type="photographer" onEdit={setEditingUser} onDelete={setDeletingUser} currentUserEmail={user?.email} />
          </TabsContent>
          <TabsContent value="clients">
            {mergePrimary && (
              <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 flex items-center justify-between gap-3">
                <div className="text-sm text-amber-900">
                  בחר כרטיס לקוח נוסף למיזוג עם <strong>{mergePrimary.full_name || mergePrimary.email}</strong>
                </div>
                <Button size="sm" variant="outline" onClick={() => setMergePrimary(null)} className="text-slate-900 border-slate-300">
                  ביטול איחוד
                </Button>
              </div>
            )}
            <UserGrid
              users={clients}
              type="client"
              projects={clientProjects}
              onEdit={setEditingUser}
              onDelete={setDeletingUser}
              currentUserEmail={user?.email}
              mergePrimary={mergePrimary}
              isMerging={isMerging}
              onStartMerge={setMergePrimary}
              onConfirmMerge={handleMergeClients}
              onEmailsSaved={handleClientEmailsSaved}
            />
          </TabsContent>
        </Tabs>
      )}

      <AddUserDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onCreated={async (created) => {
          // Optimistically add the new member to the cards so it appears instantly,
          // then refetch from the server to replace it with the real record.
          if (created?.email) {
            queryClient.setQueryData(['adminAllUsers'], (prev = []) => {
              if (prev.some((u) => (u.email || '').toLowerCase() === created.email.toLowerCase())) return prev;
              return [
                { id: `temp-${created.email}`, email: created.email, full_name: created.full_name || created.email, phone: created.phone || '', role: created.role || 'user', is_active: true, created_date: new Date().toISOString() },
                ...prev,
              ];
            });
          }
          await refetchUsers();
        }}
      />

      <EditUserRoleDialog
        open={!!editingUser}
        onOpenChange={(o) => !o && setEditingUser(null)}
        user={editingUser}
        photographers={photographers}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['adminAllUsers'] })}
      />

      <AlertDialog open={!!deletingUser} onOpenChange={(o) => !o && !isDeleting && setDeletingUser(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>למחוק את המשתמש?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deletingUser?.full_name || deletingUser?.email}</strong> יוסר לחלוטין מהמערכת ולא יוכל להיכנס יותר. ניתן להזמין אותו שוב בעתיד.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel disabled={isDeleting}>ביטול</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} disabled={isDeleting} className="bg-red-600 hover:bg-red-700 text-white">
              {isDeleting ? 'מוחק...' : 'מחק לצמיתות'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function UserGrid({ users, type, projects = [], onEdit, onDelete, currentUserEmail, mergePrimary, isMerging, onStartMerge, onConfirmMerge, onEmailsSaved }) {
  if (users.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-12 text-center text-slate-500">
          {type === 'client' ? 'אין לקוחות במערכת' : 'אין צלמים נוספים'}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {users.map((u) => {
        const isUserAdmin = u.role === 'admin' || u.email === 'natigold04@gmail.com';
        const userEmails = [u.email, ...(Array.isArray(u.emails) ? u.emails : [])].filter(Boolean);
        const project = type === 'client'
          ? projects.find((p) => {
              const projectEmails = [p.client_email, ...(Array.isArray(p.client_emails) ? p.client_emails : [])].filter(Boolean);
              return projectEmails.some((email) => userEmails.map((e) => e.toLowerCase()).includes(email.toLowerCase()));
            })
          : null;
        const phoneDigits = String(u.phone || '').replace(/[^0-9]/g, '');
        const whatsappPhone = phoneDigits.startsWith('0') ? `972${phoneDigits.slice(1)}` : phoneDigits;
        const openFiles = () => {
          const query = project?.id ? `project_id=${project.id}` : `client_email=${encodeURIComponent(u.email || '')}`;
          window.location.href = `/FileStorage?${query}`;
        };
        return (
          <Card key={u.id} className="hover:shadow-lg transition-all border-slate-200 relative group overflow-hidden">
            <div className="absolute top-3 left-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-all z-10">
              <button
                onClick={() => onEdit?.(u)}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-[#FFD700] hover:text-black text-slate-600 flex items-center justify-center transition-colors"
                title="ערוך תפקיד"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              {u.email !== currentUserEmail && u.email !== 'natigold04@gmail.com' && (
                <button
                  onClick={() => onDelete?.(u)}
                  className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-red-500 hover:text-white text-slate-600 flex items-center justify-center transition-colors"
                  title="מחק משתמש"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <CardContent className="p-5">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-200 flex-shrink-0">
                  {isUserAdmin ? <Shield className="w-6 h-6 text-[#FFD700]" /> : <User className="w-6 h-6 text-slate-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-800 truncate">{u.full_name || 'ללא שם'}</h3>
                  <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                    <Mail className="w-3 h-3" />
                    <span className="truncate">{u.email}</span>
                  </div>
                  {type === 'client' && <ClientEmailEditor user={u} onSaved={onEmailsSaved} />}
                  {u.phone ? (
                    <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                      <Phone className="w-3 h-3" />
                      <span>{u.phone}</span>
                    </div>
                  ) : null}
                  <ClientPhoneEditor user={u} onSaved={onEmailsSaved} />
                </div>
              </div>
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <Badge className={
                  isUserAdmin ? 'bg-[#FFD700] text-black hover:bg-[#e6c200]' :
                  u.role === 'client' ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' :
                  'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }>
                  {isUserAdmin ? 'מנהל מערכת' : u.role === 'client' ? 'לקוח' : 'צלם'}
                </Badge>
                <div className="flex items-center gap-1 text-xs text-slate-400">
                  <Calendar className="w-3 h-3" />
                  <span>{new Date(u.created_date).toLocaleDateString('he-IL')}</span>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100 space-y-3 bg-white">
                  {u.assigned_photographer_email && (
                    <div className="text-xs text-slate-500 bg-slate-50 px-2 py-1 rounded">
                      משויך לצלם: <span className="font-medium text-slate-700">{u.assigned_photographer_email}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <a
                      href={u.phone ? `https://wa.me/${whatsappPhone}` : undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => !u.phone && e.preventDefault()}
                      className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-all ${
                        u.phone ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      }`}
                      title="שליחת וואטסאפ"
                    >
                      <MessageCircle className="w-4 h-4" />
                      וואטסאפ
                    </a>
                    <a
                      href={u.email ? `mailto:${u.email}` : undefined}
                      className="flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-all"
                      title="שליחת אימייל"
                    >
                      <Mail className="w-4 h-4" />
                      אימייל
                    </a>
                  </div>

                  {type === 'client' && (
                    <Button
                      onClick={() => mergePrimary ? onConfirmMerge?.(u) : onStartMerge?.(u)}
                      disabled={isMerging || mergePrimary?.id === u.id}
                      variant="outline"
                      className="w-full gap-2 text-sm text-slate-900 border-slate-300 bg-white hover:bg-slate-50"
                    >
                      <Merge className="w-4 h-4" />
                      {mergePrimary ? (mergePrimary.id === u.id ? 'לקוח ראשי נבחר' : 'מזג לתוך הלקוח הנבחר') : 'איחוד לקוח'}
                    </Button>
                  )}

                  <Button onClick={openFiles} className="w-full gap-2 text-sm">
                    <FolderOpen className="w-4 h-4" />
                    מעבר לתיקיית קבצים
                  </Button>
                  {type === 'client' && !project && (
                    <p className="text-[11px] text-amber-600 text-center">
                      לא נמצא פרויקט ללקוח — האחסון ייפתח מסונן לפי האימייל.
                    </p>
                  )}
                </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function ClientPhoneEditor({ user, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState(user.phone || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await base44.entities.TeamMember.update(user.id, { phone });
      toast.success('מספר הטלפון עודכן');
      setEditing(false);
      onSaved?.();
    } catch (e) {
      toast.error('שגיאה בעדכון טלפון');
    }
    setSaving(false);
  };

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="mt-1 text-[11px] text-emerald-700 hover:text-emerald-900 font-bold flex items-center gap-1"
      >
        <Plus className="w-3 h-3" />
        {user.phone ? `ערוך טלפון` : 'הוסף טלפון'}
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-2 rounded-xl border border-emerald-100 bg-emerald-50/40 p-2">
      <Input
        value={phone}
        dir="ltr"
        className="h-8 text-xs bg-white"
        placeholder="05X-XXXXXXX"
        onChange={(e) => setPhone(e.target.value)}
      />
      <div className="flex gap-1">
        <Button size="sm" onClick={save} disabled={saving} className="h-8 flex-1">
          <Save className="w-3 h-3" /> שמור
        </Button>
        <Button size="sm" variant="outline" onClick={() => setEditing(false)} className="h-8 text-slate-900 border-slate-300 bg-white">
          <X className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

function ClientEmailEditor({ user, onSaved }) {
  const initialEmails = [user.email, ...(Array.isArray(user.emails) ? user.emails : [])].filter(Boolean);
  const [editing, setEditing] = useState(false);
  const [emails, setEmails] = useState(initialEmails.length ? initialEmails : ['']);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const res = await base44.functions.invoke('updateClientEmails', { user_id: user.id, emails });
    if (res.data?.success) {
      toast.success('המיילים של הלקוח עודכנו');
      setEditing(false);
      onSaved?.();
    } else {
      toast.error(res.data?.error || 'שגיאה בעדכון מיילים');
    }
    setSaving(false);
  };

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="mt-2 text-[11px] text-blue-700 hover:text-blue-900 font-bold flex items-center gap-1"
      >
        <Plus className="w-3 h-3" />
        {emails.length > 1 ? `עריכת ${emails.length} מיילים` : 'הוסף מייל נוסף'}
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-2 rounded-xl border border-blue-100 bg-blue-50/40 p-2">
      {emails.map((email, index) => (
        <Input
          key={index}
          value={email}
          dir="ltr"
          className="h-8 text-xs bg-white"
          placeholder="client@email.com"
          onChange={(e) => setEmails((prev) => prev.map((item, i) => i === index ? e.target.value : item))}
        />
      ))}
      <div className="flex gap-1">
        <Button size="sm" variant="outline" onClick={() => setEmails([...emails, ''])} className="h-8 text-slate-900 border-slate-300 bg-white">
          <Plus className="w-3 h-3" />
        </Button>
        <Button size="sm" onClick={save} disabled={saving} className="h-8 flex-1">
          <Save className="w-3 h-3" /> שמור
        </Button>
        <Button size="sm" variant="outline" onClick={() => setEditing(false)} className="h-8 text-slate-900 border-slate-300 bg-white">
          <X className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}