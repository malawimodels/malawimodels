
import React, { useMemo, useState } from 'react';
import { UserData } from '../../types';
import { Save, Briefcase, Phone, Loader2 } from 'lucide-react';
import { uploadImage } from '../../services/cloudinary';
import { useNotification } from '../NotificationSystem';
import AppearanceSettings from '../AppearanceSettings';
import OptimizedImage from '../OptimizedImage';

interface ClientProfileSettingsProps {
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

const ClientProfileSettings: React.FC<ClientProfileSettingsProps> = ({ userData, setUserData, onSave, saving }) => {
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const { addNotification } = useNotification();
    const nameLock = useMemo(() => getDisplayNameLock(userData.displayNameChangedAt), [userData.displayNameChangedAt]);
    
    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            try {
                setUploadingLogo(true);
                const uploaded = await uploadImage(file, 'profile');
                setUserData({ ...userData, photoUrl: uploaded.url });
            } catch (err) {
                addNotification('error', err instanceof Error ? err.message : 'Image upload failed.');
            } finally {
                setUploadingLogo(false);
                e.target.value = '';
            }
        }
    };

    return (
        <div className="animate-slide-up bg-brand-surface p-8 rounded-2xl border border-white/5">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-white">Client Profile Settings</h2>
                <button onClick={onSave} disabled={saving || uploadingLogo} className="flex items-center px-4 py-2 bg-brand-primary text-white text-sm font-bold rounded-lg hover:bg-brand-accent disabled:opacity-50">
                    <Save className="w-4 h-4 mr-2" /> {saving ? "Saving..." : "Save Changes"}
                </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2 flex items-center gap-6 mb-4">
                    <div className="w-24 h-24 bg-white/5 rounded-full overflow-hidden border border-white/10 flex-shrink-0">
                        {userData.photoUrl ? <OptimizedImage src={userData.photoUrl} variant="avatar" className="w-full h-full object-cover" alt={userData.displayName || 'Client'} /> : <Briefcase className="w-10 h-10 text-brand-muted m-auto h-full" />}
                    </div>
                    <div>
                        <label className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm text-white cursor-pointer transition-colors block w-fit">
                            {uploadingLogo ? <span className="flex items-center"><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading</span> : 'Upload Logo'}
                            <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploadingLogo} />
                        </label>
                    </div>
                </div>

                <div className="md:col-span-2">
                    <AppearanceSettings />
                </div>

                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm text-brand-muted">Display Name / Company</label>
                        {nameLock.locked && <span className="text-[11px] font-bold text-brand-primary">{nameLock.label}</span>}
                    </div>
                    <input 
                        className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:border-brand-primary focus:outline-none disabled:opacity-60"
                        value={userData.displayName || ''}
                        disabled={nameLock.locked}
                        onChange={e => setUserData({...userData, displayName: e.target.value})}
                    />
                </div>

                {/* Added Industry Field as requested functionality */}
                <div>
                    <label className="block text-sm text-brand-muted mb-2">Industry / Sector</label>
                    <select 
                        className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:border-brand-primary focus:outline-none"
                        value={userData.contact?.facebook || ''} // Using facebook field as a placeholder for Industry for now to avoid schema break, or just generic text
                        onChange={e => setUserData({...userData, contact: {...userData.contact, facebook: e.target.value}})} 
                    >
                        <option value="">Select Industry</option>
                        <option value="Fashion">Fashion & Apparel</option>
                        <option value="Media">Media & Entertainment</option>
                        <option value="Advertising">Advertising & Marketing</option>
                        <option value="Corporate">Corporate</option>
                        <option value="Event">Event Management</option>
                    </select>
                </div>
                
                <div className="md:col-span-2 border-t border-white/10 pt-4 mt-2">
                    <h3 className="text-sm font-bold text-white mb-4 flex items-center">
                        <Phone className="w-4 h-4 mr-2 text-green-500" /> 
                        Contact Information <span className="text-xs font-normal text-brand-muted ml-2">(Shared with models only after booking confirmation)</span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-brand-muted mb-2">WhatsApp / Phone</label>
                            <input className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:border-brand-primary focus:outline-none" placeholder="+265 999..." value={userData.contact?.whatsapp || ''} onChange={e => setUserData({...userData, contact: {...userData.contact, whatsapp: e.target.value}})} />
                        </div>
                        <div>
                            <label className="block text-sm text-brand-muted mb-2">Email</label>
                            <input className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:border-brand-primary focus:outline-none" placeholder="contact@company.com" value={userData.contact?.publicEmail || ''} onChange={e => setUserData({...userData, contact: {...userData.contact, publicEmail: e.target.value}})} />
                        </div>
                        <div>
                            <label className="block text-sm text-brand-muted mb-2">Instagram</label>
                            <input className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:border-brand-primary focus:outline-none" placeholder="@company" value={userData.contact?.instagram || ''} onChange={e => setUserData({...userData, contact: {...userData.contact, instagram: e.target.value}})} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ClientProfileSettings;
