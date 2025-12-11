import { useState, useCallback, useRef, useEffect } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { supabase, sendOfflineMessage, fetchOfflineMessages } from '../lib/supabase';
import { Message, ChatMode, PeerData, PresenceState, UserProfile, RecentPeer, Friend, FriendRequest, ConnectionMetadata, DirectMessageEvent, DirectStatusEvent } from '../types';
import { 
  INITIAL_GREETING, 
  ICE_SERVERS
} from '../constants';

type RealtimeChannel = ReturnType<typeof supabase.channel>;

const MATCHMAKING_CHANNEL = 'global-lobby-v1';

export const useHumanChat = (userProfile: UserProfile | null, persistentId?: string) => {
  // --- STATE ---
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<ChatMode>(ChatMode.IDLE);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [partnerRecording, setPartnerRecording] = useState(false);
  const [partnerProfile, setPartnerProfile] = useState<UserProfile | null>(null);
  const [remoteVanishMode, setRemoteVanishMode] = useState<boolean | null>(null);
  const [partnerPeerId, setPartnerPeerId] = useState<string | null>(null);
  
  const [onlineUsers, setOnlineUsers] = useState<PresenceState[]>([]);
  const [myPeerId, setMyPeerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [disconnectReason, setDisconnectReason] = useState<string | null>(null);
  
  const [incomingDirectMessage, setIncomingDirectMessage] = useState<DirectMessageEvent | null>(null);
  const [incomingReaction, setIncomingReaction] = useState<{ peerId: string, messageId: string, emoji: string, sender: 'stranger' } | null>(null);
  const [incomingDirectStatus, setIncomingDirectStatus] = useState<DirectStatusEvent | null>(null);
  const [activeDirectConnections, setActiveDirectConnections] = useState<Set<string>>(new Set());

  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  
  const peerRef = useRef<Peer | null>(null);
  const mainConnRef = useRef<DataConnection | null>(null);
  const directConnsRef = useRef<Map<string, DataConnection>>(new Map());

  const channelRef = useRef<RealtimeChannel | null>(null);
  const myPeerIdRef = useRef<string | null>(null);
  const isMatchmakerRef = useRef(false);
  
  const connectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track peers we failed to connect to during this search session to avoid retrying ghosts
  const failedPeersRef = useRef<Set<string>>(new Set());

  // --- 1. INITIALIZE PEER ---
  useEffect(() => {
    if (!userProfile) return;
    if (peerRef.current && !peerRef.current.destroyed) return;

    const peer = persistentId 
      ? new Peer(persistentId, { debug: 1, config: { iceServers: ICE_SERVERS } })
      : new Peer({ debug: 1, config: { iceServers: ICE_SERVERS } });

    peerRef.current = peer;

    peer.on('open', (id) => {
      console.log('My Peer ID:', id);
      myPeerIdRef.current = id;
      setMyPeerId(id);
    });

    peer.on('connection', (conn) => {
      setupConnection(conn, conn.metadata as ConnectionMetadata);
    });

    peer.on('error', (err: any) => {
      console.error("Peer Error:", err);
      if (err.type === 'peer-unavailable' && isMatchmakerRef.current) {
         isMatchmakerRef.current = false;
      }
    });

    return () => {};
  }, [userProfile, persistentId]);

  // --- 2. POLL FOR OFFLINE MESSAGES ---
  useEffect(() => {
    if (!myPeerId) return;

    const checkOffline = async () => {
       const msgs = await fetchOfflineMessages(myPeerId);
       msgs.forEach(row => {
          const msg: Message = {
             id: row.id.toString(),
             text: row.type === 'text' ? row.content : undefined,
             fileData: row.type !== 'text' ? row.content : undefined,
             type: row.type as any,
             sender: 'stranger',
             timestamp: new Date(row.created_at).getTime(),
             status: 'sent'
          };
          setIncomingDirectMessage({ peerId: row.sender_id, message: msg });
       });
    };

    // Check immediately and then every 15s
    checkOffline();
    const interval = setInterval(checkOffline, 15000);
    return () => clearInterval(interval);
  }, [myPeerId]);

  // --- 3. PERSISTENT LOBBY ---
  useEffect(() => {
    if (!userProfile || !myPeerId) return;
    const channel = supabase.channel(MATCHMAKING_CHANNEL, { config: { presence: { key: myPeerId } } });
    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const newState = channel.presenceState();
        const allUsers = Object.values(newState).flat() as unknown as PresenceState[];
        setOnlineUsers(allUsers);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
           await channel.track({ peerId: myPeerId, status: 'idle', timestamp: Date.now(), profile: userProfile });
        }
      });

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [userProfile, myPeerId]);

  // --- MATCHMAKING ---
  useEffect(() => {
    // Only proceed if we are actively searching
    if (status !== ChatMode.SEARCHING) return;
    
    // Safety checks
    if (!myPeerId || isMatchmakerRef.current || mainConnRef.current) return;

    const attemptMatch = () => {
      if (status !== ChatMode.SEARCHING || isMatchmakerRef.current || mainConnRef.current) return;

      // Filter waiters (Waiters = people waiting for a connection)
      // Exclude self and any peers that failed to connect recently (ghosts)
      const waiters = onlineUsers
        .filter(u => 
          u.status === 'waiting' && 
          u.peerId !== myPeerId && 
          !failedPeersRef.current.has(u.peerId)
        )
        .sort((a, b) => a.timestamp - b.timestamp); // Connect to oldest waiter first (FIFO)

      if (waiters.length > 0) {
        const target = waiters[0];
        console.log("Match found, initiating:", target.peerId);
        
        isMatchmakerRef.current = true;
        
        try {
          const conn = peerRef.current?.connect(target.peerId, { 
            reliable: true, 
            metadata: { type: 'random' } 
          });

          if (conn) {
             setupConnection(conn, { type: 'random' });
             
             // Failsafe: if connection doesn't open in 3s (reduced from 5s), mark as failed and retry
             if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
             connectionTimeoutRef.current = setTimeout(() => {
                if (status === ChatMode.SEARCHING && !mainConnRef.current?.open) {
                   console.log("Connection timeout, skipping peer:", target.peerId);
                   
                   // Add to blacklist so we don't try this ghost again in this session
                   failedPeersRef.current.add(target.peerId);
                   
                   isMatchmakerRef.current = false;
                   mainConnRef.current = null;
                   conn.close();
                   // The interval will pick up the next waiter immediately
                }
             }, 3000); 
          } else {
             isMatchmakerRef.current = false;
          }
        } catch (err) {
          console.error("Connection failed:", err);
          isMatchmakerRef.current = false;
        }
      }
    };

    // Run immediately when dependencies change (e.g. onlineUsers updates)
    attemptMatch();

    // Poll frequently (500ms) to catch updates faster
    const interval = setInterval(attemptMatch, 500);
    return () => {
      clearInterval(interval);
      if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
    };
  }, [status, onlineUsers, myPeerId]); 

  // --- SETUP CONNECTION ---
  const handleIncomingData = useCallback((data: PeerData, conn: DataConnection) => {
    const isMain = conn === mainConnRef.current;
    
    if (data.type === 'disconnect') {
        if (isMain) {
           setStatus(ChatMode.DISCONNECTED);
           setDisconnectReason(data.payload || 'explicit');
           setMessages([]);
        } else {
           conn.close();
           directConnsRef.current.delete(conn.peer);
           setActiveDirectConnections(p => { const n = new Set(p); n.delete(conn.peer); return n; });
        }
        return;
    }

    if (data.type === 'message') {
      const msg: Message = {
        id: data.id || Date.now().toString(),
        sender: 'stranger',
        timestamp: Date.now(),
        type: data.dataType || 'text',
        text: (data.dataType === 'text') ? data.payload : undefined,
        fileData: (data.dataType !== 'text') ? data.payload : undefined,
        status: 'sent',
        reactions: []
      };
      if (isMain) setMessages(prev => [...prev, msg]);
      else setIncomingDirectMessage({ peerId: conn.peer, message: msg });
    }
    else if (data.type === 'typing') {
       if (isMain) setPartnerTyping(data.payload);
       else setIncomingDirectStatus({ peerId: conn.peer, type: 'typing', value: data.payload });
    }
    else if (data.type === 'recording') {
       if (isMain) setPartnerRecording(data.payload);
       else setIncomingDirectStatus({ peerId: conn.peer, type: 'recording', value: data.payload });
    }
    else if (data.type === 'profile' && isMain) {
       setPartnerProfile(data.payload);
    }
    else if (data.type === 'friend_request') {
       setFriends(curr => curr.some(f => f.id === conn.peer) ? curr : [...curr]);
       setFriendRequests(prev => prev.some(r => r.peerId === conn.peer) ? prev : [...prev, {profile: data.payload, peerId: conn.peer}]);
    }
    else if (data.type === 'friend_accept') {
       const key = 'chat_friends';
       try {
          const existing = JSON.parse(localStorage.getItem(key) || '[]');
          if (!existing.some((f:Friend) => f.id === conn.peer)) {
             const newF: Friend = { id: conn.peer, profile: data.payload, addedAt: Date.now(), lastSeen: Date.now() };
             localStorage.setItem(key, JSON.stringify([newF, ...existing]));
             setFriends([newF, ...existing]);
          }
       } catch(e){}
    }
    else if (data.type === 'reaction' && data.messageId) {
        setIncomingReaction({ peerId: conn.peer, messageId: data.messageId, emoji: data.payload, sender: 'stranger' });
        if (isMain) setMessages(p => p.map(m => m.id===data.messageId ? {...m, reactions:[...(m.reactions||[]), {emoji:data.payload, sender:'stranger'}]} : m));
    }
    else if (data.type === 'profile_update' && isMain) {
        setPartnerProfile(data.payload);
    }
    else if (data.type === 'vanish_mode' && isMain) {
        setRemoteVanishMode(data.payload);
    }
  }, []);

  const setupConnection = useCallback((conn: DataConnection, metadata: ConnectionMetadata) => {
    if (metadata?.type === 'random') {
      // Prevent double connections if we are already connected/connecting
      if (status === ChatMode.CONNECTED && mainConnRef.current?.open) {
          console.warn("Already connected, ignoring new connection attempt from", conn.peer);
          conn.close();
          return;
      }
      
      mainConnRef.current = conn;
      setPartnerPeerId(conn.peer);
    } else {
      directConnsRef.current.set(conn.peer, conn);
      setActiveDirectConnections(prev => new Set(prev).add(conn.peer));
    }

    conn.on('open', () => {
       if (conn === mainConnRef.current) {
          // Connection successful! Clear the safety timeout
          if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
          
          setStatus(ChatMode.CONNECTED);
          setMessages([INITIAL_GREETING]);
          isMatchmakerRef.current = false; // Reset matchmaker flag
          
          // Clear failed peers since we found a match
          failedPeersRef.current.clear();
       }
       if (userProfile) conn.send({ type: 'profile', payload: userProfile });
    });
    conn.on('data', (d) => handleIncomingData(d as any, conn));
    conn.on('close', () => {
       if (conn === mainConnRef.current) {
          setStatus(ChatMode.DISCONNECTED);
          setMessages([]);
       } else {
          directConnsRef.current.delete(conn.peer);
          setActiveDirectConnections(p => { const n = new Set(p); n.delete(conn.peer); return n; });
       }
    });
  }, [userProfile, handleIncomingData, status]);

  // --- ACTIONS ---
  const connect = useCallback(() => {
    if (channelRef.current && myPeerIdRef.current) {
       setStatus(ChatMode.SEARCHING);
       setMessages([]);
       setDisconnectReason(null);
       failedPeersRef.current.clear(); // Clear blacklist on new search
       channelRef.current.track({ peerId: myPeerIdRef.current, status: 'waiting', timestamp: Date.now(), profile: userProfile! });
    }
  }, [userProfile]);

  const disconnect = useCallback((reason: 'explicit' | 'network' | 'inactive' = 'explicit') => {
    // Clear any pending connection timeouts
    if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
    
    // Send explicit disconnect signal before closing
    if (mainConnRef.current?.open) {
        try {
           mainConnRef.current.send({ type: 'disconnect', payload: reason });
        } catch(e) {}
    }
    
    mainConnRef.current?.close();
    mainConnRef.current = null;
    isMatchmakerRef.current = false;
    failedPeersRef.current.clear();
    
    if (channelRef.current && myPeerIdRef.current) {
       channelRef.current.track({ peerId: myPeerIdRef.current, status: 'idle', timestamp: Date.now(), profile: userProfile! });
    }
    setStatus(ChatMode.IDLE);
    setMessages([]);
    if (reason === 'network') setDisconnectReason('local_network');
    else setDisconnectReason(null);
  }, [userProfile]);

  const sendMessage = useCallback((text: string) => {
     if (mainConnRef.current?.open) {
        const id = Date.now().toString();
        mainConnRef.current.send({ type: 'message', payload: text, dataType: 'text', id });
        setMessages(p => [...p, { id, text, type:'text', sender:'me', timestamp: Date.now(), reactions:[], status:'sent' }]);
     }
  }, []);

  const sendDirectMessage = useCallback(async (peerId: string, text: string, id?: string) => {
     const conn = directConnsRef.current.get(peerId);
     const msgId = id || Date.now().toString();
     
     // 1. Try P2P if open
     if (conn?.open) {
        conn.send({ type:'message', payload:text, dataType:'text', id: msgId });
     } 
     // 2. Fallback: Offline DB
     else if (myPeerId) {
        const msg: Message = { id: msgId, text, type: 'text', sender: 'me', timestamp: Date.now() };
        await sendOfflineMessage(peerId, myPeerId, msg);
     }
  }, [myPeerId]);
  
  const sendDirectImage = useCallback(async (peerId: string, b64: string, id?: string) => {
     const conn = directConnsRef.current.get(peerId);
     const msgId = id || Date.now().toString();
     if (conn?.open) {
        conn.send({ type:'message', payload:b64, dataType:'image', id: msgId });
     } else if (myPeerId) {
        const msg: Message = { id: msgId, fileData: b64, type: 'image', sender: 'me', timestamp: Date.now() };
        await sendOfflineMessage(peerId, myPeerId, msg);
     }
  }, [myPeerId]);

  const sendDirectAudio = useCallback(async (peerId: string, b64: string, id?: string) => {
     const conn = directConnsRef.current.get(peerId);
     const msgId = id || Date.now().toString();
     if (conn?.open) {
        conn.send({ type:'message', payload:b64, dataType:'audio', id: msgId });
     } else if (myPeerId) {
        const msg: Message = { id: msgId, fileData: b64, type: 'audio', sender: 'me', timestamp: Date.now() };
        await sendOfflineMessage(peerId, myPeerId, msg);
     }
  }, [myPeerId]);

  const callPeer = useCallback((peerId: string, profile?: UserProfile) => {
     if (!directConnsRef.current.has(peerId)) {
        const conn = peerRef.current?.connect(peerId, { reliable: true, metadata: { type: 'direct' } });
        if (conn) setupConnection(conn, { type: 'direct' });
     }
  }, [setupConnection]);

  // Load friends on init
  useEffect(() => {
     try {
       const f = localStorage.getItem('chat_friends');
       if (f) setFriends(JSON.parse(f));
     } catch(e){}
  }, []);

  // Offline handler
  useEffect(() => {
    const handleOffline = () => {
       if (status === ChatMode.CONNECTED || status === ChatMode.SEARCHING) {
          disconnect('network');
       }
    };
    window.addEventListener('offline', handleOffline);
    return () => window.removeEventListener('offline', handleOffline);
  }, [status, disconnect]);

  // Clean exit handler
  useEffect(() => {
    const handleBeforeUnload = () => {
       if (mainConnRef.current?.open) {
          mainConnRef.current.send({ type: 'disconnect', payload: 'inactive' });
       }
       directConnsRef.current.forEach(conn => {
          if (conn.open) conn.send({ type: 'disconnect', payload: 'inactive' });
       });
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const rejectFriendRequest = useCallback((peerId: string) => setFriendRequests(p => p.filter(r => r.peerId !== peerId)), []);
  const removeFriend = useCallback((peerId: string) => {
     const f = friends.filter(x => x.id !== peerId);
     setFriends(f);
     localStorage.setItem('chat_friends', JSON.stringify(f));
  }, [friends]);
  
  const sendImage = (b:string) => {
     if (mainConnRef.current?.open) {
        const id = Date.now().toString();
        mainConnRef.current.send({ type: 'message', payload: b, dataType: 'image', id });
        setMessages(p => [...p, { id, fileData: b, type:'image', sender:'me', timestamp: Date.now(), reactions:[], status:'sent' }]);
     }
  };
  const sendAudio = (b:string) => {
     if (mainConnRef.current?.open) {
        const id = Date.now().toString();
        mainConnRef.current.send({ type: 'message', payload: b, dataType: 'audio', id });
        setMessages(p => [...p, { id, fileData: b, type:'audio', sender:'me', timestamp: Date.now(), reactions:[], status:'sent' }]);
     }
  };
  const sendReaction = (mid:string, e:string) => {
     if (mainConnRef.current?.open) mainConnRef.current.send({type:'reaction', payload:e, messageId:mid});
     setMessages(p => p.map(m => m.id===mid ? {...m, reactions:[...(m.reactions||[]), {emoji:e, sender:'me'}]} : m));
  };
  const editMessage = (mid:string, t:string) => {
     if (mainConnRef.current?.open) mainConnRef.current.send({type:'edit_message', payload:t, messageId:mid});
     setMessages(p => p.map(m => m.id===mid ? {...m, text:t, isEdited:true} : m));
  };
  const sendTyping = (v:boolean) => mainConnRef.current?.send({type:'typing', payload:v});
  const sendRecording = (v:boolean) => mainConnRef.current?.send({type:'recording', payload:v});
  
  const updateMyProfile = (p: UserProfile) => {
     if (mainConnRef.current?.open) mainConnRef.current.send({type:'profile_update', payload:p});
  };
  const sendVanishMode = (m: boolean) => {
     if (mainConnRef.current?.open) mainConnRef.current.send({type:'vanish_mode', payload:m});
  };
  
  const sendFriendRequest = () => mainConnRef.current?.send({type:'friend_request', payload:userProfile});
  const acceptFriendRequest = (req: FriendRequest) => {
     const newF: Friend = { id: req.peerId, profile: req.profile, addedAt: Date.now(), lastSeen: Date.now() };
     const list = [newF, ...friends];
     setFriends(list);
     localStorage.setItem('chat_friends', JSON.stringify(list));
     setFriendRequests(p => p.filter(r => r.peerId !== req.peerId));
     // Send accept back if connected
     const conn = directConnsRef.current.get(req.peerId) || mainConnRef.current;
     if (conn?.open && conn.peer === req.peerId) conn.send({type:'friend_accept', payload: userProfile});
     else {
        const temp = peerRef.current?.connect(req.peerId);
        temp?.on('open', () => temp.send({type:'friend_accept', payload: userProfile}));
     }
  };
  const sendDirectTyping = (pid:string, v:boolean) => directConnsRef.current.get(pid)?.send({type:'typing', payload:v});
  const sendDirectFriendRequest = (pid:string) => {
     const conn = directConnsRef.current.get(pid) || peerRef.current?.connect(pid);
     if (conn) conn.on('open', () => conn.send({type:'friend_request', payload:userProfile}));
  };
  const sendDirectReaction = (pid:string, mid:string, e:string) => directConnsRef.current.get(pid)?.send({type:'reaction', payload:e, messageId:mid});

  return {
    messages, setMessages, status, partnerTyping, partnerRecording, partnerProfile, partnerPeerId, remoteVanishMode,
    onlineUsers, myPeerId, error, friends, friendRequests, 
    removeFriend, rejectFriendRequest, incomingReaction, incomingDirectMessage, incomingDirectStatus, 
    isPeerConnected: (pid: string) => activeDirectConnections.has(pid),
    sendMessage, sendImage, sendAudio, sendReaction, editMessage, sendTyping, sendRecording, updateMyProfile, sendVanishMode,
    sendFriendRequest, acceptFriendRequest, connect, callPeer, disconnect,
    sendDirectMessage, sendDirectImage, sendDirectAudio, sendDirectTyping, sendDirectFriendRequest, sendDirectReaction,
    disconnectReason
  };
};