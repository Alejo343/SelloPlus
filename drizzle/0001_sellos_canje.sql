ALTER TABLE "sellos" ADD COLUMN "canje_id" uuid;--> statement-breakpoint
ALTER TABLE "sellos" ADD CONSTRAINT "sellos_canje_fk" FOREIGN KEY ("canje_id") REFERENCES "public"."canjes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sellos_cliente_canje_idx" ON "sellos" USING btree ("cliente_id","canje_id");