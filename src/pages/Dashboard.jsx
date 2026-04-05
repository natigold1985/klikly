import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { 
  Users, 
  Briefcase, 
  FileText, 
  CheckCircle2,
  TrendingUp,
  Calendar,
  DollarSign,
  Camera,
  AlertCircle,
  MessageCircle,
  CheckSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

export default function Dashboard() {
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const isClient = user?.role === 'client';

  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    if (user && !isClient) {
      const hasSeenWelcome = localStorage.getItem('hasSeenWelcome_base44');
      if (!hasSeenWelcome) {
        setShowWelcome(true);
      }
    }
  }, [user, isClient]);

  const closeWelcome = () => {
    setShowWelcome(false);
    localStorage.setItem('hasSeenWelcome_base44', 'true');
  };

  const { data: leads = [] } = useQuery({
    queryKey: ['leads', user?.email],
    queryFn: () => base44.entities.Lead.filter({ created_by: user.email }, '-created_date', 100),
    enabled: !!user && !isClient,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects', user?.email],
    queryFn: () => {
      if (isClient) {
        return base44.entities.Project.filter({ client_email: user.email }, '-created_date', 100);
      }
      return base44.entities.Project.filter({ created_by: user.email }, '-created_date', 100);
    },
    enabled: !!user,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', user?.email],
    queryFn: () => base44.entities.Task.filter({ status: 'pending', created_by: user.email }, '-due_date', 50),
    enabled: !!user,
  });

  const today = new Date().toISOString().split('T')[0];
  const leadsToday = leads.filter(l => l.created_date && l.created_date.startsWith(today)).length;
  const conversionRate = leads.length ? Math.round((projects.length / leads.length) * 100) : 0;
  
  // Photographer Statistics (SaaS UI/UX adapted)
  const photographerStats = [
    {
      title: 'לידים היום',
      value: leadsToday,
      icon: TrendingUp,
      color: 'from-blue-500 to-cyan-500',
      link: 'Leads'
    },
    {
      title: 'אחוז המרה',
      value: `${conversionRate}%`,
      icon: DollarSign,
      color: 'from-purple-500 to-pink-500',
      link: 'Projects'
    },
    {
      title: 'הודעות ממתינות',
      value: leads.filter(l => l.status === 'new').length,
      icon: MessageCircle,
      color: 'from-orange-500 to-red-500',
      link: 'Leads'
    },
    {
      title: 'משימות פעילות',
      value: tasks.length,
      icon: CheckSquare,
      color: 'from-green-500 to-emerald-500',
      link: 'Tasks'
    },
  ];

  // Client Statistics
  const clientStats = [
    {
      title: 'הפרויקטים שלי',
      value: projects.length,
      icon: Briefcase,
      color: 'from-purple-500 to-pink-500',
      link: 'Projects'
    },
    {
      title: 'ממתינים לבחירה',
      value: projects.filter(p => p.status === 'awaiting_selection').length,
      icon: Camera,
      color: 'from-orange-500 to-red-500',
      link: 'Projects'
    },
  ];

  const stats = isClient ? clientStats : photographerStats;
  const recentLeads = leads.slice(0, 5);
  const upcomingTasks = tasks.slice(0, 5);

  const getStatusBadge = (status) => {
    const statusMap = {
      new: { label: 'חדש', color: 'bg-blue-100 text-blue-700' },
      follow_up: { label: 'מעקב', color: 'bg-yellow-100 text-yellow-700' },
      quote_sent: { label: 'הצעה נשלחה', color: 'bg-purple-100 text-purple-700' },
      closed_won: { label: 'נסגר בהצלחה', color: 'bg-green-100 text-green-700' },
      closed_lost: { label: 'נכשל', color: 'bg-red-100 text-red-700' },
    };
    const badge = statusMap[status] || { label: status, color: 'bg-gray-100 text-gray-700' };
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>{badge.label}</span>;
  };

  const urgentLeads = leads.filter(l => {
    const isNew = l.status === 'new';
    const isOld = new Date(l.created_date) < new Date(Date.now() - 24 * 60 * 60 * 1000);
    return isNew && isOld;
  });

  return (
    <>
      <Dialog open={showWelcome} onOpenChange={(open) => {
        if (!open) closeWelcome();
      }}>
        <DialogContent className="sm:max-w-[550px]" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-xl md:text-2xl text-[#D4AF37] font-bold">
              ברוך הבא לעידן ה-Zero Friction. 🚀
            </DialogTitle>
            <DialogDescription asChild>
              <div className="text-slate-700 text-sm md:text-base mt-4 space-y-4 pt-4">
                <div className="font-semibold text-slate-900 text-lg">היי {user?.full_name || 'צלם'}, כאן הצוות של BASE 44.</div>
                <p>החלטת להפסיק לבזבז זמן על אדמיניסטרציה ולהתחיל להתמקד במה שאתה עושה הכי טוב: ליצור.</p>
                <p className="font-medium text-slate-900">המערכת שלך מוכנה. מעכשיו, הכל קורה במקום אחד:</p>
                <ul className="list-none space-y-3">
                  <li className="flex gap-2 items-start"><span className="text-[#D4AF37] font-bold">•</span> <span><strong>ניהול לידים חכם:</strong> קליטה אוטומטית וסגירת חוזים בקליק.</span></li>
                  <li className="flex gap-2 items-start"><span className="text-[#D4AF37] font-bold">•</span> <span><strong>העברת קבצים Magic Link:</strong> שלח גלריות כבדות וקבל התראה לנייד ברגע שהלקוח הוריד אותן (סוף לוויכוחים!).</span></li>
                  <li className="flex gap-2 items-start"><span className="text-[#D4AF37] font-bold">•</span> <span><strong>מינימליזם טכנולוגי:</strong> אפס קליקים מיותרים, מקסימום תוצאות.</span></li>
                </ul>
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 mt-4 text-slate-800">
                  <strong>הצעד הראשון שלך:</strong><br/>היכנס ל-Dashboard, העלה את הלוגו שלך ב'הגדרות', ותראה איך הלינק הראשון שאתה שולח ללקוח הופך אותך למותג פרימיום.
                </div>
                <p className="pt-2 text-slate-600 font-medium">אנחנו כאן כדי לוודא שהעסק שלך רץ על אוטומט.<br/>Team BASE 44</p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end mt-4 pt-2">
            <Button onClick={closeWelcome} className="bg-gradient-to-r from-[#D4AF37] to-[#C5A028] text-black hover:from-[#C5A028] hover:to-[#D4AF37] font-bold shadow-md w-full sm:w-auto">
              כניסה למערכת שלי
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="space-y-6 md:space-y-8">
        {/* Urgent Attention Alert */}
      {urgentLeads.length > 0 && !isClient && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-red-800">דורש טיפול דחוף</h3>
              <p className="text-sm text-red-600">{urgentLeads.length} לידים חדשים ממתינים מעל 24 שעות</p>
            </div>
          </div>
          <Link to={createPageUrl('Leads')}>
            <Button variant="destructive" size="sm">טפל עכשיו</Button>
          </Link>
        </div>
      )}
      {/* Header */}
      <div className="mb-2">
        <h1 className="text-2xl md:text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-1 md:mb-2 truncate leading-normal py-1">
          {isClient ? 'אזור אישי' : 'לוח ניהול'}
        </h1>
        <p className="text-sm md:text-base text-slate-600 truncate">
          {isClient ? `ברוך הבא, ${user?.full_name}` : 'סקירה מהירה של העסק שלך ב-Klikly'}
        </p>
      </div>

      {/* Stats Grid */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${isClient ? 'lg:grid-cols-2' : 'lg:grid-cols-4'} gap-4 md:gap-6`}>
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Link key={index} to={createPageUrl(stat.link)}>
              <Card className="bg-white/90 backdrop-blur-sm border-white/40 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer group h-full overflow-hidden">
                <CardContent className="p-5 md:p-6 flex items-center justify-between h-full">
                  <div className="flex flex-col gap-1 min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-500 truncate w-full pr-2">{stat.title}</p>
                    <p className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight truncate">{stat.value}</p>
                  </div>
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${stat.color} flex items-center justify-center shadow-md group-hover:scale-105 transition-transform flex-shrink-0`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Leads - Only for Photographers */}
        {!isClient && (
          <Card className="bg-white/60 backdrop-blur-sm border-white/20 shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-800">
                <Users className="w-5 h-5 text-indigo-500" />
                לידים אחרונים
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentLeads.length === 0 ? (
                <p className="text-slate-500 text-center py-8">אין לידים עדיין</p>
              ) : (
                <div className="space-y-3">
                  {recentLeads.map((lead) => (
                    <Link key={lead.id} to={createPageUrl(`LeadDetails?id=${lead.id}`)}>
                      <div className="p-4 rounded-lg bg-white/80 hover:bg-white hover:shadow-md transition-all cursor-pointer">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="font-medium text-slate-800">{lead.name}</h3>
                            <p className="text-sm text-slate-500">{lead.shooting_type}</p>
                          </div>
                          {getStatusBadge(lead.status)}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-slate-500">
                          <span>{lead.phone}</span>
                          {lead.event_date && <span>📅 {new Date(lead.event_date).toLocaleDateString('he-IL')}</span>}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
              <Link to={createPageUrl('Leads')}>
                <button className="w-full mt-4 py-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                  צפה בכל הלידים ←
                </button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Upcoming Tasks - For Both */}
        <Card className={`bg-white/60 backdrop-blur-sm border-white/20 shadow-xl ${isClient ? 'lg:col-span-2' : ''}`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-800">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              משימות קרובות
            </CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingTasks.length === 0 ? (
              <p className="text-slate-500 text-center py-8">אין משימות ממתינות</p>
            ) : (
              <div className="space-y-3">
                {upcomingTasks.map((task) => (
                  <div key={task.id} className="p-4 rounded-lg bg-white/80 hover:bg-white hover:shadow-md transition-all">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-medium text-slate-800">{task.title}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        task.priority === 'high' ? 'bg-red-100 text-red-700' :
                        task.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {task.priority === 'high' ? 'דחוף' : task.priority === 'medium' ? 'בינוני' : 'נמוך'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500">
                      📅 {new Date(task.due_date).toLocaleDateString('he-IL')}
                    </p>
                  </div>
                ))}
              </div>
            )}
            <Link to={createPageUrl('Tasks')}>
              <button className="w-full mt-4 py-2 text-sm text-green-600 hover:text-green-700 font-medium">
                צפה בכל המשימות ←
              </button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
    </>
  );
}