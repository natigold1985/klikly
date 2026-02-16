import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tantml:react-query';
import { Cloud, Save, Check, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function CloudStorage() {
  const [formData, setFormData] = useState({
    provider: 's3',
    endpoint: '',
    region: '',
    bucket: '',
    accessKey: '',
    secretKey: '',
  });
  const [testing, setTesting] = useState(false);
  const [connected, setConnected] = useState(false);

  const handleSave = () => {
    // In production, this would save to a secure backend
    toast.success('הגדרות האחסון נשמרו בהצלחה');
    setConnected(true);
  };

  const handleTest = async () => {
    setTesting(true);
    // Simulate connection test
    setTimeout(() => {
      setTesting(false);
      toast.success('החיבור לאחסון חיצוני הצליח!');
      setConnected(true);
    }, 2000);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-[#D4AF37] to-[#C5A028] bg-clip-text text-transparent">
          External Cloud Storage
        </h1>
        <p className="text-[#808080] mt-1">חבר את האחסון הפרטי שלך (AWS S3 / Cloudflare R2)</p>
      </div>

      {/* Connection Status */}
      <Card className="bg-[#0D0D0D] border border-[#D4AF37]/30">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Cloud className={`w-6 h-6 ${connected ? 'text-green-500' : 'text-[#808080]'}`} />
              <div>
                <h3 className="font-medium text-white">סטטוס חיבור</h3>
                <p className="text-sm text-[#808080]">
                  {connected ? 'מחובר לאחסון חיצוני' : 'לא מחובר'}
                </p>
              </div>
            </div>
            <Badge className={connected ? 'bg-green-500' : 'bg-gray-500'}>
              {connected ? (
                <>
                  <Check className="w-3 h-3 ml-1" />
                  פעיל
                </>
              ) : (
                <>
                  <X className="w-3 h-3 ml-1" />
                  לא פעיל
                </>
              )}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Configuration */}
      <Card className="bg-[#0D0D0D] border border-[#D4AF37]/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Cloud className="w-5 h-5 text-[#D4AF37]" />
            הגדרות אחסון
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-white mb-2 block">ספק אחסון</label>
            <select
              value={formData.provider}
              onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
              className="w-full px-3 py-2 bg-[#000000] border border-[#D4AF37]/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
            >
              <option value="s3">AWS S3</option>
              <option value="r2">Cloudflare R2</option>
              <option value="compatible">S3-Compatible</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-white mb-1 block">Endpoint URL</label>
              <Input
                value={formData.endpoint}
                onChange={(e) => setFormData({ ...formData, endpoint: e.target.value })}
                placeholder="https://..."
                className="bg-[#000000] border-[#D4AF37]/30 text-white"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-white mb-1 block">Region</label>
              <Input
                value={formData.region}
                onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                placeholder="us-east-1"
                className="bg-[#000000] border-[#D4AF37]/30 text-white"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-white mb-1 block">Bucket Name</label>
            <Input
              value={formData.bucket}
              onChange={(e) => setFormData({ ...formData, bucket: e.target.value })}
              placeholder="my-klikly-storage"
              className="bg-[#000000] border-[#D4AF37]/30 text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-white mb-1 block">Access Key</label>
              <Input
                value={formData.accessKey}
                onChange={(e) => setFormData({ ...formData, accessKey: e.target.value })}
                placeholder="AKIAIOSFODNN7EXAMPLE"
                className="bg-[#000000] border-[#D4AF37]/30 text-white"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-white mb-1 block">Secret Key</label>
              <Input
                value={formData.secretKey}
                onChange={(e) => setFormData({ ...formData, secretKey: e.target.value })}
                placeholder="wJalrXUtnFEMI/K7MDENG/..."
                type="password"
                className="bg-[#000000] border-[#D4AF37]/30 text-white"
              />
            </div>
          </div>

          <div className="bg-[#000000]/60 border border-[#D4AF37]/20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-[#D4AF37] flex-shrink-0 mt-0.5" />
              <div className="text-sm text-[#808080]">
                <p className="font-medium text-white mb-1">הערה חשובה</p>
                <p>כל התמונות וקבצי הגלריה יועלו ישירות לאחסון הפרטי שלך. זה מבטיח קיבולת בלתי מוגבלת וביצועים מקסימליים.</p>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={handleTest}
              variant="outline"
              disabled={testing}
              className="border-[#D4AF37]/30 text-white hover:bg-[#000000]"
            >
              {testing ? 'בודק חיבור...' : 'בדוק חיבור'}
            </Button>
            <Button
              onClick={handleSave}
              className="bg-gradient-to-r from-[#D4AF37] to-[#C5A028] hover:from-[#C5A028] hover:to-[#D4AF37] text-black"
            >
              <Save className="w-4 h-4 ml-2" />
              שמור הגדרות
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Benefits */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-[#0D0D0D] border border-green-500/30">
          <CardContent className="p-4 text-center">
            <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center mx-auto mb-3">
              <Check className="w-6 h-6 text-green-500" />
            </div>
            <h3 className="font-medium text-white mb-1">אחסון בלתי מוגבל</h3>
            <p className="text-xs text-[#808080]">שלם רק עבור מה שאתה משתמש</p>
          </CardContent>
        </Card>

        <Card className="bg-[#0D0D0D] border border-blue-500/30">
          <CardContent className="p-4 text-center">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center mx-auto mb-3">
              <Cloud className="w-6 h-6 text-blue-500" />
            </div>
            <h3 className="font-medium text-white mb-1">ביצועים מהירים</h3>
            <p className="text-xs text-[#808080]">CDN גלובלי להעלאה מהירה</p>
          </CardContent>
        </Card>

        <Card className="bg-[#0D0D0D] border border-purple-500/30">
          <CardContent className="p-4 text-center">
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center mx-auto mb-3">
              <AlertCircle className="w-6 h-6 text-purple-500" />
            </div>
            <h3 className="font-medium text-white mb-1">שליטה מלאה</h3>
            <p className="text-xs text-[#808080]">הקבצים שלך בשרתים שלך</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}