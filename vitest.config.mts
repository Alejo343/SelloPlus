import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Las pruebas de integración comparten una sola base: si corren en
    // paralelo se pisan entre sí al limpiar las tablas.
    fileParallelism: false,
    include: ['tests/unidad/**/*.test.ts', 'tests/integracion/**/*.test.ts'],
    setupFiles: ['tests/ayuda/entorno.ts'],
  },
});
