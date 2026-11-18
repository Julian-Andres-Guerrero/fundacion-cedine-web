document.addEventListener('DOMContentLoaded', () => {
  // 1. Inicializar animaciones AOS (Animate On Scroll)
  if (typeof AOS !== 'undefined') {
    AOS.init({
      duration: 750,
      easing: 'ease-out-cubic',
      once: true,
      offset: 60,
    });
  }

  // 2. Menú Móvil
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');
  const mobileLinks = document.querySelectorAll('.mobile-link');

  if (mobileMenuBtn && mobileMenu) {
    mobileMenuBtn.addEventListener('click', () => {
      mobileMenu.classList.toggle('hidden');
      mobileMenu.classList.toggle('flex');
    });

    mobileLinks.forEach((link) => {
      link.addEventListener('click', () => {
        mobileMenu.classList.add('hidden');
        mobileMenu.classList.remove('flex');
      });
    });
  }

  // 3. Efecto Parallax Multicapa (Optimizado con requestAnimationFrame)
  const parallaxBgs = document.querySelectorAll('.parallax-bg');
  const parallaxLayers = document.querySelectorAll('.parallax-layer');
  let ticking = false;

  function updateParallax() {
    const scrollY = window.pageYOffset;

    parallaxBgs.forEach((bg) => {
      const parent = bg.parentElement;
      const rect = parent.getBoundingClientRect();
      // Solo calcular si la sección está visible en pantalla
      if (rect.bottom >= 0 && rect.top <= window.innerHeight) {
        const speed = parseFloat(bg.dataset.speed) || 0.35;
        const yPos = -(rect.top * speed);
        bg.style.transform = `translate3d(0, ${yPos}px, 0) scale(1.12)`;
      }
    });

    parallaxLayers.forEach((layer) => {
      const speed = parseFloat(layer.dataset.speed) || 0.15;
      const yPos = scrollY * speed;
      layer.style.transform = `translate3d(0, ${yPos}px, 0)`;
    });

    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(updateParallax);
      ticking = true;
    }
  }, { passive: true });

  updateParallax();

  // 4. Contadores Animados con IntersectionObserver
  const counters = document.querySelectorAll('.counter');
  const animateCounter = (counter) => {
    const target = +counter.getAttribute('data-target');
    const duration = 1800; // ms
    const startTime = performance.now();

    const step = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Easing suave al final
      const easeOut = 1 - Math.pow(1 - progress, 3);
      counter.innerText = Math.floor(easeOut * target);

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        counter.innerText = target;
      }
    };

    requestAnimationFrame(step);
  };

  if ('IntersectionObserver' in window) {
    const counterObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.4 });

    counters.forEach((counter) => counterObserver.observe(counter));
  }
});

// 5. Función Global para Copiar NIT / Datos Bancarios con Feedback Visual
function copyText(text, btnElement) {
  navigator.clipboard.writeText(text).then(() => {
    const originalText = btnElement.innerText;
    btnElement.innerText = '¡Copiado!';
    btnElement.classList.remove('bg-cedine-orange');
    btnElement.classList.add('bg-cedine-green', 'text-cedine-blue');

    setTimeout(() => {
      btnElement.innerText = originalText;
      btnElement.classList.add('bg-cedine-orange');
      btnElement.classList.remove('bg-cedine-green', 'text-cedine-blue');
    }, 2000);
  });
}