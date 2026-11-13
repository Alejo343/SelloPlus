# Requisitos — Sistema de fidelización

Documento de requisitos. Complementa a [`ESPEC.md`](ESPEC.md) (cómo funciona cada pieza) y a
[`PLAN.md`](PLAN.md) (en qué orden se construye y cómo se prueba).

Los requisitos están numerados para poder rastrearlos: cada uno se cierra en una fase concreta
del plan y cada prueba apunta al requisito que verifica.

Fecha: 2026-11-10.

---

## 1. Actores

| Actor | Quién es | Dónde actúa |
|---|---|---|
| **Cliente** | El comensal. No descarga nada, no se registra en ninguna app | Su propio celular |
| **Mozo / cajero** | Quien apoya el chip en el celular del cliente | El salón |
| **Dueño del local** | Quien mira las métricas y dispara los mensajes | Panel web |
| **Operador** | Tú. Das de alta locales y mantienes el sistema | Panel de administración |

El actor crítico es el **mozo**: si el sistema le agrega trabajo, el local lo deja de usar. Todo
lo que se diseñe tiene que pasar ese filtro.

---

## 2. Requisitos funcionales

### 2.1 Cliente

| ID | Requisito | Fase |
|---|---|---|
| RF-01 | Unirse al club apoyando el celular en un chip NFC o escaneando un QR, **sin instalar ninguna app** | 2 |
| RF-02 | Darse de alta con **nombre, teléfono y fecha de nacimiento**, y nada más | 2 |
| RF-03 | Otorgar su consentimiento de tratamiento de datos de forma expresa, con casilla **no premarcada** | 2 |
| RF-04 | Agregar la tarjeta al wallet del celular. Es **opcional**: si no la agrega, igual queda en el club | 4 |
| RF-05 | Sumar un sello por visita apoyando el celular en el chip, **sin hacer nada más** | 2 |
| RF-06 | Ver cuántos sellos tiene, cuántos le faltan y cuál es el premio | 2 |
| RF-07 | Recibir confirmación en pantalla del sello sumado, o aviso de que ya sumó hoy | 2 |
| RF-08 | Canjear el premio al alcanzar el objetivo | 2 |
| RF-09 | Contactar al local por WhatsApp desde la tarjeta, para pedir o reservar | 2 |
| RF-10 | Recibir el aviso del local en la pantalla de bloqueo al pasar cerca | 4 |
| RF-11 | Recibir mensajes de cumpleaños, de regreso y de post-visita | 5 |
| RF-12 | **Darse de baja** de los mensajes de forma simple, y que se respete | 5 |
| RF-13 | Mantener sus sellos entre visitas aunque cambie de navegador o borre cookies | 1 |

### 2.2 Mozo

| ID | Requisito | Fase |
|---|---|---|
| RF-14 | Sumar un sello con **un solo gesto**: apoyar el tag en el celular del cliente | 7 |
| RF-15 | Que funcione sin que el cliente tenga el wallet abierto ni la tarjeta a la vista | 7 |
| RF-16 | Sumar un sello a mano desde el panel cuando el chip falle | 3 |
| RF-17 | Ver si el cliente llegó al premio en el momento de sumar el sello | 2 |

### 2.3 Dueño del local

| ID | Requisito | Fase |
|---|---|---|
| RF-18 | Entrar a su panel con email y contraseña, y ver **solo los datos de su local** | 3 |
| RF-19 | Ver la base de clientes con buscador: último sello, total, cumpleaños | 3 |
| RF-20 | Ver la **tasa de fidelización**: cuántos clientes volvieron en el período | 3 |
| RF-21 | Ver clientes totales, altas del mes, sellos del mes y premios canjeados | 3 |
| RF-22 | Configurar el programa: objetivo de sellos, premio y beneficio de bienvenida | 3 |
| RF-23 | Configurar el local: nombre, logo, colores, coordenadas, WhatsApp y link de reseñas | 3 |
| RF-24 | Generar el QR del local en PDF para imprimir y pegar en las mesas | 3 |
| RF-25 | Editar las plantillas de los mensajes | 5 |
| RF-26 | Ver la **bandeja de pendientes**: a quién hay que escribirle hoy y por qué, con el mensaje ya armado y un botón para enviarlo | 5 |
| RF-27 | Marcar un mensaje como enviado, y que no vuelva a aparecer | 5 |
| RF-28 | Recibir el reclamo cuando un cliente califica mal la visita, en vez de que vaya a Google | 5 |
| RF-29 | Ver las alertas de posible fraude y marcarlas como revisadas o descartadas | 6 |
| RF-30 | Dar de alta y de baja los tags NFC del local | 7 |
| RF-31 | Enviar campañas masivas segmentadas | 9 |
| RF-32 | Operar varias sucursales con tarjeta compartida, desde un solo panel | 9 |
| RF-33 | Exportar su base de clientes | 9 |

### 2.4 Operador

| ID | Requisito | Fase |
|---|---|---|
| RF-34 | Dar de alta un local nuevo y crear su primer usuario | 3 |
| RF-35 | Ver el estado del sistema: sellos del día, errores, trabajos programados | 6 |

### 2.5 Reglas de negocio

| ID | Regla | Fase |
|---|---|---|
| RN-01 | **Un sello por cliente por día**, por local | 1 |
| RN-02 | El canje reinicia el contador de sellos del cliente | 1 |
| RN-03 | Un cliente pertenece a un local; los sellos no cruzan entre locales de distintos dueños | 1 |
| RN-04 | Un contador de chip ya usado se **rechaza** y genera alerta | 6 |
| RN-05 | El mensaje de cumpleaños se dispara unos días **antes** de la fecha, no el día | 5 |
| RN-06 | El mensaje de regreso se dispara tras N semanas sin sellos, configurable por local | 5 |
| RN-07 | El mensaje de post-visita se dispara **2 horas** después del sello | 5 |
| RN-08 | Un cliente dado de baja nunca entra en ninguna selección de mensajes | 5 |
| RN-09 | Las alertas de fraude **avisan, no bloquean** | 6 |
| RN-10 | Un **QR impreso fijo NO puede sumar sellos**: solo sirve para unirse al club. El sello exige un mecanismo que no se pueda copiar con una foto | 6 |
| RN-11 | Para locales sin NFC, el sello por QR exige un **código rotativo** mostrado en el local, válido unos segundos | 6 |

---

## 3. Requisitos no funcionales

| ID | Requisito | Por qué |
|---|---|---|
| RNF-01 | El tap tiene que responder en **menos de 1,5 s en 4G** | Pasa delante del cliente, con el mozo esperando. Si duda, el local lo abandona |
| RNF-02 | **Móvil primero.** Las pantallas del cliente se diseñan para celular; el escritorio es secundario | El 100% de los clientes entra desde el teléfono |
| RNF-03 | Funciona en el **navegador de Android y de iOS sin app** | Es la premisa del producto |
| RNF-04 | Si el sistema no responde, el mozo tiene una vía alterna para no perder la visita | Un local no puede depender de que el servidor esté arriba para atender |
| RNF-05 | **Aislamiento estricto entre locales.** Toda consulta filtra por local, y está probado | Es una base de datos de personas de terceros |
| RNF-06 | Los tokens de los tags y de los QR **no se pueden adivinar ni enumerar** | Un token adivinable regala sellos |
| RNF-07 | Límite de peticiones en el alta y en el tap | El formulario está abierto a internet detrás de un QR público |
| RNF-08 | **Respaldo diario** de la base, con restauración probada | La base de clientes es el activo que el local está pagando |
| RNF-09 | Queda registro de cada sello y de cada mensaje, con fecha, origen y responsable | Para resolver disputas y detectar fraude |
| RNF-10 | Todo en **español**, moneda COP, fechas en formato local | Mercado colombiano |
| RNF-11 | Costo de operación cercano a cero en las primeras fases | No hay ingresos todavía |
| RNF-12 | Contraste y tamaños accesibles; se usa con una mano, de pie, en un salón con poca luz | Contexto real de uso |
| RNF-13 | El mecanismo que suma un sello tiene que **resistir que lo copien**: una foto del QR, o la lectura del chip con otro celular, no pueden servir para sumar desde casa | Sin esto, el programa regala premios y, peor, **ensucia la tasa de retorno**, que es el producto que se vende |

---

## 4. Requisitos legales — Colombia

No son opcionales: el producto **es** una base de datos de personas.

| ID | Requisito | Fase |
|---|---|---|
| RL-01 | Autorización **previa, expresa e informada** antes de guardar cualquier dato (Ley 1581 de 2012) | 2 |
| RL-02 | Guardar la **prueba del consentimiento** con fecha, hora y versión del texto aceptado | 2 |
| RL-03 | Política de tratamiento de datos accesible, que diga quién responde, para qué se usan los datos y cómo pedir baja o corrección | 2 |
| RL-04 | Vía efectiva para que el titular consulte, corrija o elimine sus datos | 5 |
| RL-05 | Mecanismo de baja en todos los mensajes de marketing, y respetarlo | 5 |
| RL-06 | **DECIDIDO (2026-11-11): actúas como ENCARGADO.** La base es del local, tú solo la procesas por su cuenta. Se refleja en la política de tratamiento | 2 |
| RL-11 | Contrato de transmisión de datos con cada local. **Diferido a la Fase 10**: hace falta para firmar con un local real, no para que el sistema funcione | 10 |
| RL-07 | Evaluar si corresponde registrar las bases en el **RNBD** de la SIC | 2 |
| RL-08 | Política de retención: cuánto tiempo se guardan los datos de un cliente inactivo | 5 |
| RL-09 | **DECIDIDO (2026-11-11):** si un local deja de usar el servicio, se le entrega su base y se borra de nuestro lado. Hay que declararlo en la política y en el contrato | 2 |
| RL-10 | Si el servidor está fuera de Colombia, los datos salen del país: hay que cubrir la transmisión internacional en el contrato. **Pendiente de confirmar dónde está el VPS** | 10 |

**RL-06 quedó decidido: ENCARGADO.** Consecuencias que se arrastran al resto del sistema:

- La autorización del cliente se pide **a nombre del local**, no de Sello Fiel. En el formulario el
  titular le está dando sus datos a "La Esquina", no a una empresa que no conoce. Es también lo
  que menos fricción genera y lo que más gente completa.
- Cada local es quien responde ante la SIC por el uso que le dé a su base. A nosotros nos
  corresponde la seguridad de la plataforma y la confidencialidad.
- El registro en el RNBD, cuando aplique, le corresponde a cada local, no a nosotros.
- La política de tratamiento tiene que nombrar al local como Responsable y a Sello Fiel como
  Encargado, con los datos de contacto de los dos.
- Hace falta un **contrato de transmisión de datos** por local. Eso no es una pantalla, sino un
  documento aparte, y quedó **diferido a la Fase 10**. Lo que NO se difiere es la política de
  tratamiento: ese texto va dentro del formulario y sin él no se puede guardar ningún dato.
- No se pueden usar los datos de un local para nada propio sin una autorización adicional y
  específica. Si algún día se quiere una red de beneficios entre locales, es otro producto y otra
  autorización.

Nada de esto impide nada técnicamente, pero define el texto del formulario de la Fase 2.

---

## 5. Requisitos externos (dependencias que no controlo)

| ID | Qué | Costo | Cuándo se necesita |
|---|---|---|---|
| RE-01 | PostgreSQL con rol y bases propias | — | **Ya resuelto** (2026-11-10) |
| RE-02 | Subdominio con HTTPS para el servicio | — | Fase 2 |
| RE-03 | **Cuenta de emisor de Google Wallet** aprobada | Gratis, pero la aprobación demora | Fase 4 |
| RE-04 | Tags NFC NTAG213 para las primeras pruebas | Bajo | Fase 7 |
| RE-05 | Logo y colores de cada local que se dé de alta | — | Fase 3 |
| RE-06 | Apple Developer Program | **USD 99/año** | Fase 9, si se decide |
| RE-07 | WhatsApp Business Cloud API: número dedicado, verificación de Meta y plantillas aprobadas | Costo por mensaje | Fase 9, si se decide |
| RE-08 | Tags NTAG 424 DNA + app Android propia para grabarlos | Medio | Solo si aparece fraude real |

---

## 6. Restricciones técnicas conocidas

Verificadas el 2026-11-10. Condicionan lo que se le puede prometer a un local.

1. **Google Wallet**: el campo `locations[]` está deprecado y ya no dispara avisos. Hay que usar
   `merchantLocations`. Google decide el radio, el tiempo de permanencia y el texto del aviso;
   nosotros no.
2. **Aviso por cercanía en Android**: solo le llega a quien le dio al wallet permiso de ubicación
   *siempre*. No se puede prometer cobertura total.
3. **iPhone contra Android en el tap**: en Android la URL se abre directo; en iPhone aparece una
   notificación que el cliente **tiene que tocar**. Son dos gestos, no uno.
4. **NTAG 424 DNA no se puede grabar desde iOS.** Hace falta Android y, para la configuración
   segura, una app propia. Es la razón de empezar con NTAG213.
5. **Apple Wallet** exige certificado de pago anual **y** implementar el PassKit Web Service con
   APNs para que los sellos se actualicen solos. No es solo el costo.
6. **Los links `wa.me` no escalan**: alguien del local tiene que hacer clic en cada mensaje. Sirve
   para validar que los mensajes funcionan, no para cien locales.
7. **Un sello por día** es una decisión de producto, no una limitación: es la defensa antifraude
   más efectiva y la más barata. Pero **limita el abuso, no lo impide**: quien copie el mecanismo
   puede sumar un sello diario desde su casa, y llegar al premio en diez días sin pisar el local.

8. **Un QR impreso fijo es copiable con una foto.** Es una URL estática: cualquiera la fotografía,
   la guarda y la abre desde donde quiera. Detectado el 2026-11-13.

9. **Un chip NTAG213 tiene exactamente el mismo problema.** Es una idea contraintuitiva y conviene
   tenerla clara: el chip barato guarda una URL fija, y cualquier celular con NFC puede leerla y
   reutilizarla después. Lo único que resuelve esto de raíz es el **NTAG 424 DNA con SUN**, que
   genera un código distinto en cada toque. Es decir, el plan de "empezar con NTAG213" comparte la
   debilidad del QR impreso, no es más seguro por ser NFC.

---

## 7. Fuera de alcance

Para que no se confunda con lo que hace Menuly, que es un producto más grande:

- Carta digital, pedidos desde la mesa, platos en 3D o realidad aumentada.
- Reservas con plano del salón.
- Caja, inventario, compras o gestión de equipo.
- Bandeja unificada de Instagram y Facebook. Solo WhatsApp, y en fase tardía.
- Cobro de la suscripción dentro del sistema. Al principio se cobra por fuera.
- App móvil, propia o para el cliente. Es contrario a la premisa del producto.

---

## 8. Criterios de aceptación del producto

El sistema se considera listo para vender a un local cuando:

1. Un cliente se da de alta desde su celular en menos de 30 segundos, sin ayuda.
2. Un mozo suma un sello en un solo gesto, sin tocar su propio teléfono.
3. Dos taps el mismo día generan un solo sello, siempre, incluso simultáneos.
4. El dueño entra a su panel y entiende su tasa de fidelización sin que nadie le explique.
5. El dueño puede escribirle hoy, con un clic, a todos los que cumplen años esta semana y a todos
   los que dejaron de venir.
6. El local A no puede ver ni un dato del local B, y hay una prueba que lo demuestra.
7. Todo cliente en la base tiene su consentimiento registrado con fecha.
8. Si el servidor se cae, el local tiene cómo seguir atendiendo.
