/**
 * Valide le chiffre de contrôle d'un code-barres EAN-13, EAN-8 ou UPC-A.
 * Renvoie true pour tout format non reconnu (Code128, QR, etc.) — on ne peut
 * pas valider ce qu'on ne connaît pas, donc on laisse passer plutôt que de
 * bloquer des formats légitimes.
 *
 * Sert de première ligne de défense contre les erreurs de lecture caméra
 * (chiffre mal lu à cause d'un flou, d'un reflet ou d'un angle) : un code
 * dont le checksum est invalide est presque toujours une mauvaise lecture,
 * jamais un vrai code-barres imprimé.
 */
export function checksumEanValide(code: string): boolean {
  if (!/^\d+$/.test(code)) return true;
  const digits = code.split('').map(Number);

  if (code.length === 13 || code.length === 12) {
    // UPC-A (12 chiffres) = EAN-13 avec un 0 implicite en tête
    const d = code.length === 12 ? [0, ...digits] : digits;
    const check = d[12];
    const somme = d.slice(0, 12).reduce((s, n, i) => s + n * (i % 2 === 0 ? 1 : 3), 0);
    return (10 - (somme % 10)) % 10 === check;
  }
  if (code.length === 8) {
    const check = digits[7];
    const somme = digits.slice(0, 7).reduce((s, n, i) => s + n * (i % 2 === 0 ? 3 : 1), 0);
    return (10 - (somme % 10)) % 10 === check;
  }
  return true;
}
