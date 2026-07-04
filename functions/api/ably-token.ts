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

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) return json({ error: 'Invalid session.' }, 401);

  const clientId = data.user.id;
  const { data: threadRows } = await supabase
    .from('message_thread_participants')
    .select('thread_id')
    .eq('user_id', clientId)
    .is('archived_at', null)
    .limit(100);

  const capability: Record<string, string[]> = {
    [`user:${clientId}:notifications`]: ['subscribe'],
    [`user:${clientId}:messages`]: ['subscribe'],
  };

  (threadRows || []).forEach((row: any) => {
    if (row.thread_id) capability[`message:${row.thread_id}`] = ['subscribe'];
  });

  const rest = new Ably.Rest(ablyKey);
  const tokenRequest = await rest.auth.createTokenRequest({
    clientId,
    ttl: 60 * 60 * 1000,
    capability,
  });

  return json(tokenRequest);
};