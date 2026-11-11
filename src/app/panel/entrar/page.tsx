/**
 * Login del panel: /panel/entrar
 *
 * Email y contraseña, sin más. Los usuarios son dueños de locales, van a ser
 * decenas y no miles, así que un servicio de autenticación externo sería
 * complejidad sin beneficio (RNF-11).
 */

import { redirect } from 'next/navigation';

import { sesionActual } from '@/lib/cookies-panel';

import { FormularioEntrar } from './formulario';

export default async function PaginaEntrar() {
  // Quien ya tiene sesión no necesita volver a entrar.
  if (await sesionActual()) redirect('/panel');

  return (
    <main>
      <h1>Panel de SelloPlus</h1>
      <p>Entra para ver tus clientes y tus métricas.</p>
      <FormularioEntrar />
    </main>
  );
}

export const metadata = { title: 'Entrar al panel · SelloPlus' };
