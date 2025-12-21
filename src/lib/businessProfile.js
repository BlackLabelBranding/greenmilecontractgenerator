import { DEFAULT_BUSINESS_TYPE } from './businessTypes';

const STORAGE_KEY = 'pdfgen_businessProfile_v1';

export const defaultBusinessProfile = {
  businessType: DEFAULT_BUSINESS_TYPE,
  businessName: 'Green Mile Lawn Care',
  tagline: 'Professional Lawn & Property Services',
  // You can paste a hosted URL here (Supabase, Cloudinary, etc.) or upload in Vercel later.
  logoUrl: '',
  watermarkUrl: '',
  contactLines: [
    'Paris, IL',
    '217-251-3376',
  ],
  filenamePrefix: 'GreenMile',
};

export function loadBusinessProfile() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultBusinessProfile;
    const parsed = JSON.parse(raw);
    return { ...defaultBusinessProfile, ...parsed };
  } catch {
    return defaultBusinessProfile;
  }
}

export function saveBusinessProfile(profile) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

export function sanitizeFilePart(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '')
    .slice(0, 60);
}
