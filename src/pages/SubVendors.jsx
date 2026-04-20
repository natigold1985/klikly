import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Phone, Star, DollarSign, Trash2, MessageCircle, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';

const specialtyLabels = {
  second_shooter: 'צלם שני',
  editor: 'עורך',
  album_designer: 'מעצב אלבומים',
  videographer: 'צלם וידאו',
  drone_operator: 'מפעיל רחפן',
  makeup_artist: 'מאפרת',
  other: 'אחר',
};

export default function SubVendors() {
  const [search, setSearch] = useState('');
  const [specFilter, setSpecFilter] = useState('all');
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', specialty: 'second_shooter', rate_per_event: '', notes: '', bank_details: '', instagram: '' });
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: vendors = [], isLoading } = useQuery({
    queryKey: ['subvendors', user?.email],
    queryFn: () => base44.entities.SubVendor.filter({ created_by: user.email }, '-created_date', 200),
    enabled: !!user,
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ['vendor_assignments', user?.email],
    queryFn: () => base44.entities.VendorAssignment.filter({ created_by: user.email }, '-created_date', 500),
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.SubVendor.create({...data, rate_per_event: data.rate_per_event ? parseFloat(data.rate_per_event) : undefined}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subvendors'] });
      setShowNew(false);
      setForm({ name: '', phone: '', email: '', specialty: 'second_shooter', rate_per_event: '', notes: '', bank_details: '', instagram: '' });
      toast.success('ספק נוסף');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.SubVendor.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subvendors'] });
      toast.success('נמחק');
    },
  });

  const filtered = vendors.filter(v => {
    const matchSearch = v.name.toLowerCase().includes(search.toLowerCase()) || v.phone.includes(search);
    const matchSpec = specFilter === 'all' || v.specialty === specFilter;
    return matchSearch && matchSpec;
  });

  const getVendorStats = (vendorId) => {
    const vendorAssignments = assignments.filter(a => a.vendor_id === vendorId);
    const totalProjects = vendorAssignments.length;
    const totalPaid = vendorAssignments.filter(a => a.payment_status === 'paid').reduce((sum, a) => sum + (a.agreed_rate || 0), 0);
    const totalPending = vendorAssignments.filter(a => a.payment_status !== 'paid').reduce((sum, a) => sum + (a.agreed_rate || 0), 0);
    return { totalProjects, totalPaid, totalPending };
  };

  return (
    <div className="space-y-6 pb-20" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-[#FFD700] drop-shadow-[0_0_8px_rgba(255,215,0,0.4)]">ספקי משנה</h1>
          <p className="text-slate-500 mt-1">צלמי משנה, עורכים, מעצבי אלבומים ועוד</p>
        </div>
        <Dialog open={showNew} onOpenChange={setShowNew}>
          <DialogTrigger asChild>
            <Button><Plus className="w-5 h-5 ml-2" />ספק חדש</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]" dir="rtl">
            <DialogHeader><DialogTitle>ספק חדש</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <Input placeholder="שם *" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
              <div className="grid grid-cols-2 gap-4">
                <Input placeholder="טלפון *" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
                <Input placeholder="אימייל" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
              </div>
              <Select value={form.specialty} onValueChange={v => setForm({...form, specialty: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(specialtyLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input placeholder="תעריף לאירוע (₪)" type="number" value={form.rate_per_event} onChange={e => setForm({...form, rate_per_event: e.target.value})} />
              <Input placeholder="פרטי בנק / ביט" value={form.bank_details} onChange={e => setForm({...form, bank_details: e.target.value})} />
              <Input placeholder="@אינסטגרם" value={form.instagram} onChange={e => setForm({...form, instagram: e.target.value})} />
              <textarea placeholder="הערות..." value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" rows={2} />
              <Button className="w-full" disabled={!form.name || !form.phone} onClick={() => createMutation.mutate(form)}>הוסף ספק</Button>
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
          <Select value={specFilter} onValueChange={setSpecFilter}>
            <SelectTrigger className="w-44"><SelectValue placeholder="התמחות" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">הכל</SelectItem>
              {Object.entries(specialtyLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="text-center py-12"><div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#FFD700]" /></div>
      ) : filtered.length === 0 ? (
        <Card className="border rounded-2xl"><CardContent className="p-12 text-center text-slate-500">לא נמצאו ספקים</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(v => {
            const stats = getVendorStats(v.id);
            return (
              <Card key={v.id} className="border hover:border-[#FFD700] transition-all rounded-2xl">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow">
                        {v.name[0]}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800">{v.name}</h3>
                        <Badge className="bg-purple-100 text-purple-700">{specialtyLabels[v.specialty] || v.specialty}</Badge>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500" onClick={() => { if (confirm('למחוק?')) deleteMutation.mutate(v.id); }}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  <div className="space-y-2 text-sm text-slate-600 mb-3">
                    <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-slate-400" />{v.phone}</div>
                    {v.rate_per_event && <div className="flex items-center gap-2"><DollarSign className="w-4 h-4 text-slate-400" />₪{v.rate_per_event.toLocaleString()} / אירוע</div>}
                    {v.rating && (
                      <div className="flex items-center gap-1">
                        {[...Array(5)].map((_, i) => <Star key={i} className={`w-3.5 h-3.5 ${i < v.rating ? 'text-[#FFD700] fill-[#FFD700]' : 'text-slate-300'}`} />)}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3 py-2 px-3 bg-slate-50 rounded-lg text-xs text-slate-600 mb-3">
                    <span className="flex items-center gap-1"><UserCheck className="w-3 h-3" />{stats.totalProjects} פרויקטים</span>
                    <span className="text-green-600">שולם: ₪{stats.totalPaid.toLocaleString()}</span>
                    {stats.totalPending > 0 && <span className="text-red-500">ממתין: ₪{stats.totalPending.toLocaleString()}</span>}
                  </div>

                  <a href={`https://wa.me/${v.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white text-xs gap-1"><MessageCircle className="w-3.5 h-3.5" />WhatsApp</Button>
                  </a>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}