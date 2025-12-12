import React from 'react';
import { Users, UserPlus, Globe, ArrowRight, Shield, Zap, MessageCircle } from 'lucide-react';
import { Button } from './Button';

interface LandingPageProps {
  onlineCount: number;
  onStart: () => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ 
  onlineCount, 
  onStart, 
  theme, 
  toggleTheme 
}) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in-95 duration-500 relative overflow-hidden">
      
      {/* Background Decorative Elements */}
      <div className="absolute top-10 left-10 text-brand-500/10 animate-bounce duration-[3000ms] hidden sm:block">
        <MessageCircle size={120} />
      </div>
      <div className="absolute bottom-10 right-10 text-brand-500/10 animate-pulse duration-[4000ms] hidden sm:block">
        <Globe size={140} />
      </div>

      <div className="mb-8 relative">
        <div className="w-24 h-24 bg-brand-100 dark:bg-brand-900/30 rounded-3xl flex items-center justify-center mb-6 mx-auto rotate-3 shadow-xl shadow-brand-500/20 text-brand-600 dark:text-brand-400">
           <Users size={48} />
        </div>
        <h1 className="text-4xl sm:text-6xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">
          Strangers<span className="text-red-500">town</span>
        </h1>
        <p className="text-lg text-slate-500 dark:text-slate-400 font-medium">
          The anonymous social network.
        </p>
      </div>

      <div className="bg-white dark:bg-white/5 p-2 pr-4 rounded-full shadow-sm border border-slate-200 dark:border-white/10 flex items-center gap-3 mb-10 animate-in slide-in-from-bottom-4 duration-700">
        <div className="bg-emerald-500 text-white p-1.5 rounded-full animate-pulse">
          <Globe size={16} />
        </div>
        <span className="text-sm font-bold text-slate-700 dark:text-slate-200 tabular-nums">
          {onlineCount.toLocaleString()} <span className="font-normal opacity-70">people online</span>
        </span>
      </div>

      <div className="flex flex-col gap-4 w-full max-w-xs z-10">
        <Button 
          onClick={onStart} 
          className="w-full h-14 text-lg shadow-xl shadow-brand-500/20 hover:scale-105 transition-transform"
        >
          Start Chatting <ArrowRight size={20} />
        </Button>
        
        <div className="grid grid-cols-2 gap-3 mt-4 text-[10px] uppercase font-bold text-slate-400 tracking-widest">
          <div className="flex flex-col items-center gap-1">
            <Shield size={16} className="mb-1" /> No Login
          </div>
          <div className="flex flex-col items-center gap-1">
            <Zap size={16} className="mb-1" /> Fast Pair
          </div>
        </div>
      </div>

      <div className="mt-16 text-xs text-slate-400 max-w-md leading-relaxed">
        By using Strangerstown, you agree to our Terms. <br/>
        Chat responsibly. 18+ only.
      </div>
    </div>
  );
};