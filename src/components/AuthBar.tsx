import { Shield, Sparkles, HardDrive } from 'lucide-react';

interface AuthBarProps {
  user: any;
  loading: boolean;
}

export default function AuthBar({ user, loading }: AuthBarProps) {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo & Name */}
        <div className="flex items-center space-x-3 rtl:space-x-reverse">
          <div className="bg-emerald-600 text-white p-2.5 rounded-xl shadow-xs flex items-center justify-center transition-all duration-300 hover:rotate-6">
            <HardDrive className="h-5 w-5" id="logo-icon" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-xl font-bold font-display text-slate-900 tracking-tight leading-none" id="app-title">
              جردي
            </h1>
            <p className="text-[10px] text-slate-500 font-sans mt-0.5">بحث عن معلومات الجرد و الشلف</p>
          </div>
        </div>

        {/* Local Security Status badge and user greeting */}
        <div className="flex items-center space-x-3 rtl:space-x-reverse">
          <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-100/60 rounded-full text-xs font-semibold">
            <Shield className="h-3.5 w-3.5 text-emerald-600" />
            <span>الوضع المحلي الآمن (بدون إنترنت)</span>
          </div>

          <div className="flex items-center space-x-2 rtl:space-x-reverse">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold text-slate-600">متصل محلياً</span>
          </div>
        </div>
      </div>
    </header>
  );
}
