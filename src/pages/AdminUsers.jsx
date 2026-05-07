import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Shield, User, Mail, Phone, UserPlus, Calendar, Camera, Users as UsersIcon, Pencil, Trash2, MessageCircle, FolderOpen } from 'lucide-react';
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

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const isAdmin = user?.role === 'admin' || user?.email === 'natigold04@gmail.com';

  const { data: allUsers = [], isLoading } = useQuery({
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
  const clients = allUsers.filter(u => u.role === 'client');

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
            <UserGrid users={clients} type="client" projects={clientProjects} onEdit={setEditingUser} onDelete={setDeletingUser} currentUserEmail={user?.email} />
          </TabsContent>
        </Tabs>
      )}

      <AddUserDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onCreated={() => queryClient.invalidateQueries({ queryKey: ['adminAllUsers'] })}
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

function UserGrid({ users, type, projects = [], onEdit, onDelete, currentUserEmail }) {
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
        const project = type === 'client'
          ? projects.find((p) => p.client_email?.toLowerCase() === u.email?.toLowerCase())
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
                  {u.phone && (
                    <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                      <Phone className="w-3 h-3" />
                      <span>{u.phone}</span>
                    </div>
                  )}
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