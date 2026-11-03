import type { ReactNode } from 'react';
import { usePreference } from '../app/preferences';

/** Section repliable du panneau, dont l'état ouvert / fermé est mémorisé dans ce navigateur. */
export function Collapsible({
  id,
  title,
  badge,
  defaultOpen = true,
  forceOpen = false,
  children,
}: {
  id: string;
  title: ReactNode;
  badge?: ReactNode;
  defaultOpen?: boolean;
  forceOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = usePreference(`section:${id}`, defaultOpen);
  const isOpen = open || forceOpen;
  return (
    <section className={isOpen ? 'panel-section collapsible open' : 'panel-section collapsible'}>
      <button type="button" className="section-toggle" aria-expanded={isOpen} onClick={() => setOpen(!isOpen)}>
        <span className="section-title-text">{title}</span>
        {badge}
        <span className="chevron" aria-hidden="true">
          ›
        </span>
      </button>
      {isOpen && <div className="section-body">{children}</div>}
    </section>
  );
}

/** Section repliable d'un formulaire de fiche (Identité, Liens, Apparence…), sur toute la largeur de la grille. */
export function SheetSection({ id, title, defaultOpen = true, children }: { id: string; title: string; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = usePreference(`sheet-section:${id}`, defaultOpen);
  return (
    <section className={open ? 'sheet-section open' : 'sheet-section'}>
      <button type="button" className="sheet-section-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="chevron" aria-hidden="true">
          ›
        </span>
        {title}
      </button>
      {open && <div className="form-grid">{children}</div>}
    </section>
  );
}
