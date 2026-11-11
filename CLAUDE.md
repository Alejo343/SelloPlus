# SelloPlus — contexto del proyecto

Tarjeta de sellos digital en el wallet del celular, para locales gastronómicos. Réplica del
sistema que venden `@menuly.ar` y `@marco.scaine` en Instagram.

**Lee primero `docs/`**, en este orden:

1. `docs/ESPEC.md` — qué es y cómo funciona cada pieza (sacado del análisis de los reels)
2. `docs/REQUISITOS.md` — requisitos numerados: RF, RN, RNF, RL, RE
3. `docs/PLAN.md` — las 10 fases, la estrategia de pruebas y los bloqueantes

Los reels originales con sus transcripciones están en
`/home/claude/proyectos/reels/_clasificado/05_gastronomia_fidelizacion.md`.

## Estado

Fases 0, 1, 2 y 3 terminadas. Siguiente: **Fase 4 — tarjeta en Google Wallet**, que necesita que
David tenga aprobada la cuenta de emisor.

191 pruebas en verde: 102 unitarias, 68 de integración y 21 de punta a punta en móvil simulado.

Pantallas del cliente: `/t/[token]` (el tap), `/c/[slug]/alta`, `/c/[slug]/tarjeta`,
`/c/[slug]/politica`. Panel del local: `/panel`, `/panel/entrar`, `/panel/clientes`,
`/panel/clientes/[id]`, `/panel/programa`, `/panel/qr`. Sin estilos a propósito; el diseño es la
Fase 8.

Credenciales de la semilla para el panel (solo desarrollo):
`dueno@laesquina.test` y `dueno@cafevecino.test`, contraseña `selloplus2026`.

Lo que ya existe:

- `src/dominio/` — reglas puras: `fechas.ts`, `sellos.ts`, `telefono.ts`, `inactividad.ts`
- `src/servicios/` — lo que toca la base: `tags.ts`, `clientes.ts`, `sellos.ts`
- `src/lib/sesion-cliente.ts` — cookie firmada que reconoce al cliente entre visitas

En esta versión de Next, `params`, `searchParams` y `cookies()` son **promesas**: hay que
esperarlas. Antes de escribir una pantalla nueva, leer la guía correspondiente en
`node_modules/next/dist/docs/01-app/`.

La **tasa de retorno** tiene una definición concreta, escrita en `src/dominio/metricas.ts`: de los
clientes que ya estaban ANTES del período, cuántos sumaron un sello DURANTE el período. No cambiar
esa definición sin leer el porqué: excluir del denominador a los recién llegados es lo que evita
que la tasa se hunda justo en los meses en que el local crece.

Las pruebas de punta a punta comparten la base de desarrollo y la semilla corre una sola vez, así
que **no usar conteos absolutos** en las aserciones: las pruebas del cliente dan de alta clientes
que luego ve el panel. Consultar el número en la base dentro de la prueba.

La página del tap suma un sello en un GET, y eso es deliberado: un chip NFC solo puede abrir una
URL, no enviar un POST. Lo que lo hace seguro es la regla de un sello por día, que vuelve la
operación idempotente. No "arreglarlo" convirtiéndolo en un POST: rompería el producto.

## Decisiones tomadas

- **Multi-local (SaaS)** desde el inicio. Todas las tablas llevan `local_id` y el aislamiento
  se prueba, no se asume.
- **Solo Google Wallet** al principio. Apple cuesta 99 USD/año y obliga al PassKit Web Service.
- **WhatsApp con links `wa.me`** que el local dispara a mano. Cloud API más adelante.
- **Funcional antes que bonito.** Nada de estilos hasta la Fase 8. Las pantallas son HTML crudo
  a propósito; no "mejorar" el diseño sobre la marcha.
- **Rol frente a los datos: SelloPlus es ENCARGADO**, cada local es el Responsable (Ley 1581 de
  2012). La autorización del formulario se pide **a nombre del local**, nunca de SelloPlus. Si un
  local se va, se le entrega su base y se borra. No usar datos de un local para fines propios.
  La **política de tratamiento** va en la Fase 2, dentro del formulario. El **contrato** con cada
  local está diferido a la Fase 10.

## Reglas al trabajar acá

- **Next.js 16.4**, no 15. Tiene cambios importantes respecto a lo que un modelo suele conocer:
  **leer la guía que corresponda en `node_modules/next/dist/docs/` antes de escribir código**.
  Lo avisa el propio `AGENTS.md` del proyecto.
- **El idioma del código es español**: nombres de tablas, columnas, funciones y pruebas. Es
  consistente con el dominio y con quién lo va a leer.
- **Las reglas de negocio van en `src/dominio/`**, como funciones puras sin SQL ni HTTP. Es lo que
  permite probarlas en segundos. No meter lógica de negocio en los componentes ni en las rutas.
- **Las fechas no usan `new Date()` en las pruebas**: siempre reloj simulado o fechas fijas, para
  que no se rompan solas al cambiar el mes.
- **Ninguna fase cierra sin pruebas en verde.** Las pruebas se escriben en la misma fase que el
  código que prueban.
- **No publicar sin permiso de David.** Se desarrolla acá; mover a `/var/www` y PM2 solo cuando
  él lo autorice.

## Comandos

```
npm run dev              servidor de desarrollo en el puerto 3011
npm test                 pruebas de unidad e integración (vitest)
npm run test:e2e         pruebas de punta a punta (playwright, móvil simulado)
npm run typecheck        next typegen + tsc
npm run lint             eslint
npm run db:generate      genera una migración tras cambiar el esquema
npm run db:migrate       aplica migraciones a fidelizacion_dev
npm run db:migrate:test  aplica migraciones a fidelizacion_test
npm run db:seed          vuelve a sembrar datos de prueba
npm run build            build de producción
```

## Infraestructura

- **PostgreSQL** por socket Unix local, sin contraseña: el sistema operativo autentica al usuario
  `claude`. Bases `fidelizacion_dev` y `fidelizacion_test`.
- **Puerto 3011.** El 3010 ya está ocupado por otro servicio del VPS.
- **Chromium de Playwright**: se usa el que ya está en `~/.cache/ms-playwright/chromium-1148`. No
  correr `npx playwright install`.
- Las pruebas de integración **se niegan a correr** si `DATABASE_URL_TEST` no apunta a una base
  que termine en `fidelizacion_test`. Es la salvaguarda contra borrar datos de desarrollo.

## Datos de prueba

`npm run db:seed` crea dos locales. El segundo, **Café Vecino**, existe solo para que las pruebas
de aislamiento tengan contra qué comparar. Cada cliente de **La Esquina** representa un caso:

| Cliente | Para qué sirve |
|---|---|
| Marta Fiel | 8 de 10 sellos: cerca del premio |
| Carlos Cumple | Cumple en 3 días: selección de cumpleaños |
| Ana Perdida | Último sello hace 100 días: selección de inactividad |
| Pedro Baja | Pidió la baja: no debe recibir NINGÚN mensaje |
| Lucía Nueva | Sin sellos todavía |

Marta y Sofía Vecina comparten teléfono en locales distintos, a propósito: es válido (RN-03).
