import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { Plus, Search, Filter, Phone, Mail, Calendar } from 'lucide-react';
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

export default function Leads() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showNewLeadDialog, setShowNewLeadDialog] = useState(false);
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
    },
  });

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
      <span className={`px-3 py-1 rounded-full text-xs font-medium text-white ${badge.color} shadow-lg`}>
        {badge.label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            ניהול לידים
          </h1>
          <p className="text-slate-600 mt-1">נהל את כל הלידים והפניות שלך במקום אחד</p>
        </div>
        <Dialog open={showNewLeadDialog} onOpenChange={setShowNewLeadDialog}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-lg">
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
                className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
                disabled={!newLead.name || !newLead.phone}
              >
                צור ליד
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card className="bg-white/60 backdrop-blur-sm border-white/20 shadow-lg">
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="חיפוש לפי שם, טלפון או אימייל..."
                className="pr-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="כל הסטטוסים" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הסטטוסים</SelectItem>
                <SelectItem value="new">חדש</SelectItem>
                <SelectItem value="follow_up">מעקב</SelectItem>
                <SelectItem value="quote_sent">הצעה נשלחה</SelectItem>
                <SelectItem value="closed_won">נסגר בהצלחה</SelectItem>
                <SelectItem value="closed_lost">נכשל</SelectItem>
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
        <Card className="bg-white/60 backdrop-blur-sm border-white/20 shadow-lg">
          <CardContent className="p-12 text-center">
            <p className="text-slate-500">לא נמצאו לידים</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredLeads.map((lead) => (
            <Link key={lead.id} to={createPageUrl(`LeadDetails?id=${lead.id}`)}>
              <Card className="bg-white/60 backdrop-blur-sm border-white/20 hover:shadow-xl transition-all duration-300 cursor-pointer group h-full">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">
                        {lead.name}
                      </h3>
                      {lead.shooting_type && (
                        <p className="text-sm text-slate-600">{lead.shooting_type}</p>
                      )}
                    </div>
                    {getStatusBadge(lead.status)}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Phone className="w-4 h-4 text-indigo-500" />
                      {lead.phone}
                    </div>
                    {lead.email && (
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Mail className="w-4 h-4 text-purple-500" />
                        {lead.email}
                      </div>
                    )}
                    {lead.event_date && (
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Calendar className="w-4 h-4 text-green-500" />
                        {new Date(lead.event_date).toLocaleDateString('he-IL')}
                      </div>
                    )}
                  </div>

                  {lead.source && (
                    <div className="mt-4 pt-4 border-t border-slate-200">
                      <span className="text-xs text-slate-500">מקור: {lead.source}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}