import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Circle, Calendar, Flag, AlertTriangle, Clock, UserRound, Image, FolderOpen, ExternalLink, Trash2, Mail, MessageCircle } from 'lucide-react';
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
  const [visibleCount, setVisibleCount] = useState(5);
  const [deletingId, setDeletingId] = useState(null);
  const queryClient = useQueryClient();
  const projectById = new Map(projects.map((project) => [project.id, project]));

  const formatSentAt = (dateStr) => {
    if (!dateStr) return 'לא צוין זמן שליחה';
    return new Date(dateStr).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const deleteTask = async (taskId) => {
    if (!window.confirm('למחוק את המשימה הזו?')) return;
    setDeletingId(taskId);
    await base44.entities.Task.delete(taskId);
    await queryClient.invalidateQueries({ queryKey: ['dashboard_tasks'] });
    setDeletingId(null);
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
    });

  const visibleTasks = pendingTasks.slice(0, visibleCount);
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
          <div className="flex items-center gap-2">
            <select
              value={visibleCount}
              onChange={(event) => setVisibleCount(Number(event.target.value))}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-bold text-slate-700"
              aria-label="כמות משימות להצגה"
            >
              <option value={3}>3 משימות</option>
              <option value={5}>5 משימות</option>
              <option value={8}>8 משימות</option>
              <option value={20}>20 משימות</option>
            </select>
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
            {visibleTasks.map(task => {
              const config = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
              const PriorityIcon = config.icon;
              const overdue = isOverdue(task.due_date);
              const today = isDueToday(task.due_date);
              const days = daysUntilDue(task.due_date);

              const project = task.related_to_type === 'project' ? projectById.get(task.related_to_id) : null;
              const clientFromDescription = task.description?.match(/הלקוח\s+(.+?)\s+בחר/)?.[1];
              const clientName = project?.client_name || clientFromDescription || task.title.split('—').pop()?.trim() || 'לקוח לא מזוהה';
              const clientPhone = project?.client_phone?.replace(/[^0-9]/g, '');
              const clientEmail = project?.client_email;
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
                            {new Date(task.due_date).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-2">
                          {clientPhone && (
                            <a href={`https://wa.me/${clientPhone}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] font-black text-green-600 hover:text-green-800 transition-colors">
                              <MessageCircle className="w-3.5 h-3.5" />
                              וואטסאפ ללקוח
                            </a>
                          )}
                          {clientEmail && (
                            <a href={`mailto:${clientEmail}`} className="inline-flex items-center gap-1 text-[11px] font-black text-blue-600 hover:text-blue-800 transition-colors">
                              <Mail className="w-3.5 h-3.5" />
                              מייל ללקוח
                            </a>
                          )}
                          {task.related_to_id && (
                            <Link to={createPageUrl(`ProjectDetails?id=${task.related_to_id}`)} className="inline-flex items-center gap-1 text-[11px] font-black text-[#C5A028] hover:text-black transition-colors">
                              <FolderOpen className="w-3.5 h-3.5" />
                              פתח פרויקט
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                          )}
                          <button
                            type="button"
                            onClick={() => deleteTask(task.id)}
                            disabled={deletingId === task.id}
                            className="inline-flex items-center gap-1 text-[11px] font-black text-red-600 hover:text-red-800 disabled:opacity-50 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            {deletingId === task.id ? 'מוחק...' : 'מחק'}
                          </button>
                        </div>
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