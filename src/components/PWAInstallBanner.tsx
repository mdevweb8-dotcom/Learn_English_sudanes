import React, { useState } from 'react';
import { Download, Share, WifiOff, X } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) return null;

  const handleClick = async () => {
    if (isInstallable) {
      await install();
    } else if (isIOS) {
      setShowIOSGuide(true);
    } else {
      setShowIOSGuide(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 transition hover:bg-slate-50"
      >
        <Download className="h-4 w-4 text-[var(--accent-primary)]" />
        <span className="whitespace-nowrap">تثبيت التطبيق</span>
      </button>

      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900">تثبيت Friendly Fluency Hub</h3>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                aria-label="إغلاق"
                className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 space-y-2.5 text-sm leading-relaxed text-slate-700">
              {isIOS ? (
                <>
                  <p>لتثبيت التطبيق على الآيفون والآيباد:</p>
                  <p className="flex items-center gap-2 font-semibold">
                    1) اضغط على أيقونة المشاركة <Share className="h-4 w-4 text-[var(--accent-primary)]" /> في شريط Safari.
                  </p>
                  <p className="font-semibold">2) اختر &ldquo;إضافة إلى الشاشة الرئيسية&rdquo; (Add to Home Screen).</p>
                </>
              ) : (
                <>
                  <p>يمكنك تثبيت التطبيق للعمل بدون إنترنت من متصفح Chrome أو Edge:</p>
                  <p className="font-semibold">افتح قائمة المتصفح (⋮) واختر &ldquo;تثبيت التطبيق&rdquo; أو &ldquo;Install App&rdquo;.</p>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="mt-5 min-h-[44px] w-full rounded-xl bg-[var(--accent-primary)] px-4 py-2.5 text-sm font-bold text-white"
            >
              فهمت
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineStatusNotice: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-900"
    >
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>أنت تعمل الآن في وضع بدون إنترنت — جميع الدروس المحفوظة وتقدمك يعملان بشكل طبيعي.</span>
    </div>
  );
};
