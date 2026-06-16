import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { 
  Users, Briefcase, FileText, CheckCircle2, TrendingUp, Calendar,
  DollarSign, Camera, AlertCircle, MessageCircle, CheckSquare,
  Download, Target, BarChart3, Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import LeadRadarWidget from '@/components/dashboard/LeadRadarWidget';
import ClaudeCodeLeadsTable from '@/components/dashboard/ClaudeCodeLeadsTable';
import TaskBoard from '@/components/dashboard/TaskBoard';
import QuickActions from '@/components/dashboard/QuickActions';
import LeadQualityDashboard from '@/components/dashboard/LeadQualityDashboard';
import JoniExportReminderAlert from '@/components/dashboard/JoniExportReminderAlert';
import { normalizeLeadStatus } from '@/utils/leadDisplay';

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
      if (!hasSeenWelcome) setShowWelcome(true);
    }
  }, [user, isClient]);

  const closeWelcome = () => {
    setShowWelcome(false);
    localStorage.setItem('hasSeenWelcome_base44', 'true');
  };

  const isAdmin = user?.role === 'admin' || user?.email === 'natigold04@gmail.com';

  const { data: leads = [] } = useQuery({
    queryKey: ['dashboard_leads', user?.email, isAdmin],
    queryFn: () => isAdmin
      ? base44.entities.Lead.list('-created_date', 1000)
      : base44.entities.Lead.filter({ created_by: user.email }, '-created_date', 500),
    enabled: !!user && !isClient,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['dashboard_projects', user?.email],
    queryFn: () => {
      if (isClient) return base44.entities.Project.filter({ client_email: user.email }, '-created_date', 100);
      return base44.entities.Project.filter({ created_by: user.email }, '-created_date', 200);
    },
    enabled: !!user,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['dashboard_tasks', user?.email],
    queryFn: () => base44.entities.Task.list('-due_date', 100),
    enabled: !!user && !isClient,
  });

  const { data: deliveryLinks = [] } = useQuery({
    queryKey: ['dashboard_delivery', user?.email],
    queryFn: () => base44.entities.DeliveryLink.filter({ photographer_email: user.email }, '-created_date', 200),
    enabled: !!user && !isClient,
  });

  useEffect(() => {
    if (isClient) window.location.href = '/ClientPortal';
  }, [isClient]);

  // KPIs
  const today = new Date().toISOString().split('T')[0];
  const leadsToday = leads.filter(l => l.created_date?.startsWith(today)).length;
  const websiteLeadsToday = leads.filter(l =>
    l.created_date?.startsWith(today) &&
    (String(l.source || '').includes('natigold.com') || String(l.source_post_url || '').includes('natigold.com'))
  ).length;
  const totalLeads = leads.length;
  const closedWon = leads.filter(l => normalizeLeadStatus(l.status) === 'נסגר בהצלחה').length;
  const conversionRate = totalLeads ? Math.round((closedWon / totalLeads) * 100) : 0;
  const totalRevenue = projects.reduce((sum, p) => sum + (p.total_price || 0), 0);
  const paidRevenue = projects.filter(p => p.payment_status === 'paid').reduce((sum, p) => sum + (p.total_price || 0), 0);
  const outstandingRevenue = totalRevenue - paidRevenue;
  const totalDownloads = deliveryLinks.filter(d => d.is_downloaded).length;
  const totalViews = deliveryLinks.reduce((sum, d) => sum + (d.view_count || 0), 0);
  const activeProjects = projects.filter(p => !['completed'].includes(p.status)).length;

  // Mini chart: leads per week (last 4 weeks)
  const weeklyLeads = [];
  for (let i = 3; i >= 0; i--) {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - (i * 7 + 6));
    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() - (i * 7));
    const count = leads.filter(l => {
      const d = new Date(l.created_date);
      return d >= weekStart && d <= weekEnd;
    }).length;
    weeklyLeads.push({ week: `שבוע ${4 - i}`, count });
  }

  const photographerStats = [
    { title: 'לידים היום', value: leadsToday, note: `${websiteLeadsToday} נכנסו מהאתר`, icon: TrendingUp, link: 'Leads' },
    { title: 'אחוז המרה', value: `${conversionRate}%`, icon: Target, link: 'Analytics' },
    { title: 'הכנסות', value: `₪${totalRevenue.toLocaleString()}`, icon: DollarSign, link: 'Analytics' },
    { title: 'פרויקטים פעילים', value: activeProjects, icon: Briefcase, link: 'Projects' },
    { title: 'ממתינים לטיפול', value: leads.filter(l => normalizeLeadStatus(l.status) === 'ליד חדש').length, icon: MessageCircle, link: 'Leads' },
    { title: 'משימות', value: tasks.length, icon: CheckSquare, link: 'Tasks' },
  ];

  const recentLeads = leads.slice(0, 5);
  const recentWebsiteLeads = leads
    .filter(l =>
      l.created_date?.startsWith(today) &&
      normalizeLeadStatus(l.status) === 'ליד חדש' &&
      (String(l.source || '').includes('natigold.com') || String(l.source_post_url || '').includes('natigold.com'))
    )
    .slice(0, 3);
  const upcomingTasks = tasks.slice(0, 5);

  const urgentLeads = leads.filter(l => {
    return normalizeLeadStatus(l.status) === 'ליד חדש' && new Date(l.created_date) < new Date(Date.now() - 24 * 60 * 60 * 1000);
  });

  const getStatusBadge = (status) => {
    const statusMap = {
      new: { label: 'חדש', color: 'bg-blue-100 text-blue-700' },
      follow_up: { label: 'מעקב', color: 'bg-yellow-100 text-yellow-700' },
      quote_sent: { label: 'הצעה נשלחה', color: 'bg-purple-100 text-purple-700' },
      closed_won: { label: 'נסגר', color: 'bg-green-100 text-green-700' },
      closed_lost: { label: 'נכשל', color: 'bg-red-100 text-red-700' },
    };
    const badge = statusMap[status] || { label: status, color: 'bg-gray-100 text-gray-700' };
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>{badge.label}</span>;
  };

  if (isClient) return null;

  return (
    <>
      <Dialog open={showWelcome} onOpenChange={(open) => { if (!open) closeWelcome(); }}>
        <DialogContent className="sm:max-w-[550px] text-right" dir="rtl">
          <DialogHeader className="text-right sm:text-right">
            <DialogTitle className="text-xl md:text-2xl text-[#D4AF37] font-bold text-right">ברוך הבא ל-Klikly 🚀</DialogTitle>
            <DialogDescription asChild>
              <div className="text-slate-700 text-sm mt-4 space-y-4 pt-4 text-right">
                <div className="font-semibold text-slate-900 text-lg">היי {user?.full_name || 'צלם'}, כאן הצוות של Klikly.</div>
                <p>המערכת שלך מוכנה. לידים, פרויקטים, משלוחי קבצים ואנליטיקס — הכל במקום אחד.</p>
                <ul className="list-none space-y-2">
                  <li className="flex gap-2 items-start"><span className="text-[#D4AF37] font-bold">•</span><span><strong>לידים חכמים:</strong> קליטה אוטומטית וסגירה בקליק.</span></li>
                  <li className="flex gap-2 items-start"><span className="text-[#D4AF37] font-bold">•</span><span><strong>Magic Link:</strong> שלח גלריות וקבל התראה כשהלקוח מוריד.</span></li>
                  <li className="flex gap-2 items-start"><span className="text-[#D4AF37] font-bold">•</span><span><strong>Zero Friction:</strong> אפס קליקים מיותרים.</span></li>
                </ul>
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-start mt-4 pt-2">
            <Button onClick={closeWelcome} className="w-full sm:w-auto">כניסה למערכת</Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="space-y-6 md:space-y-8">
        <JoniExportReminderAlert />

        {/* Urgent Alert */}
        {urgentLeads.length > 0 && (() => {
          const oldest = [...urgentLeads].sort((a,b) => new Date(a.created_date) - new Date(b.created_date))[0];
          return (
            <div className="bg-red-50 border border-red-200 shadow-sm rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center"><AlertCircle className="w-6 h-6 text-red-500" /></div>
                <div>
                  <h3 className="font-bold text-red-700">דורש טיפול דחוף</h3>
                  <p className="text-sm text-red-500">{urgentLeads.length} לידים ממתינים 24+ שעות</p>
                </div>
              </div>
              <div className="flex gap-2">
                <a href={`https://wa.me/${oldest.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`היי ${oldest.name}, חזרתי אליך...`)}`} target="_blank" rel="noopener noreferrer">
                  <Button className="bg-[#25D366] text-white hover:bg-[#128C7E]" size="sm">WhatsApp</Button>
                </a>
                <Link to={createPageUrl(`LeadDetails?id=${oldest.id}`)}><Button size="sm">טפל עכשיו</Button></Link>
              </div>
            </div>
          );
        })()}

        {recentWebsiteLeads.length > 0 && (
          <Card className="border border-[#FFD700]/40 bg-[#FFD700]/10 rounded-2xl shadow-sm">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-slate-900">לידים חדשים מהאתר היום</h3>
                  <p className="text-xs text-slate-600">הלידים האחרונים שנכנסו מטפסי natigold.com</p>
                </div>
                <Link to={createPageUrl('Leads')}>
                  <Button size="sm" className="bg-[#FFD700] text-black hover:bg-[#e6c200]">פתח לידים</Button>
                </Link>
              </div>
              <div className="grid gap-2">
                {recentWebsiteLeads.map((lead) => (
                  <Link key={lead.id} to={createPageUrl(`LeadDetails?id=${lead.id}`)}>
                    <div className="flex items-center justify-between gap-3 rounded-xl bg-white/80 border border-[#FFD700]/30 p-3 hover:bg-white transition-colors">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">{lead.name}</p>
                        <p className="text-xs text-slate-500 truncate">{lead.phone} · {lead.shooting_type || lead.source}</p>
                      </div>
                      {getStatusBadge(lead.status)}
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Header */}
        <div className="mb-4 mt-4">
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-1">לוח ניהול</h1>
          <p className="text-sm md:text-base text-slate-500">סקירה מהירה — {user?.full_name || 'Klikly'}</p>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {photographerStats.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <Link key={i} to={createPageUrl(stat.link)}>
                <Card className="border border-slate-200 hover:border-[#C5A028] hover:shadow-md transition-all cursor-pointer group rounded-2xl active:scale-[0.98] h-full">
                  <CardContent className="p-4 md:p-5 flex items-center justify-between h-full">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-slate-500 truncate">{stat.title}</p>
                      <p className="text-2xl md:text-3xl font-bold text-slate-900 truncate">{stat.value}</p>
                      {stat.note && <p className="text-[11px] font-bold text-[#C5A028] mt-1 truncate">{stat.note}</p>}
                    </div>
                    <div className="w-11 h-11 rounded-xl bg-[#FFD700]/10 border border-[#FFD700]/20 flex items-center justify-center group-hover:bg-[#FFD700]/20 transition-all flex-shrink-0">
                      <Icon className="w-5 h-5 text-[#C5A028]" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>

        {/* Revenue + Delivery Quick Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border border-green-200 bg-green-50 rounded-2xl">
            <CardContent className="p-4 flex items-center gap-3">
              <DollarSign className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-xs text-green-700 font-medium">שולם</p>
                <p className="text-xl font-bold text-green-800">₪{paidRevenue.toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border border-amber-200 bg-amber-50 rounded-2xl">
            <CardContent className="p-4 flex items-center gap-3">
              <Clock className="w-8 h-8 text-amber-600" />
              <div>
                <p className="text-xs text-amber-700 font-medium">ממתין לגבייה</p>
                <p className="text-xl font-bold text-amber-800">₪{outstandingRevenue.toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border border-purple-200 bg-purple-50 rounded-2xl">
            <CardContent className="p-4 flex items-center gap-3">
              <Download className="w-8 h-8 text-purple-600" />
              <div>
                <p className="text-xs text-purple-700 font-medium">הורדות / צפיות</p>
                <p className="text-xl font-bold text-purple-800">{totalDownloads} / {totalViews}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <QuickActions />

        {/* Lead Quality Summary */}
        <LeadQualityDashboard leads={leads} />

        {/* Task Board — front and center */}
        <TaskBoard tasks={tasks} />

        {/* AI Lead Radar */}
        <LeadRadarWidget />

        {/* Claude Code Leads Table */}
        <ClaudeCodeLeadsTable />

        {/* Mini Chart + Recent Leads */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Weekly Leads Chart */}
          <Card className="border rounded-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base"><BarChart3 className="w-4 h-4 text-[#FFD700]" />לידים שבועיים</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyLeads}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#FFD700" radius={[6, 6, 0, 0]} name="לידים" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Recent Leads */}
          <Card className="border rounded-2xl">
            <CardHeader className="border-b pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><Users className="w-4 h-4 text-[#C5A028]" />לידים אחרונים</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {recentLeads.length === 0 ? (
                <p className="text-slate-400 text-center py-6 text-sm">אין לידים</p>
              ) : (
                <div className="space-y-3">
                  {recentLeads.map(lead => (
                    <Link key={lead.id} to={createPageUrl(`LeadDetails?id=${lead.id}`)}>
                      <div className="p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-all">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-semibold text-slate-800 text-sm">{lead.name}</h4>
                            <p className="text-xs text-slate-400">{lead.shooting_type || lead.source || lead.phone}</p>
                          </div>
                          {getStatusBadge(lead.status)}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
              <Link to={createPageUrl('Leads')}>
                <Button variant="ghost" className="w-full mt-4 text-xs text-[#C5A028] hover:bg-[#FFD700]/10 border border-dashed border-[#C5A028]/30 rounded-lg">כל הלידים ←</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}