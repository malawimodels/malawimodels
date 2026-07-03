import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Search, HelpCircle, FileText, DollarSign, User } from 'lucide-react';

const faqs = [
  {
    category: 'General',
    question: 'How do I join Malawi Models?',
    answer: 'Joining is free! Click the "Sign Up" button in the top right corner. Select "As Talent" if you are a model or agency, or "As Client" if you are looking to book talent.'
  },
  {
    category: 'For Models',
    question: 'How does the ranking system work?',
    answer: 'Our algorithm ranks models based on profile completeness, recent activity, response rate, and verified status. Partner agencies also receive visibility boosts.'
  },
  {
    category: 'For Models',
    question: 'Is it free to create a portfolio?',
    answer: 'Yes, the basic portfolio is completely free. We may offer premium features in the future for enhanced visibility.'
  },
  {
    category: 'For Clients',
    question: 'How do I book a model?',
    answer: 'You can browse talent and add them to a shortlist, or post a "Casting Call" detailing your project. Once you find the right fit, you can send a booking request directly through the platform.'
  },
  {
    category: 'Safety',
    question: 'Are the models verified?',
    answer: 'We have a verification process indicated by a blue checkmark. This confirms the identity and agency affiliation of the talent.'
  }
];

const HelpCenter: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredFaqs = faqs.filter(f => 
    f.question.toLowerCase().includes(searchTerm.toLowerCase()) || 
    f.answer.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-brand-bg px-4 sm:px-6 lg:px-8 py-10">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12 animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-primary/10 text-brand-primary mb-6">
            <HelpCircle className="w-8 h-8" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">How can we help?</h1>
          <p className="text-brand-muted text-lg">Search our knowledge base or browse common questions below.</p>
          
          <div className="mt-8 relative max-w-xl mx-auto">
            <input 
              type="text" 
              placeholder="Search for answers..." 
              className="w-full pl-12 pr-4 py-4 bg-brand-surface border border-white/10 rounded-xl text-white focus:border-brand-primary focus:outline-none transition-colors shadow-lg"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search className="absolute left-4 top-4.5 text-brand-muted w-5 h-5" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
           <div className="bg-brand-surface p-6 rounded-xl border border-white/5 hover:border-brand-primary/30 transition-colors text-center group cursor-pointer">
              <User className="w-8 h-8 text-brand-primary mx-auto mb-3 group-hover:scale-110 transition-transform" />
              <h3 className="text-white font-bold">Account Guide</h3>
           </div>
           <div className="bg-brand-surface p-6 rounded-xl border border-white/5 hover:border-brand-primary/30 transition-colors text-center group cursor-pointer">
              <FileText className="w-8 h-8 text-blue-500 mx-auto mb-3 group-hover:scale-110 transition-transform" />
              <h3 className="text-white font-bold">Booking Process</h3>
           </div>
           <div className="bg-brand-surface p-6 rounded-xl border border-white/5 hover:border-brand-primary/30 transition-colors text-center group cursor-pointer">
              <DollarSign className="w-8 h-8 text-green-500 mx-auto mb-3 group-hover:scale-110 transition-transform" />
              <h3 className="text-white font-bold">Payments & Rates</h3>
           </div>
        </div>

        <div className="bg-brand-surface border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
           {filteredFaqs.length > 0 ? (
             filteredFaqs.map((faq, idx) => (
               <div key={idx} className="border-b border-white/5 last:border-0">
                 <button 
                   onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
                   className="w-full flex items-center justify-between p-6 text-left hover:bg-white/5 transition-colors"
                 >
                   <div>
                     <span className="text-xs font-bold text-brand-primary uppercase tracking-wider mb-1 block">{faq.category}</span>
                     <span className="text-lg font-medium text-white">{faq.question}</span>
                   </div>
                   {openIndex === idx ? <ChevronUp className="w-5 h-5 text-brand-muted" /> : <ChevronDown className="w-5 h-5 text-brand-muted" />}
                 </button>
                 {openIndex === idx && (
                   <div className="px-6 pb-6 text-brand-muted leading-relaxed animate-fade-in">
                     {faq.answer}
                   </div>
                 )}
               </div>
             ))
           ) : (
             <div className="p-12 text-center text-brand-muted">
               No results found for "{searchTerm}". Try contacting support.
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default HelpCenter;