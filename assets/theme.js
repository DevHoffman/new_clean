/* ==========================================================================
   New Clean — global scripts
   Vanilla custom elements, no dependencies. Loaded with `defer` on every page.
   ========================================================================== */

/* Utilities
   ========================================================================== */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

function debounce(fn, wait) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}

function announce(message) {
  const region = document.getElementById('LiveRegion');
  if (!region) return;
  region.textContent = '';
  window.requestAnimationFrame(() => {
    region.textContent = message;
  });
}

function formatMoney(cents, format = window.theme.settings.moneyFormat) {
  const value = typeof cents === 'string' ? parseInt(cents.replace('.', ''), 10) : cents;
  const pattern = /\{\{\s*(\w+)\s*\}\}/;

  const withDelimiters = (number, precision, thousands, decimal) => {
    if (Number.isNaN(number) || number == null) return '0';
    const fixed = (number / 100).toFixed(precision);
    const [whole, fraction] = fixed.split('.');
    const grouped = whole.replace(/(\d)(?=(\d{3})+(?!\d))/g, `$1${thousands}`);
    return fraction ? `${grouped}${decimal}${fraction}` : grouped;
  };

  const match = format.match(pattern);
  let output;
  switch (match ? match[1] : 'amount') {
    case 'amount_no_decimals':
      output = withDelimiters(value, 0, ',', '.');
      break;
    case 'amount_with_comma_separator':
      output = withDelimiters(value, 2, '.', ',');
      break;
    case 'amount_no_decimals_with_comma_separator':
      output = withDelimiters(value, 0, '.', ',');
      break;
    case 'amount_with_apostrophe_separator':
      output = withDelimiters(value, 2, "'", '.');
      break;
    default:
      output = withDelimiters(value, 2, ',', '.');
  }
  return format.replace(pattern, output);
}

function trapFocus(container) {
  const handler = (event) => {
    if (event.key !== 'Tab') return;
    const items = Array.from(container.querySelectorAll(FOCUSABLE)).filter(
      (el) => el.offsetParent !== null || el === document.activeElement
    );
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  container.addEventListener('keydown', handler);
  return () => container.removeEventListener('keydown', handler);
}

function parseHTML(html) {
  return new DOMParser().parseFromString(html, 'text/html');
}

window.theme.utils = { debounce, announce, formatMoney, trapFocus, parseHTML };

/* Cart API
   Every element marked with [data-cart-section="<section id>"] is re-rendered
   through the Section Rendering API after a cart mutation.
   ========================================================================== */
const Cart = {
  sectionIds() {
    const ids = Array.from(document.querySelectorAll('[data-cart-section]')).map((el) => el.dataset.cartSection);
    return Array.from(new Set(ids));
  },

  async request(url, body) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok || data.status) {
      const error = new Error(data.description || data.message || window.theme.strings.cartError);
      error.data = data;
      throw error;
    }
    return data;
  },

  async add(items, source) {
    const data = await this.request(window.theme.routes.cartAdd, {
      items,
      sections: this.sectionIds(),
      sections_url: window.location.pathname,
    });
    this.render(data.sections);
    this.notify('add', source);
    return data;
  },

  async change(key, quantity, source) {
    const data = await this.request(window.theme.routes.cartChange, {
      id: key,
      quantity,
      sections: this.sectionIds(),
      sections_url: window.location.pathname,
    });
    this.render(data.sections);
    this.notify('change', source, data);
    return data;
  },

  async update(payload) {
    return this.request(window.theme.routes.cartUpdate, payload);
  },

  async refresh() {
    const ids = this.sectionIds();
    if (!ids.length) return;
    const url = `${window.location.pathname}?sections=${ids.join(',')}`;
    const response = await fetch(url);
    if (!response.ok) return;
    this.render(await response.json());
    this.notify('refresh');
  },

  render(sections) {
    if (!sections) return;
    Object.entries(sections).forEach(([id, html]) => {
      if (!html) return;
      const doc = parseHTML(html);
      document.querySelectorAll(`[data-cart-section="${id}"]`).forEach((target) => {
        // A section may expose several regions so unrelated fields keep their state
        const region = target.dataset.cartRegion;
        const source = region
          ? doc.querySelector(`[data-cart-section="${id}"][data-cart-region="${region}"]`)
          : doc.querySelector(`[data-cart-section="${id}"]:not([data-cart-region])`);
        if (!source) return;
        target.innerHTML = source.innerHTML;
        if (source.dataset.itemCount !== undefined) target.dataset.itemCount = source.dataset.itemCount;
      });
    });
  },

  itemCount() {
    const section = document.querySelector('[data-cart-section][data-item-count]');
    return section ? parseInt(section.dataset.itemCount, 10) || 0 : null;
  },

  notify(action, source, cart) {
    const count = cart && typeof cart.item_count === 'number' ? cart.item_count : this.itemCount();
    if (count !== null) {
      document.querySelectorAll('[data-cart-count]').forEach((el) => {
        el.textContent = count;
        el.dataset.count = count;
      });
    }
    document.dispatchEvent(new CustomEvent('cart:updated', { detail: { action, source, count } }));
    // The pre-checkout page has a different layout when the cart is empty
    if (count === 0 && document.body.classList.contains('template-cart')) window.location.reload();
  },
};

window.theme.cart = Cart;

/* Modal / drawer base
   ========================================================================== */
class ModalElement extends HTMLElement {
  connectedCallback() {
    this.addEventListener('click', (event) => {
      if (event.target.closest('[data-modal-close]')) this.close();
    });
    this.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') this.close();
    });
  }

  get panel() {
    return this.querySelector('.modal__panel, .drawer__panel');
  }

  get isOpen() {
    return this.classList.contains('is-open');
  }

  open(opener) {
    if (this.isOpen) return;
    this.opener = opener || document.activeElement;
    this.hidden = false;
    // Force a reflow so the transition runs after removing [hidden]
    void this.offsetWidth;
    this.classList.add('is-open');
    document.body.classList.add('is-locked');
    this.releaseFocus = trapFocus(this);
    const autofocus = this.querySelector('[data-autofocus]') || this.panel;
    if (autofocus) window.setTimeout(() => autofocus.focus({ preventScroll: true }), 50);
    this.dispatchEvent(new CustomEvent('modal:open', { bubbles: true }));
  }

  close() {
    if (!this.isOpen) return;
    this.classList.remove('is-open');
    if (this.releaseFocus) this.releaseFocus();
    if (!document.querySelector('.modal.is-open, .drawer.is-open')) {
      document.body.classList.remove('is-locked');
    }
    window.setTimeout(() => {
      if (!this.isOpen) this.hidden = true;
    }, 350);
    if (this.opener && document.contains(this.opener)) this.opener.focus({ preventScroll: true });
    this.dispatchEvent(new CustomEvent('modal:close', { bubbles: true }));
  }
}

customElements.define('modal-element', ModalElement);

document.addEventListener('click', (event) => {
  const opener = event.target.closest('[data-modal-open]');
  if (!opener) return;
  const modal = document.querySelector(opener.dataset.modalOpen);
  if (!modal || typeof modal.open !== 'function') return;
  event.preventDefault();
  modal.open(opener);
});

/* Header
   ========================================================================== */
class StickyHeader extends HTMLElement {
  connectedCallback() {
    this.wrapper = this.closest('.shopify-section');
    if (this.wrapper && this.dataset.sticky !== 'false') this.wrapper.classList.add('section-header-wrapper');
    this.setHeight();
    if (window.theme.settings.headerMouseEffect && document.documentElement.dataset.fx !== 'lite') this.setupMouseEffect();

    window.addEventListener('resize', debounce(() => this.setHeight(), 150));
    // The header shrinks when scrolled; keep the CSS variable in sync
    new ResizeObserver(() => this.setHeight()).observe(this);
    window.addEventListener(
      'scroll',
      () => {
        // Hysteresis so the compact header never flickers around the threshold
        const root = document.documentElement;
        if (window.scrollY > 80) root.classList.add('is-scrolled');
        else if (window.scrollY < 20) root.classList.remove('is-scrolled');
      },
      { passive: true }
    );

    // Keyboard support for desktop dropdowns
    this.querySelectorAll('.nav__item').forEach((item) => {
      const trigger = item.querySelector('[aria-expanded]');
      if (!trigger) return;
      item.addEventListener('mouseenter', () => trigger.setAttribute('aria-expanded', 'true'));
      item.addEventListener('mouseleave', () => trigger.setAttribute('aria-expanded', 'false'));
      item.addEventListener('focusin', () => trigger.setAttribute('aria-expanded', 'true'));
      item.addEventListener('focusout', (event) => {
        if (!item.contains(event.relatedTarget)) trigger.setAttribute('aria-expanded', 'false');
      });
      item.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        trigger.setAttribute('aria-expanded', 'false');
        trigger.focus();
        trigger.blur();
      });
    });
  }

  setHeight() {
    document.documentElement.style.setProperty('--header-height', `${this.offsetHeight}px`);
  }

  /* Pill that slides under the hovered menu item */
  setupMouseEffect() {
    const header = this.querySelector('.header');
    const nav = this.querySelector('.nav');
    if (!header || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    header.classList.add('header--mouse');

    if (!nav) return;
    const indicator = document.createElement('span');
    indicator.className = 'nav__indicator';
    header.appendChild(indicator);

    const current = nav.querySelector('.nav__link[aria-current="page"]');
    const moveTo = (link) => {
      if (!link) {
        indicator.classList.remove('is-active');
        return;
      }
      const rect = link.getBoundingClientRect();
      const base = header.getBoundingClientRect();
      indicator.style.left = `${rect.left - base.left}px`;
      indicator.style.width = `${rect.width}px`;
      indicator.classList.add('is-active');
    };

    nav.querySelectorAll('.nav__link').forEach((link) => {
      link.addEventListener('mouseenter', () => moveTo(link));
      link.addEventListener('focus', () => moveTo(link));
    });
    nav.addEventListener('mouseleave', () => moveTo(current));
    nav.addEventListener('focusout', (event) => {
      if (!nav.contains(event.relatedTarget)) moveTo(current);
    });
    window.addEventListener('resize', debounce(() => moveTo(current), 150));
    if (current) window.requestAnimationFrame(() => moveTo(current));
  }
}

customElements.define('sticky-header', StickyHeader);

class AnnouncementBar extends HTMLElement {
  connectedCallback() {
    this.items = Array.from(this.querySelectorAll('.announcement-bar__item'));
    this.index = 0;
    if (!this.items.length) return;
    this.items[0].classList.add('is-active');
    if (this.items.length < 2) return;

    const speed = (parseInt(this.dataset.speed, 10) || 5) * 1000;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    this.timer = window.setInterval(() => this.next(), speed);
    this.addEventListener('mouseenter', () => window.clearInterval(this.timer));
    this.addEventListener('mouseleave', () => {
      this.timer = window.setInterval(() => this.next(), speed);
    });
  }

  disconnectedCallback() {
    window.clearInterval(this.timer);
  }

  next() {
    this.items[this.index].classList.remove('is-active');
    this.index = (this.index + 1) % this.items.length;
    this.items[this.index].classList.add('is-active');
  }
}

customElements.define('announcement-bar', AnnouncementBar);

/* Predictive search
   ========================================================================== */
class PredictiveSearch extends HTMLElement {
  connectedCallback() {
    this.input = this.querySelector('input[type="search"]');
    this.results = this.querySelector('[data-predictive-results]');
    this.defaultContent = this.querySelector('[data-predictive-default]');
    if (!this.input || !this.results) return;

    this.cache = new Map();
    this.input.addEventListener(
      'input',
      debounce(() => this.onInput(), 250)
    );
  }

  async onInput() {
    const term = this.input.value.trim();
    if (term.length < 2) {
      this.clear();
      return;
    }

    if (this.cache.has(term)) {
      this.show(this.cache.get(term));
      return;
    }

    if (this.controller) this.controller.abort();
    this.controller = new AbortController();

    const params = new URLSearchParams({
      q: term,
      section_id: 'predictive-search',
      'resources[type]': 'product,collection,query',
      'resources[limit]': '6',
      'resources[limit_scope]': 'each',
    });

    try {
      const response = await fetch(`${window.theme.routes.predictiveSearch}?${params}`, {
        signal: this.controller.signal,
      });
      if (!response.ok) throw new Error(response.status);
      const html = parseHTML(await response.text()).querySelector('[data-predictive-content]');
      const markup = html ? html.innerHTML : '';
      this.cache.set(term, markup);
      if (this.input.value.trim() === term) this.show(markup);
    } catch (error) {
      if (error.name !== 'AbortError') this.clear();
    }
  }

  show(markup) {
    this.results.innerHTML = markup;
    this.results.hidden = false;
    if (this.defaultContent) this.defaultContent.hidden = true;
  }

  clear() {
    this.results.innerHTML = '';
    this.results.hidden = true;
    if (this.defaultContent) this.defaultContent.hidden = false;
  }
}

customElements.define('predictive-search', PredictiveSearch);

/* Slider
   ========================================================================== */
class SliderComponent extends HTMLElement {
  connectedCallback() {
    this.slider = this.querySelector('.slider');
    if (!this.slider) return;
    const scope = this.closest('[data-slider-scope]') || this;
    this.prev = scope.querySelector('[data-slider-prev]');
    this.next = scope.querySelector('[data-slider-next]');
    this.dots = this.querySelector('[data-slider-dots]');

    if (this.prev) this.prev.addEventListener('click', () => this.scrollByPage(-1));
    if (this.next) this.next.addEventListener('click', () => this.scrollByPage(1));

    this.update = debounce(() => this.refresh(), 60);
    this.slider.addEventListener('scroll', this.update, { passive: true });
    this.resizeObserver = new ResizeObserver(() => {
      this.setup();
      this.dispatchEvent(new CustomEvent('slider:resize'));
    });
    this.resizeObserver.observe(this.slider);
    this.setup();

    if (this.dataset.autoplay) this.startAutoplay();
    if (this.dataset.autoscroll) this.startAutoscroll();
  }

  disconnectedCallback() {
    if (this.resizeObserver) this.resizeObserver.disconnect();
    window.clearInterval(this.autoplayTimer);
    window.cancelAnimationFrame(this.autoscrollFrame);
    if (this.autoscrollObserver) this.autoscrollObserver.disconnect();
  }

  get slides() {
    return Array.from(this.slider.children).filter((slide) => slide.offsetParent !== null);
  }

  get direction() {
    return getComputedStyle(this.slider).direction === 'rtl' ? -1 : 1;
  }

  setup() {
    const scrollable = this.slider.scrollWidth - this.slider.clientWidth > 4;
    this.toggleAttribute('data-static', !scrollable);

    if (this.dots) {
      const slides = this.slides;
      const perPage = Math.max(1, Math.round(this.slider.clientWidth / (slides[0] ? slides[0].offsetWidth : 1)));
      const pages = scrollable ? Math.ceil(slides.length / perPage) : 0;
      if (this.dots.children.length !== pages) {
        this.dots.innerHTML = '';
        for (let i = 0; i < pages; i += 1) {
          const dot = document.createElement('button');
          dot.type = 'button';
          dot.className = 'slider__dot';
          dot.setAttribute('aria-label', `${i + 1} / ${pages}`);
          dot.addEventListener('click', () => {
            const target = slides[i * perPage];
            if (target) this.scrollToSlide(target);
          });
          this.dots.appendChild(dot);
        }
      }
      this.perPage = perPage;
    }
    this.refresh();
  }

  refresh() {
    const position = Math.abs(this.slider.scrollLeft);
    const max = this.slider.scrollWidth - this.slider.clientWidth;
    if (this.prev) this.prev.disabled = !this.autoscrolling && position <= 4;
    if (this.next) this.next.disabled = !this.autoscrolling && position >= max - 4;

    if (this.dots && this.dots.children.length) {
      const pages = this.dots.children.length;
      const current = max > 0 ? Math.round((position / max) * (pages - 1)) : 0;
      Array.from(this.dots.children).forEach((dot, index) => {
        dot.setAttribute('aria-current', index === current ? 'true' : 'false');
      });
      this.dispatchEvent(new CustomEvent('slider:change', { detail: { index: current } }));
    }
  }

  scrollByPage(direction) {
    const amount = this.slider.clientWidth * 0.9 * direction * this.direction;
    if (this.autoscrolling) {
      this.pauseAutoscroll(4000);
      // Going back from the very start: jump to the same spot one lap ahead first
      if (direction < 0 && this.slider.scrollLeft < Math.abs(amount)) {
        this.slider.scrollTo({ left: this.slider.scrollLeft + this.loopWidth, behavior: 'instant' });
      }
    }
    this.slider.scrollBy({ left: amount, behavior: 'smooth' });
  }

  scrollToSlide(slide, behavior = 'smooth') {
    const left = slide.offsetLeft - this.slider.offsetLeft;
    this.slider.scrollTo({ left, behavior });
  }

  startAutoplay() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const speed = (parseInt(this.dataset.autoplay, 10) || 6) * 1000;
    const tick = () => {
      const max = this.slider.scrollWidth - this.slider.clientWidth;
      if (Math.abs(this.slider.scrollLeft) >= max - 4) {
        this.slider.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        this.scrollByPage(1);
      }
    };
    const start = () => {
      window.clearInterval(this.autoplayTimer);
      this.autoplayTimer = window.setInterval(tick, speed);
    };
    const stop = () => window.clearInterval(this.autoplayTimer);
    this.addEventListener('mouseenter', stop);
    this.addEventListener('mouseleave', start);
    this.addEventListener('focusin', stop);
    this.addEventListener('focusout', start);
    this.addEventListener('touchstart', stop, { passive: true });
    start();
  }

  /* Continuous movement, in pixels per second (data-autoscroll). The cards are
     repeated once, so when the first lap ends the scroll position jumps back by
     exactly one lap and nobody sees the seam. Any interaction pauses it. */
  startAutoscroll() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const speed = parseFloat(this.dataset.autoscroll) || 40;
    const originals = Array.from(this.slider.children);
    // Nothing to move when every card already fits
    if (originals.length < 2 || this.slider.scrollWidth - this.slider.clientWidth <= 4) return;

    originals.forEach((slide) => {
      const clone = slide.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      clone.setAttribute('data-clone', '');
      clone.querySelectorAll('[id]').forEach((element) => element.removeAttribute('id'));
      clone.querySelectorAll('a, button, input, select, textarea, summary, [tabindex]').forEach((element) => element.setAttribute('tabindex', '-1'));
      this.slider.appendChild(clone);
    });

    this.autoscrolling = true;
    this.slider.classList.add('slider--autoscroll');
    const measure = () => {
      this.loopWidth = this.slider.children[originals.length].offsetLeft - this.slider.children[0].offsetLeft;
    };
    measure();
    this.addEventListener('slider:resize', measure);

    let hovering = false;
    let touching = false;
    let inView = true;
    this.pauseUntil = 0;
    this.pauseAutoscroll = (ms) => {
      this.pauseUntil = performance.now() + ms;
    };

    this.addEventListener('mouseenter', () => (hovering = true));
    this.addEventListener('mouseleave', () => (hovering = false));
    this.addEventListener('focusin', () => (hovering = true));
    this.addEventListener('focusout', () => (hovering = false));
    this.addEventListener('touchstart', () => (touching = true), { passive: true });
    this.addEventListener('touchend', () => {
      touching = false;
      this.pauseAutoscroll(2500);
    });
    this.addEventListener('wheel', () => this.pauseAutoscroll(2500), { passive: true });

    if ('IntersectionObserver' in window) {
      this.autoscrollObserver = new IntersectionObserver((entries) => {
        inView = entries[0].isIntersecting;
      });
      this.autoscrollObserver.observe(this);
    }

    let position = this.slider.scrollLeft;
    let lastSet = position;
    let last = performance.now();
    const frame = (now) => {
      this.autoscrollFrame = window.requestAnimationFrame(frame);
      const delta = Math.min(now - last, 64) / 1000;
      last = now;
      if (document.hidden || !inView) return;
      // Somebody else moved the scroll (touch, arrows, keyboard): follow it
      if (Math.abs(this.slider.scrollLeft - lastSet) > 1.5) position = this.slider.scrollLeft;
      if (hovering || touching || now < this.pauseUntil) return;
      position += speed * delta;
      if (this.loopWidth && position >= this.loopWidth) position -= this.loopWidth;
      this.slider.scrollLeft = position;
      lastSet = this.slider.scrollLeft;
    };
    this.autoscrollFrame = window.requestAnimationFrame(frame);
  }
}

customElements.define('slider-component', SliderComponent);

/* Quantity input
   ========================================================================== */
class QuantityInput extends HTMLElement {
  connectedCallback() {
    this.input = this.querySelector('input');
    if (!this.input) return;
    this.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-quantity]');
      if (!button) return;
      event.preventDefault();
      const previous = this.input.value;
      if (button.dataset.quantity === 'plus') this.input.stepUp();
      else this.input.stepDown();
      if (previous !== this.input.value) this.input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    this.input.addEventListener('change', () => this.validate());
    this.validate();
  }

  validate() {
    const value = parseInt(this.input.value, 10);
    const min = parseInt(this.input.min, 10) || 0;
    const max = parseInt(this.input.max, 10);
    const minus = this.querySelector('[data-quantity="minus"]');
    const plus = this.querySelector('[data-quantity="plus"]');
    if (minus) minus.disabled = value <= min;
    if (plus) plus.disabled = !Number.isNaN(max) && value >= max;
  }
}

customElements.define('quantity-input', QuantityInput);

/* Product form (add to cart)
   ========================================================================== */
class ProductForm extends HTMLElement {
  connectedCallback() {
    this.form = this.querySelector('form');
    if (!this.form) return;
    this.form.addEventListener('submit', (event) => this.onSubmit(event));
  }

  get submitButton() {
    return this.form.querySelector('[type="submit"]');
  }

  get errorElement() {
    return this.querySelector('[data-form-error]');
  }

  async onSubmit(event) {
    event.preventDefault();
    const button = this.submitButton;
    if (!button || button.classList.contains('is-loading') || button.getAttribute('aria-disabled') === 'true') return;

    this.setError('');
    button.classList.add('is-loading');
    button.setAttribute('aria-busy', 'true');

    const formData = new FormData(this.form);
    const item = {
      id: parseInt(formData.get('id'), 10),
      quantity: parseInt(formData.get('quantity'), 10) || 1,
    };
    const sellingPlan = formData.get('selling_plan');
    if (sellingPlan) item.selling_plan = parseInt(sellingPlan, 10);

    const properties = {};
    formData.forEach((value, key) => {
      const match = key.match(/^properties\[(.+)\]$/);
      if (match && value !== '') properties[match[1]] = value;
    });
    if (Object.keys(properties).length) item.properties = properties;

    const items = [item];
    // Bundled add-ons ("compre junto") are sent in the same request
    const scope = this.closest('product-info') || this;
    scope.querySelectorAll('input[data-addon-variant]:checked').forEach((input) => {
      items.push({ id: parseInt(input.dataset.addonVariant, 10), quantity: 1 });
    });

    try {
      await Cart.add(items, this);
      announce(window.theme.strings.added);
      this.dispatchEvent(new CustomEvent('product:added', { bubbles: true, detail: { items } }));

      const quickAdd = this.closest('quick-add-modal');
      if (quickAdd) quickAdd.close();

      const drawer = document.querySelector('cart-drawer');
      if (drawer) {
        drawer.open(quickAdd ? quickAdd.opener : button);
      } else if (!document.querySelector('[data-cart-section]')) {
        window.location.href = window.theme.routes.cart;
      }
    } catch (error) {
      this.setError(error.message);
    } finally {
      button.classList.remove('is-loading');
      button.removeAttribute('aria-busy');
    }
  }

  setError(message) {
    const element = this.errorElement;
    if (element) {
      element.textContent = message;
      element.hidden = !message;
    } else if (message) {
      // Cards have no room for inline errors
      announce(message);
      window.alert(message);
    }
  }
}

customElements.define('product-form', ProductForm);

/* Product info (variant selection, shared by product page and quick add)
   ========================================================================== */
class ProductInfo extends HTMLElement {
  connectedCallback() {
    this.sectionId = this.dataset.sectionId;
    this.renderSection = this.dataset.renderSection || this.sectionId;
    this.productUrl = this.dataset.productUrl;
    this.updateUrl = this.dataset.updateUrl !== 'false';

    this.addEventListener('change', (event) => {
      if (event.target.closest('[data-variant-picker]')) this.onVariantChange(event);
    });
  }

  get selectedOptionValues() {
    const picker = this.querySelector('[data-variant-picker]');
    if (!picker) return [];
    return Array.from(picker.querySelectorAll('input[type="radio"]:checked, select option:checked'))
      .map((el) => el.dataset.optionValueId)
      .filter(Boolean);
  }

  async onVariantChange(event) {
    const target = event.target;
    // Combined listings: an option value can live on a sibling product
    const option = target.tagName === 'SELECT' ? target.selectedOptions[0] : target;
    const targetUrl = (option && option.dataset.productUrl) || this.productUrl;
    const switchingProduct = targetUrl !== this.productUrl;

    const params = new URLSearchParams({
      section_id: this.renderSection,
      option_values: this.selectedOptionValues.join(','),
    });

    if (this.controller) this.controller.abort();
    this.controller = new AbortController();
    this.classList.add('is-loading');

    try {
      const response = await fetch(`${targetUrl}?${params}`, { signal: this.controller.signal });
      if (!response.ok) throw new Error(response.status);
      const html = parseHTML(await response.text());

      if (switchingProduct && this.updateUrl) {
        window.location.href = targetUrl;
        return;
      }

      this.renderRegions(html);
      const variant = this.getVariant(html);
      this.updateMedia(variant);
      this.updateHistory(variant);
      this.dispatchEvent(new CustomEvent('variant:change', { bubbles: true, detail: { variant, html } }));
    } catch (error) {
      if (error.name !== 'AbortError') console.error(error);
    } finally {
      this.classList.remove('is-loading');
    }
  }

  renderRegions(html) {
    const focusedId = document.activeElement && document.activeElement.id;
    this.querySelectorAll('[data-region]').forEach((region) => {
      const source = html.querySelector(`[data-region="${region.dataset.region}"]`);
      if (source) region.innerHTML = source.innerHTML;
    });
    // Regions outside <product-info> that mirror its state (e.g. sticky bar)
    document.querySelectorAll(`[data-region-for="${this.sectionId}"]`).forEach((region) => {
      const source = html.querySelector(`[data-region-for="${this.sectionId}"][data-region="${region.dataset.region}"]`);
      if (source) region.innerHTML = source.innerHTML;
    });
    if (focusedId) {
      const element = document.getElementById(focusedId);
      if (element) element.focus({ preventScroll: true });
    }
    if (window.Shopify && window.Shopify.PaymentButton) window.Shopify.PaymentButton.init();
  }

  getVariant(html) {
    const script = html.querySelector('[data-selected-variant]');
    if (!script) return null;
    try {
      return JSON.parse(script.textContent);
    } catch (error) {
      return null;
    }
  }

  updateMedia(variant) {
    if (!variant || !variant.featured_media) return;
    const gallery = this.querySelector('product-gallery');
    if (gallery && typeof gallery.goToMedia === 'function') {
      gallery.goToMedia(variant.featured_media.id);
      return;
    }
    const image = this.querySelector('.js-variant-image');
    if (image && variant.featured_media.preview_image) {
      image.removeAttribute('srcset');
      image.src = variant.featured_media.preview_image.src;
    }
  }

  updateHistory(variant) {
    if (!variant || !this.updateUrl) return;
    const url = new URL(window.location.href);
    url.searchParams.set('variant', variant.id);
    window.history.replaceState({}, '', url);
  }
}

customElements.define('product-info', ProductInfo);

/* Quick add modal
   ========================================================================== */
class QuickAddModal extends ModalElement {
  connectedCallback() {
    super.connectedCallback();
    this.content = this.querySelector('[data-quick-add-content]');
    this.onDocumentClick = (event) => {
      const trigger = event.target.closest('[data-quick-add-url]');
      if (!trigger) return;
      event.preventDefault();
      this.load(trigger);
    };
    document.addEventListener('click', this.onDocumentClick);
    this.addEventListener('modal:close', () => {
      window.setTimeout(() => {
        if (!this.isOpen) this.content.innerHTML = '';
      }, 400);
    });
  }

  disconnectedCallback() {
    document.removeEventListener('click', this.onDocumentClick);
  }

  async load(trigger) {
    if (trigger.classList.contains('is-loading')) return;
    trigger.classList.add('is-loading');
    try {
      const url = new URL(trigger.dataset.quickAddUrl, window.location.origin);
      url.searchParams.set('section_id', 'quick-add');
      const response = await fetch(url.toString());
      if (!response.ok) throw new Error(response.status);
      const source = parseHTML(await response.text()).querySelector('[data-quick-add-source]');
      if (!source) throw new Error('Quick add markup not found');
      this.content.innerHTML = source.innerHTML;
      if (window.Shopify && window.Shopify.PaymentButton) window.Shopify.PaymentButton.init();
      this.open(trigger);
    } catch (error) {
      window.location.href = trigger.dataset.quickAddUrl;
    } finally {
      trigger.classList.remove('is-loading');
    }
  }
}

customElements.define('quick-add-modal', QuickAddModal);

/* Cart drawer + cart items
   ========================================================================== */
class CartDrawer extends ModalElement {
  connectedCallback() {
    super.connectedCallback();
    // Delegated so it survives header re-renders in the theme editor
    this.onToggleClick = (event) => {
      const toggle = event.target.closest('[data-cart-toggle]');
      if (!toggle) return;
      event.preventDefault();
      this.open(toggle);
    };
    document.addEventListener('click', this.onToggleClick);

    // Keep the drawer in sync when the page is restored from bfcache
    this.onPageShow = (event) => {
      if (event.persisted) Cart.refresh();
    };
    window.addEventListener('pageshow', this.onPageShow);
  }

  disconnectedCallback() {
    document.removeEventListener('click', this.onToggleClick);
    window.removeEventListener('pageshow', this.onPageShow);
  }
}

customElements.define('cart-drawer', CartDrawer);

class CartItems extends HTMLElement {
  connectedCallback() {
    this.onChange = debounce((event) => this.handleChange(event), 300);
    this.addEventListener('change', this.onChange);
    this.addEventListener('click', (event) => {
      const remove = event.target.closest('[data-cart-remove]');
      if (!remove) return;
      event.preventDefault();
      this.updateLine(remove.dataset.cartRemove, 0);
    });
  }

  handleChange(event) {
    const input = event.target.closest('input[data-line-key]');
    if (!input) return;
    const quantity = Math.max(0, parseInt(input.value, 10) || 0);
    this.updateLine(input.dataset.lineKey, quantity, input);
  }

  async updateLine(key, quantity, input) {
    const container = this.closest('cart-drawer') || this.closest('[data-cart-section]') || this;
    container.classList.add('is-updating');
    const index = input ? input.dataset.index : null;

    try {
      const cart = await Cart.change(key, quantity, this);
      const line = cart.items.find((item) => item.key === key);
      if (input && line && line.quantity !== quantity) {
        this.showError(index, window.theme.strings.quantityError.replace('[quantity]', line.quantity));
      }
    } catch (error) {
      this.showError(index, error.message);
      if (input) input.value = input.getAttribute('value');
    } finally {
      container.classList.remove('is-updating');
    }
  }

  showError(index, message) {
    const scope = this.closest('[data-cart-section]') || document;
    const target = index ? scope.querySelector(`[data-line-error="${index}"]`) : null;
    if (target) target.textContent = message;
    announce(message);
  }
}

customElements.define('cart-items', CartItems);

class CartNote extends HTMLElement {
  connectedCallback() {
    this.addEventListener(
      'change',
      debounce((event) => {
        Cart.update({ note: event.target.value });
      }, 300)
    );
  }
}

customElements.define('cart-note', CartNote);

/* Buy again (customer account)
   ========================================================================== */
document.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-reorder]');
  if (!button || button.classList.contains('is-loading')) return;
  event.preventDefault();

  const items = button.dataset.reorder
    .split(',')
    .filter(Boolean)
    .map((pair) => {
      const [id, quantity] = pair.split(':');
      return { id: parseInt(id, 10), quantity: parseInt(quantity, 10) || 1 };
    });
  if (!items.length) return;

  button.classList.add('is-loading');
  try {
    await Cart.add(items, button);
    announce(window.theme.strings.reorderDone);
    const drawer = document.querySelector('cart-drawer');
    if (drawer) drawer.open(button);
    else window.location.href = window.theme.routes.cart;
  } catch (error) {
    announce(error.message);
    window.alert(error.message);
  } finally {
    button.classList.remove('is-loading');
  }
});

/* Pre-checkout: customer details and payment preference saved as cart attributes
   ========================================================================== */
class CartAttributes extends HTMLElement {
  connectedCallback() {
    this.status = this.querySelector('[data-attributes-status]');
    this.pending = {};
    this.save = debounce(() => this.flush(), 500);

    this.addEventListener('input', (event) => this.onChange(event, false));
    this.addEventListener('change', (event) => this.onChange(event, true));
  }

  onChange(event, immediate) {
    const field = event.target.closest('[data-cart-attribute]');
    if (!field) return;
    if (field.type === 'radio') {
      if (!field.checked) return;
      this.querySelectorAll('.payment-option').forEach((option) => {
        option.classList.toggle('is-selected', option.contains(field));
      });
    }
    this.pending[field.dataset.cartAttribute] = field.value.trim();
    this.mirror(field);
    if (immediate) this.flush();
    else this.save();
  }

  /* Keep the hidden checkout prefill fields in sync */
  mirror(field) {
    const source = field.dataset.prefillSource;
    if (!source) return;
    const value = field.value.trim();
    const set = (name, text) => {
      const input = document.querySelector(`[data-prefill="${name}"]`);
      if (input) input.value = text;
    };
    if (source === 'name') {
      const [first, ...rest] = value.split(/\s+/);
      set('first_name', first || '');
      set('last_name', rest.join(' '));
    } else {
      set(source, value);
    }
  }

  async flush() {
    const attributes = this.pending;
    if (!Object.keys(attributes).length) return;
    this.pending = {};
    try {
      await Cart.update({ attributes });
      if (this.status) this.status.textContent = window.theme.strings.attributesSaved;
    } catch (error) {
      if (this.status) this.status.textContent = error.message;
    }
  }
}

customElements.define('cart-attributes', CartAttributes);

/* Pre-checkout → Shopify checkout through a cart permalink, the documented
   way to pre-fill customer data (checkout[email], shipping address…)
   ========================================================================== */
document.addEventListener('click', (event) => {
  const button = event.target.closest('button[name="checkout"][form="CartPageForm"]');
  if (!button) return;
  const data = document.querySelector('[data-checkout-lines]');
  if (!data || data.dataset.permalink !== 'true') return;

  let lines = [];
  try {
    lines = JSON.parse(data.textContent);
  } catch (error) {
    return;
  }
  if (!lines.length) return;
  event.preventDefault();

  const params = new URLSearchParams();
  // Checkout pre-fill (hidden inputs kept in sync by <cart-attributes>)
  document.querySelectorAll('#CartPageForm [data-prefill]').forEach((input) => {
    if (input.value.trim()) params.set(input.name, input.value.trim());
  });
  // Order attributes: a permalink creates a fresh cart, so they travel in the URL
  document.querySelectorAll('[data-cart-attribute]').forEach((field) => {
    if (field.type === 'radio' && !field.checked) return;
    if (field.value.trim()) params.set(`attributes[${field.dataset.cartAttribute}]`, field.value.trim());
  });
  const zip = document.querySelector('[data-prefill="zip"]');
  if (zip && zip.value.trim()) params.set('attributes[CEP]', zip.value.trim());
  const note = document.getElementById('CartNote-page');
  if (note && note.value.trim()) params.set('note', note.value.trim());
  try {
    const coupon = window.localStorage.getItem('newclean:coupon');
    if (coupon) params.set('discount', coupon);
  } catch (error) {
    // Storage unavailable
  }

  const path = lines.map((line) => `${line.id}:${line.quantity}`).join(',');
  const query = params.toString();
  window.location.href = `${window.theme.routes.root.replace(/\/$/, '')}/cart/${path}${query ? `?${query}` : ''}`;
});

/* Discount code: Shopify applies it at checkout through the /discount URL
   ========================================================================== */
class CouponForm extends HTMLElement {
  connectedCallback() {
    this.form = this.querySelector('form');
    this.input = this.querySelector('[data-coupon-input]');
    this.status = this.querySelector('[data-coupon-status]');
    if (!this.form) return;

    try {
      const saved = window.localStorage.getItem('newclean:coupon');
      if (saved) this.show(saved);
    } catch (error) {
      // Storage unavailable
    }

    this.form.addEventListener('submit', (event) => {
      event.preventDefault();
      const code = this.input.value.trim().toUpperCase();
      if (!/^[A-Z0-9_-]{2,40}$/.test(code)) {
        this.status.hidden = false;
        this.status.textContent = window.theme.strings.couponInvalid;
        return;
      }
      try {
        window.localStorage.setItem('newclean:coupon', code);
      } catch (error) {
        // Storage unavailable
      }
      const redirect = encodeURIComponent(this.dataset.redirect || '/cart');
      window.location.href = `${window.theme.routes.root.replace(/\/$/, '')}/discount/${encodeURIComponent(code)}?redirect=${redirect}`;
    });
  }

  show(code) {
    this.input.value = code;
    this.status.hidden = false;
    this.status.textContent = window.theme.strings.couponApplied.replace('[code]', code);
  }
}

customElements.define('coupon-form', CouponForm);

/* Pre-checkout summary: collapsed on mobile, always open on desktop */
(() => {
  const summary = document.querySelector('.checkout-summary');
  if (!summary) return;
  const media = window.matchMedia('(min-width: 1000px)');
  const apply = () => {
    summary.open = media.matches ? true : summary.dataset.userOpen === 'true';
  };
  summary.addEventListener('toggle', () => {
    if (!media.matches) summary.dataset.userOpen = summary.open ? 'true' : 'false';
  });
  media.addEventListener('change', apply);
  apply();
})();

/* Mobile cart summary bar
   ========================================================================== */
class CartBar extends HTMLElement {
  connectedCallback() {
    this.onUpdate = () => this.update();
    document.addEventListener('cart:updated', this.onUpdate);
    this.media = window.matchMedia('(max-width: 999px)');
    this.media.addEventListener('change', this.onUpdate);
    this.update();
  }

  disconnectedCallback() {
    document.removeEventListener('cart:updated', this.onUpdate);
    this.media.removeEventListener('change', this.onUpdate);
    document.documentElement.style.setProperty('--sticky-atc-height', '0px');
  }

  update() {
    const inner = this.querySelector('[data-cart-section]');
    const count = inner ? parseInt(inner.dataset.itemCount, 10) || 0 : 0;
    const visible = count > 0 && this.media.matches;
    this.hidden = !visible;
    // Floating buttons move up so they never cover the bar
    document.documentElement.style.setProperty('--sticky-atc-height', visible ? `${this.offsetHeight}px` : '0px');
  }
}

customElements.define('cart-bar', CartBar);

/* Shipping estimate by postcode (real rates from the store settings)
   ========================================================================== */
class ShippingEstimator extends HTMLElement {
  connectedCallback() {
    this.form = this.querySelector('form');
    this.input = this.querySelector('[data-shipping-zip]');
    this.results = this.querySelector('[data-shipping-results]');
    this.details = this.querySelector('details');
    if (!this.form || !this.input || !this.results) return;

    this.input.addEventListener('input', () => {
      const digits = this.input.value.replace(/\D/g, '').slice(0, 8);
      this.input.value = digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
    });
    this.form.addEventListener('submit', (event) => {
      event.preventDefault();
      this.estimate();
    });

    // Remember the last postcode and show its rates again after cart changes
    try {
      const saved = window.localStorage.getItem('newclean:zip');
      if (saved) {
        this.input.value = saved;
        this.details.open = true;
        this.estimate();
      }
    } catch (error) {
      // Storage unavailable
    }
  }

  async estimate() {
    const zip = this.input.value.replace(/\D/g, '');
    const button = this.form.querySelector('[type="submit"]');
    const strings = window.theme.strings;
    if (zip.length !== 8) {
      this.render(`<p class="shipping-estimator__error">${strings.shippingInvalid}</p>`);
      return;
    }
    try {
      window.localStorage.setItem('newclean:zip', this.input.value);
    } catch (error) {
      // Storage unavailable
    }

    button.classList.add('is-loading');
    try {
      const params = new URLSearchParams({
        'shipping_address[zip]': zip,
        'shipping_address[country]': this.dataset.country || 'BR',
      });
      let response = await fetch(`${window.theme.routes.cart}/shipping_rates.json?${params}`, {
        headers: { Accept: 'application/json' },
      });
      // Shopify may answer 202 while rates are being prepared
      let attempts = 0;
      while (response.status === 202 && attempts < 8) {
        await new Promise((resolve) => window.setTimeout(resolve, 600));
        response = await fetch(`${window.theme.routes.cart}/async_shipping_rates.json?${params}`, {
          headers: { Accept: 'application/json' },
        });
        attempts += 1;
      }
      const data = await response.json();
      if (!response.ok) {
        const messages = Object.values(data).flat().join(' ');
        this.render(`<p class="shipping-estimator__error">${messages || strings.shippingError}</p>`);
        return;
      }
      const rates = data.shipping_rates || [];
      if (!rates.length) {
        this.render(`<p class="shipping-estimator__error">${strings.shippingNoRates}</p>`);
        return;
      }
      if (this.hasAttribute('data-save-attribute')) {
        Cart.update({ attributes: { CEP: this.input.value } }).catch(() => {});
        const prefill = document.querySelector('[data-prefill="zip"]');
        if (prefill) prefill.value = this.input.value;
      }
      const cheapest = Math.min(...rates.map((rate) => Math.round(parseFloat(rate.price) * 100)));
      document.querySelectorAll('[data-summary-shipping]').forEach((el) => {
        el.textContent = cheapest === 0 ? strings.shippingFree : strings.shippingFrom.replace('[price]', formatMoney(cheapest));
      });
      this.render(
        `<ul class="shipping-estimator__rates" role="list">${rates
          .map((rate) => {
            const cents = Math.round(parseFloat(rate.price) * 100);
            const price = cents === 0 ? strings.shippingFree : formatMoney(cents);
            const days = rate.delivery_days && rate.delivery_days.length ? Math.max(...rate.delivery_days) : null;
            const eta = days ? (days === 1 ? strings.shippingDaysOne : strings.shippingDaysOther.replace('[count]', days)) : '';
            return `<li><span><strong>${rate.name}</strong>${eta ? `<small>${eta}</small>` : ''}</span><span class="shipping-estimator__price${cents === 0 ? ' is-free' : ''}">${price}</span></li>`;
          })
          .join('')}</ul>`
      );
    } catch (error) {
      this.render(`<p class="shipping-estimator__error">${strings.shippingError}</p>`);
    } finally {
      button.classList.remove('is-loading');
    }
  }

  render(html) {
    this.results.innerHTML = html;
  }
}

customElements.define('shipping-estimator', ShippingEstimator);

/* Product recommendations (lazy, fetched when near the viewport)
   ========================================================================== */
class ProductRecommendations extends HTMLElement {
  connectedCallback() {
    if (!this.dataset.url) return;

    // A hidden element never intersects the viewport, so it cannot be lazy
    if (this.hidden) {
      this.load();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        observer.disconnect();
        this.load();
      },
      { rootMargin: '0px 0px 600px 0px' }
    );
    observer.observe(this);
  }

  async load() {
    // [data-keep] means the element ships with server-rendered fallback content
    const keep = this.hasAttribute('data-keep');
    const cache = ProductRecommendations.cache;
    try {
      let markup = cache.get(this.dataset.url);
      if (markup === undefined) {
        const response = await fetch(this.dataset.url);
        if (!response.ok) throw new Error(response.status);
        const source = parseHTML(await response.text()).querySelector('product-recommendations');
        markup = source ? source.innerHTML.trim() : '';
        cache.set(this.dataset.url, markup);
      }
      if (markup.length) {
        this.innerHTML = markup;
        this.hidden = false;
      } else if (!keep) {
        this.hidden = true;
      }
    } catch (error) {
      if (!keep) this.hidden = true;
    }
  }
}

ProductRecommendations.cache = new Map();
// Cart upsells exclude products already in the cart, so they go stale on every change
document.addEventListener('cart:updated', () => ProductRecommendations.cache.clear());

customElements.define('product-recommendations', ProductRecommendations);

/* Countdown timer
   ========================================================================== */
class CountdownTimer extends HTMLElement {
  /* Next end of day / end of week (Sunday 23:59:59) in Brasília time (UTC-3) */
  static recurringEnd(mode) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      weekday: 'short',
    }).formatToParts(new Date());
    const get = (type) => (parts.find((part) => part.type === type) || {}).value;
    const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
    const daysAhead = mode === 'week' ? (7 - weekday) % 7 : 0;
    // 23:59:59 in Brasília is 02:59:59 UTC of the following day
    return Date.UTC(Number(get('year')), Number(get('month')) - 1, Number(get('day')) + daysAhead + 1, 2, 59, 59);
  }

  connectedCallback() {
    this.recurring = this.dataset.recurring;
    this.end = this.recurring ? CountdownTimer.recurringEnd(this.recurring) : new Date(this.dataset.end).getTime();
    if (Number.isNaN(this.end)) {
      this.hidden = true;
      return;
    }
    this.parts = {
      days: this.querySelector('[data-days]'),
      hours: this.querySelector('[data-hours]'),
      minutes: this.querySelector('[data-minutes]'),
      seconds: this.querySelector('[data-seconds]'),
    };
    this.tick();
    this.timer = window.setInterval(() => this.tick(), 1000);
  }

  disconnectedCallback() {
    window.clearInterval(this.timer);
  }

  tick() {
    if (this.recurring && this.end - Date.now() <= 0) this.end = CountdownTimer.recurringEnd(this.recurring);
    const remaining = this.end - Date.now();
    if (remaining <= 0) {
      window.clearInterval(this.timer);
      const scope = this.closest('[data-countdown-scope]') || this;
      scope.hidden = true;
      return;
    }
    const pad = (value) => String(value).padStart(2, '0');
    const values = {
      days: Math.floor(remaining / 86400000),
      hours: Math.floor((remaining / 3600000) % 24),
      minutes: Math.floor((remaining / 60000) % 60),
      seconds: Math.floor((remaining / 1000) % 60),
    };
    Object.entries(values).forEach(([key, value]) => {
      if (this.parts[key]) this.parts[key].textContent = pad(value);
    });
  }
}

customElements.define('countdown-timer', CountdownTimer);

/* Localization form
   ========================================================================== */
class LocalizationForm extends HTMLElement {
  connectedCallback() {
    this.addEventListener('change', (event) => {
      const form = event.target.closest('form');
      if (form) form.submit();
    });
  }
}

customElements.define('localization-form', LocalizationForm);

/* Deferred media (video / external video loaded on click)
   ========================================================================== */
class DeferredMedia extends HTMLElement {
  connectedCallback() {
    const trigger = this.querySelector('[data-deferred-trigger]');
    if (trigger) trigger.addEventListener('click', () => this.load());
  }

  load() {
    if (this.loaded) return;
    const template = this.querySelector('template');
    if (!template) return;
    this.loaded = true;
    const content = template.content.firstElementChild.cloneNode(true);
    this.appendChild(content);
    this.classList.add('is-loaded');
    const media = content.matches('video, iframe') ? content : content.querySelector('video, iframe');
    if (media) {
      media.focus();
      if (media.tagName === 'VIDEO') media.play().catch(() => {});
    }
  }
}

customElements.define('deferred-media', DeferredMedia);

/* Help widget ("Posso ajudar?")
   ========================================================================== */
class HelpWidget extends HTMLElement {
  connectedCallback() {
    this.panel = this.querySelector('.help__panel');
    this.toggle = this.querySelector('.help__toggle');
    this.badge = this.querySelector('[data-help-badge]');
    this.teaser = this.querySelector('[data-help-teaser]');
    if (!this.panel || !this.toggle) return;

    this.querySelectorAll('[data-help-toggle]').forEach((button) => {
      button.addEventListener('click', () => (this.isOpen ? this.close() : this.open()));
    });
    this.querySelector('[data-help-close]').addEventListener('click', () => this.close(true));
    const dismiss = this.querySelector('[data-help-dismiss]');
    if (dismiss) dismiss.addEventListener('click', () => this.markSeen());

    this.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.isOpen) this.close(true);
    });
    this.onDocumentClick = (event) => {
      if (this.isOpen && !this.contains(event.target)) this.close();
    };
    document.addEventListener('click', this.onDocumentClick);

    this.updateStatus();
    this.statusTimer = window.setInterval(() => this.updateStatus(), 60000);
    this.setupPending();
  }

  disconnectedCallback() {
    document.removeEventListener('click', this.onDocumentClick);
    window.clearInterval(this.statusTimer);
    window.clearTimeout(this.teaserTimer);
  }

  get isOpen() {
    return this.classList.contains('is-open');
  }

  /* Opening hours are evaluated in Brasília time, whatever the visitor's zone */
  updateStatus() {
    const dot = this.querySelector('[data-help-status-dot]');
    const label = this.querySelector('[data-help-status]');
    if (!dot || !label) return;

    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      weekday: 'short',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    }).formatToParts(new Date());
    const get = (type) => (parts.find((part) => part.type === type) || {}).value;
    const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
    const minutes = (parseInt(get('hour'), 10) % 24) * 60 + parseInt(get('minute'), 10);
    const toMinutes = (text) => {
      const [hours, mins] = String(text || '').split(':').map((value) => parseInt(value, 10) || 0);
      return hours * 60 + mins;
    };

    const days = this.dataset.days || 'weekdays';
    const dayOpen = days === 'everyday' || (days === 'mon-sat' ? day >= 1 && day <= 6 : day >= 1 && day <= 5);
    const online = dayOpen && minutes >= toMinutes(this.dataset.open) && minutes < toMinutes(this.dataset.close);

    dot.classList.toggle('is-online', online);
    label.textContent = online ? window.theme.strings.helpOnline : window.theme.strings.helpOffline;
    this.dataset.online = online ? 'true' : 'false';
  }

  /* Badge + teaser bubble until the visitor opens the panel (or dismisses it) */
  setupPending() {
    let seen = false;
    try {
      seen = window.localStorage.getItem('newclean:help-seen') === '1';
    } catch (error) {
      seen = false;
    }
    if (seen) return;

    this.classList.add('has-pending');
    if (this.badge) this.badge.hidden = false;

    if (this.teaser && this.dataset.teaserDelay !== undefined) {
      const delay = (parseInt(this.dataset.teaserDelay, 10) || 0) * 1000;
      this.teaserTimer = window.setTimeout(() => {
        if (!this.isOpen && window.innerWidth >= 750) this.teaser.hidden = false;
      }, delay);
    }
  }

  markSeen() {
    this.classList.remove('has-pending');
    if (this.badge) this.badge.hidden = true;
    if (this.teaser) this.teaser.hidden = true;
    window.clearTimeout(this.teaserTimer);
    try {
      window.localStorage.setItem('newclean:help-seen', '1');
    } catch (error) {
      // Storage unavailable
    }
  }

  open() {
    this.markSeen();
    this.panel.hidden = false;
    this.classList.add('is-open');
    this.toggle.setAttribute('aria-expanded', 'true');
    const first = this.panel.querySelector('.help__option, .help__whatsapp, .button');
    if (first) first.focus({ preventScroll: true });
  }

  close(refocus) {
    this.panel.hidden = true;
    this.classList.remove('is-open');
    this.toggle.setAttribute('aria-expanded', 'false');
    if (refocus) this.toggle.focus({ preventScroll: true });
  }
}

customElements.define('help-widget', HelpWidget);

/* Back to top with reading progress ring
   ========================================================================== */
class BackToTop extends HTMLElement {
  connectedCallback() {
    this.button = this.querySelector('button');
    if (!this.button) return;
    this.hidden = false;
    this.button.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      const main = document.getElementById('MainContent');
      if (main) main.focus({ preventScroll: true });
    });

    let frame = null;
    this.onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        this.update();
        frame = null;
      });
    };
    window.addEventListener('scroll', this.onScroll, { passive: true });
    this.update();
  }

  disconnectedCallback() {
    window.removeEventListener('scroll', this.onScroll);
  }

  update() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const progress = max > 0 ? Math.min(100, (window.scrollY / max) * 100) : 0;
    this.style.setProperty('--progress', progress.toFixed(1));
    this.classList.toggle('is-visible', window.scrollY > 400);
  }
}

customElements.define('back-to-top', BackToTop);

/* Smooth wheel scrolling with inertia (desktop mouse wheels only)
   Trackpads, touch and keyboard keep the browser's native behaviour.
   ========================================================================== */
class SmoothScroll {
  constructor() {
    this.target = window.scrollY;
    this.current = window.scrollY;
    this.running = false;
    this.lastFrame = 0;

    window.addEventListener('wheel', (event) => this.onWheel(event), { passive: false });
    window.addEventListener(
      'scroll',
      () => {
        // Scrolls we did not cause (scrollbar drag, keyboard, anchors,
        // browser find) always win: resync and stop animating
        if (!this.running || Math.abs(window.scrollY - this.current) > 2) {
          this.current = this.target = window.scrollY;
          this.running = false;
        }
      },
      { passive: true }
    );
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.running = false;
    });
  }

  static canScroll(element, delta) {
    let node = element instanceof Element ? element : null;
    while (node && node !== document.documentElement && node !== document.body) {
      const style = getComputedStyle(node);
      if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 1) {
        const atTop = node.scrollTop <= 0;
        const atBottom = node.scrollTop + node.clientHeight >= node.scrollHeight - 1;
        if ((delta < 0 && !atTop) || (delta > 0 && !atBottom)) return true;
      }
      node = node.parentElement;
    }
    return false;
  }

  onWheel(event) {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (document.body.classList.contains('is-locked')) return;
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    // Trackpads send many small, fractional deltas and are already smooth
    if (event.deltaMode === 0 && (Math.abs(event.deltaY) < 40 || !Number.isInteger(event.deltaY))) return;
    if (SmoothScroll.canScroll(event.target, event.deltaY)) return;

    event.preventDefault();
    const unit = event.deltaMode === 1 ? 40 : event.deltaMode === 2 ? window.innerHeight : 1;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (!this.running) this.current = this.target = window.scrollY;
    // One notch scrolls about a third of the viewport, capped so long pages stay controllable
    const step = Math.sign(event.deltaY) * Math.min(Math.abs(event.deltaY * unit), window.innerHeight * 0.35);
    this.target = Math.max(0, Math.min(max, this.target + step));
    if (!this.running) {
      this.running = true;
      this.lastFrame = performance.now();
      window.requestAnimationFrame((now) => this.tick(now));
    }
  }

  tick(now) {
    if (!this.running) return;
    // Frame-rate independent easing (~120ms to cover 63% of the distance)
    const elapsed = Math.min(64, now - this.lastFrame);
    this.lastFrame = now;
    const alpha = 1 - Math.exp(-elapsed / 120);
    const diff = this.target - this.current;
    if (Math.abs(diff) < 0.5) {
      this.current = this.target;
      window.scrollTo({ top: this.current, behavior: 'instant' });
      this.running = false;
      return;
    }
    this.current += diff * alpha;
    window.scrollTo({ top: this.current, behavior: 'instant' });
    window.requestAnimationFrame((next) => this.tick(next));
  }
}

if (
  window.theme.settings.smoothScroll &&
  document.documentElement.dataset.fx !== 'lite' &&
  window.matchMedia('(hover: hover) and (pointer: fine)').matches &&
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
  !(window.Shopify && window.Shopify.designMode)
) {
  window.theme.smoothScroll = new SmoothScroll();
}

/* Reveal sections as they enter the viewport
   ========================================================================== */
function setupReveal() {
  if (!window.theme.settings.revealAnimations || document.documentElement.dataset.fx === 'lite') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (window.Shopify && window.Shopify.designMode) return;

  const sections = Array.from(document.querySelectorAll('#MainContent > .shopify-section'));
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    },
    // Reveal slightly before the section enters the viewport so nothing looks late
    { rootMargin: '0px 0px 12% 0px', threshold: 0 }
  );

  sections.forEach((section) => {
    // Sections already on screen (above the fold) are never hidden
    if (section.getBoundingClientRect().top < window.innerHeight * 1.2) return;
    section.classList.add('reveal');
    observer.observe(section);
  });
}

setupReveal();

/* Footer menus start collapsed on small screens
   ========================================================================== */
if (window.matchMedia('(max-width: 749px)').matches) {
  document.querySelectorAll('.footer__column--collapsible[open]').forEach((column) => {
    column.removeAttribute('open');
  });
}

/* Shopify theme editor support
   ========================================================================== */
if (window.Shopify && window.Shopify.designMode) {
  document.addEventListener('shopify:section:load', (event) => {
    if (event.detail.sectionId === 'cart-drawer') return;
    const header = event.target.querySelector('sticky-header');
    if (header) header.setHeight();
  });

  document.addEventListener('shopify:section:select', (event) => {
    const drawer = event.target.querySelector('cart-drawer');
    if (drawer) drawer.open();
  });

  document.addEventListener('shopify:section:deselect', (event) => {
    const drawer = event.target.querySelector('cart-drawer');
    if (drawer) drawer.close();
  });

  document.addEventListener('shopify:block:select', (event) => {
    const slide = event.target.closest('.slider__slide');
    const slider = event.target.closest('slider-component');
    if (slide && slider && typeof slider.scrollToSlide === 'function') slider.scrollToSlide(slide);
  });
}
