import { useState, useCallback, useRef, useEffect } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { supabase, fetchOfflineMessages } from '../lib/supabase';
import { Message, ChatMode, PeerData, PresenceState, UserProfile, ConnectionMetadata, DirectMessageEvent, DirectStatusEvent, Friend, FriendRequest } from '../types';
import { ICE_SERVERS, STRANGER_DISCONNECTED_MSG } from '../constants';

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
  
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [activeDirectConnections, setActiveDirectConnections] = useState<Set<string>>(new Set());
  
  const peerRef = useRef<Peer | null>(null);
  const mainConnRef = useRef<DataConnection | null>(null);
  const directConnsRef = useRef<Map<string, DataConnection>>(new Map());

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const isMatchmakerRef = useRef(false);
  const statusRef = useRef<ChatMode>(ChatMode.IDLE); // Track status for callbacks
  
  const connectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failedPeersRef = useRef<Set<string>>(new Set());

  // Keep ref updated
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // --- 1. INITIALIZE PEER ---
  useEffect(() => {
    if (!userProfile) return;
    if (peerRef.current && !peerRef.current.destroyed) return;

    // Use persistentId if provided, otherwise let PeerJS generate a random one (prevents collisions in local testing)
    const peer = persistentId 
      ? new Peer(persistentId, { debug: 1, config: { iceServers: ICE_SERVERS } })
      : new Peer({ debug: 1, config: { iceServers: ICE_SERVERS } });

    peerRef.current = peer;

    peer.on('open', (id) => {
      console.log('My Peer ID:', id);
      setMyPeerId(id);
    });

    peer.on('connection', (conn) => {
      const meta = conn.metadata as ConnectionMetadata;
      
      // STRICT CHECK 1: Only accept random connections if we are actively searching or waiting
      // This prevents "User B" from getting connected if they are just idle or in menu
      if (meta?.type === 'random') {
        const currentStatus = statusRef.current;
        
        // Check 1: Are we in the right mode?
        if (currentStatus !== ChatMode.SEARCHING && currentStatus !== ChatMode.WAITING) {
           console.warn(`Rejecting random connection from ${conn.peer}: Status is ${currentStatus}`);
           conn.close();
           return;
        }

        // Check 2: Do we already have an active/connecting main connection?
        // CRITICAL FIX: Check if mainConnRef.current exists (even if not open yet).
        // This prevents race conditions where two users connect simultaneously.
        if (mainConnRef.current) {
           console.warn(`Rejecting random connection from ${conn.peer}: Session busy`);
           conn.close();
           return;
        }
      }
      
      setupConnection(conn, meta);
    });

    peer.on('error', (err: any) => {
      console.error("Peer Error:", err);
      // If we were trying to connect as matchmaker and failed, reset flag
      if (err.type === 'peer-unavailable' && isMatchmakerRef.current) {
         isMatchmakerRef.current = false;
         // Clean up if this was the main connection attempt
         if (statusRef.current === ChatMode.SEARCHING) {
             mainConnRef.current = null;
         }
      }
    });

    return () => {
      // Cleanup is handled by disconnect() usually, but here we just leave it for re-renders
    };
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

  // --- MATCHMAKING (FIFO Queue) ---
  useEffect(() => {
    // Only act if we are actively searching
    if (status !== ChatMode.SEARCHING) return;
    // Check if we already have a connection object (even if pending)
    if (!myPeerId || isMatchmakerRef.current || mainConnRef.current) return;

    // FIFO Logic:
    // 1. Filter for users who are 'waiting'
    // 2. Exclude self
    // 3. Exclude recently failed peers
    // 4. Sort by timestamp ASCENDING (Oldest waiter gets priority)
    const waiters = onlineUsers
      .filter(u => 
        u.status === 'waiting' && 
        u.peerId !== myPeerId && 
        !failedPeersRef.current.has(u.peerId)
      )
      .sort((a, b) => a.timestamp - b.timestamp);

    if (waiters.length > 0) {
      const target = waiters[0];
      console.log(`Attempting FIFO Match: ${target.peerId} (Waited ${(Date.now() - target.timestamp)/1000}s)`);
      
      isMatchmakerRef.current = true;
      
      // Small jitter to reduce collision if two users search exactly simultaneously
      setTimeout(() => {
         // Double check we are still searching and haven't been connected to in the meantime
         if (statusRef.current !== ChatMode.SEARCHING || mainConnRef.current) {
             isMatchmakerRef.current = false;
             return;
         }

         try {
            const conn = peerRef.current?.connect(target.peerId, { 
              reliable: true, 
              metadata: { type: 'random' } 
            });

            if (conn) {
               setupConnection(conn, { type: 'random' });
               
               // Timeout failsafe
               if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
               connectionTimeoutRef.current = setTimeout(() => {
                  if (statusRef.current === ChatMode.SEARCHING && !mainConnRef.current?.open) {
                     console.log("Connection timed out, retrying...");
                     conn.close();
                     // Important: Clear the ref so we can try again
                     mainConnRef.current = null;
                     failedPeersRef.current.add(target.peerId);
                     isMatchmakerRef.current = false;
                     // Status remains SEARCHING, effect will re-run
                  }
               }, 5000);
            } else {
               isMatchmakerRef.current = false;
            }
         } catch (e) {
            console.error("Connection attempt failed", e);
            isMatchmakerRef.current = false;
         }
      }, Math.random() * 500 + 100);
    }
  }, [status, onlineUsers, myPeerId]);

  // --- CONNECTION SETUP ---
  const setupConnection = (conn: DataConnection, metadata: ConnectionMetadata) => {
    const isMain = metadata.type === 'random';

    if (isMain) {
       // Strict check: If we already have a connection reference (even if pending), abort.
       if (mainConnRef.current) {
         console.warn("Closing new random connection because active/pending one exists");
         conn.close(); 
         return;
       }
       mainConnRef.current = conn;
    } else {
       directConnsRef.current.set(conn.peer, conn);
       setActiveDirectConnections(prev => new Set(prev).add(conn.peer));
    }

    conn.on('open', () => {
      console.log(`Connection opened with ${conn.peer} (${metadata.type})`);
      if (isMain) {
        if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
        setStatus(ChatMode.CONNECTED);
        setPartnerPeerId(conn.peer);
        isMatchmakerRef.current = false;
        failedPeersRef.current.clear();
        
        // Update presence to 'paired'
        channelRef.current?.track({ peerId: myPeerId, status: 'paired', timestamp: Date.now(), profile: userProfile });
      }

      // Handshake: Send my profile immediately
      if (userProfile) {
         conn.send({ type: 'profile', payload: userProfile });
      }
    });

    conn.on('data', (data: any) => {
      const payload = data as PeerData;
      
      if (payload.type === 'message') {
        const newMsg: Message = {
          id: payload.id || Date.now().toString(),
          text: payload.dataType === 'text' ? payload.payload : undefined,
          fileData: payload.dataType !== 'text' ? payload.payload : undefined,
          sender: 'stranger',
          timestamp: Date.now(),
          type: payload.dataType || 'text',
          reactions: []
        };
        
        if (isMain) {
          setMessages(prev => [...prev, newMsg]);
          // AUTO-SEND SEEN RECEIPT
          if (payload.id) {
            conn.send({ type: 'seen', messageId: payload.id });
          }
        } else {
          setIncomingDirectMessage({ peerId: conn.peer, message: newMsg });
        }
      }
      
      else if (payload.type === 'profile') {
         // Received partner's profile
         const profile = payload.payload as UserProfile;
         if (isMain) {
            setPartnerProfile(profile);
            setMessages(prev => [
               ...prev, 
               {
                 id: 'sys-conn-' + Date.now(),
                 text: `Connected with ${profile.username}.`,
                 sender: 'system',
                 timestamp: Date.now(),
                 type: 'text'
               }
            ]);
         }
      }
      
      else if (payload.type === 'typing') {
         if (isMain) setPartnerTyping(payload.payload);
         else setIncomingDirectStatus({ peerId: conn.peer, type: 'typing', value: payload.payload });
      }
      
      else if (payload.type === 'recording') {
         if (isMain) setPartnerRecording(payload.payload);
         else setIncomingDirectStatus({ peerId: conn.peer, type: 'recording', value: payload.payload });
      }
      
      else if (payload.type === 'disconnect') {
        if (isMain) {
           conn.close();
           handleMainDisconnect('explicit');
        }
      }

      else if (payload.type === 'vanish_mode') {
         if (isMain) setRemoteVanishMode(payload.payload);
      }
      
      else if (payload.type === 'reaction') {
         if (isMain) {
            setMessages(prev => prev.map(m => {
               if (m.id === payload.messageId) {
                  return { ...m, reactions: [...(m.reactions || []), { emoji: payload.payload, sender: 'stranger' }] };
               }
               return m;
            }));
         } else {
            setIncomingReaction({ peerId: conn.peer, messageId: payload.messageId!, emoji: payload.payload, sender: 'stranger' });
         }
      }

      else if (payload.type === 'edit_message') {
         if (isMain) {
            setMessages(prev => prev.map(m => m.id === payload.messageId ? { ...m, text: payload.payload, isEdited: true } : m));
         }
      }

      else if (payload.type === 'friend_request') {
         if (payload.payload?.username) {
            setFriendRequests(prev => {
               // Check if we already have a request from this UID if available, else PeerId
               const existing = prev.find(r => 
                 (r.profile.uid && payload.payload.uid && r.profile.uid === payload.payload.uid) || 
                 r.peerId === conn.peer
               );
               if (existing) return prev;
               return [...prev, { peerId: conn.peer, profile: payload.payload }];
            });
         }
      }

      else if (payload.type === 'friend_accept') {
         if (payload.payload?.username) {
            setFriends(prev => {
               const existing = prev.find(f => 
                  (f.profile.uid && payload.payload.uid && f.profile.uid === payload.payload.uid) ||
                  f.id === conn.peer
               );
               if (existing) return prev;
               return [...prev, { id: conn.peer, profile: payload.payload, addedAt: Date.now() }];
            });
         }
      }
      
      else if (payload.type === 'seen') {
         if (isMain) {
            setMessages(prev => prev.map(m => m.id === payload.messageId ? { ...m, status: 'seen' } : m));
         }
      }
    });

    conn.on('close', () => {
      console.log(`Connection closed with ${conn.peer}`);
      if (isMain) {
        if (statusRef.current === ChatMode.CONNECTED) {
          handleMainDisconnect('network');
        } else if (statusRef.current === ChatMode.SEARCHING) {
           isMatchmakerRef.current = false;
           mainConnRef.current = null;
        }
      } else {
         directConnsRef.current.delete(conn.peer);
         setActiveDirectConnections(prev => { const n = new Set(prev); n.delete(conn.peer); return n; });
      }
    });

    conn.on('error', (err) => {
      console.error("Connection Error:", err);
      if (isMain) {
        if (statusRef.current === ChatMode.CONNECTED) handleMainDisconnect('network');
        else {
           isMatchmakerRef.current = false; 
           mainConnRef.current = null;
        }
      }
    });
  };

  const handleMainDisconnect = (reason: string) => {
    setDisconnectReason(reason);
    setStatus(ChatMode.DISCONNECTED);
    setPartnerProfile(null);
    setPartnerPeerId(null);
    setRemoteVanishMode(null);
    setMessages(prev => [...prev, STRANGER_DISCONNECTED_MSG]);
    mainConnRef.current = null;
    isMatchmakerRef.current = false;
    
    channelRef.current?.track({ peerId: myPeerId, status: 'idle', timestamp: Date.now(), profile: userProfile });
  };

  // --- ACTIONS ---

  const connect = async () => {
    if (!myPeerId) return;
    setStatus(ChatMode.SEARCHING);
    setMessages([]);
    setError(null);
    setDisconnectReason(null);
    setPartnerProfile(null);
    
    await channelRef.current?.track({ peerId: myPeerId, status: 'waiting', timestamp: Date.now(), profile: userProfile });
  };

  const disconnect = () => {
    if (mainConnRef.current) {
      mainConnRef.current.send({ type: 'disconnect' });
      mainConnRef.current.close();
    }
    handleMainDisconnect('local_network');
    setStatus(ChatMode.IDLE);
  };

  const sendMessage = (text: string) => {
    const id = Date.now().toString();
    const msg: Message = { id, text, sender: 'me', timestamp: Date.now(), type: 'text', reactions: [], status: 'sent' };
    setMessages(prev => [...prev, msg]);
    if (mainConnRef.current?.open) {
      mainConnRef.current.send({ type: 'message', payload: text, dataType: 'text', id });
    }
  };

  const sendImage = (base64: string) => {
    const id = Date.now().toString();
    const msg: Message = { id, fileData: base64, sender: 'me', timestamp: Date.now(), type: 'image', reactions: [], status: 'sent' };
    setMessages(prev => [...prev, msg]);
    if (mainConnRef.current?.open) {
      mainConnRef.current.send({ type: 'message', payload: base64, dataType: 'image', id });
    }
  };
  
  const sendAudio = (base64: string) => {
    const id = Date.now().toString();
    const msg: Message = { id, fileData: base64, sender: 'me', timestamp: Date.now(), type: 'audio', reactions: [], status: 'sent' };
    setMessages(prev => [...prev, msg]);
    if (mainConnRef.current?.open) {
      mainConnRef.current.send({ type: 'message', payload: base64, dataType: 'audio', id });
    }
  };

  const sendReaction = (messageId: string, emoji: string) => {
     setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reactions: [...(m.reactions || []), { emoji, sender: 'me' }] } : m));
     if (mainConnRef.current?.open) {
        mainConnRef.current.send({ type: 'reaction', messageId, payload: emoji });
     }
  };

  const editMessage = (id: string, text: string) => {
     setMessages(prev => prev.map(m => m.id === id ? { ...m, text, isEdited: true } : m));
     if (mainConnRef.current?.open) {
        mainConnRef.current.send({ type: 'edit_message', messageId: id, payload: text });
     }
  };

  const sendTyping = (isTyping: boolean) => {
    if (mainConnRef.current?.open) mainConnRef.current.send({ type: 'typing', payload: isTyping });
  };
  
  const sendRecording = (isRec: boolean) => {
    if (mainConnRef.current?.open) mainConnRef.current.send({ type: 'recording', payload: isRec });
  };

  const updateMyProfile = (newProfile: UserProfile) => {
     channelRef.current?.track({ peerId: myPeerId, status: status === ChatMode.SEARCHING ? 'waiting' : 'idle', timestamp: Date.now(), profile: newProfile });
  };

  const sendVanishMode = (enabled: boolean) => {
     if (mainConnRef.current?.open) mainConnRef.current.send({ type: 'vanish_mode', payload: enabled });
  };

  // --- FRIEND ACTIONS ---
  
  const sendFriendRequest = () => {
     if (mainConnRef.current?.open && userProfile) {
        mainConnRef.current.send({ type: 'friend_request', payload: userProfile });
     }
  };
  
  const sendDirectFriendRequest = (peerId: string) => {
     const conn = directConnsRef.current.get(peerId);
     if (conn?.open && userProfile) {
        conn.send({ type: 'friend_request', payload: userProfile });
     } else if (peerRef.current) {
        const temp = peerRef.current.connect(peerId, { metadata: { type: 'direct' }});
        temp.on('open', () => {
           temp.send({ type: 'profile', payload: userProfile });
           temp.send({ type: 'friend_request', payload: userProfile });
           setTimeout(() => temp.close(), 2000); 
        });
     }
  };

  const acceptFriendRequest = (request: FriendRequest) => {
     setFriends(prev => {
        const existing = prev.find(f => 
           (f.profile.uid && request.profile.uid && f.profile.uid === request.profile.uid) ||
           f.id === request.peerId
        );
        if (existing) return prev;
        return [...prev, { id: request.peerId, profile: request.profile, addedAt: Date.now() }];
     });
     setFriendRequests(prev => prev.filter(r => r.peerId !== request.peerId));
     
     const conn = mainConnRef.current?.peer === request.peerId ? mainConnRef.current : directConnsRef.current.get(request.peerId);
     if (conn?.open && userProfile) {
        conn.send({ type: 'friend_accept', payload: userProfile });
     }
     
     // Save to local storage
     setTimeout(() => {
        const current = JSON.parse(localStorage.getItem('chat_friends') || '[]');
        const updated = [...current, { id: request.peerId, profile: request.profile, addedAt: Date.now() }];
        localStorage.setItem('chat_friends', JSON.stringify(updated));
     }, 0);
  };
  
  const rejectFriendRequest = (peerId: string) => {
     setFriendRequests(prev => prev.filter(r => r.peerId !== peerId));
  };
  
  const removeFriend = (peerId: string) => {
     setFriends(prev => prev.filter(f => f.id !== peerId));
     const current = JSON.parse(localStorage.getItem('chat_friends') || '[]');
     const updated = current.filter((f: Friend) => f.id !== peerId);
     localStorage.setItem('chat_friends', JSON.stringify(updated));
  };

  // --- DIRECT CHAT ACTIONS ---
  
  const callPeer = (peerId: string, profile?: UserProfile) => {
     if (directConnsRef.current.has(peerId) && directConnsRef.current.get(peerId)?.open) {
        return;
     }
     if (peerRef.current) {
        const conn = peerRef.current.connect(peerId, { metadata: { type: 'direct' } });
        setupConnection(conn, { type: 'direct' });
     }
  };
  
  const sendDirectMessage = (peerId: string, text: string, id?: string) => {
     const conn = directConnsRef.current.get(peerId);
     if (conn?.open) {
        conn.send({ type: 'message', payload: text, dataType: 'text', id });
     }
  };
  
  const sendDirectImage = (peerId: string, base64: string, id?: string) => {
     const conn = directConnsRef.current.get(peerId);
     if (conn?.open) conn.send({ type: 'message', payload: base64, dataType: 'image', id });
  };
  
  const sendDirectAudio = (peerId: string, base64: string, id?: string) => {
     const conn = directConnsRef.current.get(peerId);
     if (conn?.open) conn.send({ type: 'message', payload: base64, dataType: 'audio', id });
  };
  
  const sendDirectReaction = (peerId: string, messageId: string, emoji: string) => {
     const conn = directConnsRef.current.get(peerId);
     if (conn?.open) conn.send({ type: 'reaction', messageId, payload: emoji });
  };
  
  const sendDirectTyping = (peerId: string, isTyping: boolean) => {
     const conn = directConnsRef.current.get(peerId);
     if (conn?.open) conn.send({ type: 'typing', payload: isTyping });
  };
  
  const isPeerConnected = (peerId: string) => directConnsRef.current.get(peerId)?.open || false;

  return {
    messages, setMessages, status, partnerTyping, partnerRecording, partnerProfile, partnerPeerId, remoteVanishMode,
    onlineUsers, myPeerId, error,
    friends, friendRequests, removeFriend,
    incomingReaction, incomingDirectMessage, incomingDirectStatus,
    isPeerConnected,
    sendMessage, sendImage, sendAudio, sendReaction, editMessage, sendTyping, sendRecording,
    sendDirectMessage, sendDirectImage, sendDirectAudio, sendDirectTyping, sendDirectFriendRequest, sendDirectReaction,
    updateMyProfile, sendVanishMode,
    sendFriendRequest, acceptFriendRequest, rejectFriendRequest,
    connect, disconnect, callPeer,
    disconnectReason
  };
};