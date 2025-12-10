
import React, { useState } from 'react';
import { Ghost, Moon, Sun, Settings, ArrowLeft, Edit2, AlertTriangle, UserPlus, Check, Heart } from 'lucide-react';
import { ChatMode, UserProfile } from '../types';

interface HeaderProps {
  onlineCount: number;
  mode: ChatMode;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  onDisconnect: () => void;
  partnerProfile: UserProfile | null;
  onOpenSettings: () => void;
  onEditProfile: () => void;
  onAddFriend?: () => void;
  isFriend?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ 
  onlineCount, 
  mode, 
  theme, 
  toggleTheme, 
  onDisconnect, 
  partnerProfile,
  onOpenSettings,
  onEditProfile,
  onAddFriend,
  isFriend = false
}) => {
  const [showConfirmEnd, setShowConfirmEnd] = useState(false);
  const isConnected = mode === ChatMode.CONNECTED;

  const handleDisconnectRequest = () => {
    setShowConfirmEnd(true);
  };

  const confirmDisconnect = () => {
    onDisconnect();
    setShowConfirmEnd(false);
  };

  return (
    <>
      <header className="h-16 border-b border-slate-200 dark:border-white/5 bg-white/90 dark:bg-[#05050A]/90 backdrop-blur-md flex items-center justify-between px-3 sm:px-6 sticky top-0 z-50 transition-colors font-sans shrink-0">
        
        <div className="flex items-center gap-2 sm:gap-3 overflow-hidden flex-1 min-w-0 mr-2">
          {isConnected && (
            <button 
              onClick={handleDisconnectRequest}
              className="sm:hidden p-2 -ml-2 text-slate-500 dark:text-slate-400 shrink-0"
            >
              <ArrowLeft size={20} />
            </button>
          )}

          {isConnected && partnerProfile ? (
            // WhatsApp Style Header (Personal)
            <div className="flex items-center gap-2 sm:gap-3 animate-in fade-in slide-in-from-left-4 duration-300 min-w-0 flex-1">
               <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-brand-400 to-violet-500 flex items-center justify-center text-white font-bold text-sm sm:text-lg shadow-sm shrink-0">
                  {partnerProfile.username[0].toUpperCase()}
               </div>
               <div className="flex flex-col min-w-0 flex-1">
                  <h1 className="font-bold text-slate-900 dark:text-white truncate text-sm sm:text-base leading-tight">
                    {partnerProfile.username}
                  </h1>
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-xs font-medium text-emerald-500 flex items-center gap-1 shrink-0">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                      Online
                    </span>
                    <span className="text-[10px] text-slate-400 truncate hidden xs:inline">
                       {partnerProfile.age} • {partnerProfile.gender}
                    </span>
                  </div>
               </div>
            </div>
          ) : (
            // Default Header
            <div className="flex items-center gap-3">
              <div className="text-brand-500 dark:text-white shrink-0 hidden sm:block">
                 {/* Custom Infinity Loop SVG */}
                 <svg viewBox="0 0 100 100" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round">
                    <path d="M30,50 C30,30 50,30 50,50 C50,70 70,70 70,50 C70,30 50,30 50,50 C50,70 30,70 30,50 Z" />
                 </svg>
              </div>
              <div>
                <h1 className="font-bold text-lg leading-tight tracking-tight">
                   <span className="text-slate-900 dark:text-white">Strangers</span><span className="text-red-500">In</span><span className="text-slate-900 dark:text-white">Town</span>
                </h1>
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest whitespace-nowrap">
                    {onlineCount.toLocaleString()} online
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 sm:gap-3 shrink-0">
          
          {/* Theme Toggle */}
          <button 
            onClick={toggleTheme}
            className="p-2 sm:p-2.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors"
          >
            {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
          </button>

          {/* Logged In Actions */}
          {mode !== ChatMode.IDLE && (
            <>
               {isConnected && onAddFriend && (
                  isFriend ? (
                     <div className="p-2 sm:p-2.5 text-emerald-500 bg-emerald-500/10 rounded-full cursor-default" title="Friends">
                        <Check size={18} strokeWidth={3} />
                     </div>
                  ) : (
                    <button 
                      onClick={onAddFriend}
                      className="p-2 sm:p-2.5 text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-full transition-colors"
                      title="Add Friend"
                    >
                      <UserPlus size={18} />
                    </button>
                  )
               )}
               <button 
                 onClick={onEditProfile}
                 className="p-2 sm:p-2.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors"
                 title="Edit Profile"
               >
                 <Edit2 size={18} />
               </button>
               <button 
                 onClick={onOpenSettings}
                 className="p-2 sm:p-2.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors"
                 title="Settings / Vanish Mode"
               >
                <Ghost size={18} />
               </button>

               {isConnected && (
                 <button 
                  onClick={handleDisconnectRequest}
                  className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 px-3 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-bold transition-colors ml-1"
                >
                  <span className="hidden sm:inline">End Chat</span>
                  <span className="sm:hidden">End</span>
                </button>
               )}
            </>
          )}
        </div>
      </header>

      {/* Confirmation Modal */}
      {showConfirmEnd && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1a1b26] p-6 rounded-3xl shadow-2xl w-full max-w-sm text-center border border-slate-200 dark:border-white/10 animate-in zoom-in-95 duration-200">
             <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
               <AlertTriangle size={24} />
             </div>
             <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">End Chat?</h3>
             <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
               Are you sure you want to end this chat? The connection will be closed.
             </p>
             <div className="flex gap-3">
               <button 
                 onClick={() => setShowConfirmEnd(false)}
                 className="flex-1 py-3 rounded-xl font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
               >
                 Cancel
               </button>
               <button 
                 onClick={confirmDisconnect}
                 className="flex-1 py-3 rounded-xl font-bold bg-red-500 text-white shadow-lg shadow-red-500/30 hover:bg-red-600 transition-colors"
               >
                 End Chat
               </button>
             </div>
          </div>
        </div>
      )}
    </>
  );
};
