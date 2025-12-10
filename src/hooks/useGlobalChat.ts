
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, getGlobalMessages, insertGlobalMessage } from '../lib/supabase';
import { Message, UserProfile } from '../types';

export const useGlobalChat = (userProfile: UserProfile | null, myPeerId: string | null) => {
  const [globalMessages, setGlobalMessages] = useState<Message[]>([]);
  const [isReady, setIsReady] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // 1. Initial Load from Database (Best Effort)
  useEffect(() => {
    let mounted = true;
    const loadInitial = async () => {
      // Try to load history, if it fails (table missing), we just start empty
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
      
      setGlobalMessages(formatted);
      setIsReady(true);
    };

    loadInitial();
    
    return () => { mounted = false; };
  }, []); // Run once on mount

  // 2. Subscribe to Realtime Updates (Hybrid: DB + Broadcast)
  useEffect(() => {
    // We use a robust channel that listens to BOTH database changes (persistence) AND broadcasts (fallback)
    const channel = supabase.channel('global-meet-v2');
    channelRef.current = channel;

    channel
      // A. Listen for DB inserts (Primary)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'global_messages' },
        (payload) => {
          handleIncomingMessage(payload.new, 'db');
        }
      )
      // B. Listen for Broadcasts (Fallback if DB fails)
      .on(
        'broadcast',
        { event: 'fallback_message' },
        (payload) => {
          handleIncomingMessage(payload.payload, 'broadcast');
        }
      )
      .subscribe((status) => {
         if (status === 'SUBSCRIBED') {
            setIsReady(true);
         }
      });

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [myPeerId]);

  const handleIncomingMessage = useCallback((row: any, source: 'db' | 'broadcast') => {
      // Determine sender
      const isMe = row.sender_id === myPeerId;
      
      const newMessage: Message = {
        id: row.id?.toString() || row.tempId || Date.now().toString(),
        text: row.content,
        sender: isMe ? 'me' : 'stranger',
        senderName: row.sender_name,
        senderPeerId: row.sender_id,
        senderProfile: row.sender_profile,
        timestamp: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
        type: 'text'
      };

      setGlobalMessages(prev => {
         // Deduplicate: If we already have this message (by ID or content+timestamp close match), skip
         // This prevents seeing it twice if both DB and Broadcast succeed
         const exists = prev.some(m => m.id === newMessage.id || (m.text === newMessage.text && m.senderPeerId === newMessage.senderPeerId && Math.abs(m.timestamp - newMessage.timestamp) < 1000));
         if (exists) return prev;
         
         const next = [...prev, newMessage];
         if (next.length > 100) return next.slice(next.length - 100);
         return next;
      });
  }, [myPeerId]);

  // 3. Send Function (Try DB -> Fallback to Broadcast)
  const sendGlobalMessage = useCallback(async (text: string) => {
    if (!userProfile || !myPeerId) return;

    // Optimistic Update (Optional, but safer to wait for ack to ensure others see it)
    // We rely on the feedback loop

    const messageData = {
      content: text,
      sender_id: myPeerId,
      sender_name: userProfile.username,
      sender_profile: userProfile,
      created_at: new Date().toISOString(),
      tempId: Date.now().toString() + Math.random().toString(36).substr(2, 9)
    };

    try {
      // Step 1: Try Persistent Insert
      await insertGlobalMessage(text, userProfile, myPeerId);
    } catch (e) {
      console.warn("DB Insert Failed, falling back to Broadcast:", e);
      // Step 2: Fallback to Broadcast if DB fails
      if (channelRef.current) {
         channelRef.current.send({
            type: 'broadcast',
            event: 'fallback_message',
            payload: messageData
         });
      }
    }
  }, [userProfile, myPeerId]);

  return {
    globalMessages,
    sendGlobalMessage,
    isReady: isReady
  };
};
