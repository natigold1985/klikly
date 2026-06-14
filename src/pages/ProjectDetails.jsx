import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  ArrowRight, Phone, Mail, Calendar, MapPin, 
  DollarSign, CheckCircle2, ListTodo, Download, Eye, Upload,
  Link as LinkIcon, Copy, Lock, RefreshCw, FolderPlus, ExternalLink, Loader2,
  Pencil, Plus, Save, X, MessageCircle, Send, Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function ProjectDetails() {
  const urlParams = new URLSearchParams(window.location.search);
  const projectId = urlParams.get('id');
  const navigate = useNavigate();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });
  const isClient = user?.role === 'client';
  const queryClient = useQueryClient();

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => base44.entities.Project.get(projectId),
    enabled: !!projectId,
  });

  const { data: driveStatsData } = useQuery({
    queryKey: ['projectDriveStats', projectId, project?.drive_folder_url],
    queryFn: async () => {
      const res = await base44.functions.invoke('listDriveFiles', { project_id: projectId });
      return res.data;
    },
    enabled: !!projectId && !!project?.drive_folder_url && !isClient,
    refetchInterval: 10000,
  });

  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [detailsForm, setDetailsForm] = useState(null);

  const updateProjectMutation = useMutation({
    mutationFn: (data) => base44.entities.Project.update(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['driveProjects'] });
      toast.success('עודכן בהצלחה');
    },
    onError: () => toast.error('שגיאה בעדכון הפרויקט')
  });

  const getProjectEmails = (p) => {
    const emails = Array.isArray(p?.client_emails) ? p.client_emails : [];
    return [...new Set([p?.client_email, ...emails].filter(Boolean).map((email) => email.trim()))];
  };

  const startEditDetails = () => {
    setDetailsForm({
      client_name: project.client_name || '',
      client_phone: project.client_phone || '',
      client_phone_2: project.client_phone_2 || '',
      client_emails: getProjectEmails(project).length ? getProjectEmails(project) : [''],
      shooting_date: project.shooting_date || '',
      shooting_location: project.shooting_location || '',
      total_price: project.total_price || '',
    });
    setIsEditingDetails(true);
  };

  const updateEmailAt = (index, value) => {
    setDetailsForm((prev) => ({
      ...prev,
      client_emails: prev.client_emails.map((email, i) => (i === index ? value : email)),
    }));
  };

  const saveDetails = () => {
    const emails = [...new Set((detailsForm.client_emails || []).map((email) => email.trim()).filter(Boolean))];
    updateProjectMutation.mutate({
      client_name: detailsForm.client_name,
      client_phone: detailsForm.client_phone,
      client_phone_2: detailsForm.client_phone_2 || null,
      client_email: emails[0] || '',
      client_emails: emails,
      shooting_date: detailsForm.shooting_date,
      shooting_location: detailsForm.shooting_location,
      total_price: Number(detailsForm.total_price) || null,
    });
    setIsEditingDetails(false);
  };

  const handleGeneratePin = () => {
    const newPin = Math.floor(1000 + Math.random() * 9000).toString();
    updateProjectMutation.mutate({ gallery_pin: newPin });
  };

  const getDriveFolderId = (url = '') => {
    const match = String(url).match(/drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([a-zA-Z0-9_-]+)/);
    return match?.[1] || '';
  };

  const handleCopyGalleryLink = () => {
    const folderId = getDriveFolderId(project.drive_folder_url);
    if (!folderId) {
      toast.error('אין תיקיית Drive תקינה לפרויקט');
      return;
    }
    const url = `${window.location.origin}/gallery/${folderId}`;
    const message = `היי ${project.client_name || ''}, הגלריה שלך מוכנה לצפייה והורדה:\n${url}\n\nאין צורך בקוד גישה או התחברות.`;
    navigator.clipboard.writeText(message);
    toast.success('קישור גלריה ללא PIN הועתק');
  };

  const [creatingFolder, setCreatingFolder] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  const handleCreateDriveFolder = async () => {
    setCreatingFolder(true);
    const res = await base44.functions.invoke('createDriveFolder', { project_id: projectId });
    if (res.data?.success) {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      toast.success('תיקיית Drive נוצרה בהצלחה!');
    } else {
      toast.error(res.data?.error || 'שגיאה ביצירת התיקייה');
    }
    setCreatingFolder(false);
  };

  if (isLoading) return <div className="p-8 text-center text-white/50">טוען...</div>;
  if (!project) return <div className="p-8 text-center text-white/50">פרויקט לא נמצא</div>;

  const driveFiles = driveStatsData?.files || [];
  const rawExtensions = ['.nef', '.cr2', '.cr3', '.arw', '.dng', '.raf', '.rw2', '.orf', '.raw'];
  const isRawFile = (file) => {
    const name = String(file.name || '').toLowerCase();
    return rawExtensions.some((ext) => name.endsWith(ext)) || (file.size || 0) >= 15 * 1024 * 1024;
  };
  const rawCount = driveFiles.filter(isRawFile).length;
  const editedCount = driveFiles.filter((file) => !isRawFile(file)).length;
  const liveRawCount = driveFiles.length ? rawCount : (project.raw_photos_count || 0);
  const liveEditedCount = driveFiles.length ? editedCount : (project.final_photos_count || 0);
  const liveSelectedCount = project.selected_photos_count || 0;
  const projectEmails = getProjectEmails(project);

  const getStatusBadge = (status) => {
    const statusMap = {
      pending_payment: { label: 'ממתין לתשלום', color: 'bg-yellow-100 text-yellow-700' },
      paid: { label: 'שולם', color: 'bg-green-100 text-green-700' },
      shooting_scheduled: { label: 'צילום מתוכנן', color: 'bg-blue-100 text-blue-700' },
      shooting_done: { label: 'צילום בוצע', color: 'bg-indigo-100 text-indigo-700' },
      awaiting_selection: { label: 'ממתין לבחירת לקוח', color: 'bg-purple-100 text-purple-700' },
      editing: { label: 'בעריכה', color: 'bg-orange-100 text-orange-700' },
      ready_for_download: { label: 'מוכן להורדה', color: 'bg-cyan-100 text-cyan-700' },
      completed: { label: 'הושלם', color: 'bg-gray-100 text-gray-700' },
    };
    const badge = statusMap[status] || { label: status, color: 'bg-slate-100 text-slate-700' };
    return <span className={`px-3 py-1.5 rounded-full text-sm font-semibold ${badge.color}`}>{badge.label}</span>;
  };

  const getDriveFolderIdFromUrl = (url = '') => {
    const match = String(url).match(/drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([a-zA-Z0-9_-]+)/);
    return match?.[1] || '';
  };

  const handleSendGalleryWhatsApp = () => {
    const folderId = getDriveFolderIdFromUrl(project.drive_folder_url);
    if (!folderId) { toast.error('אין תיקיית Drive — צור תיקייה קודם'); return; }
    const url = `${window.location.origin}/gallery/${folderId}`;
    const msg = encodeURIComponent(`היי ${project.client_name || ''} 😊\nהגלריה שלך מוכנה!\nלצפייה והורדה:\n${url}`);
    const phone = (project.client_phone || '').replace(/\D/g, '');
    window.open(phone ? `https://wa.me/${phone}?text=${msg}` : `https://wa.me/?text=${msg}`, '_blank');
  };

  const handleSendGalleryEmail = async () => {
    const emails = getProjectEmails(project);
    if (!emails.length) { toast.error('לא הוגדר מייל ללקוח'); return; }
    const folderId = getDriveFolderIdFromUrl(project.drive_folder_url);
    const galleryUrl = folderId ? `${window.location.origin}/gallery/${folderId}` : window.location.origin;
    setSendingEmail(true);
    try {
      await base44.integrations.Core.SendEmail({
        to: emails[0],
        from_name: 'KLIKLY',
        subject: `📸 הגלריה שלך מוכנה - ${project.client_name || ''}`,
        body: `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;direction:rtl;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr><td style="background:#0a0a0a;padding:24px 40px;text-align:center;">
          <span style="color:#FFD700;font-size:26px;font-weight:900;letter-spacing:3px;">KLIKLY</span>
        </td></tr>
        <tr><td style="padding:36px 40px 28px;">
          <h2 style="color:#0a0a0a;font-size:22px;margin:0 0 12px;">היי ${project.client_name || ''} 🎉</h2>
          <p style="color:#444;font-size:16px;line-height:1.7;margin:0 0 24px;">
            הגלריה שלך מוכנה לצפייה והורדה! ניתן לגשת אליה בלחיצה על הכפתור:
          </p>
          <div style="text-align:center;margin:24px 0;">
            <a href="${galleryUrl}" style="display:inline-block;background:#FFD700;color:#000;font-size:16px;font-weight:700;padding:16px 48px;border-radius:12px;text-decoration:none;">
              📁 לצפייה בגלריה
            </a>
          </div>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 16px;">
          <p style="color:#999;font-size:12px;margin:0;text-align:center;">KLIKLY · מערכת ניהול גלריות מקצועית</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
      });
      toast.success(`מייל נשלח ל-${emails[0]}`);
    } catch (e) {
      toast.error('שגיאה בשליחת המייל');
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <div className="space-y-6 pb-20" dir="rtl">

      {/* Quick Actions Bar */}
      {!isClient && (
        <div className="bg-gradient-to-l from-[#FFD700]/10 to-transparent border border-[#FFD700]/20 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-[#FFD700]" />
            <span className="text-sm font-bold text-slate-700">גישה מהירה</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Link to={createPageUrl(`FileStorage?project_id=${project.id}`)} className="flex items-center justify-center gap-2 bg-black text-white rounded-xl px-3 py-3 text-sm font-semibold hover:bg-slate-800 transition-colors">
              <Upload className="w-4 h-4 text-[#FFD700]" />
              העלאת קבצים
            </Link>
            <button onClick={handleCopyGalleryLink} className="flex items-center justify-center gap-2 bg-[#FFD700] text-black rounded-xl px-3 py-3 text-sm font-semibold hover:bg-[#e6c200] transition-colors">
              <LinkIcon className="w-4 h-4" />
              שלח גלריה
            </button>
            <button onClick={handleSendGalleryWhatsApp} className="flex items-center justify-center gap-2 bg-green-500 text-white rounded-xl px-3 py-3 text-sm font-semibold hover:bg-green-600 transition-colors">
              <MessageCircle className="w-4 h-4" />
              וואטסאפ
            </button>
            <button onClick={handleSendGalleryEmail} disabled={sendingEmail} className="flex items-center justify-center gap-2 bg-blue-500 text-white rounded-xl px-3 py-3 text-sm font-semibold hover:bg-blue-600 transition-colors disabled:opacity-60">
              {sendingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              שלח מייל
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-4 mb-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full shrink-0">
          <ArrowRight className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900 leading-tight">{project.client_name} - {project.shooting_type}</h1>
        </div>
        {getStatusBadge(project.status)}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100 flex flex-row items-center justify-between">
              <CardTitle>פרטי הפרויקט</CardTitle>
              {isEditingDetails ? (
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={saveDetails} className="gap-1">
                    <Save className="w-4 h-4" /> שמור
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setIsEditingDetails(false)} className="gap-1 text-slate-900 border-slate-300">
                    <X className="w-4 h-4" /> ביטול
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={startEditDetails} className="gap-1 text-slate-900 border-slate-300">
                  <Pencil className="w-4 h-4" /> עריכה
                </Button>
              )}
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-4">
                <div>
                  <label className="text-sm text-slate-500 block mb-1">שם הלקוח</label>
                  {isEditingDetails ? (
                    <Input value={detailsForm?.client_name || ''} onChange={(e) => setDetailsForm({ ...detailsForm, client_name: e.target.value })} />
                  ) : (
                    <div className="font-medium">{project.client_name}</div>
                  )}
                </div>
                <div>
                  <label className="text-sm text-slate-500 block mb-1">טלפון ראשי</label>
                  {isEditingDetails ? (
                    <Input value={detailsForm?.client_phone || ''} onChange={(e) => setDetailsForm({ ...detailsForm, client_phone: e.target.value })} placeholder="05X-XXXXXXX" dir="ltr" />
                  ) : (
                    <div className="font-medium flex items-center gap-2">
                      <Phone className="w-4 h-4 text-slate-400" />
                      {project.client_phone || 'לא הוזן'}
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-sm text-slate-500 block mb-1">וואטסאפ נוסף</label>
                  {isEditingDetails ? (
                    <Input value={detailsForm?.client_phone_2 || ''} onChange={(e) => setDetailsForm({ ...detailsForm, client_phone_2: e.target.value })} placeholder="05X-XXXXXXX" dir="ltr" />
                  ) : (
                    <div className="font-medium flex items-center gap-2">
                      <MessageCircle className="w-4 h-4 text-slate-400" />
                      {project.client_phone_2 || 'לא הוזן'}
                    </div>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <label className="text-sm text-slate-500 block">אימיילים מורשים</label>
                    {!isEditingDetails && (
                      <Button size="sm" variant="outline" onClick={startEditDetails} className="h-8 px-3 gap-1 text-slate-900 border-slate-300 bg-white hover:bg-slate-50">
                        <Pencil className="w-3.5 h-3.5" /> עריכת מיילים
                      </Button>
                    )}
                  </div>
                  {isEditingDetails ? (
                    <div className="space-y-2">
                      {(detailsForm?.client_emails || ['']).map((email, index) => (
                        <div key={index} className="flex gap-2">
                          <Input value={email} onChange={(e) => updateEmailAt(index, e.target.value)} placeholder="client@email.com" dir="ltr" />
                          {index === (detailsForm?.client_emails || []).length - 1 && (
                            <Button type="button" size="icon" variant="outline" onClick={() => setDetailsForm({ ...detailsForm, client_emails: [...(detailsForm?.client_emails || []), ''] })} className="text-slate-900 border-slate-300 bg-white hover:bg-slate-50" title="הוסף מייל נוסף">
                              <Plus className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {(projectEmails.length ? projectEmails : ['לא הוזן']).map((email) => (
                        <div key={email} className="font-medium flex items-center gap-2">
                          <Mail className="w-4 h-4 text-slate-400" />
                          {email}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-sm text-slate-500 block mb-1">תאריך צילום</label>
                  <div className="font-medium flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    {isEditingDetails ? (
                      <Input type="date" value={detailsForm?.shooting_date || ''} onChange={(e) => setDetailsForm({ ...detailsForm, shooting_date: e.target.value })} />
                    ) : (
                      project.shooting_date ? new Date(project.shooting_date).toLocaleDateString('he-IL') : 'לא נקבע'
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-sm text-slate-500 block mb-1">מיקום</label>
                  <div className="font-medium flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    {isEditingDetails ? (
                      <Input value={detailsForm?.shooting_location || ''} onChange={(e) => setDetailsForm({ ...detailsForm, shooting_location: e.target.value })} />
                    ) : (
                      project.shooting_location || 'לא צוין'
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-sm text-slate-500 block mb-1">מחיר</label>
                  <div className="font-medium flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-slate-400" />
                    {isEditingDetails ? (
                      <Input type="number" value={detailsForm?.total_price || ''} onChange={(e) => setDetailsForm({ ...detailsForm, total_price: e.target.value })} />
                    ) : (
                      project.total_price ? `₪${project.total_price.toLocaleString()}` : 'לא צוין'
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100">
              <CardTitle>סטטוס קבצים</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="flex gap-4 md:gap-8 justify-around">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2">
                    <Upload className="w-5 h-5 text-slate-500" />
                  </div>
                  <div className="text-2xl font-bold text-slate-800">{liveRawCount}</div>
                  <div className="text-xs text-slate-500">גולמיות</div>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-2">
                    <Eye className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="text-2xl font-bold text-slate-800">{liveSelectedCount}</div>
                  <div className="text-xs text-slate-500">נבחרו ע"י לקוח</div>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="text-2xl font-bold text-slate-800">{liveEditedCount}</div>
                  <div className="text-xs text-slate-500">ערוכות ומוכנות</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Link to={createPageUrl(`ProjectTasks?projectId=${project.id}`)} className="block">
            <Card className="bg-indigo-50 border-indigo-100 hover:bg-indigo-100 transition-colors shadow-sm cursor-pointer">
              <CardContent className="p-5 flex items-center gap-4 text-indigo-700">
                <div className="p-2 bg-indigo-200 rounded-lg">
                  <ListTodo className="w-6 h-6 text-indigo-800" />
                </div>
                <div className="font-semibold text-lg">ניהול משימות</div>
              </CardContent>
            </Card>
          </Link>
          
          <Link to={createPageUrl(`FileStorage?project_id=${project.id}`)} className="block">
            <Card className="bg-[#0a0a0a] border-white/10 hover:border-[#FFD700]/30 hover:bg-white/5 transition-all shadow-xl cursor-pointer">
              <CardContent className="p-5 flex items-center gap-4 text-white">
                <div className="p-2 bg-white/5 border border-white/10 rounded-lg text-[#FFD700]">
                  <Upload className="w-6 h-6" />
                </div>
                <div className="font-semibold text-lg">ניהול קבצים</div>
              </CardContent>
            </Card>
          </Link>

          {liveSelectedCount > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-amber-800">
                  הלקוח בחר {liveSelectedCount} תמונות לעריכה
                </p>
                <Link to={createPageUrl(`FileStorage?project_id=${project.id}`)} className="text-xs text-amber-600 underline">
                  עבור לניהול קבצים ←
                </Link>
              </div>
            </div>
          )}

          {/* Google Drive Folder */}
          <Card className="bg-white border-slate-200 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <FolderPlus className="w-5 h-5 text-blue-600" />
                </div>
                <div className="font-semibold text-slate-800">Google Drive</div>
              </div>
              {project.drive_folder_url ? (
                <a href={project.drive_folder_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium">
                  <ExternalLink className="w-4 h-4" />
                  פתח תיקיית Drive
                </a>
              ) : (
                <Button size="sm" variant="outline" className="w-full gap-2" onClick={handleCreateDriveFolder} disabled={creatingFolder}>
                  {creatingFolder ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderPlus className="w-4 h-4" />}
                  צור תיקייה ב-Drive
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Client Gallery Access Card */}
          <Card className="bg-[#0a0a0a] border-white/10 shadow-xl overflow-hidden rounded-2xl">
            <CardHeader className="bg-gradient-to-r from-[#FFD700]/10 to-transparent border-b border-white/10 pb-4">
              <CardTitle className="text-lg font-bold flex items-center gap-2 text-[#FFD700]">
                <Eye className="w-5 h-5" />
                גלריית לקוח פרטית
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-5">
              <div>
                <label className="text-sm text-white/50 mb-1.5 block">גישה ללקוח</label>
                <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm leading-6">
                  כניסה ישירה ללא PIN וללא התחברות. הקישור מבוסס על תיקיית Google Drive של הפרויקט.
                </div>
              </div>
              <Button 
                onClick={handleCopyGalleryLink}
                className="w-full bg-[#FFD700] hover:bg-[#e6c200] text-black font-bold shadow-[0_4px_14px_rgba(255,215,0,0.25)] flex items-center justify-center gap-2"
              >
                <LinkIcon className="w-4 h-4" />
                העתק קישור ללקוח
              </Button>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}