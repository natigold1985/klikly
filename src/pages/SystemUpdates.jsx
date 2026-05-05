import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import SystemUpdateCard from '@/components/systemUpdates/SystemUpdateCard';
import SystemUpdateForm from '@/components/systemUpdates/SystemUpdateForm';

export default function SystemUpdates() {
  const [showForm, setShowForm] = useState(false);
  const [editingUpdate, setEditingUpdate] = useState(null);
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const isAdmin = user?.role === 'admin' || user?.email === 'natigold04@gmail.com';

  const { data: updates = [], isLoading } = useQuery({
    queryKey: ['systemUpdates'],
    queryFn: () => base44.entities.SystemUpdate.list('-published_date'),
  });

  const visibleUpdates = useMemo(() => {
    return isAdmin ? updates : updates.filter((update) => update.status === 'published');
  }, [updates, isAdmin]);

  const saveMutation = useMutation({
    mutationFn: (payload) => editingUpdate
      ? base44.entities.SystemUpdate.update(editingUpdate.id, payload)
      : base44.entities.SystemUpdate.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['systemUpdates'] });
      setShowForm(false);
      setEditingUpdate(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.SystemUpdate.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['systemUpdates'] }),
  });

  const handleEdit = (update) => {
    setEditingUpdate(update);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="space-y-8" dir="rtl">
      <section className="relative overflow-hidden rounded-[2rem] bg-black text-white p-6 md:p-10 shadow-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,215,0,0.25),transparent_35%)]" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div>
            <p className="text-[#FFD700] text-sm font-bold tracking-[0.25em] mb-3">KLIKLY UPDATES</p>
            <h1 className="text-3xl md:text-5xl font-black mb-4">עדכוני מערכת</h1>
            <p className="text-white/70 max-w-2xl leading-7">
              כל החידושים, התהליכים וסרטוני ההסברה במקום אחד — כדי להבין מהר מה השתנה ואיך להשתמש בזה נכון.
            </p>
          </div>
          {isAdmin && (
            <Button onClick={() => { setEditingUpdate(null); setShowForm(true); }} className="shrink-0">
              <Plus className="w-5 h-5" /> עדכון חדש
            </Button>
          )}
        </div>
      </section>

      {isAdmin && showForm && (
        <SystemUpdateForm
          update={editingUpdate}
          onSubmit={(payload) => saveMutation.mutate(payload)}
          onCancel={() => { setShowForm(false); setEditingUpdate(null); }}
          isSaving={saveMutation.isPending}
        />
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-slate-500">
          <RefreshCw className="w-6 h-6 animate-spin ml-2" /> טוען עדכונים...
        </div>
      ) : visibleUpdates.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center text-slate-500">
          עדיין אין עדכוני מערכת להצגה.
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          {visibleUpdates.map((update) => (
            <SystemUpdateCard
              key={update.id}
              update={update}
              isAdmin={isAdmin}
              onEdit={handleEdit}
              onDelete={(item) => deleteMutation.mutate(item.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}