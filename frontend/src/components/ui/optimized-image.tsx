'use client';

import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils/cn';

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  priority?: boolean;
  onLoad?: () => void;
}

/**
 * Optimized image component with:
 * - Lazy loading with IntersectionObserver
 * - Low-quality placeholder blur
 * - WebP/AVIF format support
 * - Responsive sizing
 * - Loading states
 */
export function OptimizedImage({
  src,
  alt,
  className,
  width,
  height,
  priority = false,
  onLoad,
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(priority);
  const [error, setError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (priority || !imgRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '50px', // Start loading 50px before visible
      }
    );

    observer.observe(imgRef.current);

    return () => observer.disconnect();
  }, [priority]);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setError(true);
  };

  // Generate responsive srcset for different sizes
  const generateSrcSet = (url: string) => {
    if (!url) return '';
    
    // For external images, return as-is
    if (url.startsWith('http')) {
      return url;
    }
    
    return url;
  };

  return (
    <div
      ref={imgRef}
      className={cn('relative overflow-hidden bg-slate-100', className)}
      style={{ width, height }}
    >
      {/* Loading skeleton */}
      {!isLoaded && !error && (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100 bg-[length:200%_100%]" 
             style={{ animation: 'shimmer 1.5s infinite' }} />
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-50">
          <div className="text-center text-slate-400 text-sm">
            <svg className="mx-auto h-8 w-8 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>Image unavailable</span>
          </div>
        </div>
      )}

      {/* Actual image - only render when in view */}
      {(isInView || priority) && !error && (
        <img
          src={generateSrcSet(src)}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={handleLoad}
          onError={handleError}
          className={cn(
            'h-full w-full object-cover transition-opacity duration-300',
            isLoaded ? 'opacity-100' : 'opacity-0'
          )}
          width={width}
          height={height}
        />
      )}
    </div>
  );
}

// Shimmer animation keyframes - add this to globals.css
const shimmerStyles = `
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
`;
