import ThumbnailCarousel from '@/components/ui/thumbnail-carousel';

const demoFiles = [
  {
    id: '1',
    name: 'Studio Gold Preview 1',
    thumbnail_url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200&h=800&fit=crop',
    is_image: true,
  },
  {
    id: '2',
    name: 'Studio Gold Preview 2',
    thumbnail_url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&h=800&fit=crop',
    is_image: true,
  },
  {
    id: '3',
    name: 'Studio Gold Preview 3',
    thumbnail_url: 'https://images.unsplash.com/photo-1519904981063-b0cf448d479e?w=1200&h=800&fit=crop',
    is_image: true,
  },
  {
    id: '4',
    name: 'Studio Gold Preview 4',
    thumbnail_url: 'https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=1200&h=800&fit=crop',
    is_image: true,
  },
];

export default function DemoOne() {
  return (
    <div className="min-h-screen bg-black text-white p-4 flex items-center justify-center" dir="rtl">
      <ThumbnailCarousel files={demoFiles} onDownload={() => alert('Demo download')} />
    </div>
  );
}