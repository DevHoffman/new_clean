/* ==========================================================================
   New Clean — hero banner
   Floating soap bubbles that react to the cursor and a gentle parallax/3D
   tilt of the text. Bubbles are drawn on a canvas, paused
   off-screen, fewer on touch devices, none with "reduce motion".
   ========================================================================== */
if (!customElements.get('hero-banner')) {
  class HeroBanner extends HTMLElement {
    connectedCallback() {
      this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.pointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
      this.setupVideo();
      // Visitors in the "lite" A/B variant get no decorative motion
      if (this.reduced || document.documentElement.dataset.fx === 'lite') return;

      this.setupBubbles();
      if (this.pointer) this.setupPointer();
    }

    disconnectedCallback() {
      this.stop();
      if (this.observer) this.observer.disconnect();
      if (this.videoObserver) this.videoObserver.disconnect();
      window.removeEventListener('resize', this.onResize);
    }

    /* Background video: never autoplay for reduced motion or data saver; pause off-screen */
    setupVideo() {
      const videos = Array.from(this.querySelectorAll('.hero__video'));
      if (!videos.length) return;
      const connection = navigator.connection || {};
      const still = this.reduced || connection.saveData === true;
      videos.forEach((video) => {
        if (still) {
          video.removeAttribute('autoplay');
          video.pause();
          return;
        }
        video.muted = true;
        const play = video.play();
        if (play && typeof play.catch === 'function') play.catch(() => {});
      });
      if (still) return;
      this.videoObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          videos.forEach((video) => {
            if (entry.isIntersecting) {
              const play = video.play();
              if (play && typeof play.catch === 'function') play.catch(() => {});
            } else {
              video.pause();
            }
          });
        });
      });
      this.videoObserver.observe(this);
    }

    /* Parallax + tilt */
    setupPointer() {
      this.classList.add('hero--interactive');
      let frame = null;
      this.addEventListener('mousemove', (event) => {
        const rect = this.getBoundingClientRect();
        this.mouse = { x: event.clientX - rect.left, y: event.clientY - rect.top, active: true };
        if (frame) return;
        frame = window.requestAnimationFrame(() => {
          const px = (this.mouse.x / rect.width) * 2 - 1;
          const py = (this.mouse.y / rect.height) * 2 - 1;
          this.style.setProperty('--px', px.toFixed(3));
          this.style.setProperty('--py', py.toFixed(3));
          frame = null;
        });
      });
      this.addEventListener('mouseleave', () => {
        this.mouse = { x: 0, y: 0, active: false };
        this.style.setProperty('--px', '0');
        this.style.setProperty('--py', '0');
      });
    }

    /* Bubbles */
    setupBubbles() {
      this.canvas = document.createElement('canvas');
      this.canvas.className = 'hero__bubbles';
      this.canvas.setAttribute('aria-hidden', 'true');
      this.appendChild(this.canvas);
      this.ctx = this.canvas.getContext('2d');
      this.mouse = { x: 0, y: 0, active: false };
      this.bubbles = [];

      this.onResize = () => this.resize();
      window.addEventListener('resize', this.onResize);
      this.resize();

      this.observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) this.start();
        else this.stop();
      });
      this.observer.observe(this);
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) this.stop();
        else if (this.visible) this.start();
      });
    }

    resize() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      this.width = this.clientWidth;
      this.height = this.clientHeight;
      this.canvas.width = Math.round(this.width * dpr);
      this.canvas.height = Math.round(this.height * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = this.pointer ? Math.round(Math.min(40, this.width / 36)) : 14;
      while (this.bubbles.length < count) this.bubbles.push(this.spawn(true));
      this.bubbles.length = count;
    }

    spawn(anywhere) {
      const r = 4 + Math.random() * 26;
      return {
        x: Math.random() * this.width,
        y: anywhere ? Math.random() * this.height : this.height + r,
        r,
        vy: -(0.15 + Math.random() * 0.35) * (r > 18 ? 0.7 : 1),
        drift: Math.random() * Math.PI * 2,
        driftSpeed: 0.004 + Math.random() * 0.008,
        alpha: 0.18 + Math.random() * 0.3,
        vx: 0,
      };
    }

    start() {
      this.visible = true;
      if (this.running) return;
      this.running = true;
      this.last = performance.now();
      this.frame = window.requestAnimationFrame((now) => this.tick(now));
    }

    stop() {
      this.visible = this.visible && !document.hidden;
      this.running = false;
      window.cancelAnimationFrame(this.frame);
    }

    tick(now) {
      if (!this.running) return;
      const dt = Math.min(48, now - this.last) / 16.67;
      this.last = now;
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.width, this.height);

      this.bubbles.forEach((b, index) => {
        b.drift += b.driftSpeed * dt;
        let ax = Math.sin(b.drift) * 0.04;
        // The cursor pushes bubbles away softly
        if (this.mouse.active) {
          const dx = b.x - this.mouse.x;
          const dy = b.y - this.mouse.y;
          const dist = Math.hypot(dx, dy);
          const reach = 160;
          if (dist < reach && dist > 0.1) {
            const force = ((reach - dist) / reach) * 0.9;
            ax += (dx / dist) * force;
            b.y += (dy / dist) * force * 2 * dt;
          }
        }
        b.vx = (b.vx + ax) * 0.92;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.y + b.r < -10 || b.x < -60 || b.x > this.width + 60) this.bubbles[index] = this.spawn(false);

        const gradient = ctx.createRadialGradient(b.x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.1, b.x, b.y, b.r);
        gradient.addColorStop(0, `rgba(255,255,255,${b.alpha * 0.9})`);
        gradient.addColorStop(0.6, `rgba(255,255,255,${b.alpha * 0.25})`);
        gradient.addColorStop(1, `rgba(255,255,255,${b.alpha * 0.05})`);
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = `rgba(255,255,255,${b.alpha * 0.6})`;
        ctx.stroke();
      });

      this.frame = window.requestAnimationFrame((next) => this.tick(next));
    }
  }

  customElements.define('hero-banner', HeroBanner);
}
