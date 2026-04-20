import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { 
  Plus, Search, Filter, Phone, Mail, Calendar, Bell, Clock, 
  MessageCircle, FileText, Trash2, CheckSquare, MoreVertical,
  Sparkles
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
      <div className="absolute inset-0 flex items-center justify-between pointer-events-none">
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
        className="bg-black relative h-full z-10 rounded-xl border border-[#FFD700] shadow-[0_0_15px_rgba(255,215,0,0.15)] w-full max-w-full box-border"
      >
        <Card className="hover:border-[#FFD700]/50 transition-all duration-300 h-full border-none shadow-none bg-transparent">
          <CardContent className="p-5">
            <Link to={createPageUrl(`LeadDetails?id=${lead.id}`)} className="block hover:opacity-80">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-white hover:underline">
                    {lead.name}
                  </h3>
                  {lead.shooting_type && (
                    <p className="text-xs text-slate-400">{lead.shooting_type}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(lead.status)}
                  <Button variant="ghost" size="icon" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAction('delete', lead); }} className="h-8 w-8 text-[#FFD700] hover:bg-[#FFD700]/20 hover:text-[#FFD700]">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-3 mb-5">
                <div className="flex items-center gap-3 text-sm text-slate-300">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#FFD700] to-[#C5A028] flex items-center justify-center shadow-[0_0_10px_rgba(255,215,0,0.4)] shrink-0">
                    <Phone className="w-4 h-4 text-white" />
                  </div>
                  {lead.phone}
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-300">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#FFD700] to-[#C5A028] flex items-center justify-center shadow-[0_0_10px_rgba(255,215,0,0.4)] shrink-0">
                    <Search className="w-4 h-4 text-white" />
                  </div>
                  {lead.source || 'מקור לא ידוע'}
                </div>
                
                <div className="flex items-center gap-3">
                  <div 
                    className="inline-flex items-center gap-3 text-xs font-bold text-[#FFD700] bg-[#1a1a1a] p-2 rounded-lg cursor-pointer hover:bg-[#2a2a2a] transition-colors border border-[#FFD700]/30" 
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAction('ai_assist', lead); }}
                  >
                    <Sparkles className="w-4 h-4" />
                    מידע לפי נייד
                  </div>
                </div>
                
                {lead.next_follow_up_date && (
                  <div className="flex items-center gap-3 text-sm text-amber-500 font-bold bg-[#1a1a1a] p-2 rounded-lg border border-amber-500/30">
                    <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                      <Clock className="w-3.5 h-3.5 text-amber-500" />
                    </div>
                    פולו-אפ: {new Date(lead.next_follow_up_date).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })}
                  </div>
                )}
              </div>
            </Link>

            {/* Quick Actions Row */}
            <div className="flex flex-col gap-3 pt-4 border-t border-white/10 w-full">
              <a 
                href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`היי ${lead.name}, זה נתי גולד, קיבלתי את הפנייה שלך...`)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => { e.stopPropagation(); onAction('log_whatsapp', lead); }}
                className="flex items-center justify-center gap-3 bg-[#FFD700] hover:bg-[#e6c200] text-black shadow-[0_0_15px_rgba(255,215,0,0.3)] px-6 py-2 h-11 transition-all duration-300 font-bold rounded-xl w-full"
              >
                <MessageCircle className="w-5 h-5 text-black" />
                <span className="text-sm font-bold tracking-wide">WhatsApp</span>
              </a>
              <div className="flex justify-between w-full">
                <a href={`tel:${lead.phone}`} onClick={(e) => { e.stopPropagation(); onAction('log_call', lead); }} className="flex-1 mr-2">
                  <Button variant="ghost" className="h-10 w-full rounded-xl bg-[#1a1a1a] text-slate-300 hover:bg-[#2a2a2a] hover:text-[#FFD700] border border-white/5">
                    <Phone className="w-4 h-4 ml-2" />
                    התקשר
                  </Button>
                </a>
                <Button variant="ghost" className="h-10 flex-1 ml-2 rounded-xl bg-[#1a1a1a] text-slate-300 hover:bg-[#2a2a2a] hover:text-[#FFD700] border border-white/5" onClick={(e) => { e.stopPropagation(); onAction('log_manual', lead); }}>
                  <FileText className="w-4 h-4 ml-2" />
                  תיעוד
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default function Leads() {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('grid');
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
    } else if (action === 'trigger_airtable_whatsapp') {
      toast.loading("מפעיל אוטומציה ב-Airtable...", { id: 'wa-trigger' });
      base44.functions.invoke('triggerAirtableWhatsApp', { 
        leadId: lead.id, 
        templateName: 'Bronze Package'
      }).then(() => {
        toast.success("הודעת WhatsApp נשלחה דרך Airtable", { id: 'wa-trigger' });
      }).catch((e) => {
        toast.error("שגיאה בהפעלת Airtable: " + e.message, { id: 'wa-trigger' });
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
      new: { label: 'חדש', icon: Search },
      in_progress: { label: 'בטיפול', icon: Clock },
      follow_up: { label: 'מעקב', icon: Phone },
      quote_sent: { label: 'הצעה נשלחה', icon: FileText },
      closed_won: { label: 'נסגר בהצלחה', icon: CheckSquare },
      closed_lost: { label: 'נכשל', icon: Trash2 },
    };
    const badge = statusMap[status] || { label: status, icon: Search };
    const Icon = badge.icon;
    return (
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#FFD700] to-[#C5A028] flex items-center justify-center shadow-[0_0_10px_rgba(255,215,0,0.4)] shrink-0">
          <Icon className="w-4 h-4 text-white" />
        </div>
        <span className="text-xs font-bold text-[#FFD700] tracking-wide">
          {badge.label}
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-[#FFD700] drop-shadow-[0_0_10px_rgba(255,215,0,0.8)] tracking-wider">
            ניהול לידים
          </h1>
          <p className="text-slate-400 mt-1">נהל את כל הלידים והפניות שלך במקום אחד</p>
        </div>
        <Dialog open={showNewLeadDialog} onOpenChange={setShowNewLeadDialog}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-[#D4AF37] to-[#C5A028] hover:from-[#C5A028] hover:to-[#D4AF37] text-black shadow-lg">
              <Plus className="w-5 h-5 ml-2" />
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
          <div className="space-y-4 mt-4 bg-slate-950 p-4 rounded-lg border border-slate-800 text-slate-300">
            <p className="text-sm font-medium text-white">
              מזהה מתקשר אוטומטי עבור: {aiLead?.phone}
            </p>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                <span>זיהוי משוער: <strong className="text-white">קשור לקול צעקה / עמותות</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                <span>פניות עבר: <strong className="text-white">לא נמצאו רישומים קודמים</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#FFD700]"></span>
                <span>המלצת AI: <strong className="text-[#FFD700]">מומלץ לבדוק תקציב בתחילת השיחה</strong></span>
              </div>
            </div>
            <Button 
              onClick={() => setShowAiAssist(false)} 
              className="w-full bg-[#FFD700] hover:bg-[#e6c200] text-black mt-4"
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



      {/* Filters */}
      <Card className="border shadow-lg">
        <CardContent className="p-4">
          <div className="flex gap-4 flex-wrap">
            <div className="flex bg-slate-100 p-1 rounded-lg">
              <Button 
                variant={viewMode === 'grid' ? 'default' : 'ghost'} 
                size="sm" 
                onClick={() => setViewMode('grid')}
              >
                רשימה
              </Button>
              <Button 
                variant={viewMode === 'map' ? 'default' : 'ghost'} 
                size="sm" 
                onClick={() => setViewMode('map')}
              >
                מפה
              </Button>
            </div>
            <div className="flex-1 relative min-w-[200px]">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="חיפוש..."
                className="pr-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32 md:w-48 bg-[#1a1a1a] text-[#FFD700] border-[#FFD700]/30 font-bold">
                <SelectValue placeholder="סטטוס" />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a1a] text-white border-[#FFD700]/30">
                <SelectItem value="all">הכל</SelectItem>
                <SelectItem value="new">חדש</SelectItem>
                <SelectItem value="in_progress">בטיפול</SelectItem>
                <SelectItem value="follow_up">מעקב</SelectItem>
                <SelectItem value="quote_sent">הצעה</SelectItem>
                <SelectItem value="closed_won">סגור</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Leads Grid */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#FFD700]"></div>
        </div>
      ) : filteredLeads.length === 0 ? (
        <Card className="border shadow-lg">
          <CardContent className="p-12 text-center">
            <p className="text-slate-500">לא נמצאו לידים</p>
          </CardContent>
        </Card>
      ) : viewMode === 'map' ? (
        <Card className="border shadow-lg overflow-hidden h-[600px] relative z-0">
          <MapContainer center={[31.0461, 34.8516]} zoom={7} style={{ height: '100%', width: '100%', zIndex: 1 }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {filteredLeads.map((lead, i) => (
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