import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Trash2, Edit, Copy, Star, FileStack, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const emptyTemplate = {
  name: '',
  description: '',
  package_name: '',
  package_description: '',
  items: [{ description: '', quantity: 1, price: 0 }],
  terms: '',
  valid_days: 30,
  is_default: false,
};

export default function QuoteTemplates() {
  const queryClient = useQueryClient();
  const [showEditor, setShowEditor] = useState(false);
  const [form, setForm] = useState(emptyTemplate);
  const [editingId, setEditingId] = useState(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['quoteTemplates'],
    queryFn: () => base44.entities.QuoteTemplate.list('-created_date', 100),
  });

  const saveMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      if (id) return base44.entities.QuoteTemplate.update(id, data);
      return base44.entities.QuoteTemplate.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quoteTemplates'] });
      setShowEditor(false);
      setForm(emptyTemplate);
      setEditingId(null);
      toast.success('התבנית נשמרה');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.QuoteTemplate.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quoteTemplates'] });
      toast.success('התבנית נמחקה');
    },
  });

  const total = form.items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.price) || 0), 0);

  const updateItem = (idx, field, value) => {
    const items = [...form.items];
    items[idx] = { ...items[idx], [field]: field === 'description' ? value : Number(value) };
    setForm({ ...form, items });
  };

  const handleEdit = (template) => {
    setEditingId(template.id);
    setForm({
      name: template.name || '',
      description: template.description || '',
      package_name: template.package_name || '',
      package_description: template.package_description || '',
      items: template.items?.length ? template.items : [{ description: '', quantity: 1, price: 0 }],
      terms: template.terms || '',
      valid_days: template.valid_days || 30,
      is_default: template.is_default || false,
    });
    setShowEditor(true);
  };

  const handleDuplicate = (template) => {
    setEditingId(null);
    setForm({
      ...template,
      name: `${template.name} (עותק)`,
      is_default: false,
    });
    setShowEditor(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      toast.error('נדרש שם לתבנית');
      return;
    }
    saveMutation.mutate({ id: editingId, data: form });
  };

  return (
    <div className="space-y-6 pb-20" dir="rtl">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold text-slate-900">תבניות הצעת מחיר</h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">בנה תבניות חוזרות והשתמש בהן ליצירת הצעות מחיר במהירות</p>
        </div>
        <Button size="sm" className="gap-1.5 flex-shrink-0" onClick={() => { setEditingId(null); setForm(emptyTemplate); setShowEditor(true); }}>
          <Plus className="w-4 h-4" /> תבנית חדשה
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#D4AF37]"></div>
        </div>
      ) : templates.length === 0 ? (
        <Card className="border">
          <CardContent className="p-12 text-center">
            <FileStack className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">אין תבניות עדיין</p>
            <Button size="sm" className="mt-4 gap-1.5" onClick={() => { setEditingId(null); setForm(emptyTemplate); setShowEditor(true); }}>
              <Plus className="w-4 h-4" /> צור תבנית ראשונה
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map(template => {
            const templateTotal = template.items?.reduce((s, i) => s + (i.quantity || 0) * (i.price || 0), 0) || 0;
            return (
              <Card key={template.id} className="border hover:border-[#C5A028]/40 hover:shadow-md transition-all rounded-2xl">
                <CardContent className="p-5">
                  <div className="flex justify-between items-start mb-3 gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900 truncate">{template.name}</h3>
                        {template.is_default && (
                          <Badge className="bg-amber-100 text-amber-700 text-[10px] font-bold flex-shrink-0">
                            <Star className="w-3 h-3 ml-0.5" /> ברירת מחדל
                          </Badge>
                        )}
                      </div>
                      {template.description && (
                        <p className="text-xs text-slate-500 truncate mt-0.5">{template.description}</p>
                      )}
                    </div>
                  </div>

                  {template.package_name && (
                    <p className="text-sm font-medium text-slate-700 mb-2">{template.package_name}</p>
                  )}

                  <div className="text-xs text-slate-500 mb-3">
                    {template.items?.length || 0} פריטים • תוקף {template.valid_days || 30} ימים
                  </div>

                  <div className="flex items-center justify-between mb-4 pt-2 border-t border-slate-100">
                    <span className="text-xs text-slate-400">סה"כ משוער</span>
                    <span className="text-lg font-extrabold text-[#C5A028]">₪{templateTotal.toLocaleString()}</span>
                  </div>

                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1 h-9 gap-1" onClick={() => handleEdit(template)}>
                      <Edit className="w-3.5 h-3.5" /> ערוך
                    </Button>
                    <Button size="sm" variant="outline" className="h-9" title="שכפל" onClick={() => handleDuplicate(template)}>
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-9 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => { if (confirm('למחוק את התבנית?')) deleteMutation.mutate(template.id); }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showEditor} onOpenChange={(open) => { if (!open) { setShowEditor(false); setForm(emptyTemplate); setEditingId(null); } }}>
        <DialogContent className="sm:max-w-[640px] max-h-[95vh] w-[95vw] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingId ? 'עריכת תבנית' : 'תבנית חדשה'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">שם התבנית *</label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="חבילת בר/בת מצווה" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">תוקף (ימים)</label>
                <Input type="number" min="1" value={form.valid_days} onChange={(e) => setForm({ ...form, valid_days: Number(e.target.value) })} />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">תיאור פנימי</label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="לתיעוד פנימי בלבד" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">שם החבילה</label>
                <Input value={form.package_name} onChange={(e) => setForm({ ...form, package_name: e.target.value })} placeholder="חבילת פרימיום" />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input type="checkbox" checked={form.is_default} onChange={(e) => setForm({ ...form, is_default: e.target.checked })} className="w-4 h-4" />
                  קבע כברירת מחדל
                </label>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">תיאור החבילה</label>
              <textarea value={form.package_description} onChange={(e) => setForm({ ...form, package_description: e.target.value })} placeholder="מה כלול בחבילה..." className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" rows="2" />
            </div>

            <div>
              <label className="text-sm font-bold text-slate-800 mb-2 block">פריטים</label>
              <div className="space-y-2">
                {form.items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <Input className="col-span-6" value={item.description} onChange={(e) => updateItem(idx, 'description', e.target.value)} placeholder="תיאור..." />
                    <Input className="col-span-2" type="number" min="1" value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', e.target.value)} />
                    <Input className="col-span-3" type="number" min="0" value={item.price} onChange={(e) => updateItem(idx, 'price', e.target.value)} placeholder="מחיר" />
                    <Button variant="ghost" size="icon" className="col-span-1 h-9 w-9 text-red-400" onClick={() => setForm({ ...form, items: form.items.filter((_, i) => i !== idx) })} disabled={form.items.length <= 1}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setForm({ ...form, items: [...form.items, { description: '', quantity: 1, price: 0 }] })}>
                  <Plus className="w-4 h-4" /> הוסף פריט
                </Button>
              </div>
            </div>

            <div className="flex justify-between items-center bg-[#FFD700]/10 border border-[#C5A028]/30 p-3 rounded-xl">
              <span className="font-bold text-slate-800 text-sm">סה"כ משוער</span>
              <span className="text-xl font-extrabold text-[#C5A028]">₪{total.toLocaleString()}</span>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">תנאים והערות</label>
              <textarea value={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" rows="3" />
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <Button variant="outline" onClick={() => { setShowEditor(false); setForm(emptyTemplate); setEditingId(null); }}>ביטול</Button>
              <Button onClick={handleSave} disabled={saveMutation.isPending} className="gap-1.5">
                <Save className="w-4 h-4" /> שמור תבנית
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}