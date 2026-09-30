/* Accessible tabs (WAI-ARIA tabs pattern, automatic activation) */
if (!customElements.get('tabs-component')) {
  class TabsComponent extends HTMLElement {
    connectedCallback() {
      this.tablist = this.querySelector('[role="tablist"]');
      if (!this.tablist) return;

      this.tablist.addEventListener('click', (event) => {
        const tab = event.target.closest('[role="tab"]');
        if (tab) this.select(tab);
      });

      this.tablist.addEventListener('keydown', (event) => this.onKeydown(event));

      // Theme editor: show the tab being edited
      this.addEventListener('shopify:block:select', (event) => {
        const tab = event.target.closest('[role="tab"]');
        if (tab) this.select(tab);
      });
    }

    get tabs() {
      return Array.from(this.tablist.querySelectorAll('[role="tab"]'));
    }

    onKeydown(event) {
      const tabs = this.tabs;
      const index = tabs.indexOf(document.activeElement);
      if (index === -1) return;

      const rtl = getComputedStyle(this.tablist).direction === 'rtl';
      let next = null;

      switch (event.key) {
        case 'ArrowRight':
          next = index + (rtl ? -1 : 1);
          break;
        case 'ArrowLeft':
          next = index + (rtl ? 1 : -1);
          break;
        case 'Home':
          next = 0;
          break;
        case 'End':
          next = tabs.length - 1;
          break;
        default:
          return;
      }

      event.preventDefault();
      const tab = tabs[(next + tabs.length) % tabs.length];
      this.select(tab);
      tab.focus();
    }

    select(selected) {
      this.tabs.forEach((tab) => {
        const active = tab === selected;
        tab.setAttribute('aria-selected', active ? 'true' : 'false');
        if (active) tab.removeAttribute('tabindex');
        else tab.setAttribute('tabindex', '-1');

        const panel = document.getElementById(tab.getAttribute('aria-controls'));
        if (panel) panel.hidden = !active;
      });

      if (typeof selected.scrollIntoView === 'function') {
        selected.scrollIntoView({ block: 'nearest', inline: 'center' });
      }

      this.dispatchEvent(new CustomEvent('tabs:change', { bubbles: true, detail: { tab: selected } }));
    }
  }

  customElements.define('tabs-component', TabsComponent);
}
