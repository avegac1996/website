// Puente mínimo: expone el objeto API global (definido por /js/app.js, un
// script clásico compartido con login.html/register.html/verify-email.html)
// como export real de ES module, para que los módulos de app.html puedan
// hacer `import { API } from '../api-bridge.js'`.
//
// Por qué hace falta: `const API = {...}` en un script clásico vive en el
// "script scope" compartido entre scripts clásicos, pero NO se refleja como
// propiedad de `window` — así que un <script type="module"> no puede verlo
// como identificador bare. app.js expone `window.API = API;` al final
// (cambio aditivo, no rompe nada de lo que ya depende del API "clásico").
export const API = window.API;
