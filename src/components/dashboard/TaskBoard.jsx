import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { CheckCircle2, Circle, Calendar, Flag, AlertTriangle, Clock, UserRound, Image, FolderOpen, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const PRIORITY_CONFIG = {
  high: { label: 'דחוף', bgColor: 'bg-red-50', borderColor: 'border-red-300', textColor: 'text-red-700', badgeColor: 'bg-red-100 text-red-700', icon: AlertTriangle },
  medium: { label: 'בינוני', bgColor: 'bg-amber-50', borderColor: 'border-amber-300', textColor: 'text-amber-700', badgeColor: 'bg-amber-100 text-amber-700', icon: Clock },
  low: { label: 'נמוך', bgColor: 'bg-blue-50', borderColor: 'border-blue-200', textColor: 'text-blue-600', badgeColor: 'bg-blue-100 text-blue-600', icon: Flag },
};

function isOverdue(dateStr) {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

function isDueToday(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

function daysUntilDue(dateStr) {
  if (!dateStr) return null;
  const diff = Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
  return diff;
}

export default function TaskBoard({ tasks = [], projects = [] }) {
  const projectById = new Map(projects.map((project) => [project.id, project]));

  const formatSentAt = (dateStr) => {
    if (!dateStr) return 'לא צוין זמן שליחה';
    return new Date(dateStr).toLocaleString('he-IL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  const getEditingDetails = (task) => {
    const details = task.description || '';
    if (details.includes('קבצים:')) return details.split('קבצים:').pop().replace(/\.$/, '').trim();
    return details || task.title;
  };

  const pendingTasks = tasks
    .filter(t => t.status === 'pending')
    .sort((a, b) => {
      // Sort: overdue first, then by priority (high > medium > low), then by date
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const aOverdue = isOverdue(a.due_date) ? -1 : 0;
      const bOverdue = isOverdue(b.due_date) ? -1 : 0;
      if (aOverdue !== bOverdue) return aOverdue - bOverdue;
      const aPri = priorityOrder[a.priority] ?? 1;
      const bPri = priorityOrder[b.priority] ?? 1;
      if (aPri !== bPri) return aPri - bPri;
      return new Date(a.due_date || 0) - new Date(b.due_date || 0);
    })
    .slice(0, 8);

  const overdueTasks = pendingTasks.filter(t => isOverdue(t.due_date));
  const todayTasks = pendingTasks.filter(t => isDueToday(t.due_date) && !isOverdue(t.due_date));

  return (
    <Card className="border rounded-2xl overflow-hidden">
      <CardHeader className="pb-3 border-b bg-gradient-to-l from-red-50/50 to-white">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="w-5 h-5 text-[#C5A028]" />
            משימות פתוחות
          </CardTitle>
          <div className="flex gap-2">
            {overdueTasks.length > 0 && (
              <Badge className="bg-red-100 text-red-700 text-[10px] font-bold gap-1">
                <AlertTriangle className="w-3 h-3" />
                {overdueTasks.length} באיחור
              </Badge>
            )}
            {todayTasks.length > 0 && (
              <Badge className="bg-amber-100 text-amber-700 text-[10px] font-bold">
                {todayTasks.length} להיום
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        {pendingTasks.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-300" />
            <p>אין משימות פתוחות — כל הכבוד! 🎉</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pendingTasks.map(task => {
              const config = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
              const PriorityIcon = config.icon;
              const overdue = isOverdue(task.due_date);
              const today = isDueToday(task.due_date);
              const days = daysUntilDue(task.due_date);

              const project = task.related_to_type === 'project' ? projectById.get(task.related_to_id) : null;
              const clientFromDescription = task.description?.match(/הלקוח\s+(.+?)\s+בחר/)?.[1];
              const clientName = project?.client_name || clientFromDescription || task.title.split('—').pop()?.trim() || 'לקוח לא מזוהה';
              const editingDetails = getEditingDetails(task);

              return (
                <div
                  key={task.id}
                  className={`p-3 rounded-xl border transition-all hover:shadow-sm ${
                    overdue ? 'bg-red-50 border-red-200' : today ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-100 hover:border-slate-200'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-start gap-3">
                    <Circle className={`w-4 h-4 flex-shrink-0 mt-1 ${overdue ? 'text-red-400' : today ? 'text-amber-400' : 'text-slate-300'}`} />
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                        <p className={`text-sm font-extrabold ${overdue ? 'text-red-800' : 'text-slate-900'}`}>
                          {task.title}
                        </p>
                        <Badge className={`${config.badgeColor} text-[10px] font-bold gap-1 shrink-0 w-fit`}>
                          <PriorityIcon className="w-3 h-3" />
                          {config.label}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[12px]">
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <UserRound className="w-3.5 h-3.5 text-[#C5A028]" />
                          <span className="font-bold">לקוח:</span>
                          <span className="truncate">{clientName}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <Image className="w-3.5 h-3.5 text-[#C5A028]" />
                          <span className="font-bold">צריך לערוך:</span>
                          <span className="truncate">{editingDetails}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <Clock className="w-3.5 h-3.5 text-[#C5A028]" />
                          <span className="font-bold">נשלח:</span>
                          <span>{formatSentAt(task.created_date)}</span>
                        </div>
                      </div>
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                        {task.due_date && (
                          <p className={`text-[11px] flex items-center gap-1 ${
                            overdue ? 'text-red-500 font-bold' : today ? 'text-amber-600 font-bold' : 'text-slate-400'
                          }`}>
                            <Calendar className="w-3 h-3" />
                            {overdue ? `באיחור!` : today ? 'היום' : days !== null && days <= 3 ? `עוד ${days} ימים` : ''}
                            {' '}
                            {new Date(task.due_date).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })}
                          </p>
                        )}
                        {task.related_to_id && (
                          <Link to={createPageUrl(`ProjectDetails?id=${task.related_to_id}`)} className="inline-flex items-center gap-1 text-[11px] font-black text-[#C5A028] hover:text-black transition-colors w-fit">
                            <FolderOpen className="w-3.5 h-3.5" />
                            פתח פרויקט
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <Link to={createPageUrl('Tasks')}>
          <Button variant="ghost" className="w-full mt-3 text-xs text-[#C5A028] hover:bg-[#FFD700]/10 border border-dashed border-[#C5A028]/30 rounded-lg">
            כל המשימות ←
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}