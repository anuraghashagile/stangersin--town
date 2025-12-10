
# TalkWithStrangers - Production Ready (No-SQL Edition)

A fully functional, anonymous 1-on-1 chat application using **Supabase Presence** for zero-config matchmaking.

## 🚀 Instant Deployment

No setup required. The project uses Supabase Realtime "Presence" (virtual lobbies) to connect users, meaning **you do NOT need to create any database tables or run any SQL**.

It works out of the box with the provided credentials.

## 🌟 Architecture

1. **User Joins**: Connects to the `global-lobby-v1` channel.
2. **Match Found**: Uses Realtime Presence to see if anyone else is waiting.
3. **P2P Connection**: If a waiter is found, connects instantly via PeerJS.

## 🛠️ Environment Variables

The project comes pre-configured for instant deployment. 
You only need to set `API_KEY` (Google Gemini API) in your Vercel project settings if you want the "AI Chat" mode to work.

## 📦 Tech Stack

- **React / Vite** (Frontend)
- **Supabase Realtime** (Signaling/Lobby)
- **PeerJS** (WebRTC P2P Data)
- **TailwindCSS** (Styling)
- **Google Gemini** (AI Persona)
