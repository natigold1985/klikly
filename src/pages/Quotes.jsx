import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { Plus, Search, FileText, Eye, Send, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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

export default function Quotes() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showNewQuoteDialog, setShowNewQuoteDialog] = useState(false);
  const [newQuote, setNewQuote] = useState({
    client_name: '',
    client_email: '',
    template: 'minimalist',
    package_name: '',
    package_description: '',
    items: [],
    total_price: '',
    terms: '',
    valid_until: '',
  });

  const queryClient = useQueryClient();

  const { data: quotes = [], isLoading } = useQuery({
    queryKey: ['quotes'],
    queryFn: () => base44.entities.Quote.list('-created_date', 200),
  });

  const { data: leads = [] } = useQuery({
    queryKey: ['leads'],
    queryFn: () => base44.entities.Lead.list('-created_date', 100),
  });

  const createQuoteMutation = useMutation({
    mutationFn: (quoteData) => base44.entities.Quote.create(quoteData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      setShowNewQuoteDialog(false);
      setNewQuote({
        client_name: '',
        client_email: '',
        template: 'minimalist',
        package_name: '',
        package_description: '',
        items: [],
        total_price: '',
        terms: '',
        valid_until: '',
      });
    },
  });

  const handleCreateQuote = () => {
    if (!newQuote.client_name || !newQuote.client_email || !newQuote.total_price) return;
    
    const accessToken = Math.random().toString(36).substring(2) + Date.now().toString(36);
    
    createQuoteMutation.mutate({
      ...newQuote,
      total_price: parseFloat(newQuote.total_price),
      access_token: accessToken,
    });
  };

  const filteredQuotes = quotes.filter((quote) => {
    const matchesSearch = 
      quote.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (quote.client_email && quote.client_email.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || quote.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status) => {
    const statusMap = {
      draft: { label: 'טיוטה', color: 'bg-gray-500', icon: FileText },
      sent: { label: 'נשלחה', color: 'bg-blue-500', icon: Send },
      viewed: { label: 'נצפתה', color: 'bg-purple-500', icon: Eye },
      accepted: { label: 'אושרה', color: 'bg-green-500', icon: CheckCircle2 },
      rejected: { label: 'נדחתה', color: 'bg-red-500', icon: XCircle },
    };
    const badge = statusMap[status] || { label: status, color: 'bg-gray-500', icon: FileText };
    const Icon = badge.icon;
    return (
      <Badge className={`${badge.color} text-white flex items-center gap-1`}>
        <Icon className="w-3 h-3" />
        {badge.label}
      </Badge>
    );
  };

  const getTemplatePreview = (template) => {
    const templates = {
      minimalist: { name: 'מינימליסטי', gradient: 'from-slate-400 to-slate-600' },
      dark: { name: 'כהה', gradient: 'from-gray-800 to-black' },
      elegant: { name: 'אלגנטי', gradient: 'from-purple-400 to-pink-600' },
    };
    return templates[template] || templates.minimalist;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            הצעות מחיר
          </h1>
          <p className="text-slate-600 mt-1">צור ונהל הצעות מחיר מקצוועניות</p>
        </div>
        <Dialog open={showNewQuoteDialog} onOpenChange={setShowNewQuoteDialog}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-lg">
              <Plus className="w-5 h-5 ml-2" />
              הצעת מחיר חדשה
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]" dir="rtl">
            <DialogHeader>
              <DialogTitle>הצעת מחיר חדשה</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4 max-h-[600px] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">שם לקוח *</label>
                  <Input
                    value={newQuote.client_name}
                    onChange={(e) => setNewQuote({ ...newQuote, client_name: e.target.value })}
                    placeholder="שם מלא"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">אימייל *</label>
                  <Input
                    value={newQuote.client_email}
                    onChange={(e) => setNewQuote({ ...newQuote, client_email: e.target.value })}
                    placeholder="email@example.com"
                    type="email"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">תבנית עיצוב</label>
                <Select value={newQuote.template} onValueChange={(value) => setNewQuote({ ...newQuote, template: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minimalist">מינימליסטי</SelectItem>
                    <SelectItem value="dark">כהה</SelectItem>
                    <SelectItem value="elegant">אלגנטי</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">שם חבילה</label>
                <Input
                  value={newQuote.package_name}
                  onChange={(e) => setNewQuote({ ...newQuote, package_name: e.target.value })}
                  placeholder="חבילת זהב / חבילה בסיסית"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">תיאור החבילה</label>
                <textarea
                  value={newQuote.package_description}
                  onChange={(e) => setNewQuote({ ...newQuote, package_description: e.target.value })}
                  placeholder="תיאור מפורט של מה כלול בחבילה..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  rows="4"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">מחיר (₪) *</label>
                  <Input
                    value={newQuote.total_price}
                    onChange={(e) => setNewQuote({ ...newQuote, total_price: e.target.value })}
                    placeholder="5000"
                    type="number"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">תוקף עד</label>
                  <Input
                    value={newQuote.valid_until}
                    onChange={(e) => setNewQuote({ ...newQuote, valid_until: e.target.value })}
                    type="date"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">תנאים</label>
                <textarea
                  value={newQuote.terms}
                  onChange={(e) => setNewQuote({ ...newQuote, terms: e.target.value })}
                  placeholder="תנאי התשלום וההתקשרות..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  rows="3"
                />
              </div>

              <Button
                onClick={handleCreateQuote}
                className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
                disabled={!newQuote.client_name || !newQuote.client_email || !newQuote.total_price}
              >
                צור הצעת מחיר
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
                placeholder="חיפוש לפי שם לקוח או אימייל..."
                className="pr-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="כל הסטטוסים" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הסטטוסים</SelectItem>
                <SelectItem value="draft">טיוטה</SelectItem>
                <SelectItem value="sent">נשלחה</SelectItem>
                <SelectItem value="viewed">נצפתה</SelectItem>
                <SelectItem value="accepted">אושרה</SelectItem>
                <SelectItem value="rejected">נדחתה</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Quotes Grid */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : filteredQuotes.length === 0 ? (
        <Card className="bg-white/60 backdrop-blur-sm border-white/20 shadow-lg">
          <CardContent className="p-12 text-center">
            <FileText className="w-16 h-16 mx-auto text-slate-400 mb-4" />
            <p className="text-slate-500">לא נמצאו הצעות מחיר</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredQuotes.map((quote) => {
            const template = getTemplatePreview(quote.template);
            return (
              <Card key={quote.id} className="bg-white/60 backdrop-blur-sm border-white/20 hover:shadow-xl transition-all duration-300 cursor-pointer group">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${template.gradient} flex items-center justify-center`}>
                        <FileText className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">
                          {quote.client_name}
                        </h3>
                        {quote.package_name && (
                          <p className="text-sm text-slate-600">{quote.package_name}</p>
                        )}
                      </div>
                    </div>
                    {getStatusBadge(quote.status)}
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="text-lg font-bold text-indigo-600">
                      ₪{quote.total_price.toLocaleString()}
                    </div>
                    <div className="text-xs text-slate-500">
                      תבנית: {template.name}
                    </div>
                    {quote.valid_until && (
                      <div className="text-xs text-slate-500">
                        תוקף עד: {new Date(quote.valid_until).toLocaleDateString('he-IL')}
                      </div>
                    )}
                  </div>

                  {quote.viewed_at && (
                    <div className="pt-4 border-t border-slate-200 text-xs text-slate-600">
                      נצפתה ב-{new Date(quote.viewed_at).toLocaleDateString('he-IL')}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}