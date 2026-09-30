/* Instant filter for the collection list (works on the collections shown in the page) */
class CollectionFilter extends HTMLElement {
  connectedCallback() {
    this.input = this.querySelector('[data-filter-input]');
    this.empty = this.querySelector('[data-filter-empty]');
    this.items = Array.from(document.querySelectorAll('.main-list-collections__grid > li[data-collection-title]'));
    if (!this.input) return;
    this.input.addEventListener('input', () => this.filter());
  }

  normalize(text) {
    return String(text).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  filter() {
    const query = this.normalize(this.input.value.trim());
    let visible = 0;
    this.items.forEach((item) => {
      const match = !query || this.normalize(item.dataset.collectionTitle).includes(query);
      item.hidden = !match;
      if (match) visible += 1;
    });
    if (this.empty) this.empty.hidden = visible > 0;
  }
}

if (!customElements.get('collection-filter')) customElements.define('collection-filter', CollectionFilter);
