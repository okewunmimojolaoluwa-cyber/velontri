# Velontri File Upload Guide

## Overview

Velontri uses two upload strategies:
1. **Direct multipart upload** — client POSTs `multipart/form-data` directly to the service
2. **S3 presigned URL** — client requests a signed URL, then uploads directly to S3 (used for large files)

---

## File Size Limits

| Upload Type | Max Size | Allowed MIME Types |
|---|---|---|
| Listing image | 10 MB | image/jpeg, image/png, image/webp |
| Listing video | 100 MB | video/mp4, video/quicktime, video/webm |
| KYC government ID | 5 MB | image/jpeg, image/png, application/pdf |
| KYC business registration | 5 MB | image/jpeg, image/png, application/pdf |
| Job application CV | 10 MB | application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document |
| Chat image | 10 MB | image/jpeg, image/png, image/gif, image/webp |
| Chat voice message | 5 MB | audio/webm, audio/ogg, audio/mpeg, audio/wav |
| Chat file attachment | 20 MB | Any |
| Store logo | 5 MB | image/jpeg, image/png, image/webp |
| Profile avatar | 5 MB | image/jpeg, image/png, image/webp |
| Voice search audio | 10 MB | audio/wav, audio/mpeg, audio/ogg, audio/webm |

Per-listing limits: max **20 images**, max **3 videos**.

---

## Endpoint Reference

### Listing Images

```http
POST /api/v1/listings/{listing_id}/images
Authorization: Bearer <token>
Content-Type: multipart/form-data

file=<image binary>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "s3_key": "listings/550e8400-e29b-41d4-a716-446655440000/images/img_001.jpg"
  }
}
```

### Listing Videos

```http
POST /api/v1/listings/{listing_id}/videos
Authorization: Bearer <token>
Content-Type: multipart/form-data

file=<video binary>
```

### KYC Upload

```http
POST /api/v1/users/me/kyc/government-id
Authorization: Bearer <token>
Content-Type: multipart/form-data

file=<document binary>
document_type=passport   (or national_id, drivers_license)
```

### Job Application (CV)

```http
POST /api/v1/listings/{listing_id}/applications
Authorization: Bearer <token>
Content-Type: multipart/form-data

file=<cv pdf or docx>
```

### Chat Media

```http
POST /api/v1/chat/threads/{thread_id}/media?token=<access_token>
Content-Type: multipart/form-data

file=<image, audio, or document>
```

### Voice Search

```http
POST /api/v1/search/voice
Content-Type: multipart/form-data

audio=<audio binary>
```

---

## S3 Presigned URL Flow

For files > 10 MB (especially videos), use the presigned URL flow to upload directly to S3:

**Step 1 — Request presigned URL**
```http
POST /api/v1/listings/{listing_id}/videos/presign
Authorization: Bearer <token>
Content-Type: application/json

{
  "filename": "tour_video.mp4",
  "content_type": "video/mp4",
  "file_size_bytes": 52428800
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "upload_url": "https://velontri-media.s3.amazonaws.com/listings/uuid/videos/tour_video.mp4?X-Amz-Signature=...",
    "s3_key": "listings/uuid/videos/tour_video.mp4",
    "expires_in": 3600
  }
}
```

**Step 2 — Upload directly to S3**
```javascript
await fetch(data.upload_url, {
  method: 'PUT',
  headers: { 'Content-Type': 'video/mp4' },
  body: videoFile,
});
```

**Step 3 — Confirm upload to the service**
```http
POST /api/v1/listings/{listing_id}/videos/confirm
Authorization: Bearer <token>
Content-Type: application/json

{
  "s3_key": "listings/uuid/videos/tour_video.mp4"
}
```

---

## Upload Progress Tracking

### Web (XMLHttpRequest)

```javascript
function uploadWithProgress(url, file, token, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('file', file);

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        reject(JSON.parse(xhr.responseText));
      }
    });

    xhr.open('POST', url);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.send(formData);
  });
}

// Usage
const result = await uploadWithProgress(
  `https://api.velontri.com/api/v1/listings/${listingId}/images`,
  imageFile,
  accessToken,
  (pct) => setUploadProgress(pct)
);
```

### React Native (axios)

```javascript
import axios from 'axios';
import { Platform } from 'react-native';

async function uploadListingImage(listingId, imageUri, token, onProgress) {
  const formData = new FormData();
  formData.append('file', {
    uri: Platform.OS === 'android' ? imageUri : imageUri.replace('file://', ''),
    type: 'image/jpeg',
    name: 'listing_image.jpg',
  });

  const response = await axios.post(
    `https://api.velontri.com/api/v1/listings/${listingId}/images`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
        Authorization: `Bearer ${token}`,
      },
      onUploadProgress: (e) => {
        const pct = Math.round((e.loaded / e.total) * 100);
        onProgress(pct);
      },
    }
  );
  return response.data;
}
```

### Flutter (Dart)

```dart
import 'package:http/http.dart' as http;
import 'dart:io';

Future<String> uploadListingImage({
  required String listingId,
  required File imageFile,
  required String accessToken,
  Function(double)? onProgress,
}) async {
  final uri = Uri.parse(
    'https://api.velontri.com/api/v1/listings/$listingId/images',
  );

  final request = http.MultipartRequest('POST', uri)
    ..headers['Authorization'] = 'Bearer $accessToken'
    ..files.add(await http.MultipartFile.fromPath(
      'file',
      imageFile.path,
      contentType: MediaType('image', 'jpeg'),
    ));

  // For progress tracking, use the streamed send approach
  final streamed = await request.send();
  final response = await http.Response.fromStream(streamed);

  if (response.statusCode == 201) {
    final body = jsonDecode(response.body);
    return body['data']['s3_key'];
  }
  throw Exception(jsonDecode(response.body)['error']['message']);
}
```

---

## Displaying Uploaded Files

S3 keys are returned in the `data.s3_key` field. To display them, construct the CDN URL:

```
https://media.velontri.com/{s3_key}
```

Example:
```
https://media.velontri.com/listings/550e8400.../images/img_001.jpg
```

For private files (KYC documents), request a presigned GET URL:
```http
GET /api/v1/users/me/kyc/download-url?key={s3_key}
Authorization: Bearer <token>
```

---

## Error Responses for Uploads

| Scenario | Error Code | HTTP |
|---|---|---|
| File exceeds size limit | `INVALID_INPUT` | 400 |
| Unsupported MIME type | `INVALID_INPUT` | 400 |
| Listing image count exceeded (>20) | `QUOTA_EXCEEDED` | 429 |
| Unauthenticated | `UNAUTHORIZED` | 401 |
| Not listing owner | `FORBIDDEN` | 403 |
| Listing not found | `NOT_FOUND` | 404 |

---

## MIME Type Validation

The server validates MIME types using python-magic (file signature detection), not the `Content-Type` header alone. Disguising a non-image as `image/jpeg` by setting the content type will be rejected server-side.
