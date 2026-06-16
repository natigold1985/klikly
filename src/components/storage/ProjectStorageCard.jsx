import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Briefcase, FolderOpen, Eye, Upload, ListTodo, Mail, Phone } from 'lucide-react';
import DeliveryLinkButton from '@/components/DeliveryLinkButton';
import ProductionStatusTracker from '@/components/projects/ProductionStatusTracker';
import GoogleDriveIcon from './GoogleDriveIcon';
import MagicLinkButton from './MagicLinkButton';

const STATUS_LABELS = {
  pending_payment: 'ממתין לתשלום',
  paid: 'שולם',
  shooting_scheduled: 'צילום מתוכנן',
  shooting_done: 'צילום בוצע',
  awaiting_selection: 'ממתין לבחירת לקוח',
  editing: 'בעריכה',
  ready_for_download: 'מוכן להורדה',
  completed: 'הושלם',
};

export default function ProjectStorageCard({ project, onOpen }) {
  const connected = !!project.drive_folder_url;

  return (
    <Card className="bg-white border-slate-200 hover:border-[#FFD700] hover:shadow-[0_10px_28px_rgba(15,23,42,0.10)] transition-[border-color,box-shadow] duration-200 rounded-2xl overflow-hidden font-sans">
      <CardContent className="p-5 space-y-4">
        <button onClick={onOpen} className="w-full text-right group">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0 group-hover:bg-[#FFD700]/10 group-hover:border-[#FFD700]">
                {connected ? <GoogleDriveIcon className="w-7 h-7" /> : <Briefcase className="w-6 h-6 text-[#FFD700]" />}
              </div>
              <div className="min-w-0">
                <h3 className="font-black text-slate-900 truncate group-hover:text-[#B8860B]">
                  {project.project_name || project.client_name || 'פרויקט ללא שם'}
                </h3>
                <p className="text-sm text-slate-600 truncate">{project.client_name}</p>
                {project.client_email && (
                  <p className="text-xs text-slate-500 truncate flex items-center gap-1 mt-1" dir="ltr">
                    <Mail className="w-3 h-3" /> {project.client_email}
                  </p>
                )}
                {project.client_phone && (
                  <p className="text-xs text-slate-500 truncate flex items-center gap-1 mt-1" dir="ltr">
                    <Phone className="w-3 h-3" /> {project.client_phone}
                  </p>
                )}
              </div>
            </div>
            <Badge className="bg-[#FFD700] text-black hover:bg-[#FFD700] shrink-0">
              {STATUS_LABELS[project.status] || project.status || 'פעיל'}
            </Badge>
          </div>
        </button>

        <ProductionStatusTracker status={project.status} />

        <div className="grid grid-cols-2 gap-2">
          <Button onClick={onOpen} className="gap-1 bg-black text-white hover:bg-slate-800 text-sm h-10">
            <FolderOpen className="w-4 h-4" />
            ניהול קבצים
          </Button>
          <Button onClick={onOpen} variant="outline" className="gap-2 text-slate-900 border-slate-300 bg-white hover:bg-slate-50 text-sm h-10">
            <Upload className="w-4 h-4" />
            העלאה
          </Button>
          <Link to={createPageUrl(`ProjectTasks?projectId=${project.id}`)} className="min-w-0">
            <Button variant="outline" className="w-full gap-1 text-slate-900 border-slate-300 bg-white hover:bg-slate-50 text-sm h-10">
              <ListTodo className="w-4 h-4" />
              משימות
            </Button>
          </Link>
          <Link to={createPageUrl(`ProjectDetails?id=${project.id}`)} className="min-w-0">
            <Button variant="outline" className="w-full gap-1 text-slate-900 border-slate-300 bg-white hover:bg-slate-50 text-sm h-10">
              <Eye className="w-4 h-4" />
              פרטים
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
          <DeliveryLinkButton project={project} />
          <MagicLinkButton project={project} compact />
          <Link to={createPageUrl(`ClientGallery?projectId=${project.id}`)}>
            <Button variant="outline" className="w-full gap-1 text-slate-900 border-slate-300 bg-white hover:bg-slate-50 text-xs h-10">
              <Eye className="w-3 h-3" />
              בחירה
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}