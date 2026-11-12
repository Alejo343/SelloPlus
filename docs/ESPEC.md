# Sistema de fidelización con tarjeta en wallet + NFC

Especificación sacada del análisis de los 17 reels de `reels/_clasificado/05_gastronomia_fidelizacion.md`
(cuentas `@menuly.ar` y `@marco.scaine`), más lo que se ve del panel en
`04_gastronomia_software_carta.md`.

Fecha del análisis: 2026-11-10.

---

## 1. Qué es, en una frase

Reemplaza la tarjeta de cartón de sellos por una **tarjeta digital en el wallet del celular**
(Apple Wallet / Google Wallet). El cliente suma sellos apoyando el celular en un **chip NFC**
o escaneando un **QR**. A cambio de los sellos, el local se queda con el **nombre, WhatsApp y
fecha de nacimiento** de todos los que pasan, y el sistema les **escribe solo** para que vuelvan.

La frase que más repiten en las ventas: *"lo importante no son los sellos, es que te quedan los
datos de todos los que pasan por el local"*. Los sellos son la carnada; el producto real es la
base de datos + las automatizaciones de WhatsApp.

---

## 2. Flujo del cliente final

1. **Primer contacto.** El mozo le apoya el chip NFC en el celular (o el cliente escanea un QR
   de la mesa / caja). No descarga ninguna app.
2. **Formulario corto.** Se abre una web que pide **nombre, teléfono/WhatsApp y fecha de
   nacimiento** (en un reel también email). Es el único momento en que el cliente escribe algo.
3. **Agregar la tarjeta al wallet.** Botón "Añadir a Google Wallet" / "Add to Apple Wallet".
   En los reels aclaran que este paso es **opcional**: si no la agrega, igual quedó registrado
   con sus datos.
4. **Sumar sellos.** Cada visita, el mozo apoya el mismo chip en el celular del cliente y suma
   un sello. Mensaje en pantalla: *"ya registramos tu visita"* o *"ya sumaste tu visita de hoy,
   volvé mañana para sumar otro sello"*.
5. **Canje.** Al llegar al objetivo, premio del local. Ejemplos reales de los reels:
   - 10 sellos → cena para dos
   - 9 visitas → bono de $20.000 para la próxima compra
   - 6 compras → un helado o un café con leche
6. **La tarjeta sigue trabajando.** Queda entre las tarjetas de crédito del wallet, así que el
   logo del local aparece cada vez que el cliente va a pagar en cualquier lado. Tiene además un
   botón para **pedir o reservar por WhatsApp**.

### El aviso por cercanía
La tarjeta del wallet lleva guardada la ubicación del local. Cuando el cliente pasa cerca, **su
propio celular** le muestra la tarjeta en la pantalla de bloqueo. El local no ve dónde está el
cliente y el cliente lo puede desactivar. Esto no lo programa uno: es una función nativa del
wallet, uno solo declara las coordenadas al emitir la tarjeta (ver §6).

---

## 3. Flujo del local

- El **tag NFC vive en el local**, no en el celular del cliente. Lo apoya el mozo o el cajero.
- Lo esconden dentro de objetos decorativos personalizados: una **media luna** de resina, un
  **esmalte** de uñas, una **corona**, dentro de una **planta**. Es parte del gancho de venta:
  "mirá lo que hace esta media luna por tu negocio".
- Insisten mucho en que **tiene que ser rápido para el mozo**: con QR habría que pedirle al
  cliente que abra el wallet, busque la tarjeta y la muestre para escanear el QR. Con NFC se
  apoya el chip y listo, sin que el wallet esté abierto.
- Cuando el cliente ya canjeó, **el local ve los sellos desde su panel** (un reel: *"el cliente
  te muestra que tiene 10 sellos" / "desde acá"*).

---

## 4. Panel del local

De los reels, el panel tiene:

- **Base de datos de clientes**: todos los que alguna vez pasaron por el local, no solo los que
  reservaron o pidieron.
- **Estadísticas**: la métrica estrella es la **tasa de fidelización** (cuántos clientes
  volvieron este mes). El argumento de venta: *"mientras más clientes fieles, menos dependés de
  traer clientes nuevos todos los meses"*.
- **Bandeja unificada de conversaciones**: WhatsApp, Instagram y Facebook en un mismo lugar.
- **Campañas manuales** (remarketing): "Día de la milanesa", "Día de la pizza con X% menos",
  "San Valentín". Botón enviar → le llega a toda la base por WhatsApp, con botón de reservar
  mesa o hacer pedido.
- **Multi-local / cadenas**: misma tarjeta, canjeable en cualquier sucursal. Aclaran el límite
  real: *"el problema es cuando es franquicia con dueño distinto"* (bases separadas).
- También mencionan reservas con plano del salón, pero eso ya es territorio de Menuly-carta, no
  del módulo de fidelización.

---

## 5. Automatizaciones (el corazón del producto)

Todas disparan por WhatsApp, basadas en la fecha del último sello:

| Disparador | Mensaje |
|---|---|
| **Cumpleaños** (unos días antes / una semana antes) | Saludo + promo especial de cumpleaños |
| **Cliente inactivo** (varias semanas sin sumar sello) | *"Martín, hace mucho que no pedís, tenemos un regalo"* |
| **2 horas después de la visita** | *"¿Cómo estuvo la comida?"* → si bien: link directo a Google Maps para dejar reseña; si mal: disculpas y el reclamo va al dueño, no a Google |
| **Evento en el local** | Invitación a la base |
| **Promoción / campaña** | Envío masivo segmentado |
| **Al unirse al club** | Beneficio de bienvenida |

El filtro de reseñas es una de las partes más vendibles: *"está bueno las quejas, porque las
quejas no llevan al cliente \[a Google\], nos llevan a nosotros directamente"*.

---

## 6. Cómo se construye cada pieza

### 6.1 La tarjeta en el wallet

**Google Wallet** (Android):
- API REST de Google Wallet. Se crea una `loyaltyclass` (la plantilla del local: logo, colores,
  nombre del programa, premio) y una `loyaltyobject` por cliente (sus sellos).
- Los sellos se actualizan con un `PATCH` al `loyaltyobject`. El campo `loyaltyPoints.balance`
  es el contador; `notifyPreference` controla si el cambio dispara notificación.
- El botón "Añadir a Google Wallet" es un JWT firmado con una service account.
- Cuenta de emisor (issuer) gratis, pero hay que pedirla y esperar aprobación.

**Apple Wallet** (iPhone):
- Un `.pkpass` tipo `storeCard`, firmado con un **certificado Pass Type ID**. Eso obliga a tener
  **Apple Developer Program: USD 99/año**. Es el único costo fijo ineludible.
- Para que los sellos cambien sin que el cliente vuelva a descargar la tarjeta hay que
  implementar el **PassKit Web Service**: endpoints de registro de dispositivo, push vía APNs y
  entrega del pass actualizado. Es bastante más trabajo que Google.

**Aviso por cercanía — lo verificado hoy:**
- **Apple**: el `.pkpass` acepta un array `locations` (hasta 10 puntos) y `maxDistance`. Funciona
  desde siempre y es la base de los reels.
- **Google**: el campo `locations[]` de `loyaltyobject` **está deprecado y ya NO dispara
  notificaciones**. Hay que usar **`merchantLocations`** (hasta 10 por clase y 10 por objeto).
  Google decide el radio, el tiempo de permanencia y el texto de la notificación; uno no lo
  controla. Las "Nearby Passes Geofence Notifications" quedaron disponibles para todos los tipos
  de pase desde octubre de 2025.
- **Importante para las expectativas**: en Android solo le llega a quien le dio al wallet permiso
  de ubicación *siempre*. No se le puede prometer al local que le va a llegar a todos.

### 6.2 El chip NFC — esta es la parte fina

Los reels describen *"un chip especial que emite una señal única cada vez que se escanea, lo que
nos permite que no nos copien la señal y sumen sellos sin haber venido al local"*, y en el vlog
se escucha al hermano configurándolos: **"te pide URL y una clave AES"**.

Eso es, casi con certeza, un **NTAG 424 DNA** (NXP) con **SUN/SDM** activado:
- En cada tap el chip arma la URL y le inyecta un código dinámico (CMAC AES-128) calculado sobre
  el UID y un **contador de lecturas de 24 bits**.
- El backend valida el CMAC con la clave AES y **rechaza contadores repetidos o viejos**. Ahí está
  la anticlonación real: sin esa validación server-side, el chip no sirve de nada.
- Cuesta más que un NTAG213 común. En el reel los traen **de Italia** porque "acá no se
  consiguen" (en Argentina).

**El problema que ellos tuvieron y nos vamos a encontrar igual:**
- Las apps de iOS del App Store **no pueden grabar** la configuración SUN del chip seguro.
  Tuvieron que bajar Android Studio y **programarse su propia app Android** para grabar los tags.
- Además: grabado desde Android con el tipo de registro equivocado, **iOS no lo reconoce**. El
  registro NDEF tiene que ser un URI bien formado y primero en el mensaje.
- Diferencia de experiencia por plataforma: en **Android** el tap abre la URL directo; en **iOS**
  sale una **notificación que el cliente tiene que tocar** para que se abra el club. Funciona sin
  app desde iPhone XS / iOS 13, pero son dos toques, no uno.

### 6.3 WhatsApp

Es el canal de todas las automatizaciones, y el punto más caro y más regulado:
- Hace falta **WhatsApp Business Cloud API** (Meta): número dedicado, verificación del negocio y
  **plantillas aprobadas** para cada mensaje de marketing.
- Los mensajes de marketing (cumpleaños, "volvé", campañas) **se cobran por mensaje** y necesitan
  opt-in explícito. Hay que verificar la tarifa vigente para Colombia antes de prometer precios.
- Alternativa barata para arrancar: en vez de enviar, **generar links `wa.me` con texto
  prearmado** y que el local los dispare a mano. Sirve para validar, no escala.

### 6.4 Antifraude (lo tienen explícito)

Tres capas, las tres fáciles de copiar:
1. Chip con señal única no replicable (contador + CMAC).
2. **Máximo un sello por día por cliente** ("volvé mañana para sumar otro sello").
3. Un sistema que **analiza cada sello buscando inconsistencias y manda alerta** para revisión
   manual. En el reel muestran el caso de un juego en una expo: detectó velocidad anormal, perfil
   sospechoso (dos participantes eran pasantes de restaurantes de Asunción, podían conocerse) y un
   vacío en las reglas. Dieron el veredicto como *sugerencia con un tip*, no como bloqueo
   automático. Eso huele a un LLM revisando eventos, no a reglas duras.

### 6.5 Stack sugerido para este VPS

Ya hay Node 22, PostgreSQL y PM2 andando, así que lo natural:
- **Next.js** (App Router) para el formulario público, la landing del club y el panel del local.
- **PostgreSQL** para locales, clientes, sellos, canjes, eventos y cola de mensajes.
- **PM2** + puerto propio detrás de LiteSpeed, igual que `ingles`, `musicroaster`, etc.
- Un worker (cron o `node-cron`) para los disparadores de cumpleaños e inactividad.
- La app Android para grabar los tags es un proyecto aparte y chico; se puede empezar con tags
  más simples (ver §9) y dejarla para después.

---

## 7. Modelo de datos mínimo

```
local            id, nombre, logo, colores, lat, lng, whatsapp, google_maps_url
programa         local_id, sellos_objetivo, premio, beneficio_bienvenida
cliente          local_id, nombre, telefono, email, fecha_nac, consentimiento_at, origen
tarjeta          cliente_id, plataforma (apple|google), serial, auth_token, push_token
sello            cliente_id, fecha, origen (nfc|qr|manual), tag_id, contador_chip, ip
canje            cliente_id, fecha, premio, usuario_local
tag              local_id, uid, clave_aes (cifrada), ultimo_contador, objeto ("media luna")
mensaje          cliente_id, tipo, plantilla, estado, enviado_at, respuesta
alerta_fraude    cliente_id, sello_id, motivo, score, estado
```

Clave: `sello` guarda el **contador del chip** para rechazar replays, y `cliente` guarda el
**timestamp del consentimiento** por lo de §8.

---

## 8. Legal en Colombia — no es opcional

Esto en Argentina lo manejan suelto, pero acá el producto **es** una base de datos de personas:
- **Ley 1581 de 2012 (habeas data)**: hay que pedir **autorización previa, expresa e informada**
  antes de guardar los datos. En la práctica: checkbox no premarcado en el formulario + link a la
  política de tratamiento de datos, y guardar la prueba del consentimiento con fecha.
- La política tiene que decir quién es el responsable (el local o tú como operador), para qué se
  usan los datos y cómo se piden baja o corrección.
- Mensajes de marketing: tiene que haber forma fácil de **darse de baja** y hay que respetarla.
- Las bases de datos personales se **registran en el RNBD** de la SIC según el tamaño del
  responsable. Hay que verificar si aplica a cada local o a ti.

**Decidido el 2026-11-11: Sello Fiel actúa como ENCARGADO**, y cada local es el Responsable de su
base. La autorización se pide a nombre del local. Si un local se va, se le entrega su base y se
borra de nuestro lado, y eso se declara desde el principio: es además el mejor argumento de venta,
porque sus clientes son suyos y se los puede llevar.

Queda pendiente confirmar **dónde está físicamente el VPS**: si está fuera de Colombia, los datos
salen del país y hay que cubrir la transmisión internacional en el contrato con cada local.

---

## 9. Qué no sabemos de los reels

- El precio. Nunca lo dicen. Menuly-carta se promociona **gratis** ("sin tarjeta, sin comisión,
  sin permanencia"), así que el club puede ser el módulo que monetiza, pero es especulación.
- Si el club de `@menuly.ar` y el sistema de `@marco.scaine` son el mismo producto o dos
  empresas distintas que hacen lo mismo. Comparten mecánica casi idéntica.
- Qué marca/modelo exacto de chip es, y a qué proveedor lo compran.
- Cómo se ve el panel por dentro (nunca lo muestran en detalle en los reels de fidelización).
- Si la detección de fraude es un LLM o reglas.

---

## 10. Plan por fases

**Fase 1 — Validar la mecánica (1 semana, casi sin costo)**
QR en vez de NFC. Formulario con consentimiento. Tarjeta solo en **Google Wallet** (gratis).
Sellos con un sello por día. Panel mínimo: listado de clientes, sellos, tasa de retorno.
Mensajes de cumpleaños e inactividad como **links `wa.me`** que el local dispara a mano.

**Fase 2 — Que el mozo no sufra**
Tags NFC. Arrancar con **NTAG213 + token rotativo del lado del servidor** (más barato, se
consigue local, ninguna app para grabar) y pasar a NTAG 424 DNA solo cuando aparezca el fraude
real. Página de "sumar sello" para el mozo desde su propio celular.

**Fase 3 — Apple + automático**
Apple Developer + `.pkpass` + PassKit Web Service con APNs. WhatsApp Cloud API con plantillas
aprobadas y envío automático. Ubicaciones en la tarjeta (`locations` en Apple,
`merchantLocations` en Google).

**Fase 4 — Lo que lo hace vendible**
Reseñas filtradas a las 2 h. Campañas masivas. Multi-sucursal. Bandeja de conversaciones.
Antifraude con alertas. Tags dentro de objetos personalizados por local.

El orden importa: la Fase 1 ya se le puede mostrar a un local y cobrarle. Las fases 3 y 4 son
las que cuestan plata y las que ellos tardaron meses en armar.

---

## Fuentes técnicas consultadas (2026-11-10)

- [REST Resource: loyaltyobject — Google Wallet](https://developers.google.com/wallet/reference/rest/v1/loyaltyobject)
- [MerchantLocation — Google Wallet](https://developers.google.com/wallet/reference/rest/v1/MerchantLocation)
- [Trigger Push Notifications — Loyalty cards](https://developers.google.com/wallet/retail/loyalty-cards/use-cases/trigger-push-notifications)
- [Wallet release notes](https://developers.google.com/wallet/docs/release-notes)
- [NTAG 424 DNA datasheet (NXP)](https://docs.ampnuts.ru/nxp.com.datasheet/NT4H2421Gx.pdf)
- [NXP NTAG424 DNA — notas de Wakdev](https://www.wakdev.com/en/knowledge-base/nfc-chips/nxp-ntag424-dna.html)
