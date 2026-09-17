# Complete Video Upload Implementation - Action Required

## STATUS: Backend Complete ✅ | Frontend Needs Full Implementation 🔄

### Summary
The backend is 100% ready for video uploads. However, the frontend has **NO video support** currently and needs a complete implementation. Without this, users cannot upload videos even though the backend accepts them.

---

## What's Working (Backend)
✅ Database schema supports videos
✅ API endpoint accepts `extra_video_urls`
✅ Videos stored in `listing_media` table
✅ Service layer processes up to 3 videos
✅ Get listing returns both images and videos
✅ All committed and deployed (commits: fa74f72, 295f37e)

## What's Missing (Frontend)
❌ No video array in form state
❌ No video file handler
❌ No "first upload must be image" validation
❌ No video size/format validation
❌ No video preview UI
❌ No video submission logic
❌ File input doesn't accept videos
❌ No error handling for videos
❌ No loading states for video processing
❌ No memory cleanup for videos

---

## CRITICAL IMPLEMENTATION NEEDED

The frontend file `frontend/src/app/dashboard/listings/create/page.tsx` needs these changes:

### 1. Update Form State (Line ~335)
```typescript
const [form, setForm] = useState({
  // ... existing fields ...
  images: [] as string[],
  videos: [] as string[],  // ADD THIS
});
```

### 2. Create Unified Media Handler (Replace `readFilesAsDataURLs`)
```typescript
const readMediaFiles = useCallback((files: FileList | File[]) => {
  const fileArr = Array.from(files);
  const totalMedia = form.images.length + form.videos.length;
  
  // CRITICAL: First upload MUST be an image
  if (totalMedia === 0) {
    const firstFile = fileArr[0];
    if (!firstFile?.type.startsWith('image/')) {
      setError('❌ First upload must be a cover image (not a video)');
      return;
    }
  }
  
  const remaining = 6 - totalMedia;
  if (remaining <= 0) {
    setError('Maximum 6 media items reached');
    return;
  }
  
  const toRead = fileArr.slice(0, remaining);
  
  toRead.forEach(async (file) => {
    // Handle Images
    if (file.type.startsWith('image/')) {
      if (file.size > 20 * 1024 * 1024) {
        setError(`Image "${file.name}" is too large (max 20MB)`);
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        if (dataUrl) {
          setForm((f) => {
            if (f.images.length + f.videos.length >= 6) return f;
            return { ...f, images: [...f.images, dataUrl] };
          });
        }
      };
      reader.readAsDataURL(file);
    }
    
    // Handle Videos
    else if (file.type.startsWith('video/')) {
      // Validate format
      const validFormats = ['video/mp4', 'video/quicktime', 'video/webm'];
      if (!validFormats.includes(file.type)) {
        setError(`Video format not supported. Use MP4, MOV, or WebM`);
        return;
      }
      
      // Validate size
      if (file.size > 100 * 1024 * 1024) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
        setError(`Video "${file.name}" is too large (${sizeMB}MB). Max is 100MB`);
        return;
      }
      
      // Check video limit
      if (form.videos.length >= 3) {
        setError('Maximum 3 videos per listing');
        return;
      }
      
      // Validate video is not corrupt
      const video = document.createElement('video');
      video.onloadedmetadata = () => {
        if (video.duration > 0 && video.duration < Infinity) {
          const reader = new FileReader();
          reader.onload = (e) => {
            const dataUrl = e.target?.result as string;
            if (dataUrl) {
              setForm((f) => {
                if (f.videos.length >= 3) return f;
                if (f.images.length + f.videos.length >= 6) return f;
                return { ...f, videos: [...f.videos, dataUrl] };
              });
            }
          };
          reader.readAsDataURL(file);
        } else {
          setError(`Video "${file.name}" appears to be corrupt`);
        }
        URL.revokeObjectURL(video.src);
      };
      video.onerror = () => {
        setError(`Failed to load video "${file.name}"`);
        URL.revokeObjectURL(video.src);
      };
      video.src = URL.createObjectURL(file);
    }
  });
}, [form.images.length, form.videos.length]);
```

### 3. Add Remove Video Function
```typescript
function removeVideo(index: number) {
  setForm(f => ({
    ...f,
    videos: f.videos.filter((_, i) => i !== index)
  }));
}
```

### 4. Update File Input Accept Attribute (Line ~878)
```html
<input
  ref={fileInputRef}
  type="file"
  accept="image/*,video/mp4,video/quicktime,video/webm"  <!-- ADD VIDEOS -->
  multiple
  className="hidden"
  onChange={onFileInputChange}
/>
```

### 5. Update onFileInputChange
```typescript
function onFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
  if (e.target.files?.length) {
    readMediaFiles(e.target.files);  // Use new handler
    e.target.value = '';
  }
}
```

### 6. Update onDrop
```typescript
function onDrop(e: React.DragEvent) {
  e.preventDefault();
  setDragOver(false);
  if (e.dataTransfer.files?.length) {
    readMediaFiles(e.dataTransfer.files);  // Use new handler
  }
}
```

### 7. Add Video Preview UI in Step 2 (After images grid)
```tsx
{/* Video Preview Grid */}
{form.videos.length > 0 && (
  <div className="space-y-2">
    <p className="text-xs font-semibold text-slate-600">Videos ({form.videos.length}/3)</p>
    <div className="grid grid-cols-3 gap-3">
      {form.videos.map((url, i) => (
        <div key={`video-${i}`} className="relative aspect-square rounded-xl overflow-hidden border border-purple-200 bg-purple-50">
          <video src={url} className="h-full w-full object-cover" muted />
          <span className="absolute top-1 left-1 rounded-full bg-purple-600 px-2 py-0.5
            text-[9px] font-bold text-white uppercase tracking-wide flex items-center gap-1">
            <PlayCircle className="h-2.5 w-2.5" weight="fill" />
            VIDEO
          </span>
          <button
            type="button"
            onClick={() => removeVideo(i)}
            className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 text-white
              flex items-center justify-center hover:bg-red-600 transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  </div>
)}
```

### 8. Update Button Text
```tsx
{form.images.length === 0 ? 'Choose Photos/Videos' : `Gallery (${form.images.length + form.videos.length}/6)`}
```

### 9. Update Submission Logic (in mutationFn)
```typescript
const res = await sellerApi.createListing({
  // ... existing fields ...
  image_url: coverImageUrl,
  extra_image_urls: extraImageUrls.length > 0 ? extraImageUrls : undefined,
  extra_video_urls: form.videos.length > 0 ? form.videos : undefined,  // ADD THIS
  ...(form.subcategory ? { subcategory: form.subcategory } : {}),
} as any);
```

### 10. Add Import for PlayCircle Icon
```typescript
import { MapPin, CaretRight, ImageIcon, UploadSimple, X, Lock, Lightning, ArrowRight, PlayCircle } from '@phosphor-icons/react';
```

### 11. Add Memory Cleanup (Add useEffect)
```typescript
useEffect(() => {
  return () => {
    // Cleanup blob URLs to prevent memory leaks
    form.videos.forEach(url => {
      if (url.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(url);
        } catch (e) {
          // URL might already be revoked
        }
      }
    });
  };
}, []);
```

### 12. Update Step 2 Description
```tsx
<p className="text-sm font-bold text-slate-700">Add photos and videos (up to 6 total)</p>
<p className="text-xs text-slate-500 mb-3">
  ⚠️ First upload must be a cover image. Then add more photos or videos.
</p>
```

---

## VALIDATION RULES SUMMARY

### Images
- ✅ Max 20MB per image
- ✅ Formats: JPG, PNG, WEBP, HEIC
- ✅ First upload MUST be image

### Videos
- ✅ Max 100MB per video
- ✅ Formats: MP4, MOV, WebM only
- ✅ Max 3 videos per listing
- ✅ Cannot be first upload

### Total Media
- ✅ Max 6 items total (images + videos)
- ✅ At least 1 image required (the cover)

---

## ERROR MESSAGES TO SHOW

```typescript
// Format validation
'Video format not supported. Use MP4, MOV, or WebM'

// Size validation
'Video "my-video.mp4" is too large (150.5MB). Max is 100MB'
'Image "photo.jpg" is too large (25MB). Max is 20MB'

// Count validation
'Maximum 3 videos per listing'
'Maximum 6 media items reached'

// Order validation
'❌ First upload must be a cover image (not a video)'

// Corruption
'Video "file.mp4" appears to be corrupt. Try re-recording or converting.'

// Generic
'Failed to load video. Please try a different file.'
```

---

## TESTING BEFORE DEPLOYMENT

### Must Test:
1. Upload image first → add video → Works ✓
2. Try upload video first → Blocked with clear message ✓
3. Upload 101MB video → Error shown ✓
4. Upload AVI video → Error shown ✓
5. Upload 7th media item → Blocked ✓
6. Upload 4th video → Blocked ✓
7. Remove all images → Videos also removed ✓
8. Video preview shows thumbnail ✓
9. Form submission includes videos ✓
10. Backend receives and stores videos ✓

---

## DEPLOYMENT STEPS

1. Make all changes above to `frontend/src/app/dashboard/listings/create/page.tsx`
2. Test locally with:
   - 1 image + 1 video
   - 3 images + 3 videos  
   - Error scenarios
3. Check browser console for errors
4. Verify form submission
5. Check backend logs
6. Commit changes
7. Push to GitHub
8. Deploy frontend
9. Test on production
10. Monitor for errors

---

## ESTIMATED TIME
- Implementation: 2-3 hours
- Testing: 1 hour
- **Total: 3-4 hours**

---

## NEXT ACTIONS

1. **Implement all 12 changes** listed above
2. **Test extensively** (all 10 test scenarios)
3. **Fix any bugs** found during testing
4. **Commit and push** to GitHub
5. **Deploy** to production
6. **Monitor** for user issues

Without these changes, video upload will NOT work even though backend is ready.

