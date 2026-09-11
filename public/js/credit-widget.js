// Turingcoin flotante: aparece 10s en el mismo lugar (centro-izquierda) y lleva
// a la sección de créditos. Extraído de index.html, IIFE autocontenida.
(function () {
    var fx = document.getElementById('turingcoin-fx');
    if (!fx) return;
    var target = document.getElementById('creditos');
    var apagado = false, tVisible, tCiclo;
    var VISIBLE_MS = 10000;  // se muestra 10 s
    var OCULTO_MS = 7000;    // oculta 7 s y vuelve (siempre en el mismo lugar, definido en el CSS)

    function aparecer() {
        if (apagado) return;
        fx.hidden = false;
        void fx.offsetWidth;                    // reflow para reactivar la transición
        fx.classList.add('tc-show');
        tVisible = setTimeout(function () {
            fx.classList.remove('tc-show');
            tCiclo = setTimeout(aparecer, OCULTO_MS);
        }, VISIBLE_MS);
    }

    function irACreditos() {
        fx.classList.remove('tc-show');
        apagado = true; clearTimeout(tVisible); clearTimeout(tCiclo);
        if (target) {
            try { target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
            catch (x) { target.scrollIntoView(); }
            // red de seguridad: si el scroll suave no llegó, salto instantáneo nativo
            setTimeout(function () {
                var t = target.getBoundingClientRect().top;
                if (t > 140 || t < -120) target.scrollIntoView({ block: 'start' });
            }, 1100);
            target.classList.add('tc-highlight');
            setTimeout(function () { target.classList.remove('tc-highlight'); }, 2600);
        }
        setTimeout(function () { apagado = false; aparecer(); }, 60000);
    }

    fx.addEventListener('click', function (e) {
        if (e.target.classList.contains('tc-close')) return;
        irACreditos();
    });
    fx.querySelector('.tc-close').addEventListener('click', function (e) {
        e.stopPropagation();
        fx.classList.remove('tc-show');
        apagado = true; clearTimeout(tVisible); clearTimeout(tCiclo);
        try { sessionStorage.setItem('tc_off', '1'); } catch (x) {}
    });
    fx.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); irACreditos(); }
    });

    var off = false;
    try { off = sessionStorage.getItem('tc_off') === '1'; } catch (x) {}
    if (!off) setTimeout(aparecer, 600);   // apenas carga la página
})();
