export const config = {
  runtime: 'edge',
};

export default function handler(request: Request) {
  return new Response(
    JSON.stringify({
      status: 'ok',
      timestamp: Date.now(),
      service: 'anon-chat-signaling'
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    }
  );
}