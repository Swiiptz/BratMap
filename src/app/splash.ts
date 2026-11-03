/** Retire l'écran de chargement statique d'index.html (affiché au moins un court instant, pour éviter un flash). */
const MIN_VISIBLE_MS = 900;
let dismissed = false;

export function dismissSplash() {
  if (dismissed) return;
  dismissed = true;
  const splash = document.getElementById('splash');
  if (!splash) return;
  window.setTimeout(
    () => {
      splash.classList.add('hide');
      window.setTimeout(() => splash.remove(), 700);
    },
    Math.max(0, MIN_VISIBLE_MS - performance.now()),
  );
}

// Filet de sécurité : jamais bloqué derrière l'écran de chargement (réseau lent, base injoignable).
if (typeof window !== 'undefined') window.setTimeout(dismissSplash, 10_000);
