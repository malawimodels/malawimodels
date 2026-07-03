import React, { useEffect, useMemo, useState } from 'react';
import { ModelProfile, District, Gender, SkinTone, Category, AvailabilityBlock, NotificationPreferences } from '../../types';
import {
    Save,
    DollarSign,
    Camera,
    Trash2,
    Info,
    CheckCircle,
    Instagram,
    Facebook,
    MapPin,
    LocateFixed,
    Loader2,
    Ruler,
    Calendar,
} from 'lucide-react';
import { uploadImage } from '../../services/cloudinary';
import {
    deleteModelAvailabilityBlock,
    getModelAvailabilityBlocks,
    getNotificationPreferences,
    saveModelAvailabilityBlock,
    updateNotificationPreferences,
} from '../../services/supabase.service';
import AppearanceSettings from '../AppearanceSettings';
import OptimizedImage from '../OptimizedImage';
import { useNotification } from '../NotificationSystem';

interface ModelProfileSettingsProps {
    profile: ModelProfile;
    setProfile: React.Dispatch<React.SetStateAction<ModelProfile | null>>;
    onSave: () => Promise<void>;
    saving: boolean;
}

const RATE_MIN = 10000;
const RATE_MAX = 1000000;
const RATE_STEP = 10000;
const DEFAULT_RATE = 30000;
const MIN_HEIGHT_INCHES = 48;
const MAX_HEIGHT_INCHES = 84;
const DEFAULT_HEIGHT_INCHES = 67;
const DEFAULT_AGE = 21;
const DISPLAY_NAME_COOLDOWN_MS = 24 * 60 * 60 * 1000;

const MALAWI_DISTRICTS = [
    'Balaka',
    'Blantyre',
    'Chikwawa',
    'Chiradzulu',
    'Chitipa',
    'Dedza',
    'Dowa',
    'Karonga',
    'Kasungu',
    'Likoma',
    'Lilongwe',
    'Machinga',
    'Mangochi',
    'Mchinji',
    'Mulanje',
    'Mwanza',
    'Mzimba',
    'Neno',
    'Nkhata Bay',
    'Nkhotakota',
    'Nsanje',
    'Ntcheu',
    'Ntchisi',
    'Phalombe',
    'Rumphi',
    'Salima',
    'Thyolo',
    'Zomba',
];

const MALAWI_LOCATION_SUGGESTIONS = [
    ...MALAWI_DISTRICTS.map((district) => `Malawi, ${district}`),
    'Malawi, Blantyre, Bangwe',
    'Malawi, Blantyre, Limbe',
    'Malawi, Blantyre, Ndirande',
    'Malawi, Blantyre, Chilomoni',
    'Malawi, Blantyre, Soche',
    'Malawi, Blantyre, Machinjiri',
    'Malawi, Blantyre, Chigumula',
    'Malawi, Lilongwe, Area 18',
    'Malawi, Lilongwe, Area 25',
    'Malawi, Lilongwe, Area 47',
    'Malawi, Lilongwe, Kanengo',
    'Malawi, Lilongwe, Kawale',
    'Malawi, Lilongwe, Biwi',
    'Malawi, Lilongwe, Likuni',
    'Malawi, Mzuzu, Luwinga',
    'Malawi, Mzuzu, Mchengautuwa',
    'Malawi, Mzuzu, Katoto',
    'Malawi, Zomba, Chinamwali',
    'Malawi, Zomba, Matawale',
    'Malawi, Zomba, Chikanda',
    'Malawi, Mangochi, Monkey Bay',
    'Malawi, Salima, Senga Bay',
    'Malawi, Karonga, Chilumba',
    'Malawi, Mzimba, Ekwendeni',
];

const formatMWK = (value?: number): string => {
    if (!value) return 'Negotiable';
    return `MWK ${value.toLocaleString('en-US')}`;
};

const cmToInches = (cm?: number): number => {
    if (!cm) return DEFAULT_HEIGHT_INCHES;
    return Math.round(cm / 2.54);
};

const inchesToCm = (inches: number): number => Math.round(inches * 2.54);

const formatHeight = (totalInches: number): string => {
    const feet = Math.floor(totalInches / 12);
    const inches = totalInches % 12;
    return `${feet} ft ${inches} in`;
};

const formatLocationValue = (profile: ModelProfile): string => {
    if (profile.city) return `Malawi, ${profile.location || 'Other'}, ${profile.city}`;
    if (profile.location) return `Malawi, ${profile.location}`;
    return '';
};

const parseLocation = (value: string): { district: string; city: string } => {
    const parts = value
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
        .filter((part) => part.toLowerCase() !== 'malawi');

    const matchedDistrict = MALAWI_DISTRICTS.find((district) =>
        parts.some((part) => part.toLowerCase() === district.toLowerCase())
    );

    if (matchedDistrict) {
        return {
            district: matchedDistrict,
            city: parts.filter((part) => part.toLowerCase() !== matchedDistrict.toLowerCase()).join(', '),
        };
    }

    return {
        district: parts[0] || 'Other',
        city: parts.slice(1).join(', '),
    };
};

const getDisplayNameLock = (changedAt?: string): { locked: boolean; label: string } => {
    if (!changedAt) return { locked: false, label: '' };
    const unlockTime = new Date(changedAt).getTime() + DISPLAY_NAME_COOLDOWN_MS;
    const remaining = unlockTime - Date.now();

    if (remaining <= 0) return { locked: false, label: '' };

    const hours = Math.ceil(remaining / (60 * 60 * 1000));
    return {
        locked: true,
        label: `Available in ${hours}h`,
    };
};

const ModelProfileSettings: React.FC<ModelProfileSettingsProps> = ({ profile, setProfile, onSave, saving }) => {
    const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
    const [uploadError, setUploadError] = useState('');
    const [detectingLocation, setDetectingLocation] = useState(false);
    const [locationQuery, setLocationQuery] = useState(formatLocationValue(profile));
    const [availabilityBlocks, setAvailabilityBlocks] = useState<AvailabilityBlock[]>([]);
    const [newBlock, setNewBlock] = useState({ startDate: '', endDate: '', reason: '' });
    const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences | null>(null);
    const [settingsBusy, setSettingsBusy] = useState(false);
    const { addNotification } = useNotification();

    const heightInches = cmToInches(profile.height);
    const ageEnabled = Boolean(profile.age);
    const nameLock = useMemo(() => getDisplayNameLock(profile.displayNameChangedAt), [profile.displayNameChangedAt]);

    useEffect(() => {
        let active = true;

        const loadSettings = async () => {
            const [blocks, preferences] = await Promise.all([
                getModelAvailabilityBlocks(profile.uid).catch(() => []),
                getNotificationPreferences(profile.uid).catch(() => null),
            ]);

            if (!active) return;
            setAvailabilityBlocks(blocks);
            setNotificationPreferences(preferences || {
                userId: profile.uid,
                inAppEnabled: true,
                emailEnabled: true,
                projectUpdates: true,
                bookingUpdates: true,
                agencyUpdates: true,
                marketingEmails: false,
            });
        };

        loadSettings();
        return () => {
            active = false;
        };
    }, [profile.uid]);

    const addAvailabilityBlock = async () => {
        if (!newBlock.startDate || !newBlock.endDate) {
            addNotification('error', 'Choose start and end dates for the unavailable period.');
            return;
        }

        setSettingsBusy(true);
        try {
            await saveModelAvailabilityBlock(profile.uid, newBlock);
            setAvailabilityBlocks(await getModelAvailabilityBlocks(profile.uid));
            setNewBlock({ startDate: '', endDate: '', reason: '' });
            addNotification('success', 'Availability updated.');
        } catch (error) {
            console.error(error);
            addNotification('error', 'Could not save availability.');
        } finally {
            setSettingsBusy(false);
        }
    };

    const removeAvailabilityBlock = async (blockId: string) => {
        setSettingsBusy(true);
        try {
            await deleteModelAvailabilityBlock(blockId);
            setAvailabilityBlocks(blocks => blocks.filter(block => block.id !== blockId));
            addNotification('success', 'Availability block removed.');
        } catch (error) {
            console.error(error);
            addNotification('error', 'Could not remove availability block.');
        } finally {
            setSettingsBusy(false);
        }
    };

    const saveNotificationPreference = async (key: keyof Omit<NotificationPreferences, 'userId' | 'updatedAt'>, value: boolean) => {
        const next = { ...(notificationPreferences || { userId: profile.uid }), [key]: value } as NotificationPreferences;
        setNotificationPreferences(next);

        try {
            await updateNotificationPreferences(profile.uid, { [key]: value });
        } catch (error) {
            console.error(error);
            addNotification('error', 'Could not save notification preference.');
        }
    };

    const updateLocation = (value: string) => {
        setLocationQuery(value);
        const parsed = parseLocation(value);
        setProfile({
            ...profile,
            location: parsed.district as District,
            district: parsed.district as District,
            city: parsed.city,
        });
    };

    const detectLocation = () => {
        if (!navigator.geolocation) {
            setUploadError('Location detection is not available on this device.');
            return;
        }

        setDetectingLocation(true);
        setUploadError('');

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    const { latitude, longitude } = position.coords;
                    const response = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&accept-language=en`
                    );
                    const data = await response.json();
                    const address = data.address || {};
                    const districtCandidate = address.state_district || address.county || address.state || '';
                    const matchedDistrict =
                        MALAWI_DISTRICTS.find((district) =>
                            districtCandidate.toLowerCase().includes(district.toLowerCase())
                        ) ||
                        MALAWI_DISTRICTS.find((district) =>
                            `${address.city || ''} ${address.town || ''} ${address.village || ''}`.toLowerCase().includes(district.toLowerCase())
                        ) ||
                        (profile.location || 'Other');

                    const localityParts = [
                        address.city || address.town || address.village || address.municipality,
                        address.suburb || address.neighbourhood || address.quarter || address.road,
                    ]
                        .filter(Boolean)
                        .filter((part, index, arr) => arr.indexOf(part) === index);

                    const nextValue = `Malawi, ${matchedDistrict}${localityParts.length ? `, ${localityParts.join(', ')}` : ''}`;
                    updateLocation(nextValue);
                } catch (error) {
                    console.error(error);
                    setUploadError('Could not detect a readable location. You can still search and select it.');
                } finally {
                    setDetectingLocation(false);
                }
            },
            () => {
                setDetectingLocation(false);
                setUploadError('Location permission was not granted.');
            },
            { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
        );
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setUploadingIndex(index);
            setUploadError('');
            const uploaded = await uploadImage(file, index === 0 ? 'profile' : 'gallery');
            const currentImages = [...(profile.media?.images || [])];
            while (currentImages.length <= index) currentImages.push('');
            currentImages[index] = uploaded.url;
            setProfile({ ...profile, media: { ...profile.media, images: currentImages } });
        } catch (err) {
            setUploadError(err instanceof Error ? err.message : 'Image upload failed.');
        } finally {
            setUploadingIndex(null);
            e.target.value = '';
        }
    };

    const removeImage = (index: number) => {
        const currentImages = [...(profile.media?.images || [])];
        if (currentImages[index]) currentImages[index] = '';
        setProfile({ ...profile, media: { ...profile.media, images: currentImages } });
    };

    const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const videoUrl = e.target.value;
        setProfile({ ...profile, media: { ...profile.media, videos: [videoUrl] } });
    };

    const setRate = (category: Category, value?: number) => {
        setProfile({
            ...profile,
            pricing: { ...profile.pricing, [category]: value },
        });
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-slide-up">
            <div className="lg:col-span-2 space-y-6">
                <div className="bg-brand-surface p-6 rounded-2xl border border-white/5">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
                        <h3 className="text-xl font-bold text-white">Basic Information</h3>
                        <button onClick={onSave} disabled={saving || uploadingIndex !== null || detectingLocation} className="flex items-center justify-center px-4 py-2 bg-brand-primary text-white text-sm font-bold rounded-lg hover:bg-brand-accent disabled:opacity-50 transition-all">
                            <Save className="w-4 h-4 mr-2" /> {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>

                    {uploadError && (
                        <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                            {uploadError}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-xs font-bold text-brand-muted uppercase">Display Name</label>
                                {nameLock.locked && <span className="text-[11px] font-bold text-brand-primary">{nameLock.label}</span>}
                            </div>
                            <input
                                className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:border-brand-primary focus:outline-none disabled:opacity-60"
                                value={profile.displayName}
                                disabled={nameLock.locked}
                                onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}
                            />
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-xs font-bold text-brand-muted uppercase">Location</label>
                                <button type="button" onClick={detectLocation} disabled={detectingLocation} className="text-[11px] font-bold text-brand-primary hover:text-white flex items-center disabled:opacity-50">
                                    {detectingLocation ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <LocateFixed className="w-3 h-3 mr-1" />}
                                    Detect
                                </button>
                            </div>
                            <div className="relative">
                                <MapPin className="absolute left-3 top-3.5 w-4 h-4 text-brand-muted" />
                                <input
                                    list="malawi-location-options"
                                    className="w-full bg-black/20 border border-white/10 rounded-lg pl-10 pr-3 py-3 text-white focus:border-brand-primary focus:outline-none"
                                    value={locationQuery}
                                    onChange={(e) => updateLocation(e.target.value)}
                                    placeholder="Malawi, Blantyre, Bangwe"
                                />
                                <datalist id="malawi-location-options">
                                    {MALAWI_LOCATION_SUGGESTIONS.map((location) => (
                                        <option key={location} value={location} />
                                    ))}
                                </datalist>
                            </div>
                        </div>

                        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <label className="text-xs font-bold text-brand-muted uppercase flex items-center"><Ruler className="w-4 h-4 mr-2" /> Height</label>
                                    <span className="text-sm font-bold text-white">{formatHeight(heightInches)}</span>
                                </div>
                                <input
                                    type="range"
                                    min={MIN_HEIGHT_INCHES}
                                    max={MAX_HEIGHT_INCHES}
                                    step={1}
                                    value={heightInches}
                                    className="profile-range w-full"
                                    onChange={(e) => setProfile({ ...profile, height: inchesToCm(parseInt(e.target.value, 10)) })}
                                />
                            </div>

                            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <label className="text-xs font-bold text-brand-muted uppercase flex items-center"><Calendar className="w-4 h-4 mr-2" /> Age</label>
                                    <button
                                        type="button"
                                        onClick={() => setProfile({ ...profile, age: ageEnabled ? undefined : DEFAULT_AGE })}
                                        className={`text-[11px] font-bold ${ageEnabled ? 'text-white' : 'text-brand-primary'} hover:text-brand-primary`}
                                    >
                                        {ageEnabled ? `${profile.age} years` : 'Optional'}
                                    </button>
                                </div>
                                <input
                                    type="range"
                                    min={16}
                                    max={65}
                                    step={1}
                                    value={profile.age || DEFAULT_AGE}
                                    disabled={!ageEnabled}
                                    className="profile-range w-full disabled:opacity-40"
                                    onChange={(e) => setProfile({ ...profile, age: parseInt(e.target.value, 10) })}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-brand-muted uppercase mb-2">Gender</label>
                            <select className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:border-brand-primary focus:outline-none" value={profile.gender} onChange={(e) => setProfile({ ...profile, gender: e.target.value as Gender })}>
                                {Object.values(Gender).map((gender) => <option key={gender} value={gender}>{gender}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-brand-muted uppercase mb-2">Skin Tone</label>
                            <select className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:border-brand-primary focus:outline-none" value={profile.skinTone} onChange={(e) => setProfile({ ...profile, skinTone: e.target.value as SkinTone })}>
                                {Object.values(SkinTone).map((skinTone) => <option key={skinTone} value={skinTone}>{skinTone}</option>)}
                            </select>
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-brand-muted uppercase mb-3">Modeling Specialties</label>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {Object.values(Category).map((cat) => (
                                    <label key={cat} className={`flex items-center justify-center p-3 rounded-lg border cursor-pointer text-center transition-all ${(profile.categories || []).includes(cat) ? 'bg-brand-primary/20 border-brand-primary text-white shadow-[0_0_10px_rgba(245,158,11,0.2)]' : 'bg-black/20 border-white/10 text-brand-muted hover:bg-white/5 hover:border-white/30'}`}>
                                        <input
                                            type="checkbox"
                                            className="hidden"
                                            checked={(profile.categories || []).includes(cat)}
                                            onChange={(e) => {
                                                const current = profile.categories || [];
                                                setProfile({
                                                    ...profile,
                                                    categories: e.target.checked ? [...current, cat] : current.filter((c) => c !== cat),
                                                });
                                            }}
                                        />
                                        <span className="text-xs font-bold uppercase">{cat}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center gap-3 pt-2">
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer" checked={profile.availability} onChange={(e) => setProfile({ ...profile, availability: e.target.checked })} />
                                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                                <span className="ml-3 text-sm font-medium text-white">Available for Work</span>
                            </label>
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-brand-muted uppercase mb-2">Bio / Introduction</label>
                            <textarea className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:border-brand-primary focus:outline-none h-24 resize-none" value={profile.bio || ''} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} />
                        </div>
                    </div>
                </div>

                <div className="bg-brand-surface p-6 rounded-2xl border border-white/5">
                    <h3 className="text-xl font-bold text-white mb-6 flex items-center">Social Media</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="relative">
                            <Instagram className="absolute left-3 top-3.5 w-5 h-5 text-brand-muted" />
                            <input
                                className="w-full bg-black/20 border border-white/10 rounded-lg pl-10 pr-3 py-3 text-white focus:border-brand-primary focus:outline-none"
                                placeholder="Instagram Handle"
                                value={profile.contact?.instagram || ''}
                                onChange={(e) => setProfile({ ...profile, contact: { ...profile.contact, instagram: e.target.value } })}
                            />
                        </div>
                        <div className="relative">
                            <Facebook className="absolute left-3 top-3.5 w-5 h-5 text-brand-muted" />
                            <input
                                className="w-full bg-black/20 border border-white/10 rounded-lg pl-10 pr-3 py-3 text-white focus:border-brand-primary focus:outline-none"
                                placeholder="Facebook Profile Link"
                                value={profile.contact?.facebook || ''}
                                onChange={(e) => setProfile({ ...profile, contact: { ...profile.contact, facebook: e.target.value } })}
                            />
                        </div>
                    </div>
                </div>

                <div className="bg-brand-surface p-6 rounded-2xl border border-white/5">
                    <h3 className="text-xl font-bold text-white mb-6 flex items-center">
                        <DollarSign className="w-5 h-5 mr-2 text-green-500" /> Rates & Minimums (MWK)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {Object.values(Category).map((cat) => {
                            const currentRate = profile.pricing?.[cat];
                            const sliderValue = currentRate || DEFAULT_RATE;
                            return (
                                <div key={cat} className="rounded-xl border border-white/10 bg-black/20 p-4">
                                    <div className="flex items-center justify-between gap-3 mb-3">
                                        <label className="text-xs font-bold text-brand-muted uppercase">{cat}</label>
                                        <button
                                            type="button"
                                            onClick={() => setRate(cat, currentRate ? undefined : DEFAULT_RATE)}
                                            className={`text-[11px] font-bold ${currentRate ? 'text-white' : 'text-brand-primary'} hover:text-brand-primary`}
                                        >
                                            {currentRate ? formatMWK(currentRate) : 'Negotiable'}
                                        </button>
                                    </div>
                                    <input
                                        type="range"
                                        min={RATE_MIN}
                                        max={RATE_MAX}
                                        step={RATE_STEP}
                                        value={sliderValue}
                                        className="profile-range w-full"
                                        onChange={(e) => setRate(cat, parseInt(e.target.value, 10))}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="bg-brand-surface p-6 rounded-2xl border border-white/5">
                    <h3 className="text-xl font-bold text-white mb-6 flex items-center"><Camera className="w-5 h-5 mr-2 text-brand-primary" /> Visual Portfolio</h3>
                    <div className="space-y-6">
                        <div>
                            <label className="block text-xs font-bold text-brand-muted uppercase mb-4">Video Reel (YouTube URL)</label>
                            <input type="text" placeholder="https://youtube.com/watch?v=..." className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:border-brand-primary focus:outline-none" value={profile.media?.videos?.[0] || ''} onChange={handleVideoChange} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-brand-muted uppercase mb-4">Photos (Max 6)</label>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {[0, 1, 2, 3, 4, 5].map((index) => (
                                    <div key={index} className="aspect-[3/4] rounded-xl border border-white/10 bg-black/20 relative overflow-hidden group">
                                        {profile.media?.images?.[index] ? (
                                            <>
                                                <OptimizedImage src={profile.media.images[index]} variant="card" alt={`Portfolio ${index + 1}`} className="w-full h-full object-cover" />
                                                <button onClick={() => removeImage(index)} className="absolute top-2 right-2 p-1.5 bg-red-500 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </>
                                        ) : (
                                            <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-colors text-brand-muted hover:text-white">
                                                {uploadingIndex === index ? <Loader2 className="w-8 h-8 mb-2 animate-spin" /> : <Camera className="w-8 h-8 mb-2 opacity-50" />}
                                                <span className="text-xs font-bold">{uploadingIndex === index ? 'Uploading' : 'Upload'}</span>
                                                <input type="file" accept="image/*" className="hidden" disabled={uploadingIndex !== null} onChange={(e) => handleImageUpload(e, index)} />
                                            </label>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                <AppearanceSettings />

                <div className="bg-brand-surface p-6 rounded-2xl border border-white/5">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center"><Calendar className="w-5 h-5 mr-2 text-brand-primary" /> Unavailable Dates</h3>
                    <div className="space-y-3">
                        <input
                            type="date"
                            className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:border-brand-primary focus:outline-none"
                            value={newBlock.startDate}
                            onChange={(e) => setNewBlock({ ...newBlock, startDate: e.target.value })}
                        />
                        <input
                            type="date"
                            className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:border-brand-primary focus:outline-none"
                            value={newBlock.endDate}
                            onChange={(e) => setNewBlock({ ...newBlock, endDate: e.target.value })}
                        />
                        <input
                            type="text"
                            className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:border-brand-primary focus:outline-none"
                            placeholder="Reason, optional"
                            value={newBlock.reason}
                            onChange={(e) => setNewBlock({ ...newBlock, reason: e.target.value })}
                        />
                        <button
                            type="button"
                            onClick={addAvailabilityBlock}
                            disabled={settingsBusy}
                            className="w-full px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-bold rounded-lg disabled:opacity-50"
                        >
                            Add Dates
                        </button>
                    </div>

                    {availabilityBlocks.length > 0 && (
                        <div className="mt-4 space-y-2">
                            {availabilityBlocks.slice(0, 5).map((block) => (
                                <div key={block.id} className="flex items-center justify-between gap-3 rounded-lg bg-black/20 border border-white/10 p-3">
                                    <div>
                                        <p className="text-xs font-bold text-white">{block.startDate} to {block.endDate}</p>
                                        {block.reason && <p className="text-[11px] text-brand-muted mt-1">{block.reason}</p>}
                                    </div>
                                    <button type="button" onClick={() => removeAvailabilityBlock(block.id)} disabled={settingsBusy} className="text-red-400 hover:text-red-300 disabled:opacity-50">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {notificationPreferences && (
                    <div className="bg-brand-surface p-6 rounded-2xl border border-white/5">
                        <h3 className="text-lg font-bold text-white mb-4">Notifications</h3>
                        <div className="space-y-3">
                            {([
                                ['inAppEnabled', 'In-app notifications'],
                                ['emailEnabled', 'Email notifications'],
                                ['projectUpdates', 'Project updates'],
                                ['bookingUpdates', 'Booking updates'],
                                ['agencyUpdates', 'Agency updates'],
                                ['marketingEmails', 'Marketing emails'],
                            ] as const).map(([key, label]) => (
                                <label key={key} className="flex items-center justify-between gap-3 text-sm text-brand-muted">
                                    <span>{label}</span>
                                    <input
                                        type="checkbox"
                                        className="h-4 w-4 accent-brand-primary"
                                        checked={Boolean(notificationPreferences[key])}
                                        onChange={(e) => saveNotificationPreference(key, e.target.checked)}
                                    />
                                </label>
                            ))}
                        </div>
                    </div>
                )}

                <div className="bg-brand-surface p-6 rounded-2xl border border-white/5">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center"><Info className="w-5 h-5 mr-2 text-brand-muted" /> Profile Tips</h3>
                    <ul className="space-y-4">
                        <li className="flex items-start text-sm text-brand-muted"><CheckCircle className="w-4 h-4 mr-2 text-green-500 flex-shrink-0 mt-0.5" /><span><strong>High Quality Photos:</strong> Use clear, professional lighting. Avoid selfies.</span></li>
                        <li className="flex items-start text-sm text-brand-muted"><CheckCircle className="w-4 h-4 mr-2 text-green-500 flex-shrink-0 mt-0.5" /><span><strong>Measurements:</strong> Keep your height and other details accurate.</span></li>
                        <li className="flex items-start text-sm text-brand-muted"><CheckCircle className="w-4 h-4 mr-2 text-green-500 flex-shrink-0 mt-0.5" /><span><strong>Rates:</strong> Keep minimums realistic for Malawi Kwacha bookings.</span></li>
                        <li className="flex items-start text-sm text-brand-muted"><CheckCircle className="w-4 h-4 mr-2 text-green-500 flex-shrink-0 mt-0.5" /><span><strong>Social Links:</strong> Adding Instagram helps clients review your day-to-day style.</span></li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default ModelProfileSettings;
