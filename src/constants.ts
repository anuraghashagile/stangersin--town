
import { Message } from './types';

export const INITIAL_GREETING: Message = {
  id: 'init-1',
  text: "You are now connected. Say hello!",
  sender: 'system',
  timestamp: Date.now(),
  type: 'text',
};

export const STRANGER_DISCONNECTED_MSG: Message = {
  id: 'sys-disc',
  text: "Stranger has disconnected.",
  sender: 'system',
  timestamp: Date.now(),
  type: 'text',
};

export const COMMON_INTERESTS = [
  "Tech", "Anime", "Movies", "Travel", "Music", "Gaming", "Art", "Books", "Fitness", "Food", "Cricket", "Football"
];

// Massive list of free STUN servers to punch through Mobile NATs
export const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478' },
  { urls: 'stun:stun.ekiga.net' },
  { urls: 'stun:stun.ideasip.com' },
  { urls: 'stun:stun.schlund.de' },
  { urls: 'stun:stun.voiparound.com' },
  { urls: 'stun:stun.voipbuster.com' },
  { urls: 'stun:stun.voipstunt.com' },
  { urls: 'stun:stun.voxgratia.org' }
];
