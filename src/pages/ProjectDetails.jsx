import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  ArrowRight, Phone, Mail, Calendar, MapPin, 
  DollarSign, CheckCircle2, ListTodo, Download, Eye, Upload,
  Link as LinkIcon, Copy, Lock, RefreshCw, FolderPlus, ExternalLink, Loader2,
  Pencil, Plus, Save, X, MessageCircle, Send, Zap, Bell, Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const CLIENT_APP_ORIGIN = 'https://klikly.base44.app';

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

  const { data: selectedPhotos = [] } = useQuery({
    queryKey: ['projectSelectedPhotos', projectId],
    queryFn: async () => {
      const photos = await base44.entities.Photo.filter({ project_id: projectId }, '-selected_at', 500);
      return photos.filter((photo) => photo.is_selected);
    },
    enabled: !!projectId && !isClient,
    refetchInterval: 15000,
  });

  const { data: selectionActivities = [] } = useQuery({
    queryKey: ['projectSelectionActivities', projectId],
    queryFn: () => base44.entities.Activity.filter({ related_to_type: 'project', related_to_id: projectId, activity_type: 'selection_made' }, '-created_date', 5),
    enabled: !!projectId && !isClient,
    refetchInterval: 15000,
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

  const getProjectShareLink = (p = project) => {
    if (p?.workflow_type === 'selection') {
      return `${CLIENT_APP_ORIGIN}/ClientGallery/${p.id}${p.gallery_pin ? `?pin=${p.gallery_pin}` : ''}`;
    }
    const folderId = getDriveFolderId(p?.drive_folder_url);
    return folderId ? `${CLIENT_APP_ORIGIN}/gallery/${folderId}` : '';
  };

  const handleCopyGalleryLink = async () => {
    const url = getProjectShareLink();
    if (!url) {
      toast.error('אין קישור גלריה תקין לפרויקט');
      return;
    }
    const message = project.workflow_type === 'selection'
      ? `היי ${project.client_name || ''}, לבחירת תמונות לעריכה:\n${url}\n\nסמן/י את התמונות ולחץ/י על שמירת בחירות.`
      : `היי ${project.client_name || ''}, תיקיית הקבצים שלך מוכנה להורדה:\n${url}\n\nאין צורך בקוד גישה או התחברות.`;
    await navigator.clipboard.writeText(message);
    setQuickActionStatus('גלריה הועתקה לשליחה');
    toast.success('ההודעה עם קישור הגלריה הועתקה');
    base44.entities.SystemLog.create({
      action: 'project_gallery_link_copied',
      details: `Gallery link copied from project details for ${project.id}: ${url}`,
      status: 'success',
      related_entity_type: 'Project',
      related_entity_id: project.id,
    }).catch(() => {});
  };

  const [creatingFolder, setCreatingFolder] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [quickActionStatus, setQuickActionStatus] = useState('');

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

  const handleSendGalleryWhatsApp = () => {
    const url = getProjectShareLink();
    if (!url) { toast.error('אין קישור גלריה תקין לפרויקט'); return; }
    const text = project.workflow_type === 'selection'
      ? `היי ${project.client_name || ''} 😊\nלבחירת תמונות לעריכה:\n${url}\n\nסמן/י את התמונות ולחץ/י על שמירת בחירות.`
      : `היי ${project.client_name || ''} 😊\nתיקיית הקבצים שלך מוכנה להורדה:\n${url}`;
    const msg = encodeURIComponent(text);
    const phone = (project.client_phone || '').replace(/\D/g, '');
    const intlPhone = phone.startsWith('0') ? `972${phone.slice(1)}` : phone;
    window.open(intlPhone ? `https://wa.me/${intlPhone}?text=${msg}` : `https://wa.me/?text=${msg}`, '_blank');
    setQuickActionStatus('WhatsApp נפתח ונרשם');
    base44.entities.SystemLog.create({
      action: 'project_gallery_whatsapp_opened',
      details: `WhatsApp opened for ${project.id}. Phone: ${project.client_phone || ''}. Link: ${url}`,
      status: 'success',
      related_entity_type: 'Project',
      related_entity_id: project.id,
    }).catch(() => {});
  };

  const handleSendGalleryEmail = async () => {
    const emails = getProjectEmails(project);
    if (!emails.length) { toast.error('לא הוגדר מייל ללקוח'); return; }
    const galleryUrl = getProjectShareLink();
    if (!galleryUrl) { toast.error('אין קישור גלריה תקין לפרויקט'); return; }
    const isSelectionGallery = project.workflow_type === 'selection';
    setSendingEmail(true);
    try {
      const res = await base44.functions.invoke('notifyClientNewFiles', {
        project_id: project.id,
        gallery_url: galleryUrl,
        message: isSelectionGallery ? 'הגלריה שלך מוכנה לבחירת תמונות לעריכה.' : 'תיקיית הקבצים שלך מוכנה להורדה.',
        notification_type: 'gallery_sent',
      });
      if (res.data?.success) {
        setQuickActionStatus('מייל נשלח ללקוח ולך ונרשם בלוג מערכת');
        toast.success('מייל נשלח ללקוח ולך ונרשם בלוג');
      } else {
        setQuickActionStatus('המייל נשלח חלקית — נרשם לוג לבדיקה');
        toast.error(res.data?.failed?.[0]?.error || 'שגיאה בשליחת המייל');
      }
    } catch (e) {
      setQuickActionStatus('שגיאה בשליחת המייל — נרשמת בלוג אם הפונקציה הופעלה');
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
          {quickActionStatus && (
            <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
              ✓ {quickActionStatus}
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Link to={createPageUrl(`FileStorage?project_id=${project.id}`)} onClick={() => setQuickActionStatus('פתחת ניהול העלאת קבצים')} className="flex items-center justify-center gap-2 bg-black text-white rounded-xl px-3 py-3 text-sm font-semibold hover:bg-slate-800 transition-colors">
              <Upload className="w-4 h-4 text-[#FFD700]" />
              העלאת קבצים
            </Link>
            <button onClick={handleCopyGalleryLink} className="flex items-center justify-center gap-2 bg-[#FFD700] text-black rounded-xl px-3 py-3 text-sm font-semibold hover:bg-[#e6c200] transition-colors">
              <LinkIcon className="w-4 h-4" />
              שלח הורדה
            </button>
            <button onClick={handleSendGalleryWhatsApp} className="flex items-center justify-center gap-2 bg-green-500 text-white rounded-xl px-3 py-3 text-sm font-semibold hover:bg-green-600 transition-colors">
              <MessageCircle className="w-4 h-4" />
              וואטסאפ
            </button>
            <button onClick={handleSendGalleryEmail} disabled={sendingEmail} className="flex items-center justify-center gap-2 bg-blue-500 text-white rounded-xl px-3 py-3 text-sm font-semibold hover:bg-blue-600 transition-colors disabled:opacity-60">
              {sendingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {sendingEmail ? 'שולח...' : 'שלח מייל'}
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
            <CardContent className="pt-6 space-y-5">
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

              {selectionActivities[0] && (
                <div className="rounded-2xl border border-green-200 bg-green-50 p-4 flex items-start gap-3">
                  <Bell className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-green-900">בחירות לקוח נשלחו אליך</p>
                    <p className="text-sm text-green-700 leading-relaxed">{selectionActivities[0].description}</p>
                    <p className="text-xs text-green-600 mt-1 flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(selectionActivities[0].created_date).toLocaleString('he-IL')}</p>
                  </div>
                </div>
              )}

              {selectedPhotos.length > 0 && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-amber-600" />
                      <p className="font-bold text-amber-900">פירוט התמונות שנבחרו לעריכה</p>
                    </div>
                    <span className="text-xs font-bold text-amber-700 bg-white px-2 py-1 rounded-full">{selectedPhotos.length} תמונות</span>
                  </div>
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {selectedPhotos.map((photo, index) => (
                      <div key={photo.id} className="bg-white border border-amber-100 rounded-xl p-3 flex items-center gap-3">
                        <span className="w-7 h-7 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center text-xs font-bold shrink-0">{index + 1}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-slate-900 truncate" dir="ltr">{photo.file_name || photo.drive_file_id || photo.id}</p>
                          {photo.client_comment && <p className="text-xs text-slate-600 mt-1">הערת לקוח: {photo.client_comment}</p>}
                          {photo.selected_at && <p className="text-[11px] text-slate-400 mt-1">נבחרה: {new Date(photo.selected_at).toLocaleString('he-IL')}</p>}
                        </div>
                        {photo.file_url && <a href={photo.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-amber-700 underline shrink-0">פתיחה</a>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
                <p className="text-xs text-amber-700 mt-0.5">הפירוט המלא מופיע בכרטיס סטטוס הקבצים ונשלח למייל natigold04@gmail.com לאחר לחיצה על שליחה.</p>
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
                הורדת תיקיית לקוח
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-5">
              <div>
                <label className="text-sm text-white/50 mb-1.5 block">גישה ללקוח</label>
                <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm leading-6">
                  קישור ישיר להורדת תיקיית הקבצים. ללא PIN וללא התחברות.
                </div>
              </div>
              <Button 
                onClick={handleCopyGalleryLink}
                className="w-full bg-[#FFD700] hover:bg-[#e6c200] text-black font-bold shadow-[0_4px_14px_rgba(255,215,0,0.25)] flex items-center justify-center gap-2"
              >
                <LinkIcon className="w-4 h-4" />
                העתק קישור הורדה ללקוח
              </Button>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}