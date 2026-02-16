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

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => base44.entities.Task.list('-due_date', 200),
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
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            משימות
          </h1>
          <p className="text-slate-600 mt-1">נהל את המשימות וה-Follow up שלך</p>
        </div>
        <Dialog open={showNewTaskDialog} onOpenChange={setShowNewTaskDialog}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-lg">
              <Plus className="w-5 h-5 ml-2" />
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
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
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
        <Card className="bg-white/60 backdrop-blur-sm border-white/20 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Circle className="w-5 h-5 text-orange-500" />
              <h2 className="text-lg font-bold text-slate-800">משימות פעילות</h2>
              <Badge className="bg-orange-500 text-white">{pendingTasks.length}</Badge>
            </div>
            <div className="space-y-3">
              {pendingTasks.length === 0 ? (
                <p className="text-slate-500 text-center py-8">אין משימות פעילות</p>
              ) : (
                pendingTasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-4 rounded-lg bg-white hover:shadow-md transition-all border border-slate-200"
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
        <Card className="bg-white/60 backdrop-blur-sm border-white/20 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
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
                    className="p-4 rounded-lg bg-green-50 border border-green-200"
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
      </div>
    </div>
  );
}