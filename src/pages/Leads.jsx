import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { 
  Plus, Search, Filter, Phone, Mail, Calendar, Bell, Clock, 
  MessageCircle, FileText, Trash2, CheckSquare, MoreVertical,
  Sparkles, LayoutGrid, List, Map
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
import { motion, useAnimation } from 'framer-motion';
import { toast } from 'sonner';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import SourceBadge from '@/components/leads/SourceBadge';
import LeadTableView from '@/components/leads/LeadTableView';
import DataActionsToolbar from '@/components/leads/DataActionsToolbar';

// Fix leaflet icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Swipeable Lead Card Component
const SwipeableLeadCard = ({ lead, onAction, getStatusBadge }) => {
  const controls = useAnimation();
  const [isOpen, setIsOpen] = useState(false);

  const handleDragEnd = (event, info) => {
    const threshold = 100;
    if (info.offset.x < -threshold) {
      // Swipe Left -> Follow-up
      onAction('followup', lead);
      controls.start({ x: 0 });
    } else if (info.offset.x > threshold) {
      // Swipe Right -> Delete (or other action, maybe Call)
      // Per user request: Swipe Actions for Follow-up or Delete
      onAction('delete', lead);
      controls.start({ x: 0 });
    } else {
      controls.start({ x: 0 });
    }
  };

  const whatsappLink = `https://wa.me/${lead.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`היי ${lead.name}, ראיתי שהתעניינת ב-${lead.shooting_type || 'צילום'}. רציתי לבדוק אם קיבלת את הפרטים?`)}`;

  return (
    <div className="relative overflow-hidden rounded-xl h-full">
      {/* Background Actions */}
      <div className="absolute inset-0 flex items-center justify-between pointer-events-none rounded-xl overflow-hidden">
        <div className="h-full w-1/2 bg-red-500 flex items-center justify-start pl-6 text-white">
          <Trash2 className="w-6 h-6" />
        </div>
        <div className="h-full w-1/2 bg-blue-500 flex items-center justify-end pr-6 text-white">
          <Clock className="w-6 h-6" />
        </div>
      </div>

      {/* Foreground Card */}
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
        animate={controls}
        className="bg-white relative h-full z-10 rounded-xl border border-slate-200 shadow-sm w-full max-w-full box-border"
      >
        <Card className="hover:border-[#C5A028]/50 hover:shadow-md transition-all duration-300 h-full border-none shadow-none bg-transparent">
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
            <div className="flex flex-col gap-3 pt-4 border-t border-slate-100 w-full">
              <a 
                href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`היי ${lead.name}, זה נתי גולד, קיבלתי את הפנייה שלך...`)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => { e.stopPropagation(); onAction('log_whatsapp', lead); }}
                className="flex items-center justify-center gap-3 bg-[#25D366] hover:bg-[#128C7E] text-white shadow-sm px-6 py-2 h-11 transition-all duration-300 font-bold rounded-xl w-full"
              >
                <MessageCircle className="w-5 h-5" />
                <span className="text-sm font-bold tracking-wide">WhatsApp</span>
              </a>
              <div className="flex justify-between w-full">
                <a href={`tel:${lead.phone}`} onClick={(e) => { e.stopPropagation(); onAction('log_call', lead); }} className="flex-1 mr-2">
                  <Button variant="ghost" className="h-10 w-full rounded-xl bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200">
                    <Phone className="w-4 h-4 ml-2" />
                    התקשר
                  </Button>
                </a>
                <Button variant="ghost" className="h-10 flex-1 ml-2 rounded-xl bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200" onClick={(e) => { e.stopPropagation(); onAction('log_manual', lead); }}>
                  <FileText className="w-4 h-4 ml-2" />
                  תיעוד
                </Button>
              </div>
              {lead.status === 'quote_sent' && (
                <Button 
                  variant="ghost" 
                  className="h-10 w-full rounded-xl bg-orange-50 text-orange-600 hover:bg-orange-100 border border-orange-200"
                  onClick={(e) => { e.stopPropagation(); onAction('contract_reminder', lead); }}
                >
                  <Bell className="w-4 h-4 ml-2" />
                  תזכורת חוזה
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default function Leads() {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('table');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showNewLeadDialog, setShowNewLeadDialog] = useState(false);
  const [showFollowUpDialog, setShowFollowUpDialog] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [followUpDate, setFollowUpDate] = useState('');
  const [showAiAssist, setShowAiAssist] = useState(false);
  const [aiLead, setAiLead] = useState(null);
  
  const [newLead, setNewLead] = useState({
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

  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['leads', user?.email],
    queryFn: () => base44.entities.Lead.filter({ created_by: user.email }, '-created_date', 200),
    enabled: !!user,
  });

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
    mutationFn: (id) => base44.entities.Lead.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success("הליד נמחק");
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
        status: 'follow_up'
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

  const filteredLeads = leads.filter((lead) => {
    const matchesSearch = 
      lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.phone.includes(searchTerm) ||
      (lead.email && lead.email.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status) => {
    const statusMap = {
      new: { label: 'חדש', color: 'bg-blue-100 text-blue-700' },
      in_progress: { label: 'בטיפול', color: 'bg-yellow-100 text-yellow-700' },
      follow_up: { label: 'מעקב', color: 'bg-purple-100 text-purple-700' },
      quote_sent: { label: 'הצעה נשלחה', color: 'bg-indigo-100 text-indigo-700' },
      closed_won: { label: 'נסגר בהצלחה', color: 'bg-green-100 text-green-700' },
      closed_lost: { label: 'נכשל', color: 'bg-red-100 text-red-700' },
    };
    const badge = statusMap[status] || { label: status, color: 'bg-slate-100 text-slate-700' };
    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${badge.color}`}>
        {badge.label}
      </span>
    );
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            ניהול לידים
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">מסד נתונים מרכזי לכל הלידים</p>
        </div>
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



      {/* Data Actions Toolbar */}
      <Card className="border shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3">
            {/* View Switcher */}
            <div className="flex bg-slate-100 p-1 rounded-lg shrink-0">
              <Button variant={viewMode === 'table' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('table')} className="gap-1.5">
                <List className="w-4 h-4" /> טבלה
              </Button>
              <Button variant={viewMode === 'grid' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('grid')} className="gap-1.5">
                <LayoutGrid className="w-4 h-4" /> כרטיסים
              </Button>
              <Button variant={viewMode === 'map' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('map')} className="gap-1.5">
                <Map className="w-4 h-4" /> מפה
              </Button>
            </div>

            {/* Search */}
            <div className="flex-1 relative min-w-[200px]">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="חיפוש שם, טלפון, אימייל..." className="pr-10 h-9" />
            </div>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32 md:w-40 h-9 text-xs font-bold">
                <SelectValue placeholder="סטטוס" />
              </SelectTrigger>
              <SelectContent dir="rtl">
                <SelectItem value="all">הכל</SelectItem>
                <SelectItem value="new">חדש</SelectItem>
                <SelectItem value="in_progress">בטיפול</SelectItem>
                <SelectItem value="follow_up">מעקב</SelectItem>
                <SelectItem value="quote_sent">הצעה</SelectItem>
                <SelectItem value="closed_won">נסגר</SelectItem>
                <SelectItem value="closed_lost">נכשל</SelectItem>
              </SelectContent>
            </Select>

            {/* Data Actions */}
            <DataActionsToolbar leads={leads} />
          </div>
        </CardContent>
      </Card>

      {/* Lead Count */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">{filteredLeads.length} לידים</p>
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
          leads={filteredLeads} 
          onStatusChange={(id, status) => updateLeadMutation.mutate({ id, data: { status } })}
          onDelete={(id) => { if (confirm('למחוק את הליד?')) deleteLeadMutation.mutate(id); }}
        />
      ) : viewMode === 'map' ? (
        <Card className="border shadow-sm overflow-hidden h-[600px] relative z-0">
          <MapContainer center={[31.0461, 34.8516]} zoom={7} style={{ height: '100%', width: '100%', zIndex: 1 }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {filteredLeads.map((lead) => (
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
          {filteredLeads.map((lead) => (
            <SwipeableLeadCard 
              key={lead.id} 
              lead={lead} 
              onAction={handleAction} 
              getStatusBadge={getStatusBadge} 
            />
          ))}
        </div>
      )}
    </div>
  );
}