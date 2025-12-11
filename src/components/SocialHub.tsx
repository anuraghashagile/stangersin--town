import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Users, History, Globe, MessageCircle, X, Wifi, Heart, ArrowLeft, Send, UserPlus, Check, Trash2, Image as ImageIcon, Mic, Square, MapPin, Smile, Clock, Search } from 'lucide-react';
import { UserProfile, PresenceState, RecentPeer, Message, ChatMode, SessionType, Friend, FriendRequest, DirectMessageEvent, DirectStatusEvent } from '../types';
import { clsx } from 'clsx';
import { MessageBubble } from './MessageBubble';
import { Button } from './Button';

interface SocialHubProps {
  onlineUsers: PresenceState[];
  onCallPeer: (peerId: string, profile?: UserProfile) => void;
  globalMessages: Message[];
  sendGlobalMessage: (text: string) => void;
  myProfile: UserProfile | null;
  myPeerId?: string | null;
  privateMessages: Message[]; 
  sendPrivateMessage: (text: string) => void; 
  sendDirectMessage?: (peerId: string, text: string, id?: string) => void; 
  sendDirectImage?: (peerId: string, base64: string, id?: string) => void;
  sendDirectAudio?: (peerId: string, base64: string, id?: string) => void;
  sendDirectTyping?: (peerId: string, isTyping: boolean) => void;
  sendDirectFriendRequest?: (peerId: string) => void; 
  sendDirectReaction?: (peerId: string, messageId: string, emoji: string) => void;
  sendReaction?: (messageId: string, emoji: string) => void;
  currentPartner: UserProfile | null;
  chatStatus: ChatMode;
  error?: string | null;
  onEditMessage?: (id: string, text: string) => void;
  sessionType: SessionType;
  incomingReaction?: { peerId: string, messageId: string, emoji: string, sender: 'stranger' } | null;
  incomingDirectMessage?: DirectMessageEvent | null;
  incomingDirectStatus?: DirectStatusEvent | null;
  onCloseDirectChat?: () => void;
  friends?: Friend[];
  friendRequests?: FriendRequest[];
  removeFriend?: (peerId: string) => void;
  acceptFriendRequest?: (request: FriendRequest) => void;
  rejectFriendRequest?: (peerId: string) => void;
  isPeerConnected?: (peerId: string) => boolean;
}

export const SocialHub = React.memo<SocialHubProps>(({ 
  onlineUsers, 
  onCallPeer,
  globalMessages,
  sendGlobalMessage,
  myProfile,
  myPeerId,
  privateMessages,
  sendPrivateMessage,
  sendDirectMessage,
  sendDirectImage,
  sendDirectAudio,
  sendDirectTyping,
  sendDirectFriendRequest,
  sendDirectReaction,
  sendReaction,
  currentPartner,
  chatStatus,
  error,
  onEditMessage,
  sessionType,
  incomingReaction,
  incomingDirectMessage,
  incomingDirectStatus,
  onCloseDirectChat,
  friends: friendsProp = [],
  friendRequests = [],
  removeFriend,
  acceptFriendRequest,
  rejectFriendRequest,
  isPeerConnected
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'online' | 'recent' | 'global' | 'friends'>('online');
  const [recentPeers, setRecentPeers] = useState<RecentPeer[]>([]);
  const [friends, setFriends] = useState<Friend[]>(friendsProp);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState('');
  
  const [globalInput, setGlobalInput] = useState('');
  const [privateInput, setPrivateInput] = useState('');
  const [isRecordingPrivate, setIsRecordingPrivate] = useState(false);
  
  const [activePeer, setActivePeer] = useState<{id: string, profile: UserProfile} | null>(null);
  const [localChatHistory, setLocalChatHistory] = useState<Message[]>([]);
  const [peerTypingStatus, setPeerTypingStatus] = useState<Record<string, boolean>>({});
  const [viewingProfile, setViewingProfile] = useState<{id: string, profile: UserProfile} | null>(null);
  const [confirmRemoveFriend, setConfirmRemoveFriend] = useState<string | null>(null);
  const [triggerTarget, setTriggerTarget] = useState<HTMLElement | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const privateMessagesEndRef = useRef<HTMLDivElement>(null);
  const privateFileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const checkAnchor = () => {
       const el = document.getElementById('social-hub-trigger-anchor');
       if (el !== triggerTarget) setTriggerTarget(el);
    };
    checkAnchor();
    const interval = setInterval(checkAnchor, 500);
    return () => clearInterval(interval);
  }, [triggerTarget, chatStatus]);

  useEffect(() => { setFriends(friendsProp); }, [friendsProp]);

  // Reset search when changing tabs
  useEffect(() => {
    setSearchQuery('');
  }, [activeTab]);

  useEffect(() => {
    const storedActive = localStorage.getItem('active_social_peer');
    if (storedActive) {
      try {
        const parsed = JSON.parse(storedActive);
        if (parsed?.id && parsed?.profile) {
          setActivePeer(parsed);
          setIsOpen(true);
          onCallPeer(parsed.id, parsed.profile);
        }
      } catch (e) {}
    }
    try {
      const storedRecents = localStorage.getItem('recent_peers');
      if (storedRecents) setRecentPeers(JSON.parse(storedRecents));
      const storedFriends = localStorage.getItem('chat_friends');
      if (storedFriends) setFriends(JSON.parse(storedFriends));
    } catch(e) {}
  }, []);

  useEffect(() => {
    if (activePeer) localStorage.setItem('active_social_peer', JSON.stringify(activePeer));
    else localStorage.removeItem('active_social_peer');
  }, [activePeer]);

  useEffect(() => {
    const storedRecents = localStorage.getItem('recent_peers');
    if (storedRecents) try { setRecentPeers(JSON.parse(storedRecents)); } catch (e) {}
  }, [isOpen, activeTab, incomingDirectMessage]);

  useEffect(() => {
    if (activePeer) {
      const storageKey = `chat_history_${activePeer.id}`;
      const savedParams = localStorage.getItem(storageKey);
      try { setLocalChatHistory(savedParams ? JSON.parse(savedParams) : []); } catch (e) { setLocalChatHistory([]); }
      setUnreadCounts(prev => { const n = { ...prev }; delete n[activePeer.id]; return n; });
    }
  }, [activePeer]);

  useEffect(() => {
    if (incomingDirectMessage) {
      const { peerId, message } = incomingDirectMessage;
      const storageKey = `chat_history_${peerId}`;
      const existingHistory = localStorage.getItem(storageKey);
      let history: Message[] = existingHistory ? JSON.parse(existingHistory) : [];
      if (!history.some(m => m.id === message.id)) {
        history.push(message);
        localStorage.setItem(storageKey, JSON.stringify(history));
        if (activePeer?.id === peerId) setLocalChatHistory(history);
        else setUnreadCounts(prev => ({ ...prev, [peerId]: (prev[peerId] || 0) + 1 }));
      }
    }
  }, [incomingDirectMessage, activePeer]);

  useEffect(() => {
    if (incomingReaction) {
      const targetPeerId = incomingReaction.peerId;
      if (activePeer && activePeer.id === targetPeerId) {
         setLocalChatHistory(prev => {
            const updated = prev.map(msg => {
               if (msg.id === incomingReaction.messageId) {
                 if (msg.reactions?.some(r => r.emoji === incomingReaction.emoji && r.sender === 'stranger')) return msg;
                 return { ...msg, reactions: [...(msg.reactions || []), { emoji: incomingReaction.emoji, sender: 'stranger' as const }] };
               }
               return msg;
            });
            localStorage.setItem(`chat_history_${targetPeerId}`, JSON.stringify(updated));
            return updated;
         });
      } else {
         const storageKey = `chat_history_${targetPeerId}`;
         try {
            const hist = JSON.parse(localStorage.getItem(storageKey) || '[]');
            const updated = hist.map((msg: Message) => {
               if (msg.id === incomingReaction.messageId) {
                  if (msg.reactions?.some((r: any) => r.emoji === incomingReaction.emoji && r.sender === 'stranger')) return msg;
                  return { ...msg, reactions: [...(msg.reactions || []), { emoji: incomingReaction.emoji, sender: 'stranger' as const }] };
               }
               return msg;
            });
            localStorage.setItem(storageKey, JSON.stringify(updated));
         } catch(e) {}
      }
    }
  }, [incomingReaction, activePeer]);

  useEffect(() => {
    if (incomingDirectStatus?.type === 'typing') setPeerTypingStatus(prev => ({ ...prev, [incomingDirectStatus.peerId]: incomingDirectStatus.value }));
  }, [incomingDirectStatus]);

  useEffect(() => {
    if (activeTab === 'global' && isOpen && !activePeer) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [globalMessages, activeTab, isOpen, activePeer]);

  useEffect(() => {
    if (activePeer && isOpen) privateMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [localChatHistory, activePeer, isOpen, peerTypingStatus]);

  const handleGlobalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (globalInput.trim()) {
      sendGlobalMessage(globalInput);
      setGlobalInput('');
    }
  };

  const addMessageToLocal = (msg: Message, peerId: string) => {
      const storageKey = `chat_history_${peerId}`;
      let history: Message[] = [];
      try { history = JSON.parse(localStorage.getItem(storageKey) || '[]'); } catch(e){}
      history.push(msg);
      try { localStorage.setItem(storageKey, JSON.stringify(history)); } catch(e){}
      if (activePeer?.id === peerId) setLocalChatHistory(history);
  };

  const handlePrivateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (privateInput.trim() && activePeer) {
      const newMsgId = Date.now().toString() + Math.random().toString(36).substring(2);
      const newMsg: Message = { id: newMsgId, text: privateInput, sender: 'me', timestamp: Date.now(), type: 'text', reactions: [], status: 'sent' };
      addMessageToLocal(newMsg, activePeer.id);
      sendDirectMessage?.(activePeer.id, privateInput, newMsgId);
      sendDirectTyping?.(activePeer.id, false);
      setPrivateInput('');
    }
  };

  const handlePrivateTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPrivateInput(e.target.value);
    if (activePeer && sendDirectTyping) {
       sendDirectTyping(activePeer.id, true);
       if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
       typingTimeoutRef.current = setTimeout(() => { if (activePeer) sendDirectTyping(activePeer.id, false); }, 1000);
    }
  };

  const handlePrivateImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && activePeer && sendDirectImage) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        const newMsgId = Date.now().toString() + Math.random().toString(36).substring(2);
        const newMsg: Message = { id: newMsgId, fileData: base64, type: 'image', sender: 'me', timestamp: Date.now(), reactions: [], status: 'sent' };
        addMessageToLocal(newMsg, activePeer.id);
        sendDirectImage(activePeer.id, base64, newMsgId);
      };
      reader.readAsDataURL(file);
    }
    if (privateFileInputRef.current) privateFileInputRef.current.value = '';
  };

  const startPrivateRecording = async () => {
    if (!activePeer) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (event) => { if (event.data.size > 0) audioChunksRef.current.push(event.data); };
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
           const base64Audio = reader.result as string;
           const newMsgId = Date.now().toString() + Math.random().toString(36).substring(2);
           const newMsg: Message = { id: newMsgId, fileData: base64Audio, type: 'audio', sender: 'me', timestamp: Date.now(), reactions: [], status: 'sent' };
           if (activePeer) {
             addMessageToLocal(newMsg, activePeer.id);
             sendDirectAudio?.(activePeer.id, base64Audio, newMsgId);
           }
        };
        stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorder.start();
      setIsRecordingPrivate(true);
    } catch (err) { console.error("Mic error", err); }
  };

  const stopPrivateRecording = () => {
    if (mediaRecorderRef.current && isRecordingPrivate) {
      mediaRecorderRef.current.stop();
      setIsRecordingPrivate(false);
    }
  };

  const handleReactionSend = (messageId: string, emoji: string) => {
    if (activePeer) {
      setLocalChatHistory(prev => {
         const updated = prev.map(msg => msg.id === messageId ? { ...msg, reactions: [...(msg.reactions || []), { emoji, sender: 'me' as const }] } : msg);
         localStorage.setItem(`chat_history_${activePeer.id}`, JSON.stringify(updated));
         return updated;
      });
      sendDirectReaction?.(activePeer.id, messageId, emoji);
    } else {
      sendReaction?.(messageId, emoji);
    }
  };

  const openPrivateChat = (peerId: string, profile?: UserProfile) => {
    if (profile) {
      setActivePeer({ id: peerId, profile });
      onCallPeer(peerId, profile);
      setUnreadCounts(prev => { const n = { ...prev }; delete n[peerId]; return n; });
      setViewingProfile(null);
    }
  };

  const closePrivateChat = () => {
    setActivePeer(null);
    onCloseDirectChat?.();
  };

  const handleFriendRequest = (peerId: string) => {
     sendDirectFriendRequest?.(peerId);
     setViewingProfile(null);
  };

  const confirmRemove = () => {
    if (confirmRemoveFriend && removeFriend) {
       removeFriend(confirmRemoveFriend);
       setConfirmRemoveFriend(null);
    }
  };

  // Helper to resolve current ID (Peer IDs change per session, UID is stable)
  const resolveCurrentPeerId = (friend: Friend) => {
     if (friend.profile.uid) {
        const online = onlineUsers.find(u => u.profile?.uid === friend.profile.uid);
        if (online) return online.peerId;
     }
     // Fallback to searching by ID (legacy) or just return the last known ID
     const onlineLegacy = onlineUsers.find(u => u.peerId === friend.id);
     if (onlineLegacy) return friend.id;
     
     return null; // Offline
  };

  const isFriend = (peerId: string) => friends.some(f => f.id === peerId);
  
  const formatLastSeen = (timestamp?: number) => {
     if (!timestamp) return 'Offline';
     const diff = Date.now() - timestamp;
     if (diff < 60000) return 'Just now';
     if (diff < 3600000) return `${Math.floor(diff/60000)}m ago`;
     if (diff < 86400000) return `${Math.floor(diff/3600000)}h ago`;
     return new Date(timestamp).toLocaleDateString();
  };

  const getTotalUnreadCount = () => {
     return Object.values(unreadCounts).reduce((a, b) => a + b, 0) + friendRequests.length;
  };

  // --- Filtering Logic ---
  const filteredFriendsList = friends.filter(f => 
    !searchQuery || f.profile.username.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  // Revised Online/Offline Split using stable UIDs
  const onlineFriends = filteredFriendsList.filter(f => resolveCurrentPeerId(f) !== null);
  const offlineFriends = filteredFriendsList.filter(f => resolveCurrentPeerId(f) === null);
  
  const filteredFriendRequests = friendRequests.filter(req => 
    !searchQuery || req.profile.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredOnlineUsers = onlineUsers.filter(u => 
    !searchQuery || (u.profile?.username || 'Anonymous').toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const filteredRecentPeers = recentPeers.filter(p =>
    !searchQuery || p.profile.username.toLowerCase().includes(searchQuery.toLowerCase())
  );


  const TriggerButton = (
    <button 
      onClick={() => setIsOpen(true)}
      aria-label="Open Social Hub"
      className={clsx(
        "z-[60] w-12 h-12 bg-brand-500 hover:bg-brand-600 text-white rounded-full shadow-2xl shadow-brand-500/40 transition-all duration-200 active:scale-90 hover:scale-105 flex items-center justify-center border-2 border-slate-50 dark:border-slate-900 relative pointer-events-auto",
        !triggerTarget && "fixed bottom-24 right-5 sm:bottom-10 sm:right-10 w-14 h-14" 
      )}
    >
      <Users size={triggerTarget ? 22 : 26} strokeWidth={2.5} />
      {getTotalUnreadCount() > 0 && (
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center text-[10px] font-bold animate-pulse shadow-sm">
          {getTotalUnreadCount() > 9 ? '9+' : getTotalUnreadCount()}
        </span>
      )}
    </button>
  );

  const DrawerOverlay = (
    <>
       {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-end sm:p-6 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-[#0A0A0F] w-full sm:w-[400px] h-[100dvh] sm:h-[650px] rounded-none sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border-l sm:border border-slate-200 dark:border-white/10 animate-in slide-in-from-bottom-10 sm:slide-in-from-right-10 duration-300 relative font-sans will-change-transform">
            
            {/* --- HEADER --- */}
            <div className="p-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-white/80 dark:bg-white/5 backdrop-blur-md shrink-0 relative z-10">
              {activePeer ? (
                <div className="flex items-center gap-3">
                   <button onClick={closePrivateChat} className="p-2 -ml-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-all duration-150 active:scale-90">
                     <ArrowLeft size={20} className="text-slate-500 dark:text-slate-200" />
                   </button>
                   <div>
                     <h2 className="font-bold text-lg text-slate-900 dark:text-white leading-tight">
                       {activePeer.profile.username}
                     </h2>
                     <div className="flex items-center gap-1.5">
                       {onlineUsers.some(u => u.peerId === activePeer.id) ? (
                          <span className="text-xs text-emerald-500 font-medium flex items-center gap-1"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"/> Online</span>
                       ) : (
                          <span className="text-xs text-slate-400 font-medium">Last seen {formatLastSeen(friends.find(f => f.id === activePeer.id)?.lastSeen)}</span>
                       )}
                     </div>
                   </div>
                </div>
              ) : (
                <h2 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">Global Meet</h2>
              )}
              <div className="flex items-center gap-1">
                {activePeer && isFriend(activePeer.id) && (
                   <button onClick={() => setConfirmRemoveFriend(activePeer.id)} className="p-2 text-slate-400 hover:text-red-500 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-all duration-150 active:scale-90" title="Remove Friend"><Trash2 size={18} /></button>
                )}
                <button onClick={() => setIsOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-all duration-150 active:scale-90"><X size={20} /></button>
              </div>
            </div>
            
            {/* --- REMOVE CONFIRMATION --- */}
            {confirmRemoveFriend && (
               <div className="absolute inset-0 z-[110] bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200">
                  <div className="bg-white dark:bg-[#1a1b26] p-6 rounded-2xl w-full max-w-sm text-center border border-slate-200 dark:border-white/10 shadow-2xl animate-in zoom-in-95 duration-200">
                     <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                       <Trash2 size={24} />
                     </div>
                     <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Remove Friend?</h3>
                     <p className="text-sm text-slate-500 mb-6">Are you sure you want to remove this user from your friends list?</p>
                     <div className="flex gap-3">
                        <Button variant="secondary" fullWidth onClick={() => setConfirmRemoveFriend(null)}>Cancel</Button>
                        <Button fullWidth onClick={confirmRemove} className="bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/20">Remove</Button>
                     </div>
                  </div>
               </div>
            )}

            {/* --- PROFILE VIEWER --- */}
            {viewingProfile && (
               <div className="absolute inset-0 z-[110] bg-white dark:bg-[#0A0A0F] flex flex-col animate-in slide-in-from-bottom duration-300">
                  <div className="p-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between shrink-0">
                     <h3 className="font-bold text-lg text-slate-900 dark:text-white">Profile</h3>
                     <button onClick={() => setViewingProfile(null)} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/5 transition-all duration-150 active:scale-90"><X size={20} className="text-slate-500" /></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center">
                      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-brand-400 to-violet-500 flex items-center justify-center text-white text-4xl font-bold shadow-2xl mb-4">{viewingProfile.profile.username[0].toUpperCase()}</div>
                      <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">{viewingProfile.profile.username}</h2>
                      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm mb-6"><span>{viewingProfile.profile.age} years</span><span>•</span><span>{viewingProfile.profile.gender}</span></div>
                      <div className="w-full space-y-4">
                         <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border border-slate-100 dark:border-white/5">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><MapPin size={12}/> Location</h4>
                            <p className="text-slate-900 dark:text-white font-medium">{viewingProfile.profile.location || 'Unknown'}</p>
                         </div>
                         <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border border-slate-100 dark:border-white/5">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Smile size={12}/> Interests</h4>
                            <div className="flex flex-wrap gap-2">{viewingProfile.profile.interests.map(int => (<span key={int} className="px-3 py-1 bg-white dark:bg-white/10 rounded-full text-xs font-medium text-slate-700 dark:text-slate-300 shadow-sm border border-slate-200 dark:border-white/5">{int}</span>))}</div>
                         </div>
                      </div>
                  </div>
                  <div className="p-6 border-t border-slate-100 dark:border-white/5 shrink-0 flex flex-col gap-3 bg-white/50 dark:bg-white/5 backdrop-blur-md">
                      <Button fullWidth onClick={() => openPrivateChat(viewingProfile.id, viewingProfile.profile)}><MessageCircle size={18}/> Message</Button>
                      {!isFriend(viewingProfile.id) && (<Button variant="secondary" fullWidth onClick={() => handleFriendRequest(viewingProfile.id)}><UserPlus size={18}/> Add Friend</Button>)}
                  </div>
               </div>
            )}

            {!activePeer && (
              <>
                {/* --- TABS --- */}
                <div className="px-4 pt-4 pb-2 shrink-0">
                  <div className="flex items-center gap-2 p-1.5 bg-slate-100 dark:bg-white/5 rounded-2xl overflow-x-auto no-scrollbar">
                     {['online', 'friends', 'recent', 'global'].map((tab) => (
                        <button 
                          key={tab} 
                          onClick={() => setActiveTab(tab as any)} 
                          className={clsx(
                            "flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 ease-out flex items-center justify-center gap-2 capitalize whitespace-nowrap relative min-w-[90px] active:scale-95",
                            activeTab === tab 
                              ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md" 
                              : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-white/50 dark:hover:bg-white/5"
                          )}
                        >
                           {tab === 'online' && <Wifi size={16} />} 
                           {tab === 'friends' && <Heart size={16} />} 
                           {tab === 'recent' && <History size={16} />} 
                           {tab === 'global' && <Globe size={16} />}
                           {tab === 'global' ? 'Global Meet' : tab}
                           {tab === 'friends' && (friends.some(f => unreadCounts[f.id] > 0) || friendRequests.length > 0) && <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full" />}
                           {tab === 'recent' && recentPeers.some(p => unreadCounts[p.peerId] > 0) && <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full" />}
                        </button>
                     ))}
                  </div>
                </div>

                {/* --- SEARCH BAR --- */}
                {['online', 'friends', 'recent'].includes(activeTab) && (
                   <div className="px-4 pb-2 shrink-0 animate-in fade-in slide-in-from-top-1 duration-200">
                      <div className="relative">
                         <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                         <input 
                            type="text" 
                            placeholder={`Search ${activeTab}...`}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-slate-100 dark:bg-white/5 border-none rounded-xl py-2.5 pl-10 pr-10 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50 placeholder:text-slate-400 transition-all"
                         />
                         {searchQuery && (
                            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-full hover:bg-slate-200 dark:hover:bg-white/10 transition-colors">
                               <X size={14} />
                            </button>
                         )}
                      </div>
                   </div>
                )}

                {/* --- TAB CONTENT WRAPPER --- */}
                <div className="flex-1 flex flex-col min-h-0 bg-slate-50/50 dark:bg-black/20 overflow-hidden relative">
                  
                  {/* ONLINE TAB */}
                  {activeTab === 'online' && (
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
                      {filteredOnlineUsers.map((user, i) => (
                        <div key={i} className={clsx("flex items-center justify-between p-3.5 bg-white dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5 transition-all duration-100 shadow-sm hover:shadow-md active:scale-[0.99]", user.peerId === myPeerId ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:border-brand-200 dark:hover:border-white/10")}>
                          <div className="flex flex-1 items-center gap-3" onClick={() => { if (user.peerId !== myPeerId && user.profile) setViewingProfile({ id: user.peerId, profile: user.profile }); }}>
                                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-brand-400 to-violet-500 flex items-center justify-center text-white font-bold shrink-0 shadow-lg relative">
                                  {user.profile?.username?.[0]?.toUpperCase() || '?'}
                                  {unreadCounts[user.peerId] > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border border-white dark:border-slate-900" />}
                                  {/* Online Dot */}
                                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-[#0A0A0F] rounded-full"></span>
                                </div>
                                <div className="min-w-0">
                                  <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    {user.profile?.username || 'Anonymous'} {user.profile?.username === myProfile?.username && <span className="text-[10px] text-brand-500 bg-brand-500/10 px-1.5 rounded-full shrink-0">(You)</span>}
                                  </div>
                                  <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                                    <span>{user.profile ? `${user.profile.age} • ${user.profile.gender}` : 'Guest'}</span>
                                  </div>
                                </div>
                          </div>
                        </div>
                      ))}
                      {filteredOnlineUsers.length === 0 && <div className="text-center text-slate-500 py-10">{searchQuery ? 'No matching users found.' : 'No users online.'}</div>}
                    </div>
                  )}
                  
                  {/* FRIENDS TAB */}
                  {activeTab === 'friends' && (
                     <div className="flex-1 overflow-y-auto p-4 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
                       
                       {/* Section 1: Friend Requests */}
                       {filteredFriendRequests.length > 0 && (
                          <div className="space-y-3">
                             <div className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Friend Requests</div>
                             {filteredFriendRequests.map((req, idx) => (
                                <div key={idx} className="p-3 bg-white dark:bg-white/5 border border-brand-500/20 rounded-2xl shadow-sm flex items-center justify-between">
                                   <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-full bg-brand-500 text-white flex items-center justify-center font-bold">{req.profile.username[0].toUpperCase()}</div>
                                      <div><div className="text-sm font-bold text-slate-900 dark:text-white">{req.profile.username}</div><div className="text-xs text-slate-500">Wants to connect</div></div>
                                   </div>
                                   <div className="flex gap-2">
                                      <button onClick={() => acceptFriendRequest?.(req)} className="p-2 bg-brand-500 text-white rounded-xl hover:bg-brand-600 transition-all duration-150 active:scale-90"><Check size={16} /></button>
                                      <button onClick={() => rejectFriendRequest?.(req.peerId)} className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 rounded-xl hover:bg-red-500 hover:text-white transition-all duration-150 active:scale-90"><X size={16} /></button>
                                   </div>
                                </div>
                             ))}
                          </div>
                       )}

                       {/* Section 2: Online Friends */}
                       {onlineFriends.length > 0 && (
                          <div className="space-y-3">
                            <div className="text-xs font-bold text-emerald-500 uppercase tracking-widest pl-1 flex items-center gap-2">
                              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                              Online ({onlineFriends.length})
                            </div>
                            {onlineFriends.map((friend) => {
                               // Use the current ID for the click handler
                               const currentId = resolveCurrentPeerId(friend);
                               return (
                               <div key={friend.id} onClick={() => currentId && openPrivateChat(currentId, friend.profile)} className="flex items-center justify-between p-3 bg-white dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5 cursor-pointer hover:shadow-md transition-all duration-100 group hover:border-brand-200 dark:hover:border-white/10 active:scale-[0.99]">
                                 <div className="flex items-center gap-3">
                                   <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-400 to-violet-500 flex items-center justify-center text-white font-bold shrink-0 relative">
                                     {friend.profile.username[0].toUpperCase()}
                                     {unreadCounts[friend.id] > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border border-white dark:border-slate-900" />}
                                     <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white dark:border-[#0A0A0F] rounded-full"></span>
                                   </div>
                                   <div className="min-w-0">
                                     <div className="text-sm font-bold text-slate-900 dark:text-white truncate">{friend.profile.username}</div>
                                     <div className="text-xs text-emerald-500 font-medium">Active now</div>
                                   </div>
                                 </div>
                                 <div className="p-2 text-slate-300 group-hover:text-brand-500 transition-colors"><MessageCircle size={18} /></div>
                               </div>
                               );
                             })}
                          </div>
                       )}

                       {/* Section 3: Offline Friends */}
                       {offlineFriends.length > 0 && (
                          <div className="space-y-3">
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Offline</div>
                            {offlineFriends.map((friend) => (
                               <div key={friend.id} onClick={() => openPrivateChat(friend.id, friend.profile)} className="flex items-center justify-between p-3 bg-white dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5 cursor-pointer hover:shadow-md transition-all duration-100 group grayscale-[0.5] hover:grayscale-0 active:scale-[0.99]">
                                 <div className="flex items-center gap-3">
                                   <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-300 font-bold shrink-0 relative">
                                     {friend.profile.username[0].toUpperCase()}
                                     {unreadCounts[friend.id] > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border border-white dark:border-slate-900" />}
                                   </div>
                                   <div className="min-w-0">
                                     <div className="text-sm font-bold text-slate-700 dark:text-slate-300 truncate">{friend.profile.username}</div>
                                     <div className="text-xs text-slate-400 flex items-center gap-1"><Clock size={10}/> {formatLastSeen(friend.lastSeen)}</div>
                                   </div>
                                 </div>
                               </div>
                             ))}
                          </div>
                       )}

                       {filteredFriendsList.length === 0 && filteredFriendRequests.length === 0 && (
                          <div className="flex flex-col items-center justify-center py-12 text-center opacity-60">
                             <div className="w-16 h-16 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-4 text-slate-300 dark:text-slate-500"><UserPlus size={32}/></div>
                             <p className="text-slate-500 dark:text-slate-400 font-medium">
                               {searchQuery ? 'No matching friends found' : 'No friends yet'}
                             </p>
                             {!searchQuery && (
                               <p className="text-xs text-slate-400 max-w-[200px] mt-1">Connect with people in Global Chat or Online list to add them.</p>
                             )}
                          </div>
                       )}
                     </div>
                  )}

                  {/* RECENT TAB */}
                  {activeTab === 'recent' && (
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
                      {filteredRecentPeers.map((peer) => (
                        <div key={peer.id} onClick={() => openPrivateChat(peer.peerId, peer.profile)} className="flex items-center justify-between p-3 bg-white dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5 cursor-pointer hover:shadow-md transition-all duration-100 group active:scale-[0.99]">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 text-lg font-bold shrink-0 relative">
                              {peer.profile.username[0].toUpperCase()}
                              {unreadCounts[peer.peerId] > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border border-white dark:border-slate-900" />}
                            </div>
                            <div className="min-w-0"><div className="text-sm font-bold text-slate-900 dark:text-white truncate">{peer.profile.username}</div><div className="text-xs text-slate-500">{new Date(peer.metAt).toLocaleDateString()}</div></div>
                          </div>
                          <div className="p-2 text-slate-400 group-hover:text-brand-500"><MessageCircle size={18} /></div>
                        </div>
                      ))}
                      {filteredRecentPeers.length === 0 && <div className="text-center text-slate-500 py-10">{searchQuery ? 'No matching history.' : 'No recent history.'}</div>}
                    </div>
                  )}

                  {/* GLOBAL TAB */}
                  {activeTab === 'global' && (
                    <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-2 duration-200">
                      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
                         {globalMessages.map(msg => (
                           <div key={msg.id} className={clsx("flex flex-col", msg.sender === 'me' ? "items-end" : "items-start")}>
                              <div className={clsx("px-3 py-2 rounded-2xl text-sm max-w-[85%] break-words shadow-sm", msg.sender === 'me' ? "bg-brand-500 text-white rounded-tr-sm" : "bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-tl-sm")}>
                                 <button onClick={() => { if (msg.sender !== 'me' && msg.senderPeerId && msg.senderProfile) setViewingProfile({ id: msg.senderPeerId, profile: msg.senderProfile }); }} className={clsx("text-[10px] block font-bold mb-0.5", msg.sender === 'me' ? "text-brand-100 cursor-default" : "text-brand-500 hover:underline cursor-pointer")}>{msg.sender === 'me' ? 'You' : msg.senderName}</button>
                                 {msg.text}
                              </div>
                           </div>
                         ))}
                         <div ref={messagesEndRef} />
                      </div>
                      <form onSubmit={handleGlobalSubmit} className="p-4 shrink-0 border-t border-slate-100 dark:border-white/5 bg-white/50 dark:bg-black/20 backdrop-blur-md flex gap-2">
                         <input 
                           className="flex-1 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all disabled:opacity-50" 
                           placeholder={!myPeerId ? "Connecting..." : "Message Global Meet..."} 
                           value={globalInput} 
                           onChange={e => setGlobalInput(e.target.value)} 
                           disabled={false}
                         />
                         <button type="submit" disabled={!myPeerId} className="p-3 bg-brand-500 text-white rounded-xl hover:bg-brand-600 transition-all duration-150 active:scale-90 shadow-lg shadow-brand-500/20 disabled:opacity-50"><Send size={18} /></button>
                      </form>
                    </div>
                  )}
                </div>
              </>
            )}

            {activePeer && (
               <div className="flex-1 flex flex-col p-4 overflow-hidden min-h-0 relative bg-slate-50/30 dark:bg-black/20 animate-in slide-in-from-right-10 duration-200">
                  {peerTypingStatus[activePeer.id] && <div className="absolute top-0 left-0 right-0 h-6 bg-transparent z-10 flex items-center px-4 justify-center"><span className="text-xs text-brand-500 animate-pulse font-medium bg-white/80 dark:bg-black/50 px-2 py-0.5 rounded-full backdrop-blur-sm">typing...</span></div>}
                  <div className="flex-1 space-y-3 mb-4 overflow-y-auto min-h-0 pr-1 pt-4">
                     {localChatHistory.map(msg => (
                       <MessageBubble key={msg.id} message={msg} senderName={activePeer.profile.username} onReact={(emoji) => handleReactionSend(msg.id, emoji)} onEdit={onEditMessage} />
                     ))}
                     {localChatHistory.length === 0 && <div className="text-center text-slate-500 text-sm mt-10">Start a conversation with {activePeer.profile.username}.<br/><span className="text-xs opacity-70">Messages are saved locally.</span></div>}
                     <div ref={privateMessagesEndRef} />
                  </div>
                  <form onSubmit={handlePrivateSubmit} className="mt-auto flex gap-2 shrink-0 pb-1 items-end">
                     <input type="file" accept="image/*" className="hidden" ref={privateFileInputRef} onChange={handlePrivateImageUpload} />
                     <button type="button" onClick={() => privateFileInputRef.current?.click()} className="p-2.5 text-slate-400 hover:text-brand-500 hover:bg-white dark:hover:bg-white/10 rounded-xl transition-all duration-150 active:scale-90 shrink-0"><ImageIcon size={22} /></button>
                     {!privateInput.trim() && (isRecordingPrivate ? (<button type="button" onClick={stopPrivateRecording} className="p-2.5 bg-red-500 text-white rounded-xl animate-pulse shrink-0 shadow-lg shadow-red-500/20"><Square size={22} fill="currentColor"/></button>) : (<button type="button" onClick={startPrivateRecording} className="p-2.5 text-slate-400 hover:text-brand-500 hover:bg-white dark:hover:bg-white/10 rounded-xl shrink-0 transition-all duration-150 active:scale-90"><Mic size={22} /></button>))}
                     <div className="flex-1 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl flex items-center focus-within:ring-2 focus-within:ring-brand-500/50 transition-all">
                        <input className="w-full bg-transparent px-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none" placeholder="Type message..." value={privateInput} onChange={handlePrivateTyping} autoFocus />
                     </div>
                     <button type="submit" disabled={!privateInput.trim()} className="p-3 bg-brand-500 text-white rounded-xl hover:bg-brand-600 transition-all duration-150 active:scale-90 disabled:opacity-50 shrink-0 shadow-lg shadow-brand-500/20"><Send size={20} /></button>
                  </form>
               </div>
            )}
          </div>
        </div>
      )}
    </>
  );
  
  return <>{triggerTarget ? createPortal(TriggerButton, triggerTarget) : TriggerButton}{createPortal(DrawerOverlay, document.body)}</>;
});

SocialHub.displayName = 'SocialHub';