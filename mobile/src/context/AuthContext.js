import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken, onUnauthorized } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setTokenState] = useState(null);
  const [booting, setBooting] = useState(true);
  const [needsProfile, setNeedsProfile] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      const profile = await api('/api/auth/me');
      setUser(profile);
      return profile;
    } catch (err) {
      await setToken(null);
      setTokenState(null);
      setUser(null);
      return null;
    }
  }, []);

  const boot = useCallback(async () => {
    try {
      const stored = await getToken();
      if (stored) {
        setTokenState(stored);
        await loadProfile();
      }
    } finally {
      setBooting(false);
    }
  }, [loadProfile]);

  useEffect(() => {
    boot();
  }, [boot]);

  useEffect(() => onUnauthorized(() => {
    setTokenState(null);
    setUser(null);
  }), []);

  const requestOtp = useCallback(async (phone) => api('/api/auth/otp/request', { method: 'POST', body: { phone } }), []);

  const verifyOtp = useCallback(async ({ phone, code, fcmToken, platform }) => {
    const data = await api('/api/auth/otp/verify', {
      method: 'POST',
      body: { phone, code, fcmToken, platform },
    });
    await setToken(data.token);
    setTokenState(data.token);
    setUser(data.user);
    setNeedsProfile(Boolean(data.isNewUser));
    return data;
  }, []);

  /** First-login profile completion (name / email). */
  const completeProfile = useCallback(async (patch) => {
    const profile = await api('/api/auth/me', { method: 'PATCH', body: patch });
    setUser(profile);
    setNeedsProfile(false);
    return profile;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api('/api/auth/logout', { method: 'POST', body: {} });
    } catch (err) { /* token may already be invalid */ }
    await setToken(null);
    setTokenState(null);
    setUser(null);
    setNeedsProfile(false);
  }, []);

  const refresh = useCallback(() => loadProfile(), [loadProfile]);

  const value = useMemo(
    () => ({
      user,
      token,
      booting,
      needsProfile,
      isSignedIn: Boolean(token && user),
      isResident: user?.role === 'resident',
      isSecurity: user?.role === 'security',
      isAdmin: user?.role === 'admin',
      requestOtp,
      verifyOtp,
      completeProfile,
      logout,
      refresh,
      setUser,
    }),
    [user, token, booting, needsProfile, requestOtp, verifyOtp, completeProfile, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

export default AuthContext;
