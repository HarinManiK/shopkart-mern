import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { fetchMe, loginCustomer, logoutCustomer } from '../services/api';

const AuthContext = createContext(null);

// The user is never stored by hand: the source of truth is the HttpOnly cookie,
// and we ask the server who we are (GET /customers/me) on load and after login.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const me = await fetchMe();
      setUser(me);
      return me;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetchMe()
      .then((me) => active && setUser(me))
      .catch(() => active && setUser(null))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const login = async (credentials) => {
    await loginCustomer(credentials);
    return refreshUser();
  };

  const logout = async () => {
    try {
      await logoutCustomer();
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
