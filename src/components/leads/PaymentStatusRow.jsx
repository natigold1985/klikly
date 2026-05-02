import React from 'react';
import { CheckCircle2, Clock, AlertCircle } from 'lucide-react';

/**
 * Compact payment status indicator for closed_won leads.
 * Shows: paid amount, balance owed, or pending payment based on the linked project.
 */
export default function PaymentStatusRow({ project }) {
  if (!project) return null;

  const total = Number(project.total_price) || 0;
  const paid = Number(project.paid_amount) || 0;
  const balance = Math.max(total - paid, 0);
  const status = project.payment_status || 'pending';

  let config;
  if (status === 'paid' || (total > 0 && paid >= total)) {
    config = {
      icon: CheckCircle2,
      label: 'שולם במלואו',
      amount: total > 0 ? `₪${total.toLocaleString()}` : null,
      cls: 'bg-green-50 text-green-700 border-green-200',
      iconCls: 'text-green-600',
    };
  } else if (status === 'partial' || (paid > 0 && paid < total)) {
    config = {
      icon: AlertCircle,
      label: `שולם ₪${paid.toLocaleString()} • יתרה`,
      amount: `₪${balance.toLocaleString()}`,
      cls: 'bg-amber-50 text-amber-800 border-amber-200',
      iconCls: 'text-amber-600',
    };
  } else {
    config = {
      icon: Clock,
      label: 'ממתין לתשלום',
      amount: total > 0 ? `₪${total.toLocaleString()}` : null,
      cls: 'bg-slate-50 text-slate-700 border-slate-200',
      iconCls: 'text-slate-500',
    };
  }

  const Icon = config.icon;

  return (
    <div className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-xs ${config.cls}`}>
      <div className="flex items-center gap-1.5 min-w-0">
        <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${config.iconCls}`} />
        <span className="font-medium truncate">{config.label}</span>
      </div>
      {config.amount && (
        <span className="font-extrabold whitespace-nowrap">{config.amount}</span>
      )}
    </div>
  );
}