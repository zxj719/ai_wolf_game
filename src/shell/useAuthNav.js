import { useCallback } from 'react';
import { ROUTES } from './paths';

/**
 * 认证导航副作用 — login/logout/guest 之后该跳到哪里。
 *
 * 从 App.jsx 抽出的 handler 集合。Router 和 AuthPage 都会用。
 *
 * @param {object} args
 * @param {(path: string, opts?: {replace?: boolean}) => void} args.navigate
 * @param {() => Promise<void>|void} args.logout
 * @param {(flag: boolean) => void} args.setIsGuestMode
 */
export function useAuthNav({ navigate, logout, setIsGuestMode }) {
  const enterGuestMode = useCallback(() => {
    setIsGuestMode(true);
    navigate(ROUTES.HOME, { replace: true });
  }, [navigate, setIsGuestMode]);

  const exitGuestMode = useCallback(() => {
    setIsGuestMode(false);
    navigate(ROUTES.LOGIN, { replace: true });
  }, [navigate, setIsGuestMode]);

  const handleLoginSuccess = useCallback(() => {
    setIsGuestMode(false);
    navigate(ROUTES.HOME, { replace: true });
  }, [navigate, setIsGuestMode]);

  const handleLogout = useCallback(async () => {
    await logout?.();
    setIsGuestMode(false);
    navigate(ROUTES.LOGIN, { replace: true });
  }, [logout, navigate, setIsGuestMode]);

  return { enterGuestMode, exitGuestMode, handleLoginSuccess, handleLogout };
}
