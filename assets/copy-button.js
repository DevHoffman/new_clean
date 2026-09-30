/* ==========================================================================
   <copy-button data-value="text to copy" data-success="Copied!">
     <button type="button"><span data-copy-label>Copy</span></button>
   </copy-button>
   Copies `data-value` to the clipboard and gives visual + screen reader
   feedback. Used by the article share links and the gift card page.
   ========================================================================== */

if (!customElements.get('copy-button')) {
  class CopyButton extends HTMLElement {
    connectedCallback() {
      this.button = this.querySelector('button');
      this.label = this.querySelector('[data-copy-label]');
      if (!this.button) return;

      this.defaultLabel = this.label ? this.label.textContent : '';
      this.onClick = this.onClick.bind(this);
      this.button.addEventListener('click', this.onClick);
    }

    disconnectedCallback() {
      if (this.button) this.button.removeEventListener('click', this.onClick);
      window.clearTimeout(this.timer);
    }

    async onClick() {
      const value = this.dataset.value || window.location.href;

      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(value);
        } else {
          this.legacyCopy(value);
        }
        this.showFeedback();
      } catch (error) {
        this.legacyCopy(value);
        this.showFeedback();
      }
    }

    legacyCopy(value) {
      const field = document.createElement('textarea');
      field.value = value;
      field.setAttribute('readonly', '');
      field.style.position = 'fixed';
      field.style.opacity = '0';
      document.body.appendChild(field);
      field.select();
      document.execCommand('copy');
      field.remove();
      this.button.focus();
    }

    showFeedback() {
      const message = this.dataset.success || '';
      this.classList.add('is-copied');
      if (this.label && message) this.label.textContent = message;

      const region = document.getElementById('LiveRegion');
      if (region && message) region.textContent = message;

      window.clearTimeout(this.timer);
      this.timer = window.setTimeout(() => {
        this.classList.remove('is-copied');
        if (this.label) this.label.textContent = this.defaultLabel;
        if (region) region.textContent = '';
      }, 2500);
    }
  }

  customElements.define('copy-button', CopyButton);
}
