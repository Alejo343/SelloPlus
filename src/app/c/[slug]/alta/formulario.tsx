'use client';

/**
 * El formulario de alta al club.
 *
 * Es el único momento en que el cliente escribe algo, así que pide lo mínimo:
 * nombre, teléfono y cumpleaños. El cumpleaños es opcional, pero sin él no hay
 * saludo, que es uno de los mensajes que más hacen volver.
 *
 * La casilla del consentimiento (RL-01) **no viene premarcada** y el botón
 * está deshabilitado hasta que se marca: es una exigencia legal, no una
 * decisión de diseño.
 */

import { useActionState, useState } from 'react';

import { textoCasilla } from '@/lib/consentimiento';

import { accionAlta, type EstadoFormulario } from './acciones';

export interface PropsFormulario {
  slug: string;
  localNombre: string;
  /** Token del tag por el que llegó, si llegó por un tap */
  token?: string;
}

export function FormularioAlta({ slug, localNombre, token }: PropsFormulario) {
  const [estado, accion, pendiente] = useActionState<EstadoFormulario, FormData>(accionAlta, {});
  const [acepta, setAcepta] = useState(false);

  const valores = estado.valores;
  const errores = estado.errores ?? {};

  return (
    <form action={accion}>
      <input type="hidden" name="slug" value={slug} />
      {token && <input type="hidden" name="token" value={token} />}

      {errores.general && <p className="error">{errores.general}</p>}

      <div className="campo">
        <label htmlFor="nombre">Tu nombre</label>
        <input
          id="nombre"
          name="nombre"
          type="text"
          autoComplete="name"
          defaultValue={valores?.nombre ?? ''}
          aria-describedby={errores.nombre ? 'error-nombre' : undefined}
          required
        />
        {errores.nombre && (
          <p className="error" id="error-nombre">
            {errores.nombre}
          </p>
        )}
      </div>

      <div className="campo">
        <label htmlFor="telefono">Tu WhatsApp</label>
        <input
          id="telefono"
          name="telefono"
          // `tel` abre el teclado numérico en el celular, que es donde se usa.
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="300 123 4567"
          defaultValue={valores?.telefono ?? ''}
          aria-describedby={errores.telefono ? 'error-telefono' : undefined}
          required
        />
        {errores.telefono && (
          <p className="error" id="error-telefono">
            {errores.telefono}
          </p>
        )}
      </div>

      <div className="campo">
        <label htmlFor="fechaNacimiento">Tu cumpleaños (opcional)</label>
        <input
          id="fechaNacimiento"
          name="fechaNacimiento"
          type="date"
          defaultValue={valores?.fechaNacimiento ?? ''}
          aria-describedby={errores.fechaNacimiento ? 'error-fecha' : undefined}
        />
        {errores.fechaNacimiento && (
          <p className="error" id="error-fecha">
            {errores.fechaNacimiento}
          </p>
        )}
      </div>

      <div className="campo casilla">
        <input
          id="consentimiento"
          name="consentimiento"
          type="checkbox"
          value="si"
          checked={acepta}
          onChange={(evento) => setAcepta(evento.target.checked)}
        />
        <label htmlFor="consentimiento">
          {textoCasilla(localNombre)}{' '}
          <a href={`/c/${slug}/politica`} target="_blank" rel="noreferrer">
            Ver cómo tratamos tus datos
          </a>
        </label>
      </div>

      {errores.consentimiento && <p className="error">{errores.consentimiento}</p>}

      <button type="submit" disabled={pendiente || !acepta}>
        {pendiente ? 'Un momento...' : 'Unirme al club'}
      </button>
    </form>
  );
}
