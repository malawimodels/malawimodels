
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { submitAgencyRequest, getModelProfile } from '../services/supabase.service';
import { uploadImage, uploadImages } from '../services/cloudinary';
import { Building, Camera, Upload, Instagram, Facebook, Video, Users, CheckCircle, ArrowLeft, Loader2 } from 'lucide-react';
import { useNotification } from '../components/NotificationSystem';
import { District } from '../types';
import OptimizedImage from '../components/OptimizedImage';

const AgencyRegistration: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { addNotification } = useNotification();
  const [loading, setLoading] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

  const [formData, setFormData] = useState({
    agencyName: '',
    location: '',
    whatsapp: '',
    bio: '',
    memberCount: { male: 0, female: 0 },
    socialLinks: {
      tiktok: '',
      facebook: '',
      instagram: ''
    },
    logoUrl: '',
    modelPhotos: [] as string[]
  });

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        setUploadingLogo(true);
        const uploaded = await uploadImage(file, 'agency-logo');
        setFormData({ ...formData, logoUrl: uploaded.url });
      } catch (err) {
        addNotification('error', err instanceof Error ? err.message : "Failed to upload logo.");
      } finally {
        setUploadingLogo(false);
        e.target.value = '';
      }
    }
  };

  const handleModelPhotosUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files) as File[];
      if (files.length + formData.modelPhotos.length > 6) {
        addNotification('info', "Maximum 6 photos allowed.");
        return;
      }
      
      try {
        setUploadingPhotos(true);
        const uploadedImages = await uploadImages(files, 'gallery');
        setFormData(prev => ({
          ...prev,
          modelPhotos: [...prev.modelPhotos, ...uploadedImages.map(img => img.url)]
        }));
      } catch (err) {
        addNotification('error', err instanceof Error ? err.message : "Failed to upload images.");
      } finally {
        setUploadingPhotos(false);
        e.target.value = '';
      }
    }
  };

  const removePhoto = (index: number) => {
    setFormData(prev => ({
      ...prev,
      modelPhotos: prev.modelPhotos.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
        addNotification('error', "You must be logged in to apply.");
        return;
    }
    if (!formData.logoUrl) {
        addNotification('error', "Agency logo is required.");
        return;
    }
    if (formData.modelPhotos.length === 0) {
        addNotification('error', "Please upload at least one photo of your models.");
        return;
    }

    setLoading(true);
    try {
      // Get applicant current display name as fallback
      const profile = await getModelProfile(user.uid);
      
      await submitAgencyRequest({
        uid: user.uid,
        applicantName: profile?.displayName || user.email || 'Applicant',
        agencyName: formData.agencyName,
        logoUrl: formData.logoUrl,
        whatsapp: formData.whatsapp,
        bio: formData.bio,
        location: formData.location,
        memberCount: formData.memberCount,
        socialLinks: formData.socialLinks,
        modelPhotos: formData.modelPhotos,
        socialLink: formData.socialLinks.instagram || '', // Backward compatibility
      });

      addNotification('success', "Application submitted successfully! Our admins will review it shortly.");
      navigate('/dashboard');
    } catch (error) {
      console.error(error);
      addNotification('error', "Failed to submit application.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg px-4 sm:px-6 lg:px-8 py-10">
      <div className="max-w-3xl mx-auto">
        <button onClick={() => navigate('/dashboard')} className="flex items-center text-brand-muted hover:text-white mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
        </button>

        <div className="bg-brand-surface border border-white/10 rounded-2xl p-8 shadow-2xl animate-fade-in">
          <div className="flex items-center mb-8 border-b border-white/10 pb-6">
            <div className="w-12 h-12 bg-brand-primary/10 rounded-xl flex items-center justify-center mr-4">
              <Building className="w-6 h-6 text-brand-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Agency Registration</h1>
              <p className="text-brand-muted text-sm">Submit your agency details for verification.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            
            {/* Logo Upload */}
            <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-white/10 rounded-xl bg-black/20">
                <div className="relative group cursor-pointer">
                    <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-brand-surface shadow-lg bg-white/5 flex items-center justify-center">
                        {formData.logoUrl ? (
                            <OptimizedImage src={formData.logoUrl} variant="avatar" className="w-full h-full object-cover" alt="Logo" />
                        ) : (
                            <Camera className="w-10 h-10 text-brand-muted" />
                        )}
                    </div>
                    <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-full text-white text-xs font-bold cursor-pointer">
                        {uploadingLogo ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Change Logo'}
                        <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploadingLogo} />
                    </label>
                </div>
                <p className="text-brand-muted text-xs mt-3">Upload Agency Logo (Required)</p>
            </div>

            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm font-bold text-brand-muted mb-2">Agency Name</label>
                    <input 
                        required
                        className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:border-brand-primary focus:outline-none"
                        value={formData.agencyName}
                        onChange={e => setFormData({...formData, agencyName: e.target.value})}
                    />
                </div>
                <div>
                    <label className="block text-sm font-bold text-brand-muted mb-2">Location / Base</label>
                    <select 
                        required
                        className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:border-brand-primary focus:outline-none"
                        value={formData.location}
                        onChange={e => setFormData({...formData, location: e.target.value})}
                    >
                        <option value="">Select District</option>
                        {Object.values(District).map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                </div>
            </div>

            {/* Member Stats */}
            <div>
                <label className="block text-sm font-bold text-brand-muted mb-2 flex items-center"><Users className="w-4 h-4 mr-2" /> Current Roster Count</label>
                <div className="grid grid-cols-2 gap-6">
                    <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                        <label className="block text-xs text-brand-muted mb-1 uppercase">Female Models</label>
                        <input 
                            type="number" min="0"
                            className="w-full bg-transparent text-2xl font-bold text-white focus:outline-none"
                            value={formData.memberCount.female}
                            onChange={e => setFormData({...formData, memberCount: {...formData.memberCount, female: parseInt(e.target.value) || 0}})}
                        />
                    </div>
                    <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                        <label className="block text-xs text-brand-muted mb-1 uppercase">Male Models</label>
                        <input 
                            type="number" min="0"
                            className="w-full bg-transparent text-2xl font-bold text-white focus:outline-none"
                            value={formData.memberCount.male}
                            onChange={e => setFormData({...formData, memberCount: {...formData.memberCount, male: parseInt(e.target.value) || 0}})}
                        />
                    </div>
                </div>
            </div>

            {/* Social Links */}
            <div className="bg-white/5 p-6 rounded-xl border border-white/5">
                <h3 className="text-sm font-bold text-white mb-4">Social Media Presence</h3>
                <div className="space-y-4">
                    <div className="flex items-center">
                        <div className="w-10 flex justify-center"><Instagram className="w-5 h-5 text-pink-500" /></div>
                        <input 
                            className="flex-grow bg-black/20 border border-white/10 rounded-lg p-2.5 text-sm text-white focus:border-brand-primary focus:outline-none"
                            placeholder="Instagram Link or Handle"
                            value={formData.socialLinks.instagram}
                            onChange={e => setFormData({...formData, socialLinks: {...formData.socialLinks, instagram: e.target.value}})}
                        />
                    </div>
                    <div className="flex items-center">
                        <div className="w-10 flex justify-center"><Facebook className="w-5 h-5 text-blue-500" /></div>
                        <input 
                            className="flex-grow bg-black/20 border border-white/10 rounded-lg p-2.5 text-sm text-white focus:border-brand-primary focus:outline-none"
                            placeholder="Facebook Page Link"
                            value={formData.socialLinks.facebook}
                            onChange={e => setFormData({...formData, socialLinks: {...formData.socialLinks, facebook: e.target.value}})}
                        />
                    </div>
                    <div className="flex items-center">
                        <div className="w-10 flex justify-center"><Video className="w-5 h-5 text-white" /></div>
                        <input 
                            className="flex-grow bg-black/20 border border-white/10 rounded-lg p-2.5 text-sm text-white focus:border-brand-primary focus:outline-none"
                            placeholder="TikTok Link"
                            value={formData.socialLinks.tiktok}
                            onChange={e => setFormData({...formData, socialLinks: {...formData.socialLinks, tiktok: e.target.value}})}
                        />
                    </div>
                </div>
            </div>

            {/* Model Photos Upload */}
            <div>
                <label className="block text-sm font-bold text-white mb-2">Showcase Your Talent</label>
                <p className="text-xs text-brand-muted mb-4">Upload up to 6 photos of your current models. This helps us verify your agency.</p>
                
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
                    {formData.modelPhotos.map((photo, index) => (
                        <div key={index} className="aspect-square rounded-lg overflow-hidden relative group border border-white/10">
                            <OptimizedImage src={photo} variant="avatar" className="w-full h-full object-cover" alt="Model" />
                            <button 
                                type="button"
                                onClick={() => removePhoto(index)}
                                className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                            </button>
                        </div>
                    ))}
                    {formData.modelPhotos.length < 6 && (
                        <label className="aspect-square rounded-lg border-2 border-dashed border-white/10 flex flex-col items-center justify-center cursor-pointer hover:border-brand-primary/50 hover:bg-white/5 transition-colors text-brand-muted">
                            {uploadingPhotos ? <Loader2 className="w-6 h-6 mb-1 animate-spin" /> : <Upload className="w-6 h-6 mb-1" />}
                            <span className="text-[10px] font-bold">{uploadingPhotos ? 'Uploading' : 'Add Photo'}</span>
                            <input type="file" accept="image/*" multiple className="hidden" onChange={handleModelPhotosUpload} disabled={uploadingPhotos} />
                        </label>
                    )}
                </div>
            </div>

            {/* Additional Info */}
            <div>
                <label className="block text-sm font-bold text-brand-muted mb-2">Contact WhatsApp</label>
                <input 
                    required
                    placeholder="+265..."
                    className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:border-brand-primary focus:outline-none mb-4"
                    value={formData.whatsapp}
                    onChange={e => setFormData({...formData, whatsapp: e.target.value})}
                />
                
                <label className="block text-sm font-bold text-brand-muted mb-2">Agency Bio</label>
                <textarea 
                    required
                    placeholder="Tell us about your agency, your vision, and history..."
                    className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:border-brand-primary focus:outline-none h-32 resize-none"
                    value={formData.bio}
                    onChange={e => setFormData({...formData, bio: e.target.value})}
                />
            </div>

            <button 
                type="submit" 
                disabled={loading || uploadingLogo || uploadingPhotos}
                className="w-full py-4 bg-brand-primary hover:bg-brand-accent text-white font-bold rounded-xl shadow-lg transition-all disabled:opacity-50 flex items-center justify-center"
            >
                {loading ? "Submitting..." : uploadingLogo || uploadingPhotos ? "Uploading files..." : "Submit Application"} <CheckCircle className="w-5 h-5 ml-2" />
            </button>

          </form>
        </div>
      </div>
    </div>
  );
};

export default AgencyRegistration;
