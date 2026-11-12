/**
 * Portada. Durante el desarrollo solo sirve para no dar un 404 en la raíz:
 * el sistema se usa entrando por /t/[token] o /c/[slug].
 */
export default function Inicio() {
  return (
    <main>
      <h1>Sello Fiel</h1>
      <p>Tarjeta de sellos digital para locales gastronómicos.</p>
      <p>
        Para unirte al club de un local, escanea su código QR o apoya tu celular en su chip.
      </p>
    </main>
  );
}
