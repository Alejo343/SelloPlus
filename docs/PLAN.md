# Plan de construcción — Sistema de fidelización

Complemento de [`ESPEC.md`](ESPEC.md), que describe *qué* hay que construir. Este documento
describe *en qué orden*, *cómo se prueba* y *cuándo se considera terminada* cada parte.

Fecha: 2026-11-10.

## Decisiones ya tomadas

| Decisión | Elegido |
|---|---|
| Alcance | **Multi-local (SaaS)** desde el inicio: aislamiento de datos por local |
| Wallet | **Solo Google Wallet** en las primeras fases. Apple queda para más adelante |
| WhatsApp | **Links `wa.me`** que el local dispara con un clic. Cloud API más adelante |

## Principios de trabajo

1. **Funcional antes que bonito.** Hasta la Fase 7 las pantallas son HTML sin estilo, feas y
   claras. El diseño es una fase propia al final, no un goteo constante.
2. **Cada fase se puede mostrar.** Al cerrar cualquier fase el sistema funciona de punta a punta,
   solo con menos funciones. Nunca queda a medio terminar.
3. **Ninguna fase cierra sin pruebas en verde.** Las pruebas se escriben en la misma fase que el
   código que prueban, no después.
4. **El multi-local se prueba, no se asume.** Toda consulta a la base filtra por local, y hay una
   prueba dedicada a que el local A no pueda ver datos del local B.
5. **Nada se publica sin tu permiso.** Se desarrolla en `/home/claude/proyectos/fidelizacion` y
   solo se mueve a `/var/www` y PM2 cuando lo autorices.

---

## Stack

- **Next.js 16.4** (App Router) + TypeScript — formulario público, club y panel en un solo proceso.
  Ojo: trae cambios importantes respecto a Next 15; la documentación de la versión instalada está
  en `node_modules/next/dist/docs/` y hay que leerla antes de escribir código.
- **PostgreSQL** — ya instalado en el VPS.
- **Drizzle ORM** + migraciones SQL versionadas. Esquema tipado y migraciones legibles.
- **Vitest** — pruebas unitarias y de integración.
- **Playwright** — pruebas de punta a punta. Ya está preinstalado en este entorno.
- **PM2** detrás de LiteSpeed, en el puerto **3011** (el 3010 ya está ocupado en el VPS).
- **Zod** — validación de todo lo que entra por HTTP.

Sin librería de componentes ni Tailwind hasta la Fase 7, para no pintar sobre algo que va a
cambiar.

---

## Estructura propuesta

```
fidelizacion/
├─ CLAUDE.md                contexto para sesiones futuras
├─ docs/
│  ├─ ESPEC.md              qué se construye
│  ├─ REQUISITOS.md         requisitos numerados
│  └─ PLAN.md               este documento
├─ drizzle/                 migraciones SQL versionadas
├─ src/
│  ├─ db/                   esquema y conexión
│  ├─ dominio/              reglas de negocio puras, sin HTTP ni SQL
│  │   ├─ sellos.ts         ¿puede sumar? ¿llegó al premio?
│  │   ├─ retencion.ts      cálculo de la tasa de fidelización
│  │   ├─ inactividad.ts    a quién hay que escribirle
│  │   └─ mensajes.ts       armado de las plantillas
│  ├─ servicios/            lo que toca la base y el mundo exterior
│  ├─ app/
│  │   ├─ t/[token]/        el tap del NFC / QR
│  │   ├─ c/[slug]/         alta al club y estado de la tarjeta
│  │   └─ panel/            panel del local
│  └─ lib/
└─ tests/
   ├─ unidad/
   ├─ integracion/
   └─ e2e/
```

La carpeta `dominio/` es la apuesta importante: las reglas (un sello por día, cuándo alguien
está inactivo, cómo se calcula la retención) son funciones puras que se prueban sin base de datos
ni navegador. Es lo que hace que las pruebas sean rápidas y que las reglas se puedan cambiar sin
miedo.

---

## Fases

### Fase 0 — Cimientos ✅ terminada el 2026-11-10
*Sin ninguna función visible. Es la fase que hace que las demás sean rápidas.*

**Entregables**
- Proyecto Next.js + TypeScript con lint y formato configurados.
- Conexión a PostgreSQL y primera migración (esquema completo de `ESPEC.md` §7).
- Vitest y Playwright configurados y corriendo en vacío.
- Script de semilla: 2 locales de prueba con clientes y sellos, para poder probar el aislamiento.
- `CLAUDE.md` del proyecto, para que cualquier sesión futura entienda el contexto sin releer todo.

**Criterio de cierre**
- `npm test` corre y pasa (aunque sea con una prueba trivial).
- `npm run db:migrate` crea el esquema desde cero en una base vacía.
- `npm run db:seed` deja datos de los dos locales.

---

### Fase 1 — Núcleo de sellos (sin interfaz)
*El corazón del sistema, probado antes de que exista una sola pantalla linda.*

**Entregables**
- Alta de cliente en un local, con nombre, teléfono, fecha de nacimiento y **consentimiento**.
- Suma de sello con la regla de **un sello por día por cliente**.
- Detección de llegada al objetivo y registro del canje.
- Identificación del cliente entre visitas (cookie firmada, con el teléfono como respaldo).
- Resolución del tag: un token en la URL dice a qué local y a qué tag pertenece el tap.

**Pruebas**
- Unidad: sumar sello el mismo día no suma dos veces; al llegar al objetivo marca premio
  disponible; el canje reinicia el contador.
- Unidad: cumpleaños e inactividad calculados contra fechas fijas, incluido el 29 de febrero.
- Integración: el cliente del local A no aparece en ninguna consulta del local B.
- Integración: dos taps simultáneos del mismo cliente generan **un** sello, no dos (prueba de
  concurrencia real contra la base).

**Criterio de cierre**
Se puede recorrer todo el flujo —alta, sello, sello repetido rechazado, premio, canje— desde las
pruebas, sin abrir un navegador.

---

### Fase 2 — Pantallas públicas funcionales
*HTML crudo. Fea a propósito.*

**Entregables**
- `/t/[token]` — el tap: si el cliente es nuevo lo manda al formulario; si ya está, le suma el
  sello y le muestra *"ya registramos tu visita"* o *"ya sumaste tu visita de hoy"*.
- `/c/[slug]/alta` — formulario con los tres campos y el **checkbox de consentimiento sin
  premarcar**, con link a la política de tratamiento de datos.
- `/c/[slug]/tarjeta` — estado del club: cuántos sellos tiene, cuántos le faltan, cuál es el
  premio, botón de WhatsApp al local.
- Página de política de tratamiento de datos (plantilla con los huecos del local).

**Pruebas**
- E2E con Playwright: recorrido completo en móvil simulado, de tap a tarjeta con un sello.
- E2E: enviar el formulario sin marcar el consentimiento falla y no crea el cliente.
- E2E: segundo tap el mismo día muestra el mensaje de "volvé mañana".

**Criterio de cierre**
Puedes abrir una URL en tu celular, darte de alta y ver tu sello. Ya es demostrable a un local.

---

### Fase 3 — Panel del local

**Entregables**
- Login por local (email + contraseña, sesión en cookie). Nada de usuarios por rol todavía.
- Listado de clientes con buscador: último sello, total de sellos, cumpleaños.
- Métricas: clientes totales, altas del mes, **tasa de fidelización** (cuántos volvieron),
  sellos del mes, premios canjeados.
- Pantalla "sumar sello a mano" para cuando falle el chip.
- Configuración del programa: objetivo de sellos, premio, beneficio de bienvenida, datos y
  coordenadas del local.
- Generación del QR del local en PDF para imprimir.

**Pruebas**
- Integración: la tasa de fidelización sobre datos de semilla da un número conocido a mano.
- E2E: login, ver cliente, sumar sello a mano, verlo reflejado.
- Seguridad: pedir una URL del panel sin sesión redirige al login; con la sesión del local A,
  pedir un recurso del local B devuelve 404, no el dato.

---

### Fase 4 — Tarjeta en Google Wallet
*Requiere que tengas la cuenta de emisor aprobada. Ver bloqueantes.*

**Entregables**
- Alta de `loyaltyclass` por local, con logo, colores y premio.
- Alta de `loyaltyobject` por cliente y botón "Añadir a Google Wallet" (JWT firmado).
- Actualización de sellos por `PATCH` al sumar un sello.
- `merchantLocations` con las coordenadas del local, para el aviso por cercanía.
- Modo simulado: si no hay credenciales, el sistema sigue funcionando y registra lo que habría
  enviado. Así nadie queda bloqueado esperando a Google.

**Pruebas**
- Unidad: el JWT se firma y decodifica con la estructura que pide Google.
- Unidad: el objeto se arma bien a partir de un cliente, con los sellos como balance.
- Integración contra el modo simulado: sumar un sello encola exactamente una actualización.
- Una prueba manual real contra la cuenta de Google, documentada con captura. Esto no se
  automatiza.

---

### Fase 5 — Mensajes para que vuelvan

**Entregables**
- Plantillas editables por local: bienvenida, cumpleaños, inactividad, post-visita, evento.
- Trabajo programado diario que calcula a quién hay que escribirle hoy y por qué.
- **Bandeja de pendientes** en el panel: lista de mensajes por enviar, cada uno con su botón
  `wa.me` ya armado, y marca de "enviado" al hacer clic.
- Post-visita a las 2 horas, con el link directo a reseñas de Google Maps si la respuesta es
  buena y aviso al dueño si es mala.
- Registro de bajas: quien pide no recibir más, no vuelve a aparecer en la bandeja.

**Pruebas**
- Unidad: con una base de clientes de fechas fijas, el trabajo diario selecciona exactamente a
  los que corresponde. Caso borde: cumpleaños el 29 de febrero en año no bisiesto.
- Unidad: el link `wa.me` se arma con el teléfono normalizado a formato internacional y el texto
  codificado. Probado con números colombianos y argentinos.
- Unidad: un cliente dado de baja nunca entra en la selección.
- E2E: la bandeja muestra el pendiente, el clic lo marca como enviado y no reaparece.

---

### Fase 6 — Antifraude

**Entregables**
- Validación del contador del chip: un contador repetido o viejo se rechaza y se registra.
- Reglas de alerta: sellos en ráfaga, muchos clientes nuevos en pocos minutos, canjes fuera del
  horario del local.
- Pantalla de alertas en el panel, con estado revisada/descartada. **Alerta, no bloqueo**, igual
  que ellos.

**Pruebas**
- Unidad: cada regla se dispara con su caso y no se dispara con el caso inocente parecido.
- Integración: reusar un contador ya visto devuelve rechazo y crea una alerta.

---

### Fase 7 — NFC físico
*La única fase con costo en hardware y con pasos fuera de la pantalla.*

**Entregables**
- Arrancar con **NTAG213 + token rotativo del lado del servidor**: barato, se consigue local y no
  hace falta ninguna app para grabarlo. Suficiente mientras no haya fraude real.
- Procedimiento escrito de grabado de tags y de alta en el panel.
- Prueba en Android y en iPhone, documentando la diferencia: Android abre directo, iPhone muestra
  una notificación que hay que tocar.
- Evaluar NTAG 424 DNA solo si aparece fraude. Eso arrastra la app Android propia para grabarlos.

**Criterio de cierre**
Un tag físico pegado bajo una mesa suma un sello en los dos sistemas operativos.

---

### Fase 8 — Diseño
*Ahora sí.*

**Entregables**
- Identidad del producto y de la tarjeta.
- Rediseño de las pantallas públicas pensadas para móvil, que es donde viven.
- Rediseño del panel.
- Personalización por local: logo, colores y fondo, como hace Menuly con la carta.
- Revisión de accesibilidad y de contraste.

**Criterio de cierre**
Las pruebas E2E de las fases anteriores siguen pasando sin tocarlas. Si el rediseño las rompe,
es que estaban mal escritas y se arreglan.

---

### Fase 9 — Lo que lo hace vendible

- Campañas masivas segmentadas ("Día de la pizza").
- Multi-sucursal con tarjeta compartida entre locales del mismo dueño.
- Panel de dueño sobre varias sucursales.
- Exportar la base de clientes.
- Página de venta y material para mostrar en los locales.
- Evaluar Apple Wallet y WhatsApp Cloud API con datos reales de uso en la mano.

---

## Estrategia de pruebas

| Tipo | Herramienta | Qué cubre | Cuándo corre |
|---|---|---|---|
| Unidad | Vitest | Reglas de `dominio/`: sellos, retención, inactividad, armado de mensajes | En cada cambio. Segundos |
| Integración | Vitest + PostgreSQL de prueba | Consultas reales, aislamiento entre locales, concurrencia | Antes de cerrar cada fase |
| E2E | Playwright | Los recorridos del cliente y del local, en móvil simulado | Antes de cerrar cada fase |
| Manual | Tú | Wallet real, chip real, WhatsApp real | Fases 4 y 7 |

Reglas fijas:
- **Base de datos de prueba aparte**, que se crea y se borra en cada corrida. Nunca se prueba
  contra la base de desarrollo.
- Las pruebas de fechas usan **reloj simulado**, nunca `new Date()` real, para que no se rompan
  solas en diciembre.
- Toda corrección de un error entra con la prueba que lo reproduce. Si no hay prueba, el error
  vuelve.
- Nada de perseguir un porcentaje de cobertura. Lo que importa es que `dominio/` esté cubierto
  completo, porque ahí vive el dinero.

---

## Bloqueantes que dependen de ti

1. **PostgreSQL — necesario para empezar la Fase 0.** El usuario `claude` no existe en Postgres y
   no tengo sudo para crearlo. Hay que correr, como root:

   ```
   sudo -u postgres psql -c "CREATE ROLE claude LOGIN PASSWORD 'una-clave-que-elijas';"
   sudo -u postgres psql -c "CREATE DATABASE fidelizacion_dev OWNER claude;"
   sudo -u postgres psql -c "CREATE DATABASE fidelizacion_test OWNER claude;"
   ```

   Después yo guardo la clave en el `.env` del proyecto y no la muestro más.

2. **Cuenta de emisor de Google Wallet — necesaria para la Fase 4, no antes.** Se pide en la
   consola de Google Pay & Wallet y la aprobación tarda. Conviene pedirla ahora para que esté
   lista cuando lleguemos. Es gratis.

3. **Decisión legal — necesaria para la Fase 2.** Si vendes como *responsable* de los datos (la
   base es tuya) o como *operador* (la base es del local). Cambia el texto de la política de
   tratamiento y quién responde ante la SIC. Lo puedo redactar, pero la decisión es tuya.

4. **Hardware — Fase 7.** Comprar tags NFC. Primero unos pocos NTAG213 para probar.

Nada de esto bloquea las fases 1, 2 y 3 salvo el punto 1, que bloquea todo.

---

## Orden sugerido y por qué

Las fases 1 a 3 no dependen de nadie más que de la base de datos, y al terminarlas ya tienes algo
que se le puede mostrar a un local y cobrarle: alta de clientes, sellos por QR, panel con la tasa
de retorno y mensajes armados a mano. Eso es la mitad del valor del producto con un décimo del
trabajo.

Las fases 4 a 7 son las que cuestan plata y tiempo, y son exactamente las que a ellos les tomó
meses. Tiene sentido pagarlas cuando ya haya un local usando el sistema y pidiéndolas.

La Fase 8 va al final a propósito. Si se diseña antes, se diseña sobre suposiciones y se tira.
