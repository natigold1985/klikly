import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Save, UserCheck, FileStack } from 'lucide-react';
import QuotePersonalItems from '@/components/quotes/QuotePersonalItems';

export default function QuoteEditor({ quote, lead, onSave, onCancel }) {
  const { data: settings } = useQuery({
    queryKey: ['photographerSettings'],
    queryFn: async () => {
      const all = await base44.entities.PhotographerSettings.list();
      return all[0] || null;
    },
    staleTime: 1000 * 60 * 5,
  });

  const { data: leads = [] } = useQuery({
    queryKey: ['quoteEditorLeads'],
    queryFn: () => base44.entities.Lead.list('-created_date', 100),
    enabled: !lead, // skip if a lead is already provided
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['quoteTemplates'],
    queryFn: () => base44.entities.QuoteTemplate.list('-created_date', 50),
  });

  const [form, setForm] = useState({
    lead_id: quote?.lead_id || lead?.id || '',
    client_name: quote?.client_name || lead?.name || '',
    client_email: quote?.client_email || lead?.email || '',
    package_name: quote?.package_name || (lead?.shooting_type ? `חבילת ${lead.shooting_type}` : ''),
    package_description: quote?.package_description || '',
    items: quote?.items?.length ? quote.items : [{ description: '', quantity: 1, price: 0 }],
    terms: quote?.terms || settings?.default_terms || '',
    valid_until: quote?.valid_until || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    template: quote?.template || 'minimalist',
    template_id: quote?.template_id || '',
  });

  // Auto-apply default template on first load (only for new quotes)
  useEffect(() => {
    if (!quote && templates.length > 0 && !form.template_id) {
      const defaultTpl = templates.find(t => t.is_default);
      if (defaultTpl) {
        applyTemplate(defaultTpl);
      }
    }
  }, [templates]);

  useEffect(() => {
    if (settings?.default_terms && !form.terms) {
      setForm(prev => ({ ...prev, terms: settings.default_terms }));
    }
  }, [settings]);

  const applyTemplate = (template) => {
    setForm(prev => ({
      ...prev,
      template_id: template.id,
      package_name: template.package_name || prev.package_name,
      package_description: template.package_description || prev.package_description,
      items: template.items?.length ? [...template.items] : prev.items,
      terms: template.terms || prev.terms,
      valid_until: template.valid_days
        ? new Date(Date.now() + template.valid_days * 86400000).toISOString().split('T')[0]
        : prev.valid_until,
    }));
  };

  const total = form.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);

  const addItem = () => setForm({ ...form, items: [...form.items, { description: '', quantity: 1, price: 0 }] });
  const addSavedItem = (item) => setForm({ ...form, items: [...form.items, item] });
  const removeItem = (idx) => setForm({ ...form, items: form.items.filter((_, i) => i !== idx) });
  const updateItem = (idx, field, value) => {
    const items = [...form.items];
    items[idx] = { ...items[idx], [field]: field === 'description' ? value : Number(value) };
    setForm({ ...form, items });
  };

  const handleSave = () => {
    if (!form.client_name || !form.client_email) return;
    onSave({ ...form, total_price: total });
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Branding Preview */}
      {settings && (
        <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
          {settings.logo_url && (
            <img src={settings.logo_url} alt="Logo" className="w-12 h-12 rounded-lg object-contain bg-white border" />
          )}
          <div>
            <p className="font-bold text-slate-800">{settings.business_name}</p>
            <p className="text-xs text-slate-500">{settings.phone} • {settings.email}</p>
          </div>
        </div>
      )}

      {/* Template Picker */}
      {templates.length > 0 && (
        <div>
          <label className="text-sm font-medium text-slate-700 mb-1 flex items-center gap-1.5">
            <FileStack className="w-4 h-4 text-[#C5A028]" />
            טען מתבנית
          </label>
          <Select value={form.template_id} onValueChange={(id) => {
            const tpl = templates.find(t => t.id === id);
            if (tpl) applyTemplate(tpl);
          }}>
            <SelectTrigger className="text-sm">
              <SelectValue placeholder="בחר תבנית..." />
            </SelectTrigger>
            <SelectContent dir="rtl">
              {templates.map(tpl => (
                <SelectItem key={tpl.id} value={tpl.id}>
                  {tpl.name}{tpl.is_default ? ' ⭐' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Lead linking - shown only when no lead was passed in */}
      {!lead && !quote && leads.length > 0 && (
        <div>
          <label className="text-sm font-medium text-slate-700 mb-1 flex items-center gap-1.5">
            <UserCheck className="w-4 h-4 text-[#C5A028]" />
            מלא מליד קיים (אופציונלי)
          </label>
          <Select onValueChange={(leadId) => {
            const l = leads.find(x => x.id === leadId);
            if (l) {
              setForm(prev => ({
                ...prev,
                lead_id: l.id,
                client_name: l.name || prev.client_name,
                client_email: l.email || prev.client_email,
                package_name: l.shooting_type ? `חבילת ${l.shooting_type}` : prev.package_name,
              }));
            }
          }}>
            <SelectTrigger className="text-sm">
              <SelectValue placeholder="בחר ליד..." />
            </SelectTrigger>
            <SelectContent dir="rtl">
              {leads.map(l => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name} — {l.phone} {l.shooting_type ? `(${l.shooting_type})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {lead && (
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
          <UserCheck className="w-4 h-4" />
          הצעה מקושרת לליד: <strong>{lead.name}</strong>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-slate-700 mb-1 block">שם הלקוח *</label>
          <Input value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} placeholder="ישראל ישראלי" />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700 mb-1 block">אימייל *</label>
          <Input value={form.client_email} onChange={(e) => setForm({ ...form, client_email: e.target.value })} placeholder="email@example.com" type="email" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-slate-700 mb-1 block">שם החבילה</label>
          <Input value={form.package_name} onChange={(e) => setForm({ ...form, package_name: e.target.value })} placeholder="חבילת פרימיום" />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700 mb-1 block">תוקף הצעה</label>
          <Input value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} type="date" />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700 mb-1 block">תיאור החבילה</label>
        <textarea value={form.package_description} onChange={(e) => setForm({ ...form, package_description: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" rows="2" placeholder="מה כלול בחבילה..." />
      </div>

      <QuotePersonalItems onAddItem={addSavedItem} />

      <div>
        <label className="text-sm font-bold text-slate-800 mb-3 block">פריטים בהצעה</label>
        <div className="space-y-3">
          <div className="grid grid-cols-12 gap-2 text-xs font-medium text-slate-500 px-1">
            <div className="col-span-6">תיאור</div>
            <div className="col-span-2">כמות</div>
            <div className="col-span-3">מחיר (₪)</div>
            <div className="col-span-1"></div>
          </div>
          {form.items.map((item, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-center">
              <Input className="col-span-6" value={item.description} onChange={(e) => updateItem(idx, 'description', e.target.value)} placeholder="צילום אירוע..." />
              <Input className="col-span-2" type="number" min="1" value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', e.target.value)} />
              <Input className="col-span-3" type="number" min="0" value={item.price} onChange={(e) => updateItem(idx, 'price', e.target.value)} />
              <Button variant="ghost" size="icon" className="col-span-1 h-9 w-9 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => removeItem(idx)} disabled={form.items.length <= 1}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="gap-1.5" onClick={addItem}>
            <Plus className="w-4 h-4" /> הוסף פריט
          </Button>
        </div>
      </div>

      <div className="flex justify-between items-center bg-[#FFD700]/10 border border-[#C5A028]/30 p-4 rounded-xl">
        <span className="font-bold text-slate-800">סה"כ</span>
        <span className="text-2xl font-extrabold text-[#C5A028]">₪{total.toLocaleString()}</span>
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700 mb-1 block">תנאים</label>
        <textarea value={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.value })} placeholder="תנאים והגבלות..." className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#FFD700] focus:outline-none" rows="3" />
      </div>

      <div className="flex gap-3 justify-end">
        <Button variant="outline" onClick={onCancel}>ביטול</Button>
        <Button onClick={handleSave} disabled={!form.client_name || !form.client_email} className="gap-1.5">
          <Save className="w-4 h-4" /> שמור הצעה
        </Button>
      </div>
    </div>
  );
}