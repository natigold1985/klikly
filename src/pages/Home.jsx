import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { Camera, Upload, Users, Zap, CheckCircle2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function Home() {
  const features = [
    {
      icon: Upload,
      title: 'אחסון חכם',
      description: 'העלאת גלריות מהירה בנפח גבוה',
      color: 'from-blue-500 to-cyan-500'
    },
    {
      icon: Users,
      title: 'חווית לקוח',
      description: 'לינק מעוצב שהלקוחות שלך יאהבו לפתוח',
      color: 'from-purple-500 to-pink-500'
    },
    {
      icon: Zap,
      title: 'אוטומציה',
      description: 'סגירת עסקאות ושליחת מסמכים בלי מאמץ',
      color: 'from-orange-500 to-red-500'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50" dir="rtl">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))]" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-gradient-to-br from-indigo-400/30 to-purple-400/30 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-gradient-to-br from-pink-400/20 to-orange-400/20 rounded-full blur-3xl" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24">
          {/* Navigation */}
          <nav className="flex items-center justify-between mb-16">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                <Camera className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Klikly
                </h1>
                <p className="text-xs text-slate-500">ניהול לצלמים בקליק</p>
              </div>
            </div>
            <Link to={createPageUrl('Dashboard')}>
              <Button className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-lg">
                כניסה למערכת
                <ArrowLeft className="w-4 h-4 mr-2" />
              </Button>
            </Link>
          </nav>

          {/* Hero Content */}
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 backdrop-blur-sm border border-indigo-200 mb-8">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm text-slate-700">מערכת ניהול מתקדמת לצלמים מקצוענים</span>
            </div>

            <h1 className="text-5xl md:text-7xl font-bold mb-6">
              <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                Klikly
              </span>
              <br />
              <span className="text-slate-800">ניהול לצלמים בקליק</span>
            </h1>

            <p className="text-xl text-slate-600 mb-12 max-w-2xl mx-auto leading-relaxed">
              המערכת החכמה שחוסכת לך זמן בניהול פרויקטים, העלאת גלריות ללקוחות והפקת חשבוניות.
              <br />
              <strong className="text-slate-800">הכל במקום אחד.</strong>
            </p>

            <div className="flex items-center justify-center gap-4 mb-16">
              <Link to={createPageUrl('Dashboard')}>
                <Button size="lg" className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-xl text-lg px-8 py-6">
                  התחל עכשיו בחינם
                  <ArrowLeft className="w-5 h-5 mr-2" />
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="border-2 border-slate-300 hover:border-indigo-500 hover:bg-indigo-50 text-lg px-8 py-6">
                למד עוד
              </Button>
            </div>

            {/* Trust Badge */}
            <div className="flex items-center justify-center gap-6 text-sm text-slate-500">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span>ללא כרטיס אשראי</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span>התחל תוך 5 דקות</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span>ביטול בכל עת</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-800 mb-4">
            למה צלמים בוחרים ב-Klikly?
          </h2>
          <p className="text-lg text-slate-600">
            שלושת היתרונות המרכזיים שיחסכו לך שעות עבודה
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Card key={index} className="bg-white/80 backdrop-blur-sm border-white/20 hover:shadow-2xl transition-all duration-300 group">
                <CardContent className="p-8 text-center">
                  <div className={`w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br ${feature.color} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
                    <Icon className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-slate-600 leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* CTA Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <Card className="bg-gradient-to-br from-indigo-500 to-purple-600 border-0 shadow-2xl overflow-hidden">
          <CardContent className="p-12 md:p-16 text-center relative">
            <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,rgba(255,255,255,0.3))]" />
            <div className="relative">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                מוכנים להתחיל?
              </h2>
              <p className="text-xl text-indigo-100 mb-8 max-w-2xl mx-auto">
                הצטרף לאלפי צלמים שכבר משתמשים ב-Klikly לניהול העסק שלהם
              </p>
              <Link to={createPageUrl('Dashboard')}>
                <Button size="lg" className="bg-white text-indigo-600 hover:bg-indigo-50 shadow-xl text-lg px-8 py-6">
                  התחל את הניסיון החינמי
                  <ArrowLeft className="w-5 h-5 mr-2" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}