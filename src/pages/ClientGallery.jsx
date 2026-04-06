import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Lock, CheckCircle2, Loader2, Camera, Download, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function ClientGallery() {
    const { id } = useParams();
    const [pin, setPin] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [project, setProject] = useState(null);
    const [photos, setPhotos] = useState([]);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [isSaving, setIsSaving] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [fullscreenImage, setFullscreenImage] = useState(null);

    // Parse PIN from URL if present
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const urlPin = urlParams.get('pin');
        if (urlPin) {
            setPin(urlPin);
            handleLogin(urlPin);
        }
    }, [id]);

    const handleLogin = async (currentPin = pin) => {
        if (!currentPin) return;
        setIsLoading(true);
        try {
            const res = await fetch('/api/functions/getPublicGallery', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId: id, pin: currentPin })
            });
            const data = await res.json();
            
            if (res.ok) {
                setProject(data.project);
                setPhotos(data.photos || []);
                const selected = new Set(data.photos.filter(p => p.is_selected).map(p => p.id));
                setSelectedIds(selected);
                setIsAuthenticated(true);
            } else {
                toast.error(data.error || 'שגיאה בהתחברות');
            }
        } catch (e) {
            toast.error('שגיאת רשת');
        } finally {
            setIsLoading(false);
        }
    };

    const toggleSelection = (photoId) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(photoId)) {
            newSet.delete(photoId);
        } else {
            newSet.add(photoId);
        }
        setSelectedIds(newSet);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const res = await fetch('/api/functions/submitFavorites', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    projectId: id, 
                    pin, 
                    selectedPhotoIds: Array.from(selectedIds) 
                })
            });
            const data = await res.json();
            if (res.ok) {
                toast.success('הבחירה נשמרה בהצלחה!', {
                    icon: <CheckCircle2 className="w-5 h-5 text-green-500" />
                });
            } else {
                toast.error(data.error || 'שגיאה בשמירה');
            }
        } catch (e) {
            toast.error('שגיאת רשת');
        } finally {
            setIsSaving(false);
        }
    };

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-4 font-sans" dir="rtl">
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full max-w-md bg-[#0a0a0a] border border-white/10 rounded-2xl p-8 shadow-[0_10px_40px_rgba(0,0,0,0.8)] text-center"
                >
                    <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-[#FFD700] to-[#C5A028] mx-auto flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(255,215,0,0.2)]">
                        <Lock className="w-8 h-8 text-black" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">גלריה פרטית</h1>
                    <p className="text-white/50 mb-8">הזן את הקוד שקיבלת כדי לצפות בתמונות ולבחור את המועדפות עליך.</p>
                    
                    <div className="space-y-4">
                        <Input
                            type="password"
                            placeholder="קוד גישה (PIN)"
                            value={pin}
                            onChange={(e) => setPin(e.target.value)}
                            className="bg-white/5 border-white/10 text-center text-2xl tracking-widest h-14 text-white focus-visible:ring-[#FFD700]"
                            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                        />
                        <Button 
                            onClick={() => handleLogin(pin)} 
                            disabled={isLoading || !pin}
                            className="w-full h-14 text-lg font-bold bg-[#FFD700] hover:bg-[#e6c200] text-black shadow-[0_4px_14px_rgba(255,215,0,0.25)]"
                        >
                            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'כניסה לגלריה'}
                        </Button>
                    </div>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white font-sans pb-32" dir="rtl">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-2xl border-b border-white/10">
                <div className="max-w-7xl mx-auto px-4 md:px-8 h-20 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-[#FFD700] tracking-wide">{project?.client_name}</h1>
                        <p className="text-sm text-white/50">{project?.shooting_type} • {project?.shooting_date && new Date(project.shooting_date).toLocaleDateString('he-IL')}</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="hidden md:flex items-center gap-2 text-white/70 bg-white/5 px-4 py-2 rounded-full border border-white/10">
                            <Heart className="w-4 h-4 text-[#FFD700] fill-[#FFD700]" />
                            <span className="font-bold">{selectedIds.size} / {photos.length} נבחרו</span>
                        </div>
                        <Button 
                            onClick={handleSave} 
                            disabled={isSaving}
                            className="hidden md:flex items-center gap-2 bg-[#FFD700] text-black hover:brightness-110 shadow-[0_0_15px_rgba(255,215,0,0.3)]"
                        >
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            שמור בחירות
                        </Button>
                    </div>
                </div>
            </header>

            {/* Mobile Selection Counter (Floating above bottom bar) */}
            <div className="md:hidden fixed bottom-24 left-1/2 -translate-x-1/2 bg-[#0a0a0a]/90 backdrop-blur-xl border border-white/10 px-6 py-2.5 rounded-full shadow-2xl flex items-center gap-3 z-30">
                <Heart className="w-5 h-5 text-[#FFD700] fill-[#FFD700]" />
                <span className="font-bold text-[#FFD700]">{selectedIds.size}</span>
                <span className="text-white/50 text-sm">נבחרו מתוך {photos.length}</span>
            </div>

            {/* Gallery Grid */}
            <main className="max-w-7xl mx-auto px-4 md:px-8 py-8">
                {photos.length === 0 ? (
                    <div className="text-center py-32 opacity-50 flex flex-col items-center">
                        <Camera className="w-16 h-16 mb-4" />
                        <h2 className="text-xl">טרם הועלו תמונות לגלריה זו</h2>
                    </div>
                ) : (
                    <div className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
                        {photos.map((photo) => {
                            const isSelected = selectedIds.has(photo.id);
                            return (
                                <motion.div 
                                    key={photo.id}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="relative group cursor-pointer break-inside-avoid rounded-xl overflow-hidden"
                                    onClick={() => setFullscreenImage(photo)}
                                >
                                    <img 
                                        src={photo.thumbnail} 
                                        alt="Gallery Image" 
                                        className={`w-full h-auto object-cover transition-transform duration-500 group-hover:scale-105 ${isSelected ? 'ring-4 ring-[#FFD700]' : ''}`}
                                        loading="lazy"
                                    />
                                    {/* Overlay Gradient */}
                                    <div className={`absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${isSelected ? 'opacity-100 from-black/60' : ''}`} />
                                    
                                    {/* Select Button */}
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); toggleSelection(photo.id); }}
                                        className={`absolute bottom-3 right-3 p-2.5 rounded-full backdrop-blur-md transition-all duration-300 active:scale-90 ${isSelected ? 'bg-[#FFD700] shadow-[0_0_15px_rgba(255,215,0,0.5)]' : 'bg-black/50 hover:bg-black/70 border border-white/20'}`}
                                    >
                                        <Heart className={`w-5 h-5 transition-colors ${isSelected ? 'text-black fill-black' : 'text-white'}`} />
                                    </button>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </main>

            {/* Fullscreen Image Viewer */}
            <AnimatePresence>
                {fullscreenImage && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex items-center justify-center p-4"
                        onClick={() => setFullscreenImage(null)}
                    >
                        <button className="absolute top-6 left-6 text-white/50 hover:text-white z-50">✕ סגור</button>
                        <img 
                            src={fullscreenImage.url} 
                            alt="Fullscreen" 
                            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        />
                        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-4" onClick={(e) => e.stopPropagation()}>
                            <button 
                                onClick={() => toggleSelection(fullscreenImage.id)}
                                className={`flex items-center gap-2 px-6 py-3 rounded-full transition-all active:scale-95 ${selectedIds.has(fullscreenImage.id) ? 'bg-[#FFD700] text-black shadow-[0_0_20px_rgba(255,215,0,0.4)]' : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'}`}
                            >
                                <Heart className={`w-5 h-5 ${selectedIds.has(fullscreenImage.id) ? 'fill-black' : ''}`} />
                                <span className="font-bold">{selectedIds.has(fullscreenImage.id) ? 'נבחר' : 'בחר תמונה'}</span>
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Mobile Fixed Bottom Save Bar */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-black/90 to-transparent z-40">
                <Button 
                    onClick={handleSave} 
                    disabled={isSaving}
                    className="w-full h-14 text-lg font-bold bg-[#FFD700] text-black hover:bg-[#e6c200] shadow-[0_0_20px_rgba(255,215,0,0.3)] rounded-2xl active:scale-95"
                >
                    {isSaving ? <Loader2 className="w-6 h-6 animate-spin" /> : 'שמור בחירות לצלם'}
                </Button>
            </div>
        </div>
    );
}