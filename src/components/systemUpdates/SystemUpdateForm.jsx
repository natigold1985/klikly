import React, { useEffect, useState } from 'react';
import { Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const emptyForm = {
  title: '',
  process_name: '',
  description: '',
  steps_text: '',
  youtube_url: '',
  published_date: new Date().toISOString().slice(0, 10),
  status: 'published',
};

export default function SystemUpdateForm({ update, onSubmit, onCancel, isSaving }) {
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (!update) {
      setForm(emptyForm);
      return;
    }
    setForm({
      title: update.title || '',
      process_name: update.process_name || '',
      description: update.description || '',
      steps_text: (update.steps || []).join('\n'),
      youtube_url: update.youtube_url || '',
      published_date: update.published_date || new Date().toISOString().slice(0, 10),
      status: update.status || 'published',
    });
  }, [update]);

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit({
      title: form.title,
      process_name: form.process_name,
      description: form.description,
      steps: form.steps_text.split('\n').map((step) => step.trim()).filter(Boolean),
      youtube_url: form.youtube_url,
      published_date: form.published_date,
      status: form.status,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 shadow-lg space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <Input placeholder="כותרת העדכון" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        <Input placeholder="שם התהליך" value={form.process_name} onChange={(e) => setForm({ ...form, process_name: e.target.value })} />
      </div>
      <Textarea placeholder="תיאור העדכון" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="min-h-28" />
      <Textarea placeholder="שלבי התהליך — כל שלב בשורה חדשה" value={form.steps_text} onChange={(e) => setForm({ ...form, steps_text: e.target.value })} className="min-h-28" />
      <Input placeholder="קישור YouTube" value={form.youtube_url} onChange={(e) => setForm({ ...form, youtube_url: e.target.value })} />
      <div className="grid md:grid-cols-2 gap-4">
        <Input type="date" value={form.published_date} onChange={(e) => setForm({ ...form, published_date: e.target.value })} />
        <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}>
          <SelectTrigger><SelectValue placeholder="סטטוס" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="published">פורסם</SelectItem>
            <SelectItem value="draft">טיוטה</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col sm:flex-row justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onCancel} className="bg-slate-100 text-slate-900 hover:bg-slate-200">
          <X className="w-4 h-4" /> ביטול
        </Button>
        <Button type="submit" disabled={isSaving}>
          <Save className="w-4 h-4" /> {update ? 'שמור עדכון' : 'פרסם עדכון'}
        </Button>
      </div>
    </form>
  );
}