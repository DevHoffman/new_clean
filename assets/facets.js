/* ==========================================================================
   New Clean — collection filtering and sorting
   Filters, sorting and pagination update the grid through the Section
   Rendering API, keeping the URL shareable and the back button working.
   ========================================================================== */
/* ==========================================================================
   Price range: two thumbs on one track, plus editable min/max boxes.
   Only the boxes are submitted; an untouched end stays empty, so it adds no
   filter to the URL.
   ========================================================================== */
if (!customElements.get('price-range')) {
  class PriceRange extends HTMLElement {
    connectedCallback() {
      this.limit = Number(this.dataset.max) || 0;
      this.thumbs = { min: this.querySelector('[data-thumb="min"]'), max: this.querySelector('[data-thumb="max"]') };
      this.fields = { min: this.querySelector('[data-field="min"]'), max: this.querySelector('[data-field="max"]') };
      this.fill = this.querySelector('[data-fill]');
      if (!this.thumbs.min || !this.thumbs.max || !this.fields.min || !this.fields.max) return;

      ['min', 'max'].forEach((side) => {
        this.thumbs[side].addEventListener('input', () => this.onSlide(side));
        // Releasing the thumb (or a key press) applies the filter
        this.thumbs[side].addEventListener('change', () => this.fields[side].dispatchEvent(new Event('change', { bubbles: true })));
        this.fields[side].addEventListener('input', () => this.onType(side));
      });
      this.paint();
    }

    get low() {
      return Number(this.thumbs.min.value);
    }

    get high() {
      return Number(this.thumbs.max.value);
    }

    onSlide(side) {
      // The thumbs may touch but never cross
      if (side === 'min' && this.low > this.high) this.thumbs.min.value = this.high;
      if (side === 'max' && this.high < this.low) this.thumbs.max.value = this.low;
      this.fields.min.value = this.low <= 0 ? '' : this.low;
      this.fields.max.value = this.high >= this.limit ? '' : this.high;
      this.paint();
    }

    onType(side) {
      const typed = this.fields[side].value;
      if (typed === '') this.thumbs[side].value = side === 'min' ? 0 : this.limit;
      else this.thumbs[side].value = Math.min(Math.max(Number(typed), 0), this.limit);
      this.paint();
    }

    paint() {
      const share = (value) => (this.limit ? (value / this.limit) * 100 : 0);
      this.style.setProperty('--from', `${share(this.low)}%`);
      this.style.setProperty('--to', `${share(this.high)}%`);
      // When both thumbs sit at the far right the lower one must stay reachable
      this.thumbs.min.style.zIndex = this.low >= this.limit * 0.98 ? 3 : 2;
    }
  }

  customElements.define('price-range', PriceRange);
}

if (!customElements.get('facet-filters')) {
  class FacetFilters extends HTMLElement {
    connectedCallback() {
      this.sectionId = this.dataset.sectionId;
      this.form = this.querySelector('[data-facets-form]');
      if (!this.form) return;

      this.cache = new Map();
      const { debounce } = window.theme.utils;

      this.form.addEventListener('submit', (event) => {
        event.preventDefault();
        this.submit();
      });

      // Fields live outside the <form> element and are tied to it by the
      // `form` attribute, so their events do not bubble through the form.
      const onChange = debounce(() => this.submit(), 350);
      this.addEventListener('change', (event) => {
        if (event.target.form === this.form) onChange();
      });

      this.addEventListener('click', (event) => {
        const link = event.target.closest('[data-facet-link], .pagination a');
        if (!link) return;
        event.preventDefault();
        const url = new URL(link.href);
        this.load(url.pathname + url.search, { scroll: link.closest('.pagination') !== null });
      });

      this.onPopState = () => this.load(window.location.pathname + window.location.search, { push: false });
      window.addEventListener('popstate', this.onPopState);

      this.applyDefaultSort();
    }

    /* Shopify only sorts by what the URL says or by the collection's own
       setting, so when the store wants another default (best sellers first)
       the page asks for it once, without adding a history entry. */
    applyDefaultSort() {
      const wanted = this.dataset.defaultSort;
      const sort = this.form.elements.namedItem('sort_by');
      if (!wanted || wanted === this.dataset.collectionSort || !sort) return;
      const params = new URLSearchParams(window.location.search);
      if (params.has('sort_by') || !Array.from(sort.options).some((option) => option.value === wanted)) return;
      params.set('sort_by', wanted);
      this.load(`${window.location.pathname}?${params.toString()}`, { push: false, replace: true });
    }

    disconnectedCallback() {
      window.removeEventListener('popstate', this.onPopState);
    }

    submit() {
      const data = new FormData(this.form);
      const params = new URLSearchParams();
      data.forEach((value, key) => {
        if (value !== '') params.append(key, value);
      });

      const query = params.toString();
      this.load(`${window.location.pathname}${query ? `?${query}` : ''}`);
    }

    async load(url, { push = true, replace = false, scroll = false } = {}) {
      if (this.controller) this.controller.abort();
      this.controller = new AbortController();
      this.classList.add('is-loading');

      const separator = url.includes('?') ? '&' : '?';
      const requestUrl = `${url}${separator}section_id=${this.sectionId}`;

      try {
        let markup = this.cache.get(requestUrl);
        if (!markup) {
          const response = await fetch(requestUrl, { signal: this.controller.signal });
          if (!response.ok) throw new Error(response.status);
          markup = await response.text();
          this.cache.set(requestUrl, markup);
        }
        this.render(markup);
        if (push) window.history.pushState({}, '', url);
        else if (replace) window.history.replaceState({}, '', url);
        if (scroll) {
          const results = this.querySelector('[data-region="results"]');
          if (results) results.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      } catch (error) {
        if (error.name !== 'AbortError') window.location.href = url;
      } finally {
        this.classList.remove('is-loading');
      }
    }

    render(markup) {
      const html = window.theme.utils.parseHTML(markup);
      const openGroups = Array.from(this.querySelectorAll('.facets__group')).reduce((state, group) => {
        state[group.id] = group.open;
        return state;
      }, {});
      const focusedId = document.activeElement && this.contains(document.activeElement) ? document.activeElement.id : null;
      const focusedName = document.activeElement && document.activeElement.name;
      const focusedValue = document.activeElement && document.activeElement.value;

      this.querySelectorAll('[data-region]').forEach((region) => {
        const source = html.querySelector(`facet-filters [data-region="${region.dataset.region}"]`);
        if (source) region.innerHTML = source.innerHTML;
      });

      const sort = this.querySelector('[name="sort_by"]');
      const newSort = html.querySelector('facet-filters [name="sort_by"]');
      if (sort && newSort) sort.value = newSort.value;

      // Keep the groups the customer opened or closed as they were
      Object.entries(openGroups).forEach(([id, open]) => {
        const group = id ? document.getElementById(id) : null;
        if (group) group.open = open;
      });

      // Restore focus for keyboard users
      let target = focusedId ? document.getElementById(focusedId) : null;
      if (!target && focusedName) {
        target = Array.from(this.querySelectorAll(`[name="${focusedName}"]`)).find((el) => el.value === focusedValue);
      }
      if (target) target.focus({ preventScroll: true });
    }
  }

  customElements.define('facet-filters', FacetFilters);
}
