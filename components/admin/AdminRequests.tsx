
import React, { useState } from 'react';
import { AgencyRequest } from '../../types';
import { MessageCircle, ExternalLink, CheckCircle, X, Facebook, Instagram, Video, MapPin, Users, ChevronDown, ChevronUp } from 'lucide-react';
import OptimizedImage from '../OptimizedImage';

interface AdminRequestsProps {
    requests: AgencyRequest[];
    onApprove: (req: AgencyRequest) => void;
    onReject: (id: string) => void;
}

const AdminRequests: React.FC<AdminRequestsProps> = ({ requests, onApprove, onReject }) => {
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const toggleExpand = (id: string) => {
        setExpandedId(expandedId === id ? null : id);
    };

    return (
        <div className="space-y-4 animate-fade-in">
            {requests.length === 0 ? (
                <div className="text-center py-10 bg-brand-surface rounded-xl border border-white/5 text-brand-muted">
                    No pending agency requests.
                </div>
            ) : (
                requests.map(req => (
                    <div key={req.id} className="bg-brand-surface rounded-xl border border-white/5 overflow-hidden transition-all">
                        {/* Summary Header */}
                        <div 
                            className="p-6 flex flex-col md:flex-row gap-6 cursor-pointer hover:bg-white/5"
                            onClick={() => toggleExpand(req.id)}
                        >
                            <div className="w-16 h-16 bg-black/20 rounded-xl overflow-hidden flex-shrink-0 border border-white/10 mx-auto md:mx-0">
                                <OptimizedImage src={req.logoUrl} variant="avatar" alt="Logo" className="w-full h-full object-cover" />
                            </div>
                            <div className="flex-grow text-center md:text-left">
                                <h3 className="text-xl font-bold text-white mb-1">{req.agencyName}</h3>
                                <div className="text-sm text-brand-muted flex flex-col md:flex-row gap-2 md:gap-4 items-center md:items-start">
                                    <span>Applicant: {req.applicantName}</span>
                                    <span className="hidden md:inline">•</span>
                                    <span className="flex items-center"><MapPin className="w-3 h-3 mr-1" /> {req.location || 'Unknown'}</span>
                                    <span className="hidden md:inline">•</span>
                                    <span className="text-xs bg-brand-primary/10 text-brand-primary px-2 py-0.5 rounded">
                                        {new Date(req.createdAt).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center justify-center">
                                {expandedId === req.id ? <ChevronUp className="w-6 h-6 text-brand-muted" /> : <ChevronDown className="w-6 h-6 text-brand-muted" />}
                            </div>
                        </div>

                        {/* Expanded Details */}
                        {expandedId === req.id && (
                            <div className="bg-black/20 border-t border-white/10 p-6 animate-fade-in">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
                                    <div>
                                        <h4 className="text-xs font-bold text-brand-muted uppercase mb-3">Agency Details</h4>
                                        <div className="bg-white/5 p-4 rounded-xl space-y-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-brand-muted flex items-center"><Users className="w-4 h-4 mr-2" /> Members</span>
                                                <div className="text-sm font-bold text-white">
                                                    {req.memberCount ? (
                                                        <>M: {req.memberCount.male} | F: {req.memberCount.female}</>
                                                    ) : 'N/A'}
                                                </div>
                                            </div>
                                            <div className="border-t border-white/5 my-2"></div>
                                            {req.whatsapp && (
                                                <a href={`https://wa.me/${req.whatsapp.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" className="flex items-center text-sm text-green-400 hover:text-green-300">
                                                    <MessageCircle className="w-4 h-4 mr-2" /> {req.whatsapp}
                                                </a>
                                            )}
                                            {/* Legacy Social Link */}
                                            {req.socialLink && !req.socialLinks && (
                                                <a href={req.socialLink} target="_blank" rel="noreferrer" className="flex items-center text-sm text-blue-400 hover:text-blue-300">
                                                    <ExternalLink className="w-4 h-4 mr-2" /> Social Profile
                                                </a>
                                            )}
                                            {/* New Social Links */}
                                            {req.socialLinks && (
                                                <div className="flex gap-3 pt-2">
                                                    {req.socialLinks.instagram && (
                                                        <a href={req.socialLinks.instagram} target="_blank" className="p-2 bg-black/30 rounded-lg hover:text-pink-500 transition-colors"><Instagram className="w-4 h-4" /></a>
                                                    )}
                                                    {req.socialLinks.facebook && (
                                                        <a href={req.socialLinks.facebook} target="_blank" className="p-2 bg-black/30 rounded-lg hover:text-blue-500 transition-colors"><Facebook className="w-4 h-4" /></a>
                                                    )}
                                                    {req.socialLinks.tiktok && (
                                                        <a href={req.socialLinks.tiktok} target="_blank" className="p-2 bg-black/30 rounded-lg hover:text-white transition-colors"><Video className="w-4 h-4" /></a>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-bold text-brand-muted uppercase mb-3">Bio / Description</h4>
                                        <p className="text-brand-muted text-sm bg-white/5 p-4 rounded-xl border border-white/5 leading-relaxed h-full">
                                            {req.bio}
                                        </p>
                                    </div>
                                </div>

                                {req.modelPhotos && req.modelPhotos.length > 0 && (
                                    <div className="mb-8">
                                        <h4 className="text-xs font-bold text-brand-muted uppercase mb-3">Model Portfolio Showcase</h4>
                                        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                                            {req.modelPhotos.map((photo, idx) => (
                                                <div key={idx} className="aspect-square rounded-lg overflow-hidden bg-black/30 border border-white/5">
                                                    <OptimizedImage src={photo} variant="avatar" className="w-full h-full object-cover hover:scale-110 transition-transform duration-500" alt={`Model ${idx + 1}`} />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                                    <button 
                                        onClick={() => onReject(req.id)}
                                        className="px-6 py-2 bg-white/5 hover:bg-red-500/10 hover:text-red-500 text-brand-muted rounded-lg transition-all font-bold flex items-center"
                                    >
                                        <X className="w-4 h-4 mr-2" /> Reject
                                    </button>
                                    <button 
                                        onClick={() => onApprove(req)}
                                        className="px-6 py-2 bg-brand-primary hover:bg-brand-accent text-white rounded-lg transition-all font-bold flex items-center shadow-lg"
                                    >
                                        <CheckCircle className="w-4 h-4 mr-2" /> Approve Agency
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ))
            )}
        </div>
    );
};

export default AdminRequests;
