import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useStore } from '../store/useStore';
import { supabase } from '../supabase';
import { Plus, Trash2, Loader2, Users, Shield, ShieldAlert, Mail, User as UserIcon, Building, Edit2, Copy, CheckCircle2, Info, Lock } from 'lucide-react';
import { Role } from '../types';
import { cn } from '../utils/cn';

interface Employee {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  name: string;
  password?: string;
  role: Role;
  department: 'HR' | 'Accounts' | 'Operational' | 'Administrative' | 'General';
  isActive: boolean;
  createdAt: string;
}

export function Employees() {
  const { isAdmin } = useAuthStore();
  const { departments } = useStore();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('Creator');
  const [department, setDepartment] = useState<string>('General');
  const [isActive, setIsActive] = useState(true);

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
        setEmployees(data as Employee[]);
      }
      setLoading(false);
    };

    fetchEmployees();

    const channel = supabase.channel('public-employees-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employees' }, payload => {
        fetchEmployees();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin]);

  useEffect(() => {
    if (editingEmployee) {
      setFirstName(editingEmployee.firstName || '');
      setLastName(editingEmployee.lastName || '');
      setEmail(editingEmployee.email);
      setRole(editingEmployee.role);
      
      // Try to find department by name if it's not an ID
      const deptId = departments.find(d => d.id === editingEmployee.department || d.name === editingEmployee.department)?.id || editingEmployee.department;
      setDepartment(deptId);
      
      setIsActive(editingEmployee.isActive !== false);
      setPassword(''); // Don't show password
      setShowModal(true);
    } else {
      setFirstName('');
      setLastName('');
      setEmail('');
      setRole('Creator');
      setDepartment(departments.length > 0 ? departments[0].id : 'General');
      setIsActive(true);
      setPassword('');
    }
  }, [editingEmployee, departments]);

  if (!isAdmin) {
    return (
      <div className="p-8 text-center text-gray-500">
        You do not have permission to view this page.
      </div>
    );
  }

  const handleAddOrUpdateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    const fullName = `${firstName} ${lastName}`.trim();

    try {
      if (editingEmployee) {
        const updateData: any = {
          email: email.toLowerCase(),
          firstName,
          lastName,
          name: fullName,
          role,
          department,
          isActive,
        };
        if (password) {
          updateData.password = password;
        }
        const { error } = await supabase.from('employees').update(updateData).eq('uid', editingEmployee.uid);
        if (error) throw error;
      } else {
        // TEMPORARY: Since auth is bypassed, generate a random UID instead of using Firebase Auth
        const uid = 'emp_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

        const { error } = await supabase.from('employees').insert({
          uid,
          email: email.toLowerCase(),
          firstName,
          lastName,
          name: fullName,
          password,
          role,
          department,
          isActive,
          createdAt: new Date().toISOString()
        });
        if (error) throw error;
      }

      setShowModal(false);
      setEditingEmployee(null);
    } catch (err: any) {
      setError(err.message || 'Failed to save employee');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (uid: string) => {
    setShowDeleteConfirm(uid);
  };

  const confirmDelete = async () => {
    if (showDeleteConfirm) {
      try {
        const { error } = await supabase.from('employees').delete().eq('uid', showDeleteConfirm);
        if (error) throw error;
      } catch (err: any) {
        console.error(err.message || 'Failed to delete employee');
      } finally {
        setShowDeleteConfirm(null);
      }
    }
  };

  const handleCopyInvitation = (emp: Employee) => {
    const inviteText = `مرحباً ${emp.name}،

تمت دعوتك للانضمام إلى نظام إدارة المستندات.

تفاصيل تسجيل الدخول:
البريد الإلكتروني: ${emp.email}
كلمة المرور: ${emp.password || 'يرجى التواصل مع المسؤول'}
رابط تسجيل الدخول: ${window.location.origin}/login

يرجى تسجيل الدخول وتغيير كلمة المرور الخاصة بك إذا لزم الأمر.
--------------------------------------------------
Hello ${emp.name},

You have been invited to join the Document Management System.

Login Details:
Email: ${emp.email}
Password: ${emp.password || 'Contact Admin'}
Login URL: ${window.location.origin}/login

Please log in and change your password if needed.`;

    navigator.clipboard.writeText(inviteText);
    setCopiedId(emp.uid);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const roles: Role[] = ['Admin', 'Creator', 'Approver Level 1', 'Approver Level 2'];

  const roleDescriptions: Record<Role, string> = {
    'Admin': 'Full system access: manage templates, employees, settings, and all documents.',
    'Creator': 'Can create new documents from templates and view their own documents.',
    'Approver Level 1': 'Can view all documents and perform Level 1 approvals/rejections.',
    'Approver Level 2': 'Can view all documents and perform Level 2 approvals/rejections.'
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-600" />
            Employees & Permissions
          </h1>
          <p className="text-gray-500 mt-1">Manage team members, roles, and access permissions.</p>
        </div>
        <button
          onClick={() => {
            setEditingEmployee(null);
            setShowModal(true);
          }}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Employee
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          {loading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
          ) : (
            <div className="bg-white shadow-sm rounded-xl border border-slate-200 overflow-hidden">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Name</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Department</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Role</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                    <th scope="col" className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {employees.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                        No employees found. Add one to get started.
                      </td>
                    </tr>
                  ) : (
                    employees.map((emp, index) => (
                      <tr key={emp.uid || index} className={cn("hover:bg-slate-50 transition-colors", !emp.isActive && "opacity-60")}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold">
                              {(emp.firstName?.[0] || emp.name?.[0] || 'U').toUpperCase()}
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-slate-900">{emp.name}</div>
                              <div className="text-sm text-slate-500">{emp.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-slate-100 text-slate-800 border border-slate-200">
                            {departments.find(d => d.id === emp.department)?.name || emp.department}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center text-sm text-slate-900">
                            {emp.role === 'Admin' ? (
                              <ShieldAlert className="w-4 h-4 text-rose-500 mr-1.5" />
                            ) : (
                              <Shield className="w-4 h-4 text-slate-400 mr-1.5" />
                            )}
                            <span>{emp.role}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                            emp.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
                          )}>
                            {emp.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end space-x-1">
                            <button
                              onClick={() => handleCopyInvitation(emp)}
                              className={cn(
                                "p-2 rounded-lg transition-colors",
                                copiedId === emp.uid ? "text-emerald-600 bg-emerald-50" : "text-slate-400 hover:text-indigo-600 hover:bg-slate-100"
                              )}
                              title="Copy Login Invitation"
                            >
                              {copiedId === emp.uid ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => setEditingEmployee(emp)}
                              className="text-slate-400 hover:text-indigo-600 p-2 hover:bg-slate-100 rounded-lg transition-colors"
                              title="Edit profile"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(emp.uid)}
                              className="text-slate-400 hover:text-rose-600 p-2 hover:bg-slate-100 rounded-lg transition-colors"
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
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Info className="w-4 h-4 text-indigo-500" />
              Role Permissions Guide
            </h3>
            <div className="space-y-4">
              {Object.entries(roleDescriptions).map(([r, desc]) => (
                <div key={r}>
                  <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-1">{r}</p>
                  <p className="text-xs text-slate-600 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-100">
            <h3 className="text-sm font-bold text-indigo-900 mb-2">How do they log in?</h3>
            <p className="text-xs text-indigo-700 leading-relaxed">
              Employees log in using their <strong>Email Address</strong> and the <strong>Password</strong> you set for them. 
              <br /><br />
              Use the <Copy className="w-3 h-3 inline" /> icon to copy a ready-made invitation message to send to them.
            </p>
          </div>
        </div>
      </div>

      {/* Add/Edit Employee Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-slate-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={() => {
              setShowModal(false);
              setEditingEmployee(null);
            }}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <form onSubmit={handleAddOrUpdateEmployee}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="sm:flex sm:items-start">
                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                      <h3 className="text-lg leading-6 font-bold text-slate-900" id="modal-title">
                        {editingEmployee ? 'Edit Employee Profile' : 'Add New Employee'}
                      </h3>
                      <p className="text-sm text-slate-500 mt-1">
                        {editingEmployee ? 'Update the details for this team member.' : 'Create a new account for a team member to access the system.'}
                      </p>
                      
                      <div className="mt-6 space-y-4">
                        {error && (
                          <div className="bg-rose-50 border border-rose-200 text-rose-600 px-4 py-3 rounded-lg text-sm">
                            {error}
                          </div>
                        )}
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">First Name / الاسم الأول</label>
                            <div className="relative">
                              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <UserIcon className="h-4 w-4 text-slate-400" />
                              </div>
                              <input
                                type="text"
                                required
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                className="pl-10 block w-full rounded-lg border-slate-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm py-2.5 border"
                                placeholder="e.g. Mahmoud"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Last Name / اسم العائلة</label>
                            <input
                              type="text"
                              required
                              value={lastName}
                              onChange={(e) => setLastName(e.target.value)}
                              className="block w-full rounded-lg border-slate-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm py-2.5 px-3 border"
                              placeholder="e.g. Fawzi"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Email Address / البريد الإلكتروني</label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <Mail className="h-4 w-4 text-slate-400" />
                            </div>
                            <input
                              type="email"
                              required
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              className="pl-10 block w-full rounded-lg border-slate-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm py-2.5 border"
                              placeholder="email@company.com"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                            {editingEmployee ? 'New Password / كلمة مرور جديدة' : 'Login Password / كلمة المرور'}
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
                              className="pl-10 block w-full rounded-lg border-slate-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm py-2.5 border"
                              placeholder="••••••••"
                            />
                          </div>
                          {!editingEmployee && <p className="text-[10px] text-slate-400 mt-1">This password will be used by the employee to log in.</p>}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Department / القسم</label>
                            <div className="relative">
                              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Building className="h-4 w-4 text-slate-400" />
                              </div>
                              <select
                                value={department}
                                onChange={(e) => setDepartment(e.target.value)}
                                className="pl-10 block w-full rounded-lg border-slate-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm py-2.5 border bg-white"
                              >
                                {departments.map((dept, index) => (
                                  <option key={dept.id || index} value={dept.id}>{dept.name}</option>
                                ))}
                                {departments.length === 0 && (
                                  <>
                                    <option value="HR">HR</option>
                                    <option value="Accounts">Accounts</option>
                                    <option value="Operational">Operational</option>
                                    <option value="Administrative">Administrative</option>
                                    <option value="General">General</option>
                                  </>
                                )}
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Access Role / الصلاحية</label>
                            <select
                              value={role}
                              onChange={(e) => setRole(e.target.value as Role)}
                              className="block w-full rounded-lg border-slate-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm py-2.5 px-3 border bg-white"
                            >
                              {roles.map((r) => (
                                <option key={r} value={r}>{r}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Account Status / حالة الحساب</span>
                            <span className="text-[10px] text-slate-500">Active accounts can log in to the system.</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setIsActive(!isActive)}
                            className={cn(
                              "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                              isActive ? "bg-indigo-600" : "bg-slate-200"
                            )}
                          >
                            <span
                              className={cn(
                                "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                                isActive ? "translate-x-5" : "translate-x-0"
                              )}
                            />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-slate-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse rounded-b-xl border-t border-slate-200">
                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full inline-flex justify-center rounded-lg border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 transition-colors"
                  >
                    {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    {editingEmployee ? 'Update Profile' : 'Create Account'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingEmployee(null);
                    }}
                    className="mt-3 w-full inline-flex justify-center rounded-lg border border-slate-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
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
              <p className="text-slate-600">Are you sure you want to delete this employee profile? This action cannot be undone.</p>
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
