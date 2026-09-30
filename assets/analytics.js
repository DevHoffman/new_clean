/* ==========================================================================
   New Clean — analytics events (dataLayer / GA4 naming)
   Shopify's own pixel (checkout, purchase) keeps working; these events cover
   what happens inside the theme. Nothing is sent anywhere by this file: it
   only feeds window.dataLayer, which GTM (loaded after consent) reads.
   ========================================================================== */
(() => {
  window.dataLayer = window.dataLayer || [];
  const push = (payload) => window.dataLayer.push(payload);

  const pageType = ((document.body.className.match(/template-([a-z0-9-]+)/) || [])[1] || 'unknown').replace(/--.*/, '');
  const sectionName = (section) =>
    section
      ? section.id
          .replace(/^shopify-section-/, '')
          .replace(/^(template|sections)--\d*_*/, '')
          .replace(/^[^_]*__/, '')
          .replace(/_/g, '-')
      : 'page';

  /* Cart
     ------------------------------------------------------------------------ */
  document.addEventListener('product:added', (event) => {
    push({
      event: 'add_to_cart',
      page_type: pageType,
      ecommerce: {
        currency: 'BRL',
        items: (event.detail.items || []).map((item) => ({ item_variant: String(item.id), quantity: item.quantity })),
      },
    });
  });

  document.addEventListener('cart:updated', (event) => {
    if (event.detail.action !== 'add') return;
    push({ event: 'cart_updated', cart_count: event.detail.count });
  });

  document.addEventListener('modal:open', (event) => {
    if (event.target.matches && event.target.matches('cart-drawer')) push({ event: 'view_cart', page_type: pageType });
  });

  /* Clicks (one delegated listener)
     ------------------------------------------------------------------------ */
  const contactLocation = (element) => {
    if (element.closest('.help')) return 'help_widget';
    if (element.closest('.hero')) return 'hero';
    if (element.closest('product-info')) return 'product';
    if (element.closest('.footer')) return 'footer';
    if (element.closest('.b2b-cta')) return 'b2b_cta';
    if (element.closest('.quick-order')) return 'quick_order';
    return sectionName(element.closest('.shopify-section'));
  };

  const PROMO_SECTIONS = '.hero, .promo-banner, .b2b-cta, .category-tiles, .shop-by-concern, .brand-list, .trust-bar';

  document.addEventListener(
    'click',
    (event) => {
      const target = event.target;
      if (!target || !target.closest) return;

      // Removing a line from the cart
      const remove = target.closest('[data-cart-remove]');
      if (remove) push({ event: 'remove_from_cart', item_key: remove.dataset.cartRemove, page_type: pageType });

      // WhatsApp / phone / e-mail: the leads of a distributor
      const link = target.closest('a[href]');
      if (link) {
        const href = link.getAttribute('href') || '';
        const method = /^https:\/\/wa\.me\//.test(href) ? 'whatsapp' : href.startsWith('tel:') ? 'phone' : href.startsWith('mailto:') ? 'email' : null;
        if (method) push({ event: 'contact_click', method, location: contactLocation(link), page_type: pageType });
      }

      // Product card → select_item
      const card = target.closest('.product-card[data-product-id]');
      if (card && link && !target.closest('button, input, quantity-input')) {
        const list = sectionName(card.closest('.shopify-section'));
        push({
          event: 'select_item',
          item_list_name: list,
          page_type: pageType,
          ecommerce: {
            item_list_name: list,
            items: [{ item_id: card.dataset.productId, item_name: card.dataset.productName, price: Number(card.dataset.productPrice) }],
          },
        });
      }

      // Banners and blocks that promote something → select_promotion
      const promo = link && link.closest(PROMO_SECTIONS);
      if (promo) {
        push({
          event: 'select_promotion',
          promotion_name: sectionName(promo.closest('.shopify-section')),
          creative_name: (link.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80),
          page_type: pageType,
        });
      }

      // Going to pay (the real begin_checkout comes from Shopify's pixel)
      const checkout = target.closest('button[name="checkout"], .cart-summary__actions a[href$="/cart"]');
      if (checkout) push({ event: 'checkout_click', page_type: pageType, source: checkout.closest('cart-drawer') ? 'drawer' : 'page' });

      // Help centre
      if (target.closest('.help__toggle')) {
        window.setTimeout(() => {
          const widget = document.querySelector('help-widget');
          if (widget && widget.classList.contains('is-open')) push({ event: 'help_open', page_type: pageType });
        }, 0);
      }
    },
    true
  );

  window.addEventListener('quick-order:added', () => push({ event: 'quick_order_add', page_type: pageType }));

  /* Search
     ------------------------------------------------------------------------ */
  document.addEventListener('submit', (event) => {
    const form = event.target;
    if (!form || !form.matches || !form.matches('form[role="search"]')) return;
    const input = form.querySelector('input[name="q"]');
    if (input && input.value.trim()) push({ event: 'search', search_term: input.value.trim(), page_type: pageType });
  });

  if (pageType === 'search') {
    const results = document.querySelector('[data-results-count]');
    const term = new URLSearchParams(window.location.search).get('q');
    if (term) {
      push({
        event: 'view_search_results',
        search_term: term,
        results_count: results ? Number(results.dataset.resultsCount) : undefined,
        page_type: pageType,
      });
    }
  }

  /* Visibility: sections, product lists and scroll depth
     ------------------------------------------------------------------------ */
  if (!('IntersectionObserver' in window)) return;

  // Sections hidden by their own settings render an empty wrapper: ignore them
  const sections = Array.from(document.querySelectorAll('#MainContent > .shopify-section')).filter((section) => section.children.length > 0);
  const seenSections = new Set();
  const seenLists = new Set();

  const sectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting || seenSections.has(entry.target)) return;
        seenSections.add(entry.target);
        push({
          event: 'section_view',
          section_name: sectionName(entry.target),
          section_position: sections.indexOf(entry.target) + 1,
          page_type: pageType,
        });

        // Product lists also report their items (GA4 view_item_list)
        const cards = Array.from(entry.target.querySelectorAll('.product-card[data-product-id]'));
        if (cards.length && !seenLists.has(entry.target)) {
          seenLists.add(entry.target);
          const list = sectionName(entry.target);
          push({
            event: 'view_item_list',
            item_list_name: list,
            page_type: pageType,
            ecommerce: {
              item_list_name: list,
              items: cards.slice(0, 12).map((card, index) => ({
                item_id: card.dataset.productId,
                item_name: card.dataset.productName,
                price: Number(card.dataset.productPrice),
                index,
              })),
            },
          });
        }
      });
    },
    { threshold: 0.25 }
  );
  sections.forEach((section) => sectionObserver.observe(section));

  const reached = new Set();
  const thresholds = [25, 50, 75, 90];
  let frame = null;
  window.addEventListener(
    'scroll',
    () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        if (max <= 0) return;
        const percent = (window.scrollY / max) * 100;
        thresholds.forEach((step) => {
          if (percent >= step && !reached.has(step)) {
            reached.add(step);
            push({ event: 'scroll_depth', percent: step, page_type: pageType });
          }
        });
      });
    },
    { passive: true }
  );
})();
