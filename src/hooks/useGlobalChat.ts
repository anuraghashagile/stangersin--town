
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, getGlobalMessages, insertGlobalMessage } from '../lib/supabase';
import { Message, UserProfile } from '../types';

export const useGlobalChat = (userProfile: UserProfile | null, myPeerId: string | null) => {
  const [globalMessages, setGlobalMessages] = useState<Message[]>(() => {
     // Initialize from LocalStorage for instant display
     if (typeof window !== 'undefined') {
        try {
           const saved = localStorage.getItem('global_meet_messages');
           if (saved) return JSON.parse(saved);
        } catch(e) {}
     }
     return [];
  });
  
  const [isReady, setIsReady] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Persistence: Save to LocalStorage whenever messages change
  useEffect(() => {
     try {
        localStorage.setItem('global_meet_messages', JSON.stringify(globalMessages));
     } catch(e) {}
  }, [globalMessages]);

  // 1. Initial History Load (Merge with local)
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const data = await getGlobalMessages();
      if (!mounted) return;
      
      const formatted: Message[] = data.reverse().map((row: any) => ({
        id: row.id.toString(),
        text: row.content,
        sender: row.sender_id === myPeerId ? 'me' : 'stranger',
        senderName: row.sender_name,
        senderPeerId: row.sender_id,
        senderProfile: row.sender_profile,
        timestamp: new Date(row.created_at).getTime(),
        type: 'text'
      }));
      
      setGlobalMessages(prev => {
         // Deduplicate
         const existingIds = new Set(prev.map(m => m.id));
         const newMsgs = formatted.filter(m => !existingIds.has(m.id));
         if (newMsgs.length === 0) return prev;
         
         const combined = [...prev, ...newMsgs].sort((a,b) => a.timestamp - b.timestamp);
         // Keep latest 100
         return combined.slice(-100);
      });
      setIsReady(true);
    };
    load();
    return () => { mounted = false; };
  }, [myPeerId]);

  // 2. Realtime Subscription (Broadcast + DB Sync)
  useEffect(() => {
    const channel = supabase.channel('global-meet-v3');
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'message' }, (payload) => {
         const msg = payload.payload as Message;
         // Ignore my own broadcasts to prevent duplication
         if (msg.senderPeerId === myPeerId) return;

         setGlobalMessages(prev => {
            if (prev.some(m => m.id === msg.id)) return prev;
            return [...prev, { ...msg, sender: 'stranger' }];
         });
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setIsReady(true);
      });

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [myPeerId]);

  // 3. Send Message (Optimistic Broadcast)
  const sendGlobalMessage = useCallback(async (text: string) => {
    if (!userProfile || !myPeerId) return;

    const tempId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
    const newMessage: Message = {
      id: tempId,
      text: text,
      sender: 'me',
      senderName: userProfile.username,
      senderPeerId: myPeerId,
      senderProfile: userProfile,
      timestamp: Date.now(),
      type: 'text'
    };

    // A. Optimistic Local Update
    setGlobalMessages(prev => [...prev, newMessage]);

    // B. Instant Broadcast to others
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'message',
        payload: newMessage
      });
    }

    // C. Background DB Insert (Persistence)
    insertGlobalMessage(text, userProfile, myPeerId);

  }, [userProfile, myPeerId]);

  return {
    globalMessages,
    sendGlobalMessage,
    isReady
  };
};
