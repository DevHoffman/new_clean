/* ==========================================================================
   <customer-addresses>
   Toggles the add/edit address forms, fills the province select from the
   `data-provinces` attribute of the selected country option and confirms
   address deletion. Works without Shopify's shopify_common.js.
   ========================================================================== */

if (!customElements.get('customer-addresses')) {
  class CustomerAddresses extends HTMLElement {
    connectedCallback() {
      this.onClick = this.onClick.bind(this);
      this.onChange = this.onChange.bind(this);
      this.onSubmit = this.onSubmit.bind(this);

      this.addEventListener('click', this.onClick);
      this.addEventListener('change', this.onChange);
      this.addEventListener('submit', this.onSubmit);

      this.querySelectorAll('select[data-country-select]').forEach((select) => {
        this.selectDefault(select);
        this.populateProvinces(select, true);
      });

      // Forms rendered open by Liquid (validation errors) need matching ARIA state
      this.querySelectorAll('[data-address-form].is-open').forEach((form) => this.syncState(form, true));
    }

    disconnectedCallback() {
      this.removeEventListener('click', this.onClick);
      this.removeEventListener('change', this.onChange);
      this.removeEventListener('submit', this.onSubmit);
    }

    onClick(event) {
      const toggle = event.target.closest('[data-address-toggle]');
      if (!toggle || !this.contains(toggle)) return;

      const form = document.getElementById(toggle.getAttribute('aria-controls'));
      if (!form) return;

      event.preventDefault();
      const open = !form.classList.contains('is-open');
      form.classList.toggle('is-open', open);
      this.syncState(form, open);

      if (open) {
        const firstField = form.querySelector('input:not([type="hidden"]), select, textarea');
        if (firstField) firstField.focus();
      } else {
        const opener = this.querySelector(`[data-address-toggle][aria-expanded][aria-controls="${form.id}"]`);
        if (opener) opener.focus();
      }
    }

    onChange(event) {
      if (event.target.matches('select[data-country-select]')) {
        this.populateProvinces(event.target, false);
      }
    }

    onSubmit(event) {
      const form = event.target.closest('form[data-address-delete]');
      if (!form) return;

      const message = form.dataset.confirm;
      // eslint-disable-next-line no-alert
      if (message && !window.confirm(message)) event.preventDefault();
    }

    syncState(form, open) {
      this.querySelectorAll(`[data-address-toggle][aria-expanded][aria-controls="${form.id}"]`).forEach((button) => {
        button.setAttribute('aria-expanded', String(open));
      });

      const item = form.closest('[data-address-item]');
      if (item) item.classList.toggle('has-open-form', open);
    }

    selectDefault(select) {
      const value = select.dataset.default;
      if (!value) return;

      const option = Array.from(select.options).find((item) => item.value === value || item.textContent.trim() === value);
      if (option) select.value = option.value;
    }

    populateProvinces(countrySelect, useDefault) {
      const provinceSelect = document.getElementById(countrySelect.dataset.provinceTarget);
      if (!provinceSelect) return;

      const field = provinceSelect.closest('[data-province-field]') || provinceSelect;
      const selected = countrySelect.options[countrySelect.selectedIndex];
      let provinces = [];

      try {
        provinces = JSON.parse((selected && selected.dataset.provinces) || '[]');
      } catch (error) {
        provinces = [];
      }

      provinceSelect.textContent = '';

      if (!Array.isArray(provinces) || provinces.length === 0) {
        field.hidden = true;
        provinceSelect.disabled = true;
        return;
      }

      provinces.forEach((province) => {
        const [value, label] = Array.isArray(province) ? province : [province, province];
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label || value;
        provinceSelect.appendChild(option);
      });

      field.hidden = false;
      provinceSelect.disabled = false;

      if (useDefault && provinceSelect.dataset.default) {
        const wanted = provinceSelect.dataset.default;
        const match = Array.from(provinceSelect.options).find(
          (item) => item.value === wanted || item.textContent.trim() === wanted
        );
        if (match) provinceSelect.value = match.value;
      }
    }
  }

  customElements.define('customer-addresses', CustomerAddresses);
}
