import { createContext, useContext, useEffect, useState } from 'react';
import axios from 'axios';

const SiteAccessContext = createContext(null);
const STORAGE_KEY = 'curi_site_access';
const API = axios.create({ baseURL: '/api' });

export const SiteAccessProvider = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [granted, setGranted] = useState(false);

  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    const token = localStorage.getItem(STORAGE_KEY);
    try {
      const { data } = await API.get('/access/status', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        timeout: 15000,
      });
      setEnabled(Boolean(data.enabled));
      setGranted(Boolean(data.granted));
      if (data.enabled && !data.granted) {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // If the check fails, don't block local dev without env configured.
      setEnabled(false);
      setGranted(true);
    } finally {
      setLoading(false);
    }
  };

  const verify = async (username, code) => {
    const { data } = await API.post('/access/verify', { username, code });
    if (data.token) {
      localStorage.setItem(STORAGE_KEY, data.token);
    }
    setEnabled(!data.disabled);
    setGranted(true);
    return data;
  };

  const value = {
    loading,
    enabled,
    granted,
    needsGate: enabled && !granted,
    verify,
  };

  return (
    <SiteAccessContext.Provider value={value}>
      {children}
    </SiteAccessContext.Provider>
  );
};

export const useSiteAccess = () => useContext(SiteAccessContext);
