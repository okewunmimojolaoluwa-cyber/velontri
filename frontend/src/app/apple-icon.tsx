/**
 * Apple touch icon — serves the real Velontri logo at 180×180.
 * Shown when users add Velontri to their iOS/Android home screen.
 */
import { ImageResponse } from 'next/og';
import { readFile } from 'fs/promises';
import path from 'path';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default async function AppleIcon() {
  const logoPath = path.join(process.cwd(), 'public', 'logo.png');
  let logoSrc: string;

  try {
    const logoBuffer = await readFile(logoPath);
    const base64 = logoBuffer.toString('base64');
    logoSrc = `data:image/png;base64,${base64}`;
  } catch {
    logoSrc = '';
  }

  if (!logoSrc) {
    return new ImageResponse(
      (
        <div
          style={{
            width: 180,
            height: 180,
            background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ color: '#fff', fontSize: 110, fontWeight: 900, fontFamily: 'sans-serif' }}>V</span>
        </div>
      ),
      { ...size }
    );
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          background: '#0a0a0a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoSrc} width={148} height={148} alt="Velontri" style={{ objectFit: 'contain' }} />
      </div>
    ),
    { ...size }
  );
}
