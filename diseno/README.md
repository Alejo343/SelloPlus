# diseño

Acá no hay nada que editar.

La landing de Sello Fiel se trabaja **directamente en `/var/www/sellofiel/index.html`**,
que es el archivo que sirve https://sellofiel.app. Decidido el 2026-11-13: antes había una
copia acá y otra en `/var/www`, y mantener las dos sincronizadas a mano era un error
esperando a pasar.

Está versionada con git normal, en esa misma carpeta. El `.git` está bloqueado al público
con una regla `rewrite` en el vhost; sin ella sería descargable desde internet.
