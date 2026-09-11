// UI de la landing: typewriter, menú móvil, scroll-spy, modales de
// diagnóstico/éxito, envío de formulario, FAQ y marquee. Extraído de index.html.
// Depende de resizeCanvas/animateCanvas definidos en particles.js (se carga antes).

// --- CONFIGURACIÓN DEL EFECTO MECANOGRAFIADO (TYPEWRITER EFFECT) ---
const typewriterEl = document.getElementById('dynamic-typewriter');
const words = [
    "Automatizaciones con Inteligencia Artificial",
    "Sistemas y Portales Web a la Medida",
    "Conciliación Bancaria y Procesos RPA",
    "Tableros de Negocio y Control Financiero",
    "Integraciones con ERPs y Facturación SRI"
];

let wordIndex = 0;
let charIndex = 0;
let isDeleting = false;
let typingSpeed = 100;

function handleTypewriter() {
    const currentWord = words[wordIndex];

    if (isDeleting) {
        // Borrar letra por letra
        typewriterEl.textContent = currentWord.substring(0, charIndex - 1);
        charIndex--;
        typingSpeed = 40; // Velocidad de borrado rápida
    } else {
        // Escribir letra por letra
        typewriterEl.textContent = currentWord.substring(0, charIndex + 1);
        charIndex++;
        typingSpeed = 100; // Velocidad de escritura normal
    }

    // Cambios de estado
    if (!isDeleting && charIndex === currentWord.length) {
        // Espera en la palabra completa antes de borrar
        typingSpeed = 2000;
        isDeleting = true;
    } else if (isDeleting && charIndex === 0) {
        isDeleting = false;
        wordIndex = (wordIndex + 1) % words.length;
        typingSpeed = 500; // Pausa antes de la nueva palabra
    }

    setTimeout(handleTypewriter, typingSpeed);
}

// --- LÓGICA DE COMPORTAMIENTO GENERAL ---

// Menú Móvil
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const mobileMenu = document.getElementById('mobile-menu');

if (mobileMenuBtn && mobileMenu) {
    mobileMenuBtn.addEventListener('click', () => {
        mobileMenu.classList.toggle('hidden');
    });
}

function toggleMobileMenu() {
    if (mobileMenu) mobileMenu.classList.add('hidden');
}

// Scroll-spy: resalta en el navbar el link de la sección visible
const navLinks = document.querySelectorAll('.nav-link');
const observedSections = Array.from(new Set(
    Array.from(navLinks).map(link => link.dataset.section)
)).map(id => document.getElementById(id)).filter(Boolean);

function setActiveNavLink(sectionId) {
    navLinks.forEach(link => {
        const isActive = link.dataset.section === sectionId;
        link.classList.toggle('text-accentOrange', isActive);
        link.classList.toggle('text-gray-300', !isActive);
    });
}

if (observedSections.length) {
    const headerOffset = document.querySelector('header')?.offsetHeight || 80;

    const sectionObserver = new IntersectionObserver((entries) => {
        // Elige la sección visible más cercana a la parte superior del viewport
        const visible = entries
            .filter(entry => entry.isIntersecting)
            .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (visible.length) {
            setActiveNavLink(visible[0].target.id);
        }
    }, {
        root: null,
        rootMargin: `-${headerOffset}px 0px -60% 0px`,
        threshold: 0
    });

    observedSections.forEach(section => sectionObserver.observe(section));

    // Estado inicial correcto al cargar la página (ej. recarga con scroll ya hecho)
    const initialSection = observedSections
        .slice()
        .reverse()
        .find(section => section.getBoundingClientRect().top - headerOffset <= 0);
    setActiveNavLink((initialSection || observedSections[0]).id);
}

// Modal de Diagnóstico
const bookingModal = document.getElementById('booking-modal');

function openBookingModal() {
    bookingModal.classList.remove('hidden');
    bookingModal.classList.add('flex');
    document.body.style.overflow = 'hidden';
}

function closeBookingModal() {
    bookingModal.classList.add('hidden');
    bookingModal.classList.remove('flex');
    document.body.style.overflow = '';
}

// Lanzar una cotización predefinida de servicios desde la tarjeta
function requestServiceQuote(serviceName) {
    document.getElementById('form-service').value = serviceName;
    openBookingModal();
}

// Manejo del envío del formulario (Sin alerts tradicionales)
function handleFormSubmission(event) {
    event.preventDefault();
    const name = document.getElementById('form-name').value;
    const service = document.getElementById('form-service').value;

    closeBookingModal();

    // Construye mensaje personalizado para el modal de éxito
    const successMsg = document.getElementById('success-modal-msg');
    successMsg.innerHTML = `Estimado(a) <strong>${name}</strong>, hemos registrado tu solicitud para el servicio de <strong>${service}</strong>. Un especialista técnico local de Turing Tech se comunicará contigo mediante WhatsApp en menos de 2 horas.`;

    document.getElementById('success-modal').classList.remove('hidden');
    document.getElementById('success-modal').classList.add('flex');
    document.getElementById('diagnostic-form').reset();
}

function closeSuccessModal() {
    document.getElementById('success-modal').classList.add('hidden');
    document.getElementById('success-modal').classList.remove('flex');
}

function toggleWhatsappChat() {
    // Abre una conversación directa a WhatsApp de Turing Tech
    window.open('https://api.whatsapp.com/send/?phone=593990686162&text=Hola+TURINGTECH%2C+me+interesa+conocer+m%C3%A1s+sobre+sus+servicios+de+automatizaci%C3%B3n+empresarial+y+transformaci%C3%B3n+digital&type=phone_number&app_absent=0', '_blank');
}

// FAQ Accordion functionality
function toggleFAQ(button) {
    const faqItem = button.closest('.faq-item');
    const allFaqItems = document.querySelectorAll('.faq-item');
    const isCurrentlyActive = faqItem.classList.contains('active');

    allFaqItems.forEach(item => {
        item.classList.remove('active');
    });

    if (!isCurrentlyActive) {
        faqItem.classList.add('active');
    }
}

// --- CARRUSEL HORIZONTAL MARQUEE ---
const marqueeContainer = document.getElementById('marquee-container');
const marqueeTrack = document.getElementById('marquee-track');

if (marqueeContainer && marqueeTrack) {
    marqueeContainer.addEventListener('mouseenter', function() {
        marqueeTrack.classList.add('paused');
    });
    marqueeContainer.addEventListener('mouseleave', function() {
        marqueeTrack.classList.remove('paused');
    });
}

// --- INICIALIZACIÓN ---
window.onload = function() {
    resizeCanvas();
    animateCanvas();
    handleTypewriter();
}

window.addEventListener('resize', resizeCanvas);
