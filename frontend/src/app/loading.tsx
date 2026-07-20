import { VelontriLogo } from '@/components/ui/velontri-logo';

export default function GlobalLoading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-[#F8F9FA] dark:bg-[hsl(222_47%_5%)]">
      {/* Logo mark — pulses while loading */}
      <div className="animate-pulse">
        <VelontriLogo size={44} />
      </div>

      {/* Bouncing dots */}
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-indigo-600"
            style={{
              animation: 'bounce 0.8s ease-in-out infinite',
              animationDelay: `${i * 0.15}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
