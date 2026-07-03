import { ModelProfile, District, Gender, Category, SkinTone, UserRole, Project, ProjectVisibility, ProjectStatus } from '../types';

const BREEZING_AGENCY_ID = 'breezing_agency_id';

// Helper to calculate the "Secret" score
const calculateRankingScore = (
  completeness: number, 
  activity: number, 
  popularity: number, 
  available: boolean, 
  priorityWeight: number
): number => {
  const availabilityBoost = available ? 100 : 0;
  const baseScore = (completeness * 0.3) + (activity * 0.2) + (popularity * 0.2) + (availabilityBoost * 0.1);
  let finalScore = baseScore * priorityWeight;
  return Math.min(Math.round(finalScore), 100); 
};

export const INITIAL_MODELS: ModelProfile[] = [
  {
    uid: '1',
    displayName: 'Chisomo Banda',
    location: District.LILONGWE,
    height: 175,
    skinTone: SkinTone.DARK_BROWN,
    gender: Gender.FEMALE,
    categories: [Category.FASHION, Category.BRAND_PROMO],
    availability: true,
    media: {
      images: ['https://picsum.photos/id/1027/400/600', 'https://picsum.photos/id/1028/400/600', 'https://picsum.photos/id/1029/400/600'],
      videos: []
    },
    bio: 'Professional fashion model with 3 years experience in high-end editorials.',
    verified: true,
    agencyId: BREEZING_AGENCY_ID,
    profileCompleteness: 95,
    views: 1240,
    rankingScore: 0,
    createdAt: new Date().toISOString(),
    stats: { views: 1240, searches: 350, saves: 45, history: [{ date: 'Mon', views: 40 }, { date: 'Tue', views: 65 }, { date: 'Wed', views: 80 }, { date: 'Thu', views: 55 }, { date: 'Fri', views: 90 }, { date: 'Sat', views: 120 }, { date: 'Sun', views: 100 }] },
  },
  {
    uid: '2',
    displayName: 'Thabo Phiri',
    location: District.BLANTYRE,
    height: 185,
    skinTone: SkinTone.DEEP,
    gender: Gender.MALE,
    categories: [Category.COMMERCIAL, Category.ACTING, Category.MUSIC_VIDEO],
    availability: true,
    media: {
      images: ['https://picsum.photos/id/1012/400/600', 'https://picsum.photos/id/1013/400/600'],
      videos: []
    },
    bio: 'Versatile actor and commercial model. Featured in top TNM campaigns.',
    verified: true,
    agencyId: 'standard_agency',
    profileCompleteness: 85,
    views: 980,
    rankingScore: 0,
    createdAt: new Date().toISOString(),
    stats: { views: 980, searches: 210, saves: 30, history: [{ date: 'Mon', views: 20 }, { date: 'Tue', views: 35 }, { date: 'Wed', views: 40 }, { date: 'Thu', views: 25 }, { date: 'Fri', views: 50 }, { date: 'Sat', views: 60 }, { date: 'Sun', views: 45 }] },
  },
  {
    uid: '3',
    displayName: 'Grace Mhone',
    location: District.MZUZU,
    height: 168,
    skinTone: SkinTone.BROWN,
    gender: Gender.FEMALE,
    categories: [Category.BRAND_PROMO, Category.MUSIC_VIDEO],
    availability: false,
    media: {
      images: ['https://picsum.photos/id/1011/400/600', 'https://picsum.photos/id/111/400/600'],
      videos: []
    },
    bio: 'Energetic and charismatic, perfect for music videos and energetic brand promos.',
    verified: false,
    agencyId: null,
    profileCompleteness: 60,
    views: 500,
    rankingScore: 0,
    createdAt: new Date().toISOString(),
    stats: { views: 500, searches: 120, saves: 15, history: [] },
  },
  {
    uid: '4',
    displayName: 'Kondwani Moyo',
    location: District.LILONGWE,
    height: 180,
    skinTone: SkinTone.MEDIUM,
    gender: Gender.MALE,
    categories: [Category.FASHION, Category.RUNWAY],
    availability: true,
    media: {
      images: ['https://picsum.photos/id/1005/400/600', 'https://picsum.photos/id/1006/400/600'],
      videos: []
    },
    bio: 'Runway specialist with a unique look.',
    verified: true,
    agencyId: null,
    profileCompleteness: 80,
    views: 800,
    rankingScore: 0,
    createdAt: new Date().toISOString(),
    stats: { views: 800, searches: 180, saves: 25, history: [] },
  },
  {
    uid: '5',
    displayName: 'Alinafe Tembo',
    location: District.ZOMBA,
    height: 172,
    skinTone: SkinTone.OLIVE,
    gender: Gender.FEMALE,
    categories: [Category.ACTING, Category.COMMERCIAL],
    availability: true,
    media: {
      images: ['https://picsum.photos/id/338/400/600'],
      videos: []
    },
    bio: 'Natural look suitable for lifestyle and family oriented commercials.',
    verified: true,
    agencyId: null,
    profileCompleteness: 75,
    views: 650,
    rankingScore: 0,
    createdAt: new Date().toISOString(),
    stats: { views: 650, searches: 140, saves: 10, history: [] },
  },
  {
    uid: '6',
    displayName: 'Gift Chirwa',
    location: District.BLANTYRE,
    height: 190,
    skinTone: SkinTone.DEEP,
    gender: Gender.MALE,
    categories: [Category.FASHION, Category.RUNWAY, Category.BRAND_PROMO],
    availability: true,
    media: {
      images: ['https://picsum.photos/id/331/400/600'],
      videos: []
    },
    bio: 'Tall, striking features. Available for international travel.',
    verified: true,
    agencyId: BREEZING_AGENCY_ID,
    profileCompleteness: 90,
    views: 1500,
    rankingScore: 0,
    createdAt: new Date().toISOString(),
    stats: { views: 1500, searches: 400, saves: 80, history: [] },
  }
];

// Calculate ratings on init
INITIAL_MODELS.forEach(model => {
  // Mocking metrics derived from model properties for score calculation
  const activityScore = model.views / 20; 
  const popularity = (model.stats?.saves || 0) * 2;
  const priorityWeight = model.agencyId === BREEZING_AGENCY_ID ? 1.3 : 1.0;

  model.rankingScore = calculateRankingScore(
    model.profileCompleteness,
    activityScore,
    popularity,
    model.availability,
    priorityWeight
  );
});

// --- NEW: MOCK PROJECTS ---
export const INITIAL_PROJECTS: Project[] = [
  {
    id: 'p1',
    ownerId: 'client_1',
    ownerName: 'TNM Malawi',
    ownerPhotoUrl: '',
    ownerVerified: true,
    title: 'Summer Data Campaign',
    description: 'Looking for energetic youth for a nationwide billboard campaign.',
    category: Category.BRAND_PROMO,
    location: District.LILONGWE,
    visibility: ProjectVisibility.PUBLIC,
    status: ProjectStatus.OPEN,
    createdAt: new Date().toISOString(),
    taggedModels: [],
    applicantModels: ['1', '2'], // Mock applicants
    approvedModels: []
  },
  {
    id: 'p2',
    ownerId: 'client_1',
    ownerName: 'TNM Malawi',
    ownerPhotoUrl: '',
    ownerVerified: true,
    title: 'Executive TV Commercial',
    description: 'Need a mature male actor for a corporate banking ad.',
    category: Category.ACTING,
    location: District.BLANTYRE,
    visibility: ProjectVisibility.PRIVATE,
    status: ProjectStatus.OPEN,
    createdAt: new Date().toISOString(),
    taggedModels: ['2'], // Invited specifically
    applicantModels: [],
    approvedModels: []
  }
];

export const getModels = () => {
  const sorted = [...INITIAL_MODELS].sort((a, b) => b.rankingScore - a.rankingScore);
  return Promise.resolve(sorted);
};

export const getModelById = (id: string) => {
  return Promise.resolve(INITIAL_MODELS.find(m => m.uid === id));
};

export const getProjects = () => {
  return Promise.resolve([...INITIAL_PROJECTS]);
};