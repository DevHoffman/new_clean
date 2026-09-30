/* ==========================================================================
   New Clean — product page scripts
   Gallery, zoom, sticky add-to-cart and recently viewed tracking.
   ========================================================================== */

/* Gallery
   ========================================================================== */
class ProductGallery extends HTMLElement {
  connectedCallback() {
    this.slider = this.querySelector('slider-component');
    this.track = this.querySelector('.slider');
    this.thumbs = Array.from(this.querySelectorAll('[data-thumb]'));
    if (!this.track) return;

    this.thumbs.forEach((thumb) => {
      thumb.addEventListener('click', () => this.goToMedia(thumb.dataset.thumb));
    });

    // Highlight the thumbnail of the slide currently in view
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) this.setActive(entry.target.dataset.mediaId);
        });
      },
      { root: this.track, threshold: 0.6 }
    );
    this.track.querySelectorAll('[data-media-id]').forEach((slide) => this.observer.observe(slide));

    this.addEventListener('click', (event) => {
      const trigger = event.target.closest('[data-zoom-src]');
      if (trigger) this.zoom(trigger);
    });
  }

  disconnectedCallback() {
    if (this.observer) this.observer.disconnect();
  }

  goToMedia(id) {
    const slide = this.track.querySelector(`[data-media-id="${id}"]`);
    if (!slide) return;
    if (this.slider && typeof this.slider.scrollToSlide === 'function') {
      this.slider.scrollToSlide(slide);
    } else {
      this.track.scrollTo({ left: slide.offsetLeft - this.track.offsetLeft, behavior: 'smooth' });
    }
    this.setActive(id);
  }

  setActive(id) {
    this.thumbs.forEach((thumb) => {
      const active = thumb.dataset.thumb === String(id);
      thumb.setAttribute('aria-current', active ? 'true' : 'false');
      if (active && thumb.parentElement.scrollHeight > thumb.parentElement.clientHeight) {
        thumb.parentElement.scrollTo({ top: thumb.offsetTop - thumb.parentElement.offsetTop - 80, behavior: 'smooth' });
      }
    });
  }

  zoom(trigger) {
    const modal = document.getElementById('ProductZoom');
    if (!modal || typeof modal.open !== 'function') return;
    const image = modal.querySelector('[data-zoom-image]');
    image.src = trigger.dataset.zoomSrc;
    image.alt = trigger.dataset.zoomAlt || '';
    modal.open(trigger);
  }
}

customElements.define('product-gallery', ProductGallery);

/* Sticky add to cart
   Shown once the main buy buttons leave the viewport, hidden near the footer.
   ========================================================================== */
class StickyAtc extends HTMLElement {
  connectedCallback() {
    this.target = document.querySelector('[data-buy-buttons]');
    if (!this.target) return;

    this.state = { passedTarget: false, footerVisible: false };

    this.targetObserver = new IntersectionObserver((entries) => {
      const entry = entries[0];
      this.state.passedTarget = !entry.isIntersecting && entry.boundingClientRect.top < 0;
      this.update();
    });
    this.targetObserver.observe(this.target);

    const footer = document.querySelector('.footer');
    if (footer) {
      // Only step aside once a good part of the footer is on screen
      this.footerObserver = new IntersectionObserver(
        (entries) => {
          this.state.footerVisible = entries[0].isIntersecting;
          this.update();
        },
        { threshold: 0.3 }
      );
      this.footerObserver.observe(footer);
    }
  }

  disconnectedCallback() {
    if (this.targetObserver) this.targetObserver.disconnect();
    if (this.footerObserver) this.footerObserver.disconnect();
    document.documentElement.style.removeProperty('--sticky-atc-height');
  }

  update() {
    const visible = this.state.passedTarget && !this.state.footerVisible;
    if (visible) {
      this.hidden = false;
      window.requestAnimationFrame(() => {
        this.classList.add('is-visible');
        document.documentElement.style.setProperty('--sticky-atc-height', `${this.offsetHeight}px`);
      });
    } else {
      this.classList.remove('is-visible');
      document.documentElement.style.setProperty('--sticky-atc-height', '0px');
    }
  }
}

customElements.define('sticky-atc', StickyAtc);

/* Volume pricing: highlight the tier that matches the chosen quantity
   ========================================================================== */
class VolumePricing extends HTMLElement {
  connectedCallback() {
    this.input = document.getElementById(this.dataset.quantityInput);
    this.rows = Array.from(this.querySelectorAll('tr[data-min]'));
    if (!this.input || !this.rows.length) return;
    this.onChange = () => this.highlight();
    this.input.addEventListener('change', this.onChange);
    this.input.addEventListener('input', this.onChange);
    this.highlight();
  }

  disconnectedCallback() {
    if (!this.input) return;
    this.input.removeEventListener('change', this.onChange);
    this.input.removeEventListener('input', this.onChange);
  }

  highlight() {
    const quantity = parseInt(this.input.value, 10) || 1;
    let active = null;
    this.rows.forEach((row) => {
      if (quantity >= parseInt(row.dataset.min, 10)) active = row;
    });
    this.rows.forEach((row) => row.classList.toggle('is-active', row === active));
  }
}

customElements.define('volume-pricing', VolumePricing);

/* Recently viewed tracking
   Stores the ids of visited products; rendered by recently-viewed.js.
   ========================================================================== */
(() => {
  const KEY = 'newclean:recently-viewed';
  const LIMIT = 12;
  const product = document.querySelector('product-info[data-product-id][data-product-handle]');
  if (!product) return;

  try {
    const stored = JSON.parse(window.localStorage.getItem(KEY));
    const list = (Array.isArray(stored) ? stored : []).filter((id) => id !== product.dataset.productId);
    list.unshift(product.dataset.productId);
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, LIMIT)));
  } catch (error) {
    // Storage can be unavailable (private mode); nothing to track then
  }
})();
