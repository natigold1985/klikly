import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Link2, AlertCircle, CheckCircle2, Loader2, Pencil } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

// Always-visible inline editor for the project's bound Google Drive folder.
// Strict isolation: only accepts /folders/<id> URLs — never the Drive root.
// The extracted folder ID is what listDriveFiles uses as its EXCLUSIVE source.
export default function DriveFolderUrlEditor({ project, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [url, setUrl] = useState(project?.drive_folder_url || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const extractFolderId = (val) => {
    const m = (val || '').trim().match(/drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([a-zA-Z0-9_-]+)/);
    return m?.[1] || null;
  };

  const currentFolderId = extractFolderId(project?.drive_folder_url);

  const validate = (val) => {
    const trimmed = (val || '').trim();
    if (!trimmed) return 'נא להדביק קישור תיקייה';
    const id = extractFolderId(trimmed);
    if (!id) return 'הקישור חייב להיות תיקייה ספציפית של Drive (/folders/...)';
    if (id.length < 10) return 'מזהה תיקייה לא תקין';
    if (['root', 'my-drive'].includes(id.toLowerCase())) return 'אסור לקשר את ה-Drive הראשי — בחר תיקייה ייעודית לפרויקט הזה';
    return null;
  };

  const save = async () => {
    const err = validate(url);
    if (err) {
      setError(err);
      return;
    }
    setError('');
    setSaving(true);
    try {
      await base44.entities.Project.update(project.id, { drive_folder_url: url.trim() });
      toast.success('תיקיית ה-Drive נקשרה לפרויקט');
      setEditing(false);
      onSaved?.();
    } catch (e) {
      toast.error('שגיאה בשמירה');
    } finally {
      setSaving(false);
    }
  };

  // Compact "bound" view with a Pencil to expand the editor
  if (!editing && currentFolderId) {
    return (
      <Card className="border-emerald-200 bg-emerald-50/30">
        <CardContent className="p-3 md:p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-emerald-700 mb-0.5">
              ✓ תיקיית Drive ייעודית מקושרת
            </div>
            <div className="text-[11px] text-slate-500 truncate font-mono" dir="ltr">
              folders/{currentFolderId.slice(0, 18)}…
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setUrl(project.drive_folder_url || '');
              setEditing(true);
            }}
            className="gap-1.5 shrink-0 text-slate-900 border-slate-300 bg-white hover:bg-slate-50"
          >
            <Pencil className="w-3.5 h-3.5" />
            שינוי
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Editor mode (always shown when no folder bound, or when user clicks "שינוי")
  return (
    <Card className="border-2 border-blue-200 bg-blue-50/40">
      <CardContent className="p-4 md:p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Link2 className="w-5 h-5 text-blue-600" />
          <div className="font-bold text-slate-900">קישור תיקיית Google Drive לפרויקט</div>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          הדבק כאן קישור לתיקייה ספציפית מתוך Drive שלך. נחלץ את מזהה התיקייה (Folder ID) ונקשר אותו <u>בלבד</u> לפרויקט הזה — הלקוח יראה רק קבצים מתיקייה זו.
        </p>
        <div>
          <Input
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (error) setError('');
            }}
            placeholder="https://drive.google.com/drive/folders/1aBc..."
            dir="ltr"
            className="text-xs bg-white"
          />
          {error && (
            <div className="flex items-start gap-2 mt-2 text-xs text-red-600">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {!error && url && extractFolderId(url) && (
            <div className="flex items-center gap-2 mt-2 text-xs text-emerald-700">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>
                Folder ID זוהה: <span className="font-mono font-bold" dir="ltr">{extractFolderId(url)}</span>
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={save} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
            שמור וקשר תיקייה
          </Button>
          {currentFolderId && (
            <Button
              variant="outline"
              onClick={() => {
                setUrl(project.drive_folder_url || '');
                setEditing(false);
                setError('');
              }}
              disabled={saving}
              className="text-slate-900 border-slate-300 bg-white hover:bg-slate-50"
            >
              ביטול
            </Button>
          )}
        </div>
        <details className="text-xs text-slate-500">
          <summary className="cursor-pointer font-medium hover:text-slate-700">איך משיגים את הקישור?</summary>
          <div className="mt-2 bg-white rounded-lg p-3 space-y-1 border">
            <p>1. פתח את <span className="font-mono">drive.google.com</span></p>
            <p>2. כנס לתיקייה הספציפית של הפרויקט</p>
            <p>3. העתק את כתובת ה-URL משורת הדפדפן והדבק כאן</p>
            <p className="text-amber-700 mt-1">⚠ אסור להדביק את הקישור הראשי של Drive — רק תיקייה ייעודית.</p>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}