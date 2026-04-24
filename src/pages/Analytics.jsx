import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, DollarSign, Clock, Download, Users, Briefcase, Target, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from 'recharts';

const COLORS = ['#FFD700', '#C5A028', '#4F46E5', '#10B981', '#EF4444', '#8B5CF6', '#F59E0B', '#06B6D4'];

export default function Analytics() {
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  // Data isolation: all queries scoped to current photographer
  const { data: leads = [] } = useQuery({
    queryKey: ['analytics_leads', user?.email],
    queryFn: () => base44.entities.Lead.filter({ created_by: user.email }, '-created_date', 1000),
    enabled: !!user,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['analytics_projects', user?.email],
    queryFn: () => base44.entities.Project.filter({ created_by: user.email }, '-created_date', 1000),
    enabled: !!user,
  });

  const { data: deliveryLinks = [] } = useQuery({
    queryKey: ['analytics_delivery', user?.email],
    queryFn: () => base44.entities.DeliveryLink.filter({ photographer_email: user.email }, '-created_date', 500),
    enabled: !!user,
  });

  const { data: vendorAssignments = [] } = useQuery({
    queryKey: ['analytics_assignments', user?.email],
    queryFn: () => base44.entities.VendorAssignment.filter({ created_by: user.email }, '-created_date', 500),
    enabled: !!user,
  });

  // Conversion Rate
  const totalLeads = leads.length;
  const closedWon = leads.filter(l => l.status === 'closed_won').length;
  const conversionRate = totalLeads > 0 ? Math.round((closedWon / totalLeads) * 100) : 0;

  // Revenue
  const totalRevenue = projects.reduce((sum, p) => sum + (p.total_price || 0), 0);
  const paidRevenue = projects.filter(p => p.payment_status === 'paid').reduce((sum, p) => sum + (p.total_price || 0), 0);
  const outstandingRevenue = totalRevenue - paidRevenue;

  // Vendor costs
  const vendorCosts = vendorAssignments.reduce((sum, a) => sum + (a.agreed_rate || 0), 0);
  const vendorPaid = vendorAssignments.filter(a => a.payment_status === 'paid').reduce((sum, a) => sum + (a.agreed_rate || 0), 0);

  // Avg time to delivery (projects with delivery links)
  const deliveredProjects = deliveryLinks.filter(d => d.is_downloaded);
  const avgDeliveryDays = deliveredProjects.length > 0
    ? Math.round(deliveredProjects.reduce((sum, d) => {
        const project = projects.find(p => p.id === d.project_id);
        if (!project?.created_date || !d.downloaded_at) return sum;
        return sum + (new Date(d.downloaded_at) - new Date(project.created_date)) / (1000 * 60 * 60 * 24);
      }, 0) / deliveredProjects.length)
    : 0;

  // Download stats
  const totalViews = deliveryLinks.reduce((sum, d) => sum + (d.view_count || 0), 0);
  const totalDownloads = deliveryLinks.filter(d => d.is_downloaded).length;

  // Monthly lead trend (last 6 months)
  const monthlyLeads = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const month = d.toLocaleDateString('he-IL', { month: 'short' });
    const yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const count = leads.filter(l => l.created_date?.startsWith(yearMonth)).length;
    const won = leads.filter(l => l.created_date?.startsWith(yearMonth) && l.status === 'closed_won').length;
    monthlyLeads.push({ month, leads: count, won });
  }

  // Lead source distribution
  const sourceMap = {};
  leads.forEach(l => {
    const src = l.source || 'לא ידוע';
    sourceMap[src] = (sourceMap[src] || 0) + 1;
  });
  const sourceData = Object.entries(sourceMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6);

  // Project status distribution
  const statusMap = {};
  const statusLabels = {
    pending_payment: 'ממתין לתשלום', paid: 'שולם', shooting_scheduled: 'צילום מתוכנן',
    shooting_done: 'צילום בוצע', awaiting_selection: 'בחירת לקוח', editing: 'בעריכה',
    ready_for_download: 'מוכן להורדה', completed: 'הושלם'
  };
  projects.forEach(p => {
    const label = statusLabels[p.status] || p.status;
    statusMap[label] = (statusMap[label] || 0) + 1;
  });
  const statusData = Object.entries(statusMap).map(([name, value]) => ({ name, value }));

  // Monthly revenue
  const monthlyRevenue = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const month = d.toLocaleDateString('he-IL', { month: 'short' });
    const yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const rev = projects.filter(p => p.created_date?.startsWith(yearMonth)).reduce((sum, p) => sum + (p.total_price || 0), 0);
    monthlyRevenue.push({ month, revenue: rev });
  }

  const kpiCards = [
    { title: 'אחוז המרה', value: `${conversionRate}%`, subtitle: `${closedWon} מתוך ${totalLeads} לידים`, icon: Target, color: 'from-[#FFD700] to-[#C5A028]' },
    { title: 'הכנסות ברוטו', value: `₪${totalRevenue.toLocaleString()}`, subtitle: `ממתין: ₪${outstandingRevenue.toLocaleString()}`, icon: DollarSign, color: 'from-green-500 to-emerald-600' },
    { title: 'זמן ממוצע למסירה', value: `${avgDeliveryDays} ימים`, subtitle: `${deliveredProjects.length} מסירות`, icon: Clock, color: 'from-blue-500 to-cyan-600' },
    { title: 'צפיות / הורדות', value: `${totalViews} / ${totalDownloads}`, subtitle: 'לינקי משלוח', icon: Download, color: 'from-purple-500 to-indigo-600' },
    { title: 'עלויות ספקים', value: `₪${vendorCosts.toLocaleString()}`, subtitle: `שולם: ₪${vendorPaid.toLocaleString()}`, icon: Users, color: 'from-orange-500 to-red-500' },
    { title: 'פרויקטים פעילים', value: projects.filter(p => !['completed'].includes(p.status)).length, subtitle: `סה"כ: ${projects.length}`, icon: Briefcase, color: 'from-teal-500 to-green-500' },
  ];

  const hasData = totalLeads > 0 || projects.length > 0;

  return (
    <div className="space-y-6 pb-20" dir="rtl">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900">אנליטיקס</h1>
        <p className="text-slate-500 mt-1">ביצועי העסק שלך — מבוסס על הלידים, הפרויקטים והמסירות שלך במערכת</p>
      </div>
      
      {!hasData && (
        <Card className="border border-amber-200 bg-amber-50 rounded-2xl">
          <CardContent className="p-5 flex items-center gap-3">
            <Target className="w-8 h-8 text-amber-600 shrink-0" />
            <div>
              <p className="font-bold text-amber-800 text-sm">אין עדיין מספיק נתונים</p>
              <p className="text-xs text-amber-600">הגרפים יתמלאו אוטומטית ברגע שתוסיף לידים, פרויקטים, ותשלח גלריות ללקוחות. כל הנתונים נלקחים מהמידע שאתה מזין במערכת.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {kpiCards.map((kpi, i) => {
          const Icon = kpi.icon;
          return (
            <Card key={i} className="border hover:border-[#FFD700]/40 transition-all rounded-2xl overflow-hidden">
              <CardContent className="p-5 flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${kpi.color} flex items-center justify-center shadow-lg flex-shrink-0`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-500 font-medium">{kpi.title}</p>
                  <p className="text-2xl font-bold text-slate-800 truncate">{kpi.value}</p>
                  <p className="text-xs text-slate-400">{kpi.subtitle}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border rounded-2xl">
          <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><TrendingUp className="w-5 h-5 text-[#FFD700]" />מגמת לידים (6 חודשים)</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyLeads}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="leads" fill="#FFD700" radius={[6, 6, 0, 0]} name="לידים" />
                  <Bar dataKey="won" fill="#10B981" radius={[6, 6, 0, 0]} name="נסגרו" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border rounded-2xl">
          <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><DollarSign className="w-5 h-5 text-green-500" />מגמת הכנסות</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value) => [`₪${value.toLocaleString()}`, 'הכנסות']} />
                  <Line type="monotone" dataKey="revenue" stroke="#FFD700" strokeWidth={3} dot={{ fill: '#FFD700', r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border rounded-2xl">
          <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><BarChart3 className="w-5 h-5 text-purple-500" />התפלגות מקורות לידים</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={sourceData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                    {sourceData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border rounded-2xl">
          <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Briefcase className="w-5 h-5 text-blue-500" />סטטוסי פרויקטים</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#4F46E5" radius={[0, 6, 6, 0]} name="פרויקטים" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}