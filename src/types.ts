declare global {
  interface Window {
    Android?: {
      showRewardedVideo: () => void;
    };
  }
}

export type Role = 'user' | 'admin' | 'moderator';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  profileImage?: string;
  role: Role;
  permissions?: string[];
  isVIP?: boolean;
  vipReason?: string;
  vipExpiresAt?: number;
  status: 'active' | 'disabled';
  watchHistory?: { videoId: string, watchedAt: number }[];
  favorites?: string[];
  watchLater?: string[];
  socialLinks?: {
    facebook?: string;
    twitter?: string;
    instagram?: string;
  };
  referralCode?: string;
  points?: number;
  videos_watched?: number;
  isBannedFromComments?: boolean;
  device_limit?: number;
  deviceLimit?: number;
  devices?: string[];
  createdAt: number;
}

export interface VideoPart {
  id: string;
  title: string;
  videoUrl: string;
  duration?: string;
  isPremium?: boolean;
}

export interface Video {
  id: string;
  title: string;
  slug: string;
  description: string;
  thumbnailUrl: string;
  thumbnailUrls?: string[];
  videoUrl: string;
  duration?: string;
  isPremium?: boolean;
  parts?: VideoPart[];
  storageKey?: string;
  categoryId: string;
  category?: string;
  tags: string[];
  views: number;
  likes: number;
  status: 'draft' | 'published' | 'unpublished' | 'scheduled';
  scheduledFor?: number;
  visibility: 'public' | 'private';
  featured: boolean;
  is_trending?: boolean;
  order?: number;
  createdAt: number;
  updatedAt: number;
  metaTitle?: string;
  metaDescription?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  image?: string;
  status: 'active' | 'inactive';
  metaTitle?: string;
  metaDescription?: string;
  order?: number;
  createdAt: number;
}

export interface Comment {
  id: string;
  videoId: string;
  userId: string;
  userName: string;
  userRole?: string;
  userIsVIP?: boolean;
  text: string;
  isHidden?: boolean;
  likes?: number;
  dislikes?: number;
  likedBy?: string[];
  createdAt: number;
}

export interface Report {
  id: string;
  type: 'video' | 'comment';
  targetId: string;
  reason: string;
  reportedBy: string;
  status: 'pending' | 'resolved';
  createdAt: number;
}

export interface VIPPackage {
  id: string;
  name: string;
  price: number;
  durationDays: number;
  features?: string[];
}

export interface VIPRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  paymentMethod: 'bKash' | 'Nagad' | 'Rocket';
  transactionId: string;
  amount: number;
  packageId?: string;
  durationDays?: number;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
}

export interface Banner {
  id: string;
  imageUrl: string;
  title?: string;
  description?: string;
  linkUrl?: string;
  isActive: boolean;
  isPremium?: boolean;
  order?: number;
  createdAt: number;
}

export interface Series {
  id: string;
  title: string;
  description: string;
  genre: string;
  releaseYear: string;
  posterUrl: string;
  videoUrl?: string;
  createdAt: number;
}

export interface Notification {
  id: string;
  userId: string; // 'all' for broadcast, or specific user ID
  title: string;
  message: string;
  read: boolean;
  type: 'NEW_VIDEO' | 'VIP_UPDATE' | 'SYSTEM' | 'PROMO';
  link?: string;
  createdAt: number;
}

export interface AuditLog {
  id: string;
  adminId: string;
  adminEmail?: string;
  action: string;
  targetId?: string;
  targetType?: string;
  details?: any;
  createdAt: number;
}

export interface QuickLinkButton {
  id: string;
  label: string;
  url: string;
  style: 'red' | 'blue' | 'emerald' | 'amber' | 'purple' | 'pink' | 'cyan' | 'orange';
  openInNewTab?: boolean;
}

export interface SiteSettings {
  siteName: string;
  adminEmail?: string;
  requireLoginToWatch?: boolean;
  siteDescription: string;
  logo?: string;
  logoImageUrl?: string;
  telegramUrl?: string;
  quickButtons?: QuickLinkButton[];
  favicon?: string;
  allowUserUpload: boolean;
  allowComments: boolean;
  adsEnabled: boolean;
  customAds?: {
    globalScript?: string;
    headerBanner?: string;
    footerBanner?: string;
    sidebarBanner?: string;
    infeedBanner?: string;
    smartlink?: string;
    socialBar?: string;
    popunder?: string;
    nativeBanner?: string;
    banner468x60?: string;
    banner300x250?: string;
    banner160x300?: string;
    banner160x600?: string;
    banner320x50?: string;
    banner728x90?: string;
    vastUrl?: string;
    premiumUnlockLink?: string;
    toggles?: Record<string, boolean>;
  };
  maintenanceMode: boolean;
  maintenanceOnMessage?: string;
  maintenanceOffMessage?: string;
  appDownloadLink?: string;
  appSizeLabel?: string;
  appDownloadsCount?: number;
  giftSupportLink?: string;
  defaultVideoDescription?: string;
  defaultThumbnailUrl?: string;
  cloudinaryCloudName?: string;
  cloudinaryUploadPreset?: string;
  supportLinks?: {
    whatsapp?: string;
    facebook?: string;
    telegram?: string;
  };
  seoSettings: {
    siteTitle: string;
    metaDescription: string;
    socialImage?: string;
    keywords: string;
  };
  vipSettings?: {
    amount: number;
    bkash: string;
    nagad: string;
    rocket: string;
    bkashLogo?: string;
    nagadLogo?: string;
    rocketLogo?: string;
    durationText?: string;
    features?: string[];
    packages?: VIPPackage[];
  };
  referralSettings?: {
    enabled: boolean;
    referrerReward: number;
    refereeReward: number;
    pointsToPremiumDurationDays?: number;
    pointsToPremiumCost?: number;
    redeemPackages?: { days: number, cost: number }[];
  };
  telegramGiftSettings?: {
    botToken?: string;
    chatId?: string;
    customText?: string;
    autoGiftEnabled?: boolean;
    autoGiftTime?: string;
  };
  noticeSettings?: SiteNoticeSettings;
}

export interface SiteNoticeSettings {
  tickerEnabled: boolean;
  tickerText: string;
  tickerBadgeText: string;
  tickerLink?: string;
  tickerSpeed: 'slow' | 'normal' | 'fast';
  tickerTheme: 'orange' | 'amber' | 'red' | 'purple' | 'blue' | 'emerald';
  popupEnabled: boolean;
  popupTitle: string;
  popupMessage: string;
  popupImageUrl?: string;
  popupButtonText?: string;
  popupButtonLink?: string;
  popupFrequency: 'once_per_session' | 'every_visit' | 'once_until_updated';
  popupVersion: string;
  updatedAt?: number;
}

export interface ExtractedFile {
  name: string;
  path: string;
  size: number;
  isFolder?: boolean;
  content?: string;
  blob?: Blob;
  mimeType: string;
}

export interface ZipProject {
  filename: string;
  totalFiles: number;
  totalSize: number;
  files: ExtractedFile[];
  entryHtml?: string;
}
