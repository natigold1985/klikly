import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  CheckCircle2, Circle, Clock, Plus, ArrowRight,
  Camera, Image as ImageIcon, Send, Calendar as CalendarIcon,
  Bell, ListTodo, Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const STAGES = [
  { id: 'before_shooting', label: 'לפני צילום', icon: CalendarIcon, color: 'text-blue-500', bg: 'bg-blue-50' },
  { id: 'shooting_day', label: 'יום הצילום', icon: Camera, color: 'text-indigo-500', bg: 'bg-indigo-50' },
  { id: 'editing', label: 'עריכה', icon: ImageIcon, color: 'text-orange-500', bg: 'bg-orange-50' },
  { id: 'gallery_delivery', label: 'משלוח גלריה', icon: Send, color: 'text-green-500', bg: 'bg-green-50' },
  { id: 'general', label: 'כללי', icon: ListTodo, color: 'text-slate-500', bg: 'bg-slate-50' },
];

export default function ProjectTasks() {
  const urlParams = new URLSearchParams(window.location.search);
  const projectId = urlParams.get('projectId');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeStage, setActiveStage] = useState('before_shooting');
  const [showNewTaskDialog, setShowNewTaskDialog] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    due_date: '',
    withReminder: false
  });

  // Fetch project details
  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => base44.entities.Project.get(projectId),
    enabled: !!projectId,
  });

  // Fetch tasks for this project
  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['projectTasks', projectId],
    queryFn: () => base44.entities.Task.filter({ related_to_type: 'project', related_to_id: projectId }, '-created_date', 100),
    enabled: !!projectId,
  });

  const createTaskMutation = useMutation({
    mutationFn: (taskData) => base44.entities.Task.create(taskData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projectTasks', projectId] });
      setShowNewTaskDialog(false);
      setNewTask({ title: '', due_date: '', withReminder: false });
      toast.success('משימה נוספה בהצלחה');
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Task.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projectTasks', projectId] });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (id) => base44.entities.Task.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projectTasks', projectId] });
      toast.success('משימה נמחקה');
    }
  });

  const handleCreateTask = () => {
    if (!newTask.title) return;
    
    const taskData = {
      related_to_type: 'project',
      related_to_id: projectId,
      title: newTask.title,
      stage: activeStage,
      status: 'pending',
      priority: 'medium',
    };

    if (newTask.withReminder && newTask.due_date) {
      taskData.due_date = new Date(newTask.due_date).toISOString();
    } else {
      taskData.due_date = new Date(new Date().setHours(23, 59, 59, 999)).toISOString(); // Default end of day
    }

    createTaskMutation.mutate(taskData);
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

  if (projectLoading || tasksLoading) {
    return <div className="p-8 text-center"><div className="animate-spin w-8 h-8 border-2 border-indigo-600 rounded-full border-t-transparent mx-auto"></div></div>;
  }

  if (!project) {
    return <div className="p-8 text-center text-slate-500">פרויקט לא נמצא</div>;
  }

  const tasksByStage = STAGES.reduce((acc, stage) => {
    acc[stage.id] = tasks.filter(t => (t.stage === stage.id) || (!t.stage && stage.id === 'general'));
    return acc;
  }, {});

  const currentTasks = tasksByStage[activeStage] || [];
  const completedCount = currentTasks.filter(t => t.status === 'completed').length;
  const progress = currentTasks.length > 0 ? Math.round((completedCount / currentTasks.length) * 100) : 0;

  return (
    <div className="space-y-6 pb-20" dir="rtl">
      <div className="flex items-center gap-4 mb-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full shrink-0">
          <ArrowRight className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 leading-tight">ניהול משימות (Checklist)</h1>
          <p className="text-slate-500 text-sm">פרויקט: {project.client_name}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {STAGES.map(stage => {
          const Icon = stage.icon;
          const isActive = activeStage === stage.id;
          const stageTasks = tasksByStage[stage.id] || [];
          const doneTasks = stageTasks.filter(t => t.status === 'completed').length;
          const isAllDone = stageTasks.length > 0 && doneTasks === stageTasks.length;

          return (
            <button
              key={stage.id}
              onClick={() => setActiveStage(stage.id)}
              className={`p-4 rounded-xl border text-right transition-all flex flex-col gap-3 relative overflow-hidden ${
                isActive 
                  ? 'bg-white border-[#FFD700] shadow-md ring-1 ring-[#FFD700]' 
                  : 'bg-white border-slate-200 hover:border-[#FFD700]/50'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg ${stage.bg} flex items-center justify-center ${stage.color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <div className="font-semibold text-sm text-slate-800">{stage.label}</div>
                <div className="text-xs text-slate-500">{doneTasks}/{stageTasks.length} הושלמו</div>
              </div>
              {isAllDone && (
                <div className="absolute top-3 left-3 text-green-500">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      <Card className="bg-white border-[#FFD700] shadow-sm mt-6">
        <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${STAGES.find(s=>s.id === activeStage)?.bg}`}>
               {React.createElement(STAGES.find(s=>s.id === activeStage)?.icon || ListTodo, { className: `w-5 h-5 ${STAGES.find(s=>s.id === activeStage)?.color}` })}
            </div>
            <CardTitle className="text-lg">{STAGES.find(s=>s.id === activeStage)?.label}</CardTitle>
          </div>
          <Button onClick={() => setShowNewTaskDialog(true)} size="sm" className="bg-[#FFD700] hover:bg-[#e6c200] text-black font-bold gap-3">
            <Plus className="w-4 h-4" />
            משימה חדשה
          </Button>
        </CardHeader>
        <CardContent className="pt-6">
          
          <div className="mb-6">
            <div className="flex justify-between text-xs mb-1.5 text-slate-500 font-medium">
              <span>התקדמות השלב</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div className="bg-[#FFD700] h-full rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
            </div>
          </div>

          <div className="space-y-3">
            {currentTasks.length === 0 ? (
              <div className="text-center py-10 text-slate-500 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                <ListTodo className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                אין משימות לשלב זה.<br/>לחץ על "משימה חדשה" כדי להתחיל.
              </div>
            ) : (
              currentTasks.map(task => (
                <div key={task.id} className={`flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl border transition-all gap-3 ${task.status === 'completed' ? 'bg-slate-50 border-[#FFD700] opacity-75' : 'bg-white border-[#FFD700] shadow-sm hover:shadow-md'}`}>
                  <div className="flex items-start gap-3 flex-1 cursor-pointer" onClick={() => toggleTaskStatus(task)}>
                    <button className="mt-0.5 shrink-0 focus:outline-none">
                      {task.status === 'completed' ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                      ) : (
                        <Circle className="w-5 h-5 text-slate-300 hover:text-indigo-400 transition-colors" />
                      )}
                    </button>
                    <div className={task.status === 'completed' ? 'line-through text-slate-500' : 'text-slate-800 font-medium'}>
                      {task.title}
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto pl-8 sm:pl-0">
                    {task.due_date && task.status !== 'completed' && (
                      <Badge variant="outline" className="text-xs bg-orange-50 text-orange-600 border-orange-200 px-2 py-0.5">
                        <Clock className="w-3 h-3 ml-1.5" />
                        {new Date(task.due_date).toLocaleDateString('he-IL', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </Badge>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); deleteTaskMutation.mutate(task.id); }} className="text-slate-300 hover:text-red-500 transition-colors p-1 rounded-md hover:bg-red-50">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={showNewTaskDialog} onOpenChange={setShowNewTaskDialog}>
        <DialogContent className="sm:max-w-[420px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>הוספת משימה ל{STAGES.find(s=>s.id === activeStage)?.label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block text-slate-700">מטלה</label>
              <Input 
                value={newTask.title} 
                onChange={(e) => setNewTask({...newTask, title: e.target.value})} 
                placeholder="למשל: תיאום ציפיות עם הלקוח"
                autoFocus
              />
            </div>
            
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <input 
                  type="checkbox" 
                  id="reminder" 
                  className="w-4 h-4 text-[#FFD700] rounded border-slate-300 focus:ring-[#FFD700]"
                  checked={newTask.withReminder}
                  onChange={(e) => setNewTask({...newTask, withReminder: e.target.checked})}
                />
                <label htmlFor="reminder" className="text-sm font-semibold flex items-center gap-1.5 cursor-pointer text-slate-700">
                  <Bell className="w-4 h-4 text-slate-500" />
                  הגדר תזכורת עתידית
                </label>
              </div>

              {newTask.withReminder && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-200 pl-7">
                  <label className="text-xs font-medium mb-1.5 block text-slate-500">מועד התזכורת</label>
                  <Input 
                    type="datetime-local" 
                    value={newTask.due_date} 
                    onChange={(e) => setNewTask({...newTask, due_date: e.target.value})} 
                    className="text-sm"
                  />
                </div>
              )}
            </div>

            <Button onClick={handleCreateTask} className="w-full mt-2 h-11 text-base bg-[#FFD700] hover:bg-[#e6c200] text-black font-bold gap-3" disabled={!newTask.title}>
              שמור משימה
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}