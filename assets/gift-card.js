/* ==========================================================================
   Gift card page
   <gift-card-qr> renders the QR code with Shopify's vendor/qrcode.js (loaded
   with `defer` right before this file). <print-button> opens the print dialog.
   ========================================================================== */

if (!customElements.get('gift-card-qr')) {
  class GiftCardQr extends HTMLElement {
    connectedCallback() {
      const identifier = this.dataset.identifier;
      if (!identifier || typeof window.QRCode !== 'function' || this.childElementCount > 0) {
        if (!identifier || typeof window.QRCode !== 'function') this.hidden = true;
        return;
      }

      // eslint-disable-next-line no-new
      new window.QRCode(this, {
        text: identifier,
        width: 120,
        height: 120,
        imageAltText: this.dataset.alt || ''
      });
    }
  }

  customElements.define('gift-card-qr', GiftCardQr);
}

if (!customElements.get('print-button')) {
  class PrintButton extends HTMLElement {
    connectedCallback() {
      this.button = this.querySelector('button');
      if (!this.button) return;
      this.onClick = () => window.print();
      this.button.addEventListener('click', this.onClick);
    }

    disconnectedCallback() {
      if (this.button) this.button.removeEventListener('click', this.onClick);
    }
  }

  customElements.define('print-button', PrintButton);
}
