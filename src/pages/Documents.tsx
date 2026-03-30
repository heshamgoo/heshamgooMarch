import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Plus, Search, Filter } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { cn } from '../utils/cn';

export function Documents() {
  const { documents, departments } = useStore();
  const { profile, isAdmin } = useAuthStore();
  const { settings } = useSettingsStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [departmentFilter, setDepartmentFilter] = useState('All');

  useEffect(() => {
    const deptId = searchParams.get('deptId');
    if (deptId) {
      setDepartmentFilter(deptId);
    } else {
      setDepartmentFilter('All');
    }
  }, [searchParams]);

  const depts = departments;

  const userDocs = isAdmin || profile?.role.includes('Approver') 
    ? documents 
    : documents.filter(d => d.creatorId === profile?.uid);

  const filteredDocs = userDocs.filter(doc => {
    const matchesSearch = doc.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          doc.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All' || doc.status === statusFilter;
    const matchesDepartment = departmentFilter === 'All' || doc.departmentId === departmentFilter;
    const userDeptId = departments.find(d => d.id === profile?.department || d.name === profile?.department)?.id || profile?.department;
    const matchesUserDept = isAdmin || !profile?.department || doc.departmentId === userDeptId;
    return matchesSearch && matchesStatus && matchesDepartment && matchesUserDept;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Documents</h1>
          <p className="text-slate-500">Manage and track your document requests.</p>
        </div>
        <Button onClick={() => navigate('/documents/new')} className="flex items-center">
          <Plus className="w-4 h-4 mr-2" />
          Create Document
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-4 border-b border-slate-100">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by serial number or title..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex items-center space-x-2 w-full md:w-auto overflow-x-auto">
              <Filter className="w-4 h-4 text-slate-400 shrink-0" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="p-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 bg-white min-w-[140px]"
              >
                <option key="all" value="All">All Statuses</option>
                <option key="draft" value="Draft">Draft</option>
                <option key="submitted" value="Submitted">Submitted</option>
                <option key="approved1" value="Approved Level 1">Approved Level 1</option>
                <option key="approved2" value="Approved Level 2">Approved Level 2</option>
                <option key="final" value="Final Approved">Final Approved</option>
                <option key="rejected" value="Rejected">Rejected</option>
              </select>
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="p-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 bg-white min-w-[140px]"
              >
                <option key="all" value="All">All Departments</option>
                {depts
                  .filter(d => isAdmin || d.id === profile?.department || d.name === profile?.department)
                  .map((dept, index) => (
                    <option key={dept.id || index} value={dept.id}>{dept.name}</option>
                  ))}
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredDocs.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              No documents found matching your criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 font-medium">Serial No.</th>
                    <th className="px-6 py-4 font-medium">Title</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 font-medium">Created At</th>
                    <th className="px-6 py-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocs.map((doc, index) => (
                    <tr key={doc.id || index} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-indigo-600">
                        <Link to={`/documents/${doc.id}`}>{doc.serialNumber}</Link>
                      </td>
                      <td className="px-6 py-4 text-slate-900 font-medium">{doc.title}</td>
                      <td className="px-6 py-4">
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
                      <td className="px-6 py-4 text-slate-500">
                        {format(new Date(doc.createdAt), 'MMM d, yyyy HH:mm')}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button variant="ghost" size="sm" onClick={() => navigate(`/documents/${doc.id}`)}>
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
