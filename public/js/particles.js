// --- CONFIGURACIÓN Y EJECUCIÓN DEL CANVAS DE PARTÍCULAS INTERACTIVO (Tonos Naranjas y Azulados) ---
// Extraído de index.html. Se carga antes que landing-ui.js: expone resizeCanvas/
// animateCanvas como globales de script clásico (sin módulos), igual que antes.
const canvas = document.getElementById('bg-canvas');
const ctx = canvas.getContext('2d');

let particles = [];
let mouse = { x: null, y: null, radius: 150 };

// Ajustar tamaño del canvas al contenedor
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    initParticles();
}

class Particle {
    constructor(x, y, vx, vy, size) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.size = size;
        this.baseSize = size;
        this.isOrange = Math.random() > 0.4;
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        // Alternar entre naranja y azul corporativo
        if (this.isOrange) {
            ctx.fillStyle = 'rgba(255, 107, 0, 0.5)';
            ctx.shadowColor = 'rgba(255, 107, 0, 0.6)';
        } else {
            ctx.fillStyle = 'rgba(59, 130, 246, 0.35)';
            ctx.shadowColor = 'rgba(59, 130, 246, 0.4)';
        }
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    update() {
        // Movimiento básico
        this.x += this.vx;
        this.y += this.vy;

        // Rebote contra bordes
        if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
        if (this.y < 0 || this.y > canvas.height) this.vy *= -1;

        // Interacción con cursor (Efecto repulsión suave)
        if (mouse.x !== null && mouse.y !== null) {
            let dx = this.x - mouse.x;
            let dy = this.y - mouse.y;
            let distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < mouse.radius) {
                const force = (mouse.radius - distance) / mouse.radius;
                const angle = Math.atan2(dy, dx);

                this.x += Math.cos(angle) * force * 3;
                this.y += Math.sin(angle) * force * 3;
                this.size = this.baseSize * (1 + force * 1.5);
            } else {
                if (this.size > this.baseSize) this.size -= 0.1;
            }
        }
    }
}

function initParticles() {
    particles = [];
    // Densidad de partículas adaptada al tamaño de la pantalla
    const totalParticles = window.innerWidth < 768 ? 40 : 100;

    for (let i = 0; i < totalParticles; i++) {
        const size = Math.random() * 2 + 1;
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const vx = (Math.random() - 0.5) * 0.4;
        const vy = (Math.random() - 0.5) * 0.4;
        particles.push(new Particle(x, y, vx, vy, size));
    }
}

function connectParticles() {
    const maxDistance = window.innerWidth < 768 ? 90 : 120;
    for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
            const dx = particles[i].x - particles[j].x;
            const dy = particles[i].y - particles[j].y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < maxDistance) {
                const alpha = (1 - distance / maxDistance) * 0.2;
                // Líneas alternando naranja y azul según el color de la partícula
                ctx.strokeStyle = particles[i].isOrange
                    ? `rgba(255, 107, 0, ${alpha * 0.7})`
                    : `rgba(59, 130, 246, ${alpha * 0.5})`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(particles[i].x, particles[i].y);
                ctx.lineTo(particles[j].x, particles[j].y);
                ctx.stroke();
            }
        }
    }
}

function animateCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    particles.forEach(p => {
        p.update();
        p.draw();
    });

    connectParticles();
    requestAnimationFrame(animateCanvas);
}

// Eventos del Mouse para el Canvas
window.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
});

window.addEventListener('mouseleave', () => {
    mouse.x = null;
    mouse.y = null;
});

// Eventos Touch para soporte móvil
window.addEventListener('touchmove', (e) => {
    if (e.touches.length > 0) {
        const rect = canvas.getBoundingClientRect();
        mouse.x = e.touches[0].clientX - rect.left;
        mouse.y = e.touches[0].clientY - rect.top;
    }
});

window.addEventListener('touchend', () => {
    mouse.x = null;
    mouse.y = null;
});
