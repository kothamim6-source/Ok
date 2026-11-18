import React, { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

export function AdultWarningModal() {
  const [show, setShow] = useState(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return !localStorage.getItem('adult_warning_accepted');
      }
    } catch {}
    return false;
  });
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);

  useEffect(() => {
    const handleOpen = () => {
      setShow(true);
      setIsAnimatingOut(false);
    };
    window.addEventListener('open_adult_warning', handleOpen);
    return () => window.removeEventListener('open_adult_warning', handleOpen);
  }, []);

  useEffect(() => {
    if (show) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
  }, [show]);

  const handleAccept = () => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('adult_warning_accepted', 'true');
        window.dispatchEvent(new Event('adult_warning_accepted'));
      }
    } catch {}
    setIsAnimatingOut(true);
    setTimeout(() => {
      setShow(false);
      document.body.style.overflow = 'auto';
    }, 500);
  };

  const handleReject = () => {
    window.location.href = 'https://google.com';
  };

  if (!show) return null;

  return (
    <div className={`fixed inset-0 z-[99999] flex items-center justify-center p-4 backdrop-blur-xl bg-black/90 transition-opacity duration-500 ${isAnimatingOut ? 'opacity-0' : 'opacity-100'}`}>
      <div className={`w-full max-w-md bg-black/80 border-2 border-red-600/50 rounded-3xl p-8 shadow-[0_0_50px_rgba(220,38,38,0.2)] text-center transition-transform duration-500 ${isAnimatingOut ? 'scale-95' : 'scale-100'}`}>
        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/20">
          <AlertTriangle className="w-10 h-10 text-red-500" />
        </div>
        
        <h2 className="text-3xl font-black text-white mb-4">🔞 বয়স যাচাই</h2>
        <div className="space-y-4 text-gray-300 mb-8">
          <p className="text-lg">
            সতর্কীকরণ: এই ওয়েবসাইটের কনটেন্ট শুধুমাত্র প্রাপ্তবয়স্কদের (১৮+) জন্য।
          </p>
          <p className="text-sm text-gray-400">
            এই ওয়েবসাইটে প্রবেশ করার জন্য আপনার বয়স অবশ্যই ১৮ বছর বা তার বেশি হতে হবে। আপনার বয়স কি ১৮ বছর বা তার বেশি?
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={handleAccept}
            className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold py-4 px-6 rounded-xl transition-all shadow-lg shadow-red-600/20 hover:scale-[1.02]"
          >
            হ্যাঁ, আমার বয়স ১৮+
          </button>
          
          <button
            onClick={handleReject}
            className="w-full bg-white/5 hover:bg-white/10 text-gray-300 font-medium py-4 px-6 rounded-xl transition-all border border-white/10"
          >
            না, আমি প্রস্থান করতে চাই
          </button>
        </div>
      </div>
    </div>
  );
}
