import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { 
  Plus, Search, Filter, Phone, Mail, Calendar, Bell, Clock, 
  MessageCircle, FileText, Trash2, CheckSquare, MoreVertical 
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
        className="bg-card relative h-full z-10"
      >
        <Card className="border hover:shadow-xl transition-all duration-300 h-full border-none shadow-none rounded-none">
          <CardContent className="p-5">
            <Link to={createPageUrl(`LeadDetails?id=${lead.id}`)} className="block hover:opacity-80">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-lg font-bold text-slate-800 hover:underline">
                    {lead.name}
                  </h3>
                  {lead.shooting_type && (
                    <p className="text-xs text-slate-500">{lead.shooting_type}</p>
                  )}
                </div>
                {getStatusBadge(lead.status)}
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  {lead.phone}
                </div>
                {lead.next_follow_up_date && (
                  <div className="flex items-center gap-2 text-sm text-amber-600 font-medium bg-amber-50 p-1 rounded">
                    <Clock className="w-3.5 h-3.5" />
                    פולו-אפ: {new Date(lead.next_follow_up_date).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })}
                  </div>
                )}
              </div>
            </Link>

            {/* Quick Actions Row */}
            <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
              <a href={`tel:${lead.phone}`} onClick={(e) => { e.stopPropagation(); onAction('log_call', lead); }}>
                <Button size="icon" variant="ghost" className="h-10 w-10 rounded-full bg-green-50 text-green-600 hover:bg-green-100">
                  <Phone className="w-5 h-5" />
                </Button>
              </a>
              <a href={whatsappLink} target="_blank" rel="noopener noreferrer" onClick={(e) => { e.stopPropagation(); onAction('log_whatsapp', lead); }}>
                <Button size="icon" variant="ghost" className="h-10 w-10 rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-100">
                  <MessageCircle className="w-5 h-5" />
                </Button>
              </a>
              <Button size="icon" variant="ghost" className="h-10 w-10 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100" onClick={(e) => { e.stopPropagation(); onAction('log_manual', lead); }}>
                <FileText className="w-5 h-5" />
              </Button>
              <Button variant="ghost" className="mr-auto text-xs text-slate-500 hover:text-slate-800" onClick={(e) => { e.stopPropagation(); onAction('followup', lead); }}>
                <Clock className="w-4 h-4 mr-1" />
                תזמון
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default function Leads() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showNewLeadDialog, setShowNewLeadDialog] = useState(false);
  const [showFollowUpDialog, setShowFollowUpDialog] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [followUpDate, setFollowUpDate] = useState('');
  
  const [newLead, setNewLead] = useState({
    name: '',
    phone: '',
    email: '',
    shooting_type: '',
    source: '',
    event_date: '',
    budget: '',
    notes: '',
  });

  const queryClient = useQueryClient();

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['leads'],
    queryFn: () => base44.entities.Lead.list('-created_date', 200),
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
      new: { label: 'חדש', color: 'bg-blue-500' },
      follow_up: { label: 'מעקב', color: 'bg-yellow-500' },
      quote_sent: { label: 'הצעה נשלחה', color: 'bg-purple-500' },
      closed_won: { label: 'נסגר בהצלחה', color: 'bg-green-500' },
      closed_lost: { label: 'נכשל', color: 'bg-red-500' },
    };
    const badge = statusMap[status] || { label: status, color: 'bg-gray-500' };
    return (
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium text-white ${badge.color} shadow-sm`}>
        {badge.label}
      </span>
    );
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            ניהול לידים
          </h1>
          <p className="text-slate-600 mt-1">נהל את כל הלידים והפניות שלך במקום אחד</p>
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
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
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
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="חיפוש..."
                className="pr-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32 md:w-48">
                <SelectValue placeholder="סטטוס" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">הכל</SelectItem>
                <SelectItem value="new">חדש</SelectItem>
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
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : filteredLeads.length === 0 ? (
        <Card className="border shadow-lg">
          <CardContent className="p-12 text-center">
            <p className="text-slate-500">לא נמצאו לידים</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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