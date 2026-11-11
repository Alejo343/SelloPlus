'use client';

import { useActionState } from 'react';

import { accionEntrar, type EstadoLogin } from './acciones';

export function FormularioEntrar() {
  const [estado, accion, pendiente] = useActionState<EstadoLogin, FormData>(accionEntrar, {});

  return (
    <form action={accion}>
      {estado.error && <p className="error">{estado.error}</p>}

      <div className="campo">
        <label htmlFor="email">Correo</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={estado.email ?? ''}
          required
        />
      </div>

      <div className="campo">
        <label htmlFor="contrasena">Contraseña</label>
        <input
          id="contrasena"
          name="contrasena"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>

      <button type="submit" disabled={pendiente}>
        {pendiente ? 'Entrando...' : 'Entrar'}
      </button>
    </form>
  );
}
