// services/supabase.service.ts
// Complete replacement for services/firestore.ts
// All database operations now use Supabase PostgreSQL

import { supabase } from '../supabase';
import { 
  UserData, UserRole, ModelProfile, Project, Booking, BookingOffer,
  AgencyRequest, AgencyInvite, Notification, Report, 
  SearchFilters, Category, District, ProjectStatus, 
  ProjectVisibility, BookingStatus,
  ReportReason, NotificationType, ReportStatus,
  AgencyApplication, LeaveRequest, AdminPermission, AvailabilityBlock,
  NotificationPreferences, ContractTemplate, BookingAgreement, Dispute,
  DisputeEvidence, Review, ModelRankingSignal, AccountAppeal,
  AccountAppealStatus, MessageUser, MessageThread, MessageItem
} from '../types';
import { getPublicIdFromUrl } from './cloudinary';
import { getCachedJson, setCachedJson, stableCacheKey } from '../utils/indexedDbCache';
import { publishAblyEvent, subscribeToAblyEvent } from './ably.service';

const isMissingColumnError = (error: any, columnName: string): boolean => {
  const message = `${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  return message.includes(columnName.toLowerCase()) && message.includes('column');
};

const getCloudinaryPublicId = (url: string, fallback: string): string => {
  return getPublicIdFromUrl(url) || fallback;
};

const isMissingRelationError = (error: any, relationName: string): boolean => {
  const message = `${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  return message.includes(relationName.toLowerCase()) && (
    message.includes('does not exist') ||
    message.includes('not found') ||
    message.includes('could not find') ||
    message.includes('schema cache')
  );
};

const optionalHardeningSchemaEnabled = import.meta.env.VITE_ENABLE_HARDENING_SCHEMA === 'true';

const hasOptionalRelation = async (_relationName: string): Promise<boolean> => optionalHardeningSchemaEnabled;

const hasOptionalRpc = async (_functionName: string): Promise<boolean> => optionalHardeningSchemaEnabled;

type DebounceTimer = ReturnType<typeof setTimeout> | null;

const DEFAULT_SEARCH_MAX_HEIGHT = 300;
const REVIEWABLE_BOOKING_STATUSES = new Set<BookingStatus | string>(['completed', 'cancelled', 'reported']);

export interface SearchModelsMeta {
  hasMore: boolean;
  page: number;
  limit: number;
}

type SearchModelsCacheEntry = {
  models: ModelProfile[];
  meta: SearchModelsMeta;
};

const SEARCH_CACHE_TTL_MS = 90 * 1000;

const isPastOrToday = (date?: string | null): boolean => {
  if (!date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return !Number.isNaN(target.getTime()) && target.getTime() <= today.getTime();
};

export const isBookingReviewable = (booking: Pick<Booking, 'status' | 'eventDate'>): boolean => {
  return REVIEWABLE_BOOKING_STATUSES.has(booking.status) || isPastOrToday(booking.eventDate);
};

const getCurrentAuthUserId = async (): Promise<string | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
};

const sha256Hex = async (value: string): Promise<string> => {
  const bytes = new TextEncoder().encode(value.toLowerCase().trim());
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

const ensureModelProfileRow = async (uid: string): Promise<void> => {
  const { error } = await supabase.from('models').upsert(
    {
      id: uid,
      district: 'Not Specified',
      views: 0,
      ranking_score: 0,
      availability: true,
    },
    { onConflict: 'id' }
  );

  if (error) throw error;
};

const retryWithoutMissingColumn = async <T extends Record<string, any>>(
  operation: (updates: T) => PromiseLike<{ error: any }>,
  updates: T,
  columnName: keyof T
): Promise<void> => {
  const result = await operation(updates);

  if (!result.error) return;

  if (isMissingColumnError(result.error, String(columnName))) {
    const retryUpdates = { ...updates };
    delete retryUpdates[columnName];
    const retry = await operation(retryUpdates as T);
    if (retry.error) throw retry.error;
    return;
  }

  throw result.error;
};

const assertDisplayNameCanChange = async (
  uid: string,
  nextDisplayName?: string
): Promise<string | null> => {
  const normalizedNext = (nextDisplayName || '').trim();
  if (!normalizedNext) return null;

  // The optional `display_name_changed_at` migration is not guaranteed to
  // exist in every Supabase project. Query only stable columns here so profile
  // saves do not generate a 400 before retrying.
  const { data, error } = await supabase
    .from('users')
    .select('display_name')
    .eq('id', uid)
    .maybeSingle();

  if (error) throw error;

  if ((data?.display_name || '').trim() === normalizedNext) return null;
  return null;
};

// =====================================================
// SECURITY, ADMIN PERMISSIONS & RATE LIMITS
// =====================================================

const transformAdminPermission = (data: any): AdminPermission => ({
  id: data.id,
  userId: data.user_id,
  role: data.role,
  permissions: data.permissions || {},
  isActive: data.is_active,
  grantedBy: data.granted_by || undefined,
  grantedAt: data.granted_at,
  revokedAt: data.revoked_at || undefined,
});

export const getAdminPermission = async (userId: string): Promise<AdminPermission | null> => {
  if (!userId) return null;
  if (!(await hasOptionalRelation('admin_permissions'))) return null;

  const { data, error } = await supabase
    .from('admin_permissions')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .is('revoked_at', null)
    .maybeSingle();

  if (error) {
    if (isMissingRelationError(error, 'admin_permissions')) return null;
    console.error('Error fetching admin permission:', error);
    return null;
  }

  return data ? transformAdminPermission(data) : null;
};

export const isPlatformAdmin = async (userId: string): Promise<boolean> => {
  const permission = await getAdminPermission(userId);
  return Boolean(permission);
};

export const checkRateLimit = async (
  scope: string,
  identifier: string,
  maxAttempts: number,
  windowSeconds: number
): Promise<boolean> => {
  if (!identifier) return false;
  if (!(await hasOptionalRpc('check_rate_limit'))) return true;

  const { data, error } = await supabase.rpc('check_rate_limit', {
    p_scope: scope,
    p_identifier: identifier.toLowerCase().trim(),
    p_max_attempts: maxAttempts,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    if (isMissingRelationError(error, 'check_rate_limit') || `${error.message || ''}`.includes('function')) {
      return true;
    }
    throw error;
  }

  return data === true;
};

export const enforceRateLimit = async (
  scope: string,
  identifier: string,
  maxAttempts: number,
  windowSeconds: number
): Promise<void> => {
  const allowed = await checkRateLimit(scope, identifier, maxAttempts, windowSeconds);
  if (!allowed) {
    throw new Error('Too many attempts. Please wait a bit and try again.');
  }
};

export const logAdminAction = async (action: {
  actionType: string;
  targetUserId?: string;
  targetTable?: string;
  targetId?: string;
  details?: Record<string, any>;
}): Promise<void> => {
  if (!(await hasOptionalRelation('admin_audit_logs'))) return;

  const adminUserId = await getCurrentAuthUserId();
  if (!adminUserId) return;

  const { error } = await supabase.from('admin_audit_logs').insert({
    action_type: action.actionType,
    admin_user_id: adminUserId,
    target_user_id: action.targetUserId,
    target_table: action.targetTable,
    target_id: action.targetId,
    details: action.details || {},
  });

  if (error) {
    if (isMissingRelationError(error, 'admin_audit_logs')) return;
    console.warn('Failed to write admin audit log:', error);
  }
};

// =====================================================
// USER MANAGEMENT
// =====================================================

export const createUserProfile = async (
  uid: string,
  email: string,
  role: UserRole,
  displayName?: string
): Promise<void> => {
  // NOTE: A database trigger (handle_new_user) already inserts a row into
  // `users` automatically when an auth account is created. We therefore
  // upsert here (instead of insert) to fill in / correct the profile fields
  // without causing a primary-key conflict.
  const { error } = await supabase.from('users').upsert(
    {
      id: uid,
      email,
      role,
      display_name: displayName || '',
      is_active: true,
      verified: false,
      deletion_count: 0,
      warning_count: 0,
      average_rating: 0,
      reviews_count: 0,
    },
    { onConflict: 'id' }
  );

  if (error) {
    // The trigger already created the base profile, so don't hard-fail here.
    console.error('Error upserting user profile:', error);
  }

  // If model, create model profile (with default district)
  if (role === UserRole.MODEL) {
    try {
      await ensureModelProfileRow(uid);
    } catch (modelError) {
      console.error('Error creating model profile:', modelError);
      // Don't throw - allow user creation to succeed even if model profile fails
    }
  }
};

export const getUserRole = async (uid: string): Promise<UserRole | null> => {
  const adminPermission = await getAdminPermission(uid);
  if (adminPermission) return UserRole.ADMIN;

  const { data, error } = await supabase
    .from('users')
    .select('role')
    .eq('id', uid)
    .limit(1);

  if (error) {
    console.error('Error fetching role:', error);
    return null;
  }

  return data?.[0]?.role as UserRole | null;
};

export const getUserData = async (uid: string): Promise<UserData | null> => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', uid)
    .single();

  if (error) {
    console.error('Error fetching user:', error);
    return null;
  }

  return transformUserData(await attachUserExtras(data));
};

export const subscribeToUser = (
  uid: string,
  callback: (userData: UserData | null) => void
): (() => void) => {
  // Initial fetch
  getUserData(uid).then(callback);

  // Subscribe to changes
  const subscription = supabase
    .channel(`user:${uid}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'users',
        filter: `id=eq.${uid}`,
      },
      (payload) => {
        if (payload.eventType === 'DELETE') {
          callback(null);
        } else {
          getUserData(uid).then(callback);
        }
      }
    )
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
};

export const getAllUsers = async (): Promise<UserData[]> => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;

  return data.map(transformUserData);
};

export const updateUserData = async (
  uid: string,
  updates: Partial<UserData>
): Promise<void> => {
  const dbUpdates: any = {};
  const displayNameChangedAt = await assertDisplayNameCanChange(uid, updates.displayName);

  if (updates.email !== undefined) dbUpdates.email = updates.email;
  if (updates.displayName !== undefined) {
    dbUpdates.display_name = updates.displayName.trim();
    if (displayNameChangedAt) dbUpdates.display_name_changed_at = displayNameChangedAt;
  }
  if (updates.photoUrl !== undefined) dbUpdates.photo_url = updates.photoUrl;
  if (updates.bio !== undefined) dbUpdates.bio = updates.bio;
  if (updates.website !== undefined) dbUpdates.website = updates.website;
  if (updates.contact?.publicEmail !== undefined) dbUpdates.public_email = updates.contact.publicEmail;
  if (updates.contact?.whatsapp !== undefined) dbUpdates.whatsapp = updates.contact.whatsapp;
  if (updates.contact?.instagram !== undefined) dbUpdates.instagram = updates.contact.instagram;
  if (updates.contact?.facebook !== undefined) dbUpdates.facebook = updates.contact.facebook;

  if (Object.keys(dbUpdates).length > 0) {
    await retryWithoutMissingColumn(
      (safeUpdates) => supabase.from('users').update(safeUpdates).eq('id', uid),
      dbUpdates,
      'display_name_changed_at'
    );
  }

  if (updates.gallery) {
    await supabase.from('gallery_images').delete().eq('user_id', uid);

    const galleryRows = updates.gallery
      .filter(Boolean)
      .map((url, index) => ({
        user_id: uid,
        cloudinary_url: url,
        cloudinary_public_id: getCloudinaryPublicId(url, `gallery-${uid}-${index}`),
        display_order: index,
      }));

    if (galleryRows.length > 0) {
      const { error } = await supabase.from('gallery_images').insert(galleryRows);
      if (error) throw error;
    }
  }

  if (updates.customLinks) {
    await supabase.from('custom_links').delete().eq('user_id', uid);

    const linkRows = updates.customLinks
      .filter((link) => link.platform || link.url)
      .map((link, index) => ({
        user_id: uid,
        platform: link.platform || 'Link',
        url: link.url,
        display_order: index,
      }));

    if (linkRows.length > 0) {
      const { error } = await supabase.from('custom_links').insert(linkRows);
      if (error) throw error;
    }
  }
};

export const toggleUserVerification = async (
  uid: string,
  verified: boolean,
  _role?: UserRole
): Promise<void> => {
  const { error } = await supabase
    .from('users')
    .update({ verified })
    .eq('id', uid);

  if (error) throw error;
  await logAdminAction({
    actionType: verified ? 'user_verified' : 'user_unverified',
    targetUserId: uid,
    targetTable: 'users',
    targetId: uid,
    details: { verified, role: _role },
  });
};

export const toggleUserStatus = async (
  uid: string,
  isActive: boolean
): Promise<void> => {
  const { error } = await supabase
    .from('users')
    .update({ is_active: isActive })
    .eq('id', uid);

  if (error) throw error;
  await logAdminAction({
    actionType: isActive ? 'user_unblocked' : 'user_blocked',
    targetUserId: uid,
    targetTable: 'users',
    targetId: uid,
    details: { isActive },
  });
};

export const deleteUserPermanently = async (uid: string, _role?: UserRole, reason = 'Deleted by admin'): Promise<void> => {
  const { data: user } = await supabase
    .from('users')
    .select('email, display_name, deletion_count')
    .eq('id', uid)
    .maybeSingle();

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  const canUseAdminDeleteFunction = !import.meta.env.DEV || import.meta.env.VITE_ENABLE_ADMIN_DELETE_DEV === 'true';

  if (accessToken && canUseAdminDeleteFunction) {
    try {
      const response = await fetch('/api/admin-delete-user', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ uid, role: _role, reason }),
      });

      if (response.ok) return;
      if (![404, 405, 503].includes(response.status)) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || 'Failed to delete user account.');
      }
    } catch (error) {
      if (error instanceof Error && !error.message.includes('Failed to fetch')) throw error;
    }
  }

  const currentAdminId = await getCurrentAuthUserId();
  const emailHash = user?.email ? await sha256Hex(user.email) : undefined;

  const deletionRecord = await supabase.from('account_deletion_records').insert({
    former_user_id: uid,
    email_hash: emailHash,
    role_snapshot: _role,
    display_name_snapshot: user?.display_name,
    deletion_count: (user?.deletion_count || 0) + 1,
    reason,
    deleted_by: currentAdminId,
  });

  if (deletionRecord.error && !isMissingRelationError(deletionRecord.error, 'account_deletion_records')) {
    throw deletionRecord.error;
  }

  const { error } = await supabase
    .from('users')
    .update({
      is_active: false,
      email: `deleted-${uid}@deleted.invalid`,
      display_name: 'Deleted User',
      photo_url: null,
      public_email: null,
      whatsapp: null,
      instagram: null,
      facebook: null,
      website: null,
      bio: null,
      deletion_count: (user?.deletion_count || 0) + 1,
    })
    .eq('id', uid);

  if (error) throw error;
  await logAdminAction({
    actionType: 'user_soft_deleted',
    targetUserId: uid,
    targetTable: 'users',
    targetId: uid,
    details: { previousRole: _role, reason, serverHardDeleteConfigured: false },
  });
};

export const submitAccountAppeal = async (contactEmail: string, message: string): Promise<void> => {
  const normalizedEmail = contactEmail.toLowerCase().trim();
  if (!normalizedEmail || !message.trim()) throw new Error('Email and appeal message are required.');

  const emailHash = await sha256Hex(normalizedEmail);
  const { error } = await supabase.from('account_appeals').insert({
    contact_email: normalizedEmail,
    email_hash: emailHash,
    message: message.trim(),
    status: 'pending',
  });

  if (error) throw error;
};

export const subscribeToAccountAppeals = (callback: (appeals: AccountAppeal[]) => void): (() => void) => {
  let active = true;

  const fetchAppeals = async () => {
    const { data, error } = await supabase
      .from('account_appeals')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      if (isMissingRelationError(error, 'account_appeals')) {
        if (active) callback([]);
        return;
      }
      console.error('Error fetching account appeals:', error);
      if (active) callback([]);
      return;
    }

    if (active) callback((data || []).map(transformAccountAppeal));
  };

  fetchAppeals();

  const subscription = supabase
    .channel('account_appeals')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'account_appeals' }, fetchAppeals)
    .subscribe();

  return () => {
    active = false;
    subscription.unsubscribe();
  };
};

export const processAccountAppeal = async (
  appealId: string,
  status: AccountAppealStatus,
  adminNotes?: string,
  warningMessage?: string
): Promise<void> => {
  const reviewedBy = await getCurrentAuthUserId();
  const { error } = await supabase
    .from('account_appeals')
    .update({
      status,
      admin_notes: adminNotes || null,
      warning_message: warningMessage || null,
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', appealId);

  if (error) throw error;
};

const transformMessageUser = (data: any): MessageUser => ({
  id: data.id,
  displayName: data.display_name || data.email?.split('@')[0] || 'User',
  role: data.role,
  photoUrl: data.photo_url || undefined,
  email: data.email || undefined,
});

export const getMessagingRecipients = async (query = ''): Promise<MessageUser[]> => {
  const { data, error } = await supabase.rpc('get_message_recipients', {
    p_query: query.trim(),
  });

  if (error) throw error;
  return (data || []).map(transformMessageUser);
};

export const startDirectMessageThread = async (otherUserId: string): Promise<string> => {
  const { data, error } = await supabase.rpc('get_or_create_direct_message_thread', {
    p_other_user_id: otherUserId,
  });

  if (error) throw error;
  return data;
};

const fetchThreadParticipants = async (threadIds: string[]): Promise<Map<string, any[]>> => {
  if (threadIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from('message_thread_participants')
    .select('thread_id, user_id, last_read_at, pinned_at, archived_at, muted_until, users!message_thread_participants_user_id_fkey(id, display_name, email, role, photo_url)')
    .in('thread_id', threadIds);

  if (error) throw error;

  const byThread = new Map<string, any[]>();
  (data || []).forEach((participant: any) => {
    const existing = byThread.get(participant.thread_id) || [];
    existing.push(participant);
    byThread.set(participant.thread_id, existing);
  });

  return byThread;
};

const transformMessageThread = (thread: any, participants: any[]): MessageThread => ({
  id: thread.id,
  threadType: thread.thread_type,
  title: thread.title || undefined,
  createdBy: thread.created_by || undefined,
  participants: participants.map((participant) => ({
    userId: participant.user_id,
    lastReadAt: participant.last_read_at || undefined,
    pinnedAt: participant.pinned_at || undefined,
    archivedAt: participant.archived_at || undefined,
    mutedUntil: participant.muted_until || undefined,
    user: participant.users ? transformMessageUser(participant.users) : undefined,
  })),
  lastMessageAt: thread.last_message_at,
  createdAt: thread.created_at,
  updatedAt: thread.updated_at,
});

export const getMessageThreads = async (): Promise<MessageThread[]> => {
  const currentUserId = await getCurrentAuthUserId();
  if (!currentUserId) return [];

  const { data: participantRows, error: participantError } = await supabase
    .from('message_thread_participants')
    .select('thread_id')
    .eq('user_id', currentUserId)
    .is('archived_at', null)
    .limit(50);

  if (participantError) {
    if (isMissingRelationError(participantError, 'message_thread_participants')) return [];
    throw participantError;
  }

  const threadIds = (participantRows || []).map((row: any) => row.thread_id);
  if (threadIds.length === 0) return [];

  const [{ data: threads, error }, participantsByThread] = await Promise.all([
    supabase
      .from('message_threads')
      .select('*')
      .in('id', threadIds)
      .order('last_message_at', { ascending: false })
      .limit(50),
    fetchThreadParticipants(threadIds),
  ]);

  if (error) throw error;
  return (threads || [])
    .map((thread: any) => transformMessageThread(thread, participantsByThread.get(thread.id) || []))
    .sort((a, b) => {
      const aPinned = a.participants.find((participant) => participant.userId === currentUserId)?.pinnedAt || '';
      const bPinned = b.participants.find((participant) => participant.userId === currentUserId)?.pinnedAt || '';
      if (aPinned || bPinned) return bPinned.localeCompare(aPinned);
      return b.lastMessageAt.localeCompare(a.lastMessageAt);
    });
};

export const toggleMessageThreadPinned = async (threadId: string, pinned: boolean): Promise<void> => {
  const userId = await getCurrentAuthUserId();
  if (!userId) throw new Error('You must be signed in.');

  const { error } = await supabase
    .from('message_thread_participants')
    .update({ pinned_at: pinned ? new Date().toISOString() : null })
    .eq('thread_id', threadId)
    .eq('user_id', userId);

  if (error) throw error;
  await publishAblyEvent(`user:${userId}:messages`, 'message.changed', { threadId });
};

export const subscribeToMessageThreads = (
  userId: string,
  callback: (threads: MessageThread[]) => void
): (() => void) => {
  let active = true;

  const fetchThreads = () => {
    getMessageThreads()
      .then((threads) => { if (active) callback(threads); })
      .catch((error) => {
        console.error('Error fetching message threads:', error);
        if (active) callback([]);
      });
  };

  fetchThreads();
  const cleanupAbly = subscribeToAblyEvent(`user:${userId}:messages`, 'message.changed', fetchThreads);

  const fallback = supabase
    .channel(`message_threads:${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'message_thread_participants', filter: `user_id=eq.${userId}` }, fetchThreads)
    .subscribe();

  return () => {
    active = false;
    cleanupAbly();
    fallback.unsubscribe();
  };
};

const transformMessageItem = (message: any): MessageItem => ({
  id: message.id,
  threadId: message.thread_id,
  senderId: message.sender_id,
  sender: message.sender ? transformMessageUser(message.sender) : undefined,
  body: message.body || undefined,
  voiceUrl: message.voice_url || undefined,
  voicePublicId: message.voice_public_id || undefined,
  voiceDurationSeconds: message.voice_duration_seconds || undefined,
  replyToMessageId: message.reply_to_message_id || undefined,
  tags: message.tags || [],
  editedAt: message.edited_at || undefined,
  editCount: Number(message.edit_count || 0),
  deletedAt: message.deleted_at || undefined,
  deletedBy: message.deleted_by || undefined,
  createdAt: message.created_at,
  updatedAt: message.updated_at,
});

export const getMessages = async (threadId: string): Promise<MessageItem[]> => {
  const currentUserId = await getCurrentAuthUserId();
  if (!currentUserId) return [];

  const [{ data: messages, error }, { data: deletedForMe }] = await Promise.all([
    supabase
      .from('messages')
      .select('*, sender:users!messages_sender_id_fkey(id, display_name, email, role, photo_url)')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: false })
      .limit(80),
    supabase
      .from('message_deletions')
      .select('message_id')
      .eq('user_id', currentUserId),
  ]);

  if (error) {
    if (isMissingRelationError(error, 'messages')) return [];
    throw error;
  }

  const deletedIds = new Set((deletedForMe || []).map((row: any) => row.message_id));
  const visibleMessages = (messages || [])
    .filter((message: any) => !deletedIds.has(message.id))
    .reverse()
    .map(transformMessageItem);

  supabase.rpc('mark_message_thread_read', { p_thread_id: threadId }).catch(() => {});
  return visibleMessages;
};

export const subscribeToMessages = (
  threadId: string,
  callback: (messages: MessageItem[]) => void
): (() => void) => {
  let active = true;

  const fetchMessages = () => {
    getMessages(threadId)
      .then((messages) => { if (active) callback(messages); })
      .catch((error) => {
        console.error('Error fetching messages:', error);
        if (active) callback([]);
      });
  };

  fetchMessages();
  const cleanupAbly = subscribeToAblyEvent(`message:${threadId}`, 'message.changed', fetchMessages);
  const fallback = supabase
    .channel(`messages:${threadId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `thread_id=eq.${threadId}` }, fetchMessages)
    .subscribe();

  return () => {
    active = false;
    cleanupAbly();
    fallback.unsubscribe();
  };
};

export const sendMessage = async (payload: {
  threadId: string;
  body?: string;
  voiceUrl?: string;
  voicePublicId?: string;
  voiceDurationSeconds?: number;
  replyToMessageId?: string;
  tags?: string[];
}): Promise<void> => {
  const senderId = await getCurrentAuthUserId();
  if (!senderId) throw new Error('You must be signed in to send messages.');

  const { error } = await supabase.from('messages').insert({
    thread_id: payload.threadId,
    sender_id: senderId,
    body: payload.body?.trim() || null,
    voice_url: payload.voiceUrl || null,
    voice_public_id: payload.voicePublicId || null,
    voice_duration_seconds: payload.voiceDurationSeconds || null,
    reply_to_message_id: payload.replyToMessageId || null,
    tags: payload.tags || [],
  });

  if (error) throw error;

  const participants = await fetchThreadParticipants([payload.threadId]);
  const participantIds = (participants.get(payload.threadId) || []).map((participant) => participant.user_id);

  await Promise.all([
    publishAblyEvent(`message:${payload.threadId}`, 'message.changed', { threadId: payload.threadId }),
    ...participantIds.map((participantId) => publishAblyEvent(`user:${participantId}:messages`, 'message.changed', { threadId: payload.threadId })),
  ]);
};

export const deleteMessageForMe = async (messageId: string): Promise<void> => {
  const userId = await getCurrentAuthUserId();
  if (!userId) throw new Error('You must be signed in.');

  const { error } = await supabase.from('message_deletions').upsert({
    message_id: messageId,
    user_id: userId,
  });
  if (error) throw error;
};

export const editMessageOnce = async (messageId: string, body: string): Promise<void> => {
  const { error } = await supabase.rpc('edit_message_once', {
    p_message_id: messageId,
    p_body: body,
  });

  if (error) throw error;

  const { data: message } = await supabase
    .from('messages')
    .select('thread_id')
    .eq('id', messageId)
    .maybeSingle();

  if (message?.thread_id) {
    await publishAblyEvent(`message:${message.thread_id}`, 'message.changed', { threadId: message.thread_id });
  }
};

export const deleteMessageForEveryone = async (messageId: string): Promise<void> => {
  const { data: threadId, error } = await supabase.rpc('delete_message_for_everyone', {
    p_message_id: messageId,
  });

  if (error) throw error;
  if (threadId) {
    await publishAblyEvent(`message:${threadId}`, 'message.changed', { threadId });
  }
};

export const sendAdminWarning = async (
  userId: string,
  message: string
): Promise<void> => {
  // Increment warning count
  const { data: user } = await supabase
    .from('users')
    .select('warning_count')
    .eq('id', userId)
    .single();

  const newWarningCount = (user?.warning_count || 0) + 1;

  await supabase
    .from('users')
    .update({ warning_count: newWarningCount })
    .eq('id', userId);

  // Create notification
  await createNotification({
    userId,
    type: 'WARNING' as NotificationType,
    title: 'Warning from Administration',
    message,
    link: '/help',
  });

  await logAdminAction({
    actionType: 'user_warning_sent',
    targetUserId: userId,
    targetTable: 'users',
    targetId: userId,
    details: { message, warningCount: newWarningCount },
  });
};

// =====================================================
// MODEL MANAGEMENT
// =====================================================

// Fetch the matching `users` rows for a set of models (keyed by model id ==
// user id) and attach them as `model.users`. This avoids relying on
// PostgREST's embedded foreign-key detection (which is ambiguous because
// `models` has two foreign keys to `users`: the model owner and the agency).
const attachUsersToModels = async (models: any[]): Promise<any[]> => {
  if (!models || models.length === 0) return models || [];

  const ids = Array.from(new Set(models.map((m) => m.id).filter(Boolean)));
  if (ids.length === 0) return models;

  const { data: users, error } = await supabase
    .from('users')
    .select('*')
    .in('id', ids);

  if (error) {
    console.error('Error fetching users for models:', error);
    return models.map((model) => ({ ...model, users: null, userLookupFailed: true }));
  }

  const usersById = new Map((users || []).map((u: any) => [u.id, u]));
  return models.map((m) => ({ ...m, users: usersById.get(m.id) || null, userLookupFailed: false }));
};

export const getModelProfile = async (
  uid: string
): Promise<ModelProfile | null> => {
  if (!uid) return null;

  const { data, error } = await supabase
    .from('models')
    .select(`
      *,
      model_categories (category),
      model_pricing (category, price),
      model_images (cloudinary_url, display_order)
    `)
    .eq('id', uid)
    .maybeSingle();

  if (error) {
    console.error('Error fetching model:', error);
    return null;
  }

  if (!data) {
    const currentUserId = await getCurrentAuthUserId();
    if (currentUserId !== uid) return null;

    try {
      await ensureModelProfileRow(uid);
    } catch (ensureError) {
      console.error('Error ensuring model profile:', ensureError);
      return null;
    }

    const { data: recoveredData, error: recoveredError } = await supabase
      .from('models')
      .select(`
        *,
        model_categories (category),
        model_pricing (category, price),
        model_images (cloudinary_url, display_order)
      `)
      .eq('id', uid)
      .maybeSingle();

    if (recoveredError || !recoveredData) {
      if (recoveredError) console.error('Error fetching recovered model:', recoveredError);
      return null;
    }

    const [withRecoveredUser] = await attachUsersToModels([recoveredData]);
    return transformModelData(withRecoveredUser);
  }

  const [withUser] = await attachUsersToModels([data]);
  return transformModelData(withUser);
};

export const getModelsByIds = async (modelIds: string[]): Promise<ModelProfile[]> => {
  const uniqueIds = Array.from(new Set(modelIds.filter(Boolean)));
  if (uniqueIds.length === 0) return [];

  const { data, error } = await supabase
    .from('models')
    .select(`
      *,
      model_categories (category),
      model_pricing (category, price),
      model_images (cloudinary_url, display_order)
    `)
    .in('id', uniqueIds)
    .limit(Math.min(uniqueIds.length, 100));

  if (error) throw error;

  const withUsers = await attachUsersToModels(data || []);
  const modelsById = new Map(withUsers.map((model: any) => [model.id, transformModelData(model)]));
  return uniqueIds.map((id) => modelsById.get(id)).filter(Boolean) as ModelProfile[];
};

export const getSavedModelIds = async (userId: string): Promise<string[]> => {
  if (!(await hasOptionalRelation('saved_models'))) return [];

  const { data, error } = await supabase
    .from('saved_models')
    .select('model_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    if (isMissingRelationError(error, 'saved_models')) return [];
    throw error;
  }

  return (data || []).map((row: any) => row.model_id);
};

export const toggleSavedModel = async (
  userId: string,
  modelId: string,
  shouldSave: boolean
): Promise<void> => {
  if (!(await hasOptionalRelation('saved_models'))) return;

  if (shouldSave) {
    const { error } = await supabase.from('saved_models').upsert(
      { user_id: userId, model_id: modelId },
      { onConflict: 'user_id,model_id' }
    );
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from('saved_models')
    .delete()
    .eq('user_id', userId)
    .eq('model_id', modelId);

  if (error) throw error;
};

export const clearSavedModels = async (userId: string): Promise<void> => {
  if (!(await hasOptionalRelation('saved_models'))) return;

  const { error } = await supabase
    .from('saved_models')
    .delete()
    .eq('user_id', userId);

  if (error) throw error;
};

const normalizeRpcModelRow = (row: any): any => ({
  id: row.id,
  age: row.age,
  height: row.height,
  gender: row.gender,
  skin_tone: row.skin_tone,
  district: row.district,
  city: row.city,
  agency_id: row.agency_id,
  agency_name: row.agency_name,
  availability: row.availability,
  profile_image_url: row.profile_image_url || row.photo_url,
  video_reel_url: row.video_reel_url,
  views: row.views,
  ranking_score: row.ranking_score,
  profile_completeness: row.profile_completeness,
  created_at: row.created_at,
  users: {
    id: row.id,
    display_name: row.display_name,
    email: row.email,
    bio: row.bio,
    verified: row.verified,
    is_active: row.is_active,
    average_rating: row.average_rating,
    reviews_count: row.reviews_count,
    total_projects: row.total_projects,
    completed_projects: row.completed_projects,
    public_email: row.public_email,
    whatsapp: row.whatsapp,
    instagram: row.instagram,
    facebook: row.facebook,
    website: row.website,
  },
  model_categories: (row.categories || []).map((category: string) => ({ category })),
  model_pricing: Object.entries(row.pricing || {}).map(([category, price]) => ({ category, price })),
  model_images: (row.images || []).map((cloudinary_url: string, display_order: number) => ({
    cloudinary_url,
    display_order,
  })),
});

const fetchSearchModelsViaRpc = async (filters: SearchFilters, limit: number, page: number): Promise<any[] | null> => {
  const { data, error } = await supabase.rpc('search_models_paginated', {
    p_categories: filters.categories?.length ? filters.categories : null,
    p_districts: filters.locations?.length ? filters.locations : null,
    p_gender: filters.gender || null,
    p_skin_tones: filters.skinTones?.length ? filters.skinTones : null,
    p_min_height: filters.minHeight ?? 0,
    p_max_height: filters.maxHeight ?? DEFAULT_SEARCH_MAX_HEIGHT,
    p_min_age: filters.minAge || null,
    p_max_age: filters.maxAge || null,
    p_min_rate: filters.minRate || null,
    p_max_rate: filters.maxRate || null,
    p_verified_only: filters.verifiedOnly || false,
    p_agency_represented: filters.agencyRepresented ?? null,
    p_only_available: filters.onlyAvailable || false,
    p_offset: page * limit,
    p_limit: limit + 1,
  });

  if (error) {
    if (
      isMissingRelationError(error, 'search_models_paginated') ||
      `${error.message || ''}`.includes('function') ||
      isMissingColumnError(error, 'age')
    ) {
      return null;
    }
    throw error;
  }

  return (data || []).map(normalizeRpcModelRow);
};

const fetchSearchModelsDirect = async (filters: SearchFilters, limit: number, page: number): Promise<any[]> => {
  let query = supabase
    .from('models')
    .select(`
      *,
      model_categories (category),
      model_pricing (category, price),
      model_images (cloudinary_url, display_order)
    `);

  if (filters.categories && filters.categories.length > 0) {
    query = query.filter('model_categories.category', 'in', `(${filters.categories.join(',')})`);
  }

  if (filters.locations && filters.locations.length > 0) {
    query = query.in('district', filters.locations);
  }

  if (filters.gender) {
    query = query.eq('gender', filters.gender);
  }

  if (filters.skinTones && filters.skinTones.length > 0) {
    query = query.in('skin_tone', filters.skinTones);
  }

  if (typeof filters.minHeight === 'number' && filters.minHeight > 0) {
    query = query.gte('height', filters.minHeight);
  }

  if (
    typeof filters.maxHeight === 'number' &&
    filters.maxHeight > 0 &&
    filters.maxHeight < DEFAULT_SEARCH_MAX_HEIGHT
  ) {
    query = query.lte('height', filters.maxHeight);
  }

  if (filters.agencyRepresented === true) {
    query = query.not('agency_id', 'is', null);
  } else if (filters.agencyRepresented === false) {
    query = query.is('agency_id', null);
  }

  if (filters.onlyAvailable) {
    query = query.eq('availability', true);
  }

  query = query.order('ranking_score', { ascending: false });
  query = query.range(page * limit, page * limit + limit);

  const { data, error } = await query;
  if (error) throw error;

  const withUsers = await attachUsersToModels(data || []);
  let activeModels = withUsers.filter(
    (m) => m.userLookupFailed || !m.users || m.users.is_active !== false
  );

  if (filters.verifiedOnly) {
    activeModels = activeModels.filter((m) => m.users?.verified === true);
  }

  if (filters.minRate || filters.maxRate) {
    activeModels = activeModels.filter((m) => {
      const prices = (m.model_pricing || []).map((price: any) => Number(price.price || 0));
      if (prices.length === 0) return false;
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      if (filters.minRate && maxPrice < filters.minRate) return false;
      if (filters.maxRate && minPrice > filters.maxRate) return false;
      return true;
    });
  }

  return activeModels;
};

export const getSearchModelsPage = async (filters: SearchFilters): Promise<{
  models: ModelProfile[];
  meta: SearchModelsMeta;
}> => {
  const cacheKey = getSearchModelsCacheKey(filters);
  const limit = filters.limit || 48;
  const page = filters.page || 0;
  let activeModels = await fetchSearchModelsViaRpc(filters, limit, page);

  if (!activeModels) {
    activeModels = await fetchSearchModelsDirect(filters, limit, page);
  }

  if (filters.availabilityDate && activeModels.length > 0 && await hasOptionalRelation('model_availability_blocks')) {
    const modelIds = activeModels.map((m) => m.id);
    const { data: blocks, error: blockError } = await supabase
      .from('model_availability_blocks')
      .select('model_id')
      .in('model_id', modelIds)
      .lte('start_date', filters.availabilityDate)
      .gte('end_date', filters.availabilityDate);

    if (!blockError) {
      const unavailable = new Set((blocks || []).map((block: any) => block.model_id));
      activeModels = activeModels.filter((m) => !unavailable.has(m.id));
    }
  }

  const hasMore = activeModels.length > limit;
  const result = {
    models: activeModels.slice(0, limit).map(transformModelData),
    meta: { hasMore, page, limit },
  };

  setCachedJson(cacheKey, result, SEARCH_CACHE_TTL_MS).catch(() => {});
  return result;
};

const getSearchModelsCacheKey = (filters: SearchFilters): string => stableCacheKey('search-models', {
  categories: filters.categories || [],
  locations: filters.locations || [],
  minHeight: filters.minHeight || 0,
  maxHeight: filters.maxHeight || DEFAULT_SEARCH_MAX_HEIGHT,
  minAge: filters.minAge || null,
  maxAge: filters.maxAge || null,
  minRate: filters.minRate || null,
  maxRate: filters.maxRate || null,
  availabilityDate: filters.availabilityDate || null,
  verifiedOnly: filters.verifiedOnly || false,
  agencyRepresented: filters.agencyRepresented ?? null,
  page: filters.page || 0,
  limit: filters.limit || 48,
  gender: filters.gender || null,
  skinTones: filters.skinTones || [],
  onlyAvailable: filters.onlyAvailable || false,
});

export const subscribeToSearchModels = (
  filters: SearchFilters,
  callback: (models: ModelProfile[], meta?: SearchModelsMeta) => void
): (() => void) => {
  let active = true;

  const fetchModels = async (preferCache = false) => {
    try {
      const cacheKey = getSearchModelsCacheKey(filters);

      if (preferCache) {
        const cached = await getCachedJson<SearchModelsCacheEntry>(cacheKey, SEARCH_CACHE_TTL_MS);
        if (cached && active) {
          callback(cached.value.models, cached.value.meta);
          if (cached.isFresh) return;
        }
      }

      const { models, meta } = await getSearchModelsPage(filters);
      if (active) {
        callback(models, meta);
      }
    } catch (error) {
      console.error('Error searching models:', error);
      if (active) callback([], { hasMore: false, page: filters.page || 0, limit: filters.limit || 48 });
    }
  };

  // Initial fetch
  fetchModels(true);

  // Subscribe to profile-related changes so newly completed talent profiles
  // appear without requiring a manual page refresh.
  const channelName = `models_search_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const subscription = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'models',
      },
      () => {
        fetchModels();
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'users',
      },
      () => {
        fetchModels();
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'model_categories',
      },
      () => {
        fetchModels();
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'model_images',
      },
      () => {
        fetchModels();
      }
    )
    .subscribe();

  return () => {
    active = false;
    supabase.removeChannel(subscription);
  };
};

export const subscribeToAgencyModels = (
  agencyId: string,
  callback: (models: ModelProfile[]) => void
): (() => void) => {
  let active = true;

  const fetchModels = async () => {
    const { data, error } = await supabase
      .from('models')
      .select(`
        *,
        model_categories (category),
        model_images (cloudinary_url, display_order)
      `)
      .eq('agency_id', agencyId)
      .order('ranking_score', { ascending: false });

    if (error) {
      console.error('Error fetching agency models:', error);
      if (active) callback([]);
      return;
    }

    const withUsers = await attachUsersToModels(data || []);

    if (active) {
      callback(withUsers.map(transformModelData));
    }
  };

  fetchModels();

  const subscription = supabase
    .channel(`agency_models:${agencyId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'models',
        filter: `agency_id=eq.${agencyId}`,
      },
      () => {
        fetchModels();
      }
    )
    .subscribe();

  return () => {
    active = false;
    subscription.unsubscribe();
  };
};

export const getAgencyModels = async (
  agencyId: string
): Promise<ModelProfile[]> => {
  const { data, error } = await supabase
    .from('models')
    .select(`
      *,
      model_categories (category),
      model_images (cloudinary_url, display_order)
    `)
    .eq('agency_id', agencyId)
    .order('ranking_score', { ascending: false });

  if (error) {
    console.error('Error fetching agency models:', error);
    return [];
  }

  const withUsers = await attachUsersToModels(data || []);
  return withUsers.map(transformModelData);
};

export const updateModelProfile = async (
  uid: string,
  updates: Partial<ModelProfile>
): Promise<void> => {
  const userUpdates: any = {};
  const modelUpdates: any = {};
  const displayNameChangedAt = await assertDisplayNameCanChange(uid, updates.displayName);

  if (updates.displayName !== undefined) {
    userUpdates.display_name = updates.displayName.trim();
    if (displayNameChangedAt) userUpdates.display_name_changed_at = displayNameChangedAt;
  }
  if (updates.bio !== undefined) userUpdates.bio = updates.bio;
  if (updates.publicEmail !== undefined) userUpdates.public_email = updates.publicEmail;
  if (updates.whatsapp !== undefined) userUpdates.whatsapp = updates.whatsapp;
  if (updates.instagram !== undefined) userUpdates.instagram = updates.instagram;
  if (updates.facebook !== undefined) userUpdates.facebook = updates.facebook;
  if (updates.website !== undefined) userUpdates.website = updates.website;
  if (updates.contact?.publicEmail !== undefined) userUpdates.public_email = updates.contact.publicEmail;
  if (updates.contact?.whatsapp !== undefined) userUpdates.whatsapp = updates.contact.whatsapp;
  if (updates.contact?.instagram !== undefined) userUpdates.instagram = updates.contact.instagram;
  if (updates.contact?.facebook !== undefined) userUpdates.facebook = updates.contact.facebook;

  if (updates.height !== undefined) modelUpdates.height = updates.height || null;
  if (updates.age !== undefined) modelUpdates.age = updates.age || null;
  if (updates.gender !== undefined) modelUpdates.gender = updates.gender || null;
  if (updates.skinTone !== undefined) modelUpdates.skin_tone = updates.skinTone || null;
  if (updates.location !== undefined) modelUpdates.district = updates.location;
  if (updates.city !== undefined) modelUpdates.city = updates.city;
  if (updates.agencyId !== undefined) modelUpdates.agency_id = updates.agencyId;
  if (updates.agencyName !== undefined) modelUpdates.agency_name = updates.agencyName;
  if (updates.availability !== undefined) modelUpdates.availability = updates.availability;
  if (updates.media?.images) {
    modelUpdates.profile_image_url = updates.media.images.find(Boolean) || null;
  }
  if (updates.media?.videos) {
    modelUpdates.video_reel_url = updates.media.videos.find(Boolean) || null;
  }

  // Update users table if needed
  if (Object.keys(userUpdates).length > 0) {
    await retryWithoutMissingColumn(
      (safeUpdates) => supabase.from('users').update(safeUpdates).eq('id', uid),
      userUpdates,
      'display_name_changed_at'
    );
  }

  // Update models table if needed
  if (Object.keys(modelUpdates).length > 0) {
    const modelPayload = {
        id: uid,
        district: updates.location || 'Not Specified',
        views: updates.views || 0,
        ranking_score: updates.rankingScore || 0,
        availability: updates.availability ?? true,
        ...modelUpdates,
      };

    await retryWithoutMissingColumn(
      (safeUpdates) => supabase.from('models').upsert(safeUpdates, { onConflict: 'id' }),
      modelPayload,
      'age'
    );
  }

  // Handle categories separately
  if (updates.categories) {
    // Delete existing categories
    await supabase.from('model_categories').delete().eq('model_id', uid);

    // Insert new categories
    if (updates.categories.length > 0) {
      const categoryInserts = updates.categories.map((category) => ({
        model_id: uid,
        category,
      }));

      await supabase.from('model_categories').insert(categoryInserts);
    }
  }

  // Handle pricing separately
  if (updates.pricing) {
    // Delete existing pricing
    await supabase.from('model_pricing').delete().eq('model_id', uid);

    // Insert new pricing
    const pricingInserts = Object.entries(updates.pricing)
      .filter(([, price]) => typeof price === 'number' && !Number.isNaN(price))
      .map(([category, price]) => ({
        model_id: uid,
        category,
        price,
      }));

    if (pricingInserts.length > 0) {
      await supabase.from('model_pricing').insert(pricingInserts);
    }
  }

  if (updates.media?.images) {
    await supabase.from('model_images').delete().eq('model_id', uid);

    const imageRows = updates.media.images
      .filter(Boolean)
      .map((url, index) => ({
        model_id: uid,
        cloudinary_url: url,
        cloudinary_public_id: getCloudinaryPublicId(url, `model-${uid}-${index}`),
        display_order: index,
      }));

    if (imageRows.length > 0) {
      const { error } = await supabase.from('model_images').insert(imageRows);
      if (error) throw error;
    }
  }

  refreshModelRankingScore(uid).catch((error) => {
    console.warn('Could not refresh ranking after profile update:', error);
  });
};

export const incrementModelViews = async (uid: string): Promise<void> => {
  const { data } = await supabase
    .from('models')
    .select('views')
    .eq('id', uid)
    .single();

  if (data) {
    await supabase
      .from('models')
      .update({ views: (data.views || 0) + 1 })
      .eq('id', uid);
  }
};

export const removeModelFromAgency = async (modelId: string): Promise<void> => {
  const { error } = await supabase
    .from('models')
    .update({
      agency_id: null,
      agency_name: null,
    })
    .eq('id', modelId);

  if (error) throw error;
};

// =====================================================
// AGENCY MANAGEMENT
// =====================================================

export const getAgencies = async (): Promise<UserData[]> => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('role', 'agency')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return data.map(transformUserData);
};

export const submitAgencyRequest = async (
  request: Omit<AgencyRequest, 'id' | 'createdAt' | 'status'>
): Promise<void> => {
  const payload = {
    applicant_id: request.uid,
    applicant_name: request.applicantName,
    agency_name: request.agencyName,
    logo_url: request.logoUrl,
    bio: request.bio,
    whatsapp: request.whatsapp,
    instagram: request.socialLinks?.instagram || null,
    facebook: request.socialLinks?.facebook || null,
    tiktok: request.socialLinks?.tiktok || null,
    website: request.socialLink || null, // Using deprecated socialLink for backward compatibility
    location: request.location || null,
    member_count_male: request.memberCount?.male || 0,
    member_count_female: request.memberCount?.female || 0,
    status: 'pending',
  };

  let { data, error } = await supabase.from('agency_requests').insert(payload).select('id').single();

  if (error && /column .* does not exist/i.test(error.message || '')) {
    const { tiktok, location, ...legacyPayload } = payload;
    const retry = await supabase.from('agency_requests').insert(legacyPayload).select('id').single();
    data = retry.data;
    error = retry.error;
  }

  if (error) throw error;

  if (data?.id && request.modelPhotos && request.modelPhotos.length > 0) {
    const photos = request.modelPhotos.map((url, index) => ({
      request_id: data.id,
      cloudinary_url: url,
      cloudinary_public_id: getCloudinaryPublicId(url, `agency-request-${data.id}-${index}`),
      display_order: index,
    }));

    const { error: photoError } = await supabase.from('agency_request_photos').insert(photos);
    if (photoError) console.error('Error saving agency request photos:', photoError);
  }

  // Create notification for admins
  const { data: admins } = await supabase
    .from('users')
    .select('id')
    .eq('role', 'admin');

  if (admins) {
    const notifications = admins.map((admin) => ({
      user_id: admin.id,
      type: 'AGENCY_REQUEST',
      title: 'New Agency Registration',
      message: `${request.agencyName} has submitted a registration request`,
      link: '/admin?tab=requests',
    }));

    await supabase.from('notifications').insert(notifications);
  }
};

export const subscribeToAgencyRequests = (
  callback: (requests: AgencyRequest[]) => void
): (() => void) => {
  let active = true;

  const fetchRequests = async () => {
    const { data, error } = await supabase
      .from('agency_requests')
      .select('*, agency_request_photos (cloudinary_url, display_order)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching agency requests:', error);
      if (active) callback([]);
      return;
    }

    if (active) {
      callback(data.map(transformAgencyRequest));
    }
  };

  fetchRequests();

  const subscription = supabase
    .channel('agency_requests')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'agency_requests',
      },
      () => {
        fetchRequests();
      }
    )
    .subscribe();

  return () => {
    active = false;
    subscription.unsubscribe();
  };
};

export const approveAgencyRequest = async (requestOrId: string | AgencyRequest): Promise<void> => {
  const requestId = typeof requestOrId === 'string' ? requestOrId : requestOrId.id;

  // Get request details
  const { data: request, error: fetchError } = await supabase
    .from('agency_requests')
    .select('*')
    .eq('id', requestId)
    .single();

  if (fetchError) throw fetchError;

  // Update user role to agency
  const { error: updateError } = await supabase
    .from('users')
    .update({
      role: 'agency',
      display_name: request.agency_name,
      bio: request.bio,
      photo_url: request.logo_url,
      whatsapp: request.whatsapp,
      instagram: request.instagram,
      facebook: request.facebook,
      website: request.website,
    })
    .eq('id', request.applicant_id);

  if (updateError) throw updateError;

  // Mark request as approved
  await supabase
    .from('agency_requests')
    .update({
      status: 'approved',
      processed_at: new Date().toISOString(),
    })
    .eq('id', requestId);

  // Notify applicant
  await createNotification({
    userId: request.applicant_id,
    type: 'AGENCY_APPROVED',
    title: 'Agency Application Approved',
    message: `Your agency "${request.agency_name}" has been approved!`,
    link: '/agency-dashboard',
  });

  await logAdminAction({
    actionType: 'agency_request_approved',
    targetUserId: request.applicant_id,
    targetTable: 'agency_requests',
    targetId: requestId,
    details: { agencyName: request.agency_name },
  });
};

export const rejectAgencyRequest = async (requestId: string): Promise<void> => {
  const { data: request } = await supabase
    .from('agency_requests')
    .select('*')
    .eq('id', requestId)
    .single();

  // Mark request as rejected
  await supabase
    .from('agency_requests')
    .update({
      status: 'rejected',
      processed_at: new Date().toISOString(),
    })
    .eq('id', requestId);

  if (request) {
    await createNotification({
      userId: request.applicant_id,
      type: 'AGENCY_REJECTED',
      title: 'Agency Application Rejected',
      message: 'Your agency registration request was not approved.',
      link: '/help',
    });

    await logAdminAction({
      actionType: 'agency_request_rejected',
      targetUserId: request.applicant_id,
      targetTable: 'agency_requests',
      targetId: requestId,
      details: { agencyName: request.agency_name },
    });
  }
};

// ... (continuing in next file part)// services/supabase.service.part2.ts

// =====================================================
// PROJECT MANAGEMENT
// =====================================================

const attachProjectRelations = async (projects: any[]): Promise<any[]> => {
  if (!projects || projects.length === 0) return projects || [];

  const ids = Array.from(new Set(projects.map((project) => project.id).filter(Boolean)));
  if (ids.length === 0) return projects;

  const [{ data: applications, error: applicationsError }, { data: invitations, error: invitationsError }] =
    await Promise.all([
      supabase
        .from('project_applications')
        .select('project_id, model_id, status, applied_at')
        .in('project_id', ids),
      supabase
        .from('project_invitations')
        .select('project_id, model_id, status, invited_at, responded_at')
        .in('project_id', ids),
    ]);

  if (applicationsError) console.error('Error fetching project applications:', applicationsError);
  if (invitationsError) console.error('Error fetching project invitations:', invitationsError);

  const applicationsByProject = new Map<string, any[]>();
  (applications || []).forEach((application: any) => {
    const rows = applicationsByProject.get(application.project_id) || [];
    rows.push(application);
    applicationsByProject.set(application.project_id, rows);
  });

  const invitationsByProject = new Map<string, any[]>();
  (invitations || []).forEach((invitation: any) => {
    const rows = invitationsByProject.get(invitation.project_id) || [];
    rows.push(invitation);
    invitationsByProject.set(invitation.project_id, rows);
  });

  return projects.map((project) => ({
    ...project,
    _applications: applicationsByProject.get(project.id) || [],
    _invitations: invitationsByProject.get(project.id) || [],
  }));
};

export const createProject = async (
  project: Omit<Project, 'id' | 'createdAt'>
): Promise<string> => {
  const { data, error } = await supabase
    .from('projects')
    .insert({
      owner_id: project.ownerId,
      owner_name: project.ownerName,
      owner_photo_url: project.ownerPhotoUrl,
      owner_verified: project.ownerVerified,
      title: project.title,
      description: project.description,
      category: project.category,
      location: project.location,
      dates: project.dates,
      event_date: project.eventDate,
      status: project.status || 'OPEN',
      visibility: project.visibility || 'PUBLIC',
    })
    .select('id')
    .single();

  if (error) throw error;

  return data.id;
};

export const getProjectById = async (projectId: string): Promise<Project | null> => {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single();

  if (error) {
    console.error('Error fetching project:', error);
    return null;
  }

  const [project] = await attachProjectRelations([data]);
  return transformProject(project);
};

export const subscribeToProjects = (
  callback: (projects: Project[]) => void
): (() => void) => {
  let active = true;

  const fetchProjects = async () => {
    const { data, error} = await supabase
      .from('projects')
      .select('*')
      .eq('status', 'OPEN')
      .eq('visibility', 'PUBLIC')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching projects:', error);
      if (active) callback([]);
      return;
    }

    if (active) {
      callback((await attachProjectRelations(data || [])).map(transformProject));
    }
  };

  fetchProjects();

  const subscription = supabase
    .channel('projects')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'projects',
      },
      () => {
        fetchProjects();
      }
    )
    .subscribe();

  return () => {
    active = false;
    subscription.unsubscribe();
  };
};

export const subscribeToClientProjects = (
  clientId: string,
  callback: (projects: Project[]) => void
): (() => void) => {
  let active = true;
  let debounceTimer: DebounceTimer = null;
  let projectIds = new Set<string>();

  const fetchProjects = async () => {
    // Clear any pending debounced fetch
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }

    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('owner_id', clientId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching client projects:', error);
      if (active) callback([]);
      return;
    }

    if (active) {
      const projects = data || [];
      projectIds = new Set(projects.map((project: any) => project.id).filter(Boolean));
      callback((await attachProjectRelations(projects)).map(transformProject));
    }
  };

  // Debounced fetch to avoid excessive bandwidth usage
  const debouncedFetch = () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      fetchProjects();
    }, 500);
  };

  fetchProjects();

  const subscription = supabase
    .channel(`client_projects_realtime:${clientId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'projects',
        filter: `owner_id=eq.${clientId}`,
      },
      () => {
        debouncedFetch();
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'project_applications',
      },
      (payload) => {
        const changedProjectId = (payload.new as any)?.project_id || (payload.old as any)?.project_id;
        if (changedProjectId && projectIds.has(changedProjectId)) {
          debouncedFetch();
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'project_invitations',
      },
      (payload) => {
        const changedProjectId = (payload.new as any)?.project_id || (payload.old as any)?.project_id;
        if (changedProjectId && projectIds.has(changedProjectId)) {
          debouncedFetch();
        }
      }
    )
    .subscribe();

  return () => {
    active = false;
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    subscription.unsubscribe();
  };
};

export const subscribeToOpenProjectsByCategories = (
  categories: Category[],
  callback: (projects: Project[]) => void
): (() => void) => {
  let active = true;
  let debounceTimer: DebounceTimer = null;
  let projectIds = new Set<string>();

  const fetchProjects = async () => {
    // Clear any pending debounced fetch
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }

    let query = supabase
      .from('projects')
      .select('*')
      .eq('status', 'OPEN')
      .eq('visibility', 'PUBLIC')
      .order('created_at', { ascending: false });

    if (categories.length > 0) {
      query = query.in('category', categories);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching projects by categories:', error);
      if (active) callback([]);
      return;
    }

    if (active) {
      const projects = data || [];
      projectIds = new Set(projects.map((project: any) => project.id).filter(Boolean));
      callback((await attachProjectRelations(projects)).map(transformProject));
    }
  };

  // Debounced fetch to avoid excessive bandwidth usage
  const debouncedFetch = () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    // Wait 500ms before fetching to batch multiple rapid changes
    debounceTimer = setTimeout(() => {
      fetchProjects();
    }, 500);
  };

  fetchProjects();

  // Subscribe to both projects and applications tables for real-time updates
  const subscription = supabase
    .channel('projects_by_categories_realtime')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'projects',
      },
      () => {
        debouncedFetch();
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'project_applications',
      },
      (payload) => {
        const changedProjectId = (payload.new as any)?.project_id || (payload.old as any)?.project_id;
        if (changedProjectId && projectIds.has(changedProjectId)) {
          debouncedFetch();
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'project_invitations',
      },
      (payload) => {
        const changedProjectId = (payload.new as any)?.project_id || (payload.old as any)?.project_id;
        if (changedProjectId && projectIds.has(changedProjectId)) {
          debouncedFetch();
        }
      }
    )
    .subscribe();

  return () => {
    active = false;
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    subscription.unsubscribe();
  };
};

export const getAllProjectsAdmin = async (): Promise<Project[]> => {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (await attachProjectRelations(data || [])).map(transformProject);
};

export const updateProject = async (
  projectId: string,
  updates: Partial<Project>
): Promise<void> => {
  const dbUpdates: any = {};

  if (updates.ownerName !== undefined) dbUpdates.owner_name = updates.ownerName;
  if (updates.ownerPhotoUrl !== undefined) dbUpdates.owner_photo_url = updates.ownerPhotoUrl;
  if (updates.ownerVerified !== undefined) dbUpdates.owner_verified = updates.ownerVerified;
  if (updates.title !== undefined) dbUpdates.title = updates.title;
  if (updates.description !== undefined) dbUpdates.description = updates.description;
  if (updates.category !== undefined) dbUpdates.category = updates.category;
  if (updates.location !== undefined) dbUpdates.location = updates.location;
  if (updates.dates !== undefined) dbUpdates.dates = updates.dates;
  if (updates.eventDate !== undefined) dbUpdates.event_date = updates.eventDate;
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.visibility !== undefined) dbUpdates.visibility = updates.visibility;

  if (Object.keys(dbUpdates).length > 0) {
    const { error } = await supabase
      .from('projects')
      .update(dbUpdates)
      .eq('id', projectId);

    if (error) throw error;
  }

  if (updates.applicantModels) {
    const desiredApplicants = new Set(updates.applicantModels);
    const { data: currentApplicants } = await supabase
      .from('project_applications')
      .select('model_id')
      .eq('project_id', projectId)
      .eq('status', 'pending');

    const removedApplicants = (currentApplicants || [])
      .map((row: any) => row.model_id)
      .filter((modelId: string) => !desiredApplicants.has(modelId));

    if (removedApplicants.length > 0) {
      const { error } = await supabase
        .from('project_applications')
        .update({ status: 'rejected' })
        .eq('project_id', projectId)
        .in('model_id', removedApplicants);

      if (error) throw error;
    }
  }
};

export const deleteProject = async (projectId: string): Promise<void> => {
  await retryWithoutMissingColumn(
    (updates) => supabase.from('projects').update(updates).eq('id', projectId),
    { deleted_at: new Date().toISOString(), status: ProjectStatus.CANCELLED },
    'deleted_at'
  );

  await logAdminAction({
    actionType: 'project_soft_deleted',
    targetTable: 'projects',
    targetId: projectId,
    details: { status: ProjectStatus.CANCELLED },
  });
};

export const applyToProject = async (
  projectId: string,
  modelId: string
): Promise<void> => {
  await enforceRateLimit('project_application', modelId, 20, 3600);

  const { error } = await supabase.from('project_applications').insert({
    project_id: projectId,
    model_id: modelId,
    status: 'pending',
  });

  if (error) throw error;

  // Get project and model details for notification
  const { data: project } = await supabase
    .from('projects')
    .select('owner_id, title')
    .eq('id', projectId)
    .single();

  const { data: model } = await supabase
    .from('users')
    .select('display_name')
    .eq('id', modelId)
    .single();

  if (project && model) {
    await createNotification({
      userId: project.owner_id,
      type: 'APPLICATION_RECEIVED',
      title: 'New Application',
      message: `${model.display_name} applied to ${project.title}`,
      link: `/casting?project=${projectId}`,
    });
  }
};

export const cancelProjectApplication = async (
  projectId: string,
  modelId: string
): Promise<void> => {
  const { error } = await supabase
    .from('project_applications')
    .delete()
    .eq('project_id', projectId)
    .eq('model_id', modelId)
    .eq('status', 'pending'); // Only allow canceling pending applications

  if (error) throw error;
};

export const approveModelApplication = async (
  projectId: string,
  modelId: string,
  _approvals?: any[],
  offerPrice = 0
): Promise<void> => {
  // Update application status
  const { error: applicationError } = await supabase
    .from('project_applications')
    .update({ status: 'approved' })
    .eq('project_id', projectId)
    .eq('model_id', modelId);

  if (applicationError) throw applicationError;

  // Get details for booking creation
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single();

  if (projectError) throw projectError;

  const { data: model } = await supabase
    .from('users')
    .select('display_name')
    .eq('id', modelId)
    .single();

  if (project && model) {
    const { data: client } = await supabase
      .from('users')
      .select('display_name')
      .eq('id', project.owner_id)
      .single();

    // Create booking
    const bookingPayload = {
      project_id: projectId,
      project_title: project.title,
      event_date: project.event_date || null,
      model_id: modelId,
      model_name: model.display_name,
      client_id: project.owner_id,
      client_name: client?.display_name || project.owner_name,
      status: 'negotiating',
      current_offer_amount: offerPrice || 0,
      current_offer_by: 'client',
      current_offer_at: new Date().toISOString(),
    };

    let { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .upsert(bookingPayload, { onConflict: 'project_id,model_id' })
      .select('id')
      .single();

    if (bookingError && isMissingColumnError(bookingError, 'event_date')) {
      const { event_date, ...legacyBookingPayload } = bookingPayload;
      const retry = await supabase
        .from('bookings')
        .upsert(legacyBookingPayload, { onConflict: 'project_id,model_id' })
        .select('id')
        .single();
      booking = retry.data;
      bookingError = retry.error;
    }

    if (bookingError) throw bookingError;

    if (booking && offerPrice > 0) {
      await supabase.from('booking_negotiations').insert({
        booking_id: booking.id,
        role: 'client',
        amount: offerPrice,
        note: 'Initial offer',
      });
    }

    // Notify model
    await createNotification({
      userId: modelId,
      type: 'APPLICATION_APPROVED',
      title: 'Application Approved',
      message: `Your application for ${project.title} was approved!`,
      link: '/dashboard?tab=bookings',
    });
  }
};

export const inviteModelToProject = async (
  projectId: string,
  modelId: string
): Promise<void> => {
  const actorId = await getCurrentAuthUserId();
  if (actorId) {
    await enforceRateLimit('project_invitation', actorId, 50, 3600);
  }

  const { error } = await supabase.from('project_invitations').insert({
    project_id: projectId,
    model_id: modelId,
    status: 'pending',
  });

  if (error) throw error;

  // Get details for notification
  const { data: project } = await supabase
    .from('projects')
    .select('title')
    .eq('id', projectId)
    .single();

  if (project) {
    await createNotification({
      userId: modelId,
      type: 'PROJECT_INVITATION',
      title: 'Project Invitation',
      message: `You've been invited to ${project.title}`,
      link: `/casting?project=${projectId}`,
    });
  }
};

// =====================================================
// BOOKING MANAGEMENT
// =====================================================

export const subscribeToBookings = (
  userId: string,
  role: UserRole,
  callback: (bookings: Booking[]) => void
): (() => void) => {
  let active = true;
  let debounceTimer: DebounceTimer = null;
  let bookingIds = new Set<string>();

  const fetchBookings = async () => {
    // Clear any pending debounced fetch
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }

    let query = supabase.from('bookings').select(`
      *,
      booking_negotiations (
        role,
        amount,
        note,
        created_at
      )
    `);

    if (role === UserRole.MODEL) {
      query = query.eq('model_id', userId);
    } else if (role === UserRole.CLIENT) {
      query = query.eq('client_id', userId);
    }

    query = query.order('updated_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching bookings:', error);
      if (active) callback([]);
      return;
    }

    // Filter out hidden bookings
    const { data: hidden } = await supabase
      .from('booking_hidden_by')
      .select('booking_id')
      .eq('user_id', userId);

    const hiddenIds = hidden?.map((h) => h.booking_id) || [];
    const visibleBookings = (data || []).filter((b) => !hiddenIds.includes(b.id));

    if (active) {
      bookingIds = new Set(visibleBookings.map((booking: any) => booking.id).filter(Boolean));
      callback(visibleBookings.map(transformBooking));
    }
  };

  // Debounced fetch to avoid excessive bandwidth usage
  const debouncedFetch = () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      fetchBookings();
    }, 500);
  };

  fetchBookings();

  const bookingChangeConfig: any = {
    event: '*',
    schema: 'public',
    table: 'bookings',
  };

  if (role === UserRole.MODEL) {
    bookingChangeConfig.filter = `model_id=eq.${userId}`;
  } else if (role === UserRole.CLIENT) {
    bookingChangeConfig.filter = `client_id=eq.${userId}`;
  }

  const subscription = supabase
    .channel(`bookings_realtime:${userId}`)
    .on(
      'postgres_changes',
      bookingChangeConfig,
      () => {
        debouncedFetch();
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'booking_negotiations',
      },
      (payload) => {
        const changedBookingId = (payload.new as any)?.booking_id || (payload.old as any)?.booking_id;
        if (changedBookingId && bookingIds.has(changedBookingId)) {
          debouncedFetch();
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'booking_hidden_by',
        filter: `user_id=eq.${userId}`,
      },
      () => {
        debouncedFetch();
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'reviews',
      },
      (payload) => {
        const changedBookingId = (payload.new as any)?.booking_id || (payload.old as any)?.booking_id;
        if (changedBookingId && bookingIds.has(changedBookingId)) {
          debouncedFetch();
        }
      }
    )
    .subscribe();

  return () => {
    active = false;
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    subscription.unsubscribe();
  };
};

export const updateBookingStatus = async (
  bookingId: string,
  status: BookingStatus,
  currentOffer?: number,
  _acceptedByRole?: UserRole
): Promise<void> => {
  const updates: any = { status: String(status).toLowerCase() };
  if (typeof currentOffer === 'number') {
    updates.current_offer_amount = currentOffer;
    updates.current_offer_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from('bookings')
    .update(updates)
    .eq('id', bookingId);

  if (error) throw error;
};

export const updateBookingOffer = async (
  bookingId: string,
  amountOrOffer: number | BookingOffer,
  offeredBy?: 'model' | 'client',
  note?: string
): Promise<void> => {
  const amount = typeof amountOrOffer === 'number' ? amountOrOffer : amountOrOffer.amount;
  const role = typeof amountOrOffer === 'number' ? offeredBy : amountOrOffer.role;
  const offerNote = typeof amountOrOffer === 'number' ? note : amountOrOffer.note;

  if (!role) throw new Error('Offer sender is required');

  // Update booking with current offer
  const { error: updateError } = await supabase
    .from('bookings')
    .update({
      current_offer_amount: amount,
      current_offer_by: role,
      current_offer_at: new Date().toISOString(),
    })
    .eq('id', bookingId);

  if (updateError) throw updateError;

  // Add to negotiation history
  const { error: historyError } = await supabase.from('booking_negotiations').insert({
    booking_id: bookingId,
    role,
    amount,
    note: offerNote,
  });

  if (historyError) throw historyError;

  // Notify the other party
  const { data: booking } = await supabase
    .from('bookings')
    .select('model_id, model_name, client_id, client_name, project_title')
    .eq('id', bookingId)
    .single();

  if (booking) {
    const recipientId = role === 'model' ? booking.client_id : booking.model_id;
    const senderName = role === 'model' ? booking.model_name : booking.client_name;

    await createNotification({
      userId: recipientId,
      type: 'BOOKING_OFFER',
      title: 'New Offer',
      message: `${senderName} sent a new offer for ${booking.project_title}`,
      link: role === 'model' ? '/client-dashboard?tab=bookings' : '/dashboard?tab=bookings',
    });
  }
};

export const uploadPaymentProof = async (
  bookingId: string,
  proofUrl: string
): Promise<void> => {
  const { error } = await supabase
    .from('bookings')
    .update({
      payment_proof_url: proofUrl,
      status: 'scheduled',
    })
    .eq('id', bookingId);

  if (error) throw error;

  // Notify model
  const { data: booking } = await supabase
    .from('bookings')
    .select('model_id, project_title')
    .eq('id', bookingId)
    .single();

  if (booking) {
    await createNotification({
      userId: booking.model_id,
      type: 'PAYMENT_UPLOADED',
      title: 'Payment Proof Uploaded',
      message: `Payment proof for ${booking.project_title} has been uploaded`,
      link: '/dashboard?tab=bookings',
    });
  }
};

export const completeBooking = async (bookingId: string): Promise<void> => {
  const { error } = await supabase
    .from('bookings')
    .update({ status: 'completed' })
    .eq('id', bookingId);

  if (error) throw error;

  const { data: booking } = await supabase
    .from('bookings')
    .select('model_id')
    .eq('id', bookingId)
    .maybeSingle();

  if (booking?.model_id) {
    await refreshModelRankingScore(booking.model_id);
  }
};

export const cancelBookingWithReason = async (
  bookingId: string,
  reason: string,
  _cancelledBy?: string
): Promise<void> => {
  const updates = {
    status: 'cancelled',
    cancellation_reason: reason || null,
    cancelled_by: _cancelledBy || null,
  };

  let safeUpdates: any = { ...updates };
  let cancellationUpdated = false;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { error } = await supabase
      .from('bookings')
      .update(safeUpdates)
      .eq('id', bookingId);

    if (!error) {
      cancellationUpdated = true;
      break;
    }

    if (isMissingColumnError(error, 'cancellation_reason')) {
      delete safeUpdates.cancellation_reason;
      continue;
    }

    if (isMissingColumnError(error, 'cancelled_by')) {
      delete safeUpdates.cancelled_by;
      continue;
    }

    throw error;
  }

  if (!cancellationUpdated) {
    throw new Error('Booking cancellation could not be saved.');
  }

  // Notify both parties
  const { data: booking } = await supabase
    .from('bookings')
    .select('model_id, client_id, project_title')
    .eq('id', bookingId)
    .single();

  if (booking) {
    await createNotification({
      userId: booking.model_id,
      type: 'BOOKING_CANCELLED',
      title: 'Booking Cancelled',
      message: `${booking.project_title} has been cancelled. Reason: ${reason}`,
      link: '/dashboard?tab=bookings',
    });

    await createNotification({
      userId: booking.client_id,
      type: 'BOOKING_CANCELLED',
      title: 'Booking Cancelled',
      message: `${booking.project_title} has been cancelled. Reason: ${reason}`,
      link: '/client-dashboard?tab=bookings',
    });
  }
};

export const archiveBooking = async (
  bookingId: string,
  userId: string
): Promise<void> => {
  const { error } = await supabase.from('booking_hidden_by').upsert(
    {
      booking_id: bookingId,
      user_id: userId,
    },
    { onConflict: 'booking_id,user_id' }
  );

  if (error) throw error;
};

// =====================================================
// REVIEW & REPORT MANAGEMENT
// =====================================================

export type ReviewListMode = 'received' | 'authored';

const attachReviewRelations = async (reviews: any[]): Promise<any[]> => {
  if (!reviews || reviews.length === 0) return reviews || [];

  const userIds = Array.from(new Set(
    reviews.flatMap((review: any) => [review.author_id, review.target_id]).filter(Boolean)
  ));
  const bookingIds = Array.from(new Set(reviews.map((review: any) => review.booking_id).filter(Boolean)));

  const [{ data: users, error: usersError }, { data: bookings, error: bookingsError }] = await Promise.all([
    userIds.length > 0
      ? supabase.from('users').select('id, display_name, role').in('id', userIds)
      : Promise.resolve({ data: [], error: null } as any),
    bookingIds.length > 0
      ? supabase.from('bookings').select('id, project_title, status').in('id', bookingIds)
      : Promise.resolve({ data: [], error: null } as any),
  ]);

  if (usersError) console.warn('Error fetching review users:', usersError);
  if (bookingsError) console.warn('Error fetching review bookings:', bookingsError);

  const usersById = new Map((users || []).map((user: any) => [user.id, user]));
  const bookingsById = new Map((bookings || []).map((booking: any) => [booking.id, booking]));

  return reviews.map((review: any) => ({
    ...review,
    _author: usersById.get(review.author_id) || null,
    _target: usersById.get(review.target_id) || null,
    _booking: bookingsById.get(review.booking_id) || null,
  }));
};

const transformReviewData = (data: any, viewerId?: string): Review => {
  const editCount = Number(data.edit_count || 0);

  return {
    id: data.id,
    authorId: data.author_id,
    authorName: data._author?.display_name || 'User',
    authorRole: data._author?.role,
    targetId: data.target_id,
    targetName: data._target?.display_name || 'User',
    targetRole: data.target_role || data._target?.role,
    bookingId: data.booking_id,
    projectTitle: data._booking?.project_title,
    bookingStatus: data._booking?.status,
    rating: Number(data.rating || 0),
    comment: data.comment || '',
    editCount,
    canEdit: viewerId === data.author_id && editCount < 1,
    createdAt: data.created_at,
    updatedAt: data.updated_at || data.created_at,
  };
};

export const getReviewsForUser = async (
  userId: string,
  mode: ReviewListMode = 'received',
  viewerId?: string,
  limit = 100
): Promise<Review[]> => {
  if (!userId) return [];

  const column = mode === 'authored' ? 'author_id' : 'target_id';
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq(column, userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching reviews:', error);
    return [];
  }

  return (await attachReviewRelations(data || [])).map((review) => transformReviewData(review, viewerId));
};

export const subscribeToUserReviews = (
  userId: string,
  mode: ReviewListMode,
  callback: (reviews: Review[]) => void,
  viewerId?: string,
  limit = 100
): (() => void) => {
  let active = true;
  let debounceTimer: DebounceTimer = null;
  const column = mode === 'authored' ? 'author_id' : 'target_id';

  const fetchReviews = async () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }

    const reviews = await getReviewsForUser(userId, mode, viewerId, limit);
    if (active) callback(reviews);
  };

  const debouncedFetch = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(fetchReviews, 250);
  };

  fetchReviews();

  const subscription = supabase
    .channel(`reviews:${mode}:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'reviews',
        filter: `${column}=eq.${userId}`,
      },
      () => {
        debouncedFetch();
      }
    )
    .subscribe();

  return () => {
    active = false;
    if (debounceTimer) clearTimeout(debounceTimer);
    subscription.unsubscribe();
  };
};

const getBookingForReview = async (bookingId: string): Promise<any | null> => {
  let { data, error } = await supabase
    .from('bookings')
    .select('id, status, model_id, client_id, event_date, model_review_id, client_review_id')
    .eq('id', bookingId)
    .maybeSingle();

  if (error && isMissingColumnError(error, 'event_date')) {
    const retry = await supabase
      .from('bookings')
      .select('id, status, model_id, client_id, model_review_id, client_review_id')
      .eq('id', bookingId)
      .maybeSingle();
    data = retry.data;
    error = retry.error;
  }

  if (error) throw error;
  return data;
};

const getExistingReviewForAuthor = async (bookingId: string, authorId: string): Promise<any | null> => {
  let { data, error } = await supabase
    .from('reviews')
    .select('id, edit_count')
    .eq('booking_id', bookingId)
    .eq('author_id', authorId)
    .maybeSingle();

  if (error && isMissingColumnError(error, 'edit_count')) {
    const retry = await supabase
      .from('reviews')
      .select('id')
      .eq('booking_id', bookingId)
      .eq('author_id', authorId)
      .maybeSingle();
    data = retry.data;
    error = retry.error;
  }

  if (error) throw error;
  return data;
};

const saveReviewRow = async (review: {
  bookingId: string;
  authorId: string;
  targetId: string;
  targetRole: UserRole;
  rating: number;
  comment?: string;
}, existingReview?: any | null): Promise<string> => {
  const now = new Date().toISOString();
  const comment = review.comment?.trim() || null;

  if (existingReview) {
    const editCount = Number(existingReview.edit_count || 0);
    if (editCount >= 1) {
      throw new Error('You have already edited this review once.');
    }

    const updatePayload = {
      rating: review.rating,
      comment,
      edit_count: editCount + 1,
      updated_at: now,
    };

    let { data, error } = await supabase
      .from('reviews')
      .update(updatePayload)
      .eq('id', existingReview.id)
      .select('id')
      .single();

    if (error && (isMissingColumnError(error, 'edit_count') || isMissingColumnError(error, 'updated_at'))) {
      const retry = await supabase
        .from('reviews')
        .update({ rating: review.rating, comment })
        .eq('id', existingReview.id)
        .select('id')
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error) throw error;
    return data.id;
  }

  const insertPayload = {
    booking_id: review.bookingId,
    author_id: review.authorId,
    target_id: review.targetId,
    target_role: review.targetRole,
    rating: review.rating,
    comment,
    edit_count: 0,
    updated_at: now,
  };

  let { data, error } = await supabase
    .from('reviews')
    .insert(insertPayload)
    .select('id')
    .single();

  if (error && (isMissingColumnError(error, 'edit_count') || isMissingColumnError(error, 'updated_at'))) {
    const { edit_count, updated_at, ...legacyPayload } = insertPayload;
    const retry = await supabase
      .from('reviews')
      .insert(legacyPayload)
      .select('id')
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error) throw error;
  return data.id;
};

export const refreshModelRankingScore = async (modelId: string): Promise<void> => {
  if (!modelId) return;

  try {
    const [{ data: model }, { data: user }, { count: completedBookings }] = await Promise.all([
      supabase
        .from('models')
        .select('availability, views, profile_completeness')
        .eq('id', modelId)
        .maybeSingle(),
      supabase
        .from('users')
        .select('average_rating, reviews_count, completed_projects')
        .eq('id', modelId)
        .maybeSingle(),
      supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('model_id', modelId)
        .eq('status', 'completed'),
    ]);

    if (!model && !user) return;

    const ratingScore = Number(user?.average_rating || 0) * 20;
    const reviewScore = Math.min(Number(user?.reviews_count || 0), 25) * 2;
    const completedScore = Math.min(completedBookings ?? Number(user?.completed_projects || 0), 25) * 2;
    const completenessScore = Math.min(Number(model?.profile_completeness || 0), 100) * 0.25;
    const availabilityScore = model?.availability ? 10 : 0;
    const viewScore = Math.min(Number(model?.views || 0) / 10, 10);

    const rankingScore = Number(
      (ratingScore + reviewScore + completedScore + completenessScore + availabilityScore + viewScore).toFixed(2)
    );

    const { error } = await supabase
      .from('models')
      .update({ ranking_score: rankingScore })
      .eq('id', modelId);

    if (error) {
      console.warn('Could not update model ranking score:', error.message);
    }
  } catch (error) {
    console.warn('Could not refresh model ranking score:', error);
  }
};

export const submitReview = async (reviewOrBookingId: {
  bookingId: string;
  authorId: string;
  targetId: string;
  targetRole: UserRole;
  rating: number;
  comment?: string;
} | string, reviewData?: {
  authorId: string;
  targetId: string;
  targetRole: UserRole;
  rating: number;
  comment?: string;
}, _authorRole?: UserRole): Promise<void> => {
  const review =
    typeof reviewOrBookingId === 'string'
      ? { bookingId: reviewOrBookingId, ...reviewData }
      : reviewOrBookingId;

  if (!review.authorId || !review.targetId || !review.targetRole || !review.rating) {
    throw new Error('Missing review details');
  }

  if (review.rating < 1 || review.rating > 5) {
    throw new Error('Rating must be between 1 and 5.');
  }

  const booking = await getBookingForReview(review.bookingId);
  if (!booking) throw new Error('Booking not found.');

  const authorIsClient = booking.client_id === review.authorId;
  const authorIsModel = booking.model_id === review.authorId;
  if (!authorIsClient && !authorIsModel) {
    throw new Error('You can only review bookings you participated in.');
  }

  const expectedTargetId = authorIsClient ? booking.model_id : booking.client_id;
  const expectedTargetRole = authorIsClient ? UserRole.MODEL : UserRole.CLIENT;
  if (review.targetId !== expectedTargetId || review.targetRole !== expectedTargetRole) {
    throw new Error('Review target does not match this booking.');
  }

  if (!REVIEWABLE_BOOKING_STATUSES.has(booking.status) && !isPastOrToday(booking.event_date)) {
    throw new Error('Reviews unlock after the booking is completed, cancelled, reported, or the job date has passed.');
  }

  const existingReview = await getExistingReviewForAuthor(review.bookingId, review.authorId);
  const reviewId = await saveReviewRow(review as {
    bookingId: string;
    authorId: string;
    targetId: string;
    targetRole: UserRole;
    rating: number;
    comment?: string;
  }, existingReview);

  // Update booking with review reference
  if (review.targetRole === UserRole.MODEL) {
    await retryWithoutMissingColumn(
      (updates) => supabase.from('bookings').update(updates).eq('id', review.bookingId),
      { client_review_id: reviewId },
      'client_review_id'
    );
  } else {
    await retryWithoutMissingColumn(
      (updates) => supabase.from('bookings').update(updates).eq('id', review.bookingId),
      { model_review_id: reviewId },
      'model_review_id'
    );
  }

  if (review.targetRole === UserRole.MODEL) {
    await refreshModelRankingScore(review.targetId);
  }
};

export const disputeReview = async (reviewId: string, reporterId: string, details: string): Promise<void> => {
  const { data: review, error } = await supabase
    .from('reviews')
    .select('id, author_id, target_id, target_role, rating, comment, booking_id, bookings (status, project_title, model_id, client_id)')
    .eq('id', reviewId)
    .maybeSingle();

  if (error) throw error;
  if (!review) throw new Error('Review not found.');

  const booking = Array.isArray(review.bookings) ? review.bookings[0] : review.bookings;
  if (!booking || (booking.model_id !== reporterId && booking.client_id !== reporterId)) {
    throw new Error('You can only dispute reviews connected to your own booking.');
  }

  if (review.author_id === reporterId) {
    throw new Error('You cannot dispute your own review.');
  }

  if (!['cancelled', 'reported'].includes(booking.status) && Number(review.rating || 0) > 2) {
    throw new Error('Review disputes are reserved for cancelled/reported bookings or serious low ratings.');
  }

  const { data: reporter } = await supabase
    .from('users')
    .select('role')
    .eq('id', reporterId)
    .maybeSingle();

  await submitReport({
    reporterId,
    reporterRole: reporter?.role || UserRole.MODEL,
    reportedUserId: review.author_id,
    reportedUserRole: review.target_role === UserRole.MODEL ? UserRole.CLIENT : UserRole.MODEL,
    reason: ReportReason.OTHER,
    bookingId: review.booking_id,
    details: `Review dispute for ${booking.project_title || 'booking'}: ${details || 'No additional details provided.'}\n\nReview: ${review.comment || 'No comment'}\nRating: ${review.rating}/5`,
  });
};

export const submitReport = async (reportOrReporterId: {
  reporterId: string;
  reporterRole: UserRole;
  reportedUserId: string;
  reportedUserRole: UserRole;
  reason: ReportReason;
  details?: string;
  bookingId?: string;
  projectId?: string;
} | string, reporterRole?: UserRole, reportedUserId?: string, reason?: ReportReason, details?: string): Promise<void> => {
  const report =
    typeof reportOrReporterId === 'string'
      ? {
          reporterId: reportOrReporterId,
          reporterRole: reporterRole || UserRole.MODEL,
          reportedUserId: reportedUserId || '',
          reportedUserRole: UserRole.MODEL,
          reason: reason || ReportReason.OTHER,
          details,
        }
      : reportOrReporterId;

  if (!report.reporterId || !report.reportedUserId) {
    throw new Error('Missing report details');
  }

  await enforceRateLimit('report_submission', report.reporterId, 5, 3600);

  const payload = {
    reporter_id: report.reporterId,
    reporter_role: report.reporterRole,
    reported_user_id: report.reportedUserId,
    reported_user_role: report.reportedUserRole,
    booking_id: report.bookingId || null,
    project_id: report.projectId || null,
    reason: report.reason,
    details: report.details,
    status: 'PENDING',
  };

  let { error } = await supabase.from('reports').insert(payload);

  if (error && (isMissingColumnError(error, 'booking_id') || isMissingColumnError(error, 'project_id'))) {
    const { booking_id, project_id, ...legacyPayload } = payload;
    const retry = await supabase.from('reports').insert(legacyPayload);
    error = retry.error;
  }

  if (error) throw error;

  // Notify admins
  const { data: admins } = await supabase
    .from('users')
    .select('id')
    .eq('role', 'admin');

  if (admins) {
    const notifications = admins.map((admin) => ({
      user_id: admin.id,
      type: 'NEW_REPORT',
      title: 'New Report Submitted',
      message: `A user has been reported for ${report.reason}`,
      link: '/admin?tab=reports',
    }));

    await supabase.from('notifications').insert(notifications);
  }
};

export const subscribeToReports = (
  callback: (reports: Report[]) => void
): (() => void) => {
  let active = true;

  const fetchReports = async () => {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching reports:', error);
      if (active) callback([]);
      return;
    }

    if (active) {
      callback(data.map(transformReport));
    }
  };

  fetchReports();

  const subscription = supabase
    .channel('reports')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'reports',
      },
      () => {
        fetchReports();
      }
    )
    .subscribe();

  return () => {
    active = false;
    subscription.unsubscribe();
  };
};

export const updateReportStatus = async (
  reportId: string,
  status: ReportStatus
): Promise<void> => {
  const { error } = await supabase
    .from('reports')
    .update({
      status,
      resolved_at: status === ReportStatus.RESOLVED ? new Date().toISOString() : null,
    })
    .eq('id', reportId);

  if (error) throw error;

  await logAdminAction({
    actionType: 'report_status_updated',
    targetTable: 'reports',
    targetId: reportId,
    details: { status },
  });
};

// =====================================================
// NOTIFICATION PREFERENCES, AVAILABILITY, AGREEMENTS & DISPUTES
// =====================================================

export const getNotificationPreferences = async (userId: string): Promise<NotificationPreferences | null> => {
  if (!(await hasOptionalRelation('notification_preferences'))) return null;

  const { data, error } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    if (isMissingRelationError(error, 'notification_preferences')) return null;
    throw error;
  }

  if (!data) return null;
  return {
    userId: data.user_id,
    inAppEnabled: data.in_app_enabled,
    emailEnabled: data.email_enabled,
    projectUpdates: data.project_updates,
    bookingUpdates: data.booking_updates,
    agencyUpdates: data.agency_updates,
    marketingEmails: data.marketing_emails,
    updatedAt: data.updated_at,
  };
};

export const updateNotificationPreferences = async (
  userId: string,
  updates: Partial<Omit<NotificationPreferences, 'userId' | 'updatedAt'>>
): Promise<void> => {
  if (!(await hasOptionalRelation('notification_preferences'))) return;

  const payload: any = { user_id: userId, updated_at: new Date().toISOString() };
  if (updates.inAppEnabled !== undefined) payload.in_app_enabled = updates.inAppEnabled;
  if (updates.emailEnabled !== undefined) payload.email_enabled = updates.emailEnabled;
  if (updates.projectUpdates !== undefined) payload.project_updates = updates.projectUpdates;
  if (updates.bookingUpdates !== undefined) payload.booking_updates = updates.bookingUpdates;
  if (updates.agencyUpdates !== undefined) payload.agency_updates = updates.agencyUpdates;
  if (updates.marketingEmails !== undefined) payload.marketing_emails = updates.marketingEmails;

  const { error } = await supabase
    .from('notification_preferences')
    .upsert(payload, { onConflict: 'user_id' });

  if (error) throw error;
};

export const getModelAvailabilityBlocks = async (
  modelId: string,
  fromDate?: string,
  toDate?: string
): Promise<AvailabilityBlock[]> => {
  if (!(await hasOptionalRelation('model_availability_blocks'))) return [];

  let query = supabase
    .from('model_availability_blocks')
    .select('*')
    .eq('model_id', modelId)
    .order('start_date', { ascending: true })
    .limit(120);

  if (fromDate) query = query.gte('end_date', fromDate);
  if (toDate) query = query.lte('start_date', toDate);

  const { data, error } = await query;
  if (error) {
    if (isMissingRelationError(error, 'model_availability_blocks')) return [];
    throw error;
  }

  return (data || []).map((block: any) => ({
    id: block.id,
    modelId: block.model_id,
    startDate: block.start_date,
    endDate: block.end_date,
    reason: block.reason || undefined,
    createdAt: block.created_at,
  }));
};

export const saveModelAvailabilityBlock = async (
  modelId: string,
  block: { startDate: string; endDate: string; reason?: string }
): Promise<void> => {
  if (!(await hasOptionalRelation('model_availability_blocks'))) return;

  const { error } = await supabase.from('model_availability_blocks').insert({
    model_id: modelId,
    start_date: block.startDate,
    end_date: block.endDate,
    reason: block.reason,
  });

  if (error) throw error;
};

export const deleteModelAvailabilityBlock = async (blockId: string): Promise<void> => {
  if (!(await hasOptionalRelation('model_availability_blocks'))) return;

  const { error } = await supabase.from('model_availability_blocks').delete().eq('id', blockId);
  if (error) throw error;
};

export const getContractTemplates = async (documentType?: string): Promise<ContractTemplate[]> => {
  if (!(await hasOptionalRelation('contract_templates'))) return [];

  let query = supabase
    .from('contract_templates')
    .select('*')
    .eq('is_active', true)
    .order('document_type', { ascending: true })
    .order('version', { ascending: false });

  if (documentType) query = query.eq('document_type', documentType);

  const { data, error } = await query;
  if (error) {
    if (isMissingRelationError(error, 'contract_templates')) return [];
    throw error;
  }

  return (data || []).map((template: any) => ({
    id: template.id,
    name: template.name,
    documentType: template.document_type,
    body: template.body,
    version: template.version,
    isActive: template.is_active,
    createdBy: template.created_by || undefined,
    createdAt: template.created_at,
    updatedAt: template.updated_at,
  }));
};

export const createBookingAgreement = async (agreement: {
  bookingId: string;
  templateId?: string;
  documentType: 'booking_agreement' | 'model_release';
  documentSnapshot: string;
}): Promise<string> => {
  if (!(await hasOptionalRelation('booking_agreements'))) return '';

  const { data, error } = await supabase
    .from('booking_agreements')
    .insert({
      booking_id: agreement.bookingId,
      template_id: agreement.templateId,
      document_type: agreement.documentType,
      document_snapshot: agreement.documentSnapshot,
      status: 'draft',
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
};

export const getBookingAgreements = async (bookingId: string): Promise<BookingAgreement[]> => {
  if (!(await hasOptionalRelation('booking_agreements'))) return [];

  const { data, error } = await supabase
    .from('booking_agreements')
    .select('*')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: false });

  if (error) {
    if (isMissingRelationError(error, 'booking_agreements')) return [];
    throw error;
  }

  return (data || []).map((agreement: any) => ({
    id: agreement.id,
    bookingId: agreement.booking_id,
    templateId: agreement.template_id || undefined,
    documentType: agreement.document_type,
    status: agreement.status,
    documentSnapshot: agreement.document_snapshot,
    clientAcceptedAt: agreement.client_accepted_at || undefined,
    modelAcceptedAt: agreement.model_accepted_at || undefined,
    createdAt: agreement.created_at,
    updatedAt: agreement.updated_at,
  }));
};

export const createDispute = async (dispute: {
  bookingId?: string;
  openedBy: string;
  againstUserId?: string;
  reason: string;
  details?: string;
}): Promise<string> => {
  if (!(await hasOptionalRelation('disputes'))) return '';

  await enforceRateLimit('dispute_create', dispute.openedBy, 5, 3600);

  const { data, error } = await supabase
    .from('disputes')
    .insert({
      booking_id: dispute.bookingId,
      opened_by: dispute.openedBy,
      against_user_id: dispute.againstUserId,
      reason: dispute.reason,
      details: dispute.details,
      status: 'open',
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
};

export const getDisputesForBooking = async (bookingId: string): Promise<Dispute[]> => {
  if (!(await hasOptionalRelation('disputes'))) return [];

  const { data, error } = await supabase
    .from('disputes')
    .select('*')
    .eq('booking_id', bookingId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    if (isMissingRelationError(error, 'disputes')) return [];
    throw error;
  }

  return (data || []).map((dispute: any) => ({
    id: dispute.id,
    bookingId: dispute.booking_id || undefined,
    openedBy: dispute.opened_by || undefined,
    againstUserId: dispute.against_user_id || undefined,
    status: dispute.status,
    reason: dispute.reason,
    details: dispute.details || undefined,
    adminDecision: dispute.admin_decision || undefined,
    resolvedBy: dispute.resolved_by || undefined,
    resolvedAt: dispute.resolved_at || undefined,
    deletedAt: dispute.deleted_at || undefined,
    createdAt: dispute.created_at,
    updatedAt: dispute.updated_at,
  }));
};

export const addDisputeEvidence = async (evidence: {
  disputeId: string;
  uploadedBy: string;
  cloudinaryUrl?: string;
  cloudinaryPublicId?: string;
  note?: string;
}): Promise<void> => {
  if (!(await hasOptionalRelation('dispute_evidence'))) return;

  const { error } = await supabase.from('dispute_evidence').insert({
    dispute_id: evidence.disputeId,
    uploaded_by: evidence.uploadedBy,
    cloudinary_url: evidence.cloudinaryUrl,
    cloudinary_public_id: evidence.cloudinaryPublicId,
    note: evidence.note,
  });

  if (error) throw error;
};

export const getDisputeEvidence = async (disputeId: string): Promise<DisputeEvidence[]> => {
  if (!(await hasOptionalRelation('dispute_evidence'))) return [];

  const { data, error } = await supabase
    .from('dispute_evidence')
    .select('*')
    .eq('dispute_id', disputeId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    if (isMissingRelationError(error, 'dispute_evidence')) return [];
    throw error;
  }

  return (data || []).map((item: any) => ({
    id: item.id,
    disputeId: item.dispute_id,
    uploadedBy: item.uploaded_by || undefined,
    cloudinaryUrl: item.cloudinary_url || undefined,
    cloudinaryPublicId: item.cloudinary_public_id || undefined,
    note: item.note || undefined,
    createdAt: item.created_at,
    deletedAt: item.deleted_at || undefined,
  }));
};

// ... (continuing with agency applications, notifications, and utility functions)// services/supabase.service.part3.ts

// =====================================================
// AGENCY APPLICATION MANAGEMENT
// =====================================================

export const applyToJoinAgency = async (
  modelOrApplication: string | Partial<AgencyApplication> & { modelPhoto?: string },
  modelName?: string,
  modelPhotoUrl?: string | undefined,
  agencyId?: string,
  note?: string
): Promise<void> => {
  const application =
    typeof modelOrApplication === 'string'
      ? {
          modelId: modelOrApplication,
          modelName: modelName || 'Applicant',
          modelPhotoUrl,
          agencyId: agencyId || '',
          note,
        }
      : {
          modelId: modelOrApplication.modelUid || modelOrApplication.modelId,
          modelName: modelOrApplication.modelName || 'Applicant',
          modelPhotoUrl: modelOrApplication.modelPhoto || modelOrApplication.modelPhotoUrl,
          agencyId: modelOrApplication.agencyId || '',
          note: modelOrApplication.note,
        };

  if (!application.modelId || !application.agencyId) {
    throw new Error('Missing agency application details');
  }

  const { error } = await supabase.from('agency_applications').insert({
    model_id: application.modelId,
    model_name: application.modelName,
    model_photo_url: application.modelPhotoUrl,
    agency_id: application.agencyId,
    note: application.note,
    status: 'pending',
  });

  if (error) throw error;

  // Get agency name for notification
  const { data: agency } = await supabase
    .from('users')
    .select('display_name')
    .eq('id', application.agencyId)
    .single();

  if (agency) {
    await createNotification({
      userId: application.agencyId,
      type: 'AGENCY_APPLICATION',
      title: 'New Application',
      message: `${application.modelName} wants to join your agency`,
      link: '/agency-dashboard?tab=applications',
    });
  }
};

export const respondToAgencyApplication = async (
  applicationId: string,
  statusOrAccept: 'accepted' | 'rejected' | boolean,
  _agencyId?: string,
  _modelId?: string,
  _agencyName?: string
): Promise<void> => {
  const status = statusOrAccept === true ? 'accepted' : statusOrAccept === false ? 'rejected' : statusOrAccept;

  // Get application details
  const { data: application, error: fetchError } = await supabase
    .from('agency_applications')
    .select('*')
    .eq('id', applicationId)
    .single();

  if (fetchError) throw fetchError;

  // Update application status
  await supabase
    .from('agency_applications')
    .update({
      status,
      responded_at: new Date().toISOString(),
    })
    .eq('id', applicationId);

  // If accepted, update model's agency
  if (status === 'accepted') {
    const { data: agency } = await supabase
      .from('users')
      .select('display_name')
      .eq('id', application.agency_id)
      .single();

    await supabase
      .from('models')
      .update({
        agency_id: application.agency_id,
        agency_name: agency?.display_name,
      })
      .eq('id', application.model_id);
  }

  // Notify model
  const notifType = status === 'accepted' ? 'AGENCY_ACCEPTED' : 'AGENCY_REJECTED';
  const message =
    status === 'accepted'
      ? 'Your agency application was accepted!'
      : 'Your agency application was declined.';

  await createNotification({
    userId: application.model_id,
    type: notifType,
    title: 'Agency Application Update',
    message,
    link: status === 'accepted' ? '/dashboard' : '/agencies',
  });
};

export const inviteModelToAgency = async (
  agencyId: string,
  agencyName: string,
  modelId: string
): Promise<void> => {
  await enforceRateLimit('agency_invitation', agencyId, 50, 3600);

  const { error } = await supabase.from('agency_invitations').insert({
    agency_id: agencyId,
    agency_name: agencyName,
    model_id: modelId,
    status: 'pending',
  });

  if (error) throw error;

  await createNotification({
    userId: modelId,
    type: 'AGENCY_INVITATION',
    title: 'Agency Invitation',
    message: `${agencyName} invited you to join their agency`,
    link: '/dashboard',
  });
};

export const respondToAgencyInvitation = async (
  invitationId: string,
  status: 'accepted' | 'rejected'
): Promise<void> => {
  // Get invitation details
  const { data: invitation, error: fetchError } = await supabase
    .from('agency_invitations')
    .select('*')
    .eq('id', invitationId)
    .single();

  if (fetchError) throw fetchError;

  // Update invitation status
  await supabase
    .from('agency_invitations')
    .update({
      status,
      responded_at: new Date().toISOString(),
    })
    .eq('id', invitationId);

  // If accepted, update model's agency
  if (status === 'accepted') {
    await supabase
      .from('models')
      .update({
        agency_id: invitation.agency_id,
        agency_name: invitation.agency_name,
      })
      .eq('id', invitation.model_id);
  }

  // Notify agency
  const { data: model } = await supabase
    .from('users')
    .select('display_name')
    .eq('id', invitation.model_id)
    .single();

  const message =
    status === 'accepted'
      ? `${model?.display_name} accepted your invitation!`
      : `${model?.display_name} declined your invitation.`;

  await createNotification({
    userId: invitation.agency_id,
    type: status === 'accepted' ? 'INVITATION_ACCEPTED' : 'INVITATION_DECLINED',
    title: 'Invitation Response',
    message,
    link: '/agency-dashboard?tab=models',
  });
};

export const subscribeToAgencyInvitations = (
  modelId: string,
  callback: (invitations: AgencyInvite[]) => void
): (() => void) => {
  let active = true;

  const fetchInvitations = async () => {
    const { data, error } = await supabase
      .from('agency_invitations')
      .select('*')
      .eq('model_id', modelId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching invitations:', error);
      if (active) callback([]);
      return;
    }

    if (active) {
      callback(data.map(transformAgencyInvite));
    }
  };

  fetchInvitations();

  const subscription = supabase
    .channel(`agency_invitations:${modelId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'agency_invitations',
        filter: `model_id=eq.${modelId}`,
      },
      () => {
        fetchInvitations();
      }
    )
    .subscribe();

  return () => {
    active = false;
    subscription.unsubscribe();
  };
};

// =====================================================
// LEAVE REQUEST MANAGEMENT
// =====================================================

export const submitLeaveRequest = async (
  requestOrModelId: string | Partial<LeaveRequest> & { modelUid?: string },
  modelName?: string,
  agencyId?: string,
  agencyName?: string,
  reason?: string
): Promise<void> => {
  const request =
    typeof requestOrModelId === 'string'
      ? {
          modelId: requestOrModelId,
          modelName: modelName || 'Model',
          agencyId: agencyId || '',
          agencyName: agencyName || 'Agency',
          reason: reason || '',
        }
      : {
          modelId: requestOrModelId.modelUid || requestOrModelId.modelId,
          modelName: requestOrModelId.modelName || 'Model',
          agencyId: requestOrModelId.agencyId || '',
          agencyName: requestOrModelId.agencyName || 'Agency',
          reason: requestOrModelId.reason || '',
        };

  if (!request.modelId || !request.agencyId || !request.reason) {
    throw new Error('Missing leave request details');
  }

  const { error } = await supabase.from('leave_requests').insert({
    model_id: request.modelId,
    model_name: request.modelName,
    agency_id: request.agencyId,
    agency_name: request.agencyName,
    reason: request.reason,
    status: 'pending',
  });

  if (error) throw error;

  // Notify admins
  const { data: admins } = await supabase
    .from('users')
    .select('id')
    .eq('role', 'admin');

  if (admins) {
    const notifications = admins.map((admin) => ({
      user_id: admin.id,
      type: 'LEAVE_REQUEST',
      title: 'New Leave Request',
      message: `${request.modelName} wants to leave ${request.agencyName}`,
      link: '/admin?tab=leave-requests',
    }));

    await supabase.from('notifications').insert(notifications);
  }
};

export const subscribeToLeaveRequests = (
  callback: (requests: LeaveRequest[]) => void
): (() => void) => {
  let active = true;

  const fetchRequests = async () => {
    const { data, error } = await supabase
      .from('leave_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching leave requests:', error);
      if (active) callback([]);
      return;
    }

    if (active) {
      callback(data.map(transformLeaveRequest));
    }
  };

  fetchRequests();

  const subscription = supabase
    .channel('leave_requests')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'leave_requests',
      },
      () => {
        fetchRequests();
      }
    )
    .subscribe();

  return () => {
    active = false;
    subscription.unsubscribe();
  };
};

export const processLeaveRequest = async (
  requestId: string,
  statusOrApproved: 'approved' | 'rejected' | boolean,
  _modelId?: string
): Promise<void> => {
  const status = statusOrApproved === true ? 'approved' : statusOrApproved === false ? 'rejected' : statusOrApproved;

  const { data: request, error: fetchError } = await supabase
    .from('leave_requests')
    .select('*')
    .eq('id', requestId)
    .single();

  if (fetchError) throw fetchError;

  // Update request status
  await supabase
    .from('leave_requests')
    .update({
      status,
      processed_at: new Date().toISOString(),
    })
    .eq('id', requestId);

  // If approved, remove model from agency
  if (status === 'approved') {
    await removeModelFromAgency(request.model_id);
  }

  // Notify model
  const message =
    status === 'approved'
      ? `Your leave request from ${request.agency_name} was approved.`
      : `Your leave request from ${request.agency_name} was rejected.`;

  await createNotification({
    userId: request.model_id,
    type: status === 'approved' ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED',
    title: 'Leave Request Update',
    message,
    link: '/dashboard',
  });
};

// =====================================================
// NOTIFICATION MANAGEMENT
// =====================================================

export const createNotification = async (notification: {
  userId: string;
  type: NotificationType | string;
  title: string;
  message: string;
  link?: string;
  dedupeKey?: string;
}): Promise<void> => {
  const preferences = await getNotificationPreferences(notification.userId).catch(() => null);
  if (preferences && !preferences.inAppEnabled) return;

  const dedupeKey = notification.dedupeKey || stableCacheKey('notification', {
    userId: notification.userId,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    link: notification.link || '',
  });

  const { error } = await supabase.from('notifications').insert({
    user_id: notification.userId,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    link: notification.link,
    read: false,
    dedupe_key: dedupeKey,
  });

  if (error) {
    if (error.code === '23505') return;
    console.error('Error creating notification:', error);
    return;
  }

  await publishAblyEvent(`user:${notification.userId}:notifications`, 'notification.created', {
    title: notification.title,
    message: notification.message,
    link: notification.link,
    type: notification.type,
  });
};

export const subscribeToNotifications = (
  userId: string,
  callback: (notifications: Notification[]) => void
): (() => void) => {
  let active = true;

  const fetchNotifications = async () => {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching notifications:', error);
      if (active) callback([]);
      return;
    }

    if (active) {
      callback(data.map(transformNotification));
    }
  };

  fetchNotifications();

  const subscription = supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      () => {
        fetchNotifications();
      }
    )
    .subscribe();

  return () => {
    active = false;
    subscription.unsubscribe();
  };
};

export const markNotificationRead = async (notificationId: string): Promise<void> => {
  await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId);
};

export const markAllNotificationsRead = async (userId: string): Promise<void> => {
  await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false);
};

export const deleteNotification = async (notificationId: string): Promise<void> => {
  await supabase.from('notifications').delete().eq('id', notificationId);
};

// =====================================================
// UTILITY & TRANSFORMATION FUNCTIONS
// =====================================================

/**
 * Transform database snake_case to frontend camelCase
 */
async function attachUserExtras(data: any): Promise<any> {
  if (!data?.id) return data;

  const [{ data: gallery }, { data: customLinks }] = await Promise.all([
    supabase
      .from('gallery_images')
      .select('cloudinary_url, display_order')
      .eq('user_id', data.id)
      .order('display_order', { ascending: true }),
    supabase
      .from('custom_links')
      .select('platform, url, display_order')
      .eq('user_id', data.id)
      .order('display_order', { ascending: true }),
  ]);

  return {
    ...data,
    _gallery: (gallery || []).map((img: any) => img.cloudinary_url),
    _custom_links: customLinks || [],
  };
}

function transformUserData(data: any): UserData {
  return {
    uid: data.id,
    email: data.email,
    role: data.role,
    displayName: data.display_name,
    displayNameChangedAt: data.display_name_changed_at,
    photoUrl: data.photo_url,
    bio: data.bio,
    verified: data.verified,
    isActive: data.is_active,
    contact: {
      publicEmail: data.public_email,
      whatsapp: data.whatsapp,
      instagram: data.instagram,
      facebook: data.facebook,
    },
    website: data.website,
    averageRating: data.average_rating,
    reviewsCount: data.reviews_count,
    totalProjects: data.total_projects || 0,
    completedProjects: data.completed_projects || 0,
    totalHired: data.total_hired || 0,
    warningCount: data.warning_count,
    deletionCount: data.deletion_count,
    gallery: data._gallery || [],
    customLinks: (data._custom_links || []).map((link: any) => ({
      platform: link.platform,
      url: link.url,
    })),
    createdAt: data.created_at,
  };
}

function transformModelData(data: any): ModelProfile {
  const user = data.users;
  const categories = data.model_categories?.map((c: any) => c.category) || [];
  const pricing = data.model_pricing?.reduce((acc: any, p: any) => {
    acc[p.category] = p.price;
    return acc;
  }, {}) || {};
  const images = data.model_images
    ?.sort((a: any, b: any) => a.display_order - b.display_order)
    .map((img: any) => img.cloudinary_url) || [];
  const profileImage = data.profile_image_url || images[0] || '';

  return {
    uid: data.id,
    displayName: user?.display_name || data.display_name || 'Talent',
    displayNameChangedAt: user?.display_name_changed_at,
    email: user?.email || data.email || '',
    bio: user?.bio || data.bio,
    photoUrl: profileImage,
    age: data.age || undefined,
    height: data.height || 0,
    gender: data.gender || 'Other',
    skinTone: data.skin_tone || 'Medium',
    location: data.district || 'Other',
    district: data.district,
    city: data.city,
    agencyId: data.agency_id,
    agencyName: data.agency_name,
    categories,
    pricing,
    availability: data.availability,
    profileCompleteness: data.profile_completeness || 0,
    publicEmail: user?.public_email,
    whatsapp: user?.whatsapp,
    instagram: user?.instagram,
    facebook: user?.facebook,
    website: user?.website,
    videoReelUrl: data.video_reel_url,
    verified: user?.verified,
    averageRating: user?.average_rating || 0,
    reviewsCount: user?.reviews_count || 0,
    totalProjects: user?.total_projects || 0,
    completedProjects: user?.completed_projects || 0,
    views: data.views || 0,
    rankingScore: data.ranking_score || 0,
    createdAt: data.created_at,
    media: {
      images: images.length > 0 ? images : (profileImage ? [profileImage] : []),
      videos: data.video_reel_url ? [data.video_reel_url] : [],
    },
    stats: {
      views: data.views || 0,
      searches: 0,
      saves: 0,
    },
  };
}

function transformProject(data: any): Project {
  const applications = data._applications || [];
  const invitations = data._invitations || [];
  const pendingApplications = applications.filter((app: any) => app.status === 'pending');
  const approvedApplications = applications.filter((app: any) => app.status === 'approved');
  const activeInvitations = invitations.filter((invite: any) => invite.status !== 'declined');

  return {
    id: data.id,
    ownerId: data.owner_id,
    ownerName: data.owner_name,
    ownerPhotoUrl: data.owner_photo_url,
    ownerVerified: data.owner_verified,
    title: data.title,
    description: data.description,
    category: data.category,
    location: data.location,
    dates: data.dates,
    eventDate: data.event_date,
    status: data.status,
    visibility: data.visibility,
    createdAt: data.created_at,
    taggedModels: activeInvitations.map((invite: any) => invite.model_id),
    applicantModels: pendingApplications.map((app: any) => app.model_id),
    approvedModels: approvedApplications.map((app: any) => app.model_id),
    approvals: approvedApplications.map((app: any) => ({
      modelId: app.model_id,
      acceptedAt: app.applied_at || data.updated_at || data.created_at,
    })),
  };
}

function transformBooking(data: any): Booking {
  const history = (data.booking_negotiations || [])
    .slice()
    .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map((offer: any) => ({
      role: offer.role,
      amount: offer.amount || 0,
      note: offer.note || undefined,
      timestamp: offer.created_at,
    }));

  if (history.length === 0) {
    history.push({
      role: data.current_offer_by || 'client',
      amount: data.current_offer_amount || 0,
      timestamp: data.current_offer_at || data.created_at,
    });
  }

  return {
    id: data.id,
    projectId: data.project_id,
    projectTitle: data.project_title,
    eventDate: data.event_date || undefined,
    modelId: data.model_id,
    modelName: data.model_name,
    clientId: data.client_id,
    clientName: data.client_name,
    category: data.category,
    status: data.status,
    currentOffer: data.current_offer_amount || 0,
    history,
    paymentProofUrl: data.payment_proof_url,
    cancellationReason: data.cancellation_reason,
    cancelledBy: data.cancelled_by,
    reportReason: data.report_reason,
    reportDetails: data.report_details,
    reportedBy: data.reported_by,
    modelReviewId: data.model_review_id,
    clientReviewId: data.client_review_id,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    hiddenBy: data.hidden_by || [],
  };
}

function transformReport(data: any): Report {
  return {
    id: data.id,
    reporterId: data.reporter_id,
    reporterRole: data.reporter_role,
    reportedUserId: data.reported_user_id,
    reportedUserRole: data.reported_user_role,
    projectId: data.project_id,
    bookingId: data.booking_id,
    reason: data.reason,
    details: data.details,
    status: data.status as ReportStatus,
    adminNotes: data.admin_notes,
    createdAt: data.created_at,
    resolvedAt: data.resolved_at,
  };
}

function transformNotification(data: any): Notification {
  return {
    id: data.id,
    userId: data.user_id,
    type: data.type,
    title: data.title,
    message: data.message,
    link: data.link,
    read: data.read,
    dedupeKey: data.dedupe_key || undefined,
    deliveredVia: data.delivered_via || undefined,
    createdAt: data.created_at,
    timestamp: data.created_at,
  };
}

function transformAccountAppeal(data: any): AccountAppeal {
  return {
    id: data.id,
    deletionRecordId: data.deletion_record_id || undefined,
    contactEmail: data.contact_email,
    message: data.message,
    status: data.status,
    warningMessage: data.warning_message || undefined,
    adminNotes: data.admin_notes || undefined,
    reviewedBy: data.reviewed_by || undefined,
    reviewedAt: data.reviewed_at || undefined,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

function transformAgencyRequest(data: any): AgencyRequest {
  const photos = data.agency_request_photos
    ?.sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0))
    .map((photo: any) => photo.cloudinary_url) || [];

  return {
    id: data.id,
    uid: data.applicant_id,
    applicantId: data.applicant_id,
    applicantName: data.applicant_name,
    agencyName: data.agency_name,
    logoUrl: data.logo_url || '',
    bio: data.bio,
    whatsapp: data.whatsapp || '',
    socialLink: data.website || data.instagram || '',
    location: data.location,
    instagram: data.instagram,
    facebook: data.facebook,
    website: data.website,
    memberCount: {
      male: data.member_count_male || 0,
      female: data.member_count_female || 0,
    },
    socialLinks: {
      instagram: data.instagram,
      facebook: data.facebook,
      tiktok: data.tiktok,
    },
    modelPhotos: photos,
    status: data.status,
    createdAt: data.created_at,
    processedAt: data.processed_at,
  };
}

function transformAgencyInvite(data: any): AgencyInvite {
  return {
    id: data.id,
    agencyId: data.agency_id,
    agencyName: data.agency_name,
    modelUid: data.model_id,
    modelId: data.model_id,
    status: data.status,
    createdAt: data.created_at,
    respondedAt: data.responded_at,
  };
}

function transformLeaveRequest(data: any): LeaveRequest {
  return {
    id: data.id,
    modelUid: data.model_id,
    modelId: data.model_id,
    modelName: data.model_name,
    agencyId: data.agency_id,
    agencyName: data.agency_name,
    reason: data.reason,
    status: data.status,
    createdAt: data.created_at,
    processedAt: data.processed_at,
  };
}

/**
 * Transform frontend camelCase to database snake_case
 */
function transformToDb(data: any): any {
  const result: any = {};

  Object.keys(data).forEach((key) => {
    const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    result[snakeKey] = data[key];
  });

  return result;
}

// =====================================================
// ADDITIONAL HELPER FUNCTIONS
// =====================================================

export const getClientPublicStats = async (clientId: string) => {
  const { data: user } = await supabase
    .from('users')
    .select('total_projects, completed_projects, total_hired, average_rating, reviews_count')
    .eq('id', clientId)
    .single();

  const [{ count: totalProjects }, { count: completedProjects }, { count: totalHired }] = await Promise.all([
    supabase
      .from('projects')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', clientId),
    supabase
      .from('projects')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', clientId)
      .eq('status', 'COMPLETED'),
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .in('status', ['scheduled', 'completed']),
  ]);

  return {
    totalProjects: totalProjects ?? user?.total_projects ?? 0,
    completedProjects: completedProjects ?? user?.completed_projects ?? 0,
    totalHired: totalHired ?? user?.total_hired ?? 0,
    averageRating: user?.average_rating || 0,
    reviewsCount: user?.reviews_count || 0,
  };
};

export const getModelRankingSignals = async (limit = 10): Promise<ModelRankingSignal[]> => {
  const { data: models, error } = await supabase
    .from('models')
    .select('id, ranking_score, profile_completeness')
    .order('ranking_score', { ascending: false })
    .limit(limit);

  if (error) throw error;
  const modelIds = (models || []).map((model: any) => model.id).filter(Boolean);
  if (modelIds.length === 0) return [];

  const modelsWithUsers = await attachUsersToModels(models || []);

  const [{ data: bookings }, { data: applications }] = await Promise.all([
    supabase
      .from('bookings')
      .select('model_id, status')
      .in('model_id', modelIds)
      .in('status', ['completed', 'cancelled', 'reported']),
    supabase
      .from('project_applications')
      .select('model_id, status')
      .in('model_id', modelIds),
  ]);

  const bookingStats = new Map<string, { completed: number; cancelled: number }>();
  (bookings || []).forEach((booking: any) => {
    const stats = bookingStats.get(booking.model_id) || { completed: 0, cancelled: 0 };
    if (booking.status === 'completed') stats.completed += 1;
    if (['cancelled', 'reported'].includes(booking.status)) stats.cancelled += 1;
    bookingStats.set(booking.model_id, stats);
  });

  const applicationStats = new Map<string, { total: number; approved: number }>();
  (applications || []).forEach((application: any) => {
    const stats = applicationStats.get(application.model_id) || { total: 0, approved: 0 };
    stats.total += 1;
    if (application.status === 'approved') stats.approved += 1;
    applicationStats.set(application.model_id, stats);
  });

  return modelsWithUsers.map((model: any) => {
    const user = Array.isArray(model.users) ? model.users[0] : model.users;
    const bookingsForModel = bookingStats.get(model.id) || { completed: 0, cancelled: 0 };
    const applicationsForModel = applicationStats.get(model.id) || { total: 0, approved: 0 };
    const responseRate = applicationsForModel.total > 0
      ? Math.round((applicationsForModel.approved / applicationsForModel.total) * 100)
      : 0;

    return {
      modelId: model.id,
      displayName: user?.display_name || 'Talent',
      rankingScore: Number(model.ranking_score || 0),
      averageRating: Number(user?.average_rating || 0),
      reviewsCount: Number(user?.reviews_count || 0),
      completedJobs: bookingsForModel.completed,
      cancelledJobs: bookingsForModel.cancelled,
      responseRate,
      profileCompleteness: Number(model.profile_completeness || 0),
    };
  });
};

export const subscribeToAgencyOutgoingInvites = (
  agencyId: string,
  callback: (invites: AgencyInvite[]) => void
): (() => void) => {
  let active = true;

  const fetchInvites = async () => {
    const { data, error } = await supabase
      .from('agency_invitations')
      .select('*')
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching outgoing invites:', error);
      if (active) callback([]);
      return;
    }

    if (active) {
      callback(data.map(transformAgencyInvite));
    }
  };

  fetchInvites();

  const subscription = supabase
    .channel(`agency_invitations_out:${agencyId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'agency_invitations',
        filter: `agency_id=eq.${agencyId}`,
      },
      () => {
        fetchInvites();
      }
    )
    .subscribe();

  return () => {
    active = false;
    subscription.unsubscribe();
  };
};

export const subscribeToAgencyIncomingApplications = (
  agencyId: string,
  callback: (apps: AgencyApplication[]) => void
): (() => void) => {
  let active = true;

  const fetchApplications = async () => {
    const { data, error } = await supabase
      .from('agency_applications')
      .select('*')
      .eq('agency_id', agencyId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching applications:', error);
      if (active) callback([]);
      return;
    }

    if (active) {
      callback(data.map((app: any) => ({
        id: app.id,
        modelUid: app.model_id,
        modelId: app.model_id,
        modelName: app.model_name,
        modelPhoto: app.model_photo_url,
        modelPhotoUrl: app.model_photo_url,
        agencyId: app.agency_id,
        note: app.note,
        status: app.status,
        createdAt: app.created_at,
        respondedAt: app.responded_at,
      })));
    }
  };

  fetchApplications();

  const subscription = supabase
    .channel(`agency_applications:${agencyId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'agency_applications',
        filter: `agency_id=eq.${agencyId}`,
      },
      () => {
        fetchApplications();
      }
    )
    .subscribe();

  return () => {
    active = false;
    subscription.unsubscribe();
  };
};

export const subscribeToAdminLeaveRequests = (
  callback: (requests: LeaveRequest[]) => void
): (() => void) => {
  // This is the same as subscribeToLeaveRequests but keeping the name for compatibility
  return subscribeToLeaveRequests(callback);
};

export const subscribeToAgencyLeaveRequests = (
  agencyId: string,
  callback: (requests: LeaveRequest[]) => void
): (() => void) => {
  let active = true;

  const fetchRequests = async () => {
    const { data, error } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching leave requests:', error);
      if (active) callback([]);
      return;
    }

    if (active) {
      callback(data.map(transformLeaveRequest));
    }
  };

  fetchRequests();

  const subscription = supabase
    .channel(`leave_requests:${agencyId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'leave_requests',
        filter: `agency_id=eq.${agencyId}`,
      },
      () => {
        fetchRequests();
      }
    )
    .subscribe();

  return () => {
    active = false;
    subscription.unsubscribe();
  };
};

export const updateProjectStatus = async (
  id: string,
  data: { status: ProjectStatus }
): Promise<void> => {
  const { error } = await supabase
    .from('projects')
    .update({ status: data.status })
    .eq('id', id);

  if (error) throw error;
};

export const deleteBooking = async (bookingId: string): Promise<void> => {
  // Delete booking and all related data (negotiations, hidden_by entries)
  const { error } = await supabase.from('bookings').delete().eq('id', bookingId);
  if (error) throw error;
};

export const acceptPreviousOffer = async (
  bookingId: string,
  _acceptedByRole: UserRole
): Promise<void> => {
  // Get current booking to find the latest offer
  const { data: booking } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .single();

  if (!booking) throw new Error('Booking not found');

  // Update booking status to accepted
  await supabase
    .from('bookings')
    .update({
      status: 'scheduled',
    })
    .eq('id', bookingId);
};

export const blockBookingUser = async (
  bookingId: string,
  blockerId: string,
  reason: string
): Promise<void> => {
  // Get booking details
  const { data: booking } = await supabase
    .from('bookings')
    .select('model_id, client_id')
    .eq('id', bookingId)
    .single();

  if (!booking) throw new Error('Booking not found');

  // Determine who is being blocked
  const blockedId = booking.model_id === blockerId ? booking.client_id : booking.model_id;

  // Create a report
  const { data: blocker } = await supabase
    .from('users')
    .select('role')
    .eq('id', blockerId)
    .single();

  await submitReport({
    reporterId: blockerId,
    reporterRole: blocker?.role || UserRole.MODEL,
    reportedUserId: blockedId,
    reportedUserRole: UserRole.MODEL,
    reason: ReportReason.OTHER,
    details: `Blocked from booking: ${reason}`,
  });

  // Cancel the booking
  const { error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', bookingId);

  if (error) throw error;
};

// =====================================================
// DASHBOARD HELPER FUNCTIONS
// =====================================================

export const getUserAgencyRequest = async (uid: string): Promise<AgencyRequest | null> => {
  const { data, error } = await supabase
    .from('agency_requests')
    .select('*, agency_request_photos (cloudinary_url, display_order)')
    .eq('applicant_id', uid)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching agency request:', error);
    return null;
  }

  return data ? transformAgencyRequest(data) : null;
};

export const withdrawAgencyRequest = async (id: string): Promise<void> => {
  await supabase.from('agency_requests').delete().eq('id', id);
};

export const subscribeToPendingInvites = (
  modelUid: string,
  callback: (invites: AgencyInvite[]) => void
): (() => void) => {
  // This is the same as subscribeToAgencyInvitations
  return subscribeToAgencyInvitations(modelUid, callback);
};

export const respondToAgencyInvite = async (
  inviteId: string,
  accept: boolean
): Promise<void> => {
  // Wrapper for respondToAgencyInvitation to match old API
  await respondToAgencyInvitation(inviteId, accept ? 'accepted' : 'rejected');
};

export const subscribeToProjectInvites = (
  modelUid: string,
  callback: (projects: Project[]) => void
): (() => void) => {
  let active = true;
  let debounceTimer: DebounceTimer = null;

  const fetchProjects = async () => {
    // Clear any pending debounced fetch
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }

    const { data, error } = await supabase
      .from('project_invitations')
      .select(`
        project_id,
        projects (
          *
        )
      `)
      .eq('model_id', modelUid)
      .eq('status', 'pending');

    if (error) {
      console.error('Error fetching project invites:', error);
      if (active) callback([]);
      return;
    }

    if (active) {
      const projects = data
        .filter((inv: any) => inv.projects)
        .map((inv: any) => inv.projects);
      callback((await attachProjectRelations(projects)).map(transformProject));
    }
  };

  // Debounced fetch to avoid excessive bandwidth usage
  const debouncedFetch = () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      fetchProjects();
    }, 500);
  };

  fetchProjects();

  const subscription = supabase
    .channel(`project_invites_realtime:${modelUid}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'project_invitations',
        filter: `model_id=eq.${modelUid}`,
      },
      () => {
        debouncedFetch();
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'projects',
      },
      () => {
        // When project details change, update invites
        debouncedFetch();
      }
    )
    .subscribe();

  return () => {
    active = false;
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    subscription.unsubscribe();
  };
};

export const declineProjectInvite = async (
  projectId: string,
  modelUid: string
): Promise<void> => {
  // Update invitation status to declined
  await supabase
    .from('project_invitations')
    .update({ status: 'declined' })
    .eq('project_id', projectId)
    .eq('model_id', modelUid);
};

export const subscribeToAcceptedProjects = (
  modelUid: string,
  callback: (projects: Project[]) => void
): (() => void) => {
  let active = true;

  const fetchProjects = async () => {
    // Get approved applications
    const { data, error } = await supabase
      .from('project_applications')
      .select(`
        project_id,
        projects (
          *
        )
      `)
      .eq('model_id', modelUid)
      .eq('status', 'approved');

    if (error) {
      console.error('Error fetching accepted projects:', error);
      if (active) callback([]);
      return;
    }

    if (active) {
      const projects = data
        .filter((app: any) => app.projects)
        .map((app: any) => app.projects);
      callback((await attachProjectRelations(projects)).map(transformProject));
    }
  };

  fetchProjects();

  const subscription = supabase
    .channel(`accepted_projects:${modelUid}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'project_applications',
        filter: `model_id=eq.${modelUid}`,
      },
      () => {
        fetchProjects();
      }
    )
    .subscribe();

  return () => {
    active = false;
    subscription.unsubscribe();
  };
};

// =====================================================
// BATCH OPERATIONS
// =====================================================

export const batchUpdateModelRankings = async (): Promise<void> => {
  // This could be a cron job that recalculates ranking scores
  // For now, it's a placeholder
  console.log('Batch ranking update not yet implemented');
};

export const cleanupOldNotifications = async (): Promise<void> => {
  // Delete read notifications older than 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  await supabase
    .from('notifications')
    .delete()
    .eq('read', true)
    .lt('created_at', thirtyDaysAgo.toISOString());
};
