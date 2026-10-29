import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

// Briques d'interface communes, utilisables côté serveur comme côté client.

// Texte en 16 px sur téléphone : l'iPhone ne zoome plus sur le champ touché.
const champ =
  'block w-full min-w-0 rounded-lg border border-slate-300 bg-carte px-3 py-2 text-base text-slate-900 shadow-sm transition focus:border-marque-500 focus:outline-none focus:ring-4 focus:ring-marque-500/15 sm:text-sm';

export const styles = {
  champ,
  bouton:
    'fond-degrade inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-md shadow-marque-700/25 transition hover:shadow-lg hover:shadow-marque-700/35 hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60',
  boutonSecondaire:
    'contour-degrade inline-flex items-center justify-center gap-2 rounded-lg border-2 px-4 py-1.5 text-sm font-semibold text-marque-800 shadow-sm transition hover:shadow-md hover:shadow-marque-700/15 active:scale-[0.98] disabled:opacity-60',
  boutonDanger:
    'inline-flex items-center justify-center gap-2 rounded-lg border-2 border-red-200 bg-carte px-4 py-1.5 text-sm font-semibold text-red-700 transition hover:border-red-300 hover:bg-red-50 disabled:opacity-60',
  lien: 'font-medium text-marque-700 hover:underline',
};

export function Champ({
  libelle,
  aide,
  obligatoire,
  children,
}: {
  libelle: string;
  aide?: string;
  obligatoire?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-slate-800">
        {libelle}
        {obligatoire && <span className="text-red-600"> *</span>}
      </span>
      {children}
      {aide && <span className="text-xs text-slate-500">{aide}</span>}
    </label>
  );
}

export function Saisie(props: ComponentProps<'input'>) {
  return <input {...props} className={`${champ} ${props.className ?? ''}`} />;
}

export function Liste(props: ComponentProps<'select'>) {
  return <select {...props} className={`${champ} ${props.className ?? ''}`} />;
}

export function Zone(props: ComponentProps<'textarea'>) {
  return (
    <textarea {...props} className={`${champ} ${props.className ?? ''}`} />
  );
}

export function Alerte({
  type = 'erreur',
  children,
}: {
  type?: 'erreur' | 'succes' | 'info';
  children: ReactNode;
}) {
  const couleurs = {
    erreur: 'border-red-200 bg-red-50 text-red-800',
    succes: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    info: 'border-sky-200 bg-sky-50 text-sky-800',
  };
  return (
    <div
      role={type === 'erreur' ? 'alert' : 'status'}
      className={`rounded-xl border px-4 py-3 text-sm ${couleurs[type]}`}
    >
      {children}
    </div>
  );
}

export function Carte({
  titre,
  actions,
  children,
}: {
  titre?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-marque-100 bg-carte p-4 shadow-sm shadow-marque-900/5 sm:p-5">
      {(titre || actions) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {titre && (
            <h2 className="flex items-center gap-2 text-base font-semibold text-marque-950 before:h-5 before:w-1.5 before:rounded-full before:fond-degrade before:content-['']">
              {titre}
            </h2>
          )}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function EnTete({
  titre,
  sousTitre,
  actions,
}: {
  titre: string;
  sousTitre?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-marque-950">
          {titre}
        </h1>
        {sousTitre && (
          <p className="mt-1 text-sm text-slate-600">{sousTitre}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Badge({
  couleur = 'gris',
  children,
}: {
  couleur?: 'gris' | 'vert' | 'orange' | 'rouge' | 'bleu';
  children: ReactNode;
}) {
  const c = {
    gris: 'bg-slate-100 text-slate-700',
    vert: 'bg-emerald-100 text-emerald-800',
    orange: 'bg-soleil-100 text-soleil-900',
    rouge: 'bg-red-50 text-red-800',
    bleu: 'bg-marque-100 text-marque-800',
  }[couleur];
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${c}`}
    >
      {children}
    </span>
  );
}

/** Tableau responsive : défile horizontalement sur petit écran. */
export function Tableau({
  entetes,
  children,
  vide,
}: {
  entetes: string[];
  children: ReactNode;
  vide?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-marque-100 bg-carte shadow-sm shadow-marque-900/5">
      <table className="min-w-full divide-y divide-marque-100 text-sm">
        <thead className="bg-marque-50">
          <tr>
            {entetes.map((e) => (
              <th
                key={e}
                scope="col"
                className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-marque-900"
              >
                {e}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
      {vide && (
        <p className="px-4 py-8 text-center text-sm text-slate-500">{vide}</p>
      )}
    </div>
  );
}

export const cellule = 'whitespace-nowrap px-4 py-3 text-slate-800';

/** Liens Précédent / Suivant qui conservent les autres paramètres de recherche. */
export function Pagination({
  page,
  pages,
  total,
  chemin,
  parametres,
}: {
  page: number;
  pages: number;
  total: number;
  chemin: string;
  parametres: Record<string, string | undefined>;
}) {
  const vers = (p: number) => {
    const sp = new URLSearchParams();
    for (const [cle, valeur] of Object.entries(parametres)) {
      if (valeur) sp.set(cle, valeur);
    }
    sp.set('page', String(p));
    return `${chemin}?${sp.toString()}`;
  };
  return (
    <nav
      aria-label="Pagination"
      className="mt-4 flex items-center justify-between text-sm text-slate-600"
    >
      <span>
        {total} résultat{total > 1 ? 's' : ''} · page{' '}
        {Math.min(page, Math.max(pages, 1))} sur {Math.max(pages, 1)}
      </span>
      <div className="flex gap-2">
        {page > 1 && (
          <Link className={styles.boutonSecondaire} href={vers(page - 1)}>
            Précédent
          </Link>
        )}
        {page < pages && (
          <Link className={styles.boutonSecondaire} href={vers(page + 1)}>
            Suivant
          </Link>
        )}
      </div>
    </nav>
  );
}

/** Premier élément d'un paramètre de recherche Next (string | string[]). */
export const parametre = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;
