import { create } from 'zustand';
import { supabase, handleSupabaseError, OperationType } from '../supabase';
import { Department } from '../types';

export interface LoginCertification {
  title: string;
  description: string;
  icon: string;
}

interface CompanySettings {
  id?: string;
  name: string;
  logoUrl?: string;
  loginBgUrl?: string;
  loginLogoUrl?: string;
  logoTop?: number;
  logoLeft?: number;
  address?: string;
  phone?: string;
  email?: string;
  updatedAt?: string;
  departments?: Department[];
  loginCompanyNameLine1?: string;
  loginCompanyNameLine2?: string;
  loginSloganLine1?: string;
  loginSloganLine2?: string;
  loginCertifications?: LoginCertification[];
}

interface SettingsState {
  settings: CompanySettings | null;
  isLoading: boolean;
  error: string | null;
  init: () => void;
  updateSettings: (settings: Partial<CompanySettings>) => Promise<void>;
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

const defaultSettings: CompanySettings = {
  id: 'global',
  name: 'Porto Marine Services L.L.C',
  logoUrl: 'https://ais-pre-mqniulfb23hoygpxy7hd4c-255445966847.europe-west1.run.app/logo.png', // Placeholder or actual if available
  address: 'Abu Dhabi | UAE | Biladi ST | Mariam Ahmed Abdullah Tower | M Floor | Office No.1',
  phone: '+971 50 144 0994',
  email: 'Diving@portomarines.com',
  departments: [
    { id: 'dept_1', name: 'General', createdAt: new Date().toISOString() },
    { id: 'dept_2', name: 'HR', createdAt: new Date().toISOString() },
    { id: 'dept_3', name: 'Finance', createdAt: new Date().toISOString() },
    { id: 'dept_4', name: 'Operation', createdAt: new Date().toISOString() },
    { id: 'dept_5', name: 'Public', createdAt: new Date().toISOString() }
  ]
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: null,
  isLoading: true,
  error: null,
  init: () => {
    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('settings')
          .select('*')
          .eq('id', 'global')
          .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
          throw error;
        }

        if (data) {
          let parsedSettings = { ...data };
          
          // Handle departments if it's stored as a JSON string in the first element of TEXT[]
          if (data.departments && Array.isArray(data.departments) && data.departments.length > 0) {
            try {
              const firstElem = data.departments[0];
              if (typeof firstElem === 'string' && (firstElem.startsWith('[') || firstElem.startsWith('{'))) {
                const parsed = JSON.parse(firstElem);
                if (Array.isArray(parsed)) {
                  parsedSettings.departments = parsed;
                }
              } else {
                // Fallback to strings if it's not JSON
                parsedSettings.departments = data.departments.map((d: any, i: number) => 
                  typeof d === 'string' ? { id: `dept_${Date.now()}_${i}`, name: d, createdAt: new Date().toISOString() } : d
                );
              }
            } catch (e) {
              // Fallback to strings if it's not JSON
              parsedSettings.departments = data.departments.map((d: any, i: number) => 
                typeof d === 'string' ? { id: `dept_${Date.now()}_${i}`, name: d, createdAt: new Date().toISOString() } : d
              );
            }
          } else {
            parsedSettings.departments = [];
          }

          // Ensure all departments have an id and are valid objects
          if (Array.isArray(parsedSettings.departments)) {
            parsedSettings.departments = parsedSettings.departments
              .filter((d: any) => d && typeof d === 'object' && d.name && !('0' in d)) // Filter out corrupted entries
              .map((d: any, i: number) => {
                if (!d.id) {
                  return { ...d, id: `dept_${Date.now()}_${i}` };
                }
                return d;
              });
          }

          if (parsedSettings.departments && Array.isArray(parsedSettings.departments)) {
            const extraObj = parsedSettings.departments.find(d => typeof d === 'object' && d !== null && '__extra' in d);
            if (extraObj) {
              parsedSettings = { ...parsedSettings, ...extraObj.__extra };
              parsedSettings.departments = parsedSettings.departments.filter(d => typeof d === 'object' && d !== null && !('__extra' in d));
            }
          }
          set({ settings: parsedSettings as CompanySettings, isLoading: false, error: null });
        } else {
          set({ settings: defaultSettings, isLoading: false, error: null });
        }
      } catch (error: any) {
        console.error("Error fetching company settings:", error);
        set({ error: error.message, isLoading: false });
      }
    };

    fetchSettings();

    const channel = supabase.channel('public-settings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings', filter: 'id=eq.global' }, payload => {
        fetchSettings();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
  updateSettings: async (newSettings) => {
    try {
      console.log('Updating settings with:', newSettings);
      const currentSettings = get().settings || defaultSettings;
      const updates = sanitize({ ...currentSettings, ...newSettings, updatedAt: new Date().toISOString() });
      
      // Remove id from updates to ensure we don't overwrite the 'global' id
      const { id, ...payload } = updates;

      // Prepare departments for storage. If it's an array of objects, stringify it and put in the first element of TEXT[]
      const departmentsToSave = Array.isArray(payload.departments) 
        ? [JSON.stringify(payload.departments)]
        : payload.departments;

      // Optimistic update
      const optimisticSettings = { ...currentSettings, ...newSettings } as CompanySettings;
      set({ settings: optimisticSettings });

      // Try to save
      console.log('Upserting to settings table with id: global', { ...payload, departments: departmentsToSave });
      const { error: fullError } = await supabase
        .from('settings')
        .upsert({ 
          id: 'global', 
          ...payload,
          departments: departmentsToSave
        });
        
      if (fullError) {
        console.error('Upsert error:', fullError);
        throw fullError;
      }
      
      console.log('Upsert successful, refreshing settings...');
      // Refresh settings after save
      const { data, error: fetchError } = await supabase
        .from('settings')
        .select('*')
        .eq('id', 'global')
        .single();
        
      if (!fetchError && data) {
        // Re-parse departments
        let parsedData = { ...data };
        if (data.departments && Array.isArray(data.departments) && data.departments.length > 0) {
          try {
            const firstElem = data.departments[0];
            if (typeof firstElem === 'string' && (firstElem.startsWith('[') || firstElem.startsWith('{'))) {
              const parsed = JSON.parse(firstElem);
              if (Array.isArray(parsed)) parsedData.departments = parsed;
            } else {
              parsedData.departments = data.departments.map((d: any, i: number) => 
                typeof d === 'string' ? { id: `dept_${Date.now()}_${i}`, name: d, createdAt: new Date().toISOString() } : d
              );
            }
          } catch (e) {
            parsedData.departments = data.departments.map((d: any, i: number) => 
              typeof d === 'string' ? { id: `dept_${Date.now()}_${i}`, name: d, createdAt: new Date().toISOString() } : d
            );
          }
        } else {
          parsedData.departments = [];
        }

        if (Array.isArray(parsedData.departments)) {
          parsedData.departments = parsedData.departments
            .filter((d: any) => d && typeof d === 'object' && d.name && !('0' in d))
            .map((d: any, i: number) => {
              if (!d.id) return { ...d, id: `dept_${Date.now()}_${i}` };
              return d;
            });
        }

        set({ settings: parsedData as CompanySettings });
      } else if (fetchError) {
        console.warn('Fetch after upsert failed, keeping optimistic state:', fetchError);
      }
    } catch (error: any) {
      console.error('Failed to update settings:', error);
      handleSupabaseError(error, OperationType.WRITE, 'settings/global');
      // Rollback or handle error
      get().init(); 
    }
  },
  addDepartment: async (dept) => {
    const currentDepts = get().settings?.departments || [];
    await get().updateSettings({ departments: [...currentDepts, dept] });
  },
  updateDepartment: async (id, updated) => {
    const currentDepts = get().settings?.departments || [];
    const newDepts = currentDepts.map(d => d.id === id ? { ...d, ...updated } : d);
    await get().updateSettings({ departments: newDepts });
  },
  deleteDepartment: async (id) => {
    const currentDepts = get().settings?.departments || [];
    const newDepts = currentDepts.filter(d => d.id !== id);
    await get().updateSettings({ departments: newDepts });
  },
}));
