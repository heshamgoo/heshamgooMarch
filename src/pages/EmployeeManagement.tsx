import React, { useState, useEffect } from 'react';
import { useAuthStore, EmployeeProfile, AppRole, AppPermission } from '../store/authStore';
import { useStore } from '../store/useStore';
import { supabase, supabaseUrl, supabaseAnonKey } from '../supabase';
import { createClient } from '@supabase/supabase-js';
import { Plus, Trash2, Loader2, Users, Shield, ShieldAlert, Mail, User as UserIcon, Building, Edit2, Copy, CheckCircle2, Info, Lock, Search, Filter, Phone, Activity } from 'lucide-react';
import { cn } from '../utils/cn';

export function EmployeeManagement() {
  const { isAdmin, profile } = useAuthStore();
  const { departments } = useStore();
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<EmployeeProfile | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  
  // Filters and Search
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  // Form state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [position, setPosition] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<AppRole>('Employee');
  const [department, setDepartment] = useState('General');
  const [status, setStatus] = useState<'Active' | 'Inactive'>('Active');
  const [permissions, setPermissions] = useState<AppPermission[]>(['View']);

  const [activeTab, setActiveTab] = useState<'employees' | 'logs'>('employees');
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    if (!isAdmin) return;
    
    const fetchEmployees = async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('createdAt', { ascending: false });
        
      if (error) {
        console.error("Error fetching employees:", error);
      } else {
        setEmployees(data as EmployeeProfile[]);
      }
      setLoading(false);
    };

    const fetchLogs = async () => {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .order('timestamp', { ascending: false });
        
      if (!error && data) {
        setLogs(data);
      }
    };

    fetchEmployees();
    fetchLogs();

    const employeesChannel = supabase.channel('public-employees')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employees' }, payload => {
        fetchEmployees();
      })
      .subscribe();

    const logsChannel = supabase.channel('public-activity_logs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_logs' }, payload => {
        fetchLogs();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(employeesChannel);
      supabase.removeChannel(logsChannel);
    };
  }, [isAdmin]);

  useEffect(() => {
    if (editingEmployee) {
      setFullName(editingEmployee.fullName || '');
      setEmail(editingEmployee.email);
      setPhoneNumber(editingEmployee.phoneNumber || '');
      setPosition(editingEmployee.position || '');
      setRole(editingEmployee.role);
      setDepartment(editingEmployee.department);
      setStatus(editingEmployee.status);
      setPermissions(editingEmployee.permissions || ['View']);
      setPassword(''); // Don't show password
      setShowModal(true);
    } else {
      setFullName('');
      setEmail('');
      setPhoneNumber('');
      setPosition('');
      setRole('Employee');
      setDepartment('General');
      setStatus('Active');
      setPermissions(['View']);
      setPassword('');
    }
  }, [editingEmployee]);

  if (!isAdmin) {
    return (
      <div className="p-8 text-center text-slate-500">
        You do not have permission to view this page.
      </div>
    );
  }

  const logActivity = async (action: string, details: string) => {
    try {
      await supabase.from('activity_logs').insert({
        action,
        details,
        userId: profile?.uid,
        userName: profile?.fullName,
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      console.error("Failed to log activity", e);
    }
  };

  const handleAddOrUpdateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      if (editingEmployee) {
        const updateData: any = {
          email: email.toLowerCase(),
          fullName,
          phoneNumber,
          position,
          role,
          department,
          status,
          permissions
        };
        const { error } = await supabase.from('employees').update(updateData).eq('uid', editingEmployee.uid);
        if (error) throw error;
        
        // If password is provided, update it via admin API (requires service role key or specific setup in Supabase)
        // For now, we assume users can reset their own passwords or we'd need an edge function.
        if (password) {
          const { error: authError } = await supabase.auth.updateUser({ password });
          if (authError) console.error("Failed to update password:", authError);
        }

        await logActivity('Updated Employee', `Updated details for ${fullName} (${email})`);
      } else {
        // Create user in Supabase Auth using a temporary client to avoid signing out the admin
        const tempSupabase = createClient(supabaseUrl, supabaseAnonKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
          }
        });

        const { data: authData, error: authError } = await tempSupabase.auth.signUp({
          email: email.toLowerCase(),
          password,
          options: {
            data: {
              fullName,
              role
            }
          }
        });
        
        if (authError) {
          // If user already exists in Auth but not in employees table, we might want to just create the employee record
          if (authError.message.includes('User already registered')) {
            // We can't get the UID easily without admin API, so we have to tell the user
            throw new Error("This email is already registered in the system. If they don't have a profile, please contact support to link their account.");
          }
          throw authError;
        }

        const uid = authData.user?.id;
        if (!uid) throw new Error("Failed to get user ID after signup. Email confirmation might be required.");

        const { error: dbError } = await supabase.from('employees').insert({
          uid,
          email: email.toLowerCase(),
          fullName,
          phoneNumber,
          position,
          role,
          department,
          status,
          permissions,
          createdAt: new Date().toISOString()
        });
        
        if (dbError) throw dbError;

        await logActivity('Created Employee', `Created new account for ${fullName} (${email})`);
      }

      setShowModal(false);
      setEditingEmployee(null);
    } catch (err: any) {
      setError(err.message || 'Failed to save employee');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (emp: EmployeeProfile) => {
    setShowDeleteConfirm(emp);
  };

  const confirmDelete = async () => {
    if (showDeleteConfirm) {
      try {
        const { error } = await supabase.from('employees').delete().eq('uid', showDeleteConfirm.uid);
        if (error) throw error;
        await logActivity('Deleted Employee', `Deleted account for ${showDeleteConfirm.fullName} (${showDeleteConfirm.email})`);
      } catch (err: any) {
        console.error(err.message || 'Failed to delete employee');
      } finally {
        setShowDeleteConfirm(null);
      }
    }
  };

  const handlePermissionToggle = (perm: AppPermission) => {
    if (permissions.includes(perm)) {
      setPermissions(permissions.filter(p => p !== perm));
    } else {
      setPermissions([...permissions, perm]);
    }
  };

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          emp.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'All' || emp.role === roleFilter;
    const matchesStatus = statusFilter === 'All' || emp.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-600" />
            Employee Management
          </h1>
          <p className="text-slate-500 mt-1">Manage your team members, roles, and access permissions.</p>
        </div>
        <button
          onClick={() => {
            setEditingEmployee(null);
            setShowModal(true);
          }}
          className="inline-flex items-center px-4 py-2.5 rounded-xl shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all hover:shadow-md"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add New Employee
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('employees')}
            className={cn(
              "whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors",
              activeTab === 'employees'
                ? "border-indigo-500 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            )}
          >
            <Users className="w-4 h-4 inline-block mr-2 mb-0.5" />
            Employees
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={cn(
              "whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors",
              activeTab === 'logs'
                ? "border-indigo-500 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            )}
          >
            <Activity className="w-4 h-4 inline-block mr-2 mb-0.5" />
            Activity Logs
          </button>
        </nav>
      </div>

      {activeTab === 'employees' ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Filters Bar */}
          <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-slate-400" />
              </div>
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>
            <div className="flex gap-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Filter className="h-4 w-4 text-slate-400" />
                </div>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="block w-full pl-10 pr-8 py-2 border border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm appearance-none bg-white"
                >
                  <option key="all" value="All">All Roles</option>
                  <option key="admin" value="Admin">Admin</option>
                  <option key="manager" value="Manager">Manager</option>
                  <option key="employee" value="Employee">Employee</option>
                </select>
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="block w-full pl-3 pr-8 py-2 border border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm appearance-none bg-white"
              >
                <option key="all" value="All">All Status</option>
                <option key="active" value="Active">Active</option>
                <option key="inactive" value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
              </div>
            ) : (
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Employee</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Contact</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Role & Dept</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                    <th scope="col" className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {filteredEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                        <div className="flex flex-col items-center justify-center">
                          <Users className="w-12 h-12 text-slate-300 mb-4" />
                          <p className="text-lg font-medium text-slate-900">No employees found</p>
                          <p className="text-sm text-slate-500">Try adjusting your search or filters.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredEmployees.map((emp, index) => (
                      <tr key={emp.uid || index} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center text-indigo-700 font-bold border border-indigo-200">
                              {(emp.fullName?.[0] || 'U').toUpperCase()}
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-slate-900">{emp.fullName}</div>
                              <div className="text-sm text-slate-500">{emp.position || 'No position set'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-slate-900 flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-slate-400"/> {emp.email}</div>
                          <div className="text-sm text-slate-500 flex items-center gap-1.5 mt-1"><Phone className="w-3.5 h-3.5 text-slate-400"/> {emp.phoneNumber || 'N/A'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center text-sm text-slate-900 mb-1">
                            {emp.role === 'Admin' ? (
                              <ShieldAlert className="w-4 h-4 text-rose-500 mr-1.5" />
                            ) : emp.role === 'Manager' ? (
                              <Shield className="w-4 h-4 text-indigo-500 mr-1.5" />
                            ) : (
                              <UserIcon className="w-4 h-4 text-slate-400 mr-1.5" />
                            )}
                            <span className="font-medium">{emp.role}</span>
                          </div>
                          <span className="px-2 py-0.5 inline-flex text-xs leading-5 font-medium rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                            {emp.department || 'General'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={cn(
                            "px-2.5 py-1 rounded-full text-xs font-medium border",
                            emp.status === 'Active' ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-600 border-slate-200"
                          )}>
                            {emp.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end space-x-2">
                            <button
                              onClick={() => setEditingEmployee(emp)}
                              className="text-slate-400 hover:text-indigo-600 p-2 hover:bg-indigo-50 rounded-lg transition-colors"
                              title="Edit profile"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(emp)}
                              className="text-slate-400 hover:text-rose-600 p-2 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Delete profile"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50">
            <h3 className="text-lg font-medium text-slate-900">System Activity Logs</h3>
            <p className="text-sm text-slate-500">Track all administrative actions performed in the system.</p>
          </div>
          <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
            {logs.length === 0 ? (
              <div className="p-8 text-center text-slate-500">No activity logs found.</div>
            ) : (
              logs.map((log, index) => (
                <div key={log.id || index} className="p-4 hover:bg-slate-50 transition-colors flex items-start space-x-4">
                  <div className="flex-shrink-0 mt-1">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                      <Activity className="w-4 h-4 text-indigo-600" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900">
                      {log.action}
                    </p>
                    <p className="text-sm text-slate-500 mt-0.5">
                      {log.details}
                    </p>
                    <div className="mt-2 flex items-center text-xs text-slate-400 space-x-4">
                      <span className="flex items-center">
                        <UserIcon className="w-3 h-3 mr-1" />
                        {log.userName || 'System'}
                      </span>
                      <span>
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Add/Edit Employee Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity" aria-hidden="true" onClick={() => {
            setShowModal(false);
            setEditingEmployee(null);
          }}></div>
          
          <div className="relative bg-white rounded-2xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:max-w-2xl w-full border border-slate-100 flex flex-col max-h-[90vh]">
            <form onSubmit={handleAddOrUpdateEmployee} className="flex flex-col h-full max-h-[90vh]">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4 border-b border-slate-200 shrink-0">
                <h3 className="text-xl leading-6 font-bold text-slate-900" id="modal-title">
                  {editingEmployee ? 'Edit Employee Profile' : 'Add New Employee'}
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  {editingEmployee ? 'Update the details and permissions for this team member.' : 'Create a new account and assign roles and permissions.'}
                </p>
              </div>
              
              <div className="px-4 py-5 sm:p-6 overflow-y-auto flex-1">
                {error && (
                  <div className="mb-6 bg-rose-50 border-l-4 border-rose-500 p-4 rounded-r-lg">
                    <p className="text-sm text-rose-700">{error}</p>
                  </div>
                )}
                
                <div className="space-y-6">
                  {/* Personal Details */}
                        <div>
                          <h4 className="text-sm font-semibold text-slate-900 border-b border-slate-200 pb-2 mb-4">Personal Details</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                              <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                  <UserIcon className="h-4 w-4 text-slate-400" />
                                </div>
                                <input
                                  type="text"
                                  required
                                  value={fullName}
                                  onChange={(e) => setFullName(e.target.value)}
                                  className="pl-10 block w-full rounded-lg border-slate-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm py-2 border"
                                  placeholder="John Doe"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                              <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                  <Mail className="h-4 w-4 text-slate-400" />
                                </div>
                                <input
                                  type="email"
                                  required
                                  value={email}
                                  onChange={(e) => setEmail(e.target.value)}
                                  className="pl-10 block w-full rounded-lg border-slate-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm py-2 border"
                                  placeholder="john@company.com"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
                              <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                  <Phone className="h-4 w-4 text-slate-400" />
                                </div>
                                <input
                                  type="tel"
                                  value={phoneNumber}
                                  onChange={(e) => setPhoneNumber(e.target.value)}
                                  className="pl-10 block w-full rounded-lg border-slate-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm py-2 border"
                                  placeholder="+1 (555) 000-0000"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-slate-700 mb-1">
                                {editingEmployee ? 'New Password (Optional)' : 'Password'}
                              </label>
                              <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                  <Lock className="h-4 w-4 text-slate-400" />
                                </div>
                                <input
                                  type="password"
                                  required={!editingEmployee}
                                  minLength={6}
                                  value={password}
                                  onChange={(e) => setPassword(e.target.value)}
                                  className="pl-10 block w-full rounded-lg border-slate-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm py-2 border"
                                  placeholder="••••••••"
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Job Details */}
                        <div>
                          <h4 className="text-sm font-semibold text-slate-900 border-b border-slate-200 pb-2 mb-4">Job Details</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-slate-700 mb-1">Position / Job Title</label>
                              <input
                                type="text"
                                required
                                value={position}
                                onChange={(e) => setPosition(e.target.value)}
                                className="block w-full rounded-lg border-slate-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm py-2 px-3 border"
                                placeholder="e.g. Senior Developer"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
                              <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                  <Building className="h-4 w-4 text-slate-400" />
                                </div>
                                <select
                                  value={department}
                                  onChange={(e) => setDepartment(e.target.value)}
                                  className="pl-10 block w-full rounded-lg border-slate-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm py-2 border bg-white"
                                >
                                  <option key="default" value="">Select Department</option>
                                  {departments.map((dept, index) => (
                                    <option key={dept.id || index} value={dept.name}>{dept.name}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-slate-700 mb-1">Account Status</label>
                              <select
                                value={status}
                                onChange={(e) => setStatus(e.target.value as 'Active' | 'Inactive')}
                                className="block w-full rounded-lg border-slate-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm py-2 px-3 border bg-white"
                              >
                                <option key="active" value="Active">Active</option>
                                <option key="inactive" value="Inactive">Inactive</option>
                              </select>
                            </div>
                          </div>
                        </div>

                        {/* Roles & Permissions */}
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                          <h4 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                            <Shield className="w-4 h-4 text-indigo-600" />
                            Roles & Permissions
                          </h4>
                          
                          <div className="space-y-5">
                            <div>
                              <label className="block text-sm font-medium text-slate-700 mb-2">Primary Role</label>
                              <div className="grid grid-cols-3 gap-3">
                                {['Admin', 'Manager', 'Employee'].map((r) => (
                                  <div 
                                    key={r}
                                    onClick={() => setRole(r as AppRole)}
                                    className={cn(
                                      "border rounded-lg p-3 cursor-pointer text-center transition-all",
                                      role === r 
                                        ? "bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500" 
                                        : "bg-white border-slate-200 hover:border-indigo-300"
                                    )}
                                  >
                                    <span className={cn(
                                      "text-sm font-medium",
                                      role === r ? "text-indigo-700" : "text-slate-700"
                                    )}>{r}</span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-slate-700 mb-2">Granular Permissions</label>
                              <div className="space-y-2">
                                {['View', 'Edit', 'Full Access'].map((perm) => (
                                  <label key={perm} className="flex items-center p-3 bg-white border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                                    <input
                                      type="checkbox"
                                      checked={permissions.includes(perm as AppPermission)}
                                      onChange={() => handlePermissionToggle(perm as AppPermission)}
                                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded"
                                    />
                                    <span className="ml-3 text-sm font-medium text-slate-900">{perm}</span>
                                    <span className="ml-auto text-xs text-slate-500">
                                      {perm === 'View' && 'Can view records only'}
                                      {perm === 'Edit' && 'Can modify existing records'}
                                      {perm === 'Full Access' && 'Can delete and manage settings'}
                                    </span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>

                      </div>
              </div>
              <div className="bg-slate-50 px-4 py-4 sm:px-6 sm:flex sm:flex-row-reverse rounded-b-2xl border-t border-slate-200 shrink-0">
                <button
                  type="submit"
                    disabled={saving}
                    className="w-full inline-flex justify-center items-center rounded-xl border border-transparent shadow-sm px-6 py-2.5 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 transition-all hover:shadow-md"
                  >
                    {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    {editingEmployee ? 'Save Changes' : 'Create Employee'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingEmployee(null);
                    }}
                    className="mt-3 w-full inline-flex justify-center rounded-xl border border-slate-300 shadow-sm px-6 py-2.5 bg-white text-base font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(null)}></div>
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-100">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-xl font-bold text-slate-900">Delete Employee</h3>
            </div>
            <div className="p-6">
              <p className="text-slate-600">Are you sure you want to delete {showDeleteConfirm.fullName}? This action cannot be undone.</p>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(null)}
                className="inline-flex justify-center rounded-lg border border-slate-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="inline-flex justify-center rounded-lg border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:text-sm transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
