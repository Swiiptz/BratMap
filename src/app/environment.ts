import { store } from '../data';

/**
 * Environnement d'exécution : libellé affiché dans la barre (dev, recette…) et mode de données.
 * Rien en production avec Firestore : la barre reste sobre pour les joueurs.
 */
const explicit = (import.meta.env.VITE_ENV_LABEL as string | undefined)?.trim();
export const envLabel = explicit || (import.meta.env.DEV ? (store.mode === 'local' ? 'dev · local' : 'dev') : store.mode === 'local' ? 'local' : '');
export const envTitle = `${import.meta.env.MODE} · ${store.mode === 'firestore' ? `Firestore (${import.meta.env.VITE_FIREBASE_PROJECT_ID})` : 'données locales au navigateur'}`;
