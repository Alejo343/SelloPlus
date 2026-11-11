'use server';

import { redirect } from 'next/navigation';

import { iniciarSesion } from '@/lib/cookies-panel';
import { autenticar } from '@/servicios/panel';

export interface EstadoLogin {
  error?: string;
  email?: string;
}

export async function accionEntrar(
  _anterior: EstadoLogin,
  datos: FormData,
): Promise<EstadoLogin> {
  const email = String(datos.get('email') ?? '');
  const contrasena = String(datos.get('contrasena') ?? '');

  if (!email || !contrasena) {
    return { error: 'Escribe tu correo y tu contraseña.', email };
  }

  const usuario = await autenticar(email, contrasena);

  // Un solo mensaje para los dos casos: decir "ese correo no existe"
  // permitiría averiguar qué locales están registrados.
  if (!usuario) {
    return { error: 'Correo o contraseña incorrectos.', email };
  }

  await iniciarSesion(usuario.usuarioId, usuario.localId);
  redirect('/panel');
}
