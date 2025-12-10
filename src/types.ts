
export enum ChatMode {
  IDLE = 'IDLE',
  SEARCHING = 'SEARCHING',
  WAITING = 'WAITING',
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  ERROR = 'ERROR'
}

export type SessionType = 'random' | 'direct';

export interface UserProfile {
  username: string;
  age: string;
  gender: string;
  interests: string[];
  location: string;
}

export type MessageType = 'text' | 'image' | 'audio';

export interface Reaction {
  emoji: string;
  sender: 'me' | 'stranger';
}

export interface Message {
  id: string;
  text?: string;
  fileData?: string; // Base64 string for images/audio
  type: MessageType;
  sender: 'me' | 'stranger' | 'system';
  senderName?: string; // Added for Global Chat identification
  senderPeerId?: string; // Added for P2P connection from Global Chat
  senderProfile?: UserProfile; // Added for Profile Modal display
  timestamp: number;
  isVanish?: boolean;
  reactions?: Reaction[]; // Added for reactions
  isEdited?: boolean; // Added for edit status
  status?: 'sent' | 'seen'; // Added for read receipts
}

export interface PeerData {
  type: 'message' | 'typing' | 'recording' | 'disconnect' | 'profile' | 'profile_update' | 'vanish_mode' | 'reaction' | 'edit_message' | 'friend_request' | 'friend_accept' | 'seen';
  payload?: any;
  dataType?: MessageType;
  messageId?: string; // For targeting specific messages (reactions/edits/seen)
  id?: string; // For syncing message IDs across peers
}

// Presence state for the lobby
export interface PresenceState {
  peerId: string;
  status: 'waiting' | 'paired' | 'busy';
  timestamp: number;
  profile?: UserProfile; // Added to show names in Online list
}

export interface RecentPeer {
  id: string;
  peerId: string; // The last known session ID
  profile: UserProfile;
  metAt: number;
}

export interface Friend {
  id: string; // unique ID or peer ID used when adding
  profile: UserProfile;
  addedAt: number;
  lastSeen?: number; // Added for Last Seen functionality
}

export interface FriendRequest {
  peerId: string;
  profile: UserProfile;
}

export interface AppSettings {
  vanishMode: boolean;
}

// Metadata to distinguish connection intent
export interface ConnectionMetadata {
  type: 'random' | 'direct';
}

export interface DirectMessageEvent {
  peerId: string;
  message: Message;
}

export interface DirectStatusEvent {
  peerId: string;
  type: 'typing' | 'recording';
  value: boolean;
}
