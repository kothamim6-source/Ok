import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Category } from '../../types';
import { AdBanner } from '../../components/ui/AdBanner';
import { FolderTree } from 'lucide-react';
import { useCacheStore } from '../../store/cacheStore';

export function CategoriesPage() {
  const homeCategories = useCacheStore(state => state.homeCategories);
  const [categories, setCategories] = useState<Category[]>(homeCategories);
  const [isLoading, setIsLoading] = useState(homeCategories.length === 0);

  useEffect(() => {
    let isMounted = true;

    if (homeCategories.length > 0) {
      setCategories(homeCategories);
      setIsLoading(false);
      return;
    }

    async function fetchCategories() {
      try {
        const { data, error } = await supabase
          .from('categories')
          .select('*')
          .eq('status', 'active');
          
        if (error) throw error;
        
        const fetched: Category[] = (data || []).map(doc => ({
          id: doc.id,
          name: doc.name,
          slug: doc.slug,
          image: doc.image,
          status: doc.status as any,
          createdAt: doc.created_at
        }));
        
        if (isMounted) {
          setCategories(fetched);
        }
      } catch (error) {
        console.error("Error fetching categories:", error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }
    fetchCategories();

    return () => {
      isMounted = false;
    };
  }, [homeCategories]);

  return (
    <div className="flex flex-col gap-4">
      <div className="sticky top-[64px] z-30 -mx-4 px-4 py-3 bg-[#050505]/95 backdrop-blur-xl border-b border-white/5">
        <h1 className="text-2xl font-bold text-white md:text-3xl">Categories</h1>
        <p className="text-gray-400 mt-1 text-sm md:text-base">Browse videos by your favorite topics.</p>
      </div>

      <AdBanner placement="nativeBanner" className="w-full min-h-[280px]" />

      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <span className="text-gray-400">Loading categories...</span>
        </div>
      ) : categories.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center rounded-xl border border-white/10 bg-white/5 p-6 text-center">
          <p className="text-gray-400">No categories available yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:gap-6 md:gap-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 mt-10">
          {categories.map((cat) => (
            <Link 
              key={cat.id} 
              to={`/category/${encodeURIComponent(cat.name)}`}
              className="group flex flex-col items-center gap-4"
            >
              <div className="relative flex h-32 w-32 md:h-40 md:w-40 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-black p-1.5 transition-all duration-300 group-hover:-translate-y-2 group-hover:border-red-500/50 group-hover:shadow-[0_12px_30px_rgba(239,68,68,0.3)]">
                {cat.image ? (
                  <div className="relative h-full w-full overflow-hidden rounded-full bg-black">
                    {/* Blurred Background */}
                    <div 
                      className="absolute inset-0 bg-cover bg-center opacity-40 blur-md scale-125 transition-opacity duration-300 group-hover:opacity-60"
                      style={{ backgroundImage: `url(${cat.image})` }}
                    />
                    <img src={cat.image} alt={cat.name} className="relative z-10 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
                  </div>
                ) : (
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-red-500/10 text-red-500 transition-transform duration-300 group-hover:scale-110">
                    <FolderTree className="h-12 w-12" />
                  </div>
                )}
              </div>
              <h3 className="font-bold text-gray-300 text-center text-sm md:text-base group-hover:text-white transition-colors">{cat.name}</h3>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
