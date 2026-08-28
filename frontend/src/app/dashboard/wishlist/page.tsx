'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Wishlist redirects to Saved — same functionality
export default function WishlistRedirect() {
 const router = useRouter();
 useEffect(() => { router.replace('/dashboard/saved'); }, [router]);
 return null;
}
