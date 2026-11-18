import { ShieldAlert, ShieldCheck, Crown, User as UserIcon } from 'lucide-react';

interface UserBadgeProps {
  role?: string;
  isVIP?: boolean;
}

export function UserBadge({ role, isVIP }: UserBadgeProps) {
  const isModOrAdmin = role === 'admin' || role === 'moderator';

  return (
    <div className="inline-flex items-center gap-1.5 ml-2">
      {role === 'admin' && (
        <span className="inline-flex items-center gap-1.5 bg-red-500/10 border border-red-500/30 px-3 py-0.5 rounded-full select-none shadow-[inset_0_0_8px_rgba(239,68,68,0.1),0_0_10px_rgba(239,68,68,0.2)] backdrop-blur-sm">
          <ShieldAlert className="w-3 h-3 text-red-400 drop-shadow-[0_0_3px_rgba(248,113,113,0.8)]" />
          <span className="text-[10px] font-black tracking-[0.15em] text-red-400 uppercase drop-shadow-[0_0_3px_rgba(248,113,113,0.8)]">
            Admin
          </span>
        </span>
      )}

      {role === 'moderator' && (
        <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 px-3 py-0.5 rounded-full select-none shadow-[inset_0_0_8px_rgba(16,185,129,0.1),0_0_10px_rgba(16,185,129,0.2)] backdrop-blur-sm">
          <ShieldCheck className="w-3 h-3 text-emerald-400 drop-shadow-[0_0_3px_rgba(52,211,153,0.8)]" />
          <span className="text-[10px] font-black tracking-[0.15em] text-emerald-400 uppercase drop-shadow-[0_0_3px_rgba(52,211,153,0.8)]">
            Mod
          </span>
        </span>
      )}

      {!isModOrAdmin && (
        isVIP ? (
          <span title="Premium VIP" className="inline-flex items-center gap-1.5 bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-amber-500/20 border border-amber-400/60 px-3 py-0.5 rounded-full select-none shadow-[inset_0_0_8px_rgba(234,179,8,0.25),0_0_15px_rgba(234,179,8,0.3)] backdrop-blur-sm relative overflow-hidden group">
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-300/30 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-in-out" />
            <Crown className="w-3 h-3 text-amber-300 drop-shadow-[0_0_4px_rgba(250,204,21,0.9)] relative z-10 fill-amber-400/40" />
            <span className="text-[10px] font-black tracking-[0.15em] text-amber-300 uppercase drop-shadow-[0_0_4px_rgba(250,204,21,0.9)] relative z-10">
              VIP
            </span>
          </span>
        ) : (
          (!role || role === 'user') && (
            <span className="inline-flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/30 px-3 py-0.5 rounded-full select-none shadow-[inset_0_0_8px_rgba(59,130,246,0.1),0_0_10px_rgba(59,130,246,0.15)] backdrop-blur-sm">
              <UserIcon className="w-3 h-3 text-blue-400 drop-shadow-[0_0_2px_rgba(96,165,250,0.8)]" />
              <span className="text-[10px] font-black tracking-[0.15em] text-blue-400 uppercase drop-shadow-[0_0_2px_rgba(96,165,250,0.8)]">
                User
              </span>
            </span>
          )
        )
      )}
    </div>
  );
}
