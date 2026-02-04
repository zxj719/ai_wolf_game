import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService } from '../services/authService';
import { getToken, setToken, removeToken, setStoredUser, getStoredUser, clearAuth } from '../utils/authToken';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modelscopeToken, setModelscopeToken] = useState(null);
  const [tokenStatus, setTokenStatus] = useState({
    hasToken: false,
    isValid: false,
    verifiedAt: null
  });

  // 初始化：检查本地Token并验证
  useEffect(() => {
    const initAuth = async () => {
      const token = getToken();
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        // 先尝试从本地获取用户信息
        const storedUser = getStoredUser();
        if (storedUser) {
          setUser(storedUser);
        }

        // 验证token并获取最新用户信息
        const response = await authService.getProfile(token);
        if (response.success && response.user) {
          setUser(response.user);
          setStoredUser(response.user);

          // 更新令牌状态
          setTokenStatus({
            hasToken: response.user.hasModelscopeToken || false,
            isValid: response.user.hasModelscopeToken || false,
            verifiedAt: response.user.tokenVerifiedAt
          });

          // 如果有令牌，获取完整令牌用于 AI 调用
          if (response.user.hasModelscopeToken) {
            try {
              const tokenResponse = await authService.getModelscopeToken(token);
              if (tokenResponse.success && tokenResponse.token) {
                setModelscopeToken(tokenResponse.token);
              }
            } catch (tokenErr) {
              console.error('Failed to load modelscope token:', tokenErr);
            }
          }
        }
      } catch (err) {
        console.error('Auth init error:', err);
        // Token无效，清除本地数据
        clearAuth();
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  // 注册
  const register = useCallback(async (username, email, password) => {
    setError(null);
    try {
      const response = await authService.register(username, email, password);
      if (response.success) {
        setToken(response.token);
        setStoredUser(response.user);
        setUser(response.user);
        return { success: true };
      }
      return { success: false, error: 'Registration failed' };
    } catch (err) {
      const errorMessage = err.message || 'Registration failed';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, []);

  // 登录
  const login = useCallback(async (email, password) => {
    setError(null);
    try {
      const response = await authService.login(email, password);
      if (response.success) {
        setToken(response.token);
        setStoredUser(response.user);
        setUser(response.user);
        return { success: true };
      }
      return { success: false, error: 'Login failed' };
    } catch (err) {
      const errorMessage = err.message || 'Login failed';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, []);

  // 登出
  const logout = useCallback(async () => {
    try {
      const token = getToken();
      if (token) {
        await authService.logout(token);
      }
    } finally {
      clearAuth();
      setUser(null);
      setError(null);
    }
  }, []);

  // 更新用户信息
  const updateProfile = useCallback(async (data) => {
    setError(null);
    try {
      const token = getToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await authService.updateProfile(token, data);
      if (response.success && response.user) {
        setUser(prev => ({ ...prev, ...response.user }));
        setStoredUser({ ...user, ...response.user });
        return { success: true };
      }
      return { success: false, error: 'Update failed' };
    } catch (err) {
      const errorMessage = err.message || 'Update failed';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, [user]);

  // 刷新用户信息
  const refreshUser = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    try {
      const response = await authService.getProfile(token);
      if (response.success && response.user) {
        setUser(response.user);
        setStoredUser(response.user);

        // 更新令牌状态
        setTokenStatus({
          hasToken: response.user.hasModelscopeToken || false,
          isValid: response.user.hasModelscopeToken || false,
          verifiedAt: response.user.tokenVerifiedAt
        });
      }
    } catch (err) {
      console.error('Refresh user error:', err);
    }
  }, []);

  // 更新 ModelScope 令牌
  const updateModelscopeToken = useCallback(async (newToken) => {
    const authToken = getToken();
    if (!authToken) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await authService.saveModelscopeToken(authToken, newToken);
      if (response.success) {
        setModelscopeToken(newToken);
        setTokenStatus({
          hasToken: true,
          isValid: true,
          verifiedAt: response.tokenVerifiedAt
        });
        return { success: true };
      }
      return { success: false, error: 'Failed to save token' };
    } catch (err) {
      const errorMessage = err.message || 'Failed to save token';
      return { success: false, error: errorMessage };
    }
  }, []);

  // 验证 ModelScope 令牌
  const verifyModelscopeToken = useCallback(async () => {
    const authToken = getToken();
    if (!authToken) return { hasToken: false, isValid: false };

    try {
      const response = await authService.verifyModelscopeToken(authToken);
      if (response.success) {
        setTokenStatus({
          hasToken: response.hasToken,
          isValid: response.isValid,
          verifiedAt: response.tokenVerifiedAt
        });

        // 如果令牌有效，获取完整令牌
        if (response.isValid) {
          const tokenResponse = await authService.getModelscopeToken(authToken);
          if (tokenResponse.success && tokenResponse.token) {
            setModelscopeToken(tokenResponse.token);
          }
        }

        return response;
      }
      return { hasToken: false, isValid: false };
    } catch (err) {
      console.error('Verify token error:', err);
      return { hasToken: false, isValid: false };
    }
  }, []);

  // 删除 ModelScope 令牌
  const deleteModelscopeToken = useCallback(async () => {
    const authToken = getToken();
    if (!authToken) return { success: false };

    try {
      const response = await authService.deleteModelscopeToken(authToken);
      if (response.success) {
        setModelscopeToken(null);
        setTokenStatus({
          hasToken: false,
          isValid: false,
          verifiedAt: null
        });
      }
      return response;
    } catch (err) {
      console.error('Delete token error:', err);
      return { success: false, error: err.message };
    }
  }, []);

  const value = {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    modelscopeToken,
    tokenStatus,
    register,
    login,
    logout,
    updateProfile,
    refreshUser,
    updateModelscopeToken,
    verifyModelscopeToken,
    deleteModelscopeToken
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
