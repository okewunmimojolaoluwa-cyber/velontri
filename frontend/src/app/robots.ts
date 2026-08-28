import type { MetadataRoute } from 'next';

/**
 * robots.ts — Next.js App Router
 * Served at /robots.txt as text/plain; charset=utf-8
 *
 * Cloudflare (pxxl.click) prepends its own managed content block that
 * includes Content-Signal directives and blocks some AI crawlers.
 * That block does NOT affect Googlebot (main search crawler).
 *
 * Our rules come after the Cloudflare block and apply to all agents.
 */
export default function robots(): MetadataRoute.Robots {
 return {
 rules: [
 {
 userAgent: '*',
 allow: [
 '/',
 '/listings',
 '/listings/',
 '/categories/',
 '/search',
 '/plans',
 '/stores/',
 ],
 disallow: [
 '/dashboard/',
 '/admin/',
 '/mod/',
 '/api/',
 '/login',
 '/register',
 '/forgot-password',
 '/verify-phone',
 '/verify-2fa',
 '/auth/',
 ],
 },
 ],
 sitemap: 'https://velontri.pxxl.click/sitemap.xml',
 };
}
