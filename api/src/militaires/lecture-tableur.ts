import { BadRequestException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { Readable } from 'node:stream';

/** Texte d'une cellule Excel : dates en « AAAA-MM-JJ », formules par leur résultat. */
export function texteCellule(valeur: ExcelJS.CellValue): string {
  if (valeur === null || valeur === undefined) return '';
  if (valeur instanceof Date) return valeur.toISOString().slice(0, 10);
  if (typeof valeur === 'object') {
    if ('richText' in valeur)
      return valeur.richText.map((r) => r.text).join('');
    if ('text' in valeur) return String(valeur.text);
    if ('result' in valeur)
      return texteCellule(valeur.result as ExcelJS.CellValue);
    return '';
  }
  return String(valeur);
}

/** Première feuille d'un fichier .xlsx ou .csv : en-têtes, lignes et numéros de ligne. */
export async function lireTableur(
  contenu: Buffer,
  nomFichier: string,
): Promise<{ entetes: string[]; lignes: string[][]; numeros: number[] }> {
  const classeur = new ExcelJS.Workbook();
  const extension = nomFichier.toLowerCase().split('.').pop();
  try {
    if (extension === 'csv') {
      // Excel en français enregistre les CSV avec des points-virgules.
      const texte = contenu.toString('utf8').replace(/^﻿/, '');
      const separateur =
        (texte.split('\n')[0].match(/;/g)?.length ?? 0) >
        (texte.split('\n')[0].match(/,/g)?.length ?? 0)
          ? ';'
          : ',';
      await classeur.csv.read(Readable.from([texte]), {
        parserOptions: { delimiter: separateur },
        dateFormats: [],
        map: (v: string) => v,
      });
    } else if (extension === 'xlsx') {
      await classeur.xlsx.load(contenu as unknown as ArrayBuffer);
    } else {
      throw new Error('format');
    }
  } catch {
    throw new BadRequestException(
      'Fichier illisible : envoyez un classeur Excel (.xlsx) ou un fichier CSV.',
    );
  }
  const feuille = classeur.worksheets[0];
  if (!feuille || feuille.rowCount < 2)
    throw new BadRequestException(
      'Le fichier est vide : la première ligne contient les en-têtes, les suivantes un militaire chacune.',
    );

  const largeur = feuille.columnCount;
  const lireLigne = (n: number) =>
    Array.from({ length: largeur }, (_, i) =>
      texteCellule(feuille.getRow(n).getCell(i + 1).value).trim(),
    );
  const entetes = lireLigne(1);
  const lignes: string[][] = [];
  const numeros: number[] = [];
  for (let n = 2; n <= feuille.rowCount; n++) {
    lignes.push(lireLigne(n));
    numeros.push(n);
  }
  return { entetes, lignes, numeros };
}
