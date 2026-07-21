"""Barcode and QR code generation utilities for the Inventory Service."""
from __future__ import annotations

import io

try:
    import barcode
    from barcode.writer import ImageWriter
    _BARCODE_AVAILABLE = True
except ImportError:
    barcode = None  # type: ignore[assignment]
    ImageWriter = None  # type: ignore[assignment]
    _BARCODE_AVAILABLE = False

try:
    import qrcode
    _QRCODE_AVAILABLE = True
except ImportError:
    qrcode = None  # type: ignore[assignment]
    _QRCODE_AVAILABLE = False


def generate_barcode_png(sku: str) -> bytes:
    """Generate Code 128 barcode as PNG bytes."""
    if not _BARCODE_AVAILABLE:
        return b""
    code128 = barcode.get("code128", sku, writer=ImageWriter())
    buffer = io.BytesIO()
    code128.write(buffer, options={"write_text": True, "module_height": 10.0})
    return buffer.getvalue()


def generate_qr_png(sku: str) -> bytes:
    """Generate QR code as PNG bytes."""
    if not _QRCODE_AVAILABLE:
        return b""
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(sku)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    return buffer.getvalue()
