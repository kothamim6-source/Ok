import { SiteSettings, User } from '../types';

export const DEFAULT_SITE_NAME = '19-20 Streaming';

export function getConfiguredAdminEmail(settings?: SiteSettings | null): string {
  const fromSettings = settings?.adminEmail?.trim().toLowerCase();
  if (fromSettings) return fromSettings;

  const fromEnv = (import.meta.env.VITE_ADMIN_EMAIL || '').trim().toLowerCase();
  if (fromEnv) return fromEnv;

  return '';
}

export function isAdminUser(user?: User | null, settings?: SiteSettings | null): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  const adminEmail = getConfiguredAdminEmail(settings);
  if (adminEmail && user.email && user.email.toLowerCase() === adminEmail) {
    return true;
  }
  return false;
}

export function isPrivilegedUser(user?: User | null, settings?: SiteSettings | null): boolean {
  if (!user) return false;
  if (isAdminUser(user, settings)) return true;
  if (user.role === 'moderator') return true;
  if (user.isVIP) return true;
  return false;
}
