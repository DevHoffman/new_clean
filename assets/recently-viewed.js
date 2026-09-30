/* ==========================================================================
   New Clean — recently viewed products
   Product ids are stored locally by product.js; the list is rendered by the
   search endpoint through the Section Rendering API.
   ========================================================================== */
if (!customElements.get('recently-viewed')) {
  class RecentlyViewed extends HTMLElement {
    connectedCallback() {
      const currentId = this.dataset.productId;
      const limit = parseInt(this.dataset.limit, 10) || 8;
      const ids = this.read()
        .filter((id) => id !== currentId)
        .slice(0, limit);

      if (!ids.length) return;

      const observer = new IntersectionObserver(
        (entries) => {
          if (!entries[0].isIntersecting) return;
          observer.disconnect();
          this.load(ids);
        },
        { rootMargin: '0px 0px 600px 0px' }
      );
      observer.observe(this);
    }

    read() {
      try {
        const value = JSON.parse(window.localStorage.getItem('newclean:recently-viewed'));
        return Array.isArray(value) ? value : [];
      } catch (error) {
        return [];
      }
    }

    async load(ids) {
      const params = new URLSearchParams({
        q: ids.map((id) => `id:${id}`).join(' OR '),
        type: 'product',
        section_id: this.dataset.sectionId,
      });

      try {
        const response = await fetch(`${this.dataset.searchUrl}?${params}`);
        if (!response.ok) throw new Error(response.status);
        const html = new DOMParser().parseFromString(await response.text(), 'text/html');
        const source = html.querySelector('[data-recently-viewed-content]');
        if (!source || !source.querySelector('.product-card')) return;

        // Search results come back by relevance; restore the viewing order
        const list = source.querySelector('[data-recently-viewed-list]');
        if (list) {
          Array.from(list.children)
            .sort((a, b) => ids.indexOf(a.dataset.productId) - ids.indexOf(b.dataset.productId))
            .forEach((item) => list.appendChild(item));
        }

        this.querySelector('[data-recently-viewed-content]').innerHTML = source.innerHTML;
        this.closest('[data-recently-viewed-section]').hidden = false;
      } catch (error) {
        // Leave the section hidden
      }
    }
  }

  customElements.define('recently-viewed', RecentlyViewed);
}
