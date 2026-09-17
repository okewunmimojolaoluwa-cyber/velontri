# Video Upload Implementation Plan

## Overview
Add video upload capability to listing creation with these requirements:
1. **First media must be an image** (cover image)
2. **Support both images and videos** in subsequent uploads
3. **Validate file types and sizes**
4. **Store videos in listing_media table** with media_type='video'

## Current State Analysis

### Database ✅ READY
- `listing_media` table already supports `media_type IN ('image','video','tour_360')`
- Schema is production-ready for videos

### Backend 🔨 NEEDS UPDATE
- `CreateListingRequest` schema has `extra_image_urls` but no `extra_video_urls`
- Service layer only handles images in listing_media
- S3 upload validators exist for videos (MAX_VIDEO_SIZE: 500MB)

### Frontend 🔨 NEEDS COMPLETE IMPLEMENTATION
- Current: Only accepts images (6 max)
- Needed: Accept images + videos, validate first upload is image

---

## Implementation Steps

### 1. Backend Schema Updates

#### File: `backend/marketplace-service/app/schemas.py`
```python
class CreateListingRequest(BaseModel):
    # ... existing fields ...
    extra_image_urls: list[str] | None = Field(default=None)
    extra_video_urls: list[str] | None = Field(
        default=None, 
        description="Video data URLs (MP4, MOV). Max 3 videos, 100MB each compressed."
    )
```

### 2. Backend Service Updates

#### File: `backend/marketplace-service/app/service.py`
Add video handling after image handling:
```python
# After extra_image_urls processing...
extra_videos: list[str] = body.extra_video_urls or []
if extra_videos:
    for i, video_url in enumerate(extra_videos[:3]):  # max 3 videos
        if not video_url:
            continue
        await self.session.execute(
            _ins_text("""
                INSERT INTO listing_media (id, listing_id, media_type, s3_key, sort_order, uploaded_at)
                VALUES (:mid, :lid, 'video', :s3key, :sorder, NOW())
            """),
            {
                "mid": str(_uuid_mod.uuid4()),
                "lid": str(listing.id),
                "s3key": video_url,
                "sorder": len(extra_urls) + i,  # After images
            },
        )
```

### 3. Frontend State Management

#### File: `frontend/src/app/dashboard/listings/create/page.tsx`
Update form state:
```typescript
const [form, setForm] = useState({
  // ... existing fields ...
  images: [] as string[],
  videos: [] as string[],  // NEW
});
```

### 4. Frontend File Upload Logic

Add video upload support:
```typescript
const readFilesAsDataURLsAndVideos = useCallback((files: FileList | File[]) => {
  const fileArr = Array.from(files);
  const totalMedia = form.images.length + form.videos.length;
  const remaining = 6 - totalMedia;  // 6 total media items
  
  if (remaining <= 0) return;
  
  const toRead = fileArr.slice(0, remaining);
  
  toRead.forEach((file) => {
    // Validate: first upload MUST be an image
    if (totalMedia === 0 && !file.type.startsWith('image/')) {
      setError('First upload must be a cover image');
      return;
    }
    
    // Images
    if (file.type.startsWith('image/')) {
      if (file.size > 20 * 1024 * 1024) {
        setError('Image must be under 20MB');
        return;
      }
      // Read and compress...
    }
    
    // Videos
    if (file.type.startsWith('video/')) {
      if (file.size > 100 * 1024 * 1024) {
        setError('Video must be under 100MB');
        return;
      }
      // Read video...
    }
  });
}, [form.images.length, form.videos.length]);
```

### 5. Frontend Video Compression

```typescript
async function compressVideo(dataUrl: string): Promise<string> {
  // Use browser-based video compression
  // Target: 720p max, reduce bitrate
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.src = dataUrl;
    video.onloadedmetadata = async () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      
      // Scale to max 720p
      const scale = Math.min(1, 720 / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      
      // For now, just validate and pass through
      // Full compression requires MediaRecorder API
      resolve(dataUrl);
    };
    video.onerror = () => reject(new Error('Invalid video'));
  });
}
```

### 6. Frontend Media Preview UI

```tsx
{/* Media preview grid */}
<div className="grid grid-cols-3 gap-2">
  {/* Images */}
  {form.images.map((img, i) => (
    <div key={`img-${i}`} className="relative">
      {i === 0 && (
        <span className="absolute top-1 left-1 bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded">
          COVER
        </span>
      )}
      <img src={img} className="w-full h-32 object-cover rounded-lg" />
      <button onClick={() => removeImage(i)}>×</button>
    </div>
  ))}
  
  {/* Videos */}
  {form.videos.map((vid, i) => (
    <div key={`vid-${i}`} className="relative">
      <span className="absolute top-1 left-1 bg-purple-600 text-white text-[10px] px-2 py-0.5 rounded">
        VIDEO
      </span>
      <video src={vid} className="w-full h-32 object-cover rounded-lg" />
      <button onClick={() => removeVideo(i)}>×</button>
    </div>
  ))}
</div>
```

### 7. Frontend Submission

Update mutation to send videos:
```typescript
const res = await sellerApi.createListing({
  // ... existing fields ...
  image_url: coverImageUrl,
  extra_image_urls: extraImageUrls.length > 0 ? extraImageUrls : undefined,
  extra_video_urls: compressedVideos.length > 0 ? compressedVideos : undefined,  // NEW
} as any);
```

---

## Validation Rules

### Backend Validation
- Max 3 videos per listing
- Video size: 500MB max (before compression)
- Allowed formats: MP4, MOV (H.264/H.265)
- Store as data URLs in listing_media

### Frontend Validation
- **First upload MUST be an image** (enforced at UI level)
- Total media limit: 6 items (images + videos combined)
- Image size: 20MB max
- Video size: 100MB max (after compression)
- Video formats: MP4, MOV, WebM
- Compress videos client-side to reduce bandwidth

---

## User Experience

### Upload Flow
1. User clicks "Add Photos/Videos"
2. **If no media**: Only allow image selection (show error if video selected)
3. **If cover exists**: Allow both images and videos
4. Show progress indicator during upload/compression
5. Display thumbnail preview with media type badge
6. Allow reordering (cover must stay first)
7. Allow removal

### Visual Indicators
- **Cover image**: Blue "COVER" badge, always first
- **Extra images**: No badge
- **Videos**: Purple "VIDEO" badge with play icon
- **Upload button**: "Add Photos/Videos" (not just "Add Photos")

---

## Testing Checklist

### Backend Tests
- [ ] Create listing with videos succeeds
- [ ] Videos stored in listing_media with media_type='video'
- [ ] Max 3 videos enforced
- [ ] Video size validation
- [ ] Get listing returns both images and videos

### Frontend Tests
- [ ] First upload must be image (blocks videos)
- [ ] After cover image, can upload videos
- [ ] Video preview shows correctly
- [ ] Video removal works
- [ ] File size limits enforced
- [ ] Upload progress indicator works
- [ ] Form submission includes videos
- [ ] Error messages are clear

### Integration Tests
- [ ] End-to-end listing creation with video
- [ ] Listing detail page shows videos
- [ ] Video playback works
- [ ] Mobile video upload works

---

## Security Considerations

1. **File Type Validation**: Check MIME type server-side
2. **File Size Limits**: Enforce both client and server-side
3. **Malware Scanning**: Consider adding virus scanning for video uploads
4. **Storage Costs**: Monitor video storage and bandwidth usage
5. **Rate Limiting**: Prevent abuse of video upload endpoint

---

## Performance Optimization

1. **Client-side compression**: Reduce video file size before upload
2. **Lazy loading**: Don't load all videos at once in listing view
3. **Progressive upload**: Show upload progress
4. **CDN delivery**: Serve videos through CDN for faster playback
5. **Thumbnail generation**: Create video thumbnails for preview

---

## Next Steps

1. ✅ Create implementation plan (this document)
2. 🔄 Update backend schema
3. 🔄 Update backend service layer
4. 🔄 Update frontend state management
5. 🔄 Add video upload UI
6. 🔄 Add validation logic
7. 🔄 Test thoroughly
8. 🔄 Deploy and monitor

---

## Message Delivery Status

### Current Implementation ✅
Chat service already has proper message delivery:
- WebSocket for real-time delivery
- Message queuing when recipient offline
- Delivery confirmation
- Read receipts

### Verification Needed
- Test message sending between users
- Verify delivery confirmations
- Check email notifications work

---

## Estimated Effort
- Backend changes: 2 hours
- Frontend changes: 4 hours
- Testing: 2 hours
- **Total: 8 hours**
