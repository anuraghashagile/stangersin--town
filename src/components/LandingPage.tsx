

import React, { useState } from 'react';
import { ArrowRight, Ghost, Shield, Check, AlertCircle, FileText, X, Sun, Moon, Infinity } from 'lucide-react';
import { Button } from './Button';
import { clsx } from 'clsx';

interface LandingPageProps {
  onlineCount: number;
  onStart: () => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

const TERMS_TEXT = `By using this app, you confirm that you are 18 years or older and agree that you are solely responsible for your actions and interactions at all times. This platform only provides a technical service that connects anonymous users for casual conversation, and we do not monitor, filter, supervise, or verify any messages, media, or behaviour shared by users. 

You strictly agree not to share, request, or engage in any illegal, harmful, abusive, explicit, sexual, pornographic, or inappropriate content of any kind, and you acknowledge that any attempts to involve minors, encourage sexual conversations with minors, share child-related sexual content, or engage in any form of child exploitation is strictly prohibited, illegal, and will result in an immediate ban and may be reported to law-enforcement authorities as required by law. 

You must not share or request personal or sensitive information such as phone numbers, addresses, emails, financial details, identification documents, or any private data. You agree not to harass, threaten, bully, impersonate, scam, or harm other users in any manner. 

All conversations occur at your own risk, and you understand that we are not responsible for the accuracy, safety, legality, or behaviour of individuals you interact with. By continuing to use the app, you agree that the app, its owners, developers, and operators are not liable for any damages, disputes, harm, losses, or legal consequences arising from user interactions, misuse of the service, illegal behaviour, or violations of these terms. 

Your continued use of this platform signifies full acceptance of these rules and complete responsibility for your conduct within the app.

(Team StrangersInTown)`;

export const LandingPage: React.FC<LandingPageProps> = ({ onlineCount, onStart, theme, toggleTheme }) => {
  const [showTerms, setShowTerms] = useState(false);
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
  const [showWarning, setShowWarning] = useState(false);

  const handleStartClick = () => {
    if (!hasAcceptedTerms) {
      setShowWarning(true);
      setTimeout(() => setShowWarning(false), 2000);
      return;
    }
    onStart();
  };

  const handleAcceptFromModal = () => {
    setHasAcceptedTerms(true);
    setShowTerms(false);
    setShowWarning(false);
  };

  return (
    <div className="min-h-[100dvh] bg-slate-50 dark:bg-[#05050A] flex flex-col relative font-sans selection:bg-violet-500/30 overflow-y-auto transition-colors duration-300">
      
      {/* --- ABSTRACT BEAM BACKGROUND --- */}
      <div className="fixed inset-0 flex items-center justify-center pointer-events-none overflow-hidden z-0">
        {/* Central Glow Core */}
        <div className="absolute w-[800px] h-[200px] bg-brand-500/10 dark:bg-white/5 blur-[120px] rounded-[100%] animate-pulse"></div>
        
        {/* Top Beam */}
        <div className="absolute top-[-20%] w-[150%] h-[60%] bg-gradient-to-b from-violet-200/40 via-violet-100/20 to-transparent dark:from-violet-900/40 dark:via-violet-600/20 dark:to-transparent blur-[80px] rotate-[-5deg] transform translate-y-[-10%] animate-beam"></div>
        
        {/* Bottom Beam */}
        <div className="absolute bottom-[-20%] w-[150%] h-[60%] bg-gradient-to-t from-brand-200/40 via-brand-100/20 to-transparent dark:from-brand-900/40 dark:via-brand-600/20 dark:to-transparent blur-[80px] rotate-[-5deg] transform translate-y-[10%] animate-beam" style={{ animationDelay: '2s' }}></div>
        
        {/* Subtle Noise Texture Overlay */}
        <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay dark:mix-blend-normal" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}></div>
      </div>

      {/* --- NAVBAR --- */}
      <nav className="relative z-10 p-4 sm:p-6 flex justify-between items-center max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-3 group cursor-pointer">
           <div className="bg-white/60 dark:bg-white/10 p-2 rounded-xl backdrop-blur-md border border-slate-200 dark:border-white/5 group-hover:bg-white/80 dark:group-hover:bg-white/20 transition-all shadow-sm text-brand-500 dark:text-white">
             {/* Custom Infinity Loop SVG */}
             <svg viewBox="0 0 100 100" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round">
                <path d="M30,50 C30,30 50,30 50,50 C50,70 70,70 70,50 C70,30 50,30 50,50 C50,70 30,70 30,50 Z" />
             </svg>
           </div>
           <span className="font-bold text-xl sm:text-2xl tracking-tight">
             <span className="text-slate-900 dark:text-white">Strangers</span><span className="text-red-500">In</span><span className="text-slate-900 dark:text-white">Town</span>
           </span>
        </div>
        
        <div className="flex items-center gap-3 sm:gap-4">
           {/* Theme Toggle */}
           <button 
            onClick={toggleTheme}
            className="p-2.5 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10 rounded-full transition-colors"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
           >
            {theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
           </button>

           <div className="px-3 sm:px-4 py-1.5 rounded-full bg-white/60 dark:bg-white/5 border border-slate-200 dark:border-white/10 backdrop-blur-sm text-xs flex items-center gap-2 text-slate-600 dark:text-white/60 font-medium">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="hidden sm:inline">{onlineCount.toLocaleString()} online</span>
              <span className="sm:hidden">{onlineCount.toLocaleString()}</span>
           </div>
        </div>
      </nav>

      {/* --- HERO CONTENT --- */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 text-center w-full">
        
        <div className="space-y-6 sm:space-y-8 max-w-3xl mx-auto animate-in fade-in zoom-in-95 duration-1000">
          
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/60 dark:bg-white/5 border border-slate-200 dark:border-white/10 backdrop-blur-md text-[10px] sm:text-xs font-medium text-violet-600 dark:text-violet-200 mb-2 sm:mb-4 hover:bg-white/80 dark:hover:bg-white/10 transition-colors cursor-default shadow-sm">
            <span className="bg-violet-500 rounded-full w-1.5 h-1.5"></span>
            Anonymous & Secure
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-[1.1] text-slate-900 dark:text-transparent dark:bg-clip-text dark:bg-gradient-to-b dark:from-white dark:via-white dark:to-white/60 pb-2">
            Where Unknown People <br className="hidden sm:block"/> Become Unforgettable.
          </h1>

          <p className="text-base sm:text-xl text-slate-500 dark:text-slate-400 max-w-xl mx-auto leading-relaxed px-4">
            Experience the next generation of anonymous connection. 
            Zero trace. End-to-end encrypted. Pure human interaction.
          </p>

          <div className="flex flex-col items-center gap-6 pt-6 pb-12 w-full px-4">
            
            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 w-full justify-center items-center">
               <Button 
                 onClick={handleStartClick}
                 className={clsx(
                   "h-14 w-full sm:w-auto px-8 text-lg rounded-full shadow-xl dark:shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)] border-none transition-all",
                   showWarning 
                     ? "bg-red-500 text-white animate-pulse" 
                     : "bg-slate-900 dark:bg-white text-white dark:text-black hover:bg-slate-800 dark:hover:bg-slate-200 hover:scale-105"
                 )}
               >
                 {showWarning ? (
                   <span className="flex items-center gap-2"><AlertCircle size={20}/> Accept Terms First</span>
                 ) : (
                   <span className="flex items-center gap-2">Start Chatting <ArrowRight className="w-5 h-5" /></span>
                 )}
               </Button>
               
               <button 
                 onClick={() => setShowTerms(true)}
                 className="h-14 w-full sm:w-auto px-8 text-base rounded-full bg-white/60 dark:bg-white/5 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10 hover:bg-white/80 dark:hover:bg-white/10 transition-all backdrop-blur-sm flex items-center justify-center gap-2 font-medium shadow-sm dark:shadow-none"
               >
                 <FileText size={18} />
                 Read Terms & Conditions
               </button>
            </div>

            {/* Checkbox */}
            <div 
              className={clsx(
                "flex items-center gap-3 cursor-pointer group transition-all p-2 rounded-xl",
                showWarning ? "bg-red-500/10 border border-red-500/30" : "hover:bg-white/20 dark:hover:bg-white/5"
              )}
              onClick={() => {
                setHasAcceptedTerms(!hasAcceptedTerms);
                setShowWarning(false);
              }}
            >
              <div className={clsx(
                "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all",
                hasAcceptedTerms 
                  ? "bg-brand-500 border-brand-500 text-white" 
                  : "border-slate-400 dark:border-slate-600 group-hover:border-slate-600 dark:group-hover:border-slate-400 bg-transparent",
                showWarning && !hasAcceptedTerms && "border-red-500 animate-pulse"
              )}>
                {hasAcceptedTerms && <Check size={14} strokeWidth={4} />}
              </div>
              <span className={clsx(
                "text-sm font-medium select-none",
                showWarning ? "text-red-500 dark:text-red-400" : "text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-300"
              )}>
                I accept the Terms & Conditions
              </span>
            </div>
            
          </div>

        </div>
        
        {/* Bottom Abstract Graphic */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-full max-w-xs h-1 bg-gradient-to-r from-transparent via-slate-300/50 dark:via-white/20 to-transparent rounded-full blur-[1px]"></div>
      </main>

      {/* --- TERMS & CONDITIONS MODAL --- */}
      {showTerms && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-white dark:bg-[#0A0A0F] border border-slate-200 dark:border-white/10 rounded-3xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl relative animate-in zoom-in-95">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 dark:border-white/10 flex items-center justify-between bg-slate-50/50 dark:bg-white/5">
              <div className="flex items-center gap-3">
                <Shield className="text-brand-500" size={24} />
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Terms & Conditions</h2>
              </div>
              <button 
                onClick={() => setShowTerms(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto custom-scrollbar text-slate-600 dark:text-slate-300 leading-relaxed space-y-4 text-sm sm:text-base">
               {TERMS_TEXT.split('\n\n').map((paragraph, idx) => (
                 <p key={idx}>{paragraph}</p>
               ))}
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-white/5 flex flex-col sm:flex-row items-center gap-4 justify-between">
              <div 
                className="flex items-center gap-3 cursor-pointer group"
                onClick={() => setHasAcceptedTerms(!hasAcceptedTerms)}
              >
                 <div className={clsx(
                    "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                    hasAcceptedTerms 
                      ? "bg-brand-500 border-brand-500 text-white" 
                      : "border-slate-400 dark:border-slate-500 group-hover:border-slate-600 dark:group-hover:border-slate-300 bg-transparent"
                  )}>
                    {hasAcceptedTerms && <Check size={12} strokeWidth={4} />}
                  </div>
                  <span className="text-sm font-medium text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-300 select-none">
                    I agree to the Terms & Conditions
                  </span>
              </div>

              <Button 
                onClick={handleAcceptFromModal}
                disabled={!hasAcceptedTerms}
                className="w-full sm:w-auto bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-brand-500/20"
              >
                Accept & Continue
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
