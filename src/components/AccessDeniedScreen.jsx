import React from 'react';
import { base44 } from '@/api/base44Client';
import { Shield, LogOut, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AccessDeniedScreen({ user }) {
  const handleLogout = () => base44.auth.logout(window.location.origin);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#050505] p-6" dir="rtl">
      <div className="max-w-md w-full bg-[#0a0a0a] rounded-2xl border border-[#FFD700]/20 shadow-[0_0_40px_rgba(255,215,0,0.1)] p-8 text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 mb-6 rounded-full bg-red-500/10 border border-red-500/30">
          <Shield className="w-10 h-10 text-red-400" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-3">אין לך גישה</h1>
        <p className="text-white/70 mb-2">
          אין לך הרשאת גישה למערכת.
        </p>
        <p className="text-white/50 text-sm mb-8">
          לקבלת גישה — פנה למנהל המערכת.
        </p>

        {user?.email && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6 text-right">
            <div className="flex items-center gap-2 text-xs text-white/50 mb-1">
              <Mail className="w-3.5 h-3.5" />
              <span>מחובר כעת בתור</span>
            </div>
            <p className="text-white text-sm font-medium truncate">{user.email}</p>
            {user.full_name && <p className="text-white/60 text-xs mt-0.5">{user.full_name}</p>}
          </div>
        )}

        <Button onClick={handleLogout} variant="outline" className="w-full gap-2">
          <LogOut className="w-4 h-4" />
          התנתק
        </Button>
      </div>
    </div>
  );
}