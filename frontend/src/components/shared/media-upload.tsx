'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils/cn';

interface MediaUploadProps {
  value?: string;
  onChange: (url: string) => void;
  disabled?: boolean;
  className?: string;
  accept?: string;
  maxSizeMB?: number;
}

export function MediaUpload({
  value,
  onChange,
  disabled = false,
  className,
  accept = 'image/*',
  maxSizeMB = 5,
}: MediaUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(value || '');
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`File size must be less than ${maxSizeMB}MB`);
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Only image files are allowed');
      return;
    }

    setError('');
    setIsUploading(true);

    try {
      // Create object URL for preview
      const objectUrl = URL.createObjectURL(file);
      setPreview(objectUrl);

      // In production, this would upload to a storage service
      // For now, we'll simulate an upload delay and use the object URL
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Simulate getting a URL back from the upload service
      // In real implementation, this would be the CDN URL
      onChange(objectUrl);
    } catch (err) {
      setError('Failed to upload image');
      setPreview(value || '');
    } finally {
      setIsUploading(false);
    }
  }

  function handleRemove() {
    setPreview('');
    onChange('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  function handleClick() {
    if (!disabled && !isUploading) {
      fileInputRef.current?.click();
    }
  }

  return (
    <div className={cn('space-y-2', className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileSelect}
        disabled={disabled || isUploading}
        className="hidden"
      />

      {preview ? (
        <div className="relative group">
          <div className="aspect-video w-full overflow-hidden rounded-lg border bg-muted">
            <img
              src={preview}
              alt="Preview"
              className="h-full w-full object-cover"
            />
          </div>
          {!disabled && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleClick}
                  disabled={isUploading}
                >
                  {isUploading ? 'Uploading...' : 'Change'}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleRemove}
                  disabled={isUploading}
                >
                  Remove
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div
          onClick={handleClick}
          className={cn(
            'aspect-video w-full rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors',
            disabled || isUploading
              ? 'border-muted bg-muted opacity-50 cursor-not-allowed'
              : 'border-primary/20 hover:border-primary/50 hover:bg-accent'
          )}
        >
          {isUploading ? (
            <div className="space-y-2 text-center">
              <Skeleton className="h-8 w-8 rounded-full mx-auto" />
              <p className="text-sm text-muted-foreground">Uploading...</p>
            </div>
          ) : (
            <div className="space-y-2 text-center p-4">
              <div className="text-4xl">📷</div>
              <p className="text-sm font-medium">Click to upload</p>
              <p className="text-xs text-muted-foreground">
                PNG, JPG, GIF up to {maxSizeMB}MB
              </p>
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
