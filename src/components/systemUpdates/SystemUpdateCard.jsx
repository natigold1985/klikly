import React from 'react';
import { CalendarDays, ListChecks, Pencil, Trash2, Youtube } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getYouTubeEmbedUrl } from './youtube';

export default function SystemUpdateCard({ update, isAdmin, onEdit, onDelete }) {
  const embedUrl = getYouTubeEmbedUrl(update.youtube_url || '');

  return (
    <Card className="overflow-hidden border-slate-200 bg-white shadow-sm hover:shadow-lg transition-shadow">
      {embedUrl && (
        <div className="aspect-video bg-black">
          <iframe
            src={embedUrl}
            title={update.title}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge className="bg-black text-[#FFD700] hover:bg-black">עדכון מערכת</Badge>
              {update.status === 'draft' && <Badge variant="outline" className="text-slate-600">טיוטה</Badge>}
            </div>
            <CardTitle className="text-2xl text-slate-950">{update.title}</CardTitle>
            {update.process_name && <p className="text-sm text-slate-500 mt-2">{update.process_name}</p>}
          </div>
          {isAdmin && (
            <div className="flex gap-2 shrink-0">
              <Button size="icon" variant="secondary" onClick={() => onEdit(update)} className="bg-slate-100 text-slate-900 hover:bg-slate-200">
                <Pencil className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="destructive" onClick={() => onDelete(update)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
        {update.published_date && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <CalendarDays className="w-4 h-4" />
            {new Date(update.published_date).toLocaleDateString('he-IL')}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-5">
        {update.description && <p className="text-slate-700 leading-7 whitespace-pre-wrap">{update.description}</p>}
        {update.steps?.length > 0 && (
          <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
            <div className="flex items-center gap-2 font-bold text-slate-900 mb-3">
              <ListChecks className="w-5 h-5 text-[#D4AF37]" />
              תהליך עבודה
            </div>
            <ol className="space-y-2 text-sm text-slate-700 list-decimal list-inside">
              {update.steps.map((step, index) => <li key={index}>{step}</li>)}
            </ol>
          </div>
        )}
        {update.youtube_url && !embedUrl && (
          <a href={update.youtube_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-bold text-red-600 hover:underline">
            <Youtube className="w-4 h-4" />
            צפייה בסרטון
          </a>
        )}
      </CardContent>
    </Card>
  );
}