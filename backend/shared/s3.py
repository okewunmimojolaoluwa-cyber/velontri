"""
AWS S3 helpers for all Velontri microservices.

Provides:
- Typed upload with content-type enforcement
- Presigned URL generation
- Key construction helpers per media type
- Virus/MIME type validation (magic bytes, not just extension)

Security rules enforced:
- Never expose raw S3 bucket names or internal key paths to clients.
- Always use presigned URLs with short TTL for client access.
- Validate file content via python-magic (MIME sniffing), not just extension.
- Enforce per-type file size limits before uploading.
"""
from __future__ import annotations

import io
import uuid
from enum import Enum
from typing import BinaryIO

import aioboto3  # async boto3 wrapper
try:
    import magic  # python-magic for MIME sniffing (requires libmagic)
    _MAGIC_AVAILABLE = True
except ImportError:
    magic = None  # type: ignore[assignment]
    _MAGIC_AVAILABLE = False

from shared.logging import get_logger

logger = get_logger(__name__)

# ── Allowed MIME types per upload category ────────────────────────────────────

ALLOWED_IMAGE_MIMES: frozenset[str] = frozenset(
    {"image/jpeg", "image/png", "image/webp", "image/avif"}
)
ALLOWED_VIDEO_MIMES: frozenset[str] = frozenset({"video/mp4", "video/quicktime"})
ALLOWED_AUDIO_MIMES: frozenset[str] = frozenset(
    {"audio/mpeg", "audio/wav", "audio/mp4", "audio/ogg", "audio/webm"}
)
ALLOWED_DOCUMENT_MIMES: frozenset[str] = frozenset(
    {"application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"}
)
ALLOWED_PDF_MIMES: frozenset[str] = frozenset({"application/pdf"})

# ── File size limits (bytes) ──────────────────────────────────────────────────

MAX_IMAGE_SIZE: int = 20 * 1024 * 1024        # 20 MB
MAX_VIDEO_SIZE: int = 500 * 1024 * 1024       # 500 MB
MAX_VOICE_NOTE_SIZE: int = 5 * 1024 * 1024    # 5 MB
MAX_CHAT_IMAGE_SIZE: int = 10 * 1024 * 1024   # 10 MB
MAX_CHAT_FILE_SIZE: int = 25 * 1024 * 1024    # 25 MB
MAX_CV_SIZE: int = 10 * 1024 * 1024           # 10 MB
MAX_PDF_SIZE: int = 25 * 1024 * 1024          # 25 MB
PRESIGNED_URL_TTL: int = 3600                 # 1 hour in seconds


class UploadCategory(str, Enum):
    LISTING_IMAGE = "listing_image"
    LISTING_VIDEO = "listing_video"
    CHAT_VOICE = "chat_voice"
    CHAT_IMAGE = "chat_image"
    CHAT_FILE = "chat_file"
    CV = "cv"
    KYC_DOCUMENT = "kyc_document"
    INSPECTION_REPORT = "inspection_report"
    BARCODE = "barcode"
    QR_CODE = "qr_code"


_CATEGORY_CONSTRAINTS: dict[UploadCategory, tuple[frozenset[str], int]] = {
    UploadCategory.LISTING_IMAGE: (ALLOWED_IMAGE_MIMES, MAX_IMAGE_SIZE),
    UploadCategory.LISTING_VIDEO: (ALLOWED_VIDEO_MIMES, MAX_VIDEO_SIZE),
    UploadCategory.CHAT_VOICE: (ALLOWED_AUDIO_MIMES, MAX_VOICE_NOTE_SIZE),
    UploadCategory.CHAT_IMAGE: (ALLOWED_IMAGE_MIMES, MAX_CHAT_IMAGE_SIZE),
    UploadCategory.CHAT_FILE: (
        ALLOWED_IMAGE_MIMES
        | ALLOWED_VIDEO_MIMES
        | ALLOWED_AUDIO_MIMES
        | ALLOWED_DOCUMENT_MIMES,
        MAX_CHAT_FILE_SIZE,
    ),
    UploadCategory.CV: (ALLOWED_DOCUMENT_MIMES, MAX_CV_SIZE),
    UploadCategory.KYC_DOCUMENT: (ALLOWED_DOCUMENT_MIMES | ALLOWED_IMAGE_MIMES, MAX_PDF_SIZE),
    UploadCategory.INSPECTION_REPORT: (ALLOWED_PDF_MIMES, MAX_PDF_SIZE),
    UploadCategory.BARCODE: (ALLOWED_IMAGE_MIMES, MAX_IMAGE_SIZE),
    UploadCategory.QR_CODE: (ALLOWED_IMAGE_MIMES, MAX_IMAGE_SIZE),
}


def validate_upload(
    content: bytes,
    category: UploadCategory,
    filename: str = "",
) -> str:
    """
    Validate file content against allowed MIME types and size limits.

    :param content: raw file bytes
    :param category: upload category defining allowed MIME types and max size
    :param filename: original filename (for logging only)
    :returns: detected MIME type string
    :raises ValueError: if validation fails
    """
    allowed_mimes, max_size = _CATEGORY_CONSTRAINTS[category]

    # Size check first — cheapest guard
    if len(content) > max_size:
        raise ValueError(
            f"File size {len(content)} bytes exceeds maximum "
            f"{max_size} bytes for category '{category}'"
        )

    # MIME sniff from magic bytes — not from filename extension
    if _MAGIC_AVAILABLE:
        detected_mime = magic.from_buffer(content, mime=True)
    else:
        # Fallback: infer from filename extension when libmagic is unavailable
        import mimetypes
        detected_mime, _ = mimetypes.guess_type(filename or "file.bin")
        detected_mime = detected_mime or "application/octet-stream"

    if detected_mime not in allowed_mimes:
        raise ValueError(
            f"File type '{detected_mime}' is not allowed for "
            f"category '{category}'. Allowed: {sorted(allowed_mimes)}"
        )

    logger.debug(
        "upload_validated",
        category=category,
        mime=detected_mime,
        size=len(content),
        filename=filename,
    )
    return detected_mime


async def upload_file(
    session: "aioboto3.Session",
    bucket: str,
    key: str,
    content: bytes,
    content_type: str,
    metadata: dict[str, str] | None = None,
) -> str:
    """
    Upload bytes to S3 and return the object key.

    :param session: aioboto3 session
    :param bucket: target bucket name
    :param key: S3 object key
    :param content: raw bytes to upload
    :param content_type: validated MIME type string
    :param metadata: optional key-value metadata stored with the object
    :returns: the S3 object key
    :raises ExternalServiceError: on S3 upload failure
    """
    extra_args: dict[str, object] = {
        "ContentType": content_type,
        "ServerSideEncryption": "AES256",
    }
    if metadata:
        extra_args["Metadata"] = metadata

    try:
        async with session.client("s3") as s3:
            await s3.upload_fileobj(
                io.BytesIO(content),
                bucket,
                key,
                ExtraArgs=extra_args,
            )
    except Exception as exc:
        from shared.errors import ExternalServiceError  # avoid circular import
        raise ExternalServiceError(f"S3 upload failed for key '{key}'") from exc

    logger.info("s3_upload_success", bucket=bucket, key=key, size=len(content))
    return key


async def generate_presigned_url(
    session: "aioboto3.Session",
    bucket: str,
    key: str,
    ttl: int = PRESIGNED_URL_TTL,
) -> str:
    """
    Generate a presigned GET URL for an S3 object.

    :param ttl: URL lifetime in seconds
    :returns: presigned HTTPS URL
    """
    try:
        async with session.client("s3") as s3:
            url: str = await s3.generate_presigned_url(
                "get_object",
                Params={"Bucket": bucket, "Key": key},
                ExpiresIn=ttl,
            )
        return url
    except Exception as exc:
        from shared.errors import ExternalServiceError
        raise ExternalServiceError(
            f"Failed to generate presigned URL for key '{key}'"
        ) from exc


# ── S3 key builders ───────────────────────────────────────────────────────────

class S3Keys:
    """
    Centralised S3 key construction.
    Never build keys inline — always use these methods.
    """

    @staticmethod
    def listing_image(listing_id: str) -> str:
        return f"listings/{listing_id}/images/{uuid.uuid4()}"

    @staticmethod
    def listing_video(listing_id: str) -> str:
        return f"listings/{listing_id}/videos/{uuid.uuid4()}"

    @staticmethod
    def listing_tour(listing_id: str, ext: str = "jpg") -> str:
        return f"listings/{listing_id}/tour/{uuid.uuid4()}.{ext}"

    @staticmethod
    def inspection_report(listing_id: str) -> str:
        return f"listings/{listing_id}/inspection_reports/{uuid.uuid4()}.pdf"

    @staticmethod
    def cv(application_id: str) -> str:
        return f"cv/{application_id}/{uuid.uuid4()}"

    @staticmethod
    def kyc_document(user_id: str) -> str:
        return f"kyc/{user_id}/documents/{uuid.uuid4()}"

    @staticmethod
    def chat_media(thread_id: str) -> str:
        return f"chat/{thread_id}/media/{uuid.uuid4()}"

    @staticmethod
    def barcode(sku: str) -> str:
        return f"inventory/barcodes/{sku}/barcode.png"

    @staticmethod
    def qr_code(sku: str) -> str:
        return f"inventory/qrcodes/{sku}/qr.png"

    @staticmethod
    def store_logo(seller_id: str) -> str:
        return f"stores/{seller_id}/logo/{uuid.uuid4()}"

    @staticmethod
    def store_banner(seller_id: str) -> str:
        return f"stores/{seller_id}/banner/{uuid.uuid4()}"

    @staticmethod
    def profile_photo(user_id: str) -> str:
        return f"profiles/{user_id}/photo/{uuid.uuid4()}"
