import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Camera, CheckCircle2, Mail, User, Phone, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link } from 'react-router-dom';

const CONSENT_TEXT =
  'אני מאשר/ת קבלת דיוור שיווקי, טיפים, וחומר פרסומי באימייל מאת KLIKLY/הצלם, ומבין/ה שאוכל להסיר את עצמי בכל עת באמצעות קישור ההסרה בהודעות.';

export default function CourseLanding() {
  const [form, setForm] = useState({ full_name: '', email: '', phone: '' });
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!consent) {
      setError('יש לאשר את הסכמת הדיוור כדי להמשיך');
      return;
    }
    if (!form.email || !form.full_name) {
      setError('יש למלא שם ואימייל');
      return;
    }

    setSubmitting(true);
    try {
      const res = await base44.functions.invoke('subscribeNewsletter', {
        ...form,
        consent_given: true,
        consent_text: CONSENT_TEXT,
        source: 'course_landing',
        interests: ['קורס צילום']
      });
      if (res.data?.success) {
        setDone(true);
      } else {
        setError(res.data?.error || 'אירעה שגיאה');
      }
    } catch (err) {
      setError(err.message || 'אירעה שגיאה');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-slate-900 to-black flex items-center justify-center p-6" dir="rtl">
        <div className="max-w-lg w-full bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-10 text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-[#FFD700] to-[#b38f2d] flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-black" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">תודה שנרשמת!</h1>
          <p className="text-white/70 leading-relaxed">
            המייל שלך נוסף בהצלחה לרשימת התפוצה.<br />
            בקרוב תקבל/י עדכונים על הקורס + טיפים מקצועיים.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-slate-900 to-black" dir="rtl">
      <div className="max-w-5xl mx-auto px-6 py-12 md:py-20">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#FFD700]/10 border border-[#FFD700]/30 text-[#FFD700] text-sm font-bold mb-6">
            <Sparkles className="w-4 h-4" />
            קורס צילום מקצועי
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 leading-tight">
            הצטרף/י לרשימת ההמתנה
            <br />
            <span className="bg-gradient-to-r from-[#FFD700] to-[#b38f2d] bg-clip-text text-transparent">
              לקורס הצילום
            </span>
          </h1>
          <p className="text-lg text-white/60 max-w-2xl mx-auto">
            השאר/י פרטים וקבל/י ראשון/ה גישה לקורס, טיפים מקצועיים, והנחה למצטרפים הראשונים.
          </p>
        </div>

        {/* Form */}
        <div className="max-w-xl mx-auto bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-10 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="text-white/80 text-sm font-medium mb-2 flex items-center gap-2">
                <User className="w-4 h-4" /> שם מלא
              </label>
              <Input
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                placeholder="השם שלך"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40 h-12"
                required
              />
            </div>

            <div>
              <label className="text-white/80 text-sm font-medium mb-2 flex items-center gap-2">
                <Mail className="w-4 h-4" /> אימייל
              </label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="your@email.com"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40 h-12"
                dir="ltr"
                required
              />
            </div>

            <div>
              <label className="text-white/80 text-sm font-medium mb-2 flex items-center gap-2">
                <Phone className="w-4 h-4" /> טלפון (אופציונלי)
              </label>
              <Input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="050-0000000"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40 h-12"
                dir="ltr"
              />
            </div>

            {/* Consent checkbox — REQUIRED for anti-spam law compliance */}
            <label className="flex items-start gap-3 p-4 rounded-2xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-colors">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-1 w-5 h-5 accent-[#FFD700] cursor-pointer flex-shrink-0"
              />
              <span className="text-sm text-white/80 leading-relaxed">
                {CONSENT_TEXT}
              </span>
            </label>

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={submitting}
              className="w-full h-14 text-base"
            >
              <Camera className="w-5 h-5 ml-2" />
              {submitting ? 'שולח...' : 'אני בפנים — שלח לי פרטים'}
            </Button>

            <p className="text-xs text-white/40 text-center leading-relaxed pt-2">
              הפרטים שלך מאובטחים. תוכל/י להסיר את עצמך מרשימת התפוצה בכל עת בקליק אחד.
              <br />
              <Link to="/PrivacyPolicy" className="underline hover:text-white/60">מדיניות פרטיות</Link>
              {' · '}
              <Link to="/TermsOfService" className="underline hover:text-white/60">תנאי שימוש</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}