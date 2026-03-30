import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { useAuthStore } from '../store/authStore';
import { Department } from '../types';
import { Plus, Edit2, Trash2, Building, Search, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { cn } from '../utils/cn';

export function Departments() {
  const { departments, addDepartment, updateDepartment, deleteDepartment, loading } = useStore();
  const { isAdmin } = useAuthStore();
  const [showModal, setShowModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  if (!isAdmin) {
    return <div className="p-6 text-red-500">Access Denied. Admin only.</div>;
  }

  const handleOpenModal = (dept?: Department) => {
    if (dept) {
      setEditingDept(dept);
      setName(dept.name);
      setDescription(dept.description || '');
    } else {
      setEditingDept(null);
      setName('');
      setDescription('');
    }
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingDept) {
        await updateDepartment(editingDept.id, { name, description });
      } else {
        const newDept: Department = {
          id: `dept_${Date.now()}`,
          name,
          description,
          createdAt: new Date().toISOString(),
        };
        await addDepartment(newDept);
      }
      setShowModal(false);
    } catch (error) {
      console.error('Failed to save department:', error);
      alert('Failed to save department');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    setShowDeleteConfirm(id);
  };

  const confirmDelete = async () => {
    if (showDeleteConfirm) {
      try {
        await deleteDepartment(showDeleteConfirm);
      } catch (error) {
        console.error('Failed to delete department:', error);
        // alert('Failed to delete department');
      } finally {
        setShowDeleteConfirm(null);
      }
    }
  };

  const filteredDepartments = departments.filter(d => 
    d && (
      (d.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (d.description?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    )
  );

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Building className="w-6 h-6 text-indigo-600" />
            Department Management
          </h1>
          <p className="text-slate-500 mt-1">Organize your forms and employees by departments.</p>
        </div>
        <Button onClick={() => handleOpenModal()} className="flex items-center">
          <Plus className="w-4 h-4 mr-2" />
          Add Department
        </Button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50/50">
          <div className="relative max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Search departments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
          {loading ? (
            <div className="col-span-full flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
          ) : filteredDepartments.length === 0 ? (
            <div className="col-span-full text-center py-12 text-slate-500">
              No departments found.
            </div>
          ) : (
            filteredDepartments.map((dept, index) => (
              <Card key={dept.id || index} className="hover:shadow-md transition-shadow border-slate-200">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                      <Building className="w-5 h-5" />
                    </div>
                    <div className="flex space-x-1">
                      <button 
                        onClick={() => handleOpenModal(dept)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(dept.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <CardTitle className="mt-4 text-lg">{dept.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600 line-clamp-2 min-h-[2.5rem]">
                    {dept.description || 'No description provided.'}
                  </p>
                  <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center text-xs text-slate-400">
                    <span>Created {dept.createdAt ? new Date(dept.createdAt).toLocaleDateString() : 'N/A'}</span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowModal(false)}></div>
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-100">
            <form onSubmit={handleSubmit}>
              <div className="p-6 border-b border-slate-200">
                <h3 className="text-xl font-bold text-slate-900">
                  {editingDept ? 'Edit Department' : 'Add New Department'}
                </h3>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Department Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-lg border-slate-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm py-2 px-3 border"
                    placeholder="e.g. Human Resources"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full rounded-lg border-slate-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm py-2 px-3 border min-h-[100px]"
                    placeholder="Briefly describe the department's purpose..."
                  />
                </div>
              </div>
              <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
                <Button variant="ghost" type="button" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editingDept ? 'Save Changes' : 'Create Department'}
                </Button>
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
              <h3 className="text-xl font-bold text-slate-900">Delete Department</h3>
            </div>
            <div className="p-6">
              <p className="text-slate-600">Are you sure you want to delete this department? This might affect employees and forms linked to it.</p>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowDeleteConfirm(null)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={confirmDelete}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
