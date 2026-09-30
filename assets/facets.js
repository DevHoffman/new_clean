/* ==========================================================================
   New Clean — collection filtering and sorting
   Filters, sorting and pagination update the grid through the Section
   Rendering API, keeping the URL shareable and the back button working.
   ========================================================================== */
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

      // The default sort order does not need to be in the URL
      const sort = this.form.elements.namedItem('sort_by');
      if (sort && sort.options[sort.selectedIndex].defaultSelected && !window.location.search.includes('sort_by')) {
        params.delete('sort_by');
      }

      const query = params.toString();
      this.load(`${window.location.pathname}${query ? `?${query}` : ''}`);
    }

    async load(url, { push = true, scroll = false } = {}) {
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
