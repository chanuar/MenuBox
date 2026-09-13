**MenuBox — Auditoría de diseño y accesibilidad · 13 de septiembre de 2026**

**Actualización: mejoras implementadas y verificadas**

Se ha aplicado el rediseño «La mesa del equipo»: marca compartida de caja/ticket, favicon propio, imagen social de 1200 × 630, cabecera con acceso explícito al pedido, hero editorial con fotografía separada, carta agrupada por categorías, restaurantes más compactos, resultado de ruleta destacado y recibo con sello. Las descripciones disponibles se conservan; el texto importado de relleno y los enlaces sin destino se sustituyen por estados claros. No se han inventado especialidades ni modificado fotografías o registros del catálogo.

Corregidos el modelo de tamaños, contraste del botón 404 y del foco, bordes de campos, objetivos táctiles, recortes del hero, desbordamientos con textos largos y giro de la ruleta, y el salto visual de carga. La carga inicial tiene una pantalla accesible con los metadatos de cada ruta y conserva la secuencia de teclado. La cabecera se adapta también al texto ampliado. El modal elimina su zona de imagen cuando no existe fotografía o falla la carga. Horarios, estados vacíos y errores muestran acciones e indicadores claros.

El resumen permite cambiar cantidades y tiene acceso fijo en móvil. Los borradores permanecen en memoria al explorar otras rutas de la misma pestaña; al intentar cerrarla con cambios aparece el aviso nativo. Durante el envío se bloquean navegación interna y edición para evitar duplicados y cambios perdidos. Las credenciales en memoria permiten recuperar el pedido si falla el almacenamiento local. Las claves existentes de localStorage permanecen intactas. Las notas se pueden vaciar sin cerrar su desplegable, y guardar, editar, olvidar, abrir/cerrar ciclos y recuperar errores mantienen destinos de foco coherentes.

La revisión previa al commit detectó y corrigió otro caso de foco: si la fotografía falla mientras su diálogo está abierto, al cerrarlo se enfoca el botón de detalles del mismo plato; si el plato ya no existe, se enfoca el contenido principal. La regresión queda cubierta en las pruebas existentes.

Validación final de la implementación:

- ESLint sin advertencias, TypeScript, build y comprobación de formato correctos.
- 76 pruebas Vitest correctas en 12 archivos, incluidas regresiones de borrador, credenciales, envío pendiente, notas, foco, carga inicial y metadatos.
- 33 pruebas de base de datos correctas contra Supabase local; no se ejecutaron pruebas sobre una base remota.
- Navegador Chromium/Edge aislado: pedido, restaurantes, ruleta, login y 404 a 320, 390, 820 y 1440 px; sin desbordamiento horizontal de página.
- Verificados además resumen móvil, envío/confirmación/edición, detalle, fotografía ausente, ganador, errores, vacíos, administración autenticada, horarios abiertos y textos largos. Se corrigió el desbordamiento causado por la caja girada de la ruleta.
- Comprobación automatizada con axe-core, reglas WCAG A/AA 2.0–2.2, sin infracciones detectadas en los escenarios verificados. También se comprobaron texto al 200 % a 390 px y colores forzados en la ruleta.
- Recorrido real de teclado en el navegador: salto al contenido, diálogo nativo, Escape y retorno al activador, acceso al resumen, conservación del borrador al navegar, foco de confirmación y selección de ruleta. Los saltos internos no generan entradas de historial ajenas al router; comprobado también el bloqueo del botón Atrás durante el envío. La preferencia de movimiento reducido evita esperar al giro.

La validación visual utilizó datos de ejemplo y respuestas interceptadas; no creó pedidos reales ni accedió a cuentas administrativas reales. Las fotografías de ejemplo no se incorporaron al producto. No se realizó una sesión manual con lector de pantalla ni una prueba en dispositivos físicos; el resultado automatizado no equivale a una certificación WCAG. Se mantuvieron las rutas, las reglas de indexación y la configuración de 404; no se desplegaron los cambios.

El análisis original se conserva a continuación como registro del estado anterior.

**Dictamen**

MenuBox ya tiene una base estética aprovechable: crema, terracota, verde hierba y titulares con serif. Mi recomendación es desarrollar una identidad de **«la mesa del equipo»**: comida real, una carta fácil de recorrer y un pedido que se presenta como un ticket compartido. La personalidad debería nacer de ese ritual semanal y aparecer en la composición, la fotografía, la marca y los textos.

Antes de rediseñar, corregiría el modelo de tamaños, el contraste de algunos controles y la continuidad del pedido en móvil. Son problemas que pueden hacer que un diseño cuidado se perciba como poco acabado.

**Alcance y límites de la evidencia**

Se revisaron íntegramente los componentes de pedido, detalle de plato, confirmación, restaurantes, horarios, ruleta y administración; la hoja de estilos; la navegación, los estados de error y 404; las pruebas relevantes y los recursos de marca. Se inspeccionó visualmente `public/food-og.png`.

El navegador disponible expuso el árbol de accesibilidad de la ruleta publicada, con 14 restaurantes. La captura recibida correspondía a otra ventana y se descartó como evidencia visual. El control del navegador se detuvo mediante Escape antes de completar la inspección. **No se ha completado una auditoría visual renderizada en móvil y escritorio**, ni una sesión con lector de pantalla. No se han realizado pedidos ni operaciones administrativas.

Las observaciones siguientes distinguen defectos demostrables en el código, riesgos que necesitan una reproducción visual y propuestas de diseño. Se calcularon contrastes a partir de los colores CSS y se comprobó la cascada del botón 404 con JSDOM; esto no sustituye un navegador con motor de layout. Este informe no certifica conformidad WCAG.

**1. Qué conservaría**

- La combinación de fondo cálido, texto oscuro y acentos terracota/verde. Sus parejas principales tienen buen contraste.
- El tono cercano de «¿Dónde comemos hoy?» y «Una decisión menos».
- El resumen lateral del pedido en escritorio, la búsqueda y las categorías de la carta.
- La distinción entre comida con fotografía y bebidas/extras compactos.
- El ticket de confirmación: es la pieza con más posibilidades de convertirse en una firma de marca.
- La ruleta como momento lúdico propio del producto.
- Los controles nativos, el diálogo modal, los horarios desplegables y las bases de accesibilidad existentes.

**2. Qué hace que el diseño pueda sentirse genérico**

| Aspecto                            | Evidencia en la implementación                                                                                     | Cambio recomendado                                                                                                                                             |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Composición repetida               | Muchas superficies usan tarjeta crema, borde beige, radio de 18–28 px y sombra suave.                              | Usar composición editorial en la cabecera, filas limpias para información repetida y reservar el ticket para el resumen.                                       |
| Jerarquía desequilibrada           | El titular de restaurantes llega a 96 px; categorías y ayudas bajan a unos 11 px con raíz de 16 px.                | Subir el texto útil y moderar los titulares según la tarea. La personalidad no depende de hacer el título enorme.                                              |
| Identidad fragmentada              | La marca es una M en un círculo; la imagen social es una caja ilustrada con platos y un ticket sobre fondo oscuro. | Unificar ambas alrededor de una caja/mesa y un ticket, con una versión mínima para el favicon.                                                                 |
| Fotografía sin dirección explícita | Las imágenes importadas se recortan con `object-fit: cover`; el hero coloca el texto sobre un degradado.           | Revisar encuadres reales, seleccionar imágenes representativas y definir proporciones por uso. La calidad concreta del catálogo queda pendiente de inspección. |
| Información intercambiable         | Puede repetirse «Descubre sus platos y consulta la carta completa en Uber Eats».                                   | Escribir una frase útil por restaurante: especialidad y ubicación, verificadas. Evitar descripciones de relleno.                                               |
| Escaso protagonismo del equipo     | El nombre del restaurante domina el inicio; la navegación no tiene «Mi pedido».                                    | Hacer visible la tarea semanal y un acceso explícito al pedido. Reservar la administración para una posición secundaria.                                       |

La fuente `Inter` está declarada, pero no hay carga de archivos de fuente ni `@font-face`. En equipos donde no esté instalada se usa la fuente del sistema. Conviene decidirlo expresamente: conservar la pila del sistema o servir una familia seleccionada. Cambiar únicamente de tipografía no resolverá la composición.

**3. Dirección visual propuesta: la mesa del equipo**

Conservaría crema `#f7f1e7`, tinta `#25251f`, terracota `#b8422c` y verde `#41614b`. El amarillo quedaría para detalles decorativos; el foco usaría un color oscuro con contraste suficiente.

La firma gráfica sería pequeña y repetible: una caja sencilla en la marca, una línea de corte en el ticket y un sello discreto al confirmar. Una sola familia de iconos de trazo coherente. La foto del plato debe aportar el apetito; los recursos gráficos deben aportar la identidad.

Como punto de partida, usaría texto principal de 16 px, información secundaria de 14–15 px, etiquetas de 13–14 px y titulares ajustados a cada pantalla. Son objetivos de diseño, no mínimos normativos. Mantendría una escala breve de radios y reservaría las sombras fuertes para superficies superpuestas.

Los textos podrían seguir este tono:

- Inicio: «Esta semana, [restaurante]».
- Carta: «¿Qué te apetece?».
- Carrito vacío: «Tu hueco en la mesa está listo. Elige algo rico».
- Confirmación: «Apuntado, [nombre]. Así queda tu pedido».
- Sin pedido abierto: «Estamos preparando la próxima mesa», acompañado de «Explorar restaurantes» y «Dejarlo a la suerte».

El lenguaje figurado siempre debe acompañarse de una acción clara. No mostraría valoraciones, popularidad, plazos de cierre ni etiquetas de alérgenos sin datos verificados que las respalden.

**4. Revisión por pantalla**

| Superficie                    | Qué mejoraría                                                                                                                                           | Primera intervención concreta                                                                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cabecera                      | «Administración» ocupa el mismo nivel que las acciones públicas y el pedido solo se alcanza mediante la marca. En móvil los enlaces bajan a 11,52 px.   | Navegación «Mi pedido · Restaurantes · Ruleta», con administración secundaria. Dar espacio suficiente mediante dos filas cuando haga falta.              |
| Inicio con pedido abierto     | El hero consume mucho espacio y agrupa nombre, explicación, fecha, horarios y enlace externo.                                                           | Separar texto y foto; mostrar restaurante, estado semanal y acceso «Elegir platos». Dejar el horario completo en una zona que pueda crecer.              |
| Carta                         | Se repite la categoría en cada tarjeta, el texto es pequeño y siempre se muestran tres posiciones de cantidad aunque el plato aún no esté seleccionado. | Precio y nombre más legibles; botón «Añadir» que se transforme en cantidad. Agrupar visualmente por categoría conservando los filtros actuales.          |
| Carrito de escritorio         | El formulario y las notas compiten con el resumen; para cambiar cantidades hay que volver al plato.                                                     | Resumen con aspecto de ticket, total destacado y edición de cantidades desde el propio resumen. Mostrar las notas opcionales bajo demanda.               |
| Pedido en móvil               | A 820 px o menos, el carrito pasa a estar después de toda la carta.                                                                                     | Barra inferior con unidades, total y enlace «Revisar pedido» al resumen existente. Reservar espacio para ella y evitar que tape controles o foco.        |
| Detalle de plato              | En móvil, la foto precede a toda la información; un plato sin foto recibe un gran bloque con una inicial.                                               | Reducir la foto y prescindir de la zona gráfica cuando no aporta información. Precio y acción visibles pronto. Mantener el diálogo nativo.               |
| Confirmación                  | La estructura de recibo ya funciona, pero su apariencia comparte el mismo tratamiento que el resto de tarjetas.                                         | Convertirla en la pieza distintiva: ticket con buena alineación de importes, sello y estado textual. Dar más peso a «Editar pedido» que a «Olvidar».     |
| Restaurantes                  | Rejilla uniforme de tarjetas grandes, contador de platos por encima del nombre y textos potencialmente repetidos.                                       | Una cabecera breve con acceso a la ruleta; nombre y especialidad primero, horario y cantidad como información secundaria. Reducir la altura obligatoria. |
| Horarios                      | Los `summary` usan `display: flex` y carecen de un indicador explícito de expansión.                                                                    | Añadir un chevrón que cambie al abrir. «Hoy» visible y semana completa bajo demanda, conservando `details/summary`.                                      |
| Ruleta                        | Los sectores muestran números que hay que relacionar con otra lista; los cinco colores se repiten. En móvil la selección queda debajo de la rueda.      | Nombres breves si caben, numeración como apoyo y un resultado con protagonismo. Antes de la rueda, acceso claro a «Cambiar selección».                   |
| Resultado de ruleta           | El ganador se presenta en una franja relativamente discreta.                                                                                            | Darle el nombre, la imagen disponible y una acción inequívoca «Ver carta». Diferenciar «Volver a girar» como acción secundaria.                          |
| Administración                | Comparte la escala de titulares y las tarjetas amplias de las pantallas públicas.                                                                       | Conservar la marca, aumentar densidad útil y alinear cantidades/importes. Separar visualmente «Cerrar pedido» del resto del trabajo.                     |
| Sin pedido / sin restaurantes | Algunos mensajes son un callejón sin salida o hablan de Supabase/importación al usuario final.                                                          | Ofrecer siguiente acción y lenguaje de producto. Reservar el diagnóstico técnico para administración.                                                    |
| Error / 404                   | Son superficies aisladas de la cabecera; la 404 además tiene un fallo de contraste en su botón.                                                         | Recuperar una marca discreta, navegación de vuelta y acción legible. Conservar sus reglas de indexación y respuesta HTTP.                                |
| Carga                         | El indicador se inserta antes de la pantalla y ocupa al menos una altura completa de ventana.                                                           | Indicador breve que mantenga estable la página; conservar el anuncio de carga accesible.                                                                 |

En restaurantes, la combinación actual de imagen de 235 px, cuerpo con `min-height: 280px`, padding vertical de 48 px y bordes produce tarjetas de aproximadamente 565 px como mínimo en escritorio, según el modelo CSS actual. Es una deducción del código, pendiente de medición renderizada. Con 14 opciones, conviene dedicar ese espacio a información que realmente ayude a decidir.

**5. Hallazgos prioritarios de accesibilidad y comportamiento**

P1 = corregir antes del trabajo estético principal. P2 = siguiente iteración. La prioridad indica impacto en el producto, no una clasificación automática de incumplimiento WCAG.

**P1 · Modelo de tamaños inconsistente. Confirmado en CSS.**

En `food.css:73`, `.food-shell` combina `width: min(1440px, 100%)` con padding sin `border-box`. A 390 px de ancho, la regla móvil suma 28 px al ancho del contenido: una caja exterior de 418 px. También hay campos de texto al 100 % con padding y borde añadidos, y el recibo repite el patrón. JSDOM confirma `content-box`; la extensión exacta del desbordamiento por pantalla necesita navegador.

Corregir la regla de tamaño compartida y revisar los tamaños que se definieron contando con el comportamiento anterior. No ocultar el desbordamiento global, porque dejaría controles recortados. Verificación: 320, 390, 820 y 1440 px, sin desplazamiento horizontal de página ni campos fuera de su contenedor. WCAG contempla el reflujo a un ancho equivalente a 320 píxeles CSS. [W3C: Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html).

**P1 · Texto del botón 404 casi sin contraste. Confirmado por cascada y cálculo.**

`body.food-page a { color: inherit }`, en `food.css:39`, tiene más especificidad que el color blanco de `.food-button`. En `NotFound.tsx`, el enlace está dentro de un párrafo de color muted y hereda `#6d6a5f` sobre `#b8422c`: **1,006:1**. La corrección debe cubrir los enlaces con apariencia de botón de forma compartida. El blanco previsto sobre terracota ofrece **5,449:1**. El mínimo AA para texto normal es 4,5:1. [W3C: Contrast Minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).

**P1 · Foco global con contraste insuficiente. Confirmado por colores CSS.**

En `food.css:42`, el foco usa amarillo `#e7b85c`: **1,638:1** sobre crema y **1,771:1** sobre papel. El verde existente ofrece **6,156:1** sobre crema. Corregir el foco compartido y comprobar variantes sobre fotografía y fondos oscuros. Los controles de cantidad y selección de ruleta ya tienen reglas específicas en verde. Para indicadores de foco personalizados, la referencia aplicable de contraste no textual es 3:1 frente al fondo adyacente. [W3C: Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).

**P1 · Hero móvil con riesgo de recortar contenido. Condición demostrable; reproducción visual pendiente.**

En `food.css:1740`, el contenido pasa a posición absoluta, dentro de un hero con `overflow: hidden` y altura mínima de 330 px. Un nombre largo, texto ampliado o la apertura de los siete días del horario pueden superar esa altura sin hacer crecer el contenedor. Mantener el texto en el flujo normal y dimensionar la imagen por separado. Verificar con el nombre más largo del catálogo, horario desplegado y zoom.

**P1 · Transiciones internas sin destino explícito de foco. Confirmado en el código; experiencia con ayudas técnicas pendiente.**

`RouteEnvironment.tsx:53` mueve el foco cuando cambia la ruta. Enviar, editar u olvidar un pedido cambia el contenido dentro de `/`, por lo que ese mecanismo no se ejecuta. Tras guardar, `OrderRoute.tsx:517` solo desplaza la ventana. Cerrar un ciclo también cambia al historial sin enfocar su pestaña o panel.

Enfocar un encabezado o el contenido principal al cambiar de superficie; al editar, elegir un destino coherente. Comprobar que el foco no queda en el documento tras desmontar el botón activado. Esta recomendación sigue el objetivo de mantener una secuencia operable y comprensible. [W3C: Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html).

**P1 · Borrador perdido al navegar. Confirmado por el alcance del estado.**

El carrito, el nombre y las notas viven en el estado local de `FoodApp`. Al salir a restaurantes o ruleta se desmontan; `storage.ts` guarda credenciales del pedido enviado, no el borrador. Añadir un plato, visitar otra sección y volver puede dejar la selección vacía. Decidir una protección mínima: conservar el borrador durante la sesión o advertir antes de abandonarlo. Mantener intactas las claves existentes y evitar presentar como guardado algo que aún no se envió.

**P2 · Límites de campos difíciles de distinguir. Confirmado por colores; evaluación contextual pendiente.**

El borde `#dfd5c6` sobre papel da **1,397:1**. Cuando el borde/fondo es la única señal del área editable, esa señal necesita contraste suficiente. No todos los bordes decorativos necesitan 3:1: revisar específicamente campos vacíos, notas y horarios. Oscurecer sus bordes conservando separadores suaves en las tarjetas. [W3C: Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).

**P2 · Tipografía y áreas táctiles pequeñas. Confirmado en CSS; comodidad pendiente de prueba.**

Con raíz de 16 px, categorías de platos: 10,72 px; ayuda: 10,88 px; descripción: 12,48 px. Subir primero la información necesaria para decidir y completar el pedido. Los botones de cantidad miden 32 × 32 px: ampliarlos a 44 × 44 sería una mejora de comodidad, pero **32 × 32 no incumple por sí solo** el mínimo AA de 24 × 24. Los enlaces pequeños necesitan evaluar también separación y excepciones. [W3C: Target Size Minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).

**P2 · Contexto accesible de acciones repetidas. Confirmado en el marcado.**

Todos los botones de detalles se llaman «Ver detalles» y las notas repiten «Nota para este plato». Incluir el nombre del plato en el nombre accesible facilitaría usar listas de controles. Los botones de añadir/quitar ya lo hacen correctamente.

La foto clicable usa un `div` oculto al árbol accesible, pero existe un botón equivalente de detalles: no lo considero un bloqueo de teclado por sí solo. Sí hay una asimetría de restauración: al abrir desde la foto no se guarda un elemento de retorno en `detailOpenerRef`. Unificar el retorno en el botón de detalles del mismo plato y verificar ambas entradas.

**P2 · Movimiento reducido incompleto. Confirmado en el código.**

La ruleta respeta la preferencia y muestra el resultado inmediatamente; esto está cubierto por pruebas. Sin embargo, el guardado usa `window.scrollTo({ behavior: 'smooth' })` sin comprobarla. La regla CSS de movimiento reducido no anula ese argumento explícito. Usar desplazamiento instantáneo cuando corresponda. Es una mejora relacionada con el criterio de animación por interacción, de nivel AAA; no se presenta aquí como fallo AA. [W3C: Animation from Interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html).

**P2 · Estados que necesitan más claridad. Confirmado en el marcado o condicionado a los datos.**

- Si falta `sourceUrl`, restaurantes sigue mostrando «Ver en Uber Eats» sin `href`. Mostrar un estado honesto en vez de una acción aparente.
- La búsqueda sin resultados propone cambiar de filtro pero no ofrece «Limpiar filtros».
- «Reintentar» en administración revalida las lecturas; no repite necesariamente la operación que falló. Precisar el texto según el caso.
- Login marca correo y contraseña como inválidos ante cualquier error, incluidos posibles errores de conexión. Separar fallo de acceso y fallo del servicio.
- Los mensajes de carga deben conservarse accesibles al reducir su tamaño visual. Los resultados de búsqueda y la ruleta ya disponen de regiones de estado. [W3C: Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html).

**6. Bases de accesibilidad que ya están bien**

Hay idioma español, títulos de página, `main` enfocable, enlace de salto en las pantallas con cabecera y navegación con estado activo. El formulario del pedido tiene etiquetas, autocompletado, errores asociados y enfoque del campo inválido. El detalle usa `dialog.showModal()`, cierre con Escape y retorno probado al botón que lo abrió. La administración implementa flechas, Inicio y Fin en las pestañas. La ruleta conserva radios y casillas nativos, nombre textual del ganador, anuncio de estado y movimiento reducido. Hay soporte parcial para colores forzados.

Los `alt=""` de fotografías junto al nombre del restaurante o plato no son automáticamente un defecto: evitan redundancia cuando la imagen solo acompaña información ya expresada. Solo añadiría descripción alternativa si la imagen aporta información necesaria adicional.

**7. Orden de ejecución recomendado**

| Orden | Trabajo                                                               | Resultado verificable                                                   | Esfuerzo relativo |
| ----- | --------------------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------- |
| 1     | Tamaños, botón 404, foco y hero móvil                                 | Página sin desbordamiento; controles legibles; horario completo visible | Bajo–medio        |
| 2     | Acceso al resumen móvil, protección del borrador y foco entre estados | Elegir, revisar, explorar y editar sin perderse ni perder la selección  | Medio             |
| 3     | Cabecera, escala tipográfica y fotografía del inicio                  | La primera pantalla comunica comida, equipo y siguiente acción          | Medio             |
| 4     | Tarjetas de restaurantes/platos y ticket de confirmación              | Menos repetición; mejor lectura y una pieza de marca reconocible        | Medio             |
| 5     | Ganador de ruleta, vacíos, errores, favicon e imagen social           | Personalidad coherente en todo el recorrido                             | Bajo–medio        |

No hace falta una biblioteca de componentes nueva ni un sistema de temas para estas mejoras. Los componentes actuales, CSS y controles nativos cubren la primera iteración. Pospondría animaciones decorativas y funciones nuevas hasta validar el pedido móvil.

**8. Validación pendiente para cerrar la auditoría visual**

Probar 320/390 px, un ancho intermedio de 820 px y escritorio de 1440 px; añadir zoom de 200 % y reflujo equivalente a 320 px. Recorrer pedido vacío y largo, carta con nombres extensos, imágenes fallidas, horarios abiertos, búsqueda sin resultados, detalle con descripción extensa, confirmación y edición. En administración: login fallido, cero pedidos, muchos pedidos y cierre de ciclo. En ruleta: todas, una y ninguna opción, ambos modos, ganador y movimiento reducido.

Usar solo teclado para recorrer cabecera, salto al contenido, filtros, diálogo, cantidades y pestañas. Validar foco visible, retorno al cerrar, lectura del cambio de superficie y anuncios con un lector de pantalla. Comprobar contraste sobre las fotografías reales y en colores forzados. Si se añade barra inferior, verificar foco no oculto, teclado virtual y zona segura del dispositivo.

**9. Comprobaciones realizadas**

- `npm run lint`: correcto, cero advertencias.
- `npm run format:check`: correcto antes del informe; el informe se formatea y se vuelve a comprobar al terminar.
- `npm run typecheck`: correcto.
- `npm test`: 50 pruebas correctas en 11 archivos.
- `npm run build`: correcto.
- `npm run db:test`: intentado con Docker disponible; no pudo conectar con la instancia local de Supabase en `127.0.0.1:54322`. No se utilizó una base remota.
- Cálculo de nueve parejas de contraste y comprobación de cascada CSS con JSDOM. No se ejecutó un análisis automatizado de accesibilidad en navegador.

Solo se ha añadido este informe; no se han cambiado componentes, estilos, contratos de Supabase ni claves de almacenamiento. Las pruebas funcionales correctas no descartan los defectos visuales descritos: el entorno JSDOM no reproduce layout ni lectura asistida real.
