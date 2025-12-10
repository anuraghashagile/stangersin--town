import React, { useState, useEffect } from 'react';
import { X, Globe, ArrowRight } from 'lucide-react';
import { UserProfile } from '../types';
import { COMMON_INTERESTS } from '../constants';
import { Button } from './Button';
import { clsx } from 'clsx';

interface JoinModalProps {
  onClose: () => void;
  onJoin: (profile: UserProfile) => void;
  initialProfile?: UserProfile | null;
  isEditing?: boolean;
}

export const JoinModal: React.FC<JoinModalProps> = ({ onClose, onJoin, initialProfile, isEditing = false }) => {
  const [name, setName] = useState(initialProfile?.username || '');
  const [gender, setGender] = useState(initialProfile?.gender || 'Male');
  const [age, setAge] = useState(initialProfile?.age || '18-21');
  const [interests, setInterests] = useState<string[]>(initialProfile?.interests || []);
  const [interestInput, setInterestInput] = useState('');

  const toggleInterest = (interest: string) => {
    if (interests.includes(interest)) {
      setInterests(prev => prev.filter(i => i !== interest));
    } else {
      if (interests.length >= 5) return;
      setInterests(prev => [...prev, interest]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const profile = {
      username: name || 'Stranger',
      gender,
      age,
      interests,
      location: 'India (General)' 
    };
    
    // Explicitly save to local storage here as well for immediate persistence
    localStorage.setItem('chat_user_profile', JSON.stringify(profile));
    
    onJoin(profile);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300 font-sans">
      <div className="bg-white dark:bg-[#0A0A0F] rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-200 dark:border-white/10 relative">
        
        {/* Abstract Glow in Modal */}
        <div className="absolute top-[-20%] left-[-20%] w-[50%] h-[50%] bg-brand-500/20 blur-[60px] rounded-full pointer-events-none"></div>

        <div className="p-8 relative z-10">
          <button 
            onClick={onClose}
            className="absolute top-6 right-6 p-2 rounded-full bg-slate-100 dark:bg-white/5 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
          >
            <X size={20} />
          </button>

          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
              {isEditing ? 'Edit Profile' : 'Join Network'}
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
              {isEditing ? 'Update your anonymous persona.' : 'Create your anonymous persona.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Username</label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Type your name"
                className="w-full h-14 px-5 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all placeholder:text-slate-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Gender</label>
                <div className="relative">
                   <select 
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full h-14 px-5 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all appearance-none"
                  >
                    <option>Male</option>
                    <option>Female</option>
                    <option>Non-binary</option>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-50 text-xs">▼</div>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Age</label>
                <div className="relative">
                  <select 
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    className="w-full h-14 px-5 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all appearance-none"
                  >
                    <option>18-21</option>
                    <option>22-25</option>
                    <option>26-30</option>
                    <option>30+</option>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-50 text-xs">▼</div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Interests</label>
              <input 
                 type="text"
                 placeholder="Add interest (Enter)"
                 value={interestInput}
                 onChange={(e) => setInterestInput(e.target.value)}
                 onKeyDown={(e) => {
                   if (e.key === 'Enter') {
                     e.preventDefault();
                     if (interestInput.trim()) {
                       toggleInterest(interestInput.trim());
                       setInterestInput('');
                     }
                   }
                 }}
                 className="w-full h-14 px-5 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all mb-3"
              />
              <div className="flex flex-wrap gap-2">
                {interests.length > 0 ? (
                   interests.map(i => (
                     <button key={i} type="button" onClick={() => toggleInterest(i)} className="px-3 py-1.5 bg-brand-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 hover:bg-brand-600 transition-colors">
                       {i} <X size={12}/>
                     </button>
                   ))
                ) : (
                  <span className="text-xs text-slate-400 italic pl-1">No interests added yet...</span>
                )}
              </div>
               <div className="flex flex-wrap gap-2 mt-2">
                {COMMON_INTERESTS.slice(0, 3).map(interest => (
                  !interests.includes(interest) && (
                    <button
                      key={interest}
                      type="button"
                      onClick={() => toggleInterest(interest)}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
                    >
                      + {interest}
                    </button>
                  )
                ))}
              </div>
            </div>

            <Button 
              type="submit" 
              fullWidth 
              className="h-14 text-lg rounded-2xl bg-white text-black hover:bg-slate-200 shadow-xl mt-4 border-none font-bold"
            >
              {isEditing ? 'Save Changes' : 'Start Chatting'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};