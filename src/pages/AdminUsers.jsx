import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Shield, User, Mail, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function AdminUsers() {
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
        return res.data.users || [];
      } catch (err) {
        toast.error("אין לך הרשאות לצפות ברשימת המשתמשים או שהתרחשה שגיאה.");
        return [];
      }
    },
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

  return (
    <div className="space-y-6 pb-20">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">ניהול משתמשים</h1>
        <p className="text-slate-600">צפה בכל המשתמשים והלקוחות הרשומים למערכת</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {allUsers.map((u) => {
            const isUserAdmin = u.role === 'admin' || u.email === 'natigold04@gmail.com';
            
            return (
              <Card key={u.id} className="hover:shadow-lg transition-all duration-300 border-white/20 bg-white/60 backdrop-blur-sm group">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center border border-indigo-100 shadow-sm flex-shrink-0 group-hover:scale-105 transition-transform">
                      {isUserAdmin ? (
                        <Shield className="w-7 h-7 text-indigo-500" />
                      ) : (
                        <User className="w-7 h-7 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-slate-800 truncate" title={u.full_name}>
                        {u.full_name || 'משתמש ללא שם'}
                      </h3>
                      <div className="flex items-center gap-1.5 text-sm text-slate-500 mt-1">
                        <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate" title={u.email}>{u.email}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                    <Badge className={isUserAdmin ? 'bg-indigo-500 hover:bg-indigo-600' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}>
                      {isUserAdmin ? 'מנהל מערכת' : 'לקוח'}
                    </Badge>
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <Calendar className="w-3 h-3" />
                      <span>{new Date(u.created_date).toLocaleDateString('he-IL')}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}