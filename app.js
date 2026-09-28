const CONFIG = {
  WHATSAPP_NUMBER: "919876543210", 
  INSTAGRAM_HANDLE: "Kraftloom_Official",
  SHEET_API_URL: "https://script.google.com/macros/s/AKfycbyzotKONkGL8GjQgUkvi_meG2D0fxqEYsa7sbf9LB5ul0prtz2T5vQbfuPc0dV-VfBFUQ/exec", 
  EMAIL: "hello@kraftloom.com",
  SITE_URL: "https://kraftloom.com"
};

// State
let products = [];
let cart = JSON.parse(localStorage.getItem('kraftloom_cart')) || [];

// Initialization
document.addEventListener('DOMContentLoaded', () => {
  initNav();
  initCart();
  initFilters(); // Added for instant filtering
  updateCartCount();
  
  let page = window.location.pathname.split('/').pop().replace('.html', '');
  if (!page || page === '') page = 'index'; 
  
  if (['index', 'shop', 'product'].includes(page)) {
    fetchProducts(page);
  }
  if (page === 'custom-order') {
    initCustomOrderForm();
  }
});

// UI & Nav
function initNav() {
  const hamburger = document.querySelector('.hamburger');
  const navLinks = document.querySelector('.nav-links');
  if(hamburger && navLinks) {
    hamburger.addEventListener('click', () => {
      navLinks.classList.toggle('active');
    });
  }
}

function showToast(message) {
  const toast = document.getElementById('global-toast');
  if(!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// Data Fetching
async function fetchProducts(page) {
  await fetchDataSilently(page);
}

async function fetchDataSilently(page) {
  try {
    const res = await fetch(CONFIG.SHEET_API_URL);
    let data = await res.json();
    
    if (data && data.data && Array.isArray(data.data)) {
      data = data.data;
    }
    
    if (!Array.isArray(data)) {
      console.error("Expected an array of products, got:", typeof data);
      data = [];
    }

    products = data.map(p => {
      if (!p.Slug && p.Name) {
        p.Slug = String(p.Name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
      }
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
  if (page === 'product') renderProductPage();
}

// Instant Filter Initialization
function initFilters() {
  const qInput = document.getElementById('filter-q');
  const catRadios = document.querySelectorAll('input[name="category"]');
  const sortRadios = document.querySelectorAll('input[name="sort"]');

  if (!qInput && catRadios.length === 0) return; // Not on shop page

  // Sync UI with URL params on initial load
  const params = new URLSearchParams(window.location.search);
  if (qInput && params.get('q')) qInput.value = params.get('q');
  
  const catParam = params.get('category');
  if (catParam) {
    catRadios.forEach(r => { if (r.value === catParam) r.checked = true; });
  }
  
  const sortParam = params.get('sort');
  if (sortParam) {
    sortRadios.forEach(r => { if (r.value === sortParam) r.checked = true; });
  }

  // Update logic on change
  const updateShop = () => {
    const newParams = new URLSearchParams();
    if (qInput.value) newParams.set('q', qInput.value);
    
    const activeCat = document.querySelector('input[name="category"]:checked');
    if (activeCat && activeCat.value) newParams.set('category', activeCat.value);
    
    const activeSort = document.querySelector('input[name="sort"]:checked');
    if (activeSort && activeSort.value) newParams.set('sort', activeSort.value);
    
    const newUrl = `${window.location.pathname}?${newParams.toString()}`;
    window.history.replaceState({}, '', newUrl); // Updates URL without reloading
    
    renderShop(); // Instantly update grid
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

// Render Functions
function renderHome() {
  const featuredContainer = document.getElementById('featured-products');
  if (!featuredContainer) return;
  
  let featured = products.filter(p => String(p.Featured).toUpperCase() === "TRUE" || p.Featured === true).slice(0, 4);
  if (featured.length === 0) {
    featured = products.slice(0, 4);
  }
  
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

  // Category filter
  if (category) {
    filtered = filtered.filter(p =>
      String(p.Category || '').trim().toLowerCase() === category.trim().toLowerCase()
    );
  }

  // Search filter
  if (query) {
    filtered = filtered.filter(p =>
      String(p.Name || '').toLowerCase().includes(query.toLowerCase())
    );
  }

  // Sort by price low to high
  if (sort === 'price-asc') {
    filtered.sort((a, b) => Number(a.SalePrice || a.Price || 0) - Number(b.SalePrice || b.Price || 0));
  }

  // Sort by price high to low
  if (sort === 'price-desc') {
    filtered.sort((a, b) => Number(b.SalePrice || b.Price || 0) - Number(a.SalePrice || a.Price || 0));
  }

  // Newest first
  if (sort === 'newest') {
    filtered.sort((a, b) => new Date(b.DateAdded || 0) - new Date(a.DateAdded || 0));
  }

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:3rem;">
        <h3>No products found</h3>
        <p>Try adjusting your filters or search term.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(p => createProductCard(p)).join('');
}

function createProductCard(p) {
  const price = Number(p.Price || 0);
  const salePrice = Number(p.SalePrice || 0);

  const priceDisplay = salePrice
    ? `<span class="strike">₹${price}</span> ₹${salePrice}`
    : `₹${price}`;

  const badge = salePrice ? `<span class="badge">SALE</span>` : '';
  const imgUrl = formatImageUrl(p.Image1);

  return `
    <a href="product.html?slug=${encodeURIComponent(p.Slug || '')}" class="product-card">
      ${badge}
      <img
        src="${imgUrl}"
        alt="${p.Name || 'Kraftloom product'}"
        loading="lazy"
        width="600"
        height="600"
      >
      <h3>${p.Name || 'Product'}</h3>
      <p class="price">${priceDisplay}</p>
    </a>
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

function renderProductPage() {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('slug');
  
  const product = products.find(p => 
    String(p.Slug || '').trim().toLowerCase() === String(slug || '').trim().toLowerCase()
  );
  
  if (!product) {
    const infoDiv = document.querySelector('.product-info');
    if (infoDiv) {
      infoDiv.innerHTML = `<h2>Product not found</h2><p>We couldn't find "${slug}".</p><br><a href="shop.html" class="btn btn-primary">Back to Shop</a>`;
    }
    return;
  }

  document.title = `${product.Name || 'Product'} | Kraftloom`;
  
  const elName = document.getElementById('p-name');
  if (elName) {
    elName.textContent = product.Name || 'Kraftloom Product';
    elName.classList.remove('skeleton'); // Clears the grey box!
  }
  
  const elPrice = document.getElementById('p-price');
  if (elPrice) {
    const price = Number(product.Price || 0);
    const salePrice = Number(product.SalePrice || 0);
    elPrice.innerHTML = salePrice ? `<span class="strike">₹${price}</span> ₹${salePrice}` : `₹${price}`;
    elPrice.classList.remove('skeleton');
  }
  
  const elDesc = document.getElementById('p-desc');
  if (elDesc) {
    elDesc.textContent = product.Description || '';
    elDesc.classList.remove('skeleton');
  }
  
  const mainImg = document.getElementById('main-img');
  if (mainImg) {
    mainImg.src = formatImageUrl(product.Image1);
    mainImg.classList.remove('skeleton');
  }
  
  const elBreadcrumb = document.getElementById('breadcrumb');
  if (elBreadcrumb) {
    elBreadcrumb.innerHTML = `<a href="index.html">Home</a> / <a href="shop.html?category=${encodeURIComponent(product.Category || '')}">${product.Category || 'Shop'}</a> / ${product.Name || ''}`;
  }
  
  const elStatus = document.getElementById('p-status');
  if (elStatus) {
    elStatus.textContent = product.Availability || 'Available';
    elStatus.classList.remove('skeleton');
  }

  // Order Handlers
  const btnWa = document.getElementById('btn-wa');
  if (btnWa) btnWa.onclick = () => orderViaWhatsApp(product);
  
  const btnIg = document.getElementById('btn-ig');
  if (btnIg) btnIg.onclick = () => orderViaInstagram(product);
  
  const btnCart = document.getElementById('btn-cart');
  if (btnCart) btnCart.onclick = () => addToCart(product);
}

// Ordering & Cart
function buildMessage(product) {
  const price = product.SalePrice || product.Price;
  return `Hi Kraftloom! I'd like to order:\n${product.Name}\nPrice: ₹${price}\nLink: ${CONFIG.SITE_URL}/product.html?slug=${product.Slug}`;
}

function orderViaWhatsApp(product) {
  const msg = encodeURIComponent(buildMessage(product));
  window.open(`https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${msg}`, '_blank');
}

function orderViaInstagram(product) {
  navigator.clipboard.writeText(buildMessage(product)).then(() => {
    showToast('Message copied! Paste it in the DM.');
    setTimeout(() => {
      window.open(`https://ig.me/m/${CONFIG.INSTAGRAM_HANDLE}`, '_blank');
    }, 1500);
  });
}

function initCart() {
  const cartBtn = document.getElementById('cart-btn');
  const cartDrawer = document.getElementById('cart-drawer');
  const closeCart = document.getElementById('close-cart');
  const overlay = document.getElementById('overlay');
  
  const toggleCart = () => {
    if(cartDrawer) cartDrawer.classList.toggle('open');
    if(overlay) overlay.classList.toggle('show');
    renderCartItems();
  };

  if(cartBtn) cartBtn.addEventListener('click', toggleCart);
  if(closeCart) closeCart.addEventListener('click', toggleCart);
  if(overlay) overlay.addEventListener('click', toggleCart);

  const checkoutWa = document.getElementById('checkout-wa');
  if(checkoutWa) checkoutWa.addEventListener('click', sendCartWhatsApp);
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

function updateCartCount() {
  const countSpan = document.getElementById('cart-count');
  if(countSpan) countSpan.textContent = cart.reduce((sum, item) => sum + item.qty, 0);
}

function renderCartItems() {
  const container = document.getElementById('cart-items-container');
  if (!container) return;
  
  let total = 0;
  
  if (cart.length === 0) {
    container.innerHTML = '<p>Your cart is empty.</p>';
  } else {
    container.innerHTML = cart.map((item, index) => {
      const price = item.SalePrice || item.Price;
      total += price * item.qty;
      return `
        <div class="cart-item">
          <img src="${formatImageUrl(item.Image1)}" alt="${item.Name}">
          <div>
            <h4>${item.Name}</h4>
            <p>₹${price} x ${item.qty}</p>
            <button onclick="removeFromCart(${index})" style="background:none;border:none;color:var(--rose);cursor:pointer;font-size:0.8rem;margin-top:5px;">Remove</button>
          </div>
        </div>
      `;
    }).join('');
  }
  
  const totalEl = document.getElementById('cart-total');
  if(totalEl) totalEl.textContent = `Total: ₹${total}`;
}

window.removeFromCart = (index) => {
  cart.splice(index, 1);
  localStorage.setItem('kraftloom_cart', JSON.stringify(cart));
  updateCartCount();
  renderCartItems();
};

function sendCartWhatsApp() {
  if (cart.length === 0) return;
  let text = `Hi Kraftloom! I want to order:\n\n`;
  let total = 0;
  cart.forEach(i => {
    const p = i.SalePrice || i.Price;
    total += p * i.qty;
    text += `- ${i.Name} (x${i.qty}) - ₹${p * i.qty}\n`;
  });
  text += `\nTotal: ₹${total}`;
  const msg = encodeURIComponent(text);
  window.open(`https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${msg}`, '_blank');
}

// Custom Order Form
function initCustomOrderForm() {
  const form = document.getElementById('custom-form');
  if (!form) return;
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (form.honeypot && form.honeypot.value) return; 
    
    const btn = form.querySelector('button[type="submit"]');
    if(btn) {
      btn.textContent = 'Submitting...';
      btn.disabled = true;
    }

    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());
    
    try {
      const res = await fetch(CONFIG.SHEET_API_URL, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      
      const successDiv = document.getElementById('form-success');
      if (successDiv) successDiv.style.display = 'block';
      form.style.display = 'none';
      
      const continueBtn = document.getElementById('continue-wa');
      if (continueBtn) {
        continueBtn.onclick = () => {
          const msg = encodeURIComponent(`Hi, I just submitted a custom order request for: ${payload.orderType}. Name: ${payload.name}`);
          window.open(`https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${msg}`, '_blank');
        };
      }
    } catch(err) {
      showToast('Error submitting form. Please try again.');
      if(btn) {
        btn.textContent = 'Submit Request';
        btn.disabled = false;
      }
    }
  });
}
