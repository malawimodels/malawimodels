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
  AgencyApplication, LeaveRequest
} from '../types';
import { getPublicIdFromUrl } from './cloudinary';

const isMissingColumnError = (error: any, columnName: string): boolean => {
  const message = `${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  return message.includes(columnName.toLowerCase()) && message.includes('column');
};

const getCloudinaryPublicId = (url: string, fallback: string): string => {
  return getPublicIdFromUrl(url) || fallback;
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
    const { error: modelError } = await supabase.from('models').upsert(
      {
        id: uid,
        district: 'Not Specified',
        views: 0,
        ranking_score: 0,
        availability: true,
      },
      { onConflict: 'id' }
    );

    if (modelError) {
      console.error('Error creating model profile:', modelError);
      // Don't throw - allow user creation to succeed even if model profile fails
    }
  }
};

export const getUserRole = async (uid: string): Promise<UserRole | null> => {
  const { data, error } = await supabase
    .from('users')
    .select('role')
    .eq('id', uid)
    .single();

  if (error) {
    console.error('Error fetching role:', error);
    return null;
  }

  return data?.role as UserRole;
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
  if (updates.role !== undefined) dbUpdates.role = updates.role;
  if (updates.displayName !== undefined) {
    dbUpdates.display_name = updates.displayName.trim();
    if (displayNameChangedAt) dbUpdates.display_name_changed_at = displayNameChangedAt;
  }
  if (updates.photoUrl !== undefined) dbUpdates.photo_url = updates.photoUrl;
  if (updates.bio !== undefined) dbUpdates.bio = updates.bio;
  if (updates.verified !== undefined) dbUpdates.verified = updates.verified;
  if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;
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
};

export const deleteUserPermanently = async (uid: string, _role?: UserRole): Promise<void> => {
  // Supabase will handle cascading deletes via foreign keys
  const { error } = await supabase.from('users').delete().eq('id', uid);

  if (error) throw error;
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
    return models;
  }

  const usersById = new Map((users || []).map((u: any) => [u.id, u]));
  return models.map((m) => ({ ...m, users: usersById.get(m.id) || null }));
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

  if (!data) return null;

  const [withUser] = await attachUsersToModels([data]);
  return transformModelData(withUser);
};

export const subscribeToSearchModels = (
  filters: SearchFilters,
  callback: (models: ModelProfile[]) => void
): (() => void) => {
  let active = true;

  const fetchModels = async () => {
    try {
      let query = supabase
        .from('models')
        .select(`
          *,
          model_categories (category),
          model_images (cloudinary_url, display_order)
        `);

      // Apply filters
      if (filters.categories && filters.categories.length > 0) {
        // Note: This requires model_categories to have at least one matching category
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

      if (filters.minHeight) {
        query = query.gte('height', filters.minHeight);
      }

      if (filters.maxHeight) {
        query = query.lte('height', filters.maxHeight);
      }

      if (filters.onlyAvailable) {
        query = query.eq('availability', true);
      }

      // Order by ranking score
      query = query.order('ranking_score', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;

      const withUsers = await attachUsersToModels(data || []);
      // Only show models whose user account is active
      const activeModels = withUsers.filter(
        (m) => m.users && m.users.is_active !== false
      );

      if (active) {
        callback(activeModels.map(transformModelData));
      }
    } catch (error) {
      console.error('Error searching models:', error);
      if (active) callback([]);
    }
  };

  // Initial fetch
  fetchModels();

  // Subscribe to changes
  const subscription = supabase
    .channel('models_search')
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
    .subscribe();

  return () => {
    active = false;
    subscription.unsubscribe();
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
};

export const incrementModelViews = async (uid: string): Promise<void> => {
  const { error } = await supabase.rpc('increment', {
    table_name: 'models',
    row_id: uid,
    column_name: 'views',
  });

  if (error) {
    // Fallback: manual increment
    const { data } = await supabase
      .from('models')
      .select('views')
      .eq('id', uid)
      .single();

    if (data) {
      await supabase
        .from('models')
        .update({ views: data.views + 1 })
        .eq('id', uid);
    }
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
  let debounceTimer: NodeJS.Timeout | null = null;

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
      callback((await attachProjectRelations(data || [])).map(transformProject));
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
      () => {
        // When someone applies, update client's projects in real-time
        debouncedFetch();
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'project_invitations',
      },
      () => {
        // When invitations change, update client's projects
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

export const subscribeToOpenProjectsByCategories = (
  categories: Category[],
  callback: (projects: Project[]) => void
): (() => void) => {
  let active = true;
  let debounceTimer: NodeJS.Timeout | null = null;

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
      callback((await attachProjectRelations(data || [])).map(transformProject));
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
      () => {
        // When someone applies/cancels, update the UI in real-time
        debouncedFetch();
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'project_invitations',
      },
      () => {
        // When invitations change, update the UI
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
  const { error } = await supabase.from('projects').delete().eq('id', projectId);

  if (error) throw error;
};

export const applyToProject = async (
  projectId: string,
  modelId: string
): Promise<void> => {
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
  await supabase
    .from('project_applications')
    .update({ status: 'approved' })
    .eq('project_id', projectId)
    .eq('model_id', modelId);

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
    const { data: booking, error: bookingError } = await supabase.from('bookings').upsert({
      project_id: projectId,
      project_title: project.title,
      model_id: modelId,
      model_name: model.display_name,
      client_id: project.owner_id,
      client_name: client?.display_name || project.owner_name,
      status: 'negotiating',
      current_offer_amount: offerPrice || 0,
      current_offer_by: 'client',
      current_offer_at: new Date().toISOString(),
    }, { onConflict: 'project_id,model_id' }).select('id').single();

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
  let debounceTimer: NodeJS.Timeout | null = null;

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
    const visibleBookings = data.filter((b) => !hiddenIds.includes(b.id));

    if (active) {
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

  const subscription = supabase
    .channel(`bookings_realtime:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'bookings',
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
        table: 'booking_negotiations',
      },
      () => {
        // When negotiations change, update bookings in real-time
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
  await supabase
    .from('bookings')
    .update({
      payment_proof_url: proofUrl,
      status: 'scheduled',
    })
    .eq('id', bookingId);

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
  await supabase
    .from('bookings')
    .update({ status: 'completed' })
    .eq('id', bookingId);
};

export const cancelBookingWithReason = async (
  bookingId: string,
  reason: string,
  _cancelledBy?: string
): Promise<void> => {
  await supabase
    .from('bookings')
    .update({
      status: 'cancelled',
    })
    .eq('id', bookingId);

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

  const { data, error } = await supabase
    .from('reviews')
    .upsert({
      booking_id: review.bookingId,
      author_id: review.authorId,
      target_id: review.targetId,
      target_role: review.targetRole,
      rating: review.rating,
      comment: review.comment,
    }, { onConflict: 'booking_id,author_id' })
    .select('id')
    .single();

  if (error) throw error;

  // Update booking with review reference
  if (review.targetRole === UserRole.MODEL) {
    await supabase
      .from('bookings')
      .update({ client_review_id: data.id })
      .eq('id', review.bookingId);
  } else {
    await supabase
      .from('bookings')
      .update({ model_review_id: data.id })
      .eq('id', review.bookingId);
  }

  // The trigger will automatically update user statistics
};

export const submitReport = async (reportOrReporterId: {
  reporterId: string;
  reporterRole: UserRole;
  reportedUserId: string;
  reportedUserRole: UserRole;
  reason: ReportReason;
  details?: string;
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

  const { error } = await supabase.from('reports').insert({
    reporter_id: report.reporterId,
    reporter_role: report.reporterRole,
    reported_user_id: report.reportedUserId,
    reported_user_role: report.reportedUserRole,
    reason: report.reason,
    details: report.details,
    status: 'PENDING',
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
}): Promise<void> => {
  const { error } = await supabase.from('notifications').insert({
    user_id: notification.userId,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    link: notification.link,
    read: false,
  });

  if (error) {
    console.error('Error creating notification:', error);
  }
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
    displayName: user?.display_name || '',
    displayNameChangedAt: user?.display_name_changed_at,
    email: user?.email || '',
    bio: user?.bio,
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
    modelId: data.model_id,
    modelName: data.model_name,
    clientId: data.client_id,
    clientName: data.client_name,
    category: data.category,
    status: data.status,
    currentOffer: data.current_offer_amount || 0,
    history,
    paymentProofUrl: data.payment_proof_url,
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
    reason: data.reason,
    details: data.details,
    status: data.status as ReportStatus,
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
    createdAt: data.created_at,
    timestamp: data.created_at,
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
  let debounceTimer: NodeJS.Timeout | null = null;

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
    // Get accepted applications
    const { data, error } = await supabase
      .from('project_applications')
      .select(`
        project_id,
        projects (
          *
        )
      `)
      .eq('model_id', modelUid)
      .eq('status', 'accepted');

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
