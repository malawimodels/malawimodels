import { supabase } from '../supabase';

type AblyRealtime = any;

let clientPromise: Promise<AblyRealtime | null> | null = null;

const isAblyEnabled = (): boolean => {
  if (import.meta.env.DEV && import.meta.env.VITE_ENABLE_ABLY_DEV !== 'true') return false;
  return true;
};

const getAccessToken = async (): Promise<string | null> => {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
};

const requestAblyToken = async (): Promise<Record<string, unknown> | null> => {
  const accessToken = await getAccessToken();
  if (!accessToken) return null;

  const response = await fetch('/api/ably-token', {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  }).catch(() => null);

  if (!response?.ok) return null;
  return response.json().catch(() => null);
};

export const getAblyClient = async (): Promise<AblyRealtime | null> => {
  if (!isAblyEnabled()) return null;
  if (clientPromise) return clientPromise;

  clientPromise = (async () => {
    let nextTokenRequest = await requestAblyToken();
    if (!nextTokenRequest) return null;

    const Ably = await import('ably');
    return new Ably.Realtime({
      authCallback: async (_tokenParams: unknown, callback: (error: unknown, tokenRequest: unknown) => void) => {
        const tokenRequest = nextTokenRequest || await requestAblyToken();
        nextTokenRequest = null;

        if (!tokenRequest) {
          callback(new Error('Realtime auth is unavailable.'), null);
          return;
        }

        callback(null, tokenRequest);
      },
      closeOnUnload: true,
    });
  })().catch(() => null);

  return clientPromise;
};

export const resetAblyClient = (): void => {
  const closingClient = clientPromise;
  clientPromise = null;
  closingClient?.then((client) => {
    if (!client) return;
    try {
      const result = client.close?.();
      if (result && typeof result.catch === 'function') result.catch(() => {});
    } catch {
      // Ignore close errors from partially connected clients.
    }
  }).catch(() => {});
};

export const subscribeToAblyEvent = (
  channelName: string,
  eventName: string,
  handler: (payload?: any) => void
): (() => void) => {
  let active = true;
  let channel: any = null;
  const listener = (message: any) => handler(message?.data);

  getAblyClient().then((client) => {
    if (!active || !client) return;
    channel = client.channels.get(channelName);
    channel.subscribe(eventName, listener);
  }).catch(() => {});

  return () => {
    active = false;
    if (channel) {
      try {
        channel.unsubscribe(eventName, listener);
      } catch {
        // Ignore cleanup errors from offline/closed Ably clients.
      }
    }
  };
};

export const publishAblyEvent = async (
  channelName: string,
  eventName: string,
  payload: Record<string, unknown>
): Promise<void> => {
  if (!isAblyEnabled()) return;

  const accessToken = await getAccessToken();
  if (!accessToken) return;

  await fetch('/api/ably-publish', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ channelName, eventName, payload }),
  }).catch(() => {});
};