import { describe, expect, it } from 'vitest';
import { resolveNavigation } from '../navGuards';
import home from '../../modules/home';
import { ROUTES } from '../paths';

describe('public home and guest navigation', () => {
  it('opens the personal home without a saved session', () => {
    expect(resolveNavigation({ route: home.routes[0], isAuthed: false, normalizedPath: '/' }).kind).toBe('render');
  });
  it('lets guests explicitly open sign in', () => {
    expect(resolveNavigation({ route: { requiresAuth: false }, isAuthed: false, isGuestMode: true, normalizedPath: ROUTES.LOGIN }).kind).toBe('render');
  });
  it('lets guests refresh a project route without returning to sign in', () => {
    expect(resolveNavigation({ route: { requiresAuth: true }, isAuthed: false, isGuestMode: true, normalizedPath: ROUTES.WEREWOLF_SETUP }).kind).toBe('render');
  });
});
