import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);
const API = axios.create({ baseURL: '/api' });

API.interceptors.request.use(cfg => {
  const token = localStorage.getItem('curi_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('curi_token');
    if (token) fetchMe();
    else setLoading(false);
  }, []);

  const applySession = (data) => {
    setUser(data.user);
    setWorkspace(data.workspace ?? null);
  };

  const fetchMe = async () => {
    try {
      const { data } = await API.get('/auth/me', { timeout: 20000 });
      applySession(data);
    } catch {
      localStorage.removeItem('curi_token');
      setUser(null);
      setWorkspace(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const { data } = await API.post('/auth/login', { email, password });
    localStorage.setItem('curi_token', data.token);
    applySession(data);
    return data;
  };

  const register = async (name, email, password, inviteToken) => {
    const { data } = await API.post('/auth/register', { name, email, password, inviteToken });
    localStorage.setItem('curi_token', data.token);
    applySession(data);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('curi_token');
    setUser(null);
    setWorkspace(null);
  };

  const workspaceId = workspace?._id ?? user?.currentWorkspace ?? null;

  return (
    <AuthContext.Provider value={{ user, workspace, workspaceId, setWorkspace, loading, login, register, logout, fetchMe, API }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
export { API };
