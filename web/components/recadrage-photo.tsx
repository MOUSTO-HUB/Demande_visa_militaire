'use client';

import { useEffect, useRef, useState } from 'react';

/** Cadre de recadrage, en pixels de l'image d'origine. */
interface Cadre {
  x: number;
  y: number;
  largeur: number;
}

/** Côté le plus long de l'image envoyée : assez pour le site, léger pour une connexion faible. */
const HAUTEUR_ENVOI = 1200;

/**
 * Recadrage assisté de la photo d'identité (cahier des charges, F5.1) : la
 * personne place un cadre aux proportions exigées par le site sur le visage
 * (glisser pour déplacer, curseur pour la taille). La photo recadrée remplace
 * le fichier choisi dans le formulaire (champ « fichier ») ; la plateforme la
 * met ensuite aux dimensions et au poids exacts.
 */
export function RecadragePhoto({
  largeur,
  hauteur,
}: {
  /** Dimensions exigées par le site (seules leurs proportions comptent ici). */
  largeur: number;
  hauteur: number;
}) {
  const rapport = largeur / hauteur;
  const champ = useRef<HTMLInputElement>(null);
  const toile = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [cadre, setCadre] = useState<Cadre | null>(null);
  const glisse = useRef<{ x: number; y: number; cadre: Cadre } | null>(null);

  // Cadre le plus grand possible, centré, à l'ouverture d'une image.
  function ouvrir(fichier: File) {
    const img = new Image();
    img.onload = () => {
      const l = Math.min(img.width, img.height * rapport);
      setImage(img);
      setCadre({
        x: (img.width - l) / 2,
        y: (img.height - l / rapport) / 2,
        largeur: l,
      });
    };
    img.src = URL.createObjectURL(fichier);
  }

  const borne = (c: Cadre, img: HTMLImageElement): Cadre => {
    const l = Math.max(
      40,
      Math.min(c.largeur, img.width, img.height * rapport),
    );
    return {
      largeur: l,
      x: Math.min(Math.max(0, c.x), img.width - l),
      y: Math.min(Math.max(0, c.y), img.height - l / rapport),
    };
  };

  // Aperçu, et fichier recadré placé dans le formulaire à chaque changement.
  useEffect(() => {
    const c = toile.current;
    if (!image || !cadre || !c) return;
    const echelle = c.width / image.width;
    c.height = Math.round(image.height * echelle);
    const g = c.getContext('2d')!;
    g.drawImage(image, 0, 0, c.width, c.height);
    g.fillStyle = 'rgba(0, 0, 0, 0.5)';
    const [x, y, l, h] = [
      cadre.x * echelle,
      cadre.y * echelle,
      cadre.largeur * echelle,
      (cadre.largeur / rapport) * echelle,
    ];
    g.fillRect(0, 0, c.width, y);
    g.fillRect(0, y + h, c.width, c.height - y - h);
    g.fillRect(0, y, x, h);
    g.fillRect(x + l, y, c.width - x - l, h);
    g.strokeStyle = '#facc15';
    g.lineWidth = 2;
    g.strokeRect(x, y, l, h);
    // Repère du visage : ovale au centre du cadre.
    g.beginPath();
    g.ellipse(x + l / 2, y + h * 0.45, l * 0.3, h * 0.32, 0, 0, Math.PI * 2);
    g.setLineDash([4, 4]);
    g.stroke();
    g.setLineDash([]);

    const minuterie = setTimeout(() => {
      const sortie = document.createElement('canvas');
      const hSortie = Math.min(
        HAUTEUR_ENVOI,
        Math.round(cadre.largeur / rapport),
      );
      sortie.height = hSortie;
      sortie.width = Math.round(hSortie * rapport);
      sortie
        .getContext('2d')!
        .drawImage(
          image,
          cadre.x,
          cadre.y,
          cadre.largeur,
          cadre.largeur / rapport,
          0,
          0,
          sortie.width,
          sortie.height,
        );
      sortie.toBlob(
        (blob) => {
          if (!blob || !champ.current) return;
          const dt = new DataTransfer();
          dt.items.add(
            new File([blob], 'photo-recadree.jpg', { type: 'image/jpeg' }),
          );
          champ.current.files = dt.files;
        },
        'image/jpeg',
        0.92,
      );
    }, 150);
    return () => clearTimeout(minuterie);
  }, [image, cadre, rapport]);

  const pointImage = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const echelle = image!.width / r.width;
    return {
      x: (e.clientX - r.left) * echelle,
      y: (e.clientY - r.top) * echelle,
    };
  };

  return (
    <div className="flex w-full flex-col gap-2">
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        required
        className="max-w-full text-xs"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) ouvrir(f);
        }}
      />
      {/* Fichier réellement envoyé : la photo recadrée. */}
      <input ref={champ} type="file" name="fichier" hidden />
      {image && cadre && (
        <>
          <p className="text-xs text-slate-600">
            Placez le cadre jaune sur le visage (glisser), réglez sa taille :
            tête entière, centrée, un peu d’espace au-dessus.
          </p>
          <canvas
            ref={toile}
            width={320}
            className="max-w-full cursor-move touch-none rounded border border-marque-100"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              glisse.current = { ...pointImage(e), cadre };
            }}
            onPointerMove={(e) => {
              if (!glisse.current) return;
              const p = pointImage(e);
              const depart = glisse.current;
              setCadre(
                borne(
                  {
                    ...depart.cadre,
                    x: depart.cadre.x + p.x - depart.x,
                    y: depart.cadre.y + p.y - depart.y,
                  },
                  image,
                ),
              );
            }}
            onPointerUp={() => (glisse.current = null)}
          />
          <label className="flex items-center gap-2 text-xs text-slate-600">
            Taille du cadre
            <input
              type="range"
              min={20}
              max={100}
              value={Math.round(
                (cadre.largeur /
                  Math.min(image.width, image.height * rapport)) *
                  100,
              )}
              onChange={(e) => {
                const l =
                  (Number(e.target.value) / 100) *
                  Math.min(image.width, image.height * rapport);
                // Le centre du cadre reste en place.
                const cx = cadre.x + cadre.largeur / 2;
                const cy = cadre.y + cadre.largeur / rapport / 2;
                setCadre(
                  borne(
                    { largeur: l, x: cx - l / 2, y: cy - l / rapport / 2 },
                    image,
                  ),
                );
              }}
            />
          </label>
        </>
      )}
    </div>
  );
}
