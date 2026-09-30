/* ==========================================================================
   New Clean — quick order page
   Search-and-add table plus a pasted list ("produto, quantidade" per line).
   ========================================================================== */
if (!customElements.get('quick-order')) {
  class QuickOrder extends HTMLElement {
    connectedCallback() {
      const { debounce, announce, parseHTML } = window.theme.utils;
      this.parseHTML = parseHTML;
      this.announce = announce;

      this.searchForm = this.querySelector('[data-quick-order-search]');
      this.searchInput = this.searchForm.querySelector('input');
      this.searchTarget = this.querySelector('[data-quick-order-target]');
      this.listForm = this.querySelector('[data-quick-order-list]');
      this.listTarget = this.querySelector('[data-quick-order-list-target]');
      this.addAll = this.querySelector('[data-quick-order-add-all]');

      this.searchForm.addEventListener('submit', (event) => event.preventDefault());
      this.searchInput.addEventListener(
        'input',
        debounce(() => this.search(this.searchInput.value, this.searchTarget), 300)
      );
      this.listForm.addEventListener('submit', (event) => {
        event.preventDefault();
        this.findList();
      });
      this.addAll.addEventListener('click', () => this.addRows(Array.from(this.listTarget.querySelectorAll('[data-quick-order-row]:not(.is-added)')), this.addAll));

      this.addEventListener('click', (event) => {
        const button = event.target.closest('[data-quick-order-add]');
        if (!button) return;
        this.addRows([button.closest('[data-quick-order-row]')], button);
      });
    }

    async fetchResults(terms) {
      const params = new URLSearchParams({ q: terms, type: 'product', section_id: 'quick-order-results', 'options[prefix]': 'last' });
      const response = await fetch(`${this.dataset.searchUrl}?${params}`);
      if (!response.ok) throw new Error(response.status);
      const html = this.parseHTML(await response.text());
      return html.querySelector('[data-quick-order-results]');
    }

    async search(terms, target) {
      const query = terms.trim();
      if (query.length < 2) {
        target.innerHTML = '';
        return;
      }
      if (this.controller) this.controller.abort();
      this.controller = new AbortController();
      this.classList.add('is-loading');
      try {
        const results = await this.fetchResults(query);
        if (this.searchInput.value.trim() !== query) return;
        target.innerHTML = results ? results.innerHTML : '';
      } catch (error) {
        if (error.name !== 'AbortError') target.innerHTML = `<p class="text-small text-muted">${window.theme.strings.cartError}</p>`;
      } finally {
        this.classList.remove('is-loading');
      }
    }

    /* One line per item: "papel toalha, 10" / "papel toalha 10" / "papel toalha" */
    async findList() {
      const textarea = this.listForm.querySelector('textarea');
      const button = this.listForm.querySelector('[type="submit"]');
      const lines = textarea.value
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 40);
      if (!lines.length) return;

      button.classList.add('is-loading');
      this.listTarget.innerHTML = '';
      this.addAll.hidden = true;

      for (const line of lines) {
        const match = line.match(/^(.*?)[\s,;x]+(\d+)\s*(?:un|unid|cx|pc)?\.?$/i);
        const terms = (match ? match[1] : line).trim();
        const quantity = match ? Math.max(1, parseInt(match[2], 10)) : 1;
        try {
          const results = await this.fetchResults(terms);
          const row = results && results.querySelector('[data-quick-order-row]');
          if (row) {
            const input = row.querySelector('[data-quick-order-quantity]');
            if (input) input.value = quantity;
            row.insertAdjacentHTML('beforeend', `<p class="quick-order__requested">${window.theme.strings.quickOrderRequested.replace('[line]', this.escape(line))}</p>`);
            this.listTarget.appendChild(row);
          } else {
            this.listTarget.insertAdjacentHTML('beforeend', `<div class="quick-order__row"><p class="quick-order__meta" style="grid-column: 1 / -1">${window.theme.strings.quickOrderNotFound.replace('[line]', this.escape(line))}</p></div>`);
          }
        } catch (error) {
          // Skip the line and keep going
        }
      }
      button.classList.remove('is-loading');
      this.addAll.hidden = !this.listTarget.querySelector('[data-quick-order-add]');
    }

    async addRows(rows, button) {
      const items = rows
        .filter((row) => row && row.dataset.variantId)
        .map((row) => {
          const input = row.querySelector('[data-quick-order-quantity]');
          return { id: parseInt(row.dataset.variantId, 10), quantity: Math.max(1, parseInt(input ? input.value : 1, 10) || 1), row };
        });
      if (!items.length) return;

      button.classList.add('is-loading');
      try {
        await window.theme.cart.add(items.map(({ id, quantity }) => ({ id, quantity })), this);
        items.forEach(({ row }) => {
          row.classList.add('is-added');
          const add = row.querySelector('[data-quick-order-add]');
          if (add) {
            add.classList.add('button--secondary');
            add.querySelector('.button__label').textContent = window.theme.strings.quickOrderAdded;
          }
        });
        this.announce(window.theme.strings.added);
        if (button === this.addAll) this.addAll.hidden = true;
        window.dispatchEvent(new CustomEvent('quick-order:added'));
      } catch (error) {
        this.announce(error.message);
        window.alert(error.message);
      } finally {
        button.classList.remove('is-loading');
      }
    }

    escape(text) {
      return String(text).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
    }
  }

  customElements.define('quick-order', QuickOrder);
}
