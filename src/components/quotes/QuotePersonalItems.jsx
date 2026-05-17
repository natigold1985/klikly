import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Pencil, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const emptyItem = { description: '', default_quantity: 1, default_price: 0, category: '', is_active: true };

export default function QuotePersonalItems({ onAddItem }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(emptyItem);
  const [editingId, setEditingId] = useState(null);

  const { data: items = [] } = useQuery({
    queryKey: ['quoteItems'],
    queryFn: () => base44.entities.QuoteItem.filter({ is_active: true }, '-created_date', 100),
  });

  const saveMutation = useMutation({
    mutationFn: (data) => editingId
      ? base44.entities.QuoteItem.update(editingId, data)
      : base44.entities.QuoteItem.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quoteItems'] });
      setDraft(emptyItem);
      setEditingId(null);
      toast.success('הפריט נשמר ברשימת המוצרים שלך');
    },
    onError: (error) => toast.error('לא הצלחתי לשמור את הפריט: ' + error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.QuoteItem.update(id, { is_active: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quoteItems'] });
      toast.success('הפריט הוסר מהרשימה');
    },
  });

  const startEdit = (item) => {
    setEditingId(item.id);
    setDraft({
      description: item.description || '',
      default_quantity: item.default_quantity || 1,
      default_price: item.default_price || 0,
      category: item.category || '',
      is_active: true,
    });
  };

  const addToQuote = (item) => {
    onAddItem({
      description: item.description,
      quantity: item.default_quantity || 1,
      price: item.default_price || 0,
    });
  };

  const handleSave = () => {
    if (!draft.description.trim()) return;
    saveMutation.mutate({
      ...draft,
      default_quantity: Number(draft.default_quantity) || 1,
      default_price: Number(draft.default_price) || 0,
    });
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-4">
      <div>
        <h3 className="text-sm font-black text-slate-900">רשימת הפריטים שלי</h3>
        <p className="text-xs text-slate-500 mt-1">כל משתמש יכול לשמור פריטים קבועים, לערוך אותם ולהוסיף אותם להצעות מחיר.</p>
      </div>

      {items.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-2 rounded-xl bg-white border border-slate-200 p-2">
              <button type="button" onClick={() => addToQuote(item)} className="flex-1 text-right min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate">{item.description}</p>
                <p className="text-xs text-slate-500">₪{Number(item.default_price || 0).toLocaleString()} · כמות {item.default_quantity || 1}</p>
              </button>
              <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-slate-600" onClick={() => startEdit(item)}>
                <Pencil className="w-4 h-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-red-400 hover:text-red-600" onClick={() => deleteMutation.mutate(item.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-12 gap-2 items-end">
        <div className="col-span-12 sm:col-span-5">
          <label className="text-xs font-bold text-slate-500">תיאור</label>
          <Input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="צילום אירוע..." />
        </div>
        <div className="col-span-6 sm:col-span-2">
          <label className="text-xs font-bold text-slate-500">כמות</label>
          <Input type="number" min="1" value={draft.default_quantity} onChange={(e) => setDraft({ ...draft, default_quantity: e.target.value })} />
        </div>
        <div className="col-span-6 sm:col-span-3">
          <label className="text-xs font-bold text-slate-500">מחיר</label>
          <Input type="number" min="0" value={draft.default_price} onChange={(e) => setDraft({ ...draft, default_price: e.target.value })} />
        </div>
        <Button type="button" className="col-span-12 sm:col-span-2 gap-1" onClick={handleSave} disabled={!draft.description.trim()}>
          {editingId ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {editingId ? 'עדכן' : 'שמור'}
        </Button>
      </div>
    </div>
  );
}