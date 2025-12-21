import { DEFAULT_BUSINESS_TYPE } from './businessTypes';

/**
 * HARD-CODED BUSINESS PROFILE
 * Single-customer build for Green Mile Lawn Care LLC
 * No localStorage, no Business Settings UI
 */

export const defaultBusinessProfile = {
  businessType: DEFAULT_BUSINESS_TYPE,
  businessName: 'Green Mile Lawn Care LLC',
  tagline: 'Professional Lawn & Property Services',

  // Logo + watermark (same image)
  logoUrl:
    'https://kilmhwlsqgjxjhvsweqb.supabase.co/storage/v1/object/public/images/Green%20Mile%20Lawncare-01.png',

  watermarkUrl:
    'https://kilmhwlsqgjxjhvsweqb.supabase.co/storage/v1/object/public/images/Green%20Mile%20Lawncare-01.png',

  contactLines: [
    'Paris, IL',
    '217-251-3376',
  ],

  filenamePrefix: 'GreenMile',
};

/**
 * Always return the hard-coded profile
 * (keeps function signature so imports don’t break)
 */
export function loadBusinessProfile() {
  return defaultBusinessProfile;
}

/**
 * No-op — intentionally disabled
 * Kept so existing calls do not error
 */
export function saveBusinessProfile() {
  // intentionally empty
}

/**
 * Used for filenames — KEEP THIS
 */
export function sanitizeFilePart(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '')
    .slice(0, 60);
}
