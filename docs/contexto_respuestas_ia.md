# Contexto para "Generar respuesta con IA"

Este archivo es el contexto que usa (o debería usar — ver "Estado de
implementación" al final) el endpoint `app/api/generar-respuesta/route.ts`
para redactar el borrador de respuesta a un pedido de acceso a la
información pública. Mismo criterio que `mail-bot/contexto_clasificacion.md`
para el bot de correo: es texto editable a mano, pensado para ir
ajustándose con el tiempo sin tocar código.

**Última actualización de las tablas de fuentes: 04/09/2026** (fecha del
relevamiento de `CNE_repositorio_drive.xlsx` y
`CNE_sintesis_informacion_publica.xlsx`).

---

## 1. Formato obligatorio de cada respuesta generada

Toda respuesta generada por la IA tiene tres partes, en este orden:

### 1.1 Asunto

El asunto que escribió el solicitante, seguido de " – " y su apellido en
MAYÚSCULA. Si el asunto original es muy genérico (ej. "Pedido de
información"), reemplazarlo por una categoría que describa el pedido.

Ejemplo: `Resultados 2025 – PÉREZ`

### 1.2 Encabezado a Nora (fijo, siempre igual salvo los datos variables)

```
Buenos días Nora,
Te enviamos una propuesta para responder al pedido de APELLIDO DEL SOLICITANTE del DD/MM/AAAA
Quedamos atentos a tus comentarios
Saludos
UEEDA
```

`APELLIDO DEL SOLICITANTE` y la fecha son los únicos datos que cambian.
Debajo de este bloque fijo va la respuesta generada por la IA (parte 1.3).

### 1.3 Cuerpo de la respuesta (lo que se le manda al solicitante)

- Empieza con `Estimado/Estimada NOMBRE COMPLETO:` (dos puntos, no coma —
  salvo que el ejemplo de referencia use coma, ver ejemplos abajo, ambas
  formas se vienen usando).
- Tono institucional, formal pero claro. Directo al grano: no repetir "en
  relación a su pedido" más de una vez, no rellenar.
- Si corresponde remitir a una fuente (sitio público o repositorio, ver
  secciones 3 y 4), incluir el/los link(s) reales — nunca inventar una URL.
- Nunca decir "no tenemos [tal dato]" ni frases equivalentes de negación
  directa. En cambio, indicar desde cuándo hay disponibilidad (ej. "el
  repositorio digitalizado corresponde al período a partir de 1983" en vez
  de "no tenemos datos de 1971") — ver ejemplo 3.7.
- Nunca remitir más de lo que se pidió estrictamente. Si el pedido es por
  un año/dato puntual que existe, pasar solo ese recurso puntual (no toda
  la serie ni el repositorio completo). Si el pedido es por un año/dato que
  no existe, no remitir ningún link del repositorio — solo informar desde
  cuándo hay disponibilidad (ver ejemplo 3.7).
- Nunca redirigir a "canales institucionales de atención al ciudadano" ni
  frases equivalentes genéricas (mesa de entradas, atención al público,
  etc.). Si no hay un procedimiento o vía de contacto puntual y verificado
  en este archivo, no inventar uno ni derivar a un canal genérico.
- Cierra con:
  ```
  Quedamos a disposición ante cualquier consulta o inquietud.
  Saludos cordiales,
  Unidad de Estadística Electoral y Datos Abiertos
  Cámara Nacional Electoral
  ```
  (la firma es fija, siempre estas dos últimas líneas).

---

## 2. Ejemplo objetivo (el formato completo, tal como lo espera Andrés)

Este es el ejemplo de referencia principal — el output ideal, con las tres
partes juntas:

```
Asunto: Resultados 2025 – PÉREZ

Buenos días Nora,
Te enviamos una propuesta para responder al pedido de PÉREZ del 4/09/2026
Quedamos atentos a tus comentarios
Saludos
UEEDA

Estimada Julieta Pérez:
En relación con su solicitud, informamos que los datos disponibles
corresponden a aquellos publicados por las Secretarías Electorales de cada
distrito a través de la Consulta Pública de Resultados, disponible en
padron.gob.ar/publica

Tales datos desagregados por mesa electoral, en formato abierto, pueden
descargarse desde los siguientes enlaces:
Resultados 2005

Los diseños de registro correspondientes a la elección se encuentran en la
siguiente carpeta.
Diseños de registro

Quedamos a disposición ante cualquier consulta o inquietud.
Unidad de Estadística Electoral y Datos Abiertos
Cámara Nacional Electoral
```

(Nota: en este ejemplo puntual el apellido en "Te enviamos una propuesta
para responder al pedido de PÉREZ..." no coincide con el destinatario de la
respuesta "Estimada Julieta Pérez" — es un error de tipeo del ejemplo
original de Andrés, no una regla: el apellido de esa línea SIEMPRE tiene
que ser el del solicitante real del pedido que se está respondiendo.)

---

## 3. Respuestas modelo (para el tono institucional y la firma)

Estos son ejemplos reales ya enviados. Sirven para que la IA imite el
registro, la estructura de párrafos y las fórmulas de cortesía — no para
copiar el contenido literal (cada pedido es distinto).

### 3.0 Guía rápida: qué modelo usar según el pedido

| Tipo de pedido | Modelo |
|---|---|
| Resultados electorales por mesa/año, formato abierto | 3.1 |
| Resultados específicamente en formato `.txt` | 3.2 |
| Locales de votación geolocalizados | 3.3 |
| Padrón + domicilio u otro dato que el padrón anonimizado NO tiene → negativa parcial fundamentada | 3.4 |
| Participación electoral / algo consultable directo en el sitio público de la CNE | 3.5 |
| Padrón + edad, fecha de nacimiento o franja etaria | 3.6 |
| Año o período fuera de cobertura (ej. anterior a 1983) | 3.7 |
| Padrón anonimizado, pedido genérico (sin domicilio ni edad) | 3.8 |

Si el pedido no encaja claramente en ninguno, usar el criterio general de
la sección 6 (sitio público vs. Drive) y el formato base de la sección 1.

### 3.1 Resultados electorales por mesa (ejemplo: Francisco Gómez)

```
Estimado Francisco Gómez:

En relación con su solicitud, informamos que los datos disponibles
corresponden a aquellos publicados por las Secretarías Electorales de cada
distrito a través de la Consulta Pública de Resultados, disponible en
padron.gob.ar/publica.

Tales datos desagregados por mesa electoral, en formato abierto, pueden
descargarse desde los siguientes enlaces:
Resultados 2005 · Resultados 2007 · Resultados 2009 · Resultados 2011 ·
Resultados 2013 · Resultados 2015 · Resultados 2017 · Resultados 2019 ·
Resultados 2021 · Resultados 2023 · Resultados 2025

Los diseños de registro correspondientes a cada escrutinio se encuentran en
la siguiente carpeta.
Diseños de registro

Por otra parte, si resultara de su interés contamos con un repositorio de
actas de escrutinio [link] en las cuales se encuentran consignados los
resultados totalizados por distrito, cargo y agrupación política.

Saludos cordiales.
Unidad de Estadística Electoral y Datos Abiertos
Cámara Nacional Electoral
```

### 3.2 Resultados en texto plano (ejemplo: Enrique Ramírez)

Variante del anterior cuando el pedido es específicamente sobre formato
`.txt`: mismo cuerpo, aclarando el formato, y agrega una referencia a
períodos anteriores vía actas en PDF cuando corresponde.

### 3.3 Locales de votación geolocalizados (ejemplo: Juan Pablo Ibarra)

```
Estimado Juan Pablo Ibarra:

Esperando que se encuentre muy bien, nos ponemos en contacto a fin de
remitirle, adjunta, la tabla geolocalizada de los locales de votación
correspondientes a los establecimientos afectados a las elecciones
nacionales de [año].

La información fue extraída del Registro de Delegados y Locales de
Votación y presenta la siguiente estructura de variables: [variables].

Asimismo, ponemos a su disposición las tablas correspondientes a otros
años electorales. Estas pueden contener o no información geográfica, según
el año, pero entendemos que podrían resultar de utilidad para los
objetivos de su investigación.

Se encuentran disponibles en los siguientes enlaces:
Locales 2005 · Locales 2007 · Locales 2009 · Locales 2011 · Locales 2013 ·
Locales 2015 · Locales 2017 · Locales 2019 · Locales 2021 · Locales 2025

Por último, le informamos que la distribución de electores y mesas entre
los locales de votación pudo haber sido modificada durante el desarrollo
de alguno de los procesos electorales por cuestiones edilicias,
climáticas o de fuerza mayor. Por este motivo, la información remitida
podría presentar diferencias menores respecto de la distribución
efectivamente utilizada el día de la elección.

Quedamos a su disposición ante cualquier consulta o inquietud.
Saludos cordiales,
Unidad de Estadística Electoral y Datos Abiertos
Cámara Nacional Electoral
```

### 3.4 Padrón anonimizado con estado de infractor (ejemplo: Franco Suárez)

Caso con una negativa parcial fundamentada: cuando se pide el "domicilio
electoral registrado" (dato que excede lo que se entrega ante pedidos de
padrón), la respuesta:
- Entrega lo que SÍ se puede dar (padrón anonimizado + estado en Registro
  de Infractores, con su estructura de variables).
- Explica por qué el domicilio no se entrega, citando la Resolución Nº
  12/2021 de la Agencia de Acceso a la Administración Pública del Consejo
  de la Magistratura (protección de no identificación de electores).
- Informa la vía correcta para pedir domicilios (jueces/funcionarios del
  Poder Judicial y Ministerio Público, o abogados de la matrícula vía art.
  400 CPCCN y art. 8º ley 23.187 — art. 8º ley 23.853, Acordada 17/2025
  CSJN).
- Aclara que el padrón anonimizado ya incluye circuito/mesa/establecimiento,
  que permiten buen nivel de precisión territorial sin comprometer la
  identificación individual.

**Usar este modelo como referencia cuando el pedido incluya datos
personales de electores que exceden lo anonimizable** (domicilio,
identificación individual, etc.) — no inventar la fundamentación legal,
usar textualmente las normas citadas acá si aplica un caso similar.

### 3.5 Participación electoral y remisión directa al sitio público (ejemplo: Silvina Correa)

```
Estimada Silvina Correa,

Esperando se encuentre muy bien, nos ponemos en contacto en relación con
su solicitud para informarle que el porcentaje de participación en las
elecciones a partir del año 2015 se encuentra disponible en el siguiente
enlace: https://www.electoral.gob.ar/nuevo/paginas/datos/participacion.php

Los datos publicados provienen del sistema del Registro de Infractores al
Deber de Votar, el cual se conforma a partir de la lectura de los
troqueles del padrón de cada mesa electoral del país.

Por otra parte, en el sitio https://www.padron.gov.ar/publica/ pueden
consultarse -y descargarse en formato abierto- los resultados por
distrito, elección, mesa, zona (sección) o cargo, y visualizar la
participación según tipo de elección y categoría de cargos. Cabe aclarar
que los datos disponibles corresponden a la información publicada por las
Secretarías Electorales de cada distrito, por lo que el año a partir del
cual se encuentra disponible la información puede variar.

Con idéntico criterio, en
https://www.electoral.gob.ar/nuevo/paginas/jne/secretarias.php se pueden
consultar (ingresando a cada distrito y luego los comicios en cuestión)
los resultados que las propias Secretarías Electorales oportunamente
disponibilizaron en formato PDF.

Finalmente, [si aplica] le acercamos acceso a los archivos históricos
escaneados con las actas de escrutinio de las elecciones de medio término
disponibles en este Tribunal: 1985, 1987, 1991, 1993, 1997, 2001, 2005,
2009, 2013, 2017, 2021 [links, ver sección 4].

Quedamos a disposición ante cualquier consulta o inquietud.
Saludos cordiales,
Unidad de Estadística Electoral y Datos Abiertos
Cámara Nacional Electoral
```

**Este es el modelo a usar cuando conviene remitir directamente al sitio
público de la CNE en vez de armar un archivo/carpeta propia** — ver
sección 5 para el criterio de cuándo usar sitio público vs. repositorio
interno.

### 3.6 Padrón con edad o franja etaria (ejemplo: Ezequiel Torres, una organización de la sociedad civil)

```
Estimado Ezequiel Torres:

En relación con su solicitud, le informamos que puede acceder al padrón
electoral anonimizado correspondiente a [elección/año pedido, o la más
reciente disponible si no especificó], el cual incluye la fecha de
nacimiento de cada elector como variable, en el siguiente enlace:
[link de la subcarpeta del año correspondiente, ver sección 4]

La estructura de variables del padrón anonimizado es: distrito, sección,
circuito, establecimiento, mesa, género, fecha de nacimiento y estado
(votó / no votó).

Quedamos a disposición ante cualquier consulta o inquietud.
Saludos cordiales,
Unidad de Estadística Electoral y Datos Abiertos
Cámara Nacional Electoral
```

**IMPORTANTE — no confundir con el caso Suárez (3.4):** un pedido de
padrón con **edad o franja etaria** NO amerita negativa parcial. El
padrón anonimizado ya incluye "fecha de nacimiento" como variable
propia, así que se entrega sin más (usando la subcarpeta del año/elección
puntual pedido — ver sección 4, "Links de padrón con participación por
año"; si no se especifica año, usar el más reciente disponible). La
negativa parcial de la sección 3.4 aplica solo cuando se pide un dato que
el padrón anonimizado NO tiene (ej. domicilio), no a la edad.

**Ojo — este modelo (3.6) es solo para cuando el pedido menciona edad,
fecha de nacimiento o franja etaria.** No usar esta redacción ni
mencionar "fecha de nacimiento" ni la lista de variables para un pedido
genérico de padrón que no habló de eso — ver 3.8.

### 3.7 Pedido de un período no disponible (ejemplo: Rodrigo Fernández, resultados 1971)

```
Estimado Rodrigo Fernández:

En relación con su solicitud sobre los resultados electorales del año
1971, le informamos que el repositorio digitalizado de esta Unidad
dispone de resultados electorales a partir del año 1983.

Respecto de la documentación correspondiente a comicios anteriores a esa
fecha, la misma no se encuentra digitalizada en los sistemas de acceso
público de esta Unidad.

Quedamos a disposición ante cualquier consulta o inquietud.
Saludos cordiales,
Unidad de Estadística Electoral y Datos Abiertos
Cámara Nacional Electoral
```

**Tres reglas que este ejemplo fija:**
- No se dice "no tenemos datos de 1971" — se dice desde cuándo hay
  disponibilidad ("a partir del año 1983").
- No se adjuntan los links del repositorio (actas históricas, resultados
  nacionales, etc.): 1971 no es el año pedido y esos recursos no
  corresponden a lo que el solicitante pidió, así que no se remiten.
  Mismo criterio a la inversa: si el año pedido SÍ existe, se remite
  solo el recurso de ese año puntual (ver tablas "por año" de la sección
  4), no la serie completa ni la carpeta madre.
- **Nunca redirigir a "canales institucionales de atención al ciudadano"**
  ni frases equivalentes genéricas (mesa de entradas, atención al público,
  etc.). Si no hay un procedimiento o vía de contacto puntual y verificado
  en este archivo, no inventar uno ni derivar a un canal genérico — la
  respuesta simplemente informa el límite de disponibilidad y cierra ahí.

### 3.8 Padrón anonimizado, pedido genérico (sin domicilio ni edad) (ejemplo: Valeria Ana Medina)

```
Estimada Valeria Ana Medina:

En relación con su solicitud, le informamos que puede acceder al padrón
electoral anonimizado correspondiente a [elección/año pedido, o la más
reciente disponible si no especificó], en el siguiente enlace:
[link de la subcarpeta del año correspondiente, ver sección 4]

Quedamos a disposición ante cualquier consulta o inquietud.
Saludos cordiales,
Unidad de Estadística Electoral y Datos Abiertos
Cámara Nacional Electoral
```

**Usar este modelo — no el de 3.4 ni el de 3.6 — para cualquier pedido de
padrón anonimizado que no mencione domicilio, edad, fecha de nacimiento
ni franja etaria.** No describir la estructura de variables del padrón
(distrito, sección, género, fecha de nacimiento, etc.): varía según el
año/elección, y listarla de memoria puede quedar desactualizada o directamente
mal. Si el solicitante no pidió esa información, no hay que aclarársela
de oficio. Los modelos 3.4 y 3.6 sí la mencionan, pero únicamente porque
ahí es necesaria para resolver el caso puntual (justificar por qué no
hace falta el domicilio, o confirmar que sí hay fecha de nacimiento
cuando la pidieron).

---

## 4. Repositorio interno (Google Drive) — recursos por categoría

Fuente: `CNE_repositorio_drive.xlsx` (relevamiento 04/09/2026, verificado
por acceso directo a cada carpeta/archivo).

| Categoría | Subcategoría | Recurso | Cobertura | Link |
|---|---|---|---|---|
| Boletas de Votación | — | Boletas 1983-2025 (por año y distrito; falta 2019) | 1983-2025 | https://drive.google.com/drive/folders/1lJmSRf3UJXuK1u6TZrVeCvGFJgV1wbtD?usp=drive_link |
| Agrupaciones Políticas | Documentación | Actas constitutivas y resoluciones de reconocimiento, plataformas electorales (por año) | 1983-2025 | https://drive.google.com/drive/folders/1Wek9lGx2-zz2_0ExCmQw2lAhu5-R8SPj?usp=drive_link |
| Resultados Electorales | Nacionales | RESULTADOS — actas de escrutinio, datos abiertos, diseños de registro, escrutinios totalizados por mesa, consolidados | 1983-2025 | https://drive.google.com/drive/folders/1pEZ75Zo901ChzKjMaDcRswtu_2d_Vt84?usp=drive_link |
| Padrón Electoral | Establecimientos de votación | LOCALES — locales por elección (.txt/.csv) + georreferenciados (2019, 2021 PASO, 2023) | 2005-2025 | https://drive.google.com/drive/folders/1JVzTeI9czQPSi6cr9qhx9U1PN2JQn0rr?usp=drive_link |
| Participación y Ausentismo Electoral | Participación | Padrón cruzado con participación (votó/no votó), anonimizado — carpeta con subcarpetas por elección, ver tabla de links por año más abajo. Incluye fecha de nacimiento como variable (por eso sirve también para pedidos de edad/franja etaria, no solo participación) | 2015-2025 | https://drive.google.com/drive/folders/1vfwUrV8hScALjRZKyvaVhM47g2CenGe4?usp=drive_link |
| Electores Privados de Libertad | Composición y/o participación | PDL — actas de escrutinio, electores/votantes, resultados por distrito y agrupación | 2007-2025 | https://drive.google.com/drive/folders/15M4TA9lgYNBJJVUtMgWSUQoPKIbxsdr-?usp=drive_link |
| Electores Residentes en el Exterior | Composición | Planilla RERE — electores por país, representación consular, sección | 2013-2025 | https://docs.google.com/spreadsheets/d/1ShgPVlSrIbqLsSqT8q_YhAVM8dLzjFTQ/edit?usp=sharing |
| Resultados Electorales | Nacionales | RESULTADOS (2) — segunda carpeta, por año + índice de contenidos | 2005-2025 | https://drive.google.com/drive/folders/17wIuuP5xcEC5dsVRRV-dADSBV0znYmZx?usp=drive_link |
| Voto Joven | Participación | Planilla jóvenes electores y votantes, por elección/distrito/género | 2015-2025 | https://docs.google.com/spreadsheets/d/1EscJQv5hNVTYJmKtHyUm7O54nUKPYtob/edit?usp=sharing |
| Agrupaciones Políticas | Agrupaciones políticas y alianzas | VIGENTES — partidos políticos vigentes a distintas fechas de corte | 2020-2026 | https://drive.google.com/drive/folders/19uJ5vhkjQmGfzNSHMaT0L3N6IHN4DT-u?usp=drive_link |
| Agrupaciones Políticas | Afiliados | Planilla afiliados por agrupación y distrito (desagrega por género en años recientes) | 1998-2025 | https://docs.google.com/spreadsheets/d/1deyc_gN8pV1SsVzwT00TClmr8VzV0jNb/edit?usp=drive_link |

### Links de resultados por año (de los ejemplos de respuesta, sección 3.1)

| Año | Link |
|---|---|
| 2005 | https://drive.google.com/drive/folders/1SiobtjSyQj6Xyb_cafG3IP5ALGXd1AbO |
| 2007 | https://drive.google.com/drive/folders/1NU8aKO9zPeR5kfnH0i5pHzKj8n2H9O3Z |
| 2009 | https://drive.google.com/drive/folders/1OcUBUt8HCNdaE6h1EmuEqHGdqN2wbNl1 |
| 2011 | https://drive.google.com/drive/folders/1427DTAj3RAn20c5SA-0gtOc-JuqxU4gE |
| 2013 | https://drive.google.com/drive/folders/1pLMhz0wiLzpflHoEjs_alCZUCS1bqIpK |
| 2015 | https://drive.google.com/drive/folders/1ykTz_IVVGsR66QBwHoaprgabU-tWdZqo |
| 2017 | https://drive.google.com/drive/folders/1D2TxauYgf7B-PDjYVor6ifaAzaTwvOog |
| 2019 | https://drive.google.com/drive/folders/17CXeccdKwhi17Bk5W_Z3hsXpPngsSvay |
| 2021 | https://drive.google.com/drive/folders/1xTOStjQ3S1eo3Sl4nYwKiE0M0bb2aKhT |
| 2023 | https://drive.google.com/drive/folders/1T2ZU87EA9wTtYjs5AWxneYPFhTLdEUmo |
| 2025 | https://drive.google.com/drive/folders/1WGFD8la8u4DcQ8EP3fHhA8VSTvqBcHg4 |

Diseños de registro (todas las elecciones): https://drive.google.com/drive/folders/1Q_1lBfN31ifRffzyYkMYHjmmn_1Vd_br?usp=drive_link

Repositorio de actas de escrutinio (totalizados por distrito/cargo/agrupación): https://drive.google.com/drive/folders/1e-Z75BNqcx0FwSRcM-tGefNdzvPR7TD4?usp=drive_link

### Links de locales de votación por año (de la sección 3.3)

| Año | Link |
|---|---|
| 2005 | https://drive.google.com/file/d/17hvuicli5lnE1tUe1TGaNM2geW1ptUAO/view?usp=sharing |
| 2007 | https://drive.google.com/file/d/1sELXG17siHeqvbLJiONy_NgyTwaCui29/view?usp=sharing |
| 2009 | https://drive.google.com/file/d/1mjf8E56sf5ObJrp7b3JWYVgyr-fjiITr/view?usp=sharing |
| 2011 | https://drive.google.com/file/d/1G-QO-lBhaD0iZYw1nVxW-4zkdr_mSciQ/view?usp=sharing |
| 2013 | https://drive.google.com/file/d/1IMgRFlQumiIVFi6dJjV4Sc70lzFvYAp2/view?usp=sharing |
| 2015 | https://drive.google.com/file/d/1IX-iv3HWyfBUc3uMHEP79SZrRX-Sq68X/view?usp=sharing |
| 2017 | https://drive.google.com/file/d/1j7aePGNrYJ9aARAO-BGzdaiP7XG-ElW3/view?usp=sharing |
| 2019 | https://drive.google.com/file/d/1zemFgk8LeEsA4ZBw01cRHuLGg9svf2pz/view?usp=sharing |
| 2021 | https://drive.google.com/file/d/1nZpOmcTEuxevfORwMZsAiQc1Mu8PNNiv/view?usp=sharing |
| 2025 | https://drive.google.com/file/d/1MxwrPLkPP5GEQfyRFj5qrPdw-KHO12sO/view?usp=sharing |

Padrones anonimizados con estado de infractor (ejemplo Suárez, sección 3.4): https://drive.google.com/drive/folders/1g5m-WDEPt74UG3bEG94if7W34TMgTm2K?usp=drive_link

### Links de padrón con participación por año (ejemplo Torres, sección 3.6)

Subcarpetas de la fila "Participación y Ausentismo Electoral" de la tabla
de arriba. Usar la subcarpeta del año/elección puntual que pidió el
solicitante — no la carpeta madre.

| Año / elección | Link |
|---|---|
| 2015 PASO | https://drive.google.com/drive/folders/1IW4XAPsYVXdGmc-edSiL9aqLwFsM-nld?usp=drive_link |
| 2017 | https://drive.google.com/drive/folders/1wkhij6ySCbCe8nWHVCGd2TSUV3QGNV8e?usp=drive_link |
| 2019 Generales | https://drive.google.com/drive/folders/1O3L68FLPm1j1Cr9yNW4zcaeXxcTikdhH?usp=drive_link |
| 2021 | https://drive.google.com/drive/folders/1hcusP12uup0T5cPeDgZ-j1lXnVO8BRUG?usp=drive_link |
| 2023 | https://drive.google.com/drive/folders/132_mFcrJZ90qty0TOZGiHxesdUWyHhgy?usp=drive_link |
| 2025 | https://drive.google.com/drive/folders/1dZVaS4vzmK26DWHdOwKkY6pVznbu64rn?usp=drive_link |

### Actas históricas escaneadas — elecciones de medio término (sección 3.5)

| Año | Link |
|---|---|
| 1985 | https://drive.google.com/drive/folders/1ohO2RsMJPV0L51DT3TIAnHI_f4E5OowO?usp=drive_link |
| 1987 | https://drive.google.com/drive/folders/1Dr8xnu1HVEonQVmv6w0Z4z2Cyvb303_R?usp=sharing |
| 1991 | https://drive.google.com/drive/folders/1J8Q_ViiX_TROl7Fcm8oA_zMOR_LAh_mC?usp=sharing |
| 1993 | https://drive.google.com/drive/folders/1GByJeKLW4sO3MyE0QFT73Ge3UrkW8CjM?usp=sharing |
| 1997 | https://drive.google.com/drive/folders/1EyYj2GKie3nEEM0gPm6M27Fx-1wrDK-n?usp=sharing |
| 2001 | https://drive.google.com/drive/folders/1cam9-ISfQwrIaFg5-Pv1BQEMs6sPfsfa?usp=sharing |
| 2005 | https://drive.google.com/drive/folders/1MD6Zxs8Nh3NIRrOg4OI13FJwZeo3R6kv?usp=sharing |
| 2009 | https://drive.google.com/drive/folders/1mbufLMSYQW08i5hO5COK7JE65016hViC?usp=drive_link |
| 2013 | https://drive.google.com/drive/folders/1H4zGYKDeJMuz2bpY0_y6NRjTupLCCj1w?usp=sharing |
| 2017 | https://drive.google.com/drive/folders/1N7G51bBeThHBW1xKN-T29xWLdCL4FrV3?usp=sharing |
| 2021 | https://drive.google.com/drive/folders/1xFbUPPUrgzBARrgSqcuSIQQBPuW-vpwo?usp=drive_link |

---

## 5. Sitio público de la CNE — remitir directamente

Fuente: `CNE_sintesis_informacion_publica.xlsx` (relevamiento 04/09/2026).
Para estos temas, **preferir remitir directamente al sitio público** (como
en el ejemplo de Silvina Correa, sección 3.5) en vez de armar un archivo
propio, salvo que el pedido sea específicamente por datos desagregados o
en un formato que el sitio no ofrece.

| Categoría | Subcategoría | Qué se puede consultar ahí | Link |
|---|---|---|---|
| Información General | Elecciones | Cronograma electoral 2025, convocatoria, cargos, electores por distrito | https://www.electoral.gob.ar/nuevo/paginas/btn/elecc2025.php |
| Participación y Ausentismo Electoral | Participación | Participación y ausentismo 2025 | https://www.electoral.gob.ar/nuevo/paginas/btn/elecc2025.php |
| Resultados Electorales | Nacionales | Escrutinio definitivo 2025, actas, alianzas por distrito | https://www.electoral.gob.ar/nuevo/paginas/btn/elecc2025.php |
| Agrupaciones Políticas | Agrupaciones políticas y alianzas | Partidos vigentes (700 de distrito + 44 nacionales al 31-08-2026, desglose por distrito) | https://www.electoral.gob.ar/nuevo/paginas/datos/partidosdatos.php |
| Agrupaciones Políticas | Afiliados | Mínimos de afiliados exigidos por año, serie histórica 1998-2019 | https://www.electoral.gob.ar/nuevo/paginas/btn/ap.php |
| Agrupaciones Políticas | Financiamiento | Informes de campaña, balances, Registro de Sanciones | https://www.electoral.gob.ar/nuevo/paginas/btn/fp.php |
| Candidaturas | Elecciones nacionales | Candidaturas presidenciales 1983-2023 | https://www.electoral.gob.ar/nuevo/paginas/btn/pe.php |
| Participación y Ausentismo Electoral | Participación | Participación histórica PASO (2015-2023) y Generales (2017-2025), por género/sección | https://www.electoral.gob.ar/nuevo/paginas/btn/pe.php |
| Agrupaciones Políticas | Financiamiento | Financiamiento de campañas 2011-2019 | https://www.electoral.gob.ar/nuevo/paginas/btn/pe.php |
| Candidaturas | Candidatos | Candidaturas por género 2011-2025, precandidaturas, encabezamientos de listas | https://www.electoral.gob.ar/nuevo/paginas/datos/paridaddatos.php |
| Información General | Elecciones provinciales | Convocatorias, cargos y boletines provinciales (2023) | https://www.electoral.gob.ar/nuevo/paginas/cne/elec_prov.php |
| Agrupaciones Políticas | Financiamiento | Registro de aportantes/donantes | https://aportantes.electoral.gob.ar/ |
| Redes Sociales | Auditorías - Control de información | Registro de cuentas oficiales en redes/plataformas digitales | https://www.electoral.gob.ar/nuevo/paginas/cne/redes_sociales.php |
| Reclamos y Denuncias | — | Registro de infractores a la normativa electoral | http://infractores.padron.gov.ar/ |
| Registro de Empresas de Encuestas y Sondeos de Opinión | — | Empresas inscriptas, informes técnicos | https://www.electoral.gob.ar/nuevo/paginas/cne/empresas.php |
| Acompañamiento Cívico | — | Entidades habilitadas para veeduría/acompañamiento cívico | https://old.pjn.gov.ar/cne/acompacivico/publico.php |
| Geografía Electoral | — | Capas y datos geoespaciales electorales | https://mapa2.electoral.gov.ar/descargas/ |
| Agrupaciones Políticas | Afiliados | Consulta pública de afiliación de una persona | https://afiliados.pjn.gov.ar/ |
| Contrataciones CNE | — | Contrataciones, convenios, rendiciones de cuentas | https://www.electoral.gob.ar/nuevo/paginas/btn/transparencia.php |

También, para **resultados y participación por mesa/distrito/elección**
(uso frecuente en los ejemplos de la sección 3): `padron.gob.ar/publica`
— consulta pública de resultados por distrito, elección, mesa, zona o
cargo.

---

## 6. Criterio de prioridad: ¿sitio público, repositorio Drive, o ambos?

1. **Si el pedido pide algo consultable directamente en el sitio público de
   la CNE** (sección 5) y no requiere un archivo desagregado que el sitio
   no ofrezca → remitir SOLO al sitio público (modelo: sección 3.5,
   Correa).
2. **Si el pedido pide datos desagregados, en formato abierto/descargable,
   o de años/series que el sitio público no cubre** → remitir al
   repositorio de Drive correspondiente (sección 4), con los links
   puntuales del año/tema pedido (modelos: secciones 3.1-3.3).
3. **Si el pedido excede lo que se puede entregar** (datos personales
   identificables, domicilios, etc. — es decir, algo que el padrón
   anonimizado NO incluye como variable) → usar el modelo de negativa
   parcial fundamentada (sección 3.4), citando la normativa correspondiente
   — NUNCA inventar una cita legal si no hay una igual de aplicable en este
   archivo. **La edad/franja etaria NO entra en este caso** (ver sección
   3.6): el padrón anonimizado ya incluye fecha de nacimiento, así que se
   entrega sin negativa.
4. Ante la duda entre sitio público y Drive, o si el pedido combina varias
   categorías, se pueden mencionar ambos (como en el ejemplo de Correa,
   que remite a `participacion.php`, `padron.gov.ar/publica` y
   `secretarias.php` a la vez).
5. **Nunca inventar un link ni sobre-entregar recursos.** Reglas completas
   en la sección 1.3 (aplican siempre, no solo para elegir fuente): usar
   placeholder entre corchetes si no hay un recurso exacto, remitir solo
   el recurso puntual del año/dato pedido (nunca la serie completa "por
   las dudas"), y nunca decir "no tenemos" — indicar desde cuándo hay
   disponibilidad (ver ejemplo 3.7).

---

## 7. Cómo mantener este archivo

- Agregar filas a las tablas de las secciones 4 y 5 a medida que aparezcan
  nuevos recursos o cambien links.
- Agregar nuevos ejemplos a la sección 3 cuando surjan tipos de pedido no
  cubiertos todavía (ej. un rechazo total, un pedido de jurisprudencia,
  etc.) — cada ejemplo nuevo debería anotar para qué categoría de pedido
  sirve de modelo, igual que los actuales.
- Si cambia el criterio de cuándo remitir a un sitio vs. al Drive, ajustar
  la sección 6.
- Este archivo no se lee solo — hace falta que el código que llama a
  Gemini lo cargue e inyecte en el prompt (ver "Estado de implementación").

---

## Estado de implementación

**Conectado (04/09/2026).** `app/api/generar-respuesta/route.ts` lee este
archivo completo con `fs.readFileSync` en cada request (mismo patrón que
`mail-bot/classify.py` usa para `contexto_clasificacion.md`) y lo inyecta
en el `PROMPT` como material de referencia. El `PROMPT` exige el formato de
las secciones 1 y 2 (asunto, bloque fijo a Nora, cuerpo) y el criterio de
prioridad de fuentes de la sección 6.

La fecha de ingreso del pedido (necesaria para la línea "pedido de
APELLIDO del DD/MM/AAAA") se manda desde `components/PanelSolicitudes.tsx`
como `fecha` en el body del fetch a `/api/generar-respuesta`.

Este archivo se sigue editando a mano — cualquier cambio en las tablas de
fuentes o en los criterios se refleja en la siguiente respuesta generada
sin tocar código, salvo que cambie la *estructura* del formato (ahí sí hay
que tocar `PROMPT` en el route).
