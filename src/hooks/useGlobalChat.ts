
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, getGlobalMessages, insertGlobalMessage } from '../lib/supabase';
import { Message, UserProfile } from '../types';

export const useGlobalChat = (userProfile: UserProfile | null, myPeerId: string | null) => {
  const [globalMessages, setGlobalMessages] = useState<Message[]>([]);
  const [isReady, setIsReady] = useState(false);

  // 1. Initial Load from Database
  useEffect(() => {
    let mounted = true;
    const loadInitial = async () => {
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
  }, []); // Run once on mount to fetch history

  // 2. Subscribe to Realtime Updates
  useEffect(() => {
    const channel = supabase.channel('global-chat-fresh')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'global_messages' },
        (payload) => {
          const row = payload.new;
          
          // Determine if it's me (checking current myPeerId ref would be ideal, but state works for now)
          // We use the passed myPeerId to determine 'me' vs 'stranger'
          const isMe = row.sender_id === myPeerId;
          
          const newMessage: Message = {
            id: row.id.toString(),
            text: row.content,
            sender: isMe ? 'me' : 'stranger',
            senderName: row.sender_name,
            senderPeerId: row.sender_id,
            senderProfile: row.sender_profile,
            timestamp: new Date(row.created_at).getTime(),
            type: 'text'
          };

          setGlobalMessages(prev => {
             // Deduplicate by ID just in case
             if (prev.some(m => m.id === newMessage.id)) return prev;
             // Keep size manageable
             const next = [...prev, newMessage];
             if (next.length > 100) return next.slice(next.length - 100);
             return next;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [myPeerId]); // Re-subscribe if ID changes to ensure 'me' logic is correct

  // 3. Send Function
  const sendGlobalMessage = useCallback(async (text: string) => {
    if (!userProfile || !myPeerId) {
       console.warn("Cannot send global message: Profile or ID missing");
       return;
    }

    try {
      await insertGlobalMessage(text, userProfile, myPeerId);
      // We rely on the subscription to add the message to the list
      // This ensures what we see is what is actually in the DB
    } catch (e) {
      alert("Failed to send message. Please checking your internet connection.");
    }
  }, [userProfile, myPeerId]);

  return {
    globalMessages,
    sendGlobalMessage,
    isReady: isReady && !!myPeerId
  };
};
