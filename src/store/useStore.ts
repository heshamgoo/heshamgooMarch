import { create } from 'zustand';
import { User, Template, Document, DocumentStatus, ApprovalLog, Client, Department } from '../types';
import { supabase, handleSupabaseError, OperationType } from '../supabase';
import { useSettingsStore } from './settingsStore';

interface AppState {
  templates: Template[];
  documents: Document[];
  clients: Client[];
  departments: Department[];
  loading: boolean;
  
  init: () => (() => void);
  addTemplate: (template: Template) => Promise<void>;
  updateTemplate: (id: string, template: Partial<Template>) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  
  addDocument: (doc: Document) => Promise<void>;
  updateDocumentStatus: (docId: string, status: DocumentStatus, log: ApprovalLog) => Promise<void>;
  updateDocumentData: (docId: string, data: Record<string, any>) => Promise<void>;

  addClient: (client: Client) => Promise<void>;
  updateClient: (id: string, client: Partial<Client>) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;

  addDepartment: (dept: Department) => Promise<void>;
  updateDepartment: (id: string, dept: Partial<Department>) => Promise<void>;
  deleteDepartment: (id: string) => Promise<void>;
}

const sanitize = (obj: any): any => {
  if (Array.isArray(obj)) {
    return obj.map(v => sanitize(v));
  } else if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
    return Object.fromEntries(
      Object.entries(obj)
        .filter(([_, v]) => v !== undefined)
        .map(([k, v]) => [k, sanitize(v)])
    );
  }
  return obj;
};

export const useStore = create<AppState>((set, get) => ({
  templates: [],
  documents: [],
  clients: [],
  departments: [],
  loading: true,
  
  init: () => {
    const fetchInitialData = async () => {
      try {
        const [templatesRes, documentsRes, clientsRes] = await Promise.all([
          supabase.from('templates').select('*'),
          supabase.from('documents').select('*'),
          supabase.from('clients').select('*')
        ]);

        if (templatesRes.data) {
          const mappedTemplates = templatesRes.data.map((t: any) => {
            const { department, ...rest } = t;
            return { ...rest, departmentId: department };
          });
          set({ templates: mappedTemplates as Template[] });
        }
        if (documentsRes.data) {
          const mappedDocuments = documentsRes.data.map((d: any) => {
            const { department, ...rest } = d;
            return { ...rest, departmentId: department };
          });
          set({ documents: mappedDocuments as Document[] });
        }
        if (clientsRes.data) set({ clients: clientsRes.data as Client[] });
        
        // Sync departments from settingsStore
        const currentSettings = useSettingsStore.getState().settings;
        if (currentSettings?.departments) {
          set({ departments: currentSettings.departments });
        }

        set({ loading: false });
      } catch (error) {
        console.error('Error fetching initial data:', error);
        set({ loading: false });
      }
    };

    fetchInitialData();

    const unsubSettings = useSettingsStore.subscribe((state) => {
      if (state.settings?.departments) {
        set({ departments: state.settings.departments });
      }
    });

    const channel = supabase.channel('public-tables')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'templates' }, payload => {
        fetchInitialData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'documents' }, payload => {
        fetchInitialData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, payload => {
        fetchInitialData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      unsubSettings();
    };
  },
  
  addTemplate: async (template) => {
    console.log('Adding template:', template);
    const { departmentId, ...rest } = template;
    const toSave = { ...rest, department: departmentId };
    const sanitized = sanitize(toSave);
    try {
      const { error } = await supabase.from('templates').insert([sanitized]);
      if (error) throw error;
      console.log('Template added successfully');
    } catch (error) {
      console.error('Error adding template:', error);
      handleSupabaseError(error, OperationType.WRITE, `templates/${template.id}`);
    }
  },
  
  updateTemplate: async (id, updated) => {
    console.log('Updating template:', id, updated);
    const { departmentId, ...rest } = updated;
    const toSave: any = { ...rest };
    if (departmentId !== undefined) {
      toSave.department = departmentId;
    }
    const sanitized = sanitize(toSave);
    try {
      const { error } = await supabase.from('templates').update(sanitized).eq('id', id);
      if (error) throw error;
      console.log('Template updated successfully');
    } catch (error) {
      console.error('Error updating template:', error);
      handleSupabaseError(error, OperationType.UPDATE, `templates/${id}`);
    }
  },
  
  deleteTemplate: async (id) => {
    try {
      const { error } = await supabase.from('templates').delete().eq('id', id);
      if (error) throw error;
    } catch (error) {
      handleSupabaseError(error, OperationType.DELETE, `templates/${id}`);
    }
  },
  
  addDocument: async (docData) => {
    const { departmentId, ...rest } = docData;
    const toSave = { ...rest, department: departmentId };
    const sanitized = sanitize(toSave);
    try {
      const { error } = await supabase.from('documents').insert([sanitized]);
      if (error) throw error;
    } catch (error) {
      handleSupabaseError(error, OperationType.WRITE, `documents/${docData.id}`);
    }
  },
  
  updateDocumentStatus: async (docId, status, log) => {
    try {
      const currentDoc = get().documents.find(d => d.id === docId);
      if (!currentDoc) return;

      const updates = sanitize({ 
        status, 
        logs: [...currentDoc.logs, log],
        updatedAt: new Date().toISOString()
      });

      const { error } = await supabase.from('documents').update(updates).eq('id', docId);
      if (error) throw error;
    } catch (error) {
      handleSupabaseError(error, OperationType.UPDATE, `documents/${docId}`);
    }
  },
  
  updateDocumentData: async (docId, data) => {
    try {
      const updates = sanitize({
        data,
        updatedAt: new Date().toISOString()
      });
      const { error } = await supabase.from('documents').update(updates).eq('id', docId);
      if (error) throw error;
    } catch (error) {
      handleSupabaseError(error, OperationType.UPDATE, `documents/${docId}`);
    }
  },

  addClient: async (client) => {
    const toSave = { ...client };
    const sanitized = sanitize(toSave);
    try {
      const { error } = await supabase.from('clients').insert([sanitized]);
      if (error) throw error;
    } catch (error) {
      handleSupabaseError(error, OperationType.WRITE, `clients/${client.id}`);
    }
  },

  updateClient: async (id, updated) => {
    const toSave = { ...updated };
    const sanitized = sanitize(toSave);
    try {
      const { error } = await supabase.from('clients').update(sanitized).eq('id', id);
      if (error) throw error;
    } catch (error) {
      handleSupabaseError(error, OperationType.UPDATE, `clients/${id}`);
    }
  },

  deleteClient: async (id) => {
    try {
      const { error } = await supabase.from('clients').delete().eq('id', id);
      if (error) throw error;
    } catch (error) {
      handleSupabaseError(error, OperationType.DELETE, `clients/${id}`);
    }
  },

  addDepartment: async (dept) => {
    await useSettingsStore.getState().addDepartment(dept);
  },

  updateDepartment: async (id, updated) => {
    await useSettingsStore.getState().updateDepartment(id, updated);
  },

  deleteDepartment: async (id) => {
    await useSettingsStore.getState().deleteDepartment(id);
  }
}));
