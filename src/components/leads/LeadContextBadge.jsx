import React from 'react';
import { Sparkles, Globe, MessageCircle, Mail, BookOpen, Camera, Building2, Briefcase } from 'lucide-react';

/**
 * Shows a rich context line under a lead's name:
 * — source (website department, WhatsApp, Gmail, etc.)
 * — interest / shooting type / course intent
 */
export default function LeadContextBadge({ lead }) {
  const items = [];

  // 1. Source context
  const src = (lead.source || '').toLowerCase();
  const sourcePostUrl = lead.source_post_url || '';

  if (src.includes('whatsapp') || src.includes('וואטסאפ')) {
    items.push({ icon: MessageCircle, label: 'WhatsApp', color: 'text-[#25D366]' });
  } else if (src.includes('gmail') || src.includes('מייל') || src.includes('email')) {
    items.push({ icon: Mail, label: 'Gmail', color: 'text-red-500' });
  } else if (src.includes('אתר') || src.includes('website') || src.includes('natigold') || src.includes('klikly') || sourcePostUrl.includes('natigold')) {
    // Try to extract department from source_post_url or source
    const deptMatch = sourcePostUrl.match(/\/(events?|portrait|brand|social|product|צילומ[יי]|תדמית|אירוע|עסקי)/i)
      || (lead.source || '').match(/(events?|portrait|brand|social|product|צילומ[יי]|תדמית|אירוע|עסקי)/i);
    const dept = deptMatch?.[1] || null;
    items.push({ icon: Globe, label: dept ? `אתר — ${dept}` : 'אתר', color: 'text-indigo-500' });
  } else if (src.includes('facebook') || src.includes('פייסבוק')) {
    items.push({ icon: Globe, label: 'Facebook', color: 'text-blue-600' });
  } else if (src.includes('instagram') || src.includes('אינסטגרם')) {
    items.push({ icon: Globe, label: 'Instagram', color: 'text-pink-500' });
  } else if (src.includes('linkedin')) {
    items.push({ icon: Briefcase, label: 'LinkedIn', color: 'text-blue-700' });
  } else if (src && !['לא ידוע', 'unknown', '-', 'none'].includes(src)) {
    items.push({ icon: Globe, label: lead.source, color: 'text-slate-500' });
  }

  // 2. Interest / shooting type
  const interest = lead.interest_label || lead.lead_type || lead.shooting_type || '';
  if (interest) {
    const lc = interest.toLowerCase();
    let icon = Camera;
    let color = 'text-[#B8860B]';
    if (/קורס|course/.test(lc)) { icon = BookOpen; color = 'text-purple-600'; }
    else if (/אירוע|event|חתונה|בר/.test(lc)) { icon = Camera; color = 'text-emerald-600'; }
    else if (/תדמית|brand|portrait/.test(lc)) { icon = Building2; color = 'text-indigo-600'; }
    items.push({ icon, label: interest, color });
  }

  // 3. Notes — show first meaningful note snippet
  const noteSnippet = lead.notes
    ? lead.notes.replace(/^תווית:\s*/i, '').split(/[•\n]/)[0].trim().slice(0, 40)
    : '';
  if (noteSnippet && items.length < 2) {
    items.push({ icon: Sparkles, label: noteSnippet, color: 'text-slate-500' });
  }

  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-0.5 mt-0.5">
      {items.map((item, i) => {
        const Icon = item.icon;
        return (
          <span key={i} className={`flex items-center gap-1 text-[11px] font-semibold leading-tight ${item.color}`}>
            <Icon className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{item.label}</span>
          </span>
        );
      })}
    </div>
  );
}