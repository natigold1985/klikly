import React, { useState } from 'react';
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
  Camera
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Dashboard() {
  const { data: leads = [] } = useQuery({
    queryKey: ['leads'],
    queryFn: () => base44.entities.Lead.list('-created_date', 100),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list('-created_date', 100),
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => base44.entities.Task.filter({ status: 'pending' }, '-due_date', 50),
  });

  // Statistics
  const stats = [
    {
      title: 'לידים פעילים',
      value: leads.filter(l => !['closed_won', 'closed_lost'].includes(l.status)).length,
      icon: Users,
      color: '#3B82F6',
      link: 'Leads'
    },
    {
      title: 'פרויקטים פתוחים',
      value: projects.filter(p => p.status !== 'completed').length,
      icon: Briefcase,
      color: '#D4AF37',
      link: 'Projects'
    },
    {
      title: 'ממתינים לבחירה',
      value: projects.filter(p => p.status === 'awaiting_selection').length,
      icon: Camera,
      color: '#A855F7',
      link: 'Projects'
    },
    {
      title: 'משימות ממתינות',
      value: tasks.length,
      icon: CheckCircle2,
      color: '#10B981',
      link: 'Tasks'
    },
  ];

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

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-slate-900 rounded-2xl p-6 border border-[#D4AF37]/30">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-[#D4AF37] to-[#C5A028] bg-clip-text text-transparent mb-2">
          ברוך הבא, {user?.full_name || 'צלם מקצועי'} 👋
        </h1>
        <p className="text-slate-300">Klikly דואגת לעסק שלך בזמן שאתה מצלם</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Link key={index} to={createPageUrl(stat.link)}>
              <Card className="bg-white border-2 border-slate-200 hover:border-[#D4AF37] transition-all duration-300 cursor-pointer group">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-slate-600 mb-1">{stat.title}</p>
                      <p className="text-3xl font-bold text-slate-900">{stat.value}</p>
                    </div>
                    <div 
                      className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform"
                      style={{ backgroundColor: stat.color }}
                    >
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Leads */}
        <Card className="bg-white border border-slate-200 shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-900">
              <Users className="w-5 h-5 text-[#D4AF37]" />
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
                    <div className="p-4 rounded-lg bg-slate-50 hover:bg-slate-100 hover:shadow-md transition-all cursor-pointer border border-slate-200">
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

        {/* Upcoming Tasks */}
        <Card className="bg-slate-900/95 backdrop-blur-xl border border-[#D4AF37]/30 shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <CheckCircle2 className="w-5 h-5 text-[#D4AF37]" />
              לוז אירועים קרובים
            </CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingTasks.length === 0 ? (
              <p className="text-[#808080] text-center py-8">אין משימות ממתינות</p>
            ) : (
              <div className="space-y-3">
                {upcomingTasks.map((task) => (
                  <div key={task.id} className="p-4 rounded-lg bg-slate-800/60 hover:bg-slate-800 transition-all border border-[#D4AF37]/20">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-medium text-white">{task.title}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        task.priority === 'high' ? 'bg-red-100 text-red-700' :
                        task.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {task.priority === 'high' ? 'דחוף' : task.priority === 'medium' ? 'בינוני' : 'נמוך'}
                      </span>
                    </div>
                    <p className="text-sm text-[#D4AF37]">
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
  );
}