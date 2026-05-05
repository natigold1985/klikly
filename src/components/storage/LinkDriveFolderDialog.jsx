import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Link2, AlertCircle, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

// Allows photographer to bind an EXISTING Google Drive folder URL to a project.
// Strict validation: must be a /folders/<id> URL — never the My Drive root.
export default function LinkDriveFolderDialog({ project, onLinked, trigger }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(project?.drive_folder_url || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const validate = (val) => {
    const trimmed = (val || '').trim();
    if (!trimmed) return 'נא להדביק קישור תיקייה';
    // Must be a Drive folder URL, not the root or a file
    const folderMatch = trimmed.match(/drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([a-zA-Z0-9_-]+)/);
    if (!folderMatch) {
      return 'הקישור חייב להיות תיקייה ספציפית (לא My Drive). לחץ על תיקייה ב-Drive ⟵ העתק את הקישור משורת הכתובת';
    }
    if (folderMatch[1].length < 10) return 'מזהה תיקייה לא תקין';
    return null;
  };

  const handleSave = async () => {
    const err = validate(url);
    if (err) {
      setError(err);
      return;
    }
    setError('');
    setSaving(true);
    try {
      await base44.entities.Project.update(project.id, { drive_folder_url: url.trim() });
      toast.success('התיקייה קושרה בהצלחה');
      setOpen(false);
      onLinked?.(url.trim());
    } catch (e) {
      toast.error('שגיאה בשמירה');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {trigger ? (
        <span onClick={() => setOpen(true)}>{trigger}</span>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-2">
          <Link2 className="w-4 h-4" />
          קשר תיקייה קיימת
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="w-5 h-5" />
              קישור תיקיית Drive קיימת לפרויקט
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-900 leading-relaxed">
              <strong>חשוב:</strong> השתמש בקישור של <u>תיקייה ספציפית</u>. אסור לקשר את כל ה-Drive שלך — רק תיקייה אחת ייעודית לפרויקט הזה.
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">
                קישור התיקייה ב-Google Drive
              </label>
              <Input
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  if (error) setError('');
                }}
                placeholder="https://drive.google.com/drive/folders/1aBc..."
                dir="ltr"
                className="text-xs"
              />
              {error && (
                <div className="flex items-start gap-2 mt-2 text-xs text-red-600">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            <div className="text-xs text-slate-500 leading-relaxed bg-slate-50 rounded-lg p-3 space-y-1">
              <p className="font-bold text-slate-700">איך משיגים את הקישור?</p>
              <p>1. פתח את <span className="font-mono">drive.google.com</span></p>
              <p>2. כנס לתיקייה הספציפית של הלקוח</p>
              <p>3. העתק את כתובת ה-URL משורת הדפדפן והדבק כאן</p>
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={handleSave} disabled={saving} className="flex-1 gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                שמור קישור
              </Button>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
                ביטול
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}