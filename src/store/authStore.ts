import { create } from 'zustand';
import { supabase } from '../supabase';

export type AppRole = 'Admin' | 'Manager' | 'Employee';
export type AppPermission = 'View' | 'Edit' | 'Full Access';

export interface EmployeeProfile {
  uid: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  position: string;
  department: string;
  status: 'Active' | 'Inactive';
  role: AppRole;
  permissions: AppPermission[];
  createdAt: string;
}

interface AuthState {
  user: any | null;
  profile: EmployeeProfile | null;
  isAdmin: boolean;
  isLoading: boolean;
  error: string | null;
  init: () => void;
  login: (email: string, password: string, rememberMe: boolean) => Promise<void>;
  logout: () => void;
  resetPassword: (email: string) => Promise<void>;
  setError: (error: string | null) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  isAdmin: false,
  isLoading: true,
  error: null,
  init: () => {
    // Safety timeout to prevent infinite loading
    const safetyTimeout = setTimeout(() => {
      if (get().isLoading) {
        console.warn("Auth initialization timed out. Supabase might be unreachable.");
        set({ isLoading: false });
      }
    }, 20000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const user = session?.user;
      if (user) {
        try {
          // Add timeout to profile fetch
          const fetchProfile = supabase
            .from('employees')
            .select('*')
            .eq('uid', user.id)
            .single();
            
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Profile fetch timeout')), 15000)
          );
          
          const response = await Promise.race([fetchProfile, timeoutPromise]) as any;
          const profileData = response?.data;
          const profileError = response?.error;

          let profile: EmployeeProfile;
          
          if (profileData) {
            profile = profileData as EmployeeProfile;
            if (profile.status === 'Inactive') {
              await supabase.auth.signOut();
              clearTimeout(safetyTimeout);
              set({ user: null, profile: null, isAdmin: false, isLoading: false, error: 'Account is deactivated. Please contact your administrator.' });
              return;
            }
          } else {
            // Auto-create profile for the initial admin
            if (user.email === 'heshamgoo39@gmail.com' || user.email === 'moahmednoury@gmail.com') {
              profile = {
                uid: user.id,
                fullName: 'System Admin',
                email: user.email || '',
                phoneNumber: '',
                position: 'System Administrator',
                department: 'Management',
                status: 'Active',
                role: 'Admin',
                permissions: ['Full Access'],
                createdAt: new Date().toISOString()
              };
              // Don't await this if we're just trying to load the app quickly
              supabase.from('employees').insert([profile]).then(({ error }) => {
                if (error) console.error(error);
              });
            } else {
              await supabase.auth.signOut();
              clearTimeout(safetyTimeout);
              set({ user: null, profile: null, isAdmin: false, isLoading: false, error: 'Account not found. Please contact your administrator.' });
              return;
            }
          }
          
          const isSuperAdmin = user.email === 'heshamgoo39@gmail.com' || user.email === 'moahmednoury@gmail.com';
          
          clearTimeout(safetyTimeout);
          set({ 
            user, 
            profile: profile || {
              uid: user.id,
              fullName: 'System Admin',
              email: user.email || '',
              phoneNumber: '',
              position: 'System Administrator',
              department: 'Management',
              status: 'Active',
              role: 'Admin',
              permissions: ['Full Access'],
              createdAt: new Date().toISOString()
            }, 
            isAdmin: isSuperAdmin || (profile?.role === 'Admin'), 
            isLoading: false 
          });
        } catch (error: any) {
          if (error.message === 'Profile fetch timeout') {
            console.warn("Profile fetch is taking too long. Proceeding with offline mode if possible.");
          } else {
            console.error("Error fetching profile:", error);
          }
          const isSuperAdmin = user?.email === 'heshamgoo39@gmail.com' || user?.email === 'moahmednoury@gmail.com';
          clearTimeout(safetyTimeout);
          set({ 
            user, 
            isAdmin: isSuperAdmin,
            profile: isSuperAdmin ? {
              uid: user.id,
              fullName: 'System Admin (Offline Mode)',
              email: user.email || '',
              phoneNumber: '',
              position: 'System Administrator',
              department: 'Management',
              status: 'Active',
              role: 'Admin',
              permissions: ['Full Access'],
              createdAt: new Date().toISOString()
            } : null,
            isLoading: false 
          });
        }
      } else {
        clearTimeout(safetyTimeout);
        set({ user: null, profile: null, isAdmin: false, isLoading: false });
      }
    });

    // Initial session check
    const checkSession = supabase.auth.getSession();
    const sessionTimeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Session check timeout')), 15000)
    );
    
    Promise.race([checkSession, sessionTimeout]).then((response: any) => {
      const { data, error } = response;
      const session = data?.session;
      
      if (error) {
        console.error("Session error:", error);
        if (error.message?.includes('Refresh Token Not Found') || error.message?.includes('Failed to fetch')) {
          // Clear any stale auth data
          localStorage.removeItem('sb-nuhxteyefjlweqmxvjnd-auth-token');
          supabase.auth.signOut().catch(console.error);
        }
        clearTimeout(safetyTimeout);
        set({ user: null, profile: null, isAdmin: false, isLoading: false });
      } else if (!session) {
        clearTimeout(safetyTimeout);
        set({ user: null, profile: null, isAdmin: false, isLoading: false });
      }
    }).catch(err => {
      if (err.message === 'Session check timeout') {
        console.warn("Supabase session check is taking too long. Proceeding with offline mode if possible.");
      } else {
        console.error("Session check failed:", err);
        // Clear any stale auth data
        localStorage.removeItem('sb-nuhxteyefjlweqmxvjnd-auth-token');
        set({ user: null, profile: null, isAdmin: false });
      }
      clearTimeout(safetyTimeout);
      set({ isLoading: false });
    });
  },
  login: async (email, password, rememberMe) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase(),
        password,
      });

      if (error) {
        if (error.message.includes('Failed to fetch') || error.message.includes('Refresh Token Not Found')) {
          // Fallback for when Supabase is paused/unreachable
          if ((email.toLowerCase() === 'heshamgoo39@gmail.com' || email.toLowerCase() === 'moahmednoury@gmail.com') && password === '123456') {
            console.warn("Supabase is unreachable. Using mock session for admin.");
            const mockUser = {
              id: 'mock-admin-id',
              email: email.toLowerCase(),
              role: 'authenticated',
              aud: 'authenticated',
              app_metadata: {},
              user_metadata: {},
              created_at: new Date().toISOString(),
            };
            const mockProfile: EmployeeProfile = {
              uid: 'mock-admin-id',
              fullName: 'System Admin (Offline Mode)',
              email: email.toLowerCase(),
              phoneNumber: '',
              position: 'System Administrator',
              department: 'Management',
              status: 'Active',
              role: 'Admin',
              permissions: ['Full Access'],
              createdAt: new Date().toISOString()
            };
            set({
              user: mockUser,
              profile: mockProfile,
              isAdmin: true,
              isLoading: false,
              error: null
            });
            return;
          } else {
            throw new Error('Network error. Please check your connection to the database. The Supabase project might be paused.');
          }
        }
        
        // Auto-create the initial admin accounts if they don't exist yet
        if (error.message.includes('Invalid login credentials')) {
          if ((email.toLowerCase() === 'heshamgoo39@gmail.com' || email.toLowerCase() === 'moahmednoury@gmail.com') && password === '123456') {
            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
              email: email.toLowerCase(),
              password,
            });

            if (signUpError) {
              throw signUpError;
            }

            if (signUpData.user) {
              const uid = signUpData.user.id;
              const profile: EmployeeProfile = {
                uid,
                fullName: 'System Admin',
                email: email.toLowerCase(),
                phoneNumber: '',
                position: 'System Administrator',
                department: 'Management',
                status: 'Active',
                role: 'Admin',
                permissions: ['Full Access'],
                createdAt: new Date().toISOString()
              };
              
              const { error: insertError } = await supabase.from('employees').insert([profile]);
              if (insertError) {
                console.error("Error creating employee profile:", insertError);
              }
              
              // After successful signup, we need to sign in again to get the session
              const { error: signInAfterSignUpError } = await supabase.auth.signInWithPassword({
                email: email.toLowerCase(),
                password,
              });
              
              if (signInAfterSignUpError) {
                throw signInAfterSignUpError;
              }
            }
          } else {
            throw new Error('Invalid email or password');
          }
        } else {
          throw error;
        }
      }
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  logout: async () => {
    await supabase.auth.signOut();
    set({ user: null, profile: null, isAdmin: false });
  },
  resetPassword: async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
    } catch (error: any) {
      throw error;
    }
  },
  setError: (error) => set({ error }),
}));
