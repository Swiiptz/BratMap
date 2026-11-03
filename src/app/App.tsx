import { useCallback, useEffect, useState } from 'react';
import { redo, undo } from '../data/history';
import { autoBackupIfDue } from '../data/autoBackup';
import { Navigation } from '../components/layout/Navigation';
import { ChronicleProvider, useChronicle } from '../data/ChronicleProvider';
import type { EntityRef } from '../domain/chronicle';
import { CharactersPage } from '../features/characters/CharactersPage';
import { MapPage } from '../features/map/MapPage';
import { PlotsPage } from '../features/plots/PlotsPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { routeForEntity, useRoute } from './router';
import { dismissSplash } from './splash';

/** Retire l'écran de chargement dès que la chronique a répondu (ou en erreur). */
function SplashDismiss() {
  const { loaded, loadError } = useChronicle();
  useEffect(() => {
    if (loaded || loadError) dismissSplash();
  }, [loaded, loadError]);
  return null;
}

export function App() {
  const [route, navigate] = useRoute();
  const [fullscreen, setFullscreen] = useState(false);
  const openEntity = useCallback((ref: EntityRef) => navigate(routeForEntity(ref)), [navigate]);
  const showOnMap = useCallback((ref: EntityRef) => navigate({ view: 'map', focus: ref }), [navigate]);
  const isMapFullscreen = fullscreen && route.view === 'map';
  const [notice, setNotice] = useState('');

  // Annuler / rétablir global (Ctrl+Z, Ctrl+Y ou Ctrl+Maj+Z) ; la carte traite d'abord ses tracés en cours.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || !(event.ctrlKey || event.metaKey)) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
      const key = event.key.toLowerCase();
      const action = key === 'z' && !event.shiftKey ? undo : key === 'y' || (key === 'z' && event.shiftKey) ? redo : undefined;
      if (!action) return;
      event.preventDefault();
      void action()
        .then((label) => label && setNotice(`${action === undo ? 'Annulé' : 'Rétabli'} : ${label}`))
        .catch((error: unknown) => setNotice(error instanceof Error ? error.message : 'Action impossible.'));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  // Sauvegarde quotidienne locale, une fois les données chargées.
  useEffect(() => {
    const timer = window.setTimeout(() => void autoBackupIfDue(), 15_000);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 2800);
    return () => window.clearTimeout(timer);
  }, [notice]);

  return (
    <ChronicleProvider>
      <SplashDismiss />
      <div className="app-shell">
        {!isMapFullscreen && <Navigation activeView={route.view} onViewChange={(view) => navigate({ view })} onNotice={setNotice} />}
        {notice && <div className="toast global-toast">{notice}</div>}
        <main className="app-main">
          {route.view === 'map' && (
            <MapPage
              select={route.select}
              focus={route.focus}
              position={route.position}
              navigate={navigate}
              onOpen={openEntity}
              fullscreen={isMapFullscreen}
              onToggleFullscreen={() => setFullscreen((value) => !value)}
            />
          )}
          {route.view === 'characters' && (
            <CharactersPage selectedId={route.id} onSelect={(id) => navigate({ view: 'characters', id }, true)} onOpen={openEntity} onShowOnMap={showOnMap} />
          )}
          {route.view === 'plots' && <PlotsPage selectedId={route.id} onSelect={(id) => navigate({ view: 'plots', id }, true)} onOpen={openEntity} onShowOnMap={showOnMap} />}
          {route.view === 'settings' && <SettingsPage key={route.id} onOpen={openEntity} initialTab={route.id} />}
        </main>
      </div>
    </ChronicleProvider>
  );
}
