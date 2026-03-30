import React from 'react';
import { useStore } from '../store/useStore';
import { useAuthStore } from '../store/authStore';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { FileText, CheckCircle, Clock, XCircle, FilePlus, LayoutDashboard } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { cn } from '../utils/cn';

export function Dashboard() {
  const { documents, templates, departments } = useStore();
  const { profile, user, isAdmin } = useAuthStore();

  const userDeptId = departments.find(d => d.id === profile?.department || d.name === profile?.department)?.id || profile?.department;
  const userDocs = isAdmin || profile?.role.includes('Approver') 
    ? documents.filter(d => isAdmin || !profile?.department || d.departmentId === userDeptId)
    : documents.filter(d => d.creatorId === profile?.uid);

  const stats = [
    { 
      title: 'Total Documents', 
      value: userDocs.length, 
      icon: FileText, 
      color: 'text-blue-600', 
      bg: 'bg-blue-100' 
    },
    { 
      title: 'Pending Approvals', 
      value: userDocs.filter(d => d.status.includes('Approved Level') || d.status === 'Submitted').length, 
      icon: Clock, 
      color: 'text-amber-600', 
      bg: 'bg-amber-100' 
    },
    { 
      title: 'Final Approved', 
      value: userDocs.filter(d => d.status === 'Final Approved').length, 
      icon: CheckCircle, 
      color: 'text-emerald-600', 
      bg: 'bg-emerald-100' 
    },
    { 
      title: 'Rejected', 
      value: userDocs.filter(d => d.status === 'Rejected').length, 
      icon: XCircle, 
      color: 'text-red-600', 
      bg: 'bg-red-100' 
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard</h1>
        <p className="text-slate-500">Welcome back, {profile?.fullName || user?.email}. Here's an overview of your documents.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <Card key={i}>
            <CardContent className="p-6 flex items-center space-x-4">
              <div className={cn("p-3 rounded-xl", stat.bg)}>
                <stat.icon className={cn("w-6 h-6", stat.color)} />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">{stat.title}</p>
                <h3 className="text-2xl font-bold text-slate-900">{stat.value}</h3>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Documents</CardTitle>
          </CardHeader>
          <CardContent>
            {userDocs.length === 0 ? (
              <div className="text-center py-8 text-slate-500">No documents found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 font-medium">Serial No.</th>
                      <th className="px-4 py-3 font-medium">Title</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userDocs.slice(0, 5).map((doc, index) => (
                      <tr key={doc.id || index} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-indigo-600">
                          <Link to={`/documents/${doc.id}`}>{doc.serialNumber}</Link>
                        </td>
                        <td className="px-4 py-3 text-slate-900">{doc.title}</td>
                        <td className="px-4 py-3">
                          <span className={cn(
                            "px-2.5 py-1 text-xs font-medium rounded-full",
                            doc.status === 'Final Approved' ? 'bg-emerald-100 text-emerald-700' :
                            doc.status === 'Rejected' ? 'bg-red-100 text-red-700' :
                            doc.status === 'Draft' ? 'bg-slate-100 text-slate-700' :
                            'bg-amber-100 text-amber-700'
                          )}>
                            {doc.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {format(new Date(doc.createdAt), 'MMM d, yyyy')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link to="/documents/new" className="flex items-center p-3 text-sm font-medium text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors">
              <FilePlus className="w-5 h-5 mr-3" />
              Create New Document
            </Link>
            {isAdmin && (
              <Link to="/templates/new" className="flex items-center p-3 text-sm font-medium text-slate-700 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                <LayoutDashboard className="w-5 h-5 mr-3" />
                Create New Template
              </Link>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
