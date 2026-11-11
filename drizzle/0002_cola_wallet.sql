CREATE TYPE "public"."estado_sincronizacion" AS ENUM('pendiente', 'hecha', 'fallida');--> statement-breakpoint
CREATE TYPE "public"."tipo_sincronizacion" AS ENUM('crear_clase', 'crear_objeto', 'actualizar_sellos');--> statement-breakpoint
CREATE TABLE "cola_wallet" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"local_id" uuid NOT NULL,
	"cliente_id" uuid,
	"tipo" "tipo_sincronizacion" NOT NULL,
	"estado" "estado_sincronizacion" DEFAULT 'pendiente' NOT NULL,
	"intentos" smallint DEFAULT 0 NOT NULL,
	"ultimo_error" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"procesado_en" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "cola_wallet" ADD CONSTRAINT "cola_wallet_local_id_locales_id_fk" FOREIGN KEY ("local_id") REFERENCES "public"."locales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cola_wallet" ADD CONSTRAINT "cola_wallet_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cola_wallet_estado_idx" ON "cola_wallet" USING btree ("estado","creado_en");--> statement-breakpoint
CREATE UNIQUE INDEX "cola_wallet_pendiente_unico" ON "cola_wallet" USING btree ("cliente_id","tipo") WHERE "cola_wallet"."estado" = 'pendiente';