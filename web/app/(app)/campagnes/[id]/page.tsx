import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FormulaireAction } from '@/components/formulaire-action';
import {
  FiltresDossiers,
  requeteDossiers,
  TableauDossiers,
} from '@/components/tableau-dossiers';
import { Badge, Carte, EnTete, parametre, styles } from '@/components/ui';
import { lireApi, lireApiOuNull } from '@/lib/api';
import { profilCourant, referentiel } from '@/lib/profil';
import {
  couleurStatut,
  DRAPEAUX,
  LIBELLES_PAYS,
  LIBELLES_STATUT,
  ORDRE_STATUTS,
  peutGerer,
  type CampagneDetail,
  type DossierListe,
  type Page,
} from '@/lib/types';
import { cloturerCampagne, modifierCampagne, purgerPieces } from '../actions';
import { FormulaireCampagne } from '../formulaire-campagne';

export const metadata: Metadata = { title: 'Campagne · Demandes de visa' };

export default async function PageCampagne(
  props: PageProps<'/campagnes/[id]'>,
) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const campagne = await lireApiOuNull<CampagneDetail>(`/campagnes/${id}`);
  if (!campagne) notFound();
  const filtres = {
    campagneId: id,
    q: parametre(sp.q),
    statut: parametre(sp.statut),
    operateur: parametre(sp.operateur),
    page: parametre(sp.page),
  };
  const [page, profil, ref] = await Promise.all([
    lireApi<Page<DossierListe>>(`/dossiers?${requeteDossiers(filtres)}`),
    profilCourant(),
    referentiel(),
  ]);
  const gestion = peutGerer(profil.role);
  const ouverte = campagne.statut === 'OUVERTE';
  const libellePiece = (code: string) =>
    ref.pieces.find((p) => p.code === code)?.libelle ?? code;

  return (
    <>
      <EnTete
        titre={`${DRAPEAUX[campagne.pays]} ${campagne.libelle}`}
        sousTitre={`${LIBELLES_PAYS[campagne.pays]} · ${campagne.annee} · visa ${campagne.typeVisa}${campagne.referenceAccord ? ` · ${campagne.referenceAccord}` : ''}`}
        actions={
          <>
            {gestion && ouverte && (
              <>
                <Link
                  href={`/campagnes/${id}/valeurs`}
                  className={styles.bouton}
                >
                  Valeurs communes
                </Link>
                <Link
                  href={`/militaires/import?campagneId=${id}`}
                  className={styles.boutonSecondaire}
                >
                  Importer une liste Excel
                </Link>
                <Link
                  href={`/campagnes/${id}/ajout`}
                  className={styles.boutonSecondaire}
                >
                  Ajouter des militaires
                </Link>
              </>
            )}
            {profil.role !== 'OPERATEUR' && (
              <a
                href={`/telechargements/export/${id}`}
                className={styles.boutonSecondaire}
              >
                Exporter (Excel)
              </a>
            )}
          </>
        }
      />

      {!ouverte && (
        <p className="mb-4">
          <Badge>Campagne close</Badge>
        </p>
      )}

      <div className="mb-6 flex flex-wrap gap-2">
        {ORDRE_STATUTS.filter((s) => campagne.parStatut[s]).map((s) => (
          <Link
            key={s}
            href={`/campagnes/${id}?statut=${s}`}
            className="rounded-xl border border-marque-100 bg-carte px-3 py-2 text-sm shadow-sm hover:shadow-md"
          >
            <span className="mr-2 text-lg font-bold text-marque-950">
              {campagne.parStatut[s]}
            </span>
            <Badge couleur={couleurStatut(s)}>{LIBELLES_STATUT[s]}</Badge>
          </Link>
        ))}
        {!campagne.dossiers && (
          <p className="text-sm text-slate-600">
            Aucun dossier : importez la liste des boursiers ou ajoutez des
            militaires déjà enregistrés.
          </p>
        )}
      </div>

      <FiltresDossiers
        chemin={`/campagnes/${id}`}
        filtres={filtres}
        avecCampagne
      />
      <TableauDossiers
        page={page}
        chemin={`/campagnes/${id}`}
        filtres={filtres}
        avecCampagne={false}
      />

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Carte titre="Pièces demandées">
          <ul className="list-inside list-disc text-sm text-slate-800">
            {campagne.pieces.map((p) => (
              <li key={p}>{libellePiece(p)}</li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-500">
            Photo pour ce pays : {ref.exigences[campagne.pays].photo.largeur}×
            {ref.exigences[campagne.pays].photo.hauteur} pixels, au plus{' '}
            {ref.exigences[campagne.pays].photo.poidsMaxKo} Ko. Les fichiers
            déposés sont mis à ce format automatiquement.
          </p>
        </Carte>
        {gestion && (
          <Carte titre="Clôture">
            {ouverte ? (
              <>
                <p className="mb-3 text-sm text-slate-700">
                  Une campagne close ne peut plus être modifiée. Ses pièces
                  pourront ensuite être effacées (protection des données).
                </p>
                <FormulaireAction
                  action={cloturerCampagne.bind(null, id)}
                  libelle="Clôturer la campagne"
                  style="boutonDanger"
                  confirmation="Clôturer cette campagne ? Ses dossiers ne pourront plus être modifiés."
                />
              </>
            ) : profil.role === 'ADMIN' ? (
              <>
                <p className="mb-3 text-sm text-slate-700">
                  Effacer les fichiers (scans de passeport, photos…) de cette
                  campagne. La liste des pièces reste visible.
                </p>
                <FormulaireAction
                  action={purgerPieces.bind(null, id)}
                  libelle="Effacer les fichiers des pièces"
                  style="boutonDanger"
                  confirmation="Effacer définitivement les fichiers des pièces de cette campagne ?"
                />
              </>
            ) : (
              <p className="text-sm text-slate-700">
                Campagne close. L’effacement des pièces est fait par la DGSIC.
              </p>
            )}
          </Carte>
        )}
      </div>

      {gestion && ouverte && (
        <div className="mt-4">
          <Carte titre="Informations de la campagne">
            <FormulaireCampagne
              action={modifierCampagne.bind(null, id)}
              pieces={ref.pieces}
              campagne={campagne}
              libelle="Enregistrer"
            />
          </Carte>
        </div>
      )}
    </>
  );
}
