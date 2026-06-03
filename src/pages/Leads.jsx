import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { 
  Plus, Search, Phone, Bell, Clock, 
  Trash2, Sparkles, LayoutGrid, List, Map, Columns3
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
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

import { toast } from 'sonner';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import SourceBadge from '@/components/leads/SourceBadge';
import LeadTableView from '@/components/leads/LeadTableView';
import DataActionsToolbar from '@/components/leads/DataActionsToolbar';
import OutreachActions from '@/components/leads/OutreachActions';
import AutoFollowUpDialog from '@/components/leads/AutoFollowUpDialog';
import LeadsKanbanView from '@/components/leads/LeadsKanbanView';
import BroadcastActions from '@/components/leads/BroadcastActions';
import { enhanceLeadForDisplay, STATUS_STYLES, normalizeLeadStatus } from '@/utils/leadDisplay';

// Fix leaflet icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Lead Card Component (no drag - prevents layout jumps)
const SwipeableLeadCard = ({ lead, onAction, getStatusBadge }) => {
  return (
    <div className="relative rounded-xl h-full">
      <div className="bg-white relative h-full rounded-xl border border-slate-200 shadow-sm w-full max-w-full box-border">
        <Card className="hover:border-[#C5A028]/50 hover:shadow-md transition-shadow duration-200 h-full border-none shadow-none bg-transparent">
          <CardContent className="p-5">
            <Link to={createPageUrl(`LeadDetails?id=${lead.id}`)} className="block hover:opacity-80">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 hover:underline">
                    {lead.name}
                  </h3>
                  {lead.shooting_type && (
                    <p className="text-xs text-slate-500">{lead.shooting_type}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(lead.status)}
                  <Button variant="ghost" size="icon" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAction('delete', lead); }} className="h-8 w-8 text-red-400 hover:bg-red-50 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-3 mb-5">
                <div className="flex items-center gap-3 text-sm text-slate-600">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                    <Phone className="w-4 h-4 text-slate-500" />
                  </div>
                  {lead.phone}
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <SourceBadge source={lead.source} />
                </div>
                
                <div className="flex items-center gap-3">
                  <div 
                    className="inline-flex items-center gap-3 text-xs font-bold text-[#C5A028] bg-[#FFD700]/10 p-2 rounded-lg cursor-pointer hover:bg-[#FFD700]/20 transition-colors border border-[#C5A028]/20" 
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAction('ai_assist', lead); }}
                  >
                    <Sparkles className="w-4 h-4" />
                    מידע לפי נייד
                  </div>
                </div>
                
                {lead.next_follow_up_date && (
                  <div className="flex items-center gap-3 text-sm text-amber-700 font-bold bg-amber-50 p-2 rounded-lg border border-amber-200">
                    <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                    </div>
                    פולו-אפ: {new Date(lead.next_follow_up_date).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })}
                  </div>
                )}
              </div>
            </Link>

            {/* Quick Actions Row */}
            <OutreachActions lead={lead} onLog={onAction} />
            {lead.status === 'quote_sent' && (
              <Button 
                variant="ghost" 
                className="h-10 w-full mt-2 rounded-xl bg-orange-50 text-orange-600 hover:bg-orange-100 border border-orange-200"
                onClick={(e) => { e.stopPropagation(); onAction('contract_reminder', lead); }}
              >
                <Bell className="w-4 h-4 ml-2" />
                תזכורת חוזה
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default function Leads() {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('table');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'filtered'
  const [showNewLeadDialog, setShowNewLeadDialog] = useState(false);
  const [showFollowUpDialog, setShowFollowUpDialog] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [followUpDate, setFollowUpDate] = useState('');
  const [showAiAssist, setShowAiAssist] = useState(false);
  const [aiLead, setAiLead] = useState(null);
  const [autoFollowUpLead, setAutoFollowUpLead] = useState(null);
  const [visibleCount, setVisibleCount] = useState(1000);
  
  const [newLead, setNewLead] = useState({
    name: '',
    phone: '',
    email: '',
    shooting_type: '',
    source: '',
    source_post_url: '',
    event_date: '',
    budget: '',
    notes: '',
    address: '',
  });

  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const isAdmin = user?.role === 'admin' || user?.email === 'natigold04@gmail.com';

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['leads', user?.email, isAdmin],
    queryFn: () => isAdmin
      ? base44.entities.Lead.list('-created_date', 1000)
      : base44.entities.Lead.filter({ created_by: user.email }, '-created_date', 500),
    enabled: !!user,
  });

  // Load projects to show payment status on closed_won leads
  const { data: projects = [] } = useQuery({
    queryKey: ['leadsProjects', user?.email, isAdmin],
    queryFn: () => isAdmin
      ? base44.entities.Project.list('-created_date', 500)
      : base44.entities.Project.filter({ created_by: user.email }, '-created_date', 200),
    enabled: !!user,
  });

  const projectsByLeadId = React.useMemo(() => {
    const map = {};
    for (const p of projects) {
      if (p.lead_id) map[p.lead_id] = p;
    }
    return map;
  }, [projects]);

  const createLeadMutation = useMutation({
    mutationFn: (leadData) => base44.entities.Lead.create(leadData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setShowNewLeadDialog(false);
      setNewLead({
        name: '',
        phone: '',
        email: '',
        shooting_type: '',
        source: '',
        event_date: '',
        budget: '',
        notes: '',
        address: '',
      });
      toast.success("הליד נוצר בהצלחה");
    },
  });

  const updateLeadMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Lead.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leads'] })
  });

  const deleteLeadMutation = useMutation({
    mutationFn: async (id) => {
      try {
        await base44.entities.Lead.delete(id);
      } catch (error) {
        if (!String(error?.message || '').includes('not found')) throw error;
      }
      return id;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['leads'] });
      queryClient.setQueriesData({ queryKey: ['leads'] }, (old = []) => old.filter((lead) => lead.id !== id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success("הליד נמחק");
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.error("לא הצלחתי למחוק את הליד");
    }
  });

  const logActivityMutation = useMutation({
    mutationFn: (activity) => base44.entities.Activity.create(activity),
    onSuccess: () => toast.success("הפעילות תועדה ביומן")
  });

  const handleAction = (action, lead) => {
    if (action === 'followup') {
      setSelectedLead(lead);
      setShowFollowUpDialog(true);
    } else if (action === 'delete') {
      if (confirm('למחוק את הליד?')) {
        deleteLeadMutation.mutate(lead.id);
      }
    } else if (action === 'contract_reminder') {
      toast.loading("מייצר תזכורת חוזה...", { id: 'wa-contract' });
      base44.functions.invoke('sendWhatsAppReminder', { 
        type: 'contract_reminder',
        leadId: lead.id
      }).then((res) => {
        toast.dismiss('wa-contract');
        window.open(res.data.waLink, '_blank');
      }).catch((e) => {
        toast.error("שגיאה: " + e.message, { id: 'wa-contract' });
      });
    } else if (action === 'ai_assist') {
      setAiLead(lead);
      setShowAiAssist(true);
    } else if (action === 'log_call' || action === 'log_whatsapp' || action === 'log_manual') {
      // Update last contact date
      updateLeadMutation.mutate({ id: lead.id, data: { last_contact_date: new Date().toISOString() } });
      
      // Log activity
      const typeMap = {
        'log_call': 'call_made',
        'log_whatsapp': 'email_sent', // closest mapping
        'log_manual': 'note_added'
      };
      
      logActivityMutation.mutate({
        related_to_type: 'lead',
        related_to_id: lead.id,
        activity_type: typeMap[action] || 'note_added',
        title: action === 'log_call' ? 'בוצעה שיחה' : action === 'log_whatsapp' ? 'נשלחה הודעת WhatsApp' : 'תועד ידנית',
        description: `פעילות תועדה בתאריך ${new Date().toLocaleString()}`,
        metadata: {}
      });
    }
  };

  const handleSaveFollowUp = () => {
    if (!selectedLead || !followUpDate) return;
    
    updateLeadMutation.mutate({ 
      id: selectedLead.id, 
      data: { 
        next_follow_up_date: new Date(followUpDate).toISOString(),
        status: 'נשלח פולו-אפ'
      } 
    });
    
    setShowFollowUpDialog(false);
    setFollowUpDate('');
    setSelectedLead(null);
    toast.success("פולו-אפ תוזמן בהצלחה");
  };

  const handleCreateLead = () => {
    if (!newLead.name || !newLead.phone) return;
    createLeadMutation.mutate({
      ...newLead,
      budget: newLead.budget ? parseFloat(newLead.budget) : undefined,
      last_contact_date: new Date().toISOString(),
    });
  };

  // Status priority: active leads (need attention) at top, closed/lost at bottom
  const STATUS_PRIORITY = {
    'נשלח פולו-אפ': 0,
    'ליד חדש': 1,
    'נוצר קשר': 2,
    'נענה': 3,
    'נסגר בהצלחה': 4,
    'לא רלוונטי': 5,
  };

  // A lead is truly "filtered" only if marked is_filtered AND not in an active workflow status.
  // Active workflow statuses (in_progress, follow_up, quote_sent, closed_won) override the junk filter.
  const ACTIVE_OVERRIDE_STATUSES = ['נוצר קשר', 'נשלח פולו-אפ', 'נענה', 'נסגר בהצלחה', 'in_progress', 'follow_up', 'quote_sent', 'closed_won'];
  const isTrulyFiltered = (lead) => lead.is_filtered && !ACTIVE_OVERRIDE_STATUSES.includes(lead.status);

  // Counts for tab badges
  const activeCount = leads.filter(l => !isTrulyFiltered(l)).length;
  const filteredCount = leads.filter(l => isTrulyFiltered(l)).length;

  const filteredLeads = leads
    .filter((lead) => {
      // Tab gate: active tab hides truly-filtered leads; filtered tab shows only them
      if (activeTab === 'active' && isTrulyFiltered(lead)) return false;
      if (activeTab === 'filtered' && !isTrulyFiltered(lead)) return false;

      const term = (searchTerm || '').toLowerCase();
      const displayLead = enhanceLeadForDisplay(lead);
      const matchesSearch =
        ((displayLead.name || '').toLowerCase().includes(term)) ||
        ((displayLead.phone || '').includes(searchTerm)) ||
        (displayLead.email && displayLead.email.toLowerCase().includes(term)) ||
        ((displayLead.source || '').toLowerCase().includes(term)) ||
        ((displayLead.notes || '').toLowerCase().includes(term));

      const matchesStatus = statusFilter === 'all' || normalizeLeadStatus(lead.status) === statusFilter;

      return matchesSearch && matchesStatus;
    })
    .map(enhanceLeadForDisplay)
    .sort((a, b) => {
      const now = Date.now();
      const urgentA = a.status === 'נשלח פולו-אפ' || (a.next_follow_up_date && new Date(a.next_follow_up_date).getTime() <= now);
      const urgentB = b.status === 'נשלח פולו-אפ' || (b.next_follow_up_date && new Date(b.next_follow_up_date).getTime() <= now);
      if (urgentA !== urgentB) return urgentA ? -1 : 1;
      const dA = new Date(a.created_date || 0).getTime();
      const dB = new Date(b.created_date || 0).getTime();
      return dB - dA;
    });

  const visibleLeads = filteredLeads.slice(0, visibleCount);

  React.useEffect(() => {
    setVisibleCount(1000);
  }, [searchTerm, statusFilter, activeTab, viewMode]);

  React.useEffect(() => {
    const unsubscribe = base44.entities.Lead.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    });

    return unsubscribe;
  }, [queryClient]);

  const getStatusBadge = (status) => {
    const badge = STATUS_STYLES[status] || { label: status, pill: 'bg-slate-100 text-slate-700 border-slate-200' };
    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${badge.pill}`}>
        {badge.label}
      </span>
    );
  };

  return (
    <div className="space-y-5 pb-24 md:pb-20" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6 rounded-3xl bg-gradient-to-l from-white to-slate-50 border border-slate-100 p-4 shadow-sm">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            ניהול לידים
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">מסד נתונים מרכזי לכל הלידים</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <BroadcastActions />
          <Dialog open={showNewLeadDialog} onOpenChange={setShowNewLeadDialog}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="w-4 h-4" />
                ליד חדש
              </Button>
            </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]" dir="rtl">
            <DialogHeader>
              <DialogTitle>ליד חדש</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">שם *</label>
                <Input
                  value={newLead.name}
                  onChange={(e) => setNewLead({ ...newLead, name: e.target.value })}
                  placeholder="שם מלא"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">טלפון *</label>
                  <Input
                    value={newLead.phone}
                    onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })}
                    placeholder="050-1234567"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">אימייל</label>
                  <Input
                    value={newLead.email}
                    onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
                    placeholder="email@example.com"
                    type="email"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">כתובת הליד</label>
                <Input
                  value={newLead.address}
                  onChange={(e) => setNewLead({ ...newLead, address: e.target.value })}
                  placeholder="תל אביב, רמת גן..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">סוג צילום</label>
                  <Input
                    value={newLead.shooting_type}
                    onChange={(e) => setNewLead({ ...newLead, shooting_type: e.target.value })}
                    placeholder="חתונה / בר מצווה / אירוע"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">מקור</label>
                  <Input
                    value={newLead.source}
                    onChange={(e) => setNewLead({ ...newLead, source: e.target.value })}
                    placeholder="פייסבוק / המלצה / גוגל"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">קישור לפוסט המקורי</label>
                <Input
                  value={newLead.source_post_url}
                  onChange={(e) => setNewLead({ ...newLead, source_post_url: e.target.value })}
                  placeholder="https://..."
                  dir="ltr"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">תאריך אירוע</label>
                  <Input
                    value={newLead.event_date}
                    onChange={(e) => setNewLead({ ...newLead, event_date: e.target.value })}
                    type="date"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">תקציב (₪)</label>
                  <Input
                    value={newLead.budget}
                    onChange={(e) => setNewLead({ ...newLead, budget: e.target.value })}
                    placeholder="5000"
                    type="number"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">הערות</label>
                <textarea
                  value={newLead.notes}
                  onChange={(e) => setNewLead({ ...newLead, notes: e.target.value })}
                  placeholder="הערות נוספות..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FFD700]"
                  rows="3"
                />
              </div>
              <Button
                onClick={handleCreateLead}
                className="w-full bg-gradient-to-r from-[#D4AF37] to-[#C5A028] hover:from-[#C5A028] hover:to-[#D4AF37] text-black"
                disabled={!newLead.name || !newLead.phone}
              >
                צור ליד
              </Button>
            </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* AI Assist Dialog */}
      <Dialog open={showAiAssist} onOpenChange={setShowAiAssist}>
        <DialogContent className="sm:max-w-[400px]" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#FFD700]" />
              מודיעין לפי נייד
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4 bg-slate-50 p-4 rounded-lg border border-slate-200 text-slate-600">
            <p className="text-sm font-medium text-slate-800">
              מזהה מתקשר אוטומטי עבור: {aiLead?.phone}
            </p>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                <span>זיהוי משוער: <strong className="text-slate-800">קשור לקול צעקה / עמותות</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                <span>פניות עבר: <strong className="text-slate-800">לא נמצאו רישומים קודמים</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#C5A028]"></span>
                <span>המלצת AI: <strong className="text-[#C5A028]">מומלץ לבדוק תקציב בתחילת השיחה</strong></span>
              </div>
            </div>
            <Button 
              onClick={() => setShowAiAssist(false)} 
              className="w-full mt-4"
            >
              הבנתי, סגור
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Auto Follow-Up Dialog */}
      <AutoFollowUpDialog
        open={!!autoFollowUpLead}
        onOpenChange={(o) => !o && setAutoFollowUpLead(null)}
        lead={autoFollowUpLead}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['leads'] })}
      />

      {/* Follow Up Dialog */}
      <Dialog open={showFollowUpDialog} onOpenChange={setShowFollowUpDialog}>
        <DialogContent className="sm:max-w-[400px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>תזמון פולו-אפ</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <p className="text-sm text-slate-600">בחר מועד לחזרה ל{selectedLead?.name}:</p>
            <Input
              type="datetime-local"
              value={followUpDate}
              onChange={(e) => setFollowUpDate(e.target.value)}
              className="w-full"
            />
            <Button 
              onClick={handleSaveFollowUp} 
              className="w-full bg-[#FFD700] hover:bg-[#e6c200] text-black font-bold"
              disabled={!followUpDate}
            >
              שמור תזכורת
            </Button>
          </div>
        </DialogContent>
      </Dialog>



      {/* Tabs: Active vs Filtered */}
      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-50 p-1 border border-slate-200 -mb-1" dir="rtl">
        <button
          onClick={() => setActiveTab('active')}
          className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-colors ${
            activeTab === 'active'
            ? 'border-[#C5A028] bg-white text-slate-900 shadow-sm rounded-xl'
            : 'border-transparent text-slate-500 hover:text-slate-700 rounded-xl'
          }`}
        >
          לידים פעילים
          <span className="mr-2 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs">{activeCount}</span>
        </button>
        <button
          onClick={() => setActiveTab('filtered')}
          className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-colors ${
            activeTab === 'filtered'
            ? 'border-red-500 bg-white text-slate-900 shadow-sm rounded-xl'
            : 'border-transparent text-slate-500 hover:text-slate-700 rounded-xl'
          }`}
        >
          מסוננים / לא רלוונטיים
          <span className="mr-2 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs">{filteredCount}</span>
        </button>
      </div>

      {/* Data Actions Toolbar */}
      <Card className="border border-slate-200 shadow-sm rounded-3xl overflow-hidden">
        <CardContent className="p-4 bg-white">
          <div className="grid grid-cols-1 md:grid-cols-[auto_1fr_auto_auto] gap-3 items-stretch md:items-center overflow-hidden">
            {/* View Switcher */}
            <div className="grid grid-cols-4 bg-slate-100 p-1 rounded-2xl shrink-0 overflow-hidden max-w-full">
              {[
                { key: 'table', label: 'טבלה', icon: List },
                { key: 'grid', label: 'כרטיסים', icon: LayoutGrid },
                { key: 'kanban', label: 'קנבן', icon: Columns3 },
                { key: 'map', label: 'מפה', icon: Map },
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setViewMode(key)}
                  className={`h-11 rounded-xl flex items-center justify-center gap-1 text-xs font-black transition-all ${viewMode === key ? 'bg-[#FFD700] text-black shadow-sm' : 'text-slate-500 hover:bg-white hover:text-slate-800'}`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="flex-1 relative min-w-0 md:min-w-[200px]">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="חיפוש שם, טלפון, אימייל..." className="pr-10 h-11 rounded-2xl bg-white" />
            </div>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-40 h-11 rounded-2xl text-xs font-bold bg-white">
                <SelectValue placeholder="סטטוס" />
              </SelectTrigger>
              <SelectContent dir="rtl">
                <SelectItem value="all">הכל</SelectItem>
                <SelectItem value="ליד חדש">ליד חדש</SelectItem>
                <SelectItem value="נוצר קשר">נוצר קשר</SelectItem>
                <SelectItem value="נשלח פולו-אפ">נשלח פולו-אפ</SelectItem>
                <SelectItem value="נענה">נענה</SelectItem>
                <SelectItem value="נסגר בהצלחה">נסגר בהצלחה</SelectItem>
                <SelectItem value="לא רלוונטי">לא רלוונטי</SelectItem>
              </SelectContent>
            </Select>

            {/* Data Actions */}
            <DataActionsToolbar leads={leads} />
          </div>
        </CardContent>
      </Card>

      {/* Lead Count */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">מציג {Math.min(visibleLeads.length, filteredLeads.length)} מתוך {filteredLeads.length} לידים</p>
      </div>

      {/* Leads Display */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#D4AF37]"></div>
        </div>
      ) : filteredLeads.length === 0 ? (
        <Card className="border shadow-sm">
          <CardContent className="p-12 text-center">
            <p className="text-slate-400">לא נמצאו לידים</p>
          </CardContent>
        </Card>
      ) : viewMode === 'table' ? (
        <LeadTableView 
          leads={visibleLeads} 
          projectsByLeadId={projectsByLeadId}
          onStatusChange={(id, status) => updateLeadMutation.mutate({ id, data: { status } })}
          onDelete={(id) => { if (confirm('למחוק את הליד?')) deleteLeadMutation.mutate(id); }}
          onAutoFollowUp={(lead) => setAutoFollowUpLead(lead)}
          onRestoreToActive={(id) => {
            updateLeadMutation.mutate({ id, data: { is_filtered: false, filter_reason: null } });
            toast.success('הליד הוחזר לפעילים');
          }}
        />
      ) : viewMode === 'kanban' ? (
        <LeadsKanbanView leads={visibleLeads} onStatusChange={(id, status) => updateLeadMutation.mutate({ id, data: { status } })} />
      ) : viewMode === 'map' ? (
        <Card className="border shadow-sm overflow-hidden h-[600px] relative z-0">
          <MapContainer center={[31.0461, 34.8516]} zoom={7} style={{ height: '100%', width: '100%', zIndex: 1 }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {visibleLeads.map((lead) => (
              lead.address ? (
                <Marker key={lead.id} position={[31.0461 + (Math.random() - 0.5) * 2, 34.8516 + (Math.random() - 0.5) * 2]}>
                  <Popup>
                    <div className="text-right" dir="rtl">
                      <strong>{lead.name}</strong><br/>
                      {lead.address}<br/>
                      <a href={`tel:${lead.phone}`} className="text-blue-600">{lead.phone}</a>
                    </div>
                  </Popup>
                </Marker>
              ) : null
            ))}
          </MapContainer>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-full box-border">
          {visibleLeads.map((lead) => (
            <SwipeableLeadCard 
              key={lead.id} 
              lead={lead} 
              onAction={handleAction} 
              getStatusBadge={getStatusBadge} 
            />
          ))}
        </div>
      )}

      {filteredLeads.length > visibleLeads.length && (
        <div className="flex justify-center pt-2">
          <Button variant="secondary" onClick={() => setVisibleCount((count) => count + 1000)}>
            טען עוד 1000 לידים
          </Button>
        </div>
      )}
    </div>
  );
}