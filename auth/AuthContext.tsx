import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../supabase';
import { User } from '@supabase/supabase-js';
import { UserRole } from '../types';
import { getUserRole } from '../services/supabase.service';

// Augmented user that exposes `uid` (Firebase-style) and `displayName`
// so existing components keep working with the Supabase auth user.
export interface AppUser extends User {
  uid: string;
  displayName: string;
}

const mapUser = (u: User | null): AppUser | null => {
  if (!u) return null;
  return {
    ...u,
    uid: u.id,
    displayName:
      (u.user_metadata?.display_name as string) ||
      (u.user_metadata?.name as string) ||
      (u.email ? u.email.split('@')[0] : ''),
  };
};

const getMetadataRole = (u: User | null | undefined): UserRole => {
  const role = u?.user_metadata?.role;
  return Object.values(UserRole).includes(role as UserRole) ? (role as UserRole) : UserRole.GUEST;
};

interface AuthContextType {
  user: AppUser | null;
  role: UserRole;
  loading: boolean;
  logout: () => Promise<void>;
  refreshRole: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: UserRole.GUEST,
  loading: true,
  logout: async () => {},
  refreshRole: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [role, setRole] = useState<UserRole>(UserRole.GUEST);
  const [loading, setLoading] = useState(true);

  const fetchRole = async (userId: string, retries = 3, fallbackRole = UserRole.GUEST) => {
    try {
      const fetchedRole = await getUserRole(userId);
      if (!fetchedRole) {
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          return fetchRole(userId, retries - 1, fallbackRole);
        }
        setRole(fallbackRole);
        return;
      }

      setRole(fetchedRole);
    } catch (error) {
      console.error('Error fetching role:', error);
      setRole(fallbackRole);
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(mapUser(session?.user ?? null));
      if (session?.user) {
        await fetchRole(session.user.id, 3, getMetadataRole(session.user));
      } else {
        setRole(UserRole.GUEST);
      }
      setLoading(false);
    };

    initializeAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(mapUser(session?.user ?? null));
      if (session?.user) {
        await fetchRole(session.user.id, 3, getMetadataRole(session.user));
      } else {
        setRole(UserRole.GUEST);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    setRole(UserRole.GUEST);
  };

  const refreshRole = async () => {
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();
    if (currentUser) {
      await fetchRole(currentUser.id, 3, getMetadataRole(currentUser));
    }
  };

  return (
    <AuthContext.Provider value={{ user, role, loading, logout, refreshRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
