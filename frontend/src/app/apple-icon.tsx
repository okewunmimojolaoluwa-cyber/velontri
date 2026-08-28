/**
 * Apple touch icon — 180×180 brand mark for iOS/Android home screen.
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
 background: '#0a0a0a',
 display: 'flex',
 alignItems: 'center',
 justifyContent: 'center',
 }}
 >
 <svg width="120" height="120" viewBox="0 0 100 100" fill="none">
 <defs>
 <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
 <stop offset="0%" stopColor="#818cf8" />
 <stop offset="100%" stopColor="#a78bfa" />
 </linearGradient>
 </defs>
 <path
 d="M10 15 L50 85 L90 15"
 stroke="url(#g)"
 strokeWidth="16"
 strokeLinecap="round"
 strokeLinejoin="round"
 fill="none"
 />
 </svg>
 </div>
 ),
 { ...size }
 );
}
