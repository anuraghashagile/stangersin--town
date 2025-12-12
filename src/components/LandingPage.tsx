import React, { useState } from 'react';
import { ArrowRight, Ghost, Shield, Check, AlertCircle, FileText, X, Sun, Moon, Infinity as InfinityIcon } from 'lucide-react';
import { Button } from './Button';
import { clsx } from 'clsx';

interface LandingPageProps {
  onlineCount: number;
  onStart: () => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

const TERMS_TEXT = `By using this app, you confirm that you are 18 years or older and agree that you are solely responsible for your actions and interactions at all times. This platform only provides a technical service that connects anonymous users for casual conversation, and we do not monitor, filter, supervise, or verify any messages, media, or behaviour shared by users. 

You strictly agree not to share, request, or engage in any illegal, harmful, abusive, explicit, sexual, pornographic, or inappropriate content of any kind.`;

export const LandingPage: React.FC<LandingPageProps> = ({ 
  onlineCount, 
  onStart, 
  theme, 
  toggleTheme 
}) => {
  const [showTerms, setShowTerms] = useState(false);

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans text-slate-900 dark:text-white transition-colors duration-300">
      
      {/* Background Ambience */}
      <div className="absolute inset-0 z-0">
         <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-brand-500/10 blur-[100px] rounded-full animate-pulse"></div>
         <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-violet-500/10 blur-[100px] rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      <div className="relative z-10 w-full max-w-lg mx-auto flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-500">
        
        {/* Header / Theme Toggle */}
        <div className="absolute top-0 right-0 p-4">
           {/* Positioned via absolute relative to container, might need adjustment if container isn't full screen in some views, but main view it is centered */}
        </div>

        {/* Logo */}
        <div className="w-24 h-24 bg-gradient-to-br from-brand-400 to-violet-600 rounded-[2rem] shadow-2xl shadow-brand-500/30 flex items-center justify-center mb-8 rotate-3 hover:rotate-6 transition-transform duration-300">
           <Ghost size={48} className="text-white" strokeWidth={1.5} />
        </div>

        {/* Title */}
        <h1 className="text-4xl sm:text-6xl font-black tracking-tighter mb-4 leading-none">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-slate-900 via-slate-700 to-slate-900 dark:from-white dark:via-slate-200 dark:to-slate-400">
            Strangers
          </span>
          <span className="text-brand-500">.</span>
        </h1>

        <p className="text-lg sm:text-xl text-slate-500 dark:text-slate-400 mb-8 max-w-xs sm:max-w-sm font-medium leading-relaxed">
           Connect instantly with random people around the world. Anonymous. Encrypted. Fun.
        </p>

        {/* Online Count Badge */}
        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full mb-10 text-emerald-600 dark:text-emerald-400 text-sm font-bold animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
           <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            {onlineCount.toLocaleString()} people online now
        </div>

        {/* Main Action */}
        <div className="w-full space-y-4 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
          <Button 
            onClick={onStart}
            className="w-full h-16 text-xl rounded-2xl shadow-xl shadow-brand-500/20 hover:shadow-brand-500/40 hover:-translate-y-1"
          >
            Start Chatting <ArrowRight size={24} />
          </Button>

          <button 
             onClick={() => setShowTerms(true)}
             className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 underline decoration-slate-300 dark:decoration-slate-700 underline-offset-4 transition-colors"
          >
            Terms of Service & Safety Guidelines
          </button>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-2 gap-4 w-full mt-12 opacity-80 animate-in fade-in slide-in-from-bottom-10 duration-700 delay-300">
           <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 flex flex-col items-center gap-2">
              <Shield size={24} className="text-slate-400" />
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">No Login Required</span>
           </div>
           <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 flex flex-col items-center gap-2">
              <InfinityIcon size={24} className="text-slate-400" />
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Unlimited Matches</span>
           </div>
        </div>

      </div>

      {/* Footer controls */}
      <div className="absolute top-6 right-6 z-20">
         <button 
            onClick={toggleTheme}
            className="p-3 bg-white/50 dark:bg-white/5 backdrop-blur-md border border-slate-200 dark:border-white/10 rounded-full text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-white/10 transition-all active:scale-90"
         >
            {theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
         </button>
      </div>

      {/* Terms Modal */}
      {showTerms && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="bg-white dark:bg-[#0A0A0F] p-6 sm:p-8 rounded-3xl shadow-2xl max-w-md w-full border border-slate-200 dark:border-white/10 animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between mb-6">
                 <h2 className="text-2xl font-bold flex items-center gap-2">
                    <AlertCircle className="text-brand-500" /> Safety First
                 </h2>
                 <button onClick={() => setShowTerms(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-colors"><X size={20}/></button>
              </div>
              
              <div className="prose prose-sm dark:prose-invert max-h-[50vh] overflow-y-auto mb-6 pr-2">
                 <p className="whitespace-pre-wrap text-slate-600 dark:text-slate-300 leading-relaxed">
                    {TERMS_TEXT}
                 </p>
              </div>

              <Button fullWidth onClick={() => setShowTerms(false)}>
                 <Check size={18} /> I Understand & Agree
              </Button>
           </div>
        </div>
      )}
    </div>
  );
};