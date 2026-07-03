
import React, { useMemo, useState } from 'react';
import { UserData, SocialLink } from '../../types';
import { Save, Building, Phone, Instagram, Globe, FileText, Image as ImageIcon, Trash2, Camera, Plus, Link as LinkIcon, X, Loader2 } from 'lucide-react';
import { uploadImage } from '../../services/cloudinary';
import { useNotification } from '../NotificationSystem';
import AppearanceSettings from '../AppearanceSettings';
import OptimizedImage from '../OptimizedImage';

interface AgencyProfileSettingsProps {
    userData: UserData;
    setUserData: React.Dispatch<React.SetStateAction<UserData | null>>;
    onSave: () => Promise<void>;
    saving: boolean;
}

const DISPLAY_NAME_COOLDOWN_MS = 24 * 60 * 60 * 1000;

const getDisplayNameLock = (changedAt?: string): { locked: boolean; label: string } => {
    if (!changedAt) return { locked: false, label: '' };
    const remaining = new Date(changedAt).getTime() + DISPLAY_NAME_COOLDOWN_MS - Date.now();
    if (remaining <= 0) return { locked: false, label: '' };
    return { locked: true, label: `Available in ${Math.ceil(remaining / (60 * 60 * 1000))}h` };
};

const AgencyProfileSettings: React.FC<AgencyProfileSettingsProps> = ({ userData, setUserData, onSave, saving }) => {
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const [uploadingGallery, setUploadingGallery] = useState(false);
    const { addNotification } = useNotification();
    const nameLock = useMemo(() => getDisplayNameLock(userData.displayNameChangedAt), [userData.displayNameChangedAt]);
    
    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            try {
                setUploadingLogo(true);
                const uploaded = await uploadImage(file, 'agency-logo');
                setUserData({ ...userData, photoUrl: uploaded.url });
            } catch (err) {
                addNotification('error', err instanceof Error ? err.message : 'Logo upload failed.');
            } finally {
                setUploadingLogo(false);
                e.target.value = '';
            }
        }
    };

    const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            try {
                setUploadingGallery(true);
                const uploaded = await uploadImage(file, 'gallery');
                const currentGallery = userData.gallery || [];
                setUserData({ ...userData, gallery: [...currentGallery, uploaded.url] });
            } catch (err) {
                addNotification('error', err instanceof Error ? err.message : 'Gallery upload failed.');
            } finally {
                setUploadingGallery(false);
                e.target.value = '';
            }
        }
    };

    const removeGalleryImage = (index: number) => {
        const currentGallery = [...(userData.gallery || [])];
        currentGallery.splice(index, 1);
        setUserData({ ...userData, gallery: currentGallery });
    };

    // --- Custom Link Logic ---
    const addCustomLink = () => {
        const currentLinks = userData.customLinks || [];
        setUserData({ ...userData, customLinks: [...currentLinks, { platform: '', url: '' }] });
    };

    const removeCustomLink = (index: number) => {
        const currentLinks = [...(userData.customLinks || [])];
        currentLinks.splice(index, 1);
        setUserData({ ...userData, customLinks: currentLinks });
    };

    const updateCustomLink = (index: number, field: keyof SocialLink, value: string) => {
        const currentLinks = [...(userData.customLinks || [])];
        currentLinks[index] = { ...currentLinks[index], [field]: value };
        setUserData({ ...userData, customLinks: currentLinks });
    };

    return (
        <div className="animate-slide-up bg-brand-surface p-8 rounded-2xl border border-white/5">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-white flex items-center"><Building className="w-5 h-5 mr-2 text-brand-primary" /> Agency Profile</h2>
                <button onClick={onSave} disabled={saving || uploadingLogo || uploadingGallery} className="flex items-center px-4 py-2 bg-brand-primary text-white text-sm font-bold rounded-lg hover:bg-brand-accent disabled:opacity-50">
                    <Save className="w-4 h-4 mr-2" /> {saving ? "Saving..." : "Save Changes"}
                </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2 flex items-center gap-6 mb-4">
                    <div className="w-24 h-24 bg-white/5 rounded-full overflow-hidden border border-white/10 flex-shrink-0">
                        {userData.photoUrl ? <OptimizedImage src={userData.photoUrl} variant="avatar" className="w-full h-full object-cover" alt={userData.displayName || 'Agency'} /> : <Building className="w-10 h-10 text-brand-muted m-auto h-full" />}
                    </div>
                    <div>
                        <label className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm text-white cursor-pointer transition-colors block w-fit">
                            {uploadingLogo ? <span className="flex items-center"><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading</span> : 'Upload Agency Logo'}
                            <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploadingLogo} />
                        </label>
                    </div>
                </div>

                <div className="md:col-span-2">
                    <AppearanceSettings />
                </div>

                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm text-brand-muted">Agency Name</label>
                        {nameLock.locked && <span className="text-[11px] font-bold text-brand-primary">{nameLock.label}</span>}
                    </div>
                    <input 
                        className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:border-brand-primary focus:outline-none disabled:opacity-60"
                        value={userData.displayName || ''}
                        disabled={nameLock.locked}
                        onChange={e => setUserData({...userData, displayName: e.target.value})}
                    />
                </div>

                <div>
                    <label className="block text-sm text-brand-muted mb-2">Website</label>
                    <div className="relative">
                        <Globe className="absolute left-3 top-3.5 w-4 h-4 text-brand-muted" />
                        <input 
                            className="w-full bg-black/20 border border-white/10 rounded-lg pl-10 pr-3 py-3 text-white focus:border-brand-primary focus:outline-none"
                            placeholder="https://agency.com"
                            value={userData.website || ''} 
                            onChange={e => setUserData({...userData, website: e.target.value})} 
                        />
                    </div>
                </div>

                <div className="md:col-span-2">
                    <label className="block text-sm text-brand-muted mb-2 flex items-center"><FileText className="w-4 h-4 mr-2" /> Agency Bio / Description</label>
                    <textarea 
                        className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:border-brand-primary focus:outline-none resize-none h-32"
                        placeholder="Tell models and clients about your agency, your vision, and what you represent..."
                        value={userData.bio || ''}
                        onChange={e => setUserData({...userData, bio: e.target.value})}
                    />
                </div>

                <div className="md:col-span-2">
                    <label className="block text-sm text-brand-muted mb-4 flex items-center justify-between">
                        <span className="flex items-center"><ImageIcon className="w-4 h-4 mr-2" /> Gallery (Team, Events, Campaigns)</span>
                        <span className="text-xs font-normal opacity-70">These appear on your public profile</span>
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {userData.gallery?.map((img, idx) => (
                            <div key={idx} className="relative aspect-video rounded-lg overflow-hidden group border border-white/10">
                                <OptimizedImage src={img} variant="gallery" className="w-full h-full object-cover" alt={`Agency gallery ${idx + 1}`} />
                                <button 
                                    onClick={() => removeGalleryImage(idx)}
                                    className="absolute top-1 right-1 p-1 bg-red-500 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                        <label className="aspect-video rounded-lg border-2 border-dashed border-white/10 flex flex-col items-center justify-center cursor-pointer hover:border-brand-primary/50 hover:bg-brand-primary/5 transition-colors text-brand-muted hover:text-brand-primary">
                            {uploadingGallery ? <Loader2 className="w-6 h-6 mb-1 animate-spin" /> : <Camera className="w-6 h-6 mb-1" />}
                            <span className="text-xs font-bold">{uploadingGallery ? 'Uploading' : 'Add Photo'}</span>
                            <input type="file" accept="image/*" className="hidden" onChange={handleGalleryUpload} disabled={uploadingGallery} />
                        </label>
                    </div>
                </div>
                
                <div className="md:col-span-2 border-t border-white/10 pt-4 mt-2">
                    <h3 className="text-sm font-bold text-white mb-4 flex items-center">
                        <Phone className="w-4 h-4 mr-2 text-green-500" /> 
                        Public Contact & Socials
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div>
                            <label className="block text-sm text-brand-muted mb-2">Business Phone / WhatsApp</label>
                            <input className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:border-brand-primary focus:outline-none" placeholder="+265 999..." value={userData.contact?.whatsapp || ''} onChange={e => setUserData({...userData, contact: {...userData.contact, whatsapp: e.target.value}})} />
                        </div>
                        <div>
                            <label className="block text-sm text-brand-muted mb-2">Business Email</label>
                            <input className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:border-brand-primary focus:outline-none" placeholder="booking@agency.com" value={userData.contact?.publicEmail || ''} onChange={e => setUserData({...userData, contact: {...userData.contact, publicEmail: e.target.value}})} />
                        </div>
                        <div>
                            <label className="block text-sm text-brand-muted mb-2">Instagram Handle</label>
                            <input className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:border-brand-primary focus:outline-none" placeholder="@agency_official" value={userData.contact?.instagram || ''} onChange={e => setUserData({...userData, contact: {...userData.contact, instagram: e.target.value}})} />
                        </div>
                    </div>

                    {/* Dynamic Links Section */}
                    <div>
                        <label className="block text-sm text-brand-muted mb-2 font-bold flex items-center justify-between">
                            <span>Additional Social Links</span>
                            <button onClick={addCustomLink} className="text-xs text-brand-primary hover:text-white flex items-center">
                                <Plus className="w-3 h-3 mr-1" /> Add Link
                            </button>
                        </label>
                        <div className="space-y-3">
                            {userData.customLinks?.map((link, idx) => (
                                <div key={idx} className="flex gap-3 items-center">
                                    <input 
                                        placeholder="Platform (e.g. TikTok)"
                                        className="w-1/3 bg-black/20 border border-white/10 rounded-lg p-2.5 text-sm text-white focus:border-brand-primary focus:outline-none"
                                        value={link.platform}
                                        onChange={e => updateCustomLink(idx, 'platform', e.target.value)}
                                    />
                                    <div className="relative flex-grow">
                                        <LinkIcon className="absolute left-3 top-2.5 w-4 h-4 text-brand-muted" />
                                        <input 
                                            placeholder="URL (e.g. https://tiktok.com/@user)"
                                            className="w-full bg-black/20 border border-white/10 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white focus:border-brand-primary focus:outline-none"
                                            value={link.url}
                                            onChange={e => updateCustomLink(idx, 'url', e.target.value)}
                                        />
                                    </div>
                                    <button 
                                        onClick={() => removeCustomLink(idx)}
                                        className="p-2.5 bg-white/5 text-brand-muted hover:bg-red-500/10 hover:text-red-500 rounded-lg transition-colors"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                            {(!userData.customLinks || userData.customLinks.length === 0) && (
                                <div className="text-xs text-brand-muted italic p-2 border border-white/5 border-dashed rounded-lg text-center">
                                    No custom links added yet. Add TikTok, YouTube, or other profiles here.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AgencyProfileSettings;
