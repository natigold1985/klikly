import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, CheckCircle2, Circle, Calendar, Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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

export default function Tasks() {
  const [showNewTaskDialog, setShowNewTaskDialog] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    due_date: '',
    priority: 'medium',
  });

  const queryClient = useQueryClient();

  const { data: user } = useQuery({ queryKey: ['currentUser'], queryFn: () => base44.auth.me() });
  const isAdmin = user?.role === 'admin' || user?.email === 'natigold04@gmail.com';

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks', user?.email],
    queryFn: () => base44.entities.Task.filter({ created_by: user.email }, '-due_date', 200),
    enabled: !!user?.email,
  });

  const createTaskMutation = useMutation({
    mutationFn: (taskData) => base44.entities.Task.create(taskData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setShowNewTaskDialog(false);
      setNewTask({
        title: '',
        description: '',
        due_date: '',
        priority: 'medium',
      });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Task.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const handleCreateTask = () => {
    if (!newTask.title || !newTask.due_date) return;
    createTaskMutation.mutate(newTask);
  };

  const toggleTaskStatus = (task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    updateTaskMutation.mutate({
      id: task.id,
      data: {
        ...task,
        status: newStatus,
        completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
      },
    });
  };

  const pendingTasks = tasks.filter(t => t.status === 'pending');
  const completedTasks = tasks.filter(t => t.status === 'completed');

  const getPriorityColor = (priority) => {
    const colors = {
      high: 'bg-red-100 text-red-700 border-red-300',
      medium: 'bg-yellow-100 text-yellow-700 border-yellow-300',
      low: 'bg-blue-100 text-blue-700 border-blue-300',
    };
    return colors[priority] || colors.medium;
  };

  const getPriorityLabel = (priority) => {
    const labels = {
      high: 'דחוף',
      medium: 'בינוני',
      low: 'נמוך',
    };
    return labels[priority] || priority;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">
            משימות
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">נהל משימות ו-Follow Up — מסודר לפי תאריך ודחיפות</p>
        </div>
        <Dialog open={showNewTaskDialog} onOpenChange={setShowNewTaskDialog}>
          <DialogTrigger asChild>
            <Button className="bg-[#FFD700] hover:bg-[#e6c200] text-black font-bold shadow-[0_0_15px_rgba(255,215,0,0.3)] transition-all hover:-translate-y-0.5 gap-3">
              <Plus className="w-5 h-5" />
              משימה חדשה
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]" dir="rtl">
            <DialogHeader>
              <DialogTitle>משימה חדשה</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">כותרת *</label>
                <Input
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  placeholder="לחזור ללקוח..."
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">תיאור</label>
                <textarea
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  placeholder="פרטים נוספים..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FFD700]"
                  rows="3"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">תאריך יעד *</label>
                  <Input
                    value={newTask.due_date}
                    onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                    type="datetime-local"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">עדיפות</label>
                  <Select value={newTask.priority} onValueChange={(value) => setNewTask({ ...newTask, priority: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">נמוך</SelectItem>
                      <SelectItem value="medium">בינוני</SelectItem>
                      <SelectItem value="high">דחוף</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                onClick={handleCreateTask}
                className="w-full bg-[#FFD700] hover:bg-[#e6c200] text-black font-bold shadow-[0_0_15px_rgba(255,215,0,0.3)] transition-all hover:-translate-y-0.5 gap-3"
                disabled={!newTask.title || !newTask.due_date}
              >
                צור משימה
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tasks Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Tasks */}
        <Card className="bg-white border-[#FFD700] shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <Circle className="w-5 h-5 text-[#FFD700]" />
              <h2 className="text-lg font-bold text-slate-800">משימות פעילות</h2>
              <Badge className="bg-[#FFD700] text-black font-bold">{pendingTasks.length}</Badge>
            </div>
            <div className="space-y-3">
              {pendingTasks.length === 0 ? (
                <p className="text-slate-500 text-center py-8">אין משימות פעילות</p>
              ) : (
                pendingTasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-4 rounded-lg bg-white hover:shadow-md transition-all border border-[#FFD700] shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => toggleTaskStatus(task)}
                        className="mt-1 flex-shrink-0"
                      >
                        <Circle className="w-5 h-5 text-slate-400 hover:text-green-500 transition-colors" />
                      </button>
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-medium text-slate-800">{task.title}</h3>
                          <Badge className={getPriorityColor(task.priority)}>
                            <Flag className="w-3 h-3 ml-1" />
                            {getPriorityLabel(task.priority)}
                          </Badge>
                        </div>
                        {task.description && (
                          <p className="text-sm text-slate-600 mb-2">{task.description}</p>
                        )}
                        <div className="flex items-center gap-1 text-xs text-slate-500">
                          <Calendar className="w-3 h-3" />
                          {new Date(task.due_date).toLocaleDateString('he-IL', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Completed Tasks */}
        {isAdmin && (
        <Card className="bg-white border-[#FFD700] shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <h2 className="text-lg font-bold text-slate-800">משימות שהושלמו</h2>
              <Badge className="bg-green-500 text-white">{completedTasks.length}</Badge>
            </div>
            <div className="space-y-3">
              {completedTasks.length === 0 ? (
                <p className="text-slate-500 text-center py-8">אין משימות שהושלמו</p>
              ) : (
                completedTasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-4 rounded-lg bg-white border border-[#FFD700] opacity-80"
                  >
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => toggleTaskStatus(task)}
                        className="mt-1 flex-shrink-0"
                      >
                        <CheckCircle2 className="w-5 h-5 text-green-500 hover:text-slate-400 transition-colors" />
                      </button>
                      <div className="flex-1">
                        <h3 className="font-medium text-slate-700 line-through">{task.title}</h3>
                        {task.completed_at && (
                          <p className="text-xs text-slate-500 mt-1">
                            הושלם ב-{new Date(task.completed_at).toLocaleDateString('he-IL')}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
        )}
      </div>
    </div>
  );
}