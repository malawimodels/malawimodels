import React, { useState } from 'react';
import { Mail, Phone, MapPin, Send, CheckCircle, MessageSquare } from 'lucide-react';

const Contact: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      setLoading(false);
      setSuccess(true);
      setFormData({ name: '', email: '', subject: '', message: '' });
      
      // Reset success message after 5 seconds
      setTimeout(() => setSuccess(false), 5000);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-brand-bg px-4 sm:px-6 lg:px-8 py-10">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12">
        
        {/* Contact Info */}
        <div className="animate-slide-up">
           <h1 className="text-4xl font-bold text-white mb-6">Get in touch</h1>
           <p className="text-xl text-brand-muted mb-10 leading-relaxed">
             Have questions about the platform? Interested in a partnership? 
             Our team is here to help you navigate Malawi's talent industry.
           </p>

           <div className="space-y-8">
              <div className="flex items-start">
                 <div className="w-12 h-12 bg-brand-surface rounded-xl flex items-center justify-center border border-white/10 text-brand-primary flex-shrink-0 mr-6">
                    <Mail className="w-6 h-6" />
                 </div>
                 <div>
                    <h3 className="text-lg font-bold text-white mb-1">Email Us</h3>
                    <p className="text-brand-muted mb-1">General Inquiries</p>
                    <a href="mailto:hello@malawimodels.com" className="text-brand-primary hover:underline">hello@malawimodels.com</a>
                 </div>
              </div>

              <div className="flex items-start">
                 <div className="w-12 h-12 bg-brand-surface rounded-xl flex items-center justify-center border border-white/10 text-brand-primary flex-shrink-0 mr-6">
                    <Phone className="w-6 h-6" />
                 </div>
                 <div>
                    <h3 className="text-lg font-bold text-white mb-1">Call Us</h3>
                    <p className="text-brand-muted mb-1">Mon-Fri from 8am to 5pm</p>
                    <a href="tel:+265999000000" className="text-brand-primary hover:underline">+265 999 000 000</a>
                 </div>
              </div>

              <div className="flex items-start">
                 <div className="w-12 h-12 bg-brand-surface rounded-xl flex items-center justify-center border border-white/10 text-brand-primary flex-shrink-0 mr-6">
                    <MapPin className="w-6 h-6" />
                 </div>
                 <div>
                    <h3 className="text-lg font-bold text-white mb-1">Office</h3>
                    <p className="text-brand-muted">
                      Area 14, Lilongwe<br/>
                      Malawi
                    </p>
                 </div>
              </div>
           </div>
        </div>

        {/* Form Card */}
        <div className="bg-brand-surface border border-white/10 rounded-2xl p-8 shadow-2xl animate-fade-in relative overflow-hidden">
           {success ? (
             <div className="absolute inset-0 flex flex-col items-center justify-center bg-brand-surface z-10 animate-fade-in">
                <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center text-white mb-6 shadow-lg shadow-green-500/30">
                   <CheckCircle className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">Message Sent!</h3>
                <p className="text-brand-muted text-center max-w-xs">Thank you for contacting us. We will get back to you within 24 hours.</p>
                <button 
                  onClick={() => setSuccess(false)}
                  className="mt-8 text-brand-primary hover:text-white font-medium"
                >
                  Send another message
                </button>
             </div>
           ) : null}

           <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
              <MessageSquare className="w-6 h-6 mr-3 text-brand-primary" />
              Send a Message
           </h2>
           
           <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div>
                    <label className="block text-sm font-medium text-brand-muted mb-2">Your Name</label>
                    <input 
                      type="text" required
                      className="w-full bg-brand-bg border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-primary focus:outline-none transition-colors"
                      placeholder="John Doe"
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                    />
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-brand-muted mb-2">Email Address</label>
                    <input 
                      type="email" required
                      className="w-full bg-brand-bg border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-primary focus:outline-none transition-colors"
                      placeholder="john@example.com"
                      value={formData.email}
                      onChange={e => setFormData({...formData, email: e.target.value})}
                    />
                 </div>
              </div>
              
              <div>
                 <label className="block text-sm font-medium text-brand-muted mb-2">Subject</label>
                 <select 
                    className="w-full bg-brand-bg border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-primary focus:outline-none transition-colors"
                    value={formData.subject}
                    onChange={e => setFormData({...formData, subject: e.target.value})}
                    required
                 >
                    <option value="" disabled>Select a topic</option>
                    <option value="General Inquiry">General Inquiry</option>
                    <option value="Partnership">Partnership / Agency</option>
                    <option value="Technical Support">Technical Support</option>
                    <option value="Report Issue">Report a Violation</option>
                 </select>
              </div>

              <div>
                 <label className="block text-sm font-medium text-brand-muted mb-2">Message</label>
                 <textarea 
                    required
                    className="w-full bg-brand-bg border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-primary focus:outline-none transition-colors h-32 resize-none"
                    placeholder="How can we help you?"
                    value={formData.message}
                    onChange={e => setFormData({...formData, message: e.target.value})}
                 />
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-brand-primary hover:bg-brand-accent text-white font-bold py-4 rounded-xl shadow-lg hover:shadow-brand-primary/25 transition-all flex items-center justify-center disabled:opacity-50"
              >
                 {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <><Send className="w-5 h-5 mr-2" /> Send Message</>}
              </button>
           </form>
        </div>
      </div>
    </div>
  );
};

export default Contact;