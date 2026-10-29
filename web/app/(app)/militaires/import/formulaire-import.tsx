'use client';

import { startTransition, useActionState } from 'react';
import { Alerte, Champ, Liste, Saisie, styles } from '@/components/ui';
import { importerMilitaires } from '../actions';

/** Envoi du fichier, puis rapport ligne par ligne (le fichier reste choisi en cas d'erreur). */
export function FormulaireImport({
  campagnes,
  campagneId,
}: {
  campagnes: { id: string; libelle: string }[];
  campagneId?: string;
}) {
  const [etat, envoyer, enCours] = useActionState(importerMilitaires, null);
  const rapport = etat?.rapport;
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const donnees = new FormData(e.currentTarget);
        startTransition(() => envoyer(donnees));
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Champ
          libelle="Fichier"
          obligatoire
          aide="Excel (.xlsx) ou CSV ; première ligne : les en-têtes."
        >
          <Saisie
            type="file"
            name="fichier"
            accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            required
          />
        </Champ>
        <Champ
          libelle="Créer aussi les dossiers dans la campagne"
          aide="Facultatif : sinon, seules les fiches des militaires sont créées."
        >
          <Liste name="campagneId" defaultValue={campagneId ?? ''}>
            <option value="">— Aucune —</option>
            {campagnes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.libelle}
              </option>
            ))}
          </Liste>
        </Champ>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="confirmer" value="oui" />
        Enregistrer (sans cette case, le fichier est seulement vérifié)
      </label>
      {etat?.erreur && <Alerte>{etat.erreur}</Alerte>}
      {etat?.succes && <Alerte type="succes">{etat.succes}</Alerte>}
      {rapport && rapport.colonnesIgnorees.length > 0 && (
        <Alerte type="info">
          Colonnes ignorées : {rapport.colonnesIgnorees.join(', ')}.
        </Alerte>
      )}
      {rapport && rapport.erreurs.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-red-200">
          <table className="min-w-full text-sm">
            <thead className="bg-red-50 text-left text-red-800">
              <tr>
                <th className="px-3 py-2">Ligne</th>
                <th className="px-3 py-2">À corriger</th>
              </tr>
            </thead>
            <tbody>
              {rapport.erreurs.map((e) => (
                <tr key={e.ligne} className="border-t border-red-100">
                  <td className="px-3 py-2 font-mono">{e.ligne}</td>
                  <td className="px-3 py-2">{e.messages.join(' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div>
        <button type="submit" disabled={enCours} className={styles.bouton}>
          {enCours ? 'Analyse…' : 'Envoyer le fichier'}
        </button>
      </div>
    </form>
  );
}
