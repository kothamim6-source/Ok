export interface ModeratorPermissionOption {
  id: string;
  label: string;
  labelBn: string;
  desc: string;
  category: 'Overview' | 'Media' | 'Community' | 'VIP & Finance' | 'Analytics' | 'Integration' | 'System';
}

export const MODERATOR_PERMISSION_OPTIONS: ModeratorPermissionOption[] = [
  { 
    id: 'dashboard', 
    label: 'Dashboard Overview', 
    labelBn: 'ড্যাশবোর্ড ওভারভিউ', 
    desc: 'অ্যাডমিন ড্যাশবোর্ড পরিসংখ্যান, ইনকাম/রেভিনিউ চার্ট এবং সাইট মেট্রিক্স দেখা', 
    category: 'Overview' 
  },
  { 
    id: 'blogger_import', 
    label: 'Blogger Import Engine', 
    labelBn: 'ব্লগার ভিডিও ইমপোর্ট', 
    desc: 'ব্লগার লিংক দিয়ে ভিডিও, একাধিক পর্ব, ক্যাপশন ও থাম্বনেইল ইমপোর্ট', 
    category: 'Media' 
  },
  { 
    id: 'upload', 
    label: 'Upload Video', 
    labelBn: 'ভিডিও আপলোড', 
    desc: 'নতুন ভিডিও ফাইল বা ডিরেক্ট এমপি৪ লিংক সরাসরি আপলোড', 
    category: 'Media' 
  },
  { 
    id: 'videos', 
    label: 'Video Library', 
    labelBn: 'ভিডিও লাইব্রেরি', 
    desc: 'সমস্ত ভিডিওর তালিকা দেখা, এডিট ও ডিলিট করা', 
    category: 'Media' 
  },
  { 
    id: 'categories', 
    label: 'Categories & Tags', 
    labelBn: 'ক্যাটাগরি ও ট্যাগ', 
    desc: 'ক্যাটাগরি তৈরি ও ফিল্টারিং ম্যানেজ করা', 
    category: 'Media' 
  },
  { 
    id: 'banners', 
    label: 'Promotional Banners', 
    labelBn: 'প্রমোশনাল ব্যানার', 
    desc: 'ওয়েবসাইটের ব্যানার ও প্রমোশনাল লিংক পরিচালনা', 
    category: 'Media' 
  },
  { 
    id: 'comments', 
    label: 'Comments Moderation', 
    labelBn: 'কমেন্ট মডারেশন', 
    desc: 'ইউজার কমেন্ট পর্যালোচনা ও অনাকাঙ্ক্ষিত মন্তব্য ডিলিট', 
    category: 'Community' 
  },
  { 
    id: 'reports', 
    label: 'User Reports', 
    labelBn: 'ইউজার রিপোর্ট', 
    desc: 'ইউজারদের পাঠানো অভিযোগ ও ফ্ল্যাগ রিভিউ', 
    category: 'Community' 
  },
  { 
    id: 'notice', 
    label: 'Notice Board (Marquee)', 
    labelBn: 'স্ক্রল নোটিশ বোর্ড', 
    desc: 'শীর্ষভাগের স্ক্রলিং নোটিশ পরিবর্তন', 
    category: 'Community' 
  },
  { 
    id: 'notifications', 
    label: 'Push Notifications', 
    labelBn: 'পুশ নোটিফিকেশন', 
    desc: 'সকল ইউজারকে ব্রডকাস্ট নোটিফিকেশন পাঠানো', 
    category: 'Community' 
  },
  { 
    id: 'online_users', 
    label: 'Real-Time Online Users', 
    labelBn: 'লাইভ অনলাইন ইউজার', 
    desc: 'রিয়েল-টাইমে কারা সাইটে সক্রিয় আছে পর্যবেক্ষণ', 
    category: 'Analytics' 
  },
  { 
    id: 'telegram', 
    label: 'Telegram Auto Post', 
    labelBn: 'টেলিগ্রাম অটো পোস্ট', 
    desc: 'টেলিগ্রাম চ্যানেলে স্বয়ংক্রিয় ভিডিও পাঠানো', 
    category: 'Integration' 
  },
  { 
    id: 'vip_requests', 
    label: 'VIP Requests', 
    labelBn: 'ভিআইপি আবেদন যাচাই', 
    desc: 'ইউজারদের পেমেন্ট ও TrxID আবেদন দেখা ও অনুমোদন', 
    category: 'VIP & Finance' 
  },
  { 
    id: 'gift_premium', 
    label: 'Gift VIP Access', 
    labelBn: 'গিফট প্রিমিয়াম', 
    desc: 'নির্দিষ্ট ইউজারকে ফ্রিতে প্রিমিয়াম এক্সেস উপহার দেওয়া', 
    category: 'VIP & Finance' 
  },
  { 
    id: 'redeem_codes', 
    label: 'Redeem Codes', 
    labelBn: 'রিডিম কোড জেনারেটর', 
    desc: 'গিফট ভাউচার কোড তৈরি ও তালিকা দেখা', 
    category: 'VIP & Finance' 
  },
  { 
    id: 'users', 
    label: 'User Management', 
    labelBn: 'ইউজার তালিকা', 
    desc: 'রেজিস্টার্ড ব্যবহারকারীদের তালিকা দেখা', 
    category: 'System' 
  }
];
