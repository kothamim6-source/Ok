import React from 'react';
import { useSettingsStore } from '../../store/settingsStore';
import { getSafeTelegramWebUrl, executeTelegramJoin } from '../../lib/telegramUtils';
import { MessageCircle, Facebook, Send, LifeBuoy } from 'lucide-react';

export function SupportSection() {
  const { settings } = useSettingsStore();
  const supportLinks = settings?.supportLinks;

  if (!supportLinks || (!supportLinks.whatsapp && !supportLinks.facebook && !supportLinks.telegram)) {
    return null;
  }

  return (
    <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-6">
      <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-white">
        <LifeBuoy className="h-5 w-5 text-red-500" />
        Support
      </h2>
      <div className="flex flex-wrap gap-4">
        {supportLinks.whatsapp && (
          <a
            href={supportLinks.whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-lg bg-[#25D366]/10 px-4 py-3 font-medium text-[#25D366] transition-colors hover:bg-[#25D366]/20"
          >
            <MessageCircle className="h-5 w-5" />
            WhatsApp
          </a>
        )}
        {supportLinks.facebook && (
          <a
            href={supportLinks.facebook}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-lg bg-[#1877F2]/10 px-4 py-3 font-medium text-[#1877F2] transition-colors hover:bg-[#1877F2]/20"
          >
            <Facebook className="h-5 w-5" />
            Facebook
          </a>
        )}
        {supportLinks.telegram && (
          <a
            href={getSafeTelegramWebUrl(supportLinks.telegram)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              e.preventDefault();
              executeTelegramJoin(supportLinks.telegram);
            }}
            className="flex items-center gap-2 rounded-lg bg-[#0088cc]/10 px-4 py-3 font-medium text-[#0088cc] transition-colors hover:bg-[#0088cc]/20 cursor-pointer"
          >
            <Send className="h-5 w-5" />
            Telegram
          </a>
        )}
      </div>
    </div>
  );
}
