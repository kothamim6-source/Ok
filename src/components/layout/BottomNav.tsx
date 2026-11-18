import { Home as HomeIcon, User, Crown, Flame } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

export function BottomNav() {
  const { user } = useAuthStore();
  
  const navItems = [
    { name: 'Home', path: '/', icon: HomeIcon, color: 'text-red-500' },
    { name: 'Premium', path: '/premium', icon: Crown, color: 'text-amber-400' },
    { name: 'Trending', path: '/trending', icon: Flame, color: 'text-red-500' },
    { name: 'Profile', path: user ? '/profile' : '/login', icon: User, color: 'text-red-500' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#050505] border-t border-neutral-900 pb-2 pt-2 px-4 flex justify-around items-center sm:hidden shadow-[0_-5px_25px_rgba(0,0,0,0.95)]">
      {navItems.map((item) => (
        <NavLink
          key={item.name}
          to={item.path}
          className={({ isActive }) => 
            `flex flex-col items-center justify-center gap-1 py-0.5 px-3 transition-colors ${
              isActive 
                ? item.name === 'Premium' ? 'text-amber-400 font-semibold' : 'text-red-500 font-semibold'
                : item.name === 'Premium' ? 'text-amber-500/80 hover:text-amber-400' : 'text-gray-400 hover:text-gray-200'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <item.icon className={`w-5 h-5 ${isActive ? (item.name === 'Premium' ? 'text-amber-400' : 'text-red-500') : (item.name === 'Premium' ? 'text-amber-500/80' : 'text-gray-400')}`} />
              <span className="text-[10px] tracking-normal leading-none">{item.name}</span>
            </>
          )}
        </NavLink>
      ))}
    </div>
  );
}

