/**
 * COFFEE SHOP POS — app.js
 * Full POS logic: menu, cart, payment split, receipt, item management
 */

'use strict';

// ─────────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────────

const EMOJI_MAP = {
  Espresso: '☕', Latte: '🥛', Cappuccino: '☕',
  'Cold Brew': '🧊', Mocha: '🍫', 'Green Tea': '🍵',
  'Hot Chocolate': '🍫', Americano: '☕', 'Flat White': '🥛',
  'Matcha Latte': '🍵',
};

const CAT_EMOJI = { Coffee: '☕', Tea: '🍵', Cold: '🧊', Other: '🥤' };

const DEFAULT_MENU = [
  { id: 1,  name: 'Espresso',       price: 80,  cat: 'Coffee' },
  { id: 2,  name: 'Latte',          price: 120, cat: 'Coffee' },
  { id: 3,  name: 'Cappuccino',     price: 130, cat: 'Coffee' },
  { id: 4,  name: 'Cold Brew',      price: 150, cat: 'Cold'   },
  { id: 5,  name: 'Mocha',          price: 140, cat: 'Coffee' },
  { id: 6,  name: 'Green Tea',      price: 90,  cat: 'Tea'    },
  { id: 7,  name: 'Hot Chocolate',  price: 110, cat: 'Coffee' },
  { id: 8,  name: 'Americano',      price: 100, cat: 'Coffee' },
  { id: 9,  name: 'Flat White',     price: 125, cat: 'Coffee' },
  { id: 10, name: 'Matcha Latte',   price: 160, cat: 'Tea'    },
];

// ─────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────

let menu      = loadMenu();
let cart      = [];
let activeTag = 'All';

// ─────────────────────────────────────────────────
// PERSISTENCE
// ─────────────────────────────────────────────────

function loadMenu() {
  try {
    const saved = localStorage.getItem('pos_menu');
    return saved ? JSON.parse(saved) : [...DEFAULT_MENU];
  } catch {
    return [...DEFAULT_MENU];
  }
}

function saveMenu() {
  try { localStorage.setItem('pos_menu', JSON.stringify(menu)); } catch { /* ignore */ }
}

// ─────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────

function fmt(n) {
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

function getItemEmoji(item) {
  return EMOJI_MAP[item.name] || CAT_EMOJI[item.cat] || '☕';
}

function getSubtotal() {
  return cart.reduce((sum, i) => sum + i.price * i.qty, 0);
}

function getTax() {
  return Math.round(getSubtotal() * 0.05);
}

function getGrandTotal() {
  return getSubtotal() + getTax();
}

function getCategories() {
  const cats = new Set(menu.map(m => m.cat));
  return ['All', ...cats];
}

function nowString() {
  const d = new Date();
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    + '  ·  '
    + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

// ─────────────────────────────────────────────────
// CLOCK
// ─────────────────────────────────────────────────

function startClock() {
  const el = document.getElementById('clock');
  function tick() {
    el.textContent = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
  tick();
  setInterval(tick, 1000);
}

// ─────────────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────────────

let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

// ─────────────────────────────────────────────────
// RENDER: TABS
// ─────────────────────────────────────────────────

function renderTabs() {
  const container = document.getElementById('tabs');
  container.innerHTML = '';
  getCategories().forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'tab' + (activeTag === cat ? ' active' : '');
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', activeTag === cat ? 'true' : 'false');
    btn.textContent = (CAT_EMOJI[cat] ? CAT_EMOJI[cat] + ' ' : '') + cat;
    btn.addEventListener('click', () => {
      activeTag = cat;
      renderTabs();
      renderMenu();
    });
    container.appendChild(btn);
  });
}

// ─────────────────────────────────────────────────
// RENDER: MENU
// ─────────────────────────────────────────────────

function renderMenu() {
  const grid = document.getElementById('menu-grid');
  const countEl = document.getElementById('item-count');
  const filtered = activeTag === 'All' ? menu : menu.filter(m => m.cat === activeTag);

  countEl.textContent = filtered.length + ' item' + (filtered.length !== 1 ? 's' : '');
  grid.innerHTML = '';

  if (filtered.length === 0) {
    const msg = document.createElement('p');
    msg.style.cssText = 'color: var(--muted); font-size: 13px; padding: 20px 0;';
    msg.textContent = 'No items in this category.';
    grid.appendChild(msg);
    return;
  }

  filtered.forEach((item, idx) => {
    const card = document.createElement('div');
    card.className = 'menu-card';
    card.setAttribute('role', 'listitem');
    card.style.animationDelay = `${idx * 0.035}s`;
    card.innerHTML = `
      <span class="mc-emoji" aria-hidden="true">${getItemEmoji(item)}</span>
      <div class="mc-name">${escHtml(item.name)}</div>
      <div class="mc-price">${fmt(item.price)}</div>
      <div class="mc-cat">${escHtml(item.cat)}</div>
      <button class="mc-add" aria-label="Add ${escHtml(item.name)} to order">+ Add</button>
    `;
    card.addEventListener('click', () => addToCart(item.id));
    card.querySelector('.mc-add').addEventListener('click', e => {
      e.stopPropagation();
      addToCart(item.id);
    });
    grid.appendChild(card);
  });
}

// ─────────────────────────────────────────────────
// RENDER: CART
// ─────────────────────────────────────────────────

function renderCart() {
  const body       = document.getElementById('cart-body');
  const emptyState = document.getElementById('empty-state');
  const orderSub   = document.getElementById('order-sub');
  const clearBtn   = document.getElementById('clear-cart');

  // Remove old cart items (keep empty-state node)
  Array.from(body.querySelectorAll('.cart-item')).forEach(el => el.remove());

  const totalQty = cart.reduce((s, i) => s + i.qty, 0);

  if (cart.length === 0) {
    emptyState.style.display = '';
    orderSub.textContent = 'No items yet';
    clearBtn.style.display = 'none';
  } else {
    emptyState.style.display = 'none';
    orderSub.textContent = `${totalQty} item${totalQty !== 1 ? 's' : ''}`;
    clearBtn.style.display = '';

    cart.forEach(ci => {
      const row = document.createElement('div');
      row.className = 'cart-item';
      row.setAttribute('role', 'listitem');
      row.dataset.id = ci.id;
      row.innerHTML = `
        <div class="ci-info">
          <div class="ci-name">${escHtml(ci.name)}</div>
          <div class="ci-unit">${fmt(ci.price)} each</div>
        </div>
        <div class="qty-ctrl" role="group" aria-label="Quantity for ${escHtml(ci.name)}">
          <button class="qty-btn" data-action="dec" aria-label="Decrease">−</button>
          <span class="qty-num" aria-live="polite">${ci.qty}</span>
          <button class="qty-btn" data-action="inc" aria-label="Increase">+</button>
        </div>
        <div class="ci-total">${fmt(ci.price * ci.qty)}</div>
        <button class="del-btn" aria-label="Remove ${escHtml(ci.name)}">✕</button>
      `;
      row.querySelector('[data-action="dec"]').addEventListener('click', () => changeQty(ci.id, -1));
      row.querySelector('[data-action="inc"]').addEventListener('click', () => changeQty(ci.id, +1));
      row.querySelector('.del-btn').addEventListener('click', () => removeItem(ci.id));
      body.appendChild(row);
    });
  }

  // Update summary
  document.getElementById('subtotal').textContent = fmt(getSubtotal());
  document.getElementById('tax').textContent       = fmt(getTax());
  document.getElementById('total').textContent     = fmt(getGrandTotal());

  const hasItems = cart.length > 0;
  document.getElementById('cash-input').disabled = !hasItems;
  document.getElementById('upi-input').disabled  = !hasItems;

  if (!hasItems) {
    document.getElementById('cash-input').value = '';
    document.getElementById('upi-input').value  = '';
    document.getElementById('balance-row').hidden = true;
  }

  updateBalance();
}

// ─────────────────────────────────────────────────
// BALANCE / PAY BUTTON
// ─────────────────────────────────────────────────

function updateBalance() {
  const total   = getGrandTotal();
  const cash    = parseFloat(document.getElementById('cash-input').value) || 0;
  const upi     = parseFloat(document.getElementById('upi-input').value)  || 0;
  const paid    = cash + upi;
  const balance = total - paid;
  const btn     = document.getElementById('pay-btn');
  const balRow  = document.getElementById('balance-row');
  const balLbl  = document.getElementById('balance-label');
  const balVal  = document.getElementById('balance-val');

  if (cart.length > 0 && paid > 0) {
    balRow.hidden = false;
    if (balance > 0) {
      balLbl.textContent = 'Remaining to pay';
      balVal.textContent = fmt(balance);
      balVal.className = 'owed';
    } else {
      balLbl.textContent = 'Change to return';
      balVal.textContent = fmt(-balance);
      balVal.className = 'change';
    }
  } else {
    balRow.hidden = true;
  }

  btn.disabled = cart.length === 0 || balance > 0;
}

// ─────────────────────────────────────────────────
// CART ACTIONS
// ─────────────────────────────────────────────────

function addToCart(id) {
  const item = menu.find(m => m.id === id);
  if (!item) return;
  const existing = cart.find(c => c.id === id);
  if (existing) {
    existing.qty++;
  } else {
    cart.push({ ...item, qty: 1 });
  }
  renderCart();
  showToast(`${item.name} added`);
}

function changeQty(id, delta) {
  const idx = cart.findIndex(c => c.id === id);
  if (idx < 0) return;
  cart[idx].qty += delta;
  if (cart[idx].qty <= 0) cart.splice(idx, 1);
  renderCart();
}

function removeItem(id) {
  const item = cart.find(c => c.id === id);
  cart = cart.filter(c => c.id !== id);
  renderCart();
  if (item) showToast(`${item.name} removed`);
}

function clearCart() {
  if (cart.length === 0) return;
  if (!confirm('Clear the current order?')) return;
  cart = [];
  document.getElementById('cash-input').value = '';
  document.getElementById('upi-input').value  = '';
  renderCart();
}

// ─────────────────────────────────────────────────
// PAYMENT & RECEIPT
// ─────────────────────────────────────────────────

function handlePayment() {
  const cash  = parseFloat(document.getElementById('cash-input').value) || 0;
  const upi   = parseFloat(document.getElementById('upi-input').value)  || 0;
  const total = getGrandTotal();

  if (cash + upi < total) {
    showToast('Payment is less than the total!');
    return;
  }

  const change    = Math.max(0, cash + upi - total);
  const snapCart  = [...cart];
  const subtotal  = getSubtotal();
  const tax       = getTax();

  showReceipt({ snapCart, subtotal, tax, total, cash, upi, change });

  // Reset
  cart = [];
  document.getElementById('cash-input').value = '';
  document.getElementById('upi-input').value  = '';
  renderCart();
}

function showReceipt({ snapCart, subtotal, tax, total, cash, upi, change }) {
  const modal   = document.getElementById('receipt-modal');
  const content = document.getElementById('receipt-content');

  const itemRows = snapCart.map(i => `
    <div class="r-row">
      <span>${escHtml(i.name)} &times; ${i.qty}</span>
      <span>${fmt(i.price * i.qty)}</span>
    </div>
  `).join('');

  content.innerHTML = `
    <div class="receipt-deco" aria-hidden="true"></div>
    <div class="r-shop-name">My Coffee Shop</div>
    <div class="r-date">${nowString()}</div>
    <hr class="r-divider" />
    ${itemRows}
    <hr class="r-divider" />
    <div class="r-row"><span class="r-muted">Subtotal</span><span>${fmt(subtotal)}</span></div>
    <div class="r-row"><span class="r-muted">GST (5%)</span><span>${fmt(tax)}</span></div>
    <hr class="r-divider" />
    <div class="r-total"><span>Total</span><span>${fmt(total)}</span></div>
    <hr class="r-divider" />
    <div class="r-row"><span class="r-muted">Cash</span><span>${fmt(cash)}</span></div>
    <div class="r-row"><span class="r-muted">UPI / Card</span><span>${fmt(upi)}</span></div>
    ${change > 0 ? `<div class="r-row"><span class="r-muted">Change returned</span><span>${fmt(change)}</span></div>` : ''}
    <div class="r-success">✓ Payment successful — Thank you!</div>
    <button class="r-new-btn" id="new-order-btn">Start New Order</button>
  `;

  modal.hidden = false;
  document.getElementById('new-order-btn').addEventListener('click', closeReceipt);
}

function closeReceipt() {
  document.getElementById('receipt-modal').hidden = true;
}

// ─────────────────────────────────────────────────
// ADD ITEM MODAL
// ─────────────────────────────────────────────────

function openAddModal() {
  document.getElementById('new-name').value  = '';
  document.getElementById('new-price').value = '';
  document.getElementById('new-cat').value   = 'Coffee';
  document.getElementById('add-modal').hidden = false;
  setTimeout(() => document.getElementById('new-name').focus(), 60);
}

function closeAddModal() {
  document.getElementById('add-modal').hidden = true;
}

function saveNewItem() {
  const name  = document.getElementById('new-name').value.trim();
  const price = parseInt(document.getElementById('new-price').value);
  const cat   = document.getElementById('new-cat').value;

  if (!name)            { showToast('Please enter an item name.'); return; }
  if (!price || price < 1) { showToast('Please enter a valid price.'); return; }

  const newItem = { id: Date.now(), name, price, cat };
  menu.push(newItem);
  saveMenu();

  closeAddModal();
  renderTabs();
  activeTag = cat;
  renderTabs();
  renderMenu();
  showToast(`"${name}" added to menu`);
}

// ─────────────────────────────────────────────────
// SECURITY: HTML ESCAPE
// ─────────────────────────────────────────────────

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─────────────────────────────────────────────────
// EVENT BINDINGS
// ─────────────────────────────────────────────────

function bindEvents() {
  // Header
  document.getElementById('open-add-modal').addEventListener('click', openAddModal);

  // Clear cart
  document.getElementById('clear-cart').addEventListener('click', clearCart);

  // Payment inputs
  document.getElementById('cash-input').addEventListener('input', updateBalance);
  document.getElementById('upi-input').addEventListener('input', updateBalance);

  // Pay button
  document.getElementById('pay-btn').addEventListener('click', handlePayment);

  // Add item modal
  document.getElementById('close-add-modal').addEventListener('click', closeAddModal);
  document.getElementById('save-item').addEventListener('click', saveNewItem);

  // Click outside modals to close
  document.getElementById('add-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('add-modal')) closeAddModal();
  });
  document.getElementById('receipt-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('receipt-modal')) closeReceipt();
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeAddModal();
      closeReceipt();
    }
    // Enter in add modal
    if (e.key === 'Enter' && !document.getElementById('add-modal').hidden) {
      saveNewItem();
    }
  });
}

// ─────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────

function init() {
  startClock();
  bindEvents();
  renderTabs();
  renderMenu();
  renderCart();
}

document.addEventListener('DOMContentLoaded', init);
