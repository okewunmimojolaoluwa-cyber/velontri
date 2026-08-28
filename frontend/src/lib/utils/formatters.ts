/**
 * Normalizes a phone number for consistent formatting and WhatsApp linking.
 * Strips all non-digit characters.
 * If the number is 11 digits and starts with 0 (standard Nigerian format, e.g. 09158200927),
 * it replaces the leading 0 with 234.
 */
export function normalizePhoneNumber(phone: string | undefined | null): string {
 if (!phone) return '';
 let clean = phone.replace(/\D/g, '');
 if (clean.length === 11 && clean.startsWith('0')) {
 clean = '234' + clean.slice(1);
 }
 return clean;
}
