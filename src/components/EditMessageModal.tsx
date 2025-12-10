import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { Button } from './Button';

interface EditMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialText: string;
  onSave: (newText: string) => void;
}

export const EditMessageModal: React.FC<EditMessageModalProps> = ({ 
  isOpen, 
  onClose, 
  initialText, 
  onSave 
}) => {
  const [text, setText] = useState(initialText);

  useEffect(() => {
    setText(initialText);
  }, [initialText, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) {
      onSave(text);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#0A0A0F] rounded-2xl shadow-2xl w-full max-w-sm border border-slate-200 dark:border-white/10 overflow-hidden animate-in zoom-in-95 duration-200 font-sans">
        
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-white/5">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Edit Message</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="relative">
             <textarea 
               value={text}
               onChange={(e) => setText(e.target.value)}
               className="w-full h-32 p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50 resize-none"
               placeholder="Edit your message..."
               autoFocus
             />
          </div>
          
          <div className="flex gap-3">
             <Button 
                type="button" 
                variant="secondary" 
                onClick={onClose}
                className="flex-1 rounded-xl"
             >
                Cancel
             </Button>
             <Button 
                type="submit" 
                className="flex-1 rounded-xl"
                disabled={!text.trim() || text === initialText}
             >
                <Save size={18} /> Save
             </Button>
          </div>
        </form>

      </div>
    </div>
  );
};