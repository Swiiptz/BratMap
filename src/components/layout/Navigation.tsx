import type { AppView } from '../../app/router';
import { store } from '../../data';
import { useChronicle } from '../../data/ChronicleProvider';
import { useSaveStatus } from '../../data/saveStatus';
import { redo, undo, useHistory } from '../../data/history';
import { Icon } from '../Pickers';
import { envLabel, envTitle } from '../../app/environment';
import { RavnosMark } from '../RavnosMark';

const items: Array<{ id: AppView; label: string; icon: string }> = [
  { id: 'map', label: 'Carte', icon: 'map' },
  { id: 'characters', label: 'Personnages', icon: 'users' },
  { id: 'plots', label: 'Plots', icon: 'plot' },
  { id: 'settings', label: 'Réglages', icon: 'sliders' },
];
const statusLabel = { saved: 'Enregistré', saving: 'Sauvegarde…', error: 'Erreur' } as const;

/** Rail de navigation étroit : la carte garde le maximum de place (CDC §15). */
export function Navigation({ activeView, onViewChange, onNotice }: { activeView: AppView; onViewChange: (view: AppView) => void; onNotice: (message: string) => void }) {
  const save = useSaveStatus();
  const history = useHistory();
  const run = (action: typeof undo, verb: string) =>
    void action()
      .then((label) => label && onNotice(`${verb} : ${label}`))
      .catch((error: unknown) => onNotice(error instanceof Error ? error.message : 'Action impossible.'));
  const { loadError } = useChronicle();
  const status = loadError ? 'error' : save.status;
  const mode = store.mode === 'firestore' ? 'Firestore, synchronisé en temps réel' : 'Mode local (ce navigateur uniquement)';
  return (
    <nav className="primary-nav" aria-label="Navigation principale">
      <div className="brand-mark" title="bratMap · chronique">
        <RavnosMark size={34} className="brand-emblem" />
      </div>
      {envLabel && (
        <span className="env-badge" title={envTitle}>
          {envLabel}
        </span>
      )}
      <div className="nav-links">
        {items.map((item) => (
          <button
            className={activeView === item.id ? 'nav-item active' : 'nav-item'}
            key={item.id}
            onClick={() => onViewChange(item.id)}
            aria-current={activeView === item.id ? 'page' : undefined}
          >
            <Icon id={item.icon} size={20} />
            <em>{item.label}</em>
          </button>
        ))}
      </div>
      <div className="nav-history" role="group" aria-label="Historique">
        <button
          disabled={!history.canUndo}
          title={history.nextUndo ? `Annuler : ${history.nextUndo} (Ctrl+Z)` : 'Rien à annuler'}
          aria-label="Annuler"
          onClick={() => run(undo, 'Annulé')}
        >
          <Icon id="undo" size={17} />
        </button>
        <button disabled={!history.canRedo} title="Rétablir (Ctrl+Y)" aria-label="Rétablir" onClick={() => run(redo, 'Rétabli')}>
          <Icon id="redo" size={17} />
        </button>
      </div>
      <div className={`nav-status ${status}`} title={`${statusLabel[status]} · ${loadError ?? save.message ?? mode}`} role="status">
        <i />
        <small>{statusLabel[status]}</small>
      </div>
    </nav>
  );
}
