# Sello Fiel — contexto del proyecto

Tarjeta de sellos digital en el wallet del celular, para locales gastronómicos. Réplica del
sistema que venden `@menuly.ar` y `@marco.scaine` en Instagram.

**Lee primero `docs/`**, en este orden:

1. `docs/ESPEC.md` — qué es y cómo funciona cada pieza (sacado del análisis de los reels)
2. `docs/REQUISITOS.md` — requisitos numerados: RF, RN, RNF, RL, RE
3. `docs/PLAN.md` — las 10 fases, la estrategia de pruebas y los bloqueantes

Los reels originales con sus transcripciones están en
`/home/claude/proyectos/reels/_clasificado/05_gastronomia_fidelizacion.md`.

## Estado

Fases 0 a 3 y **4A** terminadas. Siguiente: **Fase 5 — mensajes para que vuelvan** (la 4B espera
la cuenta de emisor de David).

244 pruebas en verde: 135 unitarias, 87 de integración y 22 de punta a punta en móvil simulado.

**Google Wallet funciona en modo simulado.** El emisor se elige por la presencia de credenciales:
sin `WALLET_ISSUER_ID`, `WALLET_CUENTA_SERVICIO_EMAIL` y `WALLET_CLAVE_PRIVADA` en el `.env`, se
usa el emisor simulado, que registra lo que enviaría y devuelve enlaces con «simulado» en la URL
para que se note si alguno llega a producción. La implementación real está escrita según la
documentación pero **no se ha probado contra la API de Google**: eso es la Fase 4B.

Sumar un sello **encola**, no llama a Google: `npm run wallet:procesar` drena la cola y está
pensado para un cron cada minuto. Google no tiene SLA y el tap tiene que responder en menos de
1,5 s delante del cliente.

Pantallas del cliente: `/t/[token]` (el tap), `/c/[slug]/alta`, `/c/[slug]/tarjeta`,
`/c/[slug]/politica`. Panel del local: `/panel`, `/panel/entrar`, `/panel/clientes`,
`/panel/clientes/[id]`, `/panel/programa`, `/panel/qr`. Sin estilos a propósito; el diseño es la
Fase 8.

`diseno/landing.html` es la **página de venta** (Fase 9), un HTML independiente y autocontenido:
no es parte de la app y no toca `src/`. Fija la identidad visual que debe seguir la Fase 8
(coral #E4573D, azul noche #1F2A44, crema #FBF5EC, Fraunces + Inter) a partir del logo que
eligió David. Decidido el 2026-11-12: la sección de planes **no muestra precios** (se cotiza
caso por caso). Contacto real: WhatsApp +57 305 235 2080 y davidalejangp@gmail.com.

La landing está **en vivo en https://sellofiel.app** (y `www`) desde el 2026-11-13, y
**se edita directamente en `/var/www/sellofiel/index.html`**. No hay copia en este repo: la
hubo hasta el 2026-11-13 y David la mandó quitar, porque mantener dos archivos iguales
sincronizados a mano es un error esperando a pasar. `diseno/` solo guarda un README que
apunta allá.

Cada cambio queda en vivo al guardar, así que la red de seguridad es **git**, con el repo
dentro de la carpeta (`/var/www/sellofiel/.git`), como el resto de los sitios del VPS. Se usa
`git` normal desde `/var/www/sellofiel`.

Flujo: editar `index.html` → `git diff` → verificar con
`curl -s https://sellofiel.app | grep ...` que lo servido sea lo esperado →
`git add -A && git commit -m "..."`. Si algo sale mal, `git checkout -- index.html`.

**El `.git` está bloqueado al público** por una regla `rewrite` en el vhost
(`RewriteRule ^/?\.git(/|$) - [F,L]`), que devuelve 403. Sin esa regla, cualquiera se
descarga el repositorio entero desde internet. Comprobado el 2026-11-13: `accessDenyDir`
solo cubre el primer nivel de la carpeta, y el `.htaccess` no se aplica en este
OpenLiteSpeed; la regla `rewrite` del vhost es la única que funciona. Si algún día se crea
otro sitio con git adentro, hay que copiarle esa regla y **verificar con curl**, no asumir.

Montaje en el VPS: vhost `sellofiel` en OpenLiteSpeed (`conf/vhosts/sellofiel/vhconf.conf`,
sin PHP), mapeado en los listeners `Default` y `Defaultssl`, con certificado Let's Encrypt de
`/etc/letsencrypt/live/sellofiel.app/`. El TLD `.app` es HSTS preload: sin HTTPS el navegador
ni siquiera abre la página. Respaldos de `httpd_config.conf` en `/home/claude/respaldos/lsws/`.

Cuando llegue el momento de publicar la app (panel y pantallas del cliente), hay que decidir
dónde: `app.sellofiel.app` o `/panel` del mismo dominio. Sin decidir.

Credenciales de la semilla para el panel (solo desarrollo):
`dueno@laesquina.test` y `dueno@cafevecino.test`, contraseña `sellofiel2026`.

**El producto se llama Sello Fiel** (renombrado el 2026-11-12; antes SelloPlus, que ya era marca
registrada). El proyecto de Google Cloud y la cuenta de servicio conservan el nombre antiguo
(`selloplus-wallet@selloplus.iam.gserviceaccount.com`): son identificadores internos y
renombrarlos rompería las credenciales. No "arreglarlos".

Las credenciales de Google Wallet viven en `~/.config/sellofiel/wallet.json` con permisos 600,
fuera del repositorio, y el `.env` solo guarda la ruta.

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

**Las pruebas NUNCA deben usar el emisor real.** Con credenciales en el `.env`, `obtenerEmisor()`
devuelve el de Google, y Google **no permite borrar plantillas ni pases**: cada corrida dejaría
basura permanente en la cuenta. Toda prueba que procese la cola tiene que llamar antes a
`fijarEmisor(crearEmisorSimulado())`.

**Google exige logo** en la plantilla del local, aunque su documentación lo presente como
opcional. Comprobado contra la API real el 2026-11-12: responde "LoyaltyClass cannot be created
without a program logo". La URL tiene que ser pública, porque Google la descarga.

Dos trampas de PostgreSQL ya pagadas, para no repetirlas:

- **Capturar una violación de unicidad dentro de una transacción no sirve**: el statement fallido
  aborta la transacción entera. Hay que usar `on conflict do nothing`, como hace `encolar`.
- **Un índice único sobre una columna que admite nulos no restringe los nulos**, porque PostgreSQL
  los considera distintos entre sí. La cola indexa `coalesce(cliente_id, local_id)` por eso.

En Google Wallet, el aviso por cercanía va en `merchantLocations`. El campo `locations` está
deprecado y ya no dispara avisos: hay una prueba que falla si alguien vuelve a usarlo.

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
- **Rol frente a los datos: Sello Fiel es ENCARGADO**, cada local es el Responsable (Ley 1581 de
  2012). La autorización del formulario se pide **a nombre del local**, nunca de Sello Fiel. Si un
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
