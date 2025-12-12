import React, { useState, useRef } from 'react';
import { Message } from '../types';
import { clsx } from 'clsx';
import { Smile, Pencil, Check, CheckCheck, Reply } from 'lucide-react';

interface MessageBubbleProps {
  message: Message;
  senderName?: string;
  onReact?: (emoji: string) => void;
  onEdit?: (messageId: string, text: string) => void;
  onReply?: (message: Message) => void;
}

const PRESET_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

export const MessageBubble = React.memo<MessageBubbleProps>(({ 
  message, 
  senderName, 
  onReact,
  onEdit,
  onReply
}) => {
  const [showPicker, setShowPicker] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);

  if (message.sender === 'system') {
    return (
      <div className="flex flex-col items-center gap-1 my-6 opacity-75 animate-in fade-in duration-300">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/50 px-3 py-1 rounded-full text-center max-w-[80%]">
          {message.text}
        </span>
      </div>
    );
  }

  const isMe = message.sender === 'me';
  const displayName = isMe ? 'You' : (senderName || 'Stranger');

  // --- SWIPE HANDLERS ---
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - touchStartX.current;
    
    // Only allow swiping right
    if (diff > 0 && diff < 100) {
      setSwipeOffset(diff);
    }
  };

  const handleTouchEnd = () => {
    if (swipeOffset > 50 && onReply) {
      onReply(message);
    }
    setSwipeOffset(0);
    touchStartX.current = null;
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowPicker(true);
  };

  const handleReactionSelect = (emoji: string) => {
    if (onReact) onReact(emoji);
    setShowPicker(false);
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onEdit && message.text) {
      onEdit(message.id, message.text);
    }
  };

  const formatTime = (timestamp: number) => {
    try {
      return new Date(timestamp).toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch (e) {
      return '';
    }
  };

  const entryAnimation = isMe 
    ? "animate-in slide-in-from-right-2 fade-in duration-200 ease-out" 
    : "animate-in slide-in-from-left-2 fade-in duration-200 ease-out";

  return (
    <div 
      className={clsx("flex w-full mb-6 group relative will-change-transform touch-pan-y", isMe ? "justify-end" : "justify-start", entryAnimation)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onDoubleClick={() => onReply && onReply(message)}
      style={{ transform: `translateX(${swipeOffset}px)`, transition: swipeOffset === 0 ? 'transform 0.2s ease-out' : 'none' }}
    >
      {/* Swipe Reply Icon Indicator */}
      <div className={clsx("absolute left-[-40px] top-1/2 -translate-y-1/2 text-slate-400 transition-opacity duration-200", swipeOffset > 20 ? "opacity-100" : "opacity-0")}>
         <Reply size={24} />
      </div>

      {/* Fixed Overlay Reaction Picker */}
      {showPicker && (
        <>
          <div 
            className="fixed inset-0 z-[90] bg-black/5 backdrop-blur-[1px] transition-opacity duration-200" 
            onClick={() => setShowPicker(false)}
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] bg-white dark:bg-[#1a1b26] p-4 rounded-3xl shadow-2xl border border-slate-200 dark:border-white/10 flex gap-3 animate-in zoom-in-95 duration-200 ease-out flex-wrap justify-center max-w-[90vw]">
             {PRESET_REACTIONS.map(emoji => (
               <button
                 key={emoji}
                 onClick={() => handleReactionSelect(emoji)}
                 className="w-10 h-10 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-white/10 rounded-full text-2xl transition-transform duration-150 active:scale-90 hover:scale-110"
               >
                 {emoji}
               </button>
             ))}
             {isMe && message.type === 'text' && onEdit && (
                <button
                  onClick={(e) => { handleEditClick(e); setShowPicker(false); }}
                  className="w-10 h-10 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-white/10 rounded-full text-slate-500 border-l border-slate-200 dark:border-white/10 pl-4 ml-2 transition-transform duration-150 active:scale-90"
                >
                  <Pencil size={18} />
                </button>
             )}
             <button
                onClick={() => { if(onReply) onReply(message); setShowPicker(false); }}
                className="w-10 h-10 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-white/10 rounded-full text-slate-500 border-l border-slate-200 dark:border-white/10 pl-4 ml-2 transition-transform duration-150 active:scale-90"
             >
                <Reply size={18} />
             </button>
          </div>
        </>
      )}

      <div className={clsx("flex flex-col max-w-[85%] sm:max-w-[70%]", isMe ? "items-end" : "items-start")}>
        <div className="text-[10px] text-slate-400 mb-1 px-1 font-medium uppercase tracking-wide">
            {displayName}
        </div>
        
        <div className="relative group/bubble">
          {/* Edit/Reply Buttons (Desktop Hover) */}
          <div className={clsx("absolute top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover/bubble:opacity-100 transition-all duration-200 hidden sm:flex", isMe ? "-left-20" : "-right-20")}>
             {isMe && message.type === 'text' && onEdit && (
                <button onClick={handleEditClick} className="p-1.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/20 active:scale-90"><Pencil size={12} /></button>
             )}
             {onReply && (
                <button onClick={() => onReply(message)} className="p-1.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/20 active:scale-90"><Reply size={12} /></button>
             )}
          </div>

          <div 
            ref={bubbleRef}
            onContextMenu={handleContextMenu}
            className={clsx(
              "rounded-2xl shadow-sm relative transition-all duration-150 ease-out overflow-visible select-none active:scale-[0.98]",
              isMe 
                ? "bg-brand-50 dark:bg-brand-600 text-slate-900 dark:text-white rounded-tr-none border border-brand-100 dark:border-brand-500" 
                : "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-tl-none border border-slate-200 dark:border-slate-700"
            )}
          >
            {/* QUOTE SECTION */}
            {message.replyTo && (
              <div className={clsx(
                "mx-1 mt-1 mb-1 px-3 py-2 rounded-xl text-xs border-l-4 opacity-90 truncate max-w-[200px] sm:max-w-[300px]",
                isMe 
                  ? "bg-brand-100 dark:bg-brand-800 border-brand-400 dark:border-brand-300 text-brand-900 dark:text-brand-100" 
                  : "bg-slate-200 dark:bg-slate-700 border-brand-500 text-slate-700 dark:text-slate-200"
              )}>
                 <div className="font-bold mb-0.5">{message.replyTo.senderName}</div>
                 <div className="truncate">{message.replyTo.text}</div>
              </div>
            )}

            {message.type === 'text' && (
              <div className={clsx("px-5 py-3 leading-relaxed break-words whitespace-pre-wrap relative text-[15px]")}>
                {message.text}
                {message.isEdited && (
                  <span className="text-[10px] text-slate-400 dark:text-slate-300 italic ml-2 opacity-70">
                    (edited)
                  </span>
                )}
              </div>
            )}

            {message.type === 'image' && message.fileData && (
              <div className="p-1">
                <img 
                  src={message.fileData} 
                  alt="Attachment" 
                  className="max-w-full rounded-xl max-h-[300px] object-cover"
                />
              </div>
            )}

            {message.type === 'audio' && message.fileData && (
              <div className="px-3 py-2 flex items-center gap-2 min-w-[200px]">
                <audio controls src={message.fileData} className="w-full h-8 max-w-[250px]" />
              </div>
            )}

            {/* Reactions Display */}
            {message.reactions && message.reactions.length > 0 && (
              <div className={clsx(
                "absolute -bottom-4 flex gap-1",
                isMe ? "right-0" : "left-0"
              )}>
                  {message.reactions.map((r, idx) => (
                    <div key={idx} className="bg-white dark:bg-slate-700 shadow-sm border border-slate-100 dark:border-white/5 rounded-full px-1.5 py-0.5 text-[10px] animate-in zoom-in spin-in-12 duration-300">
                      {r.emoji}
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
        
        {/* Actions (Only for stranger messages on mobile, visualized for demo) */}
        {!isMe && (
           <div className="flex gap-2 mt-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-200 px-1">
              <button 
                onClick={() => setShowPicker(!showPicker)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors active:scale-90"
              >
                <Smile size={14}/>
              </button>
           </div>
        )}
        
        <div className="text-[10px] text-slate-300 dark:text-slate-600 mt-1 px-1 flex items-center gap-1 justify-end">
            {formatTime(message.timestamp)}
            {isMe && (
              <>
                 {/* Seen Status */}
                 {message.status === 'seen' && <CheckCheck size={14} className="text-red-500 transition-all duration-300" strokeWidth={2} />}
                 {message.status !== 'seen' && <Check size={14} className="text-slate-400 dark:text-slate-500" strokeWidth={2} />}
              </>
            )}
        </div>
      </div>
    </div>
  );
});

MessageBubble.displayName = 'MessageBubble';