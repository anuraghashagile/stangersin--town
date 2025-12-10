
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, getGlobalMessages, insertGlobalMessage } from '../lib/supabase';
import { Message, UserProfile } from '../types';

const GLOBAL_STORAGE_KEY = 'global_meet_history';

export const useGlobalChat = (userProfile: UserProfile | null, myPeerId: string | null) => {
  const [globalMessages, setGlobalMessages] = useState<Message[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // 1. Initial Load: Try LocalStorage first (instant), then Database (fresh)
  useEffect(() => {
    // Load local cache immediately
    try {
      const cached = localStorage.getItem(GLOBAL_STORAGE_KEY);
      if (cached) {
        setGlobalMessages(JSON.parse(cached));
      }
    } catch (e) {}

    // Fetch fresh from DB
    const fetchDb = async () => {
      const msgs = await getGlobalMessages();
      if (msgs && msgs.length > 0) {
        // We need to re-apply "sender: me" logic based on current ID
        const processed = msgs.map(m => ({
          ...m,
          sender: (m.senderPeerId === myPeerId) ? 'me' as const : 'stranger' as const
        }));
        setGlobalMessages(processed);
        localStorage.setItem(GLOBAL_STORAGE_KEY, JSON.stringify(processed));
      }
    };

    fetchDb();
  }, [myPeerId]); // Re-run if ID changes to update 'me' vs 'stranger'

  // 2. Subscribe to REALTIME DATABASE changes (Insert)
  useEffect(() => {
    const channel = supabase.channel('global-meet-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'global_messages' },
        (payload) => {
          const row = payload.new;
          const newMessage: Message = {
            id: row.id.toString(),
            text: row.content,
            sender: (row.sender_id === myPeerId) ? 'me' : 'stranger',
            senderName: row.sender_name,
            senderPeerId: row.sender_id,
            senderProfile: row.sender_profile,
            timestamp: new Date(row.created_at).getTime(),
            type: 'text'
          };

          setGlobalMessages(prev => {
            // Deduplicate
            if (prev.some(m => m.id === newMessage.id)) return prev;
            const updated = [...prev, newMessage];
            // Keep last 50
            if (updated.length > 50) return updated.slice(updated.length - 50);
            return updated;
          });
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [myPeerId]);

  // 3. Save to LocalStorage on update
  useEffect(() => {
    if (globalMessages.length > 0) {
      localStorage.setItem(GLOBAL_STORAGE_KEY, JSON.stringify(globalMessages));
    }
  }, [globalMessages]);

  const sendGlobalMessage = useCallback(async (text: string) => {
    if (!userProfile) return;

    // Optimistic Update
    const tempId = 'temp-' + Date.now();
    const optimisticMsg: Message = {
      id: tempId,
      text,
      sender: 'me',
      senderName: userProfile.username,
      senderPeerId: myPeerId || undefined,
      senderProfile: userProfile,
      timestamp: Date.now(),
      type: 'text'
    };

    setGlobalMessages(prev => [...prev, optimisticMsg]);

    try {
      await insertGlobalMessage(text, userProfile, myPeerId || undefined);
    } catch (e) {
      // If failed, remove optimistic message
      setGlobalMessages(prev => prev.filter(m => m.id !== tempId));
      alert("Failed to send message. Please checking your internet connection.");
    }
  }, [userProfile, myPeerId]);

  return {
    globalMessages,
    sendGlobalMessage
  };
};
