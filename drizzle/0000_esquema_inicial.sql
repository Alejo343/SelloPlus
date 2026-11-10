CREATE TYPE "public"."estado_alerta" AS ENUM('nueva', 'revisada', 'descartada');--> statement-breakpoint
CREATE TYPE "public"."estado_mensaje" AS ENUM('pendiente', 'enviado', 'descartado');--> statement-breakpoint
CREATE TYPE "public"."origen_sello" AS ENUM('nfc', 'qr', 'manual');--> statement-breakpoint
CREATE TYPE "public"."plataforma_tarjeta" AS ENUM('google', 'apple');--> statement-breakpoint
CREATE TYPE "public"."tipo_mensaje" AS ENUM('bienvenida', 'cumpleanos', 'inactividad', 'post_visita', 'evento', 'campana');--> statement-breakpoint
CREATE TABLE "alertas_fraude" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"local_id" uuid NOT NULL,
	"cliente_id" uuid,
	"sello_id" uuid,
	"motivo" text NOT NULL,
	"detalle" text,
	"estado" "estado_alerta" DEFAULT 'nueva' NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "canjes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"local_id" uuid NOT NULL,
	"cliente_id" uuid NOT NULL,
	"premio" text NOT NULL,
	"sellos_usados" smallint NOT NULL,
	"usuario_local_id" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clientes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"local_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"telefono" text NOT NULL,
	"email" text,
	"fecha_nacimiento" date,
	"consentimiento_en" timestamp with time zone NOT NULL,
	"consentimiento_version" text NOT NULL,
	"origen" text,
	"baja_en" timestamp with time zone,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clientes_local_telefono_unico" UNIQUE("local_id","telefono")
);
--> statement-breakpoint
CREATE TABLE "locales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"nombre" text NOT NULL,
	"logo_url" text,
	"color_primario" text DEFAULT '#111111' NOT NULL,
	"color_fondo" text DEFAULT '#ffffff' NOT NULL,
	"lat" text,
	"lng" text,
	"whatsapp" text,
	"google_maps_url" text,
	"zona_horaria" text DEFAULT 'America/Bogota' NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "locales_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "mensajes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"local_id" uuid NOT NULL,
	"cliente_id" uuid NOT NULL,
	"tipo" "tipo_mensaje" NOT NULL,
	"texto" text NOT NULL,
	"estado" "estado_mensaje" DEFAULT 'pendiente' NOT NULL,
	"programado_para" timestamp with time zone NOT NULL,
	"enviado_en" timestamp with time zone,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plantillas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"local_id" uuid NOT NULL,
	"tipo" "tipo_mensaje" NOT NULL,
	"texto" text NOT NULL,
	"activa" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plantillas_local_tipo_unico" UNIQUE("local_id","tipo")
);
--> statement-breakpoint
CREATE TABLE "programas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"local_id" uuid NOT NULL,
	"sellos_objetivo" smallint DEFAULT 10 NOT NULL,
	"premio" text NOT NULL,
	"beneficio_bienvenida" text,
	"semanas_inactividad" smallint DEFAULT 6 NOT NULL,
	"dias_antes_cumple" smallint DEFAULT 7 NOT NULL,
	"horas_post_visita" smallint DEFAULT 2 NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "programas_local_id_unique" UNIQUE("local_id")
);
--> statement-breakpoint
CREATE TABLE "sellos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"local_id" uuid NOT NULL,
	"cliente_id" uuid NOT NULL,
	"fecha" date NOT NULL,
	"origen" "origen_sello" NOT NULL,
	"tag_id" uuid,
	"contador_chip" integer,
	"usuario_local_id" uuid,
	"ip" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sellos_cliente_fecha_unico" UNIQUE("cliente_id","fecha")
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"local_id" uuid NOT NULL,
	"token" text NOT NULL,
	"uid" text,
	"objeto" text,
	"ultimo_contador" integer,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tags_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "tarjetas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cliente_id" uuid NOT NULL,
	"plataforma" "plataforma_tarjeta" NOT NULL,
	"serial" text NOT NULL,
	"auth_token" text,
	"push_token" text,
	"sincronizado_en" timestamp with time zone,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tarjetas_cliente_plataforma_unico" UNIQUE("cliente_id","plataforma")
);
--> statement-breakpoint
CREATE TABLE "usuarios_local" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"local_id" uuid NOT NULL,
	"email" text NOT NULL,
	"hash_contrasena" text NOT NULL,
	"nombre" text NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usuarios_local_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "alertas_fraude" ADD CONSTRAINT "alertas_fraude_local_id_locales_id_fk" FOREIGN KEY ("local_id") REFERENCES "public"."locales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alertas_fraude" ADD CONSTRAINT "alertas_fraude_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alertas_fraude" ADD CONSTRAINT "alertas_fraude_sello_id_sellos_id_fk" FOREIGN KEY ("sello_id") REFERENCES "public"."sellos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canjes" ADD CONSTRAINT "canjes_local_id_locales_id_fk" FOREIGN KEY ("local_id") REFERENCES "public"."locales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canjes" ADD CONSTRAINT "canjes_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canjes" ADD CONSTRAINT "canjes_usuario_local_id_usuarios_local_id_fk" FOREIGN KEY ("usuario_local_id") REFERENCES "public"."usuarios_local"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_local_id_locales_id_fk" FOREIGN KEY ("local_id") REFERENCES "public"."locales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensajes" ADD CONSTRAINT "mensajes_local_id_locales_id_fk" FOREIGN KEY ("local_id") REFERENCES "public"."locales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensajes" ADD CONSTRAINT "mensajes_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plantillas" ADD CONSTRAINT "plantillas_local_id_locales_id_fk" FOREIGN KEY ("local_id") REFERENCES "public"."locales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programas" ADD CONSTRAINT "programas_local_id_locales_id_fk" FOREIGN KEY ("local_id") REFERENCES "public"."locales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sellos" ADD CONSTRAINT "sellos_local_id_locales_id_fk" FOREIGN KEY ("local_id") REFERENCES "public"."locales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sellos" ADD CONSTRAINT "sellos_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sellos" ADD CONSTRAINT "sellos_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sellos" ADD CONSTRAINT "sellos_usuario_local_id_usuarios_local_id_fk" FOREIGN KEY ("usuario_local_id") REFERENCES "public"."usuarios_local"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_local_id_locales_id_fk" FOREIGN KEY ("local_id") REFERENCES "public"."locales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarjetas" ADD CONSTRAINT "tarjetas_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuarios_local" ADD CONSTRAINT "usuarios_local_local_id_locales_id_fk" FOREIGN KEY ("local_id") REFERENCES "public"."locales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alertas_local_estado_idx" ON "alertas_fraude" USING btree ("local_id","estado");--> statement-breakpoint
CREATE INDEX "canjes_cliente_idx" ON "canjes" USING btree ("cliente_id");--> statement-breakpoint
CREATE INDEX "canjes_local_idx" ON "canjes" USING btree ("local_id");--> statement-breakpoint
CREATE INDEX "clientes_local_idx" ON "clientes" USING btree ("local_id");--> statement-breakpoint
CREATE INDEX "clientes_cumple_idx" ON "clientes" USING btree ("local_id","fecha_nacimiento");--> statement-breakpoint
CREATE INDEX "mensajes_local_estado_idx" ON "mensajes" USING btree ("local_id","estado","programado_para");--> statement-breakpoint
CREATE INDEX "mensajes_cliente_idx" ON "mensajes" USING btree ("cliente_id");--> statement-breakpoint
CREATE INDEX "sellos_local_fecha_idx" ON "sellos" USING btree ("local_id","fecha");--> statement-breakpoint
CREATE INDEX "sellos_cliente_idx" ON "sellos" USING btree ("cliente_id");--> statement-breakpoint
CREATE INDEX "tags_local_idx" ON "tags" USING btree ("local_id");--> statement-breakpoint
CREATE INDEX "tarjetas_cliente_idx" ON "tarjetas" USING btree ("cliente_id");