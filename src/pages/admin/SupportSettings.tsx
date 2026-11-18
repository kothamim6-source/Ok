import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

import { useSettingsStore } from '../../store/settingsStore';
import { SiteSettings } from '../../types';

export function SupportSettings() {
  const { settings, setSettings } = useSettingsStore();

  const [supportWhatsApp, setSupportWhatsApp] = useState(settings?.supportLinks?.whatsapp || '');
  const [supportFacebook, setSupportFacebook] = useState(settings?.supportLinks?.facebook || '');
  const [supportTelegram, setSupportTelegram] = useState(settings?.supportLinks?.telegram || '');
  
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (settings) {
      if (settings.supportLinks) {
        if (settings.supportLinks.whatsapp) setSupportWhatsApp(settings.supportLinks.whatsapp);
        if (settings.supportLinks.facebook) setSupportFacebook(settings.supportLinks.facebook);
        if (settings.supportLinks.telegram) setSupportTelegram(settings.supportLinks.telegram);
      }
    } else {
      async function loadSettings() {
        try {
          const { data, error } = await supabase.from('settings').select('*').eq('id', 'general').single();
          if (error && error.code !== 'PGRST116') throw error; // ignore no rows
          if (data && data.data) {
            const settingsData = data.data as SiteSettings;
            if (settingsData.supportLinks) {
              if (settingsData.supportLinks.whatsapp) setSupportWhatsApp(settingsData.supportLinks.whatsapp);
              if (settingsData.supportLinks.facebook) setSupportFacebook(settingsData.supportLinks.facebook);
              if (settingsData.supportLinks.telegram) setSupportTelegram(settingsData.supportLinks.telegram);
            }
            setSettings(settingsData);
          }
        } catch (error) {
          console.error("Failed to load settings:", error);
        }
      }
      loadSettings();
    }
  }, [settings, setSettings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setIsLoading(true);
    setMessage('');
    try {
      const updatedSettings = {
        ...(settings || {}),
        supportLinks: {
          whatsapp: supportWhatsApp,
          facebook: supportFacebook,
          telegram: supportTelegram
        },
        updatedAt: Date.now()
      };
      
      const { error } = await supabase.from('settings').upsert({
        id: 'general',
        data: updatedSettings
      });
      
      if (error) throw error;
      
      setSettings(updatedSettings as SiteSettings);
      setMessage('Support settings saved successfully!');
    } catch (error) {
      console.error("Error saving settings:", error);
      setMessage('Error saving settings. Ensure you have admin permissions.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Support Links Settings</h1>
        <p className="text-sm text-gray-400">Configure links for WhatsApp, Facebook, and Telegram support in the Profile page.</p>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-6">
        <form onSubmit={handleSave} className="space-y-6">
          {message && (
            <div className={`p-4 rounded-md text-sm ${message.includes('Error') ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'}`}>
              {message}
            </div>
          )}
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-green-400">
                WhatsApp Link
              </label>
              <div className="mt-2">
                <input
                  type="text"
                  value={supportWhatsApp}
                  onChange={(e) => setSupportWhatsApp(e.target.value)}
                  className="block w-full rounded-md border border-white/10 bg-black/50 px-4 py-2 text-white placeholder-gray-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 sm:text-sm"
                  placeholder="https://wa.me/..."
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-blue-400">
                Facebook Link
              </label>
              <div className="mt-2">
                <input
                  type="text"
                  value={supportFacebook}
                  onChange={(e) => setSupportFacebook(e.target.value)}
                  className="block w-full rounded-md border border-white/10 bg-black/50 px-4 py-2 text-white placeholder-gray-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 sm:text-sm"
                  placeholder="https://facebook.com/..."
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-blue-300">
                Telegram Link
              </label>
              <div className="mt-2">
                <input
                  type="text"
                  value={supportTelegram}
                  onChange={(e) => setSupportTelegram(e.target.value)}
                  className="block w-full rounded-md border border-white/10 bg-black/50 px-4 py-2 text-white placeholder-gray-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 sm:text-sm"
                  placeholder="https://t.me/..."
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-6 border-t border-white/10">
            <button
              type="submit"
              disabled={isLoading}
              className="rounded-md bg-red-600 px-6 py-2 text-sm font-bold text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-black disabled:opacity-50"
            >
              {isLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
