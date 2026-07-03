
import React from 'react';
import { Report, ReportStatus } from '../../types';
import { User, AlertOctagon, Ban, Check } from 'lucide-react';

interface AdminReportsProps {
    reports: Report[];
    onReview: (id: string) => void;
    onWarn: (userId: string, reportId: string) => void;
    onBlock: (userId: string, isBlocking: boolean) => void;
    onResolve: (id: string) => void;
}

const AdminReports: React.FC<AdminReportsProps> = ({ reports, onReview, onWarn, onBlock, onResolve }) => {
    
    return (
        <div className="space-y-4 animate-fade-in">
              {reports.length === 0 ? (
                  <div className="text-center py-20 bg-brand-surface rounded-xl border border-white/5 text-brand-muted">
                      No reports found.
                  </div>
              ) : (
                  reports.map(report => (
                      <div key={report.id} className="bg-brand-surface p-6 rounded-xl border border-white/5 flex flex-col md:flex-row gap-6 relative">
                          <div className="flex-grow">
                              <div className="flex items-center gap-3 mb-2">
                                  <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded border ${
                                      report.status === ReportStatus.PENDING ? 'bg-red-500/10 text-red-400 border-red-500/20' : 
                                      report.status === ReportStatus.RESOLVED ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                                      'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                                  }`}>
                                      {report.status}
                                  </span>
                                  <span className="text-xs text-brand-muted">{new Date(report.createdAt).toLocaleString()}</span>
                              </div>
                              <h3 className="text-lg font-bold text-white mb-1">
                                  Reported: {report.reason}
                              </h3>
                              <div className="grid grid-cols-2 gap-4 my-3 text-sm">
                                  <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                                      <div className="text-[10px] uppercase text-brand-muted font-bold">Reporter</div>
                                      <div className="text-white flex items-center mt-1">
                                          <User className="w-3 h-3 mr-1" /> {report.reporterRole} ({report.reporterId.substring(0,6)}...)
                                      </div>
                                  </div>
                                  <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                                      <div className="text-[10px] uppercase text-brand-muted font-bold">Target User</div>
                                      <div className="text-white flex items-center mt-1">
                                          <User className="w-3 h-3 mr-1" /> {report.reportedUserRole} ({report.reportedUserId.substring(0,6)}...)
                                      </div>
                                  </div>
                              </div>
                              <p className="text-brand-muted text-sm bg-black/20 p-3 rounded-lg border border-white/5">
                                  "{report.details}"
                              </p>
                          </div>
                          <div className="flex flex-col gap-2 justify-center min-w-[150px]">
                              {report.status === ReportStatus.PENDING && (
                                  <button 
                                    onClick={() => onReview(report.id)}
                                    className="px-4 py-2 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 rounded-lg transition-all font-bold text-sm"
                                  >
                                      Mark Reviewed
                                  </button>
                              )}
                              <button 
                                onClick={() => onWarn(report.reportedUserId, report.id)}
                                className="px-4 py-2 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 rounded-lg transition-all font-bold text-sm flex items-center justify-center"
                              >
                                  <AlertOctagon className="w-4 h-4 mr-2" /> Send Warning
                              </button>
                              <button 
                                onClick={() => onBlock(report.reportedUserId, true)}
                                className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-all font-bold text-sm flex items-center justify-center"
                              >
                                  <Ban className="w-4 h-4 mr-2" /> Block User
                              </button>
                              {report.status !== ReportStatus.RESOLVED && (
                                  <button 
                                    onClick={() => onResolve(report.id)}
                                    className="px-4 py-2 bg-green-500/10 hover:bg-green-500/20 text-green-400 rounded-lg transition-all font-bold text-sm flex items-center justify-center"
                                  >
                                      <Check className="w-4 h-4 mr-2" /> Resolve
                                  </button>
                              )}
                          </div>
                      </div>
                  ))
              )}
        </div>
    );
};

export default AdminReports;
