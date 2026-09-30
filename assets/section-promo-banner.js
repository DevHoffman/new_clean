/* Copy coupon code to the clipboard */
if (!customElements.get('copy-code')) {
  class CopyCode extends HTMLElement {
    connectedCallback() {
      this.button = this.querySelector('[data-copy-button]');
      this.label = this.querySelector('[data-copy-label]');
      if (!this.button) return;
      this.defaultLabel = this.label ? this.label.textContent : '';
      this.button.addEventListener('click', () => this.copy());
    }

    disconnectedCallback() {
      window.clearTimeout(this.timer);
    }

    async copy() {
      const code = this.dataset.code || '';
      if (!code) return;

      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(code);
        } else {
          this.fallbackCopy(code);
        }
        this.confirm();
      } catch (error) {
        try {
          this.fallbackCopy(code);
          this.confirm();
        } catch (fallbackError) {
          // Nothing else to do: the code stays visible and selectable
        }
      }
    }

    fallbackCopy(code) {
      const field = document.createElement('textarea');
      field.value = code;
      field.setAttribute('readonly', '');
      field.style.position = 'fixed';
      field.style.opacity = '0';
      document.body.appendChild(field);
      field.select();
      const copied = document.execCommand('copy');
      field.remove();
      this.button.focus({ preventScroll: true });
      if (!copied) throw new Error('Copy failed');
    }

    confirm() {
      const message = this.dataset.copiedLabel || '';
      if (this.label && message) this.label.textContent = message;
      this.classList.add('is-copied');

      const announce = window.theme && window.theme.utils && window.theme.utils.announce;
      if (announce && message) announce(message);

      window.clearTimeout(this.timer);
      this.timer = window.setTimeout(() => {
        if (this.label) this.label.textContent = this.defaultLabel;
        this.classList.remove('is-copied');
      }, 2500);
    }
  }

  customElements.define('copy-code', CopyCode);
}
