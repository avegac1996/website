/* TURINGTECH - Header público compartido (mismo menú en todas las páginas).
   Uso: colocar <div id="site-header"></div> donde va el header y cargar este script. */
(function () {
  var WA = 'https://wa.me/593990686162?text=' +
    encodeURIComponent('Hola TURINGTECH, me interesa solicitar un diagnóstico técnico gratuito');

  var loggedIn = false;
  try { loggedIn = !!(window.API && typeof API.isLoggedIn === 'function' && API.isLoggedIn()); } catch (e) {}

  var path = location.pathname.replace(/\/index\.html$/, '/');
  var onHome = path === '/' || path === '';

  var links = [
    { label: 'Inicio',          href: '/',          active: onHome },
    { label: 'Servicios',       href: '/#servicios' },
    { label: 'Método Turing',   href: '/#metodo' },
    { label: 'Casos de Éxito',  href: '/#casos' }
  ];

  var accountHref = loggedIn ? '/app.html' : '/login.html';
  var accountLabel = loggedIn ? 'Mi espacio' : 'Iniciar Sesión';
  var accountIcon = loggedIn ? 'fa-circle-user' : 'fa-right-to-bracket';

  function navLinks(mobile) {
    return links.map(function (l) {
      var base = mobile ? 'block ' : '';
      var cls = l.active
        ? base + 'text-accentOrange font-medium transition-colors'
        : base + 'text-gray-300 hover:text-accentOrange transition-colors';
      var attr = mobile ? ' data-close' : '';
      return '<a href="' + l.href + '" class="' + cls + '"' + attr + '>' + l.label + '</a>';
    }).join('');
  }

  // Estilo "glass" en línea: en las páginas de login .glass-panel trae padding/again-radius de app.css
  var GLASS = 'background:rgba(10,19,40,0.82);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);';

  var html =
  '<header class="sticky top-0 z-50 border-b border-white/5" style="' + GLASS + '">' +
    '<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">' +
      '<a href="/" class="flex items-center space-x-3 cursor-pointer">' +
        '<img src="/logo-turingtech-mark.svg" alt="TuringTech" class="w-10 h-10 object-contain" style="filter: drop-shadow(0 0 10px rgba(255,107,0,0.35));">' +
        '<div>' +
          '<span class="text-white font-extrabold text-xl tracking-wide">TURING<span class="text-accentOrange">TECH</span></span>' +
          '<span class="text-gray-400 text-[10px] block -mt-0.5 tracking-wide">Tu visión. <span class="text-accentOrange">Nuestro código.</span></span>' +
        '</div>' +
      '</a>' +
      '<nav class="hidden md:flex items-center space-x-8 text-sm font-medium">' + navLinks(false) + '</nav>' +
      '<div class="hidden md:flex items-center space-x-4">' +
        '<a href="' + accountHref + '" class="text-gray-300 hover:text-accentOrange transition-colors text-sm font-medium flex items-center space-x-2">' +
          '<i class="fa-solid ' + accountIcon + ' text-xs"></i><span>' + accountLabel + '</span>' +
        '</a>' +
        '<a href="' + WA + '" target="_blank" rel="noopener" class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-accentOrange to-orange-600 hover:from-orange-500 hover:to-orange-700 text-white font-semibold text-sm transition-all shadow-md hover:shadow-neon-orange duration-300 flex items-center space-x-2">' +
          '<i class="fa-solid fa-calendar-check text-xs"></i><span>Diagnóstico Técnico Gratuito</span>' +
        '</a>' +
      '</div>' +
      '<div class="md:hidden">' +
        '<button id="sh-mobile-btn" aria-label="Menú" class="p-2 text-gray-400 hover:text-white focus:outline-none"><i class="fa-solid fa-bars text-2xl"></i></button>' +
      '</div>' +
    '</div>' +
    '<div id="sh-mobile-menu" class="hidden md:hidden border-t border-white/5 py-4 px-6 space-y-4" style="' + GLASS + '">' +
      navLinks(true) +
      '<a href="' + accountHref + '" data-close class="block text-gray-300 hover:text-white flex items-center space-x-2">' +
        '<i class="fa-solid ' + accountIcon + '"></i><span>' + accountLabel + '</span>' +
      '</a>' +
      '<a href="' + WA + '" target="_blank" rel="noopener" class="block w-full py-3 rounded-xl bg-gradient-to-r from-accentOrange to-orange-600 text-white font-semibold text-sm flex items-center justify-center space-x-2">' +
        '<i class="fa-solid fa-calendar-check"></i><span>Diagnóstico Técnico</span>' +
      '</a>' +
    '</div>' +
  '</header>';

  var mount = document.getElementById('site-header');
  if (mount) { mount.outerHTML = html; }
  else if (document.currentScript) { document.currentScript.insertAdjacentHTML('beforebegin', html); }

  var btn = document.getElementById('sh-mobile-btn');
  var menu = document.getElementById('sh-mobile-menu');
  if (btn && menu) {
    btn.addEventListener('click', function () { menu.classList.toggle('hidden'); });
    menu.querySelectorAll('[data-close]').forEach(function (a) {
      a.addEventListener('click', function () { menu.classList.add('hidden'); });
    });
  }
})();
