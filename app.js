const CONFIG = {
  WHATSAPP_NUMBER: "919876543210", 
  INSTAGRAM_HANDLE: "Kraftloom_Official",
  SHEET_API_URL: "https://script.google.com/macros/s/AKfycbyzotKONkGL8GjQgUkvi_meG2D0fxqEYsa7sbf9LB5ul0prtz2T5vQbfuPc0dV-VfBFUQ/exec", 
  EMAIL: "hello@kraftloom.com",
  SITE_URL: "https://kraftloom.com"
};

let products = [];
let cart = JSON.parse(localStorage.getItem('kraftloom_cart')) || [];

document.addEventListener('DOMContentLoaded', () => {
  initCart();
  initFilters();
  updateCartCount();
  injectModal(); 
  
  let page = window.location.pathname.split('/').pop().replace('.html', '');
  if (!page || page === '') page = 'index'; 
  
  document.querySelectorAll('.bottom-nav a').forEach(link => {
    if(link.getAttribute('href').includes(page)) link.classList.add('active');
  });
  
  if (['index', 'shop', 'product'].includes(page)) {
    fetchProducts(page);
  }
  if (page === 'custom-order') {
    initCustomOrderForm();
  }
});

function showToast(message) {
  const toast = document.getElementById('global-toast');
  if(!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

async function fetchProducts(page) {
  const cached = localStorage.getItem('kraftloom_products');
  if (cached) {
    try {
      products = JSON.parse(cached);
      if (products.length > 0) routePageLogic(page);
    } catch (e) {}
  }
  fetchDataSilently(page);
}

async function fetchDataSilently(page) {
  try {
    const res = await fetch(CONFIG.SHEET_API_URL);
    let data = await res.json();
    if (data && data.data && Array.isArray(data.data)) data = data.data;
    if (!Array.isArray(data)) data = [];

    products = data.map(p => {
      if (!p.Slug && p.Name) p.Slug = String(p.Name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
      return p;
    }).filter(p => {
      const status = String(p.Status || '').trim().toLowerCase();
      return status === 'active' || status === '' || status === 'undefined';
    });
    
    localStorage.setItem('kraftloom_products', JSON.stringify(products));
    routePageLogic(page);
  } catch (err) {
    console.error("Failed to load products", err);
  }
}

function routePageLogic(page) {
  if (page === 'index') renderHome();
  if (page === 'shop') renderShop();
  if (page === 'product') {
    const params = new URLSearchParams(window.location.search);
    if (params.get('slug')) window.location.href = `shop.html?q=${params.get('slug')}`;
  }
}

function initFilters() {
  const qInput = document.getElementById('filter-q');
  const catRadios = document.querySelectorAll('input[name="category"]');
  const sortRadios = document.querySelectorAll('input[name="sort"]');
  const toggleBtn = document.getElementById('toggle-filters-btn');
  const sidebar = document.getElementById('filters-sidebar');

  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('show');
    });
  }

  if (!qInput && catRadios.length === 0) return;

  const params = new URLSearchParams(window.location.search);
  if (qInput && params.get('q')) qInput.value = params.get('q');
  
  if (params.get('category')) {
    catRadios.forEach(r => { if (r.value === params.get('category')) r.checked = true; });
  }
  if (params.get('sort')) {
    sortRadios.forEach(r => { if (r.value === params.get('sort')) r.checked = true; });
  }

  const updateShop = () => {
    const newParams = new URLSearchParams();
    if (qInput.value) newParams.set('q', qInput.value);
    
    const activeCat = document.querySelector('input[name="category"]:checked');
    if (activeCat && activeCat.value) newParams.set('category', activeCat.value);
    
    const activeSort = document.querySelector('input[name="sort"]:checked');
    if (activeSort && activeSort.value) newParams.set('sort', activeSort.value);
    
    window.history.replaceState({}, '', `${window.location.pathname}?${newParams.toString()}`);
    renderShop();
    
    if(window.innerWidth <= 768 && sidebar) sidebar.classList.remove('show');
  };

  if (qInput) {
    qInput.addEventListener('input', () => {
      clearTimeout(qInput.timeout);
      qInput.timeout = setTimeout(updateShop, 300);
    });
  }
  catRadios.forEach(r => r.addEventListener('change', updateShop));
  sortRadios.forEach(r => r.addEventListener('change', updateShop));
}

function renderHome() {
  const featuredContainer = document.getElementById('featured-products');
  if (!featuredContainer) return;
  let featured = products.filter(p => String(p.Featured).toUpperCase() === "TRUE" || p.Featured === true).slice(0, 4);
  if (featured.length === 0) featured = products.slice(0, 4);
  featuredContainer.innerHTML = featured.map(p => createProductCard(p)).join('');
}

function renderShop() {
  const grid = document.getElementById('product-grid');
  if (!grid) return;

  const params = new URLSearchParams(window.location.search);
  const category = params.get('category') || '';
  const sort = params.get('sort') || 'newest';
  const query = params.get('q') || '';

  let filtered = [...products];

  if (category) {
    const searchCat = category.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    filtered = filtered.filter(p => {
      const pCat = String(p.Category || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      return pCat === searchCat || pCat.includes(searchCat) || searchCat.includes(pCat);
    });
  }

  if (query) {
    filtered = filtered.filter(p => String(p.Name || '').toLowerCase().includes(query.toLowerCase()));
  }

  if (sort === 'price-asc') filtered.sort((a, b) => Number(a.SalePrice || a.Price || 0) - Number(b.SalePrice || b.Price || 0));
  if (sort === 'price-desc') filtered.sort((a, b) => Number(b.SalePrice || b.Price || 0) - Number(a.SalePrice || a.Price || 0));
  if (sort === 'newest') filtered.sort((a, b) => new Date(b.DateAdded || 0) - new Date(a.DateAdded || 0));

  if (filtered.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:3rem;"><h3 style="font-family:'Playfair Display', serif; font-size:1.5rem; color:var(--brown);">No products found</h3><p>Try adjusting your filters or search term.</p></div>`;
    return;
  }
  grid.innerHTML = filtered.map(p => createProductCard(p)).join('');
}

function createProductCard(p) {
  const price = Number(p.Price || 0);
  const salePrice = Number(p.SalePrice || 0);
  const priceDisplay = salePrice ? `<span class="strike">₹${price}</span> ₹${salePrice}` : `₹${price}`;
  const badge = salePrice ? `<span class="badge">SALE</span>` : '';
  const imgUrl = formatImageUrl(p.Image1);

  return `
    <div class="product-card" onclick="openModal('${encodeURIComponent(p.Slug || '')}')">
      ${badge}
      <img src="${imgUrl}" alt="${p.Name || 'Product'}" loading="lazy">
      <h3>${p.Name || 'Product'}</h3>
      <p class="price">${priceDisplay}</p>
    </div>
  `;
}

function formatImageUrl(url) {
  if (!url) return 'assets/logo.png';
  if (url.includes('drive.google.com/file/d/')) {
    const id = url.split('/d/')[1].split('/')[0];
    return `https://drive.google.com/thumbnail?id=${id}&sz=w600`;
  }
  return url;
}

// Modal HTML with the hide-scroll utility class added
function injectModal() {
  if (document.getElementById('product-modal')) return;
  const modalHTML = `
    <div id="product-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:var(--overlay); z-index:9999; justify-content:center; align-items:flex-end;">
      
      <div id="product-modal-content" style="background:var(--bg); width:100%; max-width:600px; height:88dvh; border-radius:24px 24px 0 0; display:flex; flex-direction:column; position:relative; overflow:hidden;">
        
        <button onclick="closeModal()" style="position:absolute; top:12px; right:12px; background:rgba(255,255,255,0.9); border:none; border-radius:50%; width:36px; height:36px; font-size:1.5rem; cursor:pointer; color:var(--brown); box-shadow:var(--shadow); z-index:10; display:flex; align-items:center; justify-content:center;">&times;</button>
        
        <!-- Scrollable content without ugly scrollbar -->
        <div class="hide-scroll" style="flex:1; overflow-y:auto; display:flex; flex-direction:column;">
          <div style="height:45dvh; flex-shrink:0; background:var(--white);">
            <img id="modal-img" style="width:100%; height:100%; object-fit:cover;">
          </div>
          <div style="padding:1.5rem; background:var(--white); flex:1;">
            <span id="modal-status" style="display:inline-block; padding:4px 12px; background:#e0f2f1; color:#00695c; border-radius:20px; font-size:0.8rem; margin-bottom:1rem; font-weight:bold;"></span>
            <h2 id="modal-title" style="margin-bottom:0.5rem; font-family:'Playfair Display', serif; font-size:1.8rem; color:var(--brown); line-height:1.2;"></h2>
            <p id="modal-price" style="font-weight:700; color:var(--rose); font-size:1.3rem; margin-bottom:1rem;"></p>
            <p id="modal-desc" style="font-size:0.95rem; color:var(--brown); line-height:1.5;"></p>
          </div>
        </div>
        
        <div style="flex-shrink:0; background:var(--white); padding:12px 15px; box-shadow:0 -4px 15px rgba(0,0,0,0.05); display:flex; flex-direction:column; gap:10px; padding-bottom:calc(12px + env(safe-area-inset-bottom)); border-top: 1px solid #f0e6d8;">
           <button id="modal-btn-cart" class="btn btn-outline" style="width:100%; padding:0.75rem;">Add to Cart</button>
           <div style="display:flex; gap:10px;">
             <button id="modal-btn-wa" class="btn btn-primary" style="background:#25D366; flex:1; border:none; padding:0.75rem;">WhatsApp</button>
             <button id="modal-btn-ig" class="btn btn-primary" style="background:linear-gradient(45deg, #f09433 0%, #bc1888 100%); flex:1; border:none; padding:0.75rem;">Instagram</button>
           </div>
        </div>

      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHTML);

  document.getElementById('product-modal').addEventListener('click', (e) => {
    if(e.target.id === 'product-modal') closeModal();
  });
}

window.openModal = function(encodedSlug) {
  const slug = decodeURIComponent(encodedSlug);
  const product = products.find(p => String(p.Slug).toLowerCase() === slug.toLowerCase());
  if(!product) return;
  
  document.getElementById('modal-title').textContent = product.Name || 'Product';
  document.getElementById('modal-desc').textContent = product.Description || '';
  
  const price = Number(product.Price || 0);
  const salePrice = Number(product.SalePrice || 0);
  document.getElementById('modal-price').innerHTML = salePrice ? `<span class="strike">₹${price}</span> ₹${salePrice}` : `₹${price}`;
  
  document.getElementById('modal-status').textContent = product.Availability || 'Available';
  document.getElementById('modal-img').src = formatImageUrl(product.Image1);
  
  document.getElementById('modal-btn-wa').onclick = () => orderViaWhatsApp(product);
  document.getElementById('modal-btn-ig').onclick = () => orderViaInstagram(product);
  document.getElementById('modal-btn-cart').onclick = () => { addToCart(product); closeModal(); };
  
  const modal = document.getElementById('product-modal');
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden'; 
}

window.closeModal = function() {
  const modal = document.getElementById('product-modal');
  if(modal) {
    modal.style.display = 'none';
    document.body.style.overflow = ''; 
  }
}

function buildMessage(product) {
  const price = product.SalePrice || product.Price;
  return `Hi Kraftloom! 👋\n\nI'd like to place an order for:\n*${product.Name}*\nPrice: ₹${price}\n\nPlease let me know how to proceed with payment!`;
}

function orderViaWhatsApp(product) {
  const msg = encodeURIComponent(buildMessage(product));
  window.open(`https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${msg}`, '_blank');
}

function orderViaInstagram(product) {
  navigator.clipboard.writeText(buildMessage(product)).then(() => {
    showToast('Message copied! Paste it in the DM.');
    setTimeout(() => { window.open(`https://ig.me/m/${CONFIG.INSTAGRAM_HANDLE}`, '_blank'); }, 1500);
  });
}

function initCart() {
  const cartBtns = document.querySelectorAll('.open-cart-btn');
  const cartDrawer = document.getElementById('cart-drawer');
  const closeCart = document.getElementById('close-cart');
  const overlay = document.getElementById('overlay');
  
  const toggleCart = (e) => {
    if(e) e.preventDefault();
    if(cartDrawer) cartDrawer.classList.toggle('open');
    if(overlay) overlay.classList.toggle('show');
    if(cartDrawer.classList.contains('open')) {
       document.body.style.overflow = 'hidden';
    } else {
       document.body.style.overflow = '';
    }
    renderCartItems();
  };

  cartBtns.forEach(btn => btn.addEventListener('click', toggleCart));
  if(closeCart) closeCart.addEventListener('click', toggleCart);
  if(overlay) overlay.addEventListener('click', toggleCart);

  const checkoutWa = document.getElementById('checkout-wa');
  if(checkoutWa) checkoutWa.addEventListener('click', () => sendCart('whatsapp'));
  
  const checkoutIg = document.getElementById('checkout-ig');
  if(checkoutIg) checkoutIg.addEventListener('click', () => sendCart('instagram'));
}

function addToCart(product) {
  const existing = cart.find(i => i.Slug === product.Slug);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ ...product, qty: 1 });
  }
  localStorage.setItem('kraftloom_cart', JSON.stringify(cart));
  updateCartCount();
  showToast(`${product.Name} added to cart!`);
}

window.updateQty = function(index, delta) {
  if (cart[index]) {
    cart[index].qty += delta;
    if (cart[index].qty <= 0) cart.splice(index, 1);
    localStorage.setItem('kraftloom_cart', JSON.stringify(cart));
    updateCartCount();
    renderCartItems();
  }
};

function updateCartCount() {
  const count = cart.reduce((sum, item) => sum + item.qty, 0);
  document.querySelectorAll('.cart-badge').forEach(el => el.textContent = count);
}

function renderCartItems() {
  const container = document.getElementById('cart-items-container');
  if (!container) return;
  
  let total = 0;
  if (cart.length === 0) {
    container.innerHTML = '<p style="text-align:center; margin-top:2rem;">Your cart is empty.</p>';
  } else {
    container.innerHTML = cart.map((item, index) => {
      const price = item.SalePrice || item.Price;
      total += price * item.qty;
      return `
        <div class="cart-item" style="display:flex; gap:15px; margin-bottom:15px; background:var(--white); padding:10px; border-radius:8px; border:1px solid #f0e6d8;">
          <img src="${formatImageUrl(item.Image1)}" alt="${item.Name}" style="width:70px; height:70px; object-fit:cover; border-radius:6px;">
          <div style="flex:1;">
            <h4 style="font-size:0.95rem; margin-bottom:4px; font-family:'Nunito', sans-serif;">${item.Name}</h4>
            <p style="font-size:0.95rem; font-weight:700; color:var(--rose); margin-bottom:8px;">₹${price}</p>
            <div style="display:flex; align-items:center;">
              <div style="display:flex; align-items:center; border:1px solid var(--blush); border-radius:4px; overflow:hidden;">
                <button onclick="updateQty(${index}, -1)" style="background:var(--bg); border:none; padding:2px 12px; cursor:pointer; color:var(--brown); font-weight:bold; font-size:1.1rem;">-</button>
                <span style="font-size:0.95rem; padding:0 12px; background:var(--white); min-width:30px; text-align:center;">${item.qty}</span>
                <button onclick="updateQty(${index}, 1)" style="background:var(--bg); border:none; padding:2px 12px; cursor:pointer; color:var(--brown); font-weight:bold; font-size:1.1rem;">+</button>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }
  
  const totalEl = document.getElementById('cart-total');
  if(totalEl) totalEl.textContent = `Total: ₹${total}`;
}

function sendCart(platform) {
  if (cart.length === 0) return;
  let text = `Hi Kraftloom! 👋\n\nI'd like to place an order for the items in my cart:\n\n`;
  let total = 0;
  cart.forEach(i => {
    const p = i.SalePrice || i.Price;
    total += p * i.qty;
    text += `▪️ *${i.Name}* (Qty: ${i.qty}) - ₹${p * i.qty}\n`;
  });
  text += `\n*Total: ₹${total}*\n\nPlease let me know how to proceed with payment!`;
  
  if (platform === 'whatsapp') {
    const msg = encodeURIComponent(text);
    window.open(`https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${msg}`, '_blank');
  } else if (platform === 'instagram') {
    navigator.clipboard.writeText(text).then(() => {
      showToast('Cart list copied! Paste it in the DM.');
      setTimeout(() => { window.open(`https://ig.me/m/${CONFIG.INSTAGRAM_HANDLE}`, '_blank'); }, 1500);
    });
  }
}

// Custom Order Form with WhatsApp Automation
function initCustomOrderForm() {
  const form = document.getElementById('custom-form');
  if (!form) return;
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (form.honeypot && form.honeypot.value) return; 
    
    const btn = form.querySelector('button[type="submit"]');
    if(btn) { btn.textContent = 'Submitting...'; btn.disabled = true; }

    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());
    
    // Format the deeply detailed WhatsApp payload
    const waPayloadText = encodeURIComponent(
      `Hi Kraftloom! 👋\n\nI just submitted a custom order request on the website. Here are my details:\n\n` +
      `*Name:* ${payload.name}\n` +
      `*Category:* ${payload.orderType}\n` +
      `*Colors/Theme:* ${payload.colors || 'Not specified'}\n` +
      `*Description:* ${payload.description}\n` +
      `*Needed By:* ${payload.neededBy || 'Flexible timeline'}\n` +
      `*Budget:* ${payload.budget || 'Not specified'}\n\n` +
      `Looking forward to discussing this!`
    );

    try {
      await fetch(CONFIG.SHEET_API_URL, { method: 'POST', body: JSON.stringify(payload) });
      const successDiv = document.getElementById('form-success');
      if (successDiv) successDiv.style.display = 'block';
      form.style.display = 'none';
      
      const continueBtn = document.getElementById('continue-wa');
      if (continueBtn) {
        continueBtn.onclick = () => {
          window.open(`https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${waPayloadText}`, '_blank');
        };
      }
    } catch(err) {
      showToast('Error submitting form. Please try again.');
      if(btn) { btn.textContent = 'Send My Request'; btn.disabled = false; }
    }
  });
}
