
import React, { useState } from 'react';
import { X, EyeOff } from 'lucide-react';
import { AppSettings } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, 
  onClose, 
  settings, 
  onUpdateSettings 
}) => {
  const [confirmingVanish, setConfirmingVanish] = useState(false);

  if (!isOpen) return null;

  const handleVanishToggle = () => {
    if (!settings.vanishMode) {
      setConfirmingVanish(true);
    } else {
      onUpdateSettings({ ...settings, vanishMode: false });
    }
  };

  const confirmVanish = () => {
    onUpdateSettings({ ...settings, vanishMode: true });
    setConfirmingVanish(false);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#0A0A0F] rounded-2xl shadow-2xl w-full max-w-sm border border-slate-200 dark:border-white/10 relative animate-in zoom-in-95 duration-200 font-sans">
        
        {/* Confirmation Overlay (Positioned to cover content properly) */}
        {confirmingVanish && (
           <div className="absolute inset-0 bg-white dark:bg-[#0A0A0F] z-10 flex flex-col items-center justify-center p-6 text-center animate-in fade-in rounded-2xl">
               <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 text-purple-600 rounded-full flex items-center justify-center mb-4">
                   <EyeOff size={24} />
               </div>
               <h3 className="text-lg font-bold mb-2 text-slate-900 dark:text-white">Enable Vanish Mode?</h3>
               <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                   Messages will automatically disappear for <strong className="text-slate-900 dark:text-white">both users</strong> 10 seconds after being seen.
               </p>
               <div className="flex gap-3 w-full">
                   <button 
                     onClick={() => setConfirmingVanish(false)} 
                     className="flex-1 py-3 rounded-xl font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                   >
                     Cancel
                   </button>
                   <button 
                     onClick={confirmVanish} 
                     className="flex-1 py-3 rounded-xl font-bold bg-purple-600 text-white shadow-lg shadow-purple-500/30 hover:bg-purple-700 transition-colors"
                   >
                     Enable
                   </button>
               </div>
           </div>
        )}

        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-white/5">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Settings</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-6">
          
          {/* Vanish Mode Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-50 dark:bg-purple-900/20 text-purple-500 rounded-lg">
                <EyeOff size={20} />
              </div>
              <div>
                <div className="font-medium text-slate-900 dark:text-white text-sm">Vanish Mode</div>
                <div className="text-xs text-slate-500">Messages auto-delete in 10s</div>
              </div>
            </div>
            <button 
              onClick={handleVanishToggle}
              className={`w-11 h-6 rounded-full transition-colors relative ${settings.vanishMode ? 'bg-purple-500' : 'bg-slate-200 dark:bg-slate-700'}`}
            >
              <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform shadow-sm ${settings.vanishMode ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};