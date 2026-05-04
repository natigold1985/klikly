import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Phone, Mail, User, Tag, MessageCircle, Briefcase, DollarSign, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';

const typeLabels = {
  client: { label: 'לקוח', color: 'bg-blue-100 text-blue-700' },
  vendor: { label: 'ספק', color: 'bg-purple-100 text-purple-700' },
  lead: { label: 'ליד', color: 'bg-yellow-100 text-yellow-700' },
  other: { label: 'אחר', color: 'bg-gray-100 text-gray-700' },
};

export default function Contacts() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', type: 'client', address: '', notes: '', source: '', instagram: '', birthday: '', birthday_greeting_consent: false });
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['contacts', user?.email],
    queryFn: () => base44.entities.Contact.filter({ created_by: user.email }, '-created_date', 500),
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Contact.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setShowNew(false);
      setForm({ name: '', phone: '', email: '', type: 'client', address: '', notes: '', source: '', instagram: '', birthday: '', birthday_greeting_consent: false });
      toast.success('איש קשר נוצר');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Contact.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('נמחק');
    },
  });

  const filtered = contacts.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search) || (c.email && c.email.toLowerCase().includes(search.toLowerCase()));
    const matchType = typeFilter === 'all' || c.type === typeFilter;
    return matchSearch && matchType;
  });

  return (
    <div className="space-y-6 pb-20" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-[#FFD700] drop-shadow-[0_0_8px_rgba(255,215,0,0.4)]">אנשי קשר</h1>
          <p className="text-slate-500 mt-1">ספר כתובות מרכזי — לקוחות, ספקים ושותפים</p>
        </div>
        <Dialog open={showNew} onOpenChange={setShowNew}>
          <DialogTrigger asChild>
            <Button><Plus className="w-5 h-5 ml-2" />איש קשר חדש</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]" dir="rtl">
            <DialogHeader><DialogTitle>איש קשר חדש</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <Input placeholder="שם מלא *" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
              <div className="grid grid-cols-2 gap-4">
                <Input placeholder="טלפון *" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
                <Input placeholder="אימייל" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
              </div>
              <Select value={form.type} onValueChange={v => setForm({...form, type: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="client">לקוח</SelectItem>
                  <SelectItem value="vendor">ספק</SelectItem>
                  <SelectItem value="lead">ליד</SelectItem>
                  <SelectItem value="other">אחר</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="כתובת" value={form.address} onChange={e => setForm({...form, address: e.target.value})} />
              <Input placeholder="מקור (פייסבוק, המלצה...)" value={form.source} onChange={e => setForm({...form, source: e.target.value})} />
              <Input placeholder="@אינסטגרם" value={form.instagram} onChange={e => setForm({...form, instagram: e.target.value})} />
              <div>
                <label className="block text-xs text-slate-500 mb-1">תאריך יום הולדת (לברכה אוטומטית עם קופון)</label>
                <Input type="date" value={form.birthday} onChange={e => setForm({...form, birthday: e.target.value})} />
              </div>
              {form.birthday && (
                <label className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 cursor-pointer">
                  <input type="checkbox" checked={form.birthday_greeting_consent} onChange={e => setForm({...form, birthday_greeting_consent: e.target.checked})} className="mt-0.5 w-4 h-4 accent-amber-500" />
                  <span className="text-xs text-slate-700 leading-relaxed">הלקוח/ה אישר/ה לקבל ברכת יום הולדת + קופון הנחה ב-WhatsApp/אימייל</span>
                </label>
              )}
              <textarea placeholder="הערות..." value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" rows={2} />
              <Button className="w-full" disabled={!form.name || !form.phone} onClick={() => createMutation.mutate(form)}>צור איש קשר</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border shadow-sm rounded-2xl">
        <CardContent className="p-4 flex gap-4 flex-wrap">
          <div className="flex-1 relative min-w-[200px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="חיפוש..." className="pr-10" />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="סוג" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">הכל</SelectItem>
              <SelectItem value="client">לקוחות</SelectItem>
              <SelectItem value="vendor">ספקים</SelectItem>
              <SelectItem value="lead">לידים</SelectItem>
              <SelectItem value="other">אחר</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="text-center py-12"><div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#FFD700]" /></div>
      ) : filtered.length === 0 ? (
        <Card className="border rounded-2xl"><CardContent className="p-12 text-center text-slate-500">לא נמצאו אנשי קשר</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(c => (
            <Card key={c.id} className="border hover:border-[#FFD700] transition-all rounded-2xl group">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#FFD700] to-[#C5A028] flex items-center justify-center text-black font-bold text-lg shadow">
                      {c.name[0]}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800">{c.name}</h3>
                      <Badge className={typeLabels[c.type]?.color || 'bg-gray-100'}>{typeLabels[c.type]?.label || c.type}</Badge>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500" onClick={() => { if (confirm('למחוק?')) deleteMutation.mutate(c.id); }}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <div className="space-y-2 text-sm text-slate-600">
                  <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-slate-400" />{c.phone}</div>
                  {c.email && <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-slate-400" />{c.email}</div>}
                  {c.source && <div className="flex items-center gap-2"><Tag className="w-4 h-4 text-slate-400" />{c.source}</div>}
                </div>
                {(c.total_projects > 0 || c.total_revenue > 0) && (
                  <div className="flex gap-4 mt-3 pt-3 border-t text-xs text-slate-500">
                    {c.total_projects > 0 && <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" />{c.total_projects} פרויקטים</span>}
                    {c.total_revenue > 0 && <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />₪{c.total_revenue.toLocaleString()}</span>}
                  </div>
                )}
                <div className="flex gap-2 mt-3 pt-3 border-t">
                  <a href={`https://wa.me/${c.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex-1">
                    <Button size="sm" className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white text-xs gap-1"><MessageCircle className="w-3.5 h-3.5" />WhatsApp</Button>
                  </a>
                  <a href={`tel:${c.phone}`} className="flex-1">
                    <Button size="sm" variant="outline" className="w-full text-xs gap-1"><Phone className="w-3.5 h-3.5" />חייג</Button>
                  </a>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}