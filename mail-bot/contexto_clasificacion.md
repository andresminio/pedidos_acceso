# Contexto para el clasificador

Este archivo se manda tal cual dentro del prompt de Gemini en cada
clasificación. Editalo cuando quieras — no hace falta tocar código ni
redeployar nada, el próximo run del workflow ya lo toma.

Usalo para ajustar casos que la IA esté clasificando mal: remitentes a
excluir siempre (spam, listas internas, proveedores), remitentes a
incluir siempre aunque el texto sea ambiguo, o cualquier aclaración de
criterio ("los mails de tal juzgado casi siempre son pedidos", "estos
son notificaciones automáticas, no pedidos", etc.).

**La sección "Remitentes a excluir siempre" es especial**: esas líneas
NO solo se le pasan a Gemini como pista — el bot las lee directo y, si
el remitente de un mail matchea, ni siquiera llama a la IA (ahorra
tokens). Formato: un bullet por línea, con el mail completo o
`*@dominio.com` para todo un dominio, seguido opcionalmente de "→
comentario". Las otras dos secciones son solo texto libre para Gemini,
no se parsean.

## Remitentes / dominios a excluir siempre (NO son pedidos de acceso)

<!-- Ejemplo:
- noreply@algunsistema.gov.ar → notificaciones automáticas del sistema X
- *@spamdominio.com
-->

## Remitentes / dominios a incluir siempre (SON pedidos de acceso)

<!-- Ejemplo:
- mesadeentradas@algunjuzgado.gov.ar → siempre reenvían pedidos de acceso
-->

## Otras aclaraciones de criterio

<!-- Ejemplo:
- Los mails con asunto que empieza "Ley 27.275" son casi siempre pedidos formales.
- Los mails de la lista interna "prensa@cne.gov.ar" nunca son pedidos, son uso interno.
-->
