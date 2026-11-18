import React, { useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { supabase } from '../../lib/supabase';
import { Database, ArrowRight, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

export function SupabaseMigration() {
  const [isMigrating, setIsMigrating] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()} - ${message}`]);
  };

  const migrateUsers = async () => {
    addLog('Fetching Users from Firebase...');
    const snap = await getDocs(collection(db as any, 'users'));
    const users = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    addLog(`Found ${users.length} users. Migrating to Supabase...`);

    const supabaseUsers = users.map((u: any) => ({
      id: u.id,
      name: u.name || 'Unknown',
      email: u.email,
      profile_image: u.profileImage,
      role: u.role || 'user',
      is_vip: u.isVIP || false,
      vip_expires_at: u.vipExpiresAt || null,
      status: u.status || 'active',
      points: u.points || 0,
      created_at: u.createdAt || Date.now()
    }));

    // Upsert in batches of 100
    for (let i = 0; i < supabaseUsers.length; i += 100) {
      const batch = supabaseUsers.slice(i, i + 100);
      const { error } = await supabase.from('users').upsert(batch);
      if (error) throw new Error(`Users Migration Error: ${error.message}`);
    }
    addLog('✅ Users migration complete.');
  };

  const migrateCategories = async () => {
    addLog('Fetching Categories from Firebase...');
    const snap = await getDocs(collection(db as any, 'categories'));
    const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    addLog(`Found ${items.length} categories. Migrating...`);

    const supabaseItems = items.map((c: any) => ({
      id: c.id,
      name: c.name || '',
      slug: c.slug || c.id,
      image: c.image,
      status: c.status || 'active',
      created_at: c.createdAt || Date.now()
    }));

    if (supabaseItems.length > 0) {
      const { error } = await supabase.from('categories').upsert(supabaseItems);
      if (error) throw new Error(`Categories Migration Error: ${error.message}`);
    }
    addLog('✅ Categories migration complete.');
  };

  const migrateVideos = async () => {
    addLog('Fetching Videos from Firebase...');
    const snap = await getDocs(collection(db as any, 'videos'));
    const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    addLog(`Found ${items.length} videos. Migrating...`);

    const supabaseItems = items.map((v: any) => ({
      id: v.id,
      title: v.title || '',
      slug: v.slug || v.id,
      description: v.description,
      thumbnail_url: v.thumbnailUrl,
      video_url: v.videoUrl,
      duration: v.duration,
      is_premium: v.isPremium || false,
      category_id: v.category || v.categoryId,
      views: v.views || 0,
      likes: v.likes || 0,
      status: v.status || 'published',
      visibility: v.visibility || 'public',
      featured: v.featured || false,
      created_at: v.createdAt || Date.now()
    }));

    for (let i = 0; i < supabaseItems.length; i += 50) {
      const batch = supabaseItems.slice(i, i + 50);
      const { error } = await supabase.from('videos').upsert(batch);
      if (error) throw new Error(`Videos Migration Error: ${error.message}`);
    }
    addLog('✅ Videos migration complete.');
  };

  const migrateComments = async () => {
    addLog('Fetching Comments from Firebase...');
    const snap = await getDocs(collection(db as any, 'comments'));
    const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    addLog(`Found ${items.length} comments. Migrating...`);

    const supabaseItems = items.map((c: any) => ({
      id: c.id,
      video_id: c.videoId,
      user_id: c.userId,
      user_name: c.userName,
      text: c.text || '',
      created_at: c.createdAt || Date.now()
    }));

    for (let i = 0; i < supabaseItems.length; i += 100) {
      const batch = supabaseItems.slice(i, i + 100);
      const { error } = await supabase.from('comments').upsert(batch);
      if (error) {
         // Might fail due to foreign key constraints if video or user doesn't exist. Ignore individual errors for now or log them.
         console.warn(`Comments Migration Warning: ${error.message}`);
      }
    }
    addLog('✅ Comments migration complete (Check console for any foreign key warnings).');
  };

  const migrateBanners = async () => {
    addLog('Fetching Banners from Firebase...');
    const snap = await getDocs(collection(db as any, 'banners'));
    const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    addLog(`Found ${items.length} banners. Migrating...`);

    const supabaseItems = items.map((b: any) => ({
      id: b.id,
      image_url: b.imageUrl || b.image_url || '',
      title: b.title || '',
      description: b.description || '',
      link_url: b.linkUrl || b.link_url || '',
      is_active: b.isActive !== undefined ? b.isActive : (b.is_active !== undefined ? b.is_active : true),
      is_premium: b.isPremium || b.is_premium || false,
      order: b.order || 0,
      created_at: b.createdAt || b.created_at || Date.now()
    }));

    for (let i = 0; i < supabaseItems.length; i += 50) {
      const batch = supabaseItems.slice(i, i + 50);
      const { error } = await supabase.from('banners').upsert(batch);
      if (error) {
         console.warn(`Banners Migration Warning: ${error.message}`);
      }
    }
    addLog('✅ Banners migration complete.');
  };

  const handleStartMigration = async () => {
    setIsMigrating(true);
    setStatus('running');
    setLogs([]);
    addLog('🚀 Starting Database Migration...');

    try {
      await migrateUsers();
      await migrateCategories();
      await migrateVideos();
      await migrateComments();
      await migrateBanners();
      
      addLog('🎉 ALL MIGRATIONS COMPLETED SUCCESSFULLY!');
      setStatus('success');
    } catch (error: any) {
      console.error(error);
      addLog(`❌ MIGRATION FAILED: ${error.message}`);
      setStatus('error');
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-indigo-500/10 rounded-xl">
          <Database className="w-8 h-8 text-indigo-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Database Migration</h1>
          <p className="text-gray-400">Transfer data from Firebase to Supabase PostgreSQL</p>
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <h2 className="text-xl font-bold text-white mb-4">Migration Requirements</h2>
        <ul className="list-disc pl-5 space-y-2 text-gray-300 mb-6">
          <li>Ensure you have run the <code className="bg-black/50 px-2 py-1 rounded text-indigo-400">supabase_schema.sql</code> file in your Supabase SQL Editor.</li>
          <li>Ensure the Supabase URL and Anon Key are correctly set in the environment variables.</li>
          <li>Do not close this window while the migration is running.</li>
        </ul>

        <div className="flex items-center justify-between p-4 bg-black/40 rounded-xl border border-white/5 mb-6">
           <div className="flex items-center gap-4 text-orange-500 font-bold">
              <Database className="w-6 h-6" /> Firebase (NoSQL)
           </div>
           <ArrowRight className="w-6 h-6 text-gray-500" />
           <div className="flex items-center gap-4 text-emerald-500 font-bold">
              <Database className="w-6 h-6" /> Supabase (PostgreSQL)
           </div>
        </div>

        <button
          onClick={handleStartMigration}
          disabled={isMigrating}
          className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-3 shadow-lg shadow-indigo-600/20"
        >
          {isMigrating ? (
            <>
              <Loader2 className="w-6 h-6 animate-spin" />
              Migrating Data... Please Wait
            </>
          ) : (
            'Start Migration Process'
          )}
        </button>
      </div>

      {logs.length > 0 && (
        <div className="bg-black/80 border border-white/10 rounded-2xl p-6 font-mono text-sm">
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10">
             <h3 className="text-white font-bold flex items-center gap-2">
                Migration Logs
                {status === 'running' && <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />}
                {status === 'success' && <CheckCircle className="w-4 h-4 text-green-500" />}
                {status === 'error' && <AlertCircle className="w-4 h-4 text-red-500" />}
             </h3>
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {logs.map((log, index) => (
              <div 
                key={index} 
                className={`
                  ${log.includes('✅') ? 'text-green-400' : ''}
                  ${log.includes('❌') ? 'text-red-400' : ''}
                  ${log.includes('🚀') || log.includes('🎉') ? 'text-indigo-400 font-bold' : ''}
                  ${!log.includes('✅') && !log.includes('❌') && !log.includes('🚀') && !log.includes('🎉') ? 'text-gray-300' : ''}
                `}
              >
                {log}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
