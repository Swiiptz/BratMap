import { usePreference } from '../../app/preferences';
import { Icon } from '../../components/Pickers';

type Step = { icon: string; title: string; text: string; action: string; run: () => void };

/** Accueil d'une chronique vide : les premiers gestes, puis disparaît dès qu'un élément existe. */
export function WelcomeCard({ onTerritory, onPlace, onCharacters, onImport }: { onTerritory: () => void; onPlace: () => void; onCharacters: () => void; onImport: () => void }) {
  const [dismissed, setDismissed] = usePreference('welcome-dismissed', false);
  if (dismissed) return null;
  const steps: Step[] = [
    { icon: 'polygon', title: 'Tracer un territoire', text: 'Domaines, fiefs, zones contestées : clic par sommet, double-clic pour fermer.', action: 'Tracer', run: onTerritory },
    { icon: 'pin', title: 'Poser un lieu', text: 'Elysium, bar, havre, point d’intérêt : un clic sur la carte.', action: 'Poser', run: onPlace },
    { icon: 'users', title: 'Ajouter des personnages', text: 'Puis les lier aux lieux, territoires et plots.', action: 'Ouvrir', run: onCharacters },
    { icon: 'download', title: 'Reprendre une sauvegarde', text: 'Importer un fichier JSON exporté depuis bratMap.', action: 'Importer', run: onImport },
  ];
  return (
    <div className="welcome-backdrop">
      <section className="welcome-card" aria-label="Bienvenue">
        <span className="eyebrow">CHRONIQUE VIDE</span>
        <h2>Bienvenue sur bratMap</h2>
        <p className="muted">
          Le 92, Saint-Denis et Saint-Ouen sont prêts, avec le réseau souterrain public déjà importé. Il ne manque que votre chronique : commencez par l’un de ces gestes.
        </p>
        <ol className="welcome-steps">
          {steps.map((step) => (
            <li key={step.title}>
              <span className="welcome-icon">
                <Icon id={step.icon} size={18} />
              </span>
              <span>
                <strong>{step.title}</strong>
                <small>{step.text}</small>
              </span>
              <button
                type="button"
                onClick={() => {
                  setDismissed(true);
                  step.run();
                }}
              >
                {step.action}
              </button>
            </li>
          ))}
        </ol>
        <button type="button" className="link-button" onClick={() => setDismissed(true)}>
          Explorer la carte d’abord
        </button>
      </section>
    </div>
  );
}
