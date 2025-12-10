
import React, { useState, useEffect, useRef } from 'react';
import { Send, Loader2, RefreshCw, EyeOff, Shield, Image as ImageIcon, Mic, X, Square, AlertTriangle, UserPlus, Check, Bell, Sparkles } from 'lucide-react';
import { supabase, saveMessageToHistory, fetchChatHistory } from './lib/supabase';
import { Message, ChatMode, UserProfile, AppSettings, SessionType } from './types';
import { useHumanChat } from './hooks/useHumanChat';
import { useGlobalChat } from './hooks/useGlobalChat';
import { MessageBubble } from './components/MessageBubble';
import { Button } from './components/Button';
import { Header } from './components/Header';
import { LandingPage } from './components/LandingPage';
import { JoinModal } from './components/JoinModal';
import { SettingsModal } from './components/SettingsModal';
import { SocialHub } from './components/SocialHub';
import { EditMessageModal } from './components/EditMessageModal';
import Loader from './components/Loader';
import { clsx } from 'clsx';

const getStoredUserId = () => {
  if (typeof window === 'undefined') return 'server_user';
  let id = localStorage.getItem('chat_user_id');
  if (!id) {
    id = 'user_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('chat_user_id', id);
  }
  return id;
};

const getInitialTheme = (): 'light' | 'dark' => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('chat_theme') as 'light' | 'dark';
    if (saved) return saved;
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    if (window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
  }
  return 'dark';
};

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(getInitialTheme);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [inputText, setInputText] = useState('');
  
  const [settings, setSettings] = useState<AppSettings>({ vanishMode: false });
  const [sessionType, setSessionType] = useState<SessionType>('random');
  const [editingMessage, setEditingMessage] = useState<{id: string, text: string} | null>(null);
  const [friendNotification, setFriendNotification] = useState<string | null>(null);
  const [hasChatted, setHasChatted] = useState(false);
  
  const [isRecording, setIsRecording] = useState(false);
  const userId = useRef(getStoredUserId()).current;
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
  const prevOnlineUserIds = useRef<Set<string>>(new Set());

  const { 
    messages, setMessages, status, partnerTyping, partnerRecording, partnerProfile, partnerPeerId, remoteVanishMode,
    onlineUsers, myPeerId, error, friends, friendRequests, removeFriend, incomingReaction, incomingDirectMessage, incomingDirectStatus, isPeerConnected,
    sendMessage, sendDirectMessage, sendDirectImage, sendDirectAudio, sendDirectTyping, sendDirectFriendRequest, sendDirectReaction,
    sendImage, sendAudio, sendReaction, editMessage, sendTyping, sendRecording, updateMyProfile, sendVanishMode,
    sendFriendRequest, acceptFriendRequest, rejectFriendRequest, connect, callPeer, disconnect 
  } = useHumanChat(userProfile, userId);

  const { globalMessages, sendGlobalMessage } = useGlobalChat(userProfile, myPeerId);

  useEffect(() => {
    const savedProfile = localStorage.getItem('chat_user_profile');
    if (savedProfile) {
      try {
        const parsed = JSON.parse(savedProfile);
        setUserProfile(parsed);
      } catch (e) {
        console.error("Failed to load profile", e);
      }
    }
  }, []);

  useEffect(() => {
    if (remoteVanishMode !== null && remoteVanishMode !== undefined) {
      setSettings(prev => ({ ...prev, vanishMode: remoteVanishMode }));
    }
  }, [remoteVanishMode]);

  useEffect(() => {
    if (status === ChatMode.CONNECTED) {
      setHasChatted(true);
    }
  }, [status]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (messages.some(m => m.isVanish)) {
        const now = Date.now();
        setMessages(prev => prev.filter(msg => {
          if (!msg.isVanish) return true;
          return (now - msg.timestamp) < 10000;
        }));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [messages, setMessages]);

  useEffect(() => {
    const loadHistory = async () => { await fetchChatHistory(userId); };
    loadHistory();
  }, [userId]);

  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.sender === 'me' && !settings.vanishMode) {
       saveMessageToHistory(userId, lastMsg);
    }
  }, [messages, userId, settings.vanishMode]);

  useEffect(() => {
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => {
      const newTheme = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('chat_theme', newTheme);
      return newTheme;
    });
  };

  useEffect(() => {
    if (!userProfile) return;
    const currentOnlineIds = new Set(onlineUsers.map(u => u.peerId));
    if (friends.length > 0) {
      friends.forEach(friend => {
        if (currentOnlineIds.has(friend.id) && !prevOnlineUserIds.current.has(friend.id)) {
          setFriendNotification(`${friend.profile.username} is now online!`);
          setTimeout(() => setFriendNotification(null), 4000);
        }
      });
    }
    prevOnlineUserIds.current = currentOnlineIds;
  }, [onlineUsers, friends, userProfile]);

  useEffect(() => {
    if (sessionType === 'random') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, partnerTyping, sessionType, status]);

  const handleStartClick = () => setShowJoinModal(true);

  const handleJoin = (profile: UserProfile) => {
    localStorage.setItem('chat_user_profile', JSON.stringify(profile));
    setUserProfile(profile);
    setShowJoinModal(false);
    setSessionType('random');
    // We intentionally DO NOT call connect() here. 
    // User lands in lobby (online/idle) and must click "Find New Stranger" to search.
  };

  const handleUpdateProfile = (profile: UserProfile) => {
    localStorage.setItem('chat_user_profile', JSON.stringify(profile));
    setUserProfile(profile);
    updateMyProfile(profile);
    setShowEditProfileModal(false);
  };

  const handleUpdateSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    if (newSettings.vanishMode !== settings.vanishMode) {
      sendVanishMode(newSettings.vanishMode);
    }
  };

  const handleDirectCall = (peerId: string, profile?: UserProfile) => {
    callPeer(peerId, profile);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    sendMessage(inputText);
    if (settings.vanishMode) {
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last && last.sender === 'me') {
           const updated = [...prev];
           updated[updated.length - 1] = { ...last, isVanish: true };
           return updated;
        }
        return prev;
      });
    }
    sendTyping(false);
    setInputText('');
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    sendTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => sendTyping(false), 1000);
  };

  const handleNewChat = () => {
    setSessionType('random'); 
    disconnect();
    // Immediate reconnect call to start searching
    // status goes IDLE -> SEARCHING
    setTimeout(() => {
       connect();
    }, 100);
  };

  const initiateEdit = (id: string, text: string) => { setEditingMessage({ id, text }); };

  const saveEditedMessage = (newText: string) => {
    if (editingMessage) {
      editMessage(editingMessage.id, newText);
      setEditingMessage(null);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        sendImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
           sendAudio(reader.result as string);
        };
        stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorder.start();
      setIsRecording(true);
      sendRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Could not access microphone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      sendRecording(false);
    }
  };

  const isConnected = status === ChatMode.CONNECTED;
  const isSearching = status === ChatMode.SEARCHING || status === ChatMode.WAITING;
  const isCurrentPartnerFriend = partnerPeerId ? friends.some(f => f.id === partnerPeerId) : false;

  const renderMainContent = () => {
    if (status === ChatMode.IDLE && !userProfile) {
      return (
        <LandingPage 
          onlineCount={onlineUsers.length} 
          onStart={handleStartClick} 
          theme={theme}
          toggleTheme={toggleTheme}
        />
      );
    }

    return (
      <div className="flex-1 flex flex-col h-full relative overflow-hidden">
         {isSearching && (
           <div className="absolute inset-0 z-30 bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
             <div className="relative mb-8"><Loader /></div>
             <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-3">Matching you...</h2>
             <p className="text-slate-500 dark:text-slate-400 max-w-xs mx-auto animate-pulse mb-8">
                Finding a stranger with similar vibes...
             </p>
             <div className="flex flex-wrap justify-center gap-2 max-w-sm mx-auto mb-12">
                {userProfile?.interests.map(i => (
                   <span key={i} className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-full text-xs font-medium">{i}</span>
                ))}
             </div>
             <Button variant="secondary" onClick={() => { disconnect(); }}>Cancel</Button>
           </div>
         )}

        <div className={clsx(
          "flex-1 overflow-y-auto p-4 sm:p-6 space-y-2 w-full max-w-4xl mx-auto z-10 relative scroll-smooth",
          (messages.length === 0 && (status === ChatMode.DISCONNECTED || status === ChatMode.IDLE)) && "flex flex-col justify-center"
        )}>
          {!partnerProfile && status === ChatMode.CONNECTED && (
              <div className="text-center text-xs text-slate-400 my-4">Connected with {partnerProfile?.username || 'Stranger'}...</div>
          )}
          
          {messages.map((msg) => (
              <div key={msg.id} className={clsx("transition-opacity duration-1000", msg.isVanish && "animate-pulse")}>
                <MessageBubble 
                    message={msg} 
                    senderName={partnerProfile?.username} 
                    onReact={(emoji) => sendReaction(msg.id, emoji)}
                    onEdit={initiateEdit}
                />
              </div>
          ))}

          {(status === ChatMode.DISCONNECTED || status === ChatMode.IDLE) && !isSearching && (
              <div className={clsx(
                "flex flex-col items-center gap-6 animate-in fade-in zoom-in-95",
                messages.length > 0 ? "py-8 mt-8 border-t border-slate-100 dark:border-white/5 pt-8" : "w-full"
              )}>
                {hasChatted ? (
                  <>
                    <div className="w-20 h-20 bg-red-50 dark:bg-red-900/10 rounded-full flex items-center justify-center text-red-500 mb-2">
                      <X size={40} />
                    </div>
                    <div className="text-center space-y-2">
                      <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Chat Ended</h3>
                      <p className="text-slate-500 dark:text-slate-400 text-base max-w-xs mx-auto">
                        The connection has been closed.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-20 h-20 bg-brand-50 dark:bg-brand-900/10 rounded-full flex items-center justify-center text-brand-500 mb-2">
                       <Sparkles size={40} />
                    </div>
                    <div className="text-center space-y-2">
                      <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Start Matching</h3>
                      <p className="text-slate-500 dark:text-slate-400 text-base max-w-xs mx-auto">
                        Connect with random people anonymously.
                      </p>
                    </div>
                  </>
                )}
                
                <Button onClick={handleNewChat} className="shadow-lg shadow-brand-500/20 px-8 py-4 text-lg rounded-2xl w-full sm:w-auto">
                   <RefreshCw size={20} /> Find New Stranger
                </Button>
              </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className={clsx(
          "border-t shrink-0 w-full z-20 pb-[env(safe-area-inset-bottom)] transition-colors relative",
          settings.vanishMode ? "bg-[#1a0b2e] dark:bg-[#1a0b2e] border-purple-500/30" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-white/5",
          (!isConnected && !isSearching) && "opacity-100", 
          isSearching && "invisible" 
        )}>
          <div className={clsx("max-w-4xl mx-auto p-2 sm:p-4", isSearching && "pointer-events-none")}>
            {partnerTyping && (
              <div className="h-5 px-4 mb-1 text-xs text-brand-500 font-medium animate-pulse flex items-center gap-1">typing...</div>
            )}
            <form onSubmit={handleSendMessage} className="flex gap-2 items-end relative">
              <div id="social-hub-trigger-anchor" className="absolute bottom-[calc(100%+8px)] right-0 z-30 w-12 h-12 pointer-events-none"></div>
              <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} disabled={!isConnected}/>
              <button type="button" onClick={() => fileInputRef.current?.click()} className="p-3 text-slate-400 hover:text-brand-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-50 shrink-0"><ImageIcon size={24} /></button>
              {!inputText.trim() && (
                  isRecording ? (
                    <button type="button" onClick={stopRecording} className="p-3 bg-red-500 hover:bg-red-600 text-white rounded-xl shadow-lg shadow-red-500/20 transition-all animate-pulse shrink-0"><Square size={24} fill="currentColor" /></button>
                  ) : (
                    <button type="button" onClick={startRecording} className="p-3 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-200 rounded-xl transition-all active:scale-95 disabled:opacity-50 shrink-0" disabled={!isConnected}><Mic size={24} /></button>
                  )
              )}
              <div className={clsx("relative flex-1 rounded-2xl flex items-center min-h-[50px] bg-slate-100 dark:bg-slate-800")}>
                <input
                  type="text"
                  value={inputText}
                  onChange={handleTyping}
                  placeholder={isConnected ? (settings.vanishMode ? "Vanish message..." : "Type a message...") : "Disconnected"}
                  className="w-full bg-transparent border-0 px-4 py-3 placeholder:text-slate-400 focus:outline-none text-slate-900 dark:text-white"
                  autoComplete="off"
                  disabled={!isConnected}
                />
              </div>
              {inputText.trim() && (
                <button type="submit" className="p-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl shadow-lg shadow-brand-500/20 transition-all active:scale-95 shrink-0"><Send size={24} /></button>
              )}
            </form>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={clsx(
      "h-[100dvh] bg-slate-50 dark:bg-slate-950 transition-colors flex flex-col fixed inset-0 overflow-hidden",
      settings.vanishMode && "dark:bg-slate-950" 
    )}>
      {settings.vanishMode && (
        <div className="absolute inset-0 pointer-events-none z-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>
      )}

      {(status !== ChatMode.IDLE || userProfile) && (
        <Header 
          onlineCount={onlineUsers.length} 
          mode={status} 
          theme={theme}
          toggleTheme={toggleTheme}
          onDisconnect={() => disconnect()}
          partnerProfile={sessionType === 'random' ? partnerProfile : null} 
          onOpenSettings={() => setShowSettingsModal(true)}
          onEditProfile={() => setShowEditProfileModal(true)}
          onAddFriend={sendFriendRequest}
          isFriend={isCurrentPartnerFriend}
        />
      )}

      {/* FRIEND REQUEST TOAST */}
      {friendRequests.length > 0 && (
        <div className="fixed top-20 right-4 sm:right-6 z-[80] animate-in slide-in-from-right-10 fade-in duration-300 pointer-events-auto">
          <div className="bg-white dark:bg-[#0A0A0F] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl p-4 flex flex-col gap-3 w-72">
             <div className="flex items-start gap-3">
               <div className="w-10 h-10 rounded-full bg-brand-500 text-white flex items-center justify-center font-bold">
                  {friendRequests[0].profile.username[0].toUpperCase()}
               </div>
               <div>
                 <h4 className="text-sm font-bold text-slate-900 dark:text-white">Friend Request</h4>
                 <p className="text-xs text-slate-500 dark:text-slate-400">
                    {friendRequests[0].profile.username} wants to connect!
                 </p>
               </div>
             </div>
             <div className="flex gap-2">
               <Button onClick={() => acceptFriendRequest && acceptFriendRequest(friendRequests[0])} className="flex-1 py-1.5 text-xs h-8">Accept</Button>
               <Button variant="secondary" onClick={() => rejectFriendRequest && rejectFriendRequest(friendRequests[0].peerId)} className="flex-1 py-1.5 text-xs h-8">Ignore</Button>
             </div>
          </div>
        </div>
      )}

      {friendNotification && (
         <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] animate-in slide-in-from-top-5 duration-300">
            <div className="bg-emerald-500 text-white px-4 py-2.5 rounded-full shadow-lg flex items-center gap-3 text-sm font-bold">
               <Bell size={16} fill="currentColor" /> {friendNotification}
            </div>
         </div>
      )}

      {error && sessionType === 'random' && (
         <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-5">
            <div className="bg-red-500 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-sm font-medium">
              <AlertTriangle size={16} /> {error}
            </div>
         </div>
      )}

      {settings.vanishMode && status === ChatMode.CONNECTED && sessionType === 'random' && (
         <div className="absolute top-16 left-0 right-0 z-40 flex justify-center pointer-events-none animate-in slide-in-from-top-4">
            <div className="bg-purple-500/10 backdrop-blur-md border border-purple-500/20 px-4 py-1.5 rounded-b-xl text-[10px] font-bold text-purple-400 uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-purple-900/20">
               <EyeOff size={12} /> Vanish Mode Active
            </div>
         </div>
      )}

      {renderMainContent()}

      <SettingsModal isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} settings={settings} onUpdateSettings={handleUpdateSettings}/>
      
      {showJoinModal && (
        <JoinModal onClose={() => setShowJoinModal(false)} onJoin={handleJoin} />
      )}
      
      {showEditProfileModal && userProfile && (
        <JoinModal onClose={() => setShowEditProfileModal(false)} onJoin={handleUpdateProfile} initialProfile={userProfile} isEditing={true}/>
      )}
      
      <EditMessageModal isOpen={!!editingMessage} onClose={() => setEditingMessage(null)} initialText={editingMessage?.text || ''} onSave={saveEditedMessage} />

      {userProfile && (
        <SocialHub 
          onlineUsers={onlineUsers} 
          onCallPeer={handleDirectCall} 
          globalMessages={globalMessages}
          sendGlobalMessage={sendGlobalMessage}
          myProfile={userProfile}
          myPeerId={myPeerId}
          privateMessages={messages}
          sendPrivateMessage={sendMessage} 
          sendDirectMessage={sendDirectMessage} 
          sendDirectImage={sendDirectImage}
          sendDirectAudio={sendDirectAudio}
          sendDirectTyping={sendDirectTyping}
          sendDirectFriendRequest={sendDirectFriendRequest}
          sendDirectReaction={sendDirectReaction}
          sendReaction={sendReaction}
          currentPartner={partnerProfile}
          chatStatus={status}
          error={error}
          onEditMessage={initiateEdit}
          sessionType={sessionType}
          incomingReaction={incomingReaction}
          incomingDirectMessage={incomingDirectMessage}
          incomingDirectStatus={incomingDirectStatus} 
          onCloseDirectChat={() => setSessionType('random')} 
          friends={friends} 
          friendRequests={friendRequests}
          removeFriend={removeFriend}
          acceptFriendRequest={acceptFriendRequest}
          rejectFriendRequest={rejectFriendRequest}
          isPeerConnected={isPeerConnected}
        />
      )}
    </div>
  );
}
