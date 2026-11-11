import { describe, expect, it } from 'vitest';

import { hashearContrasena, verificarContrasena } from '../../src/lib/contrasena';

describe('hashearContrasena', () => {
  it('nunca guarda la contraseña en claro', async () => {
    const hash = await hashearContrasena('miContrasenaSecreta');
    expect(hash).not.toContain('miContrasenaSecreta');
  });

  it('da un hash distinto cada vez, aunque la contraseña sea la misma', async () => {
    // Por la sal aleatoria: dos locales con la misma contraseña no deben
    // tener el mismo hash, porque eso se nota mirando la base.
    const a = await hashearContrasena('contrasenaIgual');
    const b = await hashearContrasena('contrasenaIgual');
    expect(a).not.toBe(b);
  });

  it('guarda los parámetros dentro del hash, para poder subirlos después', async () => {
    const hash = await hashearContrasena('contrasenaValida');
    expect(hash.split('$')).toHaveLength(6);
    expect(hash.startsWith('scrypt$')).toBe(true);
  });

  it('rechaza contraseñas demasiado cortas', async () => {
    await expect(hashearContrasena('corta')).rejects.toThrow(/al menos/);
  });
});

describe('verificarContrasena', () => {
  it('acepta la contraseña correcta', async () => {
    const hash = await hashearContrasena('laContrasenaCorrecta');
    expect(await verificarContrasena('laContrasenaCorrecta', hash)).toBe(true);
  });

  it('rechaza la incorrecta, incluso si se parece', async () => {
    const hash = await hashearContrasena('laContrasenaCorrecta');
    expect(await verificarContrasena('laContrasenaCorrectb', hash)).toBe(false);
    expect(await verificarContrasena('laContrasenaCorrect', hash)).toBe(false);
    expect(await verificarContrasena('', hash)).toBe(false);
  });

  it('distingue mayúsculas', async () => {
    const hash = await hashearContrasena('ContrasenaConMayus');
    expect(await verificarContrasena('contrasenaconmayus', hash)).toBe(false);
  });

  it('funciona con acentos y emoji escritos de formas distintas', async () => {
    // Se normaliza a NFKC: la misma contraseña escrita con un teclado que
    // compone los acentos de otra forma tiene que seguir entrando.
    const hash = await hashearContrasena('contraseña-añeja');
    expect(await verificarContrasena('contraseña-añeja'.normalize('NFC'), hash)).toBe(
      true,
    );
  });

  it('devuelve false en vez de lanzar si el hash está corrupto', async () => {
    // Un registro mal guardado no debe tumbar el login de todos los demás.
    for (const malo of ['', 'cualquier-cosa', 'scrypt$x$y$z', 'bcrypt$1$2$3$4$5']) {
      expect(await verificarContrasena('cualquiera', malo)).toBe(false);
    }
  });
});
