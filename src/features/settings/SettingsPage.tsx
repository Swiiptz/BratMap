import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { ConfirmButton, resolveReferential } from '../../components/forms';
import { ColorPalette, IconPicker, PingPreview } from '../../components/Pickers';
import { resolveIcon } from '../../domain/icons';
import { exportBackup, importBackup, parseBackup, saveAppConfig, store, type StoredDocument } from '../../data';
import type { AppConfig, LabelDensity, UndergroundStyle } from '../../domain/appConfig';
import { createBackupNow, KEEP, listBackups, type AutoBackup } from '../../data/autoBackup';
import { useChronicle } from '../../data/ChronicleProvider';
import { formatDate, toMillis } from '../../data/store';
import type { EntityRef } from '../../domain/chronicle';
import { entityCollections, referentialCollections, type EntityCollection, type Referential, type ReferentialCollection } from '../../domain/models';

type Tab = 'referentials' | 'display' | 'recent' | 'trash' | 'backup';
const tabs: Array<{ id: Tab; label: string }> = [
  { id: 'referentials', label: 'Référentiels' },
  { id: 'display', label: 'Affichage' },
  { id: 'recent', label: 'Modifications récentes' },
  { id: 'trash', label: 'Corbeille' },
  { id: 'backup', label: 'Sauvegarde' },
];

export function SettingsPage({ onOpen, initialTab }: { onOpen: (ref: EntityRef) => void; initialTab?: string }) {
  const [tab, setTab] = useState<Tab>(tabs.some((item) => item.id === initialTab) ? (initialTab as Tab) : 'referentials');
  return (
    <section className="module-page">
      <header className="module-header">
        <div>
          <span className="eyebrow">BRATMAP / CONFIGURATION</span>
          <h1>Paramètres</h1>
          <p>Référentiels partagés, historique léger, corbeille et sauvegardes.</p>
        </div>
      </header>
      <div className="tabs" role="tablist">
        {tabs.map((item) => (
          <button key={item.id} role="tab" aria-selected={tab === item.id} className={tab === item.id ? 'tab active' : 'tab'} onClick={() => setTab(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      {tab === 'referentials' && <ReferentialsTab />}
      {tab === 'display' && <DisplayTab />}
      {tab === 'recent' && <RecentTab onOpen={onOpen} />}
      {tab === 'trash' && <TrashTab />}
      {tab === 'backup' && <BackupTab />}
    </section>
  );
}

function ReferentialsTab() {
  const { refs } = useChronicle();
  const [collection, setCollection] = useState<ReferentialCollection>('markerTypes');
  const [newName, setNewName] = useState('');
  const items = refs[collection];

  const add = async () => {
    if (!newName.trim()) return;
    await resolveReferential(collection, items, newName);
    setNewName('');
  };

  return (
    <div className="settings-layout">
      <nav className="settings-nav">
        {(Object.keys(referentialCollections) as ReferentialCollection[]).map((key) => (
          <button key={key} className={collection === key ? 'active' : ''} onClick={() => setCollection(key)}>
            {referentialCollections[key]} <small>{refs[key].length}</small>
          </button>
        ))}
      </nav>
      <div className="settings-panel">
        <h2>{referentialCollections[collection]}</h2>
        <p className="muted">Les noms sont réutilisés par l'autocomplétion des fiches. Désactiver un élément le retire des suggestions sans casser les fiches qui l'utilisent.</p>
        <div className="ref-table">
          {items.map((item) => (
            <ReferentialRow key={item.id} collection={collection} item={item} />
          ))}
        </div>
        <form
          className="ref-add"
          onSubmit={(event) => {
            event.preventDefault();
            void add();
          }}
        >
          <input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Nouvel élément…" />
          <button className="primary-button">Ajouter</button>
        </form>
      </div>
    </div>
  );
}

function ReferentialRow({ collection, item }: { collection: ReferentialCollection; item: Referential }) {
  const [name, setName] = useState(item.name);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => setName(item.name), [item.name]);
  const save = (values: Partial<Referential>) => void store.update(collection, item.id, values);
  const isMarker = collection === 'markerTypes';
  return (
    <div className={item.active === false ? 'ref-row inactive' : 'ref-row'}>
      <button type="button" className="ref-look" onClick={() => setExpanded(!expanded)} title="Couleur et icône" aria-expanded={expanded}>
        {isMarker ? (
          <PingPreview icon={resolveIcon(item.icon, 'dot')} color={item.color ?? '#9aa7ae'} />
        ) : (
          <span className="ref-swatch" style={{ background: item.color ?? '#9aa7ae' }} />
        )}
      </button>
      <input className="ref-name" value={name} onChange={(event) => setName(event.target.value)} onBlur={() => name.trim() && name !== item.name && save({ name: name.trim() })} />
      <label className="checkbox">
        <input type="checkbox" checked={item.active !== false} onChange={(event) => save({ active: event.target.checked })} /> actif
      </label>
      <ConfirmButton label="Supprimer" onConfirm={() => void store.remove(collection, item.id)} />
      {expanded && (
        <div className="ref-editor">
          <ColorPalette value={item.color} onChange={(color) => save({ color })} />
          {isMarker && <IconPicker value={resolveIcon(item.icon, 'dot')} color={item.color} onChange={(icon) => save({ icon })} />}
        </div>
      )}
    </div>
  );
}

function RecentTab({ onOpen }: { onOpen: (ref: EntityRef) => void }) {
  const data = useChronicle();
  const recent = useMemo(
    () =>
      (Object.keys(entityCollections) as EntityCollection[])
        .flatMap((collection) => (data[collection] as Array<{ id: string; name?: string; updatedAt?: unknown; createdAt?: unknown }>).map((item) => ({ collection, item })))
        .sort((a, b) => (toMillis(b.item.updatedAt) ?? 0) - (toMillis(a.item.updatedAt) ?? 0))
        .slice(0, 40),
    [data],
  );
  return (
    <div className="settings-panel wide">
      {recent.length === 0 && <p className="muted">Aucune modification pour l'instant.</p>}
      {recent.map(({ collection, item }) => (
        <button key={`${collection}/${item.id}`} className="history-row" onClick={() => onOpen({ collection, id: item.id })}>
          <span>{item.name || 'Sans nom'}</span>
          <small>{entityCollections[collection]}</small>
          <time>
            {toMillis(item.updatedAt) === toMillis(item.createdAt) ? 'créé' : 'modifié'} {formatDate(item.updatedAt)}
          </time>
        </button>
      ))}
    </div>
  );
}

function TrashTab() {
  const [trash, setTrash] = useState<Partial<Record<EntityCollection, StoredDocument[]>>>({});
  useEffect(() => {
    const unsubscribes = (Object.keys(entityCollections) as EntityCollection[]).map((collection) =>
      store.subscribe(collection, (items) => setTrash((current) => ({ ...current, [collection]: items })), console.error, 'only'),
    );
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, []);
  const rows = (Object.keys(trash) as EntityCollection[]).flatMap((collection) => (trash[collection] ?? []).map((item) => ({ collection, item })));

  return (
    <div className="settings-panel wide">
      <p className="muted">Les éléments supprimés restent ici jusqu'à leur suppression définitive.</p>
      {rows.length === 0 && <p className="muted">La corbeille est vide.</p>}
      {rows.map(({ collection, item }) => (
        <div key={`${collection}/${item.id}`} className="history-row">
          <span>{String(item.name ?? 'Sans nom')}</span>
          <small>{entityCollections[collection]}</small>
          <time>supprimé {formatDate(item.deletedAt)}</time>
          <button className="ghost-button" onClick={() => void store.restore(collection, item.id)}>
            Restaurer
          </button>
          <ConfirmButton label="Supprimer définitivement" onConfirm={() => void store.remove(collection, item.id)} />
        </div>
      ))}
    </div>
  );
}

function BackupTab() {
  const [message, setMessage] = useState('');
  const download = async () => {
    const backup = await exportBackup();
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `bratmap-${backup.exportedAt.slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage('Export terminé.');
  };
  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const backup = parseBackup(JSON.parse(await file.text()));
      if (!window.confirm(`Importer la sauvegarde du ${backup.exportedAt.slice(0, 10)} ? Les éléments de même identifiant seront remplacés.`)) return;
      await importBackup(backup);
      setMessage('Import terminé.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Import impossible.');
    }
  };
  return (
    <div className="settings-panel wide">
      <h2>Export / import JSON</h2>
      <p className="muted">
        L'export contient toutes les données de chronique, la corbeille et la configuration (référentiels). L'import fusionne : les éléments de même identifiant sont remplacés, les
        autres conservés.
      </p>
      <p className="muted">
        Stockage actuel : {store.mode === 'firestore' ? 'Firestore (synchronisé en temps réel)' : 'local à ce navigateur — configure Firebase pour partager les données.'}
      </p>
      <div className="sheet-actions">
        <button className="primary-button" onClick={() => void download()}>
          Exporter la sauvegarde
        </button>
        <label className="ghost-button file-button">
          Importer un fichier…
          <input type="file" accept="application/json,.json" onChange={(event) => void upload(event)} hidden />
        </label>
      </div>
      {message && <p className="muted">{message}</p>}
      <AutoBackups onMessage={setMessage} />
    </div>
  );
}

const downloadJson = (data: unknown, filename: string) => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

/** Sauvegardes quotidiennes conservées dans ce navigateur. */
function AutoBackups({ onMessage }: { onMessage: (message: string) => void }) {
  const [backups, setBackups] = useState<AutoBackup[]>();
  const refresh = () =>
    void listBackups()
      .then(setBackups)
      .catch(() => setBackups([]));
  useEffect(refresh, []);
  return (
    <section className="auto-backups">
      <h2>Sauvegardes automatiques</h2>
      <p className="muted">Une copie complète par jour, dans ce navigateur ({KEEP} dernières conservées). Exporte régulièrement un fichier pour une copie hors du navigateur.</p>
      <button className="ghost-button" onClick={() => void createBackupNow().then(() => (refresh(), onMessage('Sauvegarde créée.')))}>
        Sauvegarder maintenant
      </button>
      {backups?.length === 0 && <p className="muted">Aucune sauvegarde automatique pour l'instant.</p>}
      {backups?.map((backup) => (
        <div key={backup.id} className="history-row">
          <span>{new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full', timeStyle: 'short' }).format(backup.createdAt)}</span>
          <small>{Math.round(backup.size / 1024)} Ko</small>
          <time />
          <button className="ghost-button" onClick={() => downloadJson(backup.data, `bratmap-auto-${backup.id.slice(0, 10)}.json`)}>
            Télécharger
          </button>
          <ConfirmButton
            label="Restaurer"
            confirmLabel="Confirmer la restauration"
            className="ghost-button"
            onConfirm={() => void importBackup(backup.data).then(() => onMessage('Sauvegarde restaurée (fusion par identifiant).'))}
          />
        </div>
      ))}
    </section>
  );
}

const densityOptions: Array<{ id: LabelDensity; label: string; hint: string }> = [
  { id: 'low', label: 'Épurée', hint: 'Étiquettes seulement de près' },
  { id: 'normal', label: 'Normale', hint: 'Équilibre par défaut' },
  { id: 'high', label: 'Dense', hint: 'Étiquettes dès les vues larges' },
];
const undergroundOptions: Array<{ id: UndergroundStyle; label: string }> = [
  { id: 'fine', label: 'Fin' },
  { id: 'normal', label: 'Normal' },
  { id: 'bold', label: 'Épais' },
];

/** Réglages d'affichage partagés par les deux joueurs (enregistrés dans la base, appliqués en temps réel). */
function DisplayTab() {
  const { config } = useChronicle();
  const save = (patch: Partial<AppConfig>) => void saveAppConfig(patch);
  return (
    <div className="settings-panel wide display-settings">
      <p className="muted">Ces réglages sont communs : l'autre joueur les voit changer immédiatement.</p>
      <section>
        <h3>Densité d'information</h3>
        <div className="segmented three" role="radiogroup" aria-label="Densité d'information">
          {densityOptions.map((option) => (
            <button
              key={option.id}
              role="radio"
              aria-checked={config.labelDensity === option.id}
              className={config.labelDensity === option.id ? 'selected' : ''}
              title={option.hint}
              onClick={() => save({ labelDensity: option.id })}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>
      <section>
        <h3>Style des souterrains</h3>
        <div className="segmented three" role="radiogroup" aria-label="Style des souterrains">
          {undergroundOptions.map((option) => (
            <button
              key={option.id}
              role="radio"
              aria-checked={config.undergroundStyle === option.id}
              className={config.undergroundStyle === option.id ? 'selected' : ''}
              onClick={() => save({ undergroundStyle: option.id })}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>
      <section>
        <h3>Fondu hors zone · {Math.round(config.fadeIntensity * 100)} %</h3>
        <input
          className="range"
          type="range"
          min={0}
          max={1}
          step={0.05}
          defaultValue={config.fadeIntensity}
          key={config.fadeIntensity}
          onPointerUp={(event) => save({ fadeIntensity: Number(event.currentTarget.value) })}
          onKeyUp={(event) => save({ fadeIntensity: Number(event.currentTarget.value) })}
        />
      </section>
      <section>
        <h3>Opacité des nouveaux territoires · {Math.round(config.territoryOpacity * 100)} %</h3>
        <input
          className="range"
          type="range"
          min={0.05}
          max={0.6}
          step={0.05}
          defaultValue={config.territoryOpacity}
          key={config.territoryOpacity}
          onPointerUp={(event) => save({ territoryOpacity: Number(event.currentTarget.value) })}
          onKeyUp={(event) => save({ territoryOpacity: Number(event.currentTarget.value) })}
        />
      </section>
    </div>
  );
}
