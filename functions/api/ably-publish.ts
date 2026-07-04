import * as Ably from 'ably';
import { createClient } from '@supabase/supabase-js';

type Env = {
  ABLY_ROOT_API_KEY?: string;
  SUPABASE_URL?: string;
  VITE_SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

const json = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  },
});

const isUuid = (value: unknown): value is string => (
  typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
);

const getThreadParticipant = async (supabase: ReturnType<typeof createClient>, threadId: string, userId: string): Promise<boolean> => {
  const { data } = await supabase
    .from('message_thread_participants')
    .select('thread_id')
    .eq('thread_id', threadId)
    .eq('user_id', userId)
    .is('archived_at', null)
    .maybeSingle();

  return Boolean(data);
};

const canPublish = async (
  supabase: ReturnType<typeof createClient>,
  callerId: string,
  channelName: string,
  eventName: string,
  payload: Record<string, unknown>
): Promise<boolean> => {
  const messageMatch = channelName.match(/^message:([0-9a-f-]+)$/i);
  if (messageMatch && eventName === 'message.changed') {
    return getThreadParticipant(supabase, messageMatch[1], callerId);
  }

  const userMessageMatch = channelName.match(/^user:([0-9a-f-]+):messages$/i);
  if (userMessageMatch && eventName === 'message.changed' && isUuid(payload.threadId)) {
    const targetId = userMessageMatch[1];
    const [callerIsParticipant, targetIsParticipant] = await Promise.all([
      getThreadParticipant(supabase, payload.threadId, callerId),
      getThreadParticipant(supabase, payload.threadId, targetId),
    ]);
    return callerIsParticipant && targetIsParticipant;
  }

  const notificationMatch = channelName.match(/^user:([0-9a-f-]+):notifications$/i);
  if (notificationMatch && eventName === 'notification.created') {
    const targetId = notificationMatch[1];
    const since = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', targetId)
      .eq('title', String(payload.title || ''))
      .eq('message', String(payload.message || ''))
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return Boolean(data);
  }

  return false;
};

export const onRequestPost = async (context: { request: Request; env: Env }): Promise<Response> => {
  const { request, env } = context;
  const ablyKey = env.ABLY_ROOT_API_KEY;
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!ablyKey || !supabaseUrl || !serviceRoleKey) {
    return json({ error: 'Realtime service is not configured.' }, 503);
  }

  const authorization = request.headers.get('authorization') || '';
  const accessToken = authorization.replace(/^Bearer\s+/i, '').trim();
  if (!accessToken) return json({ error: 'Authentication required.' }, 401);

  const body = await request.json().catch(() => ({}));
  const channelName = String(body.channelName || '');
  const eventName = String(body.eventName || '');
  const payload = (body.payload && typeof body.payload === 'object' ? body.payload : {}) as Record<string, unknown>;

  if (!channelName || !eventName) return json({ error: 'Channel and event are required.' }, 400);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) return json({ error: 'Invalid session.' }, 401);

  const allowed = await canPublish(supabase, data.user.id, channelName, eventName, payload);
  if (!allowed) return json({ error: 'Not allowed to publish this event.' }, 403);

  const rest = new Ably.Rest(ablyKey);
  await rest.channels.get(channelName).publish(eventName, payload);

  return json({ ok: true });
};