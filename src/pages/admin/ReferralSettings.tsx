import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

import { useSettingsStore } from '../../store/settingsStore';
import { useAuthStore } from '../../store/authStore';
import { Gift, Save, ShieldAlert, Loader2, Plus, Trash2 } from 'lucide-react';
import { SiteSettings } from '../../types';

export function ReferralSettings() {
  const { settings, setSettings } = useSettingsStore();
  const { user } = useAuthStore();
  
  const [enabled, setEnabled] = useState(true);
  const [referrerReward, setReferrerReward] = useState(50);
  const [refereeReward, setRefereeReward] = useState(20);
  const [redeemPackages, setRedeemPackages] = useState<{days: number, cost: number}[]>([
    { days: 1, cost: 100 },
    { days: 7, cost: 500 },
    { days: 30, cost: 1500 }
  ]);
  
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    if (settings?.referralSettings) {
      setEnabled(settings.referralSettings.enabled ?? true);
      setReferrerReward(settings.referralSettings.referrerReward ?? 50);
      setRefereeReward(settings.referralSettings.refereeReward ?? 20);
      if (settings.referralSettings.redeemPackages) {
        setRedeemPackages(settings.referralSettings.redeemPackages);
      } else if (settings.referralSettings.pointsToPremiumCost) {
        setRedeemPackages([{ days: settings.referralSettings.pointsToPremiumDurationDays || 30, cost: settings.referralSettings.pointsToPremiumCost }]);
      }
    }
  }, [settings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage({ type: '', text: '' });

    try {
      const updatedSettings = {
        ...settings,
        referralSettings: {
          enabled,
          referrerReward: Number(referrerReward),
          refereeReward: Number(refereeReward),
          redeemPackages
        }
      } as SiteSettings;

      const { error } = await supabase.from('settings').upsert({
        id: 'general',
        data: updatedSettings
      });
      if (error) throw error;
      
      setSettings(updatedSettings);
      setMessage({ type: 'success', text: 'Referral settings saved successfully!' });
    } catch (error: any) {
      console.error('Error saving referral settings:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to save settings' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <Gift className="w-6 h-6 text-red-500" />
          Refer & Earn Settings
        </h1>
        <p className="text-sm text-gray-400 mt-1">Configure referral points and system status.</p>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/60 p-6 backdrop-blur-xl">
        <form onSubmit={handleSave} className="space-y-6">
          {message.text && (
            <div className={`p-4 rounded-lg flex items-center gap-3 ${
              message.type === 'success' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'
            }`}>
              <ShieldAlert className="w-5 h-5 shrink-0" />
              <p className="text-sm font-medium">{message.text}</p>
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10">
              <div>
                <h3 className="text-white font-bold">Enable Referral System</h3>
                <p className="text-sm text-gray-400 mt-1">Allow users to refer friends and earn points</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                />
                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-300 block">Referrer Reward (Points)</label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-gray-500">
                    <Gift className="h-5 w-5" />
                  </div>
                  <input
                    type="number"
                    min="0"
                    required
                    value={referrerReward}
                    onChange={(e) => setReferrerReward(Number(e.target.value))}
                    className="block w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-12 pr-4 text-white focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
                <p className="text-xs text-gray-500">Points given to the person whose link was used.</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-300 block">Referee Reward (Points)</label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-gray-500">
                    <Gift className="h-5 w-5" />
                  </div>
                  <input
                    type="number"
                    min="0"
                    required
                    value={refereeReward}
                    onChange={(e) => setRefereeReward(Number(e.target.value))}
                    className="block w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-12 pr-4 text-white focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
                <p className="text-xs text-gray-500">Points given to the new user who signed up.</p>
              </div>
            </div>

            <h3 className="text-white font-bold mt-8 border-t border-white/10 pt-6">Points to Premium Conversion</h3>
            <p className="text-sm text-gray-400">Allow users to buy premium using referral points</p>
            
            <div className="space-y-4 mt-4">
              {redeemPackages.map((pkg, index) => (
                <div key={index} className="flex flex-col sm:flex-row items-center gap-4 bg-white/5 p-4 rounded-lg border border-white/10">
                  <div className="flex-1 w-full">
                    <label className="text-sm font-bold text-gray-300 block mb-1">Duration (Days)</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={pkg.days}
                      onChange={(e) => {
                        const newPkgs = [...redeemPackages];
                        newPkgs[index].days = Number(e.target.value);
                        setRedeemPackages(newPkgs);
                      }}
                      className="block w-full rounded-xl border border-white/10 bg-black py-2 px-4 text-white focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                  </div>
                  <div className="flex-1 w-full">
                    <label className="text-sm font-bold text-gray-300 block mb-1">Required Points</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={pkg.cost}
                      onChange={(e) => {
                        const newPkgs = [...redeemPackages];
                        newPkgs[index].cost = Number(e.target.value);
                        setRedeemPackages(newPkgs);
                      }}
                      className="block w-full rounded-xl border border-white/10 bg-black py-2 px-4 text-white focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setRedeemPackages(redeemPackages.filter((_, i) => i !== index))}
                    className="mt-6 p-2 rounded-lg bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setRedeemPackages([...redeemPackages, { days: 1, cost: 100 }])}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Package
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-white/10 flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 rounded-xl bg-red-600 px-6 py-3 text-sm font-bold text-white hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
