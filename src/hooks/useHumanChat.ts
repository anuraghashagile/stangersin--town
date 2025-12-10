
import { useState, useCallback, useRef, useEffect } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { supabase } from '../lib/supabase';
import { Message, ChatMode, PeerData, PresenceState, UserProfile, RecentPeer, Friend, FriendRequest, ConnectionMetadata, DirectMessageEvent, DirectStatusEvent } from '../types';
import { 
  INITIAL_GREETING, 
  ICE_SERVERS
} from '../constants';

// Define RealtimeChannel type from supabase instance return type since it's not exported from the module in some versions
type RealtimeChannel = ReturnType<typeof supabase.channel>;

const MATCHMAKING_CHANNEL = 'global-lobby-v1';

export const useHumanChat = (userProfile: UserProfile | null, persistentId?: string) => {
  // --- MAIN CHAT STATE (Random 1-on-1) ---
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<ChatMode>(ChatMode.IDLE);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [partnerRecording, setPartnerRecording] = useState(false);
  const [partnerProfile, setPartnerProfile] = useState<UserProfile | null>(null);
  const [remoteVanishMode, setRemoteVanishMode] = useState<boolean | null>(null);
  const [partnerPeerId, setPartnerPeerId] = useState<string | null>(null);
  
  // --- GLOBAL STATE ---
  const [onlineUsers, setOnlineUsers] = useState<PresenceState[]>([]);
  const [myPeerId, setMyPeerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // --- DIRECT CHAT STATE (Social Hub) ---
  const [incomingDirectMessage, setIncomingDirectMessage] = useState<DirectMessageEvent | null>(null);
  const [incomingReaction, setIncomingReaction] = useState<{ peerId: string, messageId: string, emoji: string, sender: 'stranger' } | null>(null);
  const [incomingDirectStatus, setIncomingDirectStatus] = useState<DirectStatusEvent | null>(null);
  const [activeDirectConnections, setActiveDirectConnections] = useState<Set<string>>(new Set());

  // Friend System State
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  
  // --- REFS ---
  const peerRef = useRef<Peer | null>(null);
  
  // Connection Refs
  const mainConnRef = useRef<DataConnection | null>(null); // For Random/Main Chat
  const directConnsRef = useRef<Map<string, DataConnection>>(new Map()); // For Social Hub Chats (Map<peerId, Connection>)

  const channelRef = useRef<RealtimeChannel | null>(null);
  const myPeerIdRef = useRef<string | null>(null);
  const isMatchmakerRef = useRef(false);
  
  const connectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- 1. INITIALIZE PEER (PERSISTENT) ---
  useEffect(() => {
    if (!userProfile) return;

    if (peerRef.current && !peerRef.current.destroyed) return;

    const peerConfig = { debug: 1, config: { iceServers: ICE_SERVERS } };
    const peer = persistentId 
      ? new Peer(persistentId, peerConfig)
      : new Peer(peerConfig);

    peerRef.current = peer;

    peer.on('open', (id) => {
      console.log('My Peer ID:', id);
      myPeerIdRef.current = id;
      setMyPeerId(id);
    });

    peer.on('connection', (conn) => {
      const metadata = conn.metadata as ConnectionMetadata;
      setupConnection(conn, metadata);
    });

    peer.on('error', (err: any) => {
      console.error("Peer Error:", err);
      if (err.type === 'peer-unavailable' && isMatchmakerRef.current) {
         isMatchmakerRef.current = false;
         if (status === ChatMode.SEARCHING) {
            // Slight delay to retry to avoid spamming
            setTimeout(() => setStatus(ChatMode.SEARCHING), 1000); 
         }
      }
    });

    return () => {
      // Keep peer alive unless full unmount
    };
  }, [userProfile, persistentId, status]);


  // --- 2. PERSISTENT LOBBY (PRESENCE) ---
  useEffect(() => {
    if (!userProfile || !myPeerId) return;

    // Join the lobby channel immediately to be "Online"
    const channel = supabase.channel(MATCHMAKING_CHANNEL, {
      config: { presence: { key: myPeerId } }
    });
    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const newState = channel.presenceState();
        const allUsers = Object.values(newState).flat() as unknown as PresenceState[];
        setOnlineUsers(allUsers);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
           await channel.track({
              peerId: myPeerId,
              status: 'idle', 
              timestamp: Date.now(),
              profile: userProfile
           });
        }
      });

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [userProfile, myPeerId]);


  // --- MATCHMAKING LOGIC ---
  useEffect(() => {
    if (status !== ChatMode.SEARCHING || !myPeerId || !channelRef.current || isMatchmakerRef.current || mainConnRef.current) {
      return;
    }

    const interval = setInterval(() => {
      if (status !== ChatMode.SEARCHING || isMatchmakerRef.current || mainConnRef.current) return;

      const waiters = onlineUsers
        .filter(u => u.status === 'waiting' && u.peerId !== myPeerId)
        .sort((a, b) => a.timestamp - b.timestamp);

      if (waiters.length > 0) {
        // Simple logic: If I am searching, and there is someone waiting, I try to connect to the oldest one.
        // To prevent collision, maybe add a random delay or prefer oldest?
        // Let's just pick the oldest.
        const target = waiters[0];
        console.log("Attempting match with:", target.peerId);
        
        isMatchmakerRef.current = true;
        try {
          const conn = peerRef.current?.connect(target.peerId, { 
            reliable: true,
            metadata: { type: 'random' } 
          });
          
          if (conn) {
            setupConnection(conn, { type: 'random' });
            
            // Safety timeout
            if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
            connectionTimeoutRef.current = setTimeout(() => {
              if (isMatchmakerRef.current && (!mainConnRef.current || !mainConnRef.current.open)) {
                console.log("Connection attempt timed out. Retrying...");
                isMatchmakerRef.current = false;
                mainConnRef.current = null;
                // Loop will pick up next attempt
              }
            }, 5000);
          } else {
             isMatchmakerRef.current = false;
          }
        } catch (e) {
          console.error("Match connection failed", e);
          isMatchmakerRef.current = false;
        }
      }
    }, 2000); // Check every 2s

    return () => clearInterval(interval);

  }, [status, onlineUsers, myPeerId]);


  // --- LOAD FRIENDS & RECENTS ---
  useEffect(() => {
    const loadData = () => {
      try {
        const f = localStorage.getItem('chat_friends');
        if (f) setFriends(JSON.parse(f));
      } catch (e) {}
    };
    loadData();
  }, []);


  // --- SAVE FRIEND ---
  const saveFriend = useCallback((profile: UserProfile, peerId: string) => {
    const key = 'chat_friends';
    try {
      const existing = localStorage.getItem(key);
      let friendList: Friend[] = existing ? JSON.parse(existing) : [];
      if (friendList.some(f => f.id === peerId)) return;

      const newFriend: Friend = { id: peerId, profile, addedAt: Date.now(), lastSeen: Date.now() };
      friendList.unshift(newFriend);
      localStorage.setItem(key, JSON.stringify(friendList));
      setFriends(friendList);
      setFriendRequests(prev => prev.filter(req => req.peerId !== peerId));
    } catch (e) {}
  }, []);

  const removeFriend = useCallback((peerId: string) => {
    const key = 'chat_friends';
    try {
      const existing = localStorage.getItem(key);
      let friendList: Friend[] = existing ? JSON.parse(existing) : [];
      friendList = friendList.filter(f => f.id !== peerId);
      localStorage.setItem(key, JSON.stringify(friendList));
      setFriends(friendList);
    } catch (e) {}
  }, []);

  const saveToRecent = useCallback((profile: UserProfile, peerId: string) => {
    try {
      const key = 'recent_peers';
      const existing = localStorage.getItem(key);
      let recents: RecentPeer[] = existing ? JSON.parse(existing) : [];
      const newPeer: RecentPeer = { id: Date.now().toString(), peerId, profile, metAt: Date.now() };
      recents = recents.filter(p => p.profile.username !== profile.username);
      recents.unshift(newPeer);
      localStorage.setItem(key, JSON.stringify(recents.slice(0, 20)));
    } catch (e) {}
  }, []);


  // --- CLEANUP MAIN CHAT ---
  const cleanupMain = useCallback(() => {
    if (mainConnRef.current) {
      try { mainConnRef.current.send({ type: 'disconnect' }); } catch(e) {}
      setTimeout(() => {
         try { mainConnRef.current?.close(); } catch (e) {}
         mainConnRef.current = null;
      }, 100);
    } else {
       mainConnRef.current = null;
    }

    if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (recordingTimeoutRef.current) clearTimeout(recordingTimeoutRef.current);

    isMatchmakerRef.current = false;
    
    setPartnerTyping(false);
    setPartnerRecording(false);
    setPartnerPeerId(null);
    setPartnerProfile(null);
    setRemoteVanishMode(null);
    
    // Update presence to 'idle'
    if (channelRef.current && myPeerIdRef.current) {
       channelRef.current.track({
          peerId: myPeerIdRef.current,
          status: 'idle',
          timestamp: Date.now(),
          profile: userProfile! 
       });
    }
    
    setStatus(ChatMode.DISCONNECTED);
  }, [userProfile]);


  // --- DATA HANDLING ---
  const handleIncomingData = useCallback((data: PeerData, conn: DataConnection) => {
    const isMain = conn === mainConnRef.current;

    if (data.type === 'message') {
      const msgId = data.id || Date.now().toString();
      const newMessage: Message = {
        id: msgId,
        sender: 'stranger',
        timestamp: Date.now(),
        type: data.dataType || 'text',
        reactions: [],
        text: (data.dataType !== 'image' && data.dataType !== 'audio') ? data.payload : undefined,
        fileData: (data.dataType === 'image' || data.dataType === 'audio') ? data.payload : undefined,
        status: 'sent'
      };

      if (isMain) {
        setMessages(prev => [...prev, newMessage]);
        setPartnerTyping(false);
        conn.send({ type: 'seen', messageId: msgId });
      } else {
        setIncomingDirectMessage({ peerId: conn.peer, message: newMessage });
        conn.send({ type: 'seen', messageId: msgId });
      }
    }
    else if (data.type === 'seen') {
       if (isMain) {
         setMessages(prev => prev.map(m => m.id === data.messageId ? { ...m, status: 'seen' } : m));
       }
       // For direct, we might want to surface this too, but for now focusing on main
    }
    else if (data.type === 'typing') {
      if (isMain) setPartnerTyping(data.payload);
      else setIncomingDirectStatus({ peerId: conn.peer, type: 'typing', value: data.payload });
    }
    else if (data.type === 'recording') {
      if (isMain) setPartnerRecording(data.payload);
      else setIncomingDirectStatus({ peerId: conn.peer, type: 'recording', value: data.payload });
    }
    else if (data.type === 'profile') {
      saveToRecent(data.payload, conn.peer);
      if (isMain) {
        setPartnerProfile(data.payload);
        setMessages(prev => prev.map(m => m.id === 'init-1' ? { ...m, text: `Connected with ${data.payload.username}. Say hello!` } : m));
      }
    }
    else if (data.type === 'friend_request') {
      setFriends(currFriends => {
         const isFriend = currFriends.some(f => f.id === conn.peer);
         if (!isFriend) {
            setFriendRequests(prev => {
               if (prev.some(req => req.peerId === conn.peer)) return prev;
               return [...prev, { profile: data.payload, peerId: conn.peer }];
            });
         }
         return currFriends;
      });
    }
    else if (data.type === 'friend_accept') {
      saveFriend(data.payload, conn.peer);
    }
    else if (data.type === 'disconnect') {
      if (isMain) {
         setStatus(ChatMode.DISCONNECTED);
         setMessages([]);
         setPartnerPeerId(null);
         mainConnRef.current?.close();
         mainConnRef.current = null;
      } else {
         directConnsRef.current.delete(conn.peer);
         setActiveDirectConnections(prev => {
            const next = new Set(prev);
            next.delete(conn.peer);
            return next;
         });
      }
    }
    else if (data.type === 'vanish_mode' && isMain) setRemoteVanishMode(data.payload);
    else if (data.type === 'reaction' && data.messageId) {
       // Support both main and direct reactions
       setIncomingReaction({ peerId: conn.peer, messageId: data.messageId, emoji: data.payload, sender: 'stranger' });
       if (isMain) {
          setMessages(prev => prev.map(m => m.id === data.messageId ? { ...m, reactions: [...(m.reactions||[]), {emoji:data.payload, sender:'stranger'}] } : m));
       }
    }
    else if (data.type === 'edit_message' && isMain) {
       setMessages(prev => prev.map(m => (m.sender==='stranger' && m.type==='text' && (!data.messageId || m.id === data.messageId)) ? {...m, text:data.payload, isEdited:true} : m));
    }

  }, [saveFriend, saveToRecent, userProfile]);


  // --- SETUP CONNECTION ---
  const setupConnection = useCallback((conn: DataConnection, metadata: ConnectionMetadata) => {
    if (metadata?.type === 'random') {
      mainConnRef.current = conn;
      setPartnerPeerId(conn.peer);
      isMatchmakerRef.current = false;
      
      // Update status to busy
      if (channelRef.current && myPeerIdRef.current) {
         channelRef.current.track({
            peerId: myPeerIdRef.current,
            status: 'busy',
            timestamp: Date.now(),
            profile: userProfile!
         });
      }
    } else {
      directConnsRef.current.set(conn.peer, conn);
      setActiveDirectConnections(prev => new Set(prev).add(conn.peer));
    }

    conn.on('open', () => {
       if (conn === mainConnRef.current) {
          setStatus(ChatMode.CONNECTED);
          setMessages([INITIAL_GREETING]);
          setError(null);
       }
       if (userProfile) {
          conn.send({ type: 'profile', payload: userProfile });
       }
    });

    conn.on('data', (data: any) => handleIncomingData(data, conn));
    
    conn.on('close', () => {
       if (conn === mainConnRef.current && status === ChatMode.CONNECTED) {
          setStatus(ChatMode.DISCONNECTED);
          setMessages([]);
          setPartnerPeerId(null);
       } else {
          directConnsRef.current.delete(conn.peer);
          setActiveDirectConnections(prev => {
             const next = new Set(prev);
             next.delete(conn.peer);
             return next;
          });
       }
    });

    conn.on('error', (err) => {
       console.error("Conn error", err);
       if (conn === mainConnRef.current) {
          // If error during setup, reset
          if (status === ChatMode.SEARCHING) {
             isMatchmakerRef.current = false;
             mainConnRef.current = null;
          }
       }
    });

  }, [handleIncomingData, status, userProfile]);


  // --- PUBLIC ACTIONS ---
  
  const connect = useCallback(() => {
    // To start a chat, we just update our presence status to 'waiting'
    if (channelRef.current && myPeerIdRef.current) {
       setStatus(ChatMode.SEARCHING);
       setMessages([]);
       setError(null);
       channelRef.current.track({
         peerId: myPeerIdRef.current,
         status: 'waiting',
         timestamp: Date.now(),
         profile: userProfile!
       });
    } else {
      setError("Connection lost. Please refresh.");
    }
  }, [userProfile]);

  const disconnect = useCallback(() => {
    cleanupMain();
    setMessages([]); 
  }, [cleanupMain]);

  const sendMessage = useCallback((text: string) => {
     if (mainConnRef.current && mainConnRef.current.open) {
        const id = Date.now().toString() + Math.random();
        mainConnRef.current.send({ type: 'message', payload: text, dataType: 'text', id });
        setMessages(p => [...p, { id, text, type:'text', sender:'me', timestamp: Date.now(), reactions:[], status:'sent' }]);
     }
  }, []);
  
  const sendImage = useCallback((b64: string) => {
     if (mainConnRef.current?.open) {
        const id = Date.now().toString()+Math.random();
        mainConnRef.current.send({ type:'message', payload:b64, dataType:'image', id });
        setMessages(p => [...p, { id, fileData:b64, type:'image', sender:'me', timestamp: Date.now(), reactions:[], status:'sent' }]);
     }
  }, []);

  const sendAudio = useCallback((b64: string) => {
     if (mainConnRef.current?.open) {
        const id = Date.now().toString()+Math.random();
        mainConnRef.current.send({ type:'message', payload:b64, dataType:'audio', id });
        setMessages(p => [...p, { id, fileData:b64, type:'audio', sender:'me', timestamp: Date.now(), reactions:[], status:'sent' }]);
     }
  }, []);

  const sendReaction = useCallback((msgId: string, emoji: string) => {
     if (mainConnRef.current?.open) mainConnRef.current.send({ type:'reaction', payload:emoji, messageId:msgId });
     setMessages(p => p.map(m => m.id===msgId ? {...m, reactions:[...(m.reactions||[]), {emoji, sender:'me'}]} : m));
  }, []);
  
  const editMessage = useCallback((msgId: string, text: string) => {
     if (mainConnRef.current?.open) mainConnRef.current.send({ type:'edit_message', payload:text, messageId:msgId });
     setMessages(p => p.map(m => m.id===msgId ? {...m, text, isEdited:true} : m));
  }, []);
  
  const sendTyping = useCallback((typing: boolean) => {
     if (mainConnRef.current?.open) mainConnRef.current.send({ type:'typing', payload:typing });
  }, []);
  
  const sendRecording = useCallback((rec: boolean) => {
     if (mainConnRef.current?.open) mainConnRef.current.send({ type:'recording', payload:rec });
  }, []);
  
  const sendVanishMode = useCallback((val: boolean) => {
     if (mainConnRef.current?.open) mainConnRef.current.send({ type:'vanish_mode', payload:val });
  }, []);

  const sendFriendRequest = useCallback(() => {
     if (mainConnRef.current?.open && userProfile) mainConnRef.current.send({ type:'friend_request', payload:userProfile });
  }, [userProfile]);

  const sendDirectMessage = useCallback((peerId: string, text: string, id?: string) => {
     const conn = directConnsRef.current.get(peerId);
     if (conn?.open) conn.send({ type:'message', payload:text, dataType:'text', id: id||Date.now().toString() });
  }, []);
  
  const sendDirectImage = useCallback((peerId: string, b64: string, id?: string) => {
     const conn = directConnsRef.current.get(peerId);
     if (conn?.open) conn.send({ type:'message', payload:b64, dataType:'image', id: id||Date.now().toString() });
  }, []);
  
  const sendDirectAudio = useCallback((peerId: string, b64: string, id?: string) => {
     const conn = directConnsRef.current.get(peerId);
     if (conn?.open) conn.send({ type:'message', payload:b64, dataType:'audio', id: id||Date.now().toString() });
  }, []);
  
  const sendDirectTyping = useCallback((peerId: string, typing: boolean) => {
     const conn = directConnsRef.current.get(peerId);
     if (conn?.open) conn.send({ type:'typing', payload:typing });
  }, []);

  const sendDirectReaction = useCallback((peerId: string, messageId: string, emoji: string) => {
     const conn = directConnsRef.current.get(peerId);
     if (conn?.open) conn.send({ type: 'reaction', payload: emoji, messageId });
  }, []);

  const sendDirectFriendRequest = useCallback((peerId: string) => {
     if (!userProfile) return;
     const conn = directConnsRef.current.get(peerId);
     if (conn?.open) {
        conn.send({ type: 'friend_request', payload: userProfile });
     } else {
        const tempConn = peerRef.current?.connect(peerId, { reliable: true, metadata: { type: 'direct' } });
        if (tempConn) {
           tempConn.on('open', () => {
              tempConn.send({ type: 'friend_request', payload: userProfile });
              setupConnection(tempConn, { type: 'direct' });
           });
        }
     }
  }, [userProfile, setupConnection]);

  const callPeer = useCallback((peerId: string, profile?: UserProfile) => {
     if (profile) saveToRecent(profile, peerId);
     if (!directConnsRef.current.has(peerId)) {
        const conn = peerRef.current?.connect(peerId, { reliable: true, metadata: { type: 'direct' } });
        if (conn) setupConnection(conn, { type: 'direct' });
     }
  }, [saveToRecent, setupConnection]);

  const acceptFriendRequest = useCallback((req?: FriendRequest) => {
     const target = req || friendRequests[0];
     if (target && userProfile) {
        saveFriend(target.profile, target.peerId);
        const conn = directConnsRef.current.get(target.peerId) || mainConnRef.current;
        if (conn?.open && (conn.peer === target.peerId)) {
           conn.send({ type: 'friend_accept', payload: userProfile });
        } else {
           const temp = peerRef.current?.connect(target.peerId);
           temp?.on('open', () => {
              temp.send({ type: 'friend_accept', payload: userProfile });
           });
        }
        setFriendRequests(p => p.filter(r => r.peerId !== target.peerId));
     }
  }, [friendRequests, userProfile, saveFriend]);

  const rejectFriendRequest = useCallback((peerId: string) => {
     setFriendRequests(p => p.filter(r => r.peerId !== peerId));
  }, []);

  const updateMyProfile = useCallback((newP: UserProfile) => {
     // implementation for profile update broadcast...
  }, []);

  const isPeerConnected = useCallback((peerId: string) => {
     return activeDirectConnections.has(peerId);
  }, [activeDirectConnections]);

  useEffect(() => {
     const handleUnload = () => {
        try { mainConnRef.current?.send({ type: 'disconnect' }); } catch(e) {}
        directConnsRef.current.forEach(c => { try{c.send({type:'disconnect'});}catch(e){} });
        peerRef.current?.destroy();
     };
     window.addEventListener('beforeunload', handleUnload);
     return () => window.removeEventListener('beforeunload', handleUnload);
  }, []);

  return { 
    messages, setMessages, status, partnerTyping, partnerRecording, partnerProfile, partnerPeerId, remoteVanishMode,
    onlineUsers, myPeerId, error, friends, friendRequests, 
    removeFriend, rejectFriendRequest, incomingReaction, incomingDirectMessage, incomingDirectStatus, isPeerConnected,
    sendMessage, sendImage, sendAudio, sendReaction, editMessage, sendTyping, sendRecording, updateMyProfile, sendVanishMode,
    sendFriendRequest, acceptFriendRequest, connect, callPeer, disconnect,
    sendDirectMessage, sendDirectImage, sendDirectAudio, sendDirectTyping, sendDirectFriendRequest, sendDirectReaction
  };
};
