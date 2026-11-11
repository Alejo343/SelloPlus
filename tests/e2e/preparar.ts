/**
 * Preparación de las pruebas de punta a punta.
 *
 * Vuelve a sembrar la base de desarrollo antes de cada corrida, para que las
 * pruebas siempre arranquen del mismo estado conocido. Las E2E sí usan la base
 * de desarrollo —no la de pruebas— porque pegan contra el servidor de `next
 * dev`, que es el que está configurado contra ella.
 */

import { execFileSync } from 'node:child_process';

export default function preparar() {
  execFileSync('npm', ['run', 'db:seed'], { stdio: 'inherit' });
}
