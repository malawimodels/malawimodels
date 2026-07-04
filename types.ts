
export enum UserRole {
  GUEST = 'guest',
  MODEL = 'model',
  AGENCY = 'agency',
  CLIENT = 'client',
  ADMIN = 'admin'
}

export type AdminPermissionRole = 'owner' | 'admin' | 'moderator' | 'support' | 'finance';

export interface AdminPermission {
  id: string;
  userId: string;
  role: AdminPermissionRole;
  permissions: Record<string, boolean>;
  isActive: boolean;
  grantedBy?: string;
  grantedAt: string;
  revokedAt?: string;
}

export interface AdminAuditLog {
  id: string;
  actionType: string;
  adminUserId?: string;
  targetUserId?: string;
  targetTable?: string;
  targetId?: string;
  details: Record<string, any>;
  createdAt: string;
}

export enum District {
  LILONGWE = 'Lilongwe',
  BLANTYRE = 'Blantyre',
  ZOMBA = 'Zomba',
  MZUZU = 'Mzuzu',
  MANGOCHI = 'Mangochi',
  SALIMA = 'Salima',
  OTHER = 'Other'
}

export enum Gender {
  FEMALE = 'Female',
  MALE = 'Male',
  NON_BINARY = 'Other'
}

export enum Category {
  MUSIC_VIDEO = 'Music Video',
  BRAND_PROMO = 'Brand Promotion',
  FASHION = 'Fashion',
  ACTING = 'Acting',
  COMMERCIAL = 'Commercial',
  RUNWAY = 'Runway',
  DANCE = 'Dance'
}

export enum SkinTone {
  FAIR = 'Fair',
  MEDIUM = 'Medium',
  OLIVE = 'Olive',
  BROWN = 'Brown',
  DARK_BROWN = 'Dark Brown',
  DEEP = 'Deep Ebony'
}

export enum ProjectVisibility {
  PUBLIC = 'PUBLIC',
  PRIVATE = 'PRIVATE'
}

export enum ProjectStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export enum AgencyRequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected'
}

export interface ContactDetails {
  whatsapp?: string;
  instagram?: string;
  facebook?: string;
  publicEmail?: string;
  snapchat?: string;
}

export type ModelPricing = {
  [key in Category]?: number;
};

export interface SocialLink {
  platform: string;
  url: string;
}

export interface UserData {
  uid: string;
  role: UserRole;
  email: string;
  createdAt: string;
  isActive: boolean;
  verified?: boolean;
  displayName?: string;
  displayNameChangedAt?: string;
  photoUrl?: string;
  contact?: ContactDetails;
  blockedUsers?: string[];
  deletionCount?: number; // Reputation signal
  warningCount?: number; // Admin warnings
  averageRating?: number; // Persistent Rating
  reviewsCount?: number; // Count of reviews
  totalProjects?: number;
  completedProjects?: number;
  totalHired?: number;
  // Agency Extensions
  bio?: string;
  gallery?: string[];
  website?: string;
  customLinks?: SocialLink[]; // Dynamic social links
}

export interface SavedModel {
  id: string;
  userId: string;
  modelId: string;
  note?: string;
  createdAt: string;
}

export interface NotificationPreferences {
  userId: string;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  projectUpdates: boolean;
  bookingUpdates: boolean;
  agencyUpdates: boolean;
  marketingEmails: boolean;
  updatedAt: string;
}

export interface AvailabilityBlock {
  id: string;
  modelId: string;
  startDate: string;
  endDate: string;
  reason?: string;
  createdAt: string;
}

export interface ModelProfile {
  uid: string;
  displayName: string;
  displayNameChangedAt?: string;
  email?: string;
  photoUrl?: string;
  age?: number;
  height: number;
  skinTone: SkinTone;
  gender: Gender;
  location: District;
  district?: District;
  city?: string;
  categories: Category[];
  agencyId: string | null;
  agencyName?: string | null;
  availability: boolean;
  isPrivate?: boolean; 
  profileCompleteness: number;
  media: {
    images: string[];
    videos: string[];
  };
  views: number;
  rankingScore: number;
  createdAt: string;
  bio?: string;
  verified?: boolean;
  contact?: ContactDetails;
  publicEmail?: string;
  whatsapp?: string;
  instagram?: string;
  facebook?: string;
  website?: string;
  videoReelUrl?: string;
  averageRating?: number;
  reviewsCount?: number;
  totalProjects?: number;
  completedProjects?: number;
  pricing?: ModelPricing;
  stats?: {
    views: number;
    searches: number;
    saves: number;
    history?: { date: string; views: number }[];
  };
}

export interface AgencyRequest {
  id: string;
  uid: string; 
  applicantId?: string;
  applicantName: string;
  agencyName: string;
  logoUrl: string;
  whatsapp: string;
  socialLink: string; // Deprecated, kept for backward compatibility
  bio: string;
  status: AgencyRequestStatus;
  createdAt: string;
  // New Enhanced Fields
  location?: string;
  memberCount?: {
    male: number;
    female: number;
  };
  socialLinks?: {
    tiktok?: string;
    facebook?: string;
    instagram?: string;
  };
  instagram?: string;
  facebook?: string;
  website?: string;
  processedAt?: string;
  modelPhotos?: string[];
}

export interface AgencyInvite {
  id: string;
  agencyId: string;
  agencyName: string;
  modelUid: string;
  modelId?: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
  respondedAt?: string;
}

export interface AgencyApplication {
  id: string;
  agencyId: string;
  modelUid: string;
  modelId?: string;
  modelName: string;
  modelPhoto?: string;
  modelPhotoUrl?: string;
  note: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
  respondedAt?: string;
}

export interface LeaveRequest {
  id: string;
  modelUid: string;
  modelId?: string;
  modelName: string;
  agencyId: string;
  agencyName: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  processedAt?: string;
}

export enum NotificationType {
  AGENCY_INVITE = 'agency_invite',
  AGENCY_APPLICATION = 'agency_application',
  GENERAL = 'general',
  WARNING = 'warning'
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  data?: any;
  link?: string;
  read?: boolean;
  dedupeKey?: string;
  deliveredVia?: string[];
  createdAt: string;
  timestamp?: string;
}

export type AccountAppealStatus = 'pending' | 'under_review' | 'approved' | 'denied';

export interface AccountAppeal {
  id: string;
  deletionRecordId?: string;
  contactEmail: string;
  message: string;
  status: AccountAppealStatus;
  warningMessage?: string;
  adminNotes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MessageUser {
  id: string;
  displayName: string;
  role: UserRole;
  photoUrl?: string;
  email?: string;
}

export interface MessageThreadParticipant {
  userId: string;
  lastReadAt?: string;
  pinnedAt?: string;
  archivedAt?: string;
  mutedUntil?: string;
  user?: MessageUser;
}

export interface MessageThread {
  id: string;
  threadType: 'direct' | 'support' | 'group';
  title?: string;
  createdBy?: string;
  participants: MessageThreadParticipant[];
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface MessageItem {
  id: string;
  threadId: string;
  senderId: string;
  sender?: MessageUser;
  body?: string;
  voiceUrl?: string;
  voicePublicId?: string;
  voiceDurationSeconds?: number;
  replyToMessageId?: string;
  replyTo?: Pick<MessageItem, 'id' | 'body' | 'senderId'>;
  tags: string[];
  editedAt?: string;
  editCount?: number;
  deletedAt?: string;
  deletedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgencyProfile {
  id: string;
  name: string;
  ownerUid: string;
  logoUrl: string;
  whatsapp: string;
  socialLink: string;
  bio: string;
  isPlatformPartner: boolean;
  isAdminAgency?: boolean; 
  priorityWeight: number;
  createdAt: string;
  gallery?: string[];
}

export interface ProjectApproval {
  modelId: string;
  acceptedAt: string;
}

export interface Project {
  id: string;
  ownerId: string;
  ownerName: string;
  ownerPhotoUrl?: string;
  ownerVerified?: boolean;
  title: string;
  description: string;
  category: Category;
  location: District;
  visibility: ProjectVisibility;
  status: ProjectStatus;
  createdAt: string;
  dates?: string; // Display string
  eventDate?: string; // Logic ISO String YYYY-MM-DD
  views?: number;
  taggedModels: string[];
  applicantModels: string[];
  approvedModels: string[];
  approvals?: ProjectApproval[]; 
}

export interface SearchFilters {
  categories: Category[];
  locations: District[];
  minHeight?: number;
  maxHeight?: number;
  minAge?: number;
  maxAge?: number;
  minRate?: number;
  maxRate?: number;
  availabilityDate?: string;
  verifiedOnly?: boolean;
  agencyRepresented?: boolean | null;
  page?: number;
  limit?: number;
  gender: Gender | null;
  skinTones: SkinTone[];
  onlyAvailable: boolean;
}

export type AgencySortOption = 'popularity' | 'highest_rated' | 'most_models';

// --- BOOKING SYSTEM TYPES ---

export type BookingStatus = 'negotiating' | 'scheduled' | 'cancelled' | 'completed' | 'reported' | 'overdue' | 'disputed';

export enum ReportReason {
  NON_PAYMENT = 'Non-payment',
  PARTIAL_PAYMENT = 'Partial payment only',
  HARASSMENT = 'Harassment',
  VIOLATION = 'Agreement violation',
  UNSAFE = 'Unsafe conditions',
  OTHER = 'Other'
}

export interface Review {
  id: string;
  authorId: string;
  authorName?: string;
  authorRole?: UserRole;
  targetId: string;
  targetName?: string;
  targetRole?: UserRole;
  bookingId: string;
  projectTitle?: string;
  bookingStatus?: BookingStatus;
  rating: number;
  comment: string;
  editCount?: number;
  canEdit?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface BookingOffer {
  role: 'client' | 'model';
  amount: number;
  note?: string;
  timestamp: string;
}

export interface Booking {
  id: string;
  projectId: string;
  projectTitle: string;
  eventDate?: string; // Logic ISO String YYYY-MM-DD
  clientId: string;
  clientName: string;
  modelId: string;
  modelName: string;
  agencyId?: string; 
  category: Category;
  status: BookingStatus;
  currentOffer: number;
  history: BookingOffer[];
  createdAt: string;
  updatedAt: string;
  
  // Payment Proof
  paymentProofUrl?: string;
  
  // Protection & Reporting
  cancellationReason?: string;
  cancelledBy?: string; // uid
  reportReason?: ReportReason;
  reportDetails?: string;
  reportedBy?: string; // uid
  
  // Reviews
  modelReviewId?: string;
  clientReviewId?: string;

  // Safe Deletion / Archiving
  hiddenBy?: string[];
  blockedBy?: string[];
}

export type ContractDocumentType = 'booking_agreement' | 'model_release' | 'agency_agreement';
export type BookingAgreementStatus = 'draft' | 'sent' | 'accepted' | 'declined' | 'void';

export interface ContractTemplate {
  id: string;
  name: string;
  documentType: ContractDocumentType;
  body: string;
  version: number;
  isActive: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BookingAgreement {
  id: string;
  bookingId: string;
  templateId?: string;
  documentType: 'booking_agreement' | 'model_release';
  status: BookingAgreementStatus;
  documentSnapshot: string;
  clientAcceptedAt?: string;
  modelAcceptedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type DisputeStatus = 'open' | 'under_review' | 'resolved' | 'dismissed';

export interface Dispute {
  id: string;
  bookingId?: string;
  openedBy?: string;
  againstUserId?: string;
  status: DisputeStatus;
  reason: string;
  details?: string;
  adminDecision?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DisputeEvidence {
  id: string;
  disputeId: string;
  uploadedBy?: string;
  cloudinaryUrl?: string;
  cloudinaryPublicId?: string;
  note?: string;
  createdAt: string;
  deletedAt?: string;
}

// --- REPORTING & ADMIN TYPES ---

export enum ReportStatus {
  PENDING = 'PENDING',
  REVIEWED = 'REVIEWED',
  WARNING_SENT = 'WARNING_SENT',
  ACTION_TAKEN = 'ACTION_TAKEN',
  RESOLVED = 'RESOLVED'
}

export interface Report {
  id: string;
  reporterId: string;
  reporterRole: UserRole;
  reportedUserId: string;
  reportedUserRole: UserRole;
  projectId?: string;
  bookingId?: string;
  reason: ReportReason | string;
  details?: string;
  status: ReportStatus;
  adminNotes?: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface ModelRankingSignal {
  modelId: string;
  displayName: string;
  rankingScore: number;
  averageRating: number;
  reviewsCount: number;
  completedJobs: number;
  cancelledJobs: number;
  responseRate: number;
  profileCompleteness: number;
}

export interface DeletionLog {
  id: string;
  performerId: string; // Who deleted
  targetId: string; // Who was deleted
  projectId?: string; // Related project
  reason?: string;
  createdAt: string;
}
