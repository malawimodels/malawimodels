import { createClient } from '@supabase/supabase-js';

type Env = {
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

const sha256Hex = async (value: string): Promise<string> => {
  const bytes = new TextEncoder().encode(value.toLowerCase().trim());
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

export const onRequestPost = async (context: { request: Request; env: Env }): Promise<Response> => {
  const { request, env } = context;
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'Admin deletion service is not configured.' }, 503);
  }

  const authorization = request.headers.get('authorization') || '';
  const accessToken = authorization.replace(/^Bearer\s+/i, '').trim();
  if (!accessToken) return json({ error: 'Authentication required.' }, 401);

  const { uid, role, reason } = await request.json().catch(() => ({}));
  if (!uid || typeof uid !== 'string') return json({ error: 'Target user is required.' }, 400);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: callerData, error: callerError } = await supabase.auth.getUser(accessToken);
  if (callerError || !callerData.user) return json({ error: 'Invalid session.' }, 401);

  const { data: callerProfile } = await supabase
    .from('users')
    .select('role')
    .eq('id', callerData.user.id)
    .maybeSingle();

  if (callerProfile?.role !== 'admin') return json({ error: 'Admin permission required.' }, 403);

  const { data: targetProfile, error: targetError } = await supabase
    .from('users')
    .select('id, email, display_name, role, deletion_count')
    .eq('id', uid)
    .maybeSingle();

  if (targetError || !targetProfile) return json({ error: 'Target user was not found.' }, 404);

  const emailHash = targetProfile.email ? await sha256Hex(targetProfile.email) : null;

  await supabase.from('account_deletion_records').insert({
    former_user_id: uid,
    email_hash: emailHash,
    role_snapshot: role || targetProfile.role,
    display_name_snapshot: targetProfile.display_name,
    deletion_count: (targetProfile.deletion_count || 0) + 1,
    reason: reason || 'Deleted by admin',
    deleted_by: callerData.user.id,
  });

  const { error: deleteError } = await supabase.auth.admin.deleteUser(uid, false);
  if (deleteError) return json({ error: deleteError.message }, 500);

  return json({ ok: true });
};