import React from 'react';
import { Button } from '@/components/ui/button';
import { MessageCircle, Phone } from 'lucide-react';
import SourceBadge from '@/components/leads/SourceBadge';
import AttachmentUploader from './AttachmentUploader';

export default function LeadCard({ lead, attachments = [], onWhatsApp, onAttachmentsChanged }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-black text-slate-900 truncate">{lead.name || 'ליד ללא שם'}</h3>
          <p className="text-xs text-slate-500 line-clamp-2">{lead.notes || lead.shooting_type || '—'}</p>
        </div>
        <SourceBadge source={lead.source || 'JONI'} />
      </div>
      <div className="flex items-center gap-2 text-sm text-slate-700" dir="ltr">
        <Phone className="w-4 h-4 text-slate-400" />
        <span>{lead.phone}</span>
      </div>
      <Button onClick={() => onWhatsApp(lead)} className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white gap-2">
        <MessageCircle className="w-4 h-4" />
        Send WhatsApp
      </Button>
      <AttachmentUploader
        relatedType="lead"
        relatedId={lead.id}
        clientName={lead.name}
        attachments={attachments}
        onUploaded={onAttachmentsChanged}
      />
    </div>
  );
}