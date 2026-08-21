/**
 * Apple touch icon — shown when users add Velontri to their iOS home screen.
 * 180×180px, no rounded corners (iOS applies them automatically).
 */
import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
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
        <span
          style={{
            color: '#ffffff',
            fontSize: 110,
            fontWeight: 900,
            fontFamily: 'sans-serif',
            letterSpacing: '-4px',
            lineHeight: 1,
          }}
        >
          V
        </span>
      </div>
    ),
    { ...size }
  );
}
