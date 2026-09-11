# 🎨 Plan de mejoras UX/Diseño — CRM interno (TURINGTECH)

> Documento de tracking. Generado el 10-sep-2026 a partir de una revisión de código de `public/app.html` (SPA del CRM, ~3557 líneas) y `public/css/app.css` (~2418 líneas). No se ejecutó ningún cambio de código en esta sesión — solo se documenta el diagnóstico y el plan.
>
> **Cómo usarlo**: en cada sesión futura, elegí un ítem (o un grupo dentro de una fase), marcalo con `[x]` al terminarlo, y agregá una nota corta debajo si hiciste algo distinto a lo descrito. Las fases están ordenadas por prioridad recomendada, pero no son estrictamente secuenciales — se puede tomar cualquier ítem suelto.

## Resumen ejecutivo

El CRM funciona pero acumuló deuda de UX por crecer "por acreción": cada feature (Kanban, Sprints, Prospectos, Timbrado) trajo su propio micro-sistema de componentes en vez de reutilizar uno común. Los puntos más graves:

- **5 sistemas distintos de "badge/chip de estado"** (`.badge`, `.spr-badge`, `.est-*`, `.pipe-badge`, `.status-pill`, `.kb-estado`) para el mismo concepto, con paletas de color propias cada uno.
- **Cero accesibilidad básica**: sin `<label for>`, sin `tabindex` en elementos interactivos custom (cards del kanban, filas de tabla), casi sin `aria-*` ni estados de foco visibles.
- **El sistema de modal existe en CSS pero no se usa en ningún lado** — todas las ediciones son reemplazo de página completa (`#view`), y las confirmaciones destructivas usan `confirm()` nativo del navegador (12 usos).
- **Formularios duplicados letra por letra** entre alta y edición de prospecto.
- Diseño **desktop-first** sin soporte táctil para el drag&drop del Kanban.

## Fase 1 — Fundaciones del sistema de diseño (tokens)

- [ ] **Consolidar colores hardcodeados a variables `:root`.** Ya existen tokens (`--color-success/warning/error/info`, `--color-white`, etc. en `public/css/app.css:6-24`) pero se ignoran constantemente:
  - `#10b981` hardcodeado en `app.css:1646,1652,1782` (duplica `--color-success`).
  - `#3b82f6` en `app.css:1779,1870,1871,1904` (duplica `--color-info`).
  - `#f59e0b` en `app.css:1781` (duplica `--color-warning`).
  - `#ef4444` en `app.css:1783` (duplica `--color-error`).
  - `#fff` hardcodeado 46 veces en CSS (ej. `app.css:1001,1022,1068,1083,1120`) en vez de `var(--color-white)`.
  - `color:#fff` inline en `app.html` al menos 18 veces (líneas 475, 556, 630, 917, 1700, 1833, 1867, 1986, 1988, 2182, 2201, 2214, 3147, 3181, 3215, 3312, 3321, 3423).

- [ ] **Definir escala de spacing (4/8px) y migrar valores arbitrarios.** Hoy prácticamente todos los enteros entre 1-14px aparecen como padding suelto. Ejemplos a corregir primero: `padding: 9px 12px 9px 34px` (`app.css:1020`), `padding: 1px 7px` (`app.css:1085`), `padding: 11px 13px` (`app.css:1571`), `padding: 7px 4px` (`app.css:1729`), `padding: 2px 7px` (`app.css:1705,2416`). Documentar/tokenizar el valor mágico `margin-left: 264px` (`app.css:1091`, coincide con el ancho del sidebar en `app.css:962` pero no está vinculado por variable).

- [ ] **Definir jerarquía tipográfica global (`h1`-`h6`) y escala de `font-size`.** Hoy no hay reglas globales de heading — cada módulo define su propio tamaño (`.card-header h3` en `app.css:254`, `.modal-header h3` en `app.css:675`, `.auth-logo h1` en `app.css:836`, etc.), y hay 21 valores de `font-size` distintos sin escala, incluyendo el outlier `font-size: 12.5px` en `.seg-toggle` (`app.css:1696`). También hay 21 usos de `font-size:13px` inline en `app.html` que no coinciden con ninguna clase de la escala existente (`.text-sm`=14px, `.text-xs`=12px en `app.css:782-783`).

- [ ] **Reemplazar la repetición literal de `font-family: 'Barlow', 'Inter', sans-serif`** (12+ selectores: `app.css:190,255,564,676,837,853,997,1221,1275,1295,1421,1440,1501,1512`) por una clase o variable CSS compartida.

- [ ] **Quick wins de limpieza CSS:**
  - `.kb-card` y `.kb-act` están definidos dos veces cada uno, sin relación clara (`app.css:2370` + reapertura suelta en `2414`/`2419`, bajo el comentario "kanban card chips — compactos, no desbordan") — probablemente un parche tardío que no se integró a la definición original. Fusionar.
  - `.btn-secondary:hover` usa `background-color: #1a2e5a` hardcodeado (`app.css:410`) en vez de un token.
  - Border-radius hardcodeado que duplica `--radius-sm/md/lg` (varios `8px`, `4px`, `12px` sueltos); el radio "pill" `999px` se usa 18 veces sin token propio — considerar `--radius-pill`.

## Fase 2 — Unificar componentes duplicados

- [ ] **Unificar los 5 sistemas de badge/estado en uno solo parametrizable:**
  - `.badge` + `.badge-success/warning/error/info/accent/secondary` (`app.css:495-509`) — el más "genérico", candidato a ser la base.
  - `.spr-badge.activo/.planificado/.cerrado` (`app.css:1647-1654`).
  - `.est-todo/.est-prog/.est-review/.est-qa/.est-done/.est-blocked` (`app.css:1778-1783`, vía variable local `--e`).
  - `.pipe-badge` (`app.css:1947-1949`) con color inyectado inline desde JS: `background:' + e.color + '22'` (`app.html:1651`).
  - `.status-pill.pending/.approved/.rejected` (`app.css:2024-2033`).
  - `.kb-estado` (`app.html:2609`, mismo hack `+'22'`).
  - Al unificar, reemplazar el hack de opacidad por concatenación de string (`color + '22'`) por una función helper que valide que `color` sea un hex de 6 dígitos antes de concatenar (hoy rompe silenciosamente si el backend algún día manda `rgb()` o un nombre CSS).

- [ ] **Consolidar las ~11 clases de card independientes** (`.card`, `.glass-card`, `.auth-card`, `.welcome-card`, `.choice-card`, `.pkg-card`, `.tier-card`, `.credential-card`, `.bt-card`, `.file-card`, `.kb-card` — cada una en `app.css` redefine border/border-radius/background/padding por su cuenta) en `.card` + modificadores.

- [ ] **Unificar los 3 sistemas de tabla**: `.table` genérico (`app.css:514-543`), `.tb-table` (pensada para Timbrado pero reusada también en dashboard de prospectos, `app.html:2510`; CSS en `app.css:2204-2214`), y `.pros-table` (`app.css:1944-1945`, extiende `.table` parcialmente). Unificar padding/bordes/hover.

- [ ] **Decidir el destino del sistema de modal.** El CSS (`.modal-overlay/.modal/.modal-header/.modal-body/.modal-footer`, `app.css:639-712`) está completo y bien hecho pero **no se usa en ningún `.html` del proyecto**. Recomendado: implementarlo de verdad para:
  - Ediciones rápidas que hoy hacen swap de página completa (ej. `prosGestionar()`, con botón "Volver al tablero" en `app.html:1980`).
  - Reemplazar los 12 usos de `confirm()` nativo (`app.html:931,1424,1450,2042,2220,2409,2737` y otros) por un diálogo de confirmación custom.
  - Alternativa si no se justifica el esfuerzo: eliminar el CSS muerto.

- [ ] **Eliminar la duplicación de formularios de prospecto.** `collectPros()` (alta, `app.html:1789-1800`, HTML en `1767-1785`) y `prosCamposCollect()` (edición, `app.html:1945-1956`, HTML en `1925-1943`) son ~15 campos copy-pasteados. Extraer a una función/generador de HTML compartido.

- [ ] **Asociar `<label for="">` con su input.** Hoy 0 de 107 `<label>` en `app.html` tienen `for` apuntando al `id` del control (ej. `app.html:1768`: `<label>Sector *</label>` seguido de `<select id="px_sector">` sin vínculo). Rompe accesibilidad y el comportamiento nativo de "click en label enfoca el input".

- [ ] **Validar todos los campos marcados como obligatorios.** Hoy `collectPros()` solo valida "empresa" (`app.html:1812-1822`); hay 29 `form-required-marker` (el asterisco visual) pero solo 23 atributos `required` en los `<input>` — desalineado. Agregar validación real (JS o al menos `required` consistente) para todos los campos marcados.

- [ ] **Crear una función `emptyState(msg)` reutilizable.** Hoy hay 6 mensajes de "vacío" escritos a mano con padding distinto cada uno: `app.html:1140` ("El backlog está vacío..."), `1033` ("No hay actividades..."), `1874` ("Sin prospectos..."), `2488` ("Sin datos."), `2705` ("Sin registros en el rango."), `2765` ("No hay colaboradores.").

- [ ] **Usar el `.spinner` ya definido en CSS (`app.css:937-948`) también en el CRM.** Hoy solo se usa en `login.html`/`register.html`/`verify-email.html`; en `app.html` el único estado de carga es el texto "Cargando..." reemplazando todo `#view` (`app.html:265` y variantes en `618,2033,3170`).

## Fase 2 — Confirmaciones y feedback al usuario

- [ ] **Limpiar `#alert-container` al cambiar de ruta.** El router (`app.html:254-269`) reemplaza `#view` pero nunca vacía `#alert-container` (`app.html:66`) — una alerta de la vista anterior puede seguir visible unos segundos al navegar rápido.
- [ ] **Evaluar scroll-to-top/`scrollIntoView` al disparar `showAlert()`** (`public/js/app.js:148-169`). Si el usuario está scrolleado hacia abajo en un formulario o tabla larga, la confirmación aparece arriba del todo y puede pasar inadvertida.
- [ ] **Resolver colisión de nombre de clase `.alert`.** `.alert`/`.alert-{tipo}` es el toast de `showAlert()`, pero `.kb-card.alert` (`app.css:2374`) es "tarjeta del kanban con actividad vencida" — mismo nombre, significado completamente distinto. Renombrar uno de los dos.

## Fase 3 — Accesibilidad

- [ ] **`aria-live` en el contenedor de alertas** (`#alert-container`, `app.html:66`) para que un lector de pantalla anuncie el contenido dinámico que inyecta `showAlert()`.
- [ ] **Hacer navegables por teclado los elementos interactivos custom**: las cards del kanban (`draggable="true"`, `app.html:2604`) y las filas de tabla clicables (`<tr data-id="...">`, `app.html:1866,1913-1915`) no tienen `tabindex`, `role="button"` ni `keydown` — hoy son inalcanzables/inoperables por teclado (0 usos de `tabindex` en todo el archivo).
- [ ] **Revisar/ampliar `:focus-visible`.** Solo 4 reglas de foco en todo el CSS (`app.css:298,360,1028,1899`); `.gt-estsel:focus` (`app.css:1899`) hace `outline:none` sin un reemplazo visual adecuado — restaurar un indicador de foco visible ahí.
- [ ] Revisar en general contraste de texto sobre los fondos oscuros del tema (`--color-text: #94A3B8` sobre `--color-primary: #050C1F`) con una herramienta de contraste, especialmente en textos pequeños (`font-size` 10-12px).

## Fase 3 — Responsive / mobile

- [ ] **Agregar un breakpoint para mobile pequeño (~480px).** Hoy los breakpoints son `900px` (`app.css:1325,1688,1999`), `1024px` (`app.css:1773,2048`), `768px` (`app.css:2066`) — el de `768px` parece pensado sobre todo para las páginas de auth/landing, no cubre bien las vistas internas del CRM (Kanban, tablas de prospectos, formularios).
- [ ] **Layout alternativo del Kanban en mobile.** El drag&drop es HTML5 nativo (`app.html:2634-2655`) sin fallback táctil — en mobile/tablet las cards no se pueden mover entre columnas. Agregar una alternativa (botones "Mover a columna X" o un `<select>` de estado en cada card) y considerar un layout de lista vertical en vez de scroll horizontal de columnas angostas (`.kb-board`, `app.css:2358-2364`, sin reglas responsive hoy).
- [ ] Revisar los grids de formularios de prospecto (`auto-fit, minmax(190-200px,1fr)`) y las tablas densas (`.pros-table`, `.tb-table`) en viewport angosto — hoy dependen solo de auto-fit sin control explícito por media query.

## Fase 4 — Nice-to-have / decisiones futuras (baja prioridad)

- [ ] Evaluar si se quiere soporte de tema claro. Hoy no existe (`0` coincidencias de `prefers-color-scheme`/`data-theme`/`.dark` en `app.css`) — el CRM es 100% oscuro fijo por diseño. No es necesariamente un problema, solo dejar la decisión explícita.

## Nota: convivencia con Tailwind CDN

`public/app.html` (el CRM) **no carga el CDN de Tailwind** — solo usa `public/css/app.css` propio (`app.html:13`). El CDN de Tailwind solo se usa en páginas públicas de marketing/auth (`index.html`, `login.html`, `register.html`, páginas de servicio, `verify-email.html`). Sin embargo, el markup de `app.html` usa nombres de clase con pinta de utilidades Tailwind (`text-xs` ×62, `text-sm` ×20, `mb-2`, `mt-1/2/3`, etc.) que `app.css` define con **su propia escala, distinta a la real de Tailwind** (ej. `.mt-1 { margin-top: 8px }` en `app.css:787` vs `4px` en Tailwind real). No es una mezcla caótica de dos sistemas cargados a la vez, pero sí un riesgo de confusión para quien edite `app.html` asumiendo semántica Tailwind real. Dejarlo documentado acá evita que alguien "corrija" un valor asumiendo que sigue la escala de Tailwind.
