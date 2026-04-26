import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Folder, Mail, Phone, Image as ImageIcon } from 'lucide-react';

export default function ClientCard({ client, fileCount, onClick }) {
  return (
    <Card
      onClick={onClick}
      className="cursor-pointer hover:border-[#FFD700] hover:shadow-[0_8px_30px_rgba(255,215,0,0.15)] transition-all duration-300 group rounded-2xl border-slate-200"
    >
      <CardContent className="p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#FFD700] to-[#C5A028] flex items-center justify-center shadow-md flex-shrink-0">
            <Folder className="w-6 h-6 text-black" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-slate-800 truncate group-hover:text-[#C5A028] transition-colors">
              {client.full_name || 'לקוח ללא שם'}
            </h3>
            <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
              <Mail className="w-3 h-3" />
              <span className="truncate">{client.email}</span>
            </div>
            {client.phone && (
              <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                <Phone className="w-3 h-3" />
                <span>{client.phone}</span>
              </div>
            )}
          </div>
        </div>
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-slate-600 font-medium">
            <ImageIcon className="w-3.5 h-3.5 text-[#FFD700]" />
            {fileCount} קבצים
          </span>
          <span className="text-[#C5A028] font-bold opacity-0 group-hover:opacity-100 transition-opacity">פתח תיקייה ←</span>
        </div>
      </CardContent>
    </Card>
  );
}