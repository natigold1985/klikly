import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, CheckCircle2, Circle, Calendar, Flag, Trash2, Pencil, AlertTriangle, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import PushNotificationToggle from '@/components/PushNotificationToggle';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const emptyTask = {
  title: '',
  description: '',
  due_date: '',
  priority: 'medium',
};

const toLocalInputDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
};

const toIsoDate = (value) => value ? new Date(value).toISOString() : '';

export default function Tasks() {
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [taskForm, setTaskForm] = useState(emptyTask);
  const queryClient = useQueryClient();

  const { data: user } = useQuery({ queryKey: ['currentUser'], queryFn: () => base44.auth.me() });

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks', user?.email],
    queryFn: () => base44.entities.Task.filter({ created_by: user.email }, 'due_date', 200),
    enabled: !!user?.email,
  });

  const resetDialog = () => {
    setEditingTask(null);
    setTaskForm(emptyTask);
    setShowTaskDialog(false);
  };

  const createTaskMutation = useMutation({
    mutationFn: (taskData) => base44.entities.Task.create(taskData),
    onSuccess: resetDialog,
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Task.update(id, data),
    onSuccess: resetDialog,
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (task) => {
      await base44.functions.invoke('syncTaskToCalendar', { action: 'delete', task }).catch(() => {});
      return base44.entities.Task.delete(task.id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const saveTask = () => {
    if (!taskForm.title || !taskForm.due_date) return;
    const data = {
      title: taskForm.title,
      description: taskForm.description,
      due_date: toIsoDate(taskForm.due_date),
      priority: taskForm.priority,
      status: editingTask?.status || 'pending',
      stage: editingTask?.stage || 'general',
    };

    if (editingTask) updateTaskMutation.mutate({ id: editingTask.id, data });
    else createTaskMutation.mutate(data);
  };

  const openCreateDialog = () => {
    setEditingTask(null);
    setTaskForm(emptyTask);
    setShowTaskDialog(true);
  };

  const openEditDialog = (task) => {
    setEditingTask(task);
    setTaskForm({
      title: task.title || '',
      description: task.description || '',
      due_date: toLocalInputDate(task.due_date),
      priority: task.priority || 'medium',
    });
    setShowTaskDialog(true);
  };

  const toggleTaskStatus = (task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    updateTaskMutation.mutate({
      id: task.id,
      data: {
        status: newStatus,
        completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
      },
    });
  };

  const pendingTasks = tasks
    .filter((task) => task.status !== 'completed')
    .sort((a, b) => new Date(a.due_date || 0) - new Date(b.due_date || 0));
  const completedTasks = tasks.filter((task) => task.status === 'completed');
  const now = new Date();
  const urgentTasks = pendingTasks.filter((task) => {
    if (!task.due_date) return task.priority === 'high';
    const due = new Date(task.due_date);
    const within24Hours = due.getTime() - now.getTime() <= 24 * 60 * 60 * 1000;
    return task.priority === 'high' || due < now || within24Hours;
  });

  const getPriorityColor = (priority) => {
    const colors = {
      high: 'bg-red-100 text-red-700 border-red-300',
      medium: 'bg-yellow-100 text-yellow-700 border-yellow-300',
      low: 'bg-blue-100 text-blue-700 border-blue-300',
    };
    return colors[priority] || colors.medium;
  };

  const getPriorityLabel = (priority) => {
    const labels = { high: 'דחוף', medium: 'בינוני', low: 'נמוך' };
    return labels[priority] || priority;
  };

  const formatDate = (value) => value ? new Date(value).toLocaleDateString('he-IL', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }) : '';

  const TaskCard = ({ task, completed = false }) => (
    <div className={`p-4 rounded-xl bg-white border shadow-sm ${completed ? 'border-green-200 opacity-85' : task.priority === 'high' ? 'border-red-300 shadow-red-100' : 'border-[#FFD700]'}`}>
      <div className="flex items-start gap-3">
        <button onClick={() => toggleTaskStatus(task)} className="mt-1 flex-shrink-0" title={completed ? 'החזר לפעילות' : 'סמן כהושלם'}>
          {completed ? <CheckCircle2 className="w-5 h-5 text-green-500 hover:text-slate-400 transition-colors" /> : <Circle className="w-5 h-5 text-slate-400 hover:text-green-500 transition-colors" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className={`font-bold text-slate-800 ${completed ? 'line-through text-slate-500' : ''}`}>{task.title}</h3>
            <Badge className={getPriorityColor(task.priority)}>
              <Flag className="w-3 h-3 ml-1" />
              {getPriorityLabel(task.priority)}
            </Badge>
          </div>
          {task.description && <p className="text-sm text-slate-600 mb-2 whitespace-pre-wrap">{task.description}</p>}
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            {task.due_date && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {formatDate(task.due_date)}
              </span>
            )}
            {task.google_calendar_event_id && <span className="text-green-600 font-bold">מסונכרן ליומן</span>}
            {completed && task.completed_at && <span>הושלם ב-{new Date(task.completed_at).toLocaleDateString('he-IL')}</span>}
          </div>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {!completed && (
              <Button variant="outline" size="sm" onClick={() => toggleTaskStatus(task)} className="h-9 gap-1 text-green-700 border-green-200 bg-green-50 hover:bg-green-100">
                <CheckCircle2 className="w-4 h-4" />
                סיום
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => openEditDialog(task)} className="h-9 gap-1 text-slate-900 border-slate-300 bg-white hover:bg-slate-50">
              <Pencil className="w-4 h-4" />
              עריכה
            </Button>
            <Button variant="outline" size="sm" onClick={() => deleteTaskMutation.mutate(task)} className="h-9 gap-1 text-red-600 border-red-200 bg-red-50 hover:bg-red-100">
              <Trash2 className="w-4 h-4" />
              מחיקה
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">משימות</h1>
          <p className="text-slate-500 text-sm mt-0.5">משימות פעילות למעלה, משימות דחופות קופצות בהתראות ומסתנכרנות ליומן Google</p>
        </div>
        <Dialog open={showTaskDialog} onOpenChange={(open) => open ? setShowTaskDialog(true) : resetDialog()}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog} className="bg-[#FFD700] hover:bg-[#e6c200] text-black font-bold shadow-[0_0_15px_rgba(255,215,0,0.3)] gap-3">
              <Plus className="w-5 h-5" />
              משימה חדשה
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]" dir="rtl">
            <DialogHeader>
              <DialogTitle>{editingTask ? 'עריכת משימה' : 'משימה חדשה'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">כותרת *</label>
                <Input value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} placeholder="לחזור ללקוח..." />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">תיאור</label>
                <textarea
                  value={taskForm.description}
                  onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                  placeholder="פרטים נוספים..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FFD700]"
                  rows="3"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">תאריך יעד *</label>
                  <Input value={taskForm.due_date} onChange={(e) => setTaskForm({ ...taskForm, due_date: e.target.value })} type="datetime-local" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">עדיפות</label>
                  <Select value={taskForm.priority} onValueChange={(value) => setTaskForm({ ...taskForm, priority: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">נמוך</SelectItem>
                      <SelectItem value="medium">בינוני</SelectItem>
                      <SelectItem value="high">דחוף</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={saveTask} className="w-full bg-[#FFD700] hover:bg-[#e6c200] text-black font-bold" disabled={!taskForm.title || !taskForm.due_date || createTaskMutation.isPending || updateTaskMutation.isPending}>
                {editingTask ? 'שמור שינויים' : 'צור משימה'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="bg-red-50 border-red-200 shadow-sm">
        <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 mt-1" />
            <div>
              <h2 className="font-extrabold text-red-800">משימות דחופות</h2>
              <p className="text-sm text-red-700">{urgentTasks.length ? `${urgentTasks.length} משימות דורשות טיפול דחוף` : 'אין כרגע משימות דחופות'}</p>
            </div>
          </div>
          <div className="min-w-[260px] bg-white rounded-xl border border-red-100 p-3">
            <PushNotificationToggle />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white border-[#FFD700] shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <Bell className="w-5 h-5 text-[#FFD700]" />
              <h2 className="text-lg font-bold text-slate-800">משימות פעילות</h2>
              <Badge className="bg-[#FFD700] text-black font-bold">{pendingTasks.length}</Badge>
            </div>
            <div className="space-y-3">
              {isLoading ? <p className="text-slate-500 text-center py-8">טוען משימות...</p> : pendingTasks.length === 0 ? <p className="text-slate-500 text-center py-8">אין משימות פעילות</p> : pendingTasks.map((task) => <TaskCard key={task.id} task={task} />)}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-green-200 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <h2 className="text-lg font-bold text-slate-800">משימות שהושלמו</h2>
              <Badge className="bg-green-500 text-white">{completedTasks.length}</Badge>
            </div>
            <div className="space-y-3">
              {completedTasks.length === 0 ? <p className="text-slate-500 text-center py-8">אין משימות שהושלמו</p> : completedTasks.map((task) => <TaskCard key={task.id} task={task} completed />)}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}