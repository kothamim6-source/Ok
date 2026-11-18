import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { SiteSettings } from '../../types';
import { Crown, AlertCircle, CheckCircle, Plus, Trash2, Link2, Image as ImageIcon } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';

export function VIPSettings() {
  const { settings, setSettings } = useSettingsStore();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  
  const [vipAmount, setVipAmount] = useState<number>(500);
  const [bkashNumber, setBkashNumber] = useState('');
  const [nagadNumber, setNagadNumber] = useState('');
  const [rocketNumber, setRocketNumber] = useState('');
  const [bkashLogo, setBkashLogo] = useState('');
  const [nagadLogo, setNagadLogo] = useState('');
  const [rocketLogo, setRocketLogo] = useState('');
  const [vipDurationText, setVipDurationText] = useState('lifetime');
  const [vipFeatures, setVipFeatures] = useState('');
  const [vipPackages, setVipPackages] = useState<any[]>([]);

  useEffect(() => {
    async function loadSettings() {
        try {
          const { data, error } = await supabase.from('settings').select('*').eq('id', 'general').single();
          if (error && error.code !== 'PGRST116') throw error;
          if (data && data.data) {
            const settingsData = data.data as SiteSettings;
            if (settingsData.vipSettings) {
              setVipAmount(settingsData.vipSettings.amount || 500);
              setBkashNumber(settingsData.vipSettings.bkash || '');
              setNagadNumber(settingsData.vipSettings.nagad || '');
              setRocketNumber(settingsData.vipSettings.rocket || '');
              setBkashLogo(settingsData.vipSettings.bkashLogo || '');
              setNagadLogo(settingsData.vipSettings.nagadLogo || '');
              setRocketLogo(settingsData.vipSettings.rocketLogo || '');
              setVipDurationText(settingsData.vipSettings.durationText || 'lifetime');
              setVipFeatures(settingsData.vipSettings.features?.join('\n') || '');
              setVipPackages(settingsData.vipSettings.packages || []);
            }
            setSettings(settingsData);
          }
        } catch (error) {
          console.error("Failed to load settings:", error);
        }
      }
    loadSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');
    try {
      const updatedSettings = {
        ...(settings || {}),
        vipSettings: {
          amount: Number(vipAmount),
          bkash: bkashNumber.trim(),
          nagad: nagadNumber.trim(),
          rocket: rocketNumber.trim(),
          bkashLogo: bkashLogo.trim(),
          nagadLogo: nagadLogo.trim(),
          rocketLogo: rocketLogo.trim(),
          durationText: vipDurationText,
          features: vipFeatures.split('\n').filter(f => f.trim() !== ''),
          packages: vipPackages
        },
        updatedAt: Date.now()
      };
      
      const { error } = await supabase.from('settings').upsert({
        id: 'general',
        data: updatedSettings
      });
      if (error) throw error;
      
      setSettings(updatedSettings as SiteSettings);
      setMessage('VIP settings saved successfully!');
    } catch (error) {
      console.error("Error saving settings:", error);
      setMessage('Error saving settings. Ensure you have admin permissions.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Crown className="text-yellow-500" /> VIP Subscription Settings
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Configure default pricing, multiple packages, and payment methods.
          </p>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-md flex items-center gap-2 ${message.includes('Error') ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-green-500/10 text-green-500 border border-green-500/20'}`}>
          {message.includes('Error') ? <AlertCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
          {message}
        </div>
      )}

      <div className="bg-[#111] rounded-xl border border-white/10 overflow-hidden">
        <form onSubmit={handleSave} className="p-6 space-y-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-300">
                Default VIP Price (BDT)
              </label>
              <div className="mt-2">
                <input
                  type="number"
                  required
                  value={vipAmount}
                  onChange={(e) => setVipAmount(Number(e.target.value))}
                  className="block w-full rounded-md border border-white/10 bg-black/50 px-4 py-2 text-white placeholder-gray-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 sm:text-sm"
                  placeholder="e.g. 500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300">
                Duration Text (e.g. lifetime, monthly)
              </label>
              <div className="mt-2">
                <input
                  type="text"
                  value={vipDurationText}
                  onChange={(e) => setVipDurationText(e.target.value)}
                  className="block w-full rounded-md border border-white/10 bg-black/50 px-4 py-2 text-white placeholder-gray-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 sm:text-sm"
                  placeholder="e.g. lifetime"
                />
              </div>
            </div>
            
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-300">
                VIP Features (One per line)
              </label>
              <div className="mt-2">
                <textarea
                  rows={4}
                  value={vipFeatures}
                  onChange={(e) => setVipFeatures(e.target.value)}
                  className="block w-full rounded-md border border-white/10 bg-black/50 px-4 py-2 text-white placeholder-gray-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 sm:text-sm"
                  placeholder="Ad-free experience\nAccess to Premium Content"
                />
              </div>
            </div>

            <div className="sm:col-span-2 pt-4 border-t border-white/5">
              <div className="flex justify-between items-center mb-4">
                <label className="block text-sm font-medium text-yellow-500">
                  VIP Subscription Packages
                </label>
                <button
                  type="button"
                  onClick={() => setVipPackages([...vipPackages, { id: 'pkg_' + Date.now(), name: 'New Package', price: 0, durationDays: 30 }])}
                  className="flex items-center gap-1 text-xs bg-yellow-500/20 text-yellow-500 px-2 py-1 rounded hover:bg-yellow-500/30"
                >
                  <Plus className="w-4 h-4" /> Add Package
                </button>
              </div>
              
              <div className="space-y-3">
                {vipPackages.map((pkg, idx) => (
                  <div key={pkg.id} className="flex flex-col sm:flex-row gap-3 p-3 bg-white/5 rounded-lg border border-white/10 items-start sm:items-center">
                    <div className="flex-1 w-full">
                      <label className="text-xs text-gray-500">Package Name</label>
                      <input
                        type="text"
                        value={pkg.name}
                        onChange={(e) => {
                          const newPkgs = [...vipPackages];
                          newPkgs[idx].name = e.target.value;
                          setVipPackages(newPkgs);
                        }}
                        className="block w-full rounded-md border border-white/10 bg-black/50 px-3 py-1.5 text-white placeholder-gray-500 focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500 text-sm"
                      />
                    </div>
                    <div className="w-full sm:w-24">
                      <label className="text-xs text-gray-500">Price (BDT)</label>
                      <input
                        type="number"
                        value={pkg.price}
                        onChange={(e) => {
                          const newPkgs = [...vipPackages];
                          newPkgs[idx].price = Number(e.target.value);
                          setVipPackages(newPkgs);
                        }}
                        className="block w-full rounded-md border border-white/10 bg-black/50 px-3 py-1.5 text-white placeholder-gray-500 focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500 text-sm"
                      />
                    </div>
                    <div className="w-full sm:w-24">
                      <label className="text-xs text-gray-500">Duration (Days)</label>
                      <input
                        type="number"
                        value={pkg.durationDays}
                        onChange={(e) => {
                          const newPkgs = [...vipPackages];
                          newPkgs[idx].durationDays = Number(e.target.value);
                          setVipPackages(newPkgs);
                        }}
                        className="block w-full rounded-md border border-white/10 bg-black/50 px-3 py-1.5 text-white placeholder-gray-500 focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500 text-sm"
                      />
                    </div>
                    <div className="w-full sm:w-auto mt-4 sm:mt-5 flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          const newPkgs = [...vipPackages];
                          newPkgs.splice(idx, 1);
                          setVipPackages(newPkgs);
                        }}
                        className="p-1.5 text-red-500 hover:bg-red-500/20 rounded bg-red-500/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {vipPackages.length === 0 && (
                  <p className="text-xs text-gray-500 italic">No packages defined. Users will only see the default VIP setting.</p>
                )}
              </div>
            </div>

            {/* Payment Gateways Config */}
            <div className="space-y-6 pt-4 border-t border-white/10">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <span>পেমেন্ট গেটওয়ে সেটিংস (Payment Methods & Logos)</span>
              </h3>
              <p className="text-xs text-gray-400">
                এখানে বিকাশ, নগদ এবং রকেটের পার্সোনাল নম্বর ও লোগো লিংক (Image URL) দিন। আপনার দেওয়া লিংক অনুযায়ী ওয়েবসাইটে স্বয়ংক্রিয়ভাবে লোগো প্রদর্শিত হবে।
              </p>

              {/* bKash */}
              <div className="p-4 rounded-xl border border-pink-500/20 bg-pink-500/5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-pink-400 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-pink-500"></span>
                    bKash (বিকাশ)
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1">
                      bKash Personal Number
                    </label>
                    <input
                      type="text"
                      value={bkashNumber}
                      onChange={(e) => setBkashNumber(e.target.value)}
                      className="block w-full rounded-md border border-white/10 bg-black/60 px-3 py-2 text-white placeholder-gray-500 focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500 text-sm font-mono"
                      placeholder="01XXXXXXXXX"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1 flex items-center gap-1.5">
                      <Link2 className="w-3.5 h-3.5 text-pink-400" />
                      <span>bKash Logo Image URL (ইমেজ লিংক)</span>
                    </label>
                    <input
                      type="url"
                      value={bkashLogo}
                      onChange={(e) => setBkashLogo(e.target.value)}
                      className="block w-full rounded-md border border-white/10 bg-black/60 px-3 py-2 text-white placeholder-gray-500 focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500 text-sm"
                      placeholder="https://example.com/bkash-logo.png"
                    />
                  </div>
                </div>
                {/* Logo Live Preview */}
                <div className="flex items-center gap-3 pt-1">
                  <span className="text-xs text-gray-400">লোগো প্রিভিউ:</span>
                  <div className="h-12 px-4 rounded-lg bg-white flex items-center justify-center border border-white/20 min-w-[120px]">
                    {bkashLogo ? (
                      <img
                        src={bkashLogo}
                        alt="bKash Logo Preview"
                        className="max-h-9 max-w-[140px] object-contain"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <span className="text-xs text-pink-600 font-bold">bKash (Text)</span>
                    )}
                  </div>
                  {!bkashLogo && (
                    <span className="text-[11px] text-gray-500 italic">লিংক ফাঁকা থাকলে টেক্সট আকারে দেখাবে</span>
                  )}
                </div>
              </div>

              {/* Nagad */}
              <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-orange-400 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
                    Nagad (নগদ)
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1">
                      Nagad Personal Number
                    </label>
                    <input
                      type="text"
                      value={nagadNumber}
                      onChange={(e) => setNagadNumber(e.target.value)}
                      className="block w-full rounded-md border border-white/10 bg-black/60 px-3 py-2 text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm font-mono"
                      placeholder="01XXXXXXXXX"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1 flex items-center gap-1.5">
                      <Link2 className="w-3.5 h-3.5 text-orange-400" />
                      <span>Nagad Logo Image URL (ইমেজ লিংক)</span>
                    </label>
                    <input
                      type="url"
                      value={nagadLogo}
                      onChange={(e) => setNagadLogo(e.target.value)}
                      className="block w-full rounded-md border border-white/10 bg-black/60 px-3 py-2 text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm"
                      placeholder="https://example.com/nagad-logo.png"
                    />
                  </div>
                </div>
                {/* Logo Live Preview */}
                <div className="flex items-center gap-3 pt-1">
                  <span className="text-xs text-gray-400">লোগো প্রিভিউ:</span>
                  <div className="h-12 px-4 rounded-lg bg-white flex items-center justify-center border border-white/20 min-w-[120px]">
                    {nagadLogo ? (
                      <img
                        src={nagadLogo}
                        alt="Nagad Logo Preview"
                        className="max-h-9 max-w-[140px] object-contain"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <span className="text-xs text-red-600 font-bold">নগদ (Text)</span>
                    )}
                  </div>
                  {!nagadLogo && (
                    <span className="text-[11px] text-gray-500 italic">লিংক ফাঁকা থাকলে টেক্সট আকারে দেখাবে</span>
                  )}
                </div>
              </div>

              {/* Rocket */}
              <div className="p-4 rounded-xl border border-purple-500/20 bg-purple-500/5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-purple-400 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
                    Rocket (রকেট)
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1">
                      Rocket Personal Number
                    </label>
                    <input
                      type="text"
                      value={rocketNumber}
                      onChange={(e) => setRocketNumber(e.target.value)}
                      className="block w-full rounded-md border border-white/10 bg-black/60 px-3 py-2 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 text-sm font-mono"
                      placeholder="01XXXXXXXXX"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1 flex items-center gap-1.5">
                      <Link2 className="w-3.5 h-3.5 text-purple-400" />
                      <span>Rocket Logo Image URL (ইমেজ লিংক)</span>
                    </label>
                    <input
                      type="url"
                      value={rocketLogo}
                      onChange={(e) => setRocketLogo(e.target.value)}
                      className="block w-full rounded-md border border-white/10 bg-black/60 px-3 py-2 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 text-sm"
                      placeholder="https://example.com/rocket-logo.png"
                    />
                  </div>
                </div>
                {/* Logo Live Preview */}
                <div className="flex items-center gap-3 pt-1">
                  <span className="text-xs text-gray-400">লোগো প্রিভিউ:</span>
                  <div className="h-12 px-4 rounded-lg bg-white flex items-center justify-center border border-white/20 min-w-[120px]">
                    {rocketLogo ? (
                      <img
                        src={rocketLogo}
                        alt="Rocket Logo Preview"
                        className="max-h-9 max-w-[140px] object-contain"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <span className="text-xs text-purple-600 font-bold">রকেট (Text)</span>
                    )}
                  </div>
                  {!rocketLogo && (
                    <span className="text-[11px] text-gray-500 italic">লিংক ফাঁকা থাকলে টেক্সট আকারে দেখাবে</span>
                  )}
                </div>
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
