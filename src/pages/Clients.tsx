import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { Client } from '../types';
import { Button } from '../components/ui/Button';
import { Plus, Edit2, Trash2, Search, Building2 } from 'lucide-react';

export function Clients() {
  const { clients, addClient, updateClient, deleteClient } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const [formData, setFormData] = useState<Partial<Client>>({
    name: '',
    address: '',
    contactPerson: '',
    telPoBox: '',
    email: '',
    trn: '',
  });

  const filteredClients = clients.filter(client => 
    (client.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (client.contactPerson?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (client.email?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  const handleOpenModal = (client?: Client) => {
    if (client) {
      setEditingClient(client);
      setFormData(client);
    } else {
      setEditingClient(null);
      setFormData({
        name: '',
        address: '',
        contactPerson: '',
        telPoBox: '',
        email: '',
        trn: '',
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingClient(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    try {
      if (editingClient) {
        await updateClient(editingClient.id, formData);
      } else {
        await addClient({
          ...formData,
          id: `client_${Date.now()}`,
        } as Client);
      }
      handleCloseModal();
    } catch (error: any) {
      console.error('Failed to save client:', error);
      let errorMessage = 'Failed to save client. Please try again.';
      try {
        const parsed = JSON.parse(error.message);
        if (parsed.error) errorMessage = parsed.error;
      } catch (e) {
        if (error.message) errorMessage = error.message;
      }
      alert(errorMessage);
    }
  };

  const handleDelete = (id: string) => {
    setShowDeleteConfirm(id);
  };

  const confirmDelete = async () => {
    if (showDeleteConfirm) {
      try {
        await deleteClient(showDeleteConfirm);
      } catch (error: any) {
        console.error('Failed to delete client:', error);
        let errorMessage = 'Failed to delete client. Please try again.';
        try {
          const parsed = JSON.parse(error.message);
          if (parsed.error) errorMessage = parsed.error;
        } catch (e) {
          if (error.message) errorMessage = error.message;
        }
        // alert(errorMessage);
      } finally {
        setShowDeleteConfirm(null);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Clients Management</h1>
          <p className="text-slate-500">Manage your clients and their details</p>
        </div>
        <Button onClick={() => handleOpenModal()} className="flex items-center">
          <Plus className="w-4 h-4 mr-2" />
          Add Client
        </Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search clients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Client Name</th>
                <th className="px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Contact Person</th>
                <th className="px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Tel / P.O BOX</th>
                <th className="px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">TRN</th>
                <th className="px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredClients.map((client, index) => (
                <tr key={client.id || index} className="hover:bg-slate-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 mr-3">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div className="font-medium text-slate-900">{client.name}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{client.contactPerson}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{client.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{client.telPoBox}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{client.trn}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleOpenModal(client)}
                      className="text-indigo-600 hover:text-indigo-900 mr-4"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(client.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredClients.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    No clients found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-900">
                {editingClient ? 'Edit Client' : 'Add New Client'}
              </h2>
              <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600">
                &times;
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Client Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Contact Person</label>
                <input
                  type="text"
                  value={formData.contactPerson}
                  onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tel & P.O BOX</label>
                <input
                  type="text"
                  value={formData.telPoBox}
                  onChange={(e) => setFormData({ ...formData, telPoBox: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">TRN</label>
                <input
                  type="text"
                  value={formData.trn}
                  onChange={(e) => setFormData({ ...formData, trn: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="pt-4 flex justify-end space-x-3">
                <Button type="button" variant="outline" onClick={handleCloseModal}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingClient ? 'Save Changes' : 'Add Client'}
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
              <h3 className="text-xl font-bold text-slate-900">Delete Client</h3>
            </div>
            <div className="p-6">
              <p className="text-slate-600">Are you sure you want to delete this client?</p>
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
