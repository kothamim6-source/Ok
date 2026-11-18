import { useState, useEffect } from 'react';
import { useSearchParams, Navigate } from 'react-router-dom';
import { AdBanner } from '../../components/ui/AdBanner';
import { ExternalLink, ShieldCheck } from 'lucide-react';

export function RedirectPage() {
  const [searchParams] = useSearchParams();
  const targetUrl = searchParams.get('url');
  const timeParam = searchParams.get('t');
  
  // Use the time parameter if provided, otherwise default to 5
  const initialTime = timeParam && !isNaN(parseInt(timeParam)) ? parseInt(timeParam) : 5;
  const [timeLeft, setTimeLeft] = useState(initialTime);
  const [totalTime] = useState(initialTime);

  useEffect(() => {
    if (!targetUrl) return;
    if (timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, targetUrl]);

  if (!targetUrl) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex flex-col items-center justify-center py-8 px-4 gap-8 min-h-[60vh]">
      {/* Top Banner */}
      <div className="w-full flex justify-center">
        <div className="hidden md:block">
          <AdBanner placement="banner728x90" />
        </div>
        <div className="block md:hidden">
          <AdBanner placement="banner320x50" />
        </div>
      </div>

      <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-8 max-w-md w-full text-center shadow-[0_0_40px_rgba(220,38,38,0.05)] flex flex-col items-center relative overflow-hidden">
        {/* Background Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-red-600/10 rounded-full blur-[60px] pointer-events-none"></div>
        
        <div className="relative z-10 w-full flex flex-col items-center">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4 border border-red-500/20">
            <ShieldCheck className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Please Wait...</h1>
          <p className="text-gray-400 mb-8 text-sm">Your secure link is being generated.</p>

          {timeLeft > 0 ? (
            <div className="flex flex-col items-center gap-4 w-full">
              <div className="relative w-24 h-24 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="48" cy="48" r="44" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-gray-800" />
                  <circle 
                    cx="48" cy="48" r="44" 
                    stroke="currentColor" 
                    strokeWidth="4" 
                    fill="transparent" 
                    strokeDasharray={2 * Math.PI * 44}
                    strokeDashoffset={(2 * Math.PI * 44) * (1 - timeLeft / totalTime)}
                    className="text-red-500 transition-all duration-1000 ease-linear" 
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-3xl font-black text-white">
                  {timeLeft}
                </span>
              </div>
              <p className="text-red-400 font-bold mt-2">Wait {timeLeft} seconds</p>
            </div>
          ) : (
            <a
              href={targetUrl}
              target="_self"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-4 rounded-xl font-bold text-white bg-gradient-to-r from-red-600 to-red-500 shadow-[0_0_20px_rgba(220,38,38,0.3)] hover:shadow-[0_0_30px_rgba(220,38,38,0.5)] transition-all transform hover:scale-[1.02]"
            >
              Continue to Link <ExternalLink className="w-5 h-5" />
            </a>
          )}
        </div>
      </div>

      {/* Bottom Square Banner */}
      <div className="w-full flex justify-center mt-4">
        <AdBanner placement="banner300x250" />
      </div>
    </div>
  );
}
