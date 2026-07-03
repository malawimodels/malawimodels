import React from 'react';
import { Shield, Lock, CheckCircle, AlertTriangle, Eye, UserCheck } from 'lucide-react';

const SafetyTrust: React.FC = () => {
  return (
    <div className="min-h-screen bg-brand-bg px-4 sm:px-6 lg:px-8 py-10">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16 animate-fade-in">
           <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-500/10 text-green-500 mb-6 border border-green-500/20">
             <Shield className="w-10 h-10" />
           </div>
           <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">Trust & Safety First</h1>
           <p className="text-xl text-brand-muted max-w-2xl mx-auto">
             We are committed to building a secure, professional environment for Malawi's talent industry. Here is how we protect you.
           </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
           <div className="bg-brand-surface p-8 rounded-2xl border border-white/10 hover:border-brand-primary/30 transition-all">
              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center text-blue-400 mb-6">
                <CheckCircle className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Verified Profiles</h3>
              <p className="text-brand-muted leading-relaxed">
                Look for the blue checkmark. This indicates that a model or agency has undergone our identity verification process, ensuring you are booking real, professional talent.
              </p>
           </div>
           
           <div className="bg-brand-surface p-8 rounded-2xl border border-white/10 hover:border-brand-primary/30 transition-all">
              <div className="w-12 h-12 bg-brand-primary/20 rounded-xl flex items-center justify-center text-brand-primary mb-6">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Data Privacy</h3>
              <p className="text-brand-muted leading-relaxed">
                Your personal contact details are never exposed publicly. Initial communications happen through our secure platform to prevent spam and harassment.
              </p>
           </div>

           <div className="bg-brand-surface p-8 rounded-2xl border border-white/10 hover:border-brand-primary/30 transition-all">
              <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center text-purple-400 mb-6">
                <UserCheck className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Vetted Clients</h3>
              <p className="text-brand-muted leading-relaxed">
                Companies posting casting calls are reviewed to ensure legitimacy. We strictly prohibit any form of exploitation or unsafe working conditions.
              </p>
           </div>

           <div className="bg-brand-surface p-8 rounded-2xl border border-white/10 hover:border-brand-primary/30 transition-all">
              <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center text-red-400 mb-6">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Zero Tolerance Policy</h3>
              <p className="text-brand-muted leading-relaxed">
                We have a zero-tolerance policy towards harassment, discrimination, or scamming. Any account violating our code of conduct is immediately suspended.
              </p>
           </div>
        </div>

        <div className="bg-gradient-to-r from-brand-surface to-brand-bg border border-white/10 rounded-2xl p-8 md:p-12 text-center">
           <h3 className="text-2xl font-bold text-white mb-4">Need to report an issue?</h3>
           <p className="text-brand-muted mb-8 max-w-2xl mx-auto">
             If you encounter suspicious behavior or feel unsafe during a booking arranged through our platform, please report it immediately. Our support team is available 24/7.
           </p>
           <button className="px-8 py-3 bg-white text-black font-bold rounded-lg hover:bg-red-500 hover:text-white transition-all shadow-lg">
             Report an Incident
           </button>
        </div>
      </div>
    </div>
  );
};

export default SafetyTrust;