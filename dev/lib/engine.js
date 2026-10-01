/*
 * LiquidJS configured to behave like Shopify's Liquid for this theme:
 * Shopify filters, the section/sections/form/paginate/style tags and the
 * rendering of JSON templates and section groups.
 *
 * This is an approximation for local preview. `shopify theme dev` remains
 * the reference for how the theme renders on the real store.
 */
const fs = require('fs');
const path = require('path');
const { Liquid, Value, Drop } = require('liquidjs');
const store = require('./store');

const THEME = process.env.THEME_DIR ? path.resolve(process.env.THEME_DIR) : path.join(__dirname, '..', '..');
const LOCALE = 'pt-BR';

const readTheme = (file) => fs.readFileSync(path.join(THEME, file), 'utf8');
const readThemeJson = (file) => JSON.parse(readTheme(file).replace(/^\s*\/\*[\s\S]*?\*\//, ''));

const escapeHtml = (value) =>
  String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/* Filters receive keyword arguments as [key, value] pairs */
const kwargs = (args) =>
  args.reduce((result, arg) => {
    if (Array.isArray(arg) && arg.length === 2 && typeof arg[0] === 'string') result[arg[0]] = arg[1];
    return result;
  }, {});

const attributes = (map) =>
  Object.entries(map)
    .filter(([, value]) => value !== undefined && value !== null && value !== false)
    .map(([key, value]) => (value === true ? ` ${key}` : ` ${key}="${escapeHtml(value)}"`))
    .join('');

/* Settings helpers
   ========================================================================== */
class ColorDrop extends Drop {
  constructor(hex) {
    super();
    this.hex = hex;
    const clean = hex.replace('#', '');
    const full = clean.length === 3 ? clean.replace(/./g, '$&$&') : clean;
    this.red = parseInt(full.slice(0, 2), 16);
    this.green = parseInt(full.slice(2, 4), 16);
    this.blue = parseInt(full.slice(4, 6), 16);
    this.alpha = 1;
  }

  valueOf() {
    return this.hex;
  }

  toString() {
    return this.hex;
  }
}

const FONT_STACKS = {
  montserrat: ['Montserrat', 'sans-serif'],
  inter: ['Inter', 'sans-serif'],
  dm_sans: ['"DM Sans"', 'sans-serif'],
  playfair_display: ['"Playfair Display"', 'serif'],
};

function fontObject(handle) {
  const match = String(handle).match(/^(.*)_([ni])(\d)$/) || [null, handle, 'n', '4'];
  const [family, fallback] = FONT_STACKS[match[1]] || [`"${match[1].replace(/_/g, ' ')}"`, 'sans-serif'];
  return {
    handle,
    family,
    fallback_families: fallback,
    weight: Number(match[3]) * 100,
    style: match[2] === 'i' ? 'italic' : 'normal',
    'system?': false,
    google_name: family.replace(/"/g, ''),
  };
}

const resolveUrl = (value) => {
  if (typeof value !== 'string') return value;
  const match = value.match(/^shopify:\/\/(collections|products|pages|blogs)\/?(.*)$/);
  if (!match) return value;
  return match[2] ? `/${match[1]}/${match[2]}` : `/${match[1]}`;
};

function resolveSetting(definition, value, resources) {
  if (value === undefined) value = definition.default;
  if (value === undefined || value === null) value = '';
  switch (definition.type) {
    case 'color':
    case 'color_background':
      return value ? new ColorDrop(value) : null;
    case 'font_picker':
      return fontObject(value);
    case 'collection':
      return value ? store.getCollection(value) : null;
    case 'collection_list':
      return (value || []).map((handle) => store.getCollection(handle)).filter(Boolean);
    case 'product':
      return value ? store.productsByHandle.get(value) || null : null;
    case 'product_list':
      return (value || []).map((handle) => store.productsByHandle.get(handle)).filter(Boolean);
    case 'link_list':
      return value ? resources.linklists[value] || { title: '', links: [] } : null;
    case 'page':
      return value ? resources.pages[value] || null : null;
    case 'url':
      return resolveUrl(value);
    case 'image_picker':
    case 'video':
    case 'blog':
    case 'article':
      return null;
    case 'number':
    case 'range':
      return value === '' ? null : Number(value);
    default:
      return value;
  }
}

function resolveSettings(definitions, values, resources) {
  const result = {};
  (definitions || []).forEach((definition) => {
    if (!definition.id) return;
    result[definition.id] = resolveSetting(definition, (values || {})[definition.id], resources);
  });
  return result;
}

/* Translations
   ========================================================================== */
let translations = null;
let translationsStamp = 0;
const missingTranslations = new Set();

function loadTranslations() {
  const file = path.join(THEME, 'locales', `${LOCALE}.default.json`);
  const stamp = fs.statSync(file).mtimeMs;
  if (!translations || stamp !== translationsStamp) {
    translations = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\s*\/\*[\s\S]*?\*\//, ''));
    translationsStamp = stamp;
    missingTranslations.clear();
  }
  return translations;
}

function translate(key, params) {
  translations = loadTranslations();
  let node = String(key)
    .split('.')
    .reduce((current, part) => (current && typeof current === 'object' ? current[part] : undefined), translations);

  if (node && typeof node === 'object' && params.count !== undefined) {
    node = Number(params.count) === 1 ? node.one : node.other;
  }
  if (typeof node !== 'string') {
    if (!missingTranslations.has(key)) {
      missingTranslations.add(key);
      console.warn(`  ! tradução ausente: ${key}`);
    }
    return `translation missing: ${LOCALE}.${key}`;
  }
  // Like Shopify: everything is escaped unless the key ends with _html
  const html = /_html$/.test(key);
  return node.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name) => {
    const value = params[name] !== undefined ? String(params[name]) : '';
    return html ? value : escapeHtml(value);
  });
}

/* Money
   ========================================================================== */
function formatAmount(cents) {
  const value = Number(cents) || 0;
  const [whole, fraction] = (Math.abs(value) / 100).toFixed(2).split('.');
  return `${value < 0 ? '-' : ''}${whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${fraction}`;
}

const money = (cents) => `R$ ${formatAmount(cents)}`;

/* Images
   ========================================================================== */
function imageOf(input) {
  if (!input) return null;
  if (input.preview_image) return input.preview_image;
  if (input.featured_media) return input.featured_media.preview_image;
  if (input.featured_image) return input.featured_image;
  if (input.image && input.image.src) return input.image;
  if (input.src) return input;
  return null;
}

function sizedUrl(src, width, height) {
  const url = new URL(src.startsWith('//') ? `https:${src}` : src, 'http://localhost');
  if (width) url.searchParams.set('width', Math.round(width));
  if (height) url.searchParams.set('height', Math.round(height));
  return src.startsWith('/') && !src.startsWith('//') ? url.pathname + url.search : url.toString();
}

function placeholderSvg(name, className) {
  return `<svg class="${escapeHtml(className || 'placeholder-svg')}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 525 525" preserveAspectRatio="xMidYMid slice" aria-hidden="true" data-placeholder="${escapeHtml(name)}"><rect width="525" height="525" fill="currentColor" opacity=".08"/><path d="M190 210h145v130H190zM210 210v-25a52 52 0 0 1 105 0v25" fill="none" stroke="currentColor" stroke-width="8" opacity=".35"/></svg>`;
}

/* Engine
   ========================================================================== */
function createEngine() {
  const engine = new Liquid({
    root: [path.join(THEME, 'snippets'), path.join(THEME, 'sections')],
    partials: [path.join(THEME, 'snippets')],
    extname: '.liquid',
    cache: false,
    strictFilters: true,
    strictVariables: false,
    lenientIf: true,
    relativeReference: false,
    timezoneOffset: 180,
  });

  const filter = (name, fn) => engine.registerFilter(name, fn);

  filter('t', (key, ...args) => translate(key, kwargs(args)));
  filter('json', (value) => JSON.stringify(value === undefined ? null : serializable(value)));
  filter('money', money);
  filter('money_with_currency', (cents) => `${money(cents)} BRL`);
  filter('money_without_currency', formatAmount);
  filter('money_without_trailing_zeros', (cents) => money(cents).replace(/,00$/, ''));
  filter('handle', store.handleize);
  filter('handleize', store.handleize);

  filter('asset_url', (name) => `/assets/${name}`);
  filter('asset_img_url', (name) => `/assets/${name}`);
  filter('shopify_asset_url', (name) => `https://cdn.shopify.com/s/shopify/${name}`);
  filter('stylesheet_tag', (url) => `<link href="${escapeHtml(url)}" rel="stylesheet" type="text/css" media="all">`);
  filter('script_tag', (url) => `<script src="${escapeHtml(url)}"></script>`);
  filter('preload_tag', (url, ...args) => (url ? `<link rel="preload" href="${escapeHtml(url)}"${attributes(kwargs(args))}>` : ''));

  filter('image_url', (input, ...args) => {
    const options = kwargs(args);
    const image = imageOf(input);
    if (!image) return null;
    const url = new String(sizedUrl(image.src, options.width, options.height)); // eslint-disable-line no-new-wrappers
    url.image = image;
    url.requestedWidth = options.width;
    return url;
  });
  filter('img_url', (input) => {
    const image = imageOf(input);
    return image ? image.src : null;
  });

  filter('image_tag', (input, ...args) => {
    if (!input) return '';
    const options = kwargs(args);
    const image = input.image || null;
    const src = String(input);
    const base = src.replace(/([?&])(width|height)=\d+&?/g, '$1').replace(/[?&]$/, '');
    const maxWidth = image ? image.width : Infinity;

    const { widths, preload, ...rest } = options;
    let srcset;
    if (widths) {
      const list = String(widths)
        .split(',')
        .map((item) => parseInt(item, 10))
        .filter((width) => width && width <= maxWidth);
      if (image && !list.includes(image.width) && image.width < 5000) list.push(image.width);
      srcset = list.map((width) => `${sizedUrl(base, width)} ${width}w`).join(', ');
    }

    const width = rest.width || (image ? Math.min(input.requestedWidth || image.width, image.width) : undefined);
    const height = rest.height || (image && width ? Math.round(width / image.aspect_ratio) : undefined);
    delete rest.width;
    delete rest.height;
    const alt = rest.alt !== undefined && rest.alt !== null ? rest.alt : image ? image.alt : '';
    delete rest.alt;

    return `<img${attributes({ src, alt: alt || '', srcset, width, height, ...rest })}>`;
  });

  filter('placeholder_svg_tag', (name, className) => placeholderSvg(name, className));
  /*
   * Stand-ins for Shopify's official payment brand images (rendered by the
   * platform on the real store). Simplified marks, preview only.
   */
  filter('payment_type_svg_tag', (type) => {
    const badge = (inner, label) =>
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 38 24" width="38" height="24" role="img" aria-label="${escapeHtml(label)}"><rect x=".5" y=".5" width="37" height="23" rx="3" fill="#fff" stroke="#d0dcee"/>${inner}</svg>`;
    switch (String(type)) {
      case 'visa':
        return badge('<text x="19" y="16" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-style="italic" font-weight="900" font-size="11" fill="#1A1F71">VISA</text>', 'Visa');
      case 'master':
      case 'mastercard':
        return badge('<circle cx="15" cy="12" r="7" fill="#EB001B"/><circle cx="23" cy="12" r="7" fill="#F79E1B" fill-opacity=".92"/>', 'Mastercard');
      case 'elo':
        return badge('<circle cx="19" cy="12" r="7.5" fill="#111"/><path d="M19 4.5a7.5 7.5 0 0 1 6.9 4.6l-3.6 1.5A3.6 3.6 0 0 0 19 8.4z" fill="#FFCB05"/><path d="M12.1 9.1a7.5 7.5 0 0 1 6.9-4.6v3.9a3.6 3.6 0 0 0-3.3 2.2z" fill="#00A4E0"/><path d="M19 19.5a7.5 7.5 0 0 1-7.1-5.1l3.7-1.2a3.6 3.6 0 0 0 3.4 2.4z" fill="#EF4123"/>', 'Elo');
      case 'american_express':
      case 'amex':
        return badge('<rect x="2" y="2" width="34" height="20" rx="2" fill="#2E77BC"/><text x="19" y="15.5" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" font-size="7.5" fill="#fff">AMEX</text>', 'American Express');
      case 'hipercard':
        return badge('<rect x="2" y="2" width="34" height="20" rx="2" fill="#B3131B"/><text x="19" y="15" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" font-size="6" fill="#fff">Hipercard</text>', 'Hipercard');
      case 'diners_club':
        return badge('<circle cx="19" cy="12" r="7" fill="none" stroke="#0079BE" stroke-width="2.5"/><rect x="16" y="8" width="6" height="8" rx="1" fill="#0079BE"/>', 'Diners Club');
      case 'pix':
        return badge('<g transform="translate(7 3) scale(0.75)" fill="#32BCAD"><path d="M17.3 17.1a2.7 2.7 0 0 1-1.9-.8l-2.8-2.8a.5.5 0 0 0-.7 0l-2.8 2.8a2.7 2.7 0 0 1-1.9.8h-.5l3.5 3.5a2.8 2.8 0 0 0 4 0l3.5-3.5h-.4zM7.2 6.9c.7 0 1.4.3 1.9.8l2.8 2.8c.2.2.5.2.7 0l2.8-2.8a2.7 2.7 0 0 1 1.9-.8h.4l-3.5-3.5a2.8 2.8 0 0 0-4 0L6.7 6.9h.5zm13.4 3.1l-2.1-2.1h-1.2c-.5 0-1 .2-1.3.5l-2.8 2.8a1.5 1.5 0 0 1-2.2 0L8.2 8.4c-.3-.3-.8-.5-1.3-.5H5.5l-2.1 2.1a2.8 2.8 0 0 0 0 4l2.1 2.1h1.4c.5 0 1-.2 1.3-.5l2.8-2.8a1.6 1.6 0 0 1 2.2 0l2.8 2.8c.3.3.8.5 1.3.5h1.2l2.1-2.1a2.8 2.8 0 0 0 0-4z"/></g><text x="30" y="15.5" text-anchor="middle" font-family="Arial, sans-serif" font-size="7" font-weight="700" fill="#0d1f3c">Pix</text>', 'Pix');
      case 'boleto':
        return badge('<g fill="#0d1f3c"><rect x="6" y="6" width="1.5" height="12"/><rect x="9" y="6" width="1" height="12"/><rect x="11.5" y="6" width="2" height="12"/><rect x="15" y="6" width="1" height="12"/><rect x="17.5" y="6" width="1.5" height="12"/><rect x="20.5" y="6" width="1" height="12"/><rect x="23" y="6" width="2" height="12"/><rect x="26.5" y="6" width="1" height="12"/><rect x="29" y="6" width="1.5" height="12"/><rect x="32" y="6" width="1" height="12"/></g>', 'Boleto');
      default: {
        const label = String(type).replace(/_/g, ' ').toUpperCase();
        return badge(`<text x="19" y="15" text-anchor="middle" font-family="Arial, sans-serif" font-size="6.5" font-weight="700" fill="#0d1f3c">${escapeHtml(label.slice(0, 8))}</text>`, label);
      }
    }
  });
  filter('payment_button', () => '');
  filter('structured_data', (product) =>
    JSON.stringify({
      '@context': 'http://schema.org/',
      '@type': 'Product',
      name: product && product.title,
      url: product && product.url,
      offers: product
        ? [{ '@type': 'Offer', price: (product.price / 100).toFixed(2), priceCurrency: 'BRL', availability: product.available ? 'InStock' : 'OutOfStock' }]
        : [],
    })
  );

  filter('font_face', () => '');
  filter('font_url', () => '');
  filter('font_modify', (font, property, value) => {
    if (!font) return font;
    const copy = { ...font };
    if (property === 'weight') copy.weight = value === 'bold' ? 700 : value === 'normal' ? 400 : Number(value) || font.weight;
    if (property === 'style') copy.style = value;
    return copy;
  });

  filter('metafield_tag', (value) => (value && value.value ? String(value.value) : ''));
  filter('default_errors', (errors) =>
    errors && errors.messages ? `<ul>${Object.values(errors.messages).map((message) => `<li>${escapeHtml(message)}</li>`).join('')}</ul>` : ''
  );
  filter('time_tag', (value, format) => {
    const date = value === 'now' ? new Date() : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return `<time datetime="${date.toISOString()}">${date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}</time>`;
  });
  filter('format_address', (address) =>
    address ? [address.address1, address.city, address.province, address.zip].filter(Boolean).map(escapeHtml).join('<br>') : ''
  );
  filter('format_code', (code) => String(code || '').replace(/(.{4})/g, '$1 ').trim());
  filter('external_video_url', () => '');
  filter('external_video_tag', () => '');
  filter('video_tag', () => '');
  filter('link_to', (text, url) => `<a href="${escapeHtml(url)}">${text}</a>`);
  filter('pluralize', (count, one, other) => (Number(count) === 1 ? one : other));
  filter('highlight', (text) => text);

  registerTags(engine);
  return engine;
}

/* Remove functions/cycles before serialising Liquid objects to JSON */
function serializable(value, depth = 0) {
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof String) return String(value);
  if (value instanceof ColorDrop) return value.hex;
  if (depth > 4) return null;
  if (Array.isArray(value)) return value.map((item) => serializable(item, depth + 1));
  const result = {};
  Object.entries(value).forEach(([key, item]) => {
    if (key === 'collections' || key === 'product' || key === 'variant' || typeof item === 'function') return;
    result[key] = serializable(item, depth + 1);
  });
  return result;
}

/* Tags
   ========================================================================== */
function splitArgs(text) {
  const parts = [];
  let current = '';
  let quote = null;
  for (const char of text) {
    if (quote) {
      if (char === quote) quote = null;
      current += char;
    } else if (char === '"' || char === "'") {
      quote = char;
      current += char;
    } else if (char === ',') {
      parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function blockTag(endName, extra) {
  return {
    parse(token, remainTokens) {
      this.args = token.args;
      this.templates = [];
      const stream = this.liquid.parser
        .parseStream(remainTokens)
        .on(`tag:${endName}`, () => stream.stop())
        .on('template', (template) => this.templates.push(template))
        .on('end', () => {
          throw new Error(`tag ${token.getText()} not closed`);
        });
      stream.start();
      if (extra && extra.parse) extra.parse.call(this, token);
    },
    render: extra.render,
  };
}

function registerTags(engine) {
  // {% schema %}, {% stylesheet %}, {% javascript %}: never rendered
  ['schema', 'stylesheet', 'javascript'].forEach((name) => {
    engine.registerTag(name, {
      parse(token, remainTokens) {
        // Raw content: consume tokens until the closing tag without parsing them
        while (remainTokens.length) {
          const next = remainTokens.shift();
          if (next.name === `end${name}`) return;
        }
        throw new Error(`tag ${token.getText()} not closed`);
      },
      render() {
        return '';
      },
    });
  });

  engine.registerTag('layout', {
    parse() {},
    render() {
      return '';
    },
  });

  engine.registerTag(
    'style',
    blockTag('endstyle', {
      *render(ctx, emitter) {
        emitter.write('<style data-shopify>');
        yield this.liquid.renderer.renderTemplates(this.templates, ctx, emitter);
        emitter.write('</style>');
      },
    })
  );

  engine.registerTag('section', {
    parse(token) {
      this.name = token.args.trim().replace(/^['"]|['"]$/g, '');
    },
    *render(ctx, emitter) {
      const request = ctx.globals.__request;
      const html = yield renderSection(this.liquid, request, { id: this.name, type: this.name, settings: {} });
      emitter.write(html);
    },
  });

  engine.registerTag('sections', {
    parse(token) {
      this.name = token.args.trim().replace(/^['"]|['"]$/g, '');
    },
    *render(ctx, emitter) {
      const request = ctx.globals.__request;
      const html = yield renderGroup(this.liquid, request, this.name);
      emitter.write(html);
    },
  });

  engine.registerTag(
    'form',
    blockTag('endform', {
      *render(ctx, emitter) {
        const parts = splitArgs(this.args);
        const type = parts.shift().replace(/^['"]|['"]$/g, '');
        const attrs = {};
        let target = null;
        for (const part of parts) {
          const match = part.match(/^([\w-]+)\s*:\s*(.+)$/);
          if (match) {
            attrs[match[1]] = yield new Value(match[2], this.liquid).value(ctx);
          } else {
            target = yield new Value(part, this.liquid).value(ctx);
          }
        }

        const routes = {
          product: '/cart/add',
          cart: '/cart',
          customer: '/contact#contact_form',
          contact: '/contact#contact_form',
          customer_login: '/account/login',
          create_customer: '/account',
          recover_customer_password: '/account/recover',
          reset_customer_password: '/account/reset',
          activate_customer_password: '/account/activate',
          customer_address: '/account/addresses',
          localization: '/localization',
          storefront_password: '/password',
          new_comment: '#comments',
          guest_login: '/account/login',
        };

        const formAttributes = {
          method: 'post',
          action: routes[type] || '/',
          id: attrs.id === null ? undefined : attrs.id,
          'accept-charset': 'UTF-8',
          enctype: type === 'product' ? 'multipart/form-data' : undefined,
        };
        Object.entries(attrs).forEach(([key, value]) => {
          if (key !== 'id' && key !== 'return_to') formAttributes[key] = value;
        });

        emitter.write(`<form${attributes(formAttributes)}>`);
        emitter.write(`<input type="hidden" name="form_type" value="${escapeHtml(type)}"><input type="hidden" name="utf8" value="✓">`);

        const request = ctx.globals.__request;
        const posted = request.postedForm;
        const errorMessages = { customer_login: 'E-mail ou senha incorretos. Conta de teste: cliente@newclean.test / newclean123' };
        const failed = request.formError === type && errorMessages[type];
        const form = {
          errors: failed ? { messages: { form: errorMessages[type] }, size: 1, form: errorMessages[type] } : null,
          'posted_successfully?': Boolean(posted && posted === type),
          id: attrs.id,
          email: '',
          // Classic customer accounts ask for a password
          password_needed: true,
          set_as_default_checkbox: '<input type="checkbox" name="address[default]" value="1">',
        };
        if (type === 'customer_address' && target) Object.assign(form, target);

        ctx.push({ form });
        yield this.liquid.renderer.renderTemplates(this.templates, ctx, emitter);
        ctx.pop();
        emitter.write('</form>');
      },
    })
  );

  engine.registerTag(
    'paginate',
    blockTag('endpaginate', {
      *render(ctx, emitter) {
        const match = this.args.match(/^(.+?)\s+by\s+(.+?)(?:\s*,.*)?$/);
        if (!match) throw new Error(`paginate: invalid arguments "${this.args}"`);
        const expression = match[1].trim();
        const items = (yield new Value(expression, this.liquid).value(ctx)) || [];
        const pageSize = Math.max(1, Number(yield new Value(match[2].trim(), this.liquid).value(ctx)) || 20);

        const request = ctx.globals.__request;
        const total = items.length;
        const pages = Math.max(1, Math.ceil(total / pageSize));
        const current = Math.min(pages, Math.max(1, parseInt(request.query.get('page'), 10) || 1));

        const pageUrl = (number) => {
          const params = new URLSearchParams();
          request.query.forEach((value, key) => {
            if (key !== 'page' && key !== 'section_id') params.append(key, value);
          });
          if (number > 1) params.set('page', number);
          const text = params.toString();
          return text ? `${request.pathname}?${text}` : request.pathname;
        };

        const parts = [];
        const window = 2;
        for (let number = 1; number <= pages; number += 1) {
          const near = Math.abs(number - current) <= window;
          if (number === 1 || number === pages || near) {
            parts.push({ title: number, url: pageUrl(number), is_link: number !== current });
          } else if (parts.length && parts[parts.length - 1].title !== '…') {
            parts.push({ title: '…', is_link: false });
          }
        }

        const paginate = {
          current_page: current,
          current_offset: (current - 1) * pageSize,
          items: total,
          page_size: pageSize,
          pages,
          parts,
          previous: current > 1 ? { title: '«', url: pageUrl(current - 1), is_link: true } : null,
          next: current < pages ? { title: '»', url: pageUrl(current + 1), is_link: true } : null,
        };

        // Swap the paginated array for the current page while the block renders
        const segments = expression.split('.');
        const property = segments.pop();
        const parent = segments.length ? yield new Value(segments.join('.'), this.liquid).value(ctx) : null;
        const slice = items.slice(paginate.current_offset, paginate.current_offset + pageSize);

        if (parent && typeof parent === 'object') {
          const original = parent[property];
          parent[property] = slice;
          ctx.push({ paginate });
          try {
            yield this.liquid.renderer.renderTemplates(this.templates, ctx, emitter);
          } finally {
            ctx.pop();
            parent[property] = original;
          }
        } else {
          ctx.push({ paginate, [property]: slice });
          yield this.liquid.renderer.renderTemplates(this.templates, ctx, emitter);
          ctx.pop();
        }
      },
    })
  );
}

/* Sections
   ========================================================================== */
const schemaCache = new Map();

function sectionSchema(type) {
  const file = path.join(THEME, 'sections', `${type}.liquid`);
  const stamp = fs.statSync(file).mtimeMs;
  const cached = schemaCache.get(type);
  if (cached && cached.stamp === stamp) return cached.schema;

  const source = fs.readFileSync(file, 'utf8');
  const match = source.match(/\{%-?\s*schema\s*-?%\}([\s\S]*?)\{%-?\s*endschema\s*-?%\}/);
  const schema = match ? JSON.parse(match[1]) : {};
  schemaCache.set(type, { stamp, schema });
  return schema;
}

async function renderSection(engine, request, config, groupName) {
  const file = path.join(THEME, 'sections', `${config.type}.liquid`);
  if (!fs.existsSync(file)) {
    return `<div class="shopify-section"><p style="padding:16px;color:#c62828">Seção não encontrada: ${escapeHtml(config.type)}</p></div>`;
  }
  if (config.disabled) return '';

  const schema = sectionSchema(config.type);
  const resources = request.resources;
  const blockDefinitions = schema.blocks || [];

  // Static sections fall back to the blocks declared in the schema `default`
  let blockOrder = config.block_order;
  let blockMap = config.blocks;
  if (!blockMap && schema.default && schema.default.blocks && !config.fromTemplate) {
    blockMap = {};
    blockOrder = schema.default.blocks.map((block, index) => {
      blockMap[`default-${index}`] = block;
      return `default-${index}`;
    });
  }

  const blocks = (blockOrder || Object.keys(blockMap || {}))
    .map((id) => ({ id, ...(blockMap || {})[id] }))
    .filter((block) => block.type && !block.disabled)
    .map((block) => {
      const definition = blockDefinitions.find((item) => item.type === block.type) || {};
      return {
        id: block.id,
        type: block.type,
        settings: resolveSettings(definition.settings, block.settings, resources),
        shopify_attributes: `data-shopify-editor-block="${escapeHtml(block.id)}"`,
      };
    });

  const section = {
    id: config.id,
    type: config.type,
    settings: resolveSettings(schema.settings, config.settings, resources),
    blocks,
    index: config.index || 0,
    index0: (config.index || 1) - 1,
    location: groupName || 'template',
  };

  let body;
  try {
    body = await engine.renderFile(`${config.type}.liquid`, { section }, { globals: request.globals });
  } catch (error) {
    console.error(`  ✗ erro em sections/${config.type}.liquid: ${error.message}`);
    body = `<pre style="margin:16px;padding:16px;border:2px solid #c62828;border-radius:8px;white-space:pre-wrap;color:#c62828;background:#fff">Liquid error (sections/${escapeHtml(config.type)}): ${escapeHtml(error.message)}</pre>`;
  }

  const tag = schema.tag || 'div';
  const classes = ['shopify-section'];
  if (groupName) classes.push(`shopify-section-group-${groupName}`);
  if (schema.class) classes.push(schema.class);
  return `<${tag} id="shopify-section-${escapeHtml(config.id)}" class="${classes.join(' ')}">${body}</${tag}>`;
}

async function renderGroup(engine, request, name) {
  const group = readThemeJson(`sections/${name}.json`);
  const parts = [];
  for (const id of group.order || []) {
    const config = group.sections[id];
    parts.push(await renderSection(engine, request, { ...config, id: `sections--${name}__${id}`, fromTemplate: true }, name));
  }
  return parts.join('\n');
}

/* Finds a section by the id used in the rendered page (template or group) */
function findSectionConfig(request, sectionId) {
  const template = request.template;
  if (template && template.json) {
    const entries = template.json.order || [];
    for (let index = 0; index < entries.length; index += 1) {
      const key = entries[index];
      if (`template--${template.name}__${key}` === sectionId || key === sectionId) {
        return { ...template.json.sections[key], id: `template--${template.name}__${key}`, index: index + 1, fromTemplate: true };
      }
    }
  }
  // Endpoints such as /recommendations/products have no page template of
  // their own: resolve `template--<name>__<key>` straight from the id.
  const parsed = String(sectionId).match(/^template--(.+?)__(.+)$/);
  if (parsed) {
    const file = path.join(THEME, 'templates', `${parsed[1].replace(/^customers-/, 'customers/')}.json`);
    if (fs.existsSync(file)) {
      const json = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (json.sections && json.sections[parsed[2]]) {
        return { ...json.sections[parsed[2]], id: sectionId, fromTemplate: true };
      }
    }
  }

  for (const name of ['header-group', 'footer-group']) {
    const group = readThemeJson(`sections/${name}.json`);
    for (const key of group.order || []) {
      if (`sections--${name}__${key}` === sectionId) {
        return { ...group.sections[key], id: sectionId, group: name, fromTemplate: true };
      }
    }
  }
  if (fs.existsSync(path.join(THEME, 'sections', `${sectionId}.liquid`))) {
    return { id: sectionId, type: sectionId, settings: {} };
  }
  return null;
}

async function renderTemplate(engine, request) {
  const { template } = request;
  if (template.html) return template.html;
  if (!template.json) return '';
  const parts = [];
  const order = template.json.order || [];
  for (let index = 0; index < order.length; index += 1) {
    const key = order[index];
    const config = template.json.sections[key];
    parts.push(
      await renderSection(engine, request, {
        ...config,
        id: `template--${template.name}__${key}`,
        index: index + 1,
        fromTemplate: true,
      })
    );
  }
  return parts.join('\n');
}

async function renderPage(engine, request, contentForHeader) {
  const content = await renderTemplate(engine, request);
  const layout = request.template.layout || 'theme';
  return engine.parseAndRender(
    readTheme(`layout/${layout}.liquid`),
    { content_for_layout: content, content_for_header: contentForHeader },
    { globals: request.globals }
  );
}

function themeSettings(resources) {
  const schema = readThemeJson('config/settings_schema.json');
  let data = {};
  try {
    const raw = readThemeJson('config/settings_data.json');
    data = typeof raw.current === 'object' ? raw.current : {};
  } catch (error) {
    data = {};
  }
  const definitions = schema.flatMap((group) => group.settings || []);
  return resolveSettings(definitions, data, resources);
}

module.exports = {
  THEME,
  createEngine,
  renderPage,
  renderSection,
  findSectionConfig,
  themeSettings,
  readThemeJson,
  readTheme,
  escapeHtml,
  translate,
  money,
};
