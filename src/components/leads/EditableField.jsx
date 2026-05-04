import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Pencil, Check, X } from 'lucide-react';

export default function EditableField({
  value,
  onSave,
  type = 'text',
  placeholder = 'לחץ לעריכה',
  multiline = false,
  formatDisplay,
  icon = null,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const inputRef = useRef(null);

  useEffect(() => {
    setDraft(value ?? '');
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if (typeof inputRef.current.select === 'function') {
        inputRef.current.select();
      }
    }
  }, [isEditing]);

  const handleSave = async () => {
    const newValue = draft === '' ? null : draft;
    if (newValue !== value) {
      await onSave(newValue);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setDraft(value ?? '');
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !multiline) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        {multiline ? (
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 min-h-[80px] p-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-[#FFD700] focus:outline-none"
            dir="rtl"
          />
        ) : (
          <Input
            ref={inputRef}
            type={type}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 h-9"
            dir={type === 'email' || type === 'tel' ? 'ltr' : 'rtl'}
          />
        )}
        <button
          onClick={handleSave}
          className="w-8 h-8 flex items-center justify-center rounded-md bg-green-500 hover:bg-green-600 text-white shrink-0"
          title="שמור"
        >
          <Check className="w-4 h-4" />
        </button>
        <button
          onClick={handleCancel}
          className="w-8 h-8 flex items-center justify-center rounded-md bg-slate-200 hover:bg-slate-300 text-slate-700 shrink-0"
          title="בטל"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  const displayValue = formatDisplay
    ? formatDisplay(value)
    : value || <span className="text-slate-400 italic">{placeholder}</span>;

  return (
    <div
      onClick={() => setIsEditing(true)}
      className="group flex items-center gap-2 cursor-pointer hover:bg-slate-50 rounded-md px-2 py-1.5 -mx-2 transition-colors"
      title="לחץ לעריכה"
    >
      {icon}
      <div className="font-medium flex-1 min-w-0 break-words">{displayValue}</div>
      <Pencil className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}