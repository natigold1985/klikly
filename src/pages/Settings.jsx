import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, Save, Camera, Building2, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

export default function Settings() {
  const [uploading, setUploading] = useState(false);
  const logoInputRef = useRef(null);
  const profileInputRef = useRef(null);
  const queryClient = useQueryClient();
  const [calConnected, setCalConnected] = useState(false);
  const [checkingCal, setCheckingCal] = useState(true);
  const [syncingCal, setSyncingCal] = useState(false);

  const checkCalConnection = async () => {
    try {
      await base44.functions.invoke("checkCalendarConnection", {});
      setCalConnected(true);
    } catch {
      setCalConnected(false);
    }
  };

  useEffect(() => {
    base44.auth.isAuthenticated().then(async (authed) => {
      if (authed) {
        await checkCalConnection();
      }
      setCheckingCal(false);
    });
  }, []);

  const handleConnectCal = async () => {
    try {
      const url = await base44.connectors.connectAppUser("69d3c4ec1ea49d48ce3fec2e");
      const popup = window.open(url, "_blank");
      const timer = setInterval(() => {
        if (!popup || popup.closed) {
          clearInterval(timer);
          checkCalConnection();
        }
      }, 500);
    } catch (err) {
      toast.error("שגיאה בחיבור ליומן");
    }
  };

  const handleDisconnectCal = async () => {
    try {
      await base44.connectors.disconnectAppUser("69d3c4ec1ea49d48ce3fec2e");
      setCalConnected(false);
      toast.success("נותק מיומן גוגל");
    } catch (err) {
      toast.error("שגיאה בניתוק היומן");
    }
  };

  const handleSyncCal = async () => {
    setSyncingCal(true);
    toast.loading("מסנכרן יומן...", { id: "cal-sync" });
    try {
      const res = await base44.functions.invoke("syncGoogleCalendar", {});
      toast.success(`הסנכרון הושלם בהצלחה (${res.data.syncedToCalendar} אירועים נוספו)`, { id: "cal-sync" });
    } catch (err) {
      toast.error("שגיאה בסנכרון יומן גוגל", { id: "cal-sync" });
    } finally {
      setSyncingCal(false);
    }
  };

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const allSettings = await base44.entities.PhotographerSettings.list();
      return allSettings[0] || null;
    },
  });

  const [formData, setFormData] = useState(settings || {
    business_name: '',
    logo_url: '',
    profile_image_url: '',
    phone: '',
    email: '',
    website: '',
    instagram: '',
    address: '',
    quote_footer_text: '',
    default_terms: '',
  });

  React.useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  const saveSettingsMutation = useMutation({
    mutationFn: async (data) => {
      if (settings?.id) {
        return await base44.entities.PhotographerSettings.update(settings.id, data);
      } else {
        return await base44.entities.PhotographerSettings.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('ההגדרות נשמרו בהצלחה');
    },
    onError: (error) => {
      toast.error('שגיאה בשמירת ההגדרות');
      console.error(error);
    },
  });

  const handleSave = () => {
    saveSettingsMutation.mutate(formData);
  };

  const handleFileUpload = async (file, type) => {
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      if (type === 'logo') {
        setFormData({ ...formData, logo_url: file_url });
      } else if (type === 'profile') {
        setFormData({ ...formData, profile_image_url: file_url });
      }
      
      toast.success('הקובץ הועלה בהצלחה');
    } catch (error) {
      toast.error('שגיאה בהעלאת הקובץ');
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
          הגדרות
        </h1>
        <p className="text-slate-600 mt-1">נהל את פרטי העסק והמיתוג שלך</p>
      </div>

      {/* Branding Section */}
      <Card className="bg-white/60 backdrop-blur-sm border-white/20 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-indigo-500" />
            מיתוג ולוגו
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Logo Upload */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">לוגו העסק</label>
            <div className="flex items-center gap-4">
              {formData.logo_url && (
                <div className="w-24 h-24 rounded-lg border-2 border-slate-200 overflow-hidden bg-white flex items-center justify-center">
                  <img src={formData.logo_url} alt="Logo" className="max-w-full max-h-full object-contain" />
                </div>
              )}
              <div>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileUpload(e.target.files[0], 'logo')}
                  className="hidden"
                />
                <Button
                  onClick={() => logoInputRef.current?.click()}
                  variant="outline"
                  disabled={uploading}
                >
                  <Upload className="w-4 h-4 ml-2" />
                  {uploading ? 'מעלה...' : 'העלה לוגו'}
                </Button>
                <p className="text-xs text-slate-500 mt-1">הלוגו יופיע בכל הצעות המחיר</p>
              </div>
            </div>
          </div>

          {/* Profile Picture Upload */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">תמונת פרופיל</label>
            <div className="flex items-center gap-4">
              {formData.profile_image_url && (
                <div className="w-24 h-24 rounded-full border-2 border-slate-200 overflow-hidden bg-white">
                  <img src={formData.profile_image_url} alt="Profile" className="w-full h-full object-cover" />
                </div>
              )}
              <div>
                <input
                  ref={profileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileUpload(e.target.files[0], 'profile')}
                  className="hidden"
                />
                <Button
                  onClick={() => profileInputRef.current?.click()}
                  variant="outline"
                  disabled={uploading}
                >
                  <Upload className="w-4 h-4 ml-2" />
                  {uploading ? 'מעלה...' : 'העלה תמונה'}
                </Button>
                <p className="text-xs text-slate-500 mt-1">תמונה מקצועית שלך</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Google Calendar Integrations */}
      <Card className="bg-white/60 backdrop-blur-sm border-white/20 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-500" />
            חיבור יומן גוגל (Google Calendar)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">
            חבר את יומן גוגל שלך כדי לסנכרן אירועים, ימי צילום ופגישות באופן אוטומטי למערכת Klikly.
          </p>
          
          {checkingCal ? (
            <div className="text-sm text-slate-500">בודק חיבור ליומן...</div>
          ) : calConnected ? (
            <div className="flex flex-col sm:flex-row gap-3">
              <Button 
                variant="destructive" 
                onClick={handleDisconnectCal}
                className="bg-red-500/10 text-red-600 hover:bg-red-500/20 border-none shadow-none"
              >
                נתק יומן גוגל
              </Button>
              <Button 
                onClick={handleSyncCal}
                disabled={syncingCal}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {syncingCal ? 'מסנכרן...' : 'סנכרן נתונים עכשיו'}
              </Button>
            </div>
          ) : (
            <Button 
              onClick={handleConnectCal}
              className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm"
            >
              <img src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Google_Calendar_icon_%282020%29.svg" alt="Google Calendar" className="w-4 h-4 ml-2" />
              התחבר עם Google
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Business Information */}
      <Card className="bg-white/60 backdrop-blur-sm border-white/20 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-purple-500" />
            פרטי עסק
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">שם העסק *</label>
            <Input
              value={formData.business_name || ''}
              onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
              placeholder="סטודיו לצילום XYZ"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">טלפון</label>
              <Input
                value={formData.phone || ''}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="050-1234567"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">אימייל</label>
              <Input
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="info@studio.com"
                type="email"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">אתר</label>
              <Input
                value={formData.website || ''}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                placeholder="www.mystudio.com"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">אינסטגרם</label>
              <Input
                value={formData.instagram || ''}
                onChange={(e) => setFormData({ ...formData, instagram: e.target.value })}
                placeholder="@mystudio"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">כתובת</label>
            <Input
              value={formData.address || ''}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="רחוב 123, עיר"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">טקסט תחתון בהצעות מחיר</label>
            <textarea
              value={formData.quote_footer_text || ''}
              onChange={(e) => setFormData({ ...formData, quote_footer_text: e.target.value })}
              placeholder="תודה שבחרתם בנו! נשמח לצלם את האירוע המיוחד שלכם"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              rows="2"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">תנאים דיפולטיים</label>
            <textarea
              value={formData.default_terms || ''}
              onChange={(e) => setFormData({ ...formData, default_terms: e.target.value })}
              placeholder="תנאי התשלום וההתקשרות הסטנדרטיים..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              rows="4"
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-lg px-8"
          disabled={!formData.business_name}
        >
          <Save className="w-5 h-5 ml-2" />
          שמור הגדרות
        </Button>
      </div>
    </div>
  );
}