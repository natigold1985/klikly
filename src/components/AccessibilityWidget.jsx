import React, { useState, useEffect } from 'react';
import { Accessibility, X, Plus, Minus, RotateCcw, Type, Eye, Link as LinkIcon } from 'lucide-react';

const STORAGE_KEY = 'a11y_settings_v1';

const DEFAULTS = {
  fontScale: 1,
  highContrast: false,
  grayscale: false,
  underlineLinks: false,
  readableFont: false,
};

export default function AccessibilityWidget() {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(DEFAULTS);

  // Load on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setSettings({ ...DEFAULTS, ...JSON.parse(saved) });
    } catch {}
  }, []);

  // Apply settings to <html>
  useEffect(() => {
    const root = document.documentElement;
    root.style.fontSize = `${settings.fontScale * 100}%`;
    root.classList.toggle('a11y-contrast', settings.highContrast);
    root.classList.toggle('a11y-grayscale', settings.grayscale);
    root.classList.toggle('a11y-underline', settings.underlineLinks);
    root.classList.toggle('a11y-readable', settings.readableFont);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch {}
  }, [settings]);

  const update = (patch) => setSettings((s) => ({ ...s, ...patch }));
  const reset = () => setSettings(DEFAULTS);

  return (
    <>
      {/* Floating toggle button */}
      <button
        onClick={() => setOpen(true)}
        aria-label="פתח תפריט נגישות"
        className="fixed bottom-24 md:bottom-6 left-4 z-[60] w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg flex items-center justify-center transition-transform hover:scale-105"
        title="נגישות"
      >
        <Accessibility className="w-6 h-6" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[70]" dir="rtl">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 md:bottom-auto md:top-1/2 md:left-4 md:right-auto md:-translate-y-1/2 md:w-80 bg-white rounded-t-3xl md:rounded-2xl shadow-2xl p-5 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Accessibility className="w-5 h-5 text-blue-600" />
                תפריט נגישות
              </h2>
              <button onClick={() => setOpen(false)} aria-label="סגור" className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Font size */}
            <div className="mb-4">
              <label className="text-sm font-bold text-slate-700 mb-2 block flex items-center gap-2">
                <Type className="w-4 h-4" /> גודל טקסט
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => update({ fontScale: Math.max(0.8, settings.fontScale - 0.1) })}
                  className="w-10 h-10 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center"
                  aria-label="הקטן טקסט"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <div className="flex-1 text-center text-sm font-mono">{Math.round(settings.fontScale * 100)}%</div>
                <button
                  onClick={() => update({ fontScale: Math.min(1.5, settings.fontScale + 0.1) })}
                  className="w-10 h-10 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center"
                  aria-label="הגדל טקסט"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Toggles */}
            <div className="space-y-2">
              <ToggleRow icon={Eye} label="ניגודיות גבוהה" checked={settings.highContrast} onChange={(v) => update({ highContrast: v })} />
              <ToggleRow icon={Eye} label="גווני אפור" checked={settings.grayscale} onChange={(v) => update({ grayscale: v })} />
              <ToggleRow icon={LinkIcon} label="הדגשת קישורים" checked={settings.underlineLinks} onChange={(v) => update({ underlineLinks: v })} />
              <ToggleRow icon={Type} label="פונט קריא" checked={settings.readableFont} onChange={(v) => update({ readableFont: v })} />
            </div>

            <button
              onClick={reset}
              className="mt-5 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold"
            >
              <RotateCcw className="w-4 h-4" />
              איפוס הגדרות
            </button>

            <p className="text-[10px] text-slate-400 mt-4 text-center leading-relaxed">
              להצהרת הנגישות המלאה — ראה דף "הצהרת נגישות" בתחתית האתר
            </p>
          </div>
        </div>
      )}
    </>
  );
}

function ToggleRow({ icon: Icon, label, checked, onChange }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-colors ${
        checked ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200 hover:bg-slate-50'
      }`}
    >
      <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <Icon className="w-4 h-4" />
        {label}
      </span>
      <span className={`w-10 h-5 rounded-full transition-colors relative ${checked ? 'bg-blue-600' : 'bg-slate-300'}`}>
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${checked ? 'right-0.5' : 'right-5'}`} />
      </span>
    </button>
  );
}