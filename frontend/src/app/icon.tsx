/**
 * Browser tab favicon — serves the real Velontri logo (public/logo.png).
 * Next.js picks this up automatically as /icon at 32×32.
 */
import { ImageResponse } from 'next/og';
import { readFile } from 'fs/promises';
import path from 'path';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default async function Icon() {
  // Read the real logo from public/
  const logoPath = path.join(process.cwd(), 'public', 'logo.png');
  let logoSrc: string;

  try {
    const logoBuffer = await readFile(logoPath);
    const base64 = logoBuffer.toString('base64');
    logoSrc = `data:image/png;base64,${base64}`;
  } catch {
    // Fallback: indigo V if logo.png not found
    logoSrc = '';
  }

  if (!logoSrc) {
    return new ImageResponse(
      (
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ color: '#fff', fontSize: 20, fontWeight: 900, fontFamily: 'sans-serif' }}>V</span>
        </div>
      ),
      { ...size }
    );
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: '#0a0a0a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          padding: 2,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoSrc} width={28} height={28} alt="Velontri" style={{ objectFit: 'contain' }} />
      </div>
    ),
    { ...size }
  );
}
