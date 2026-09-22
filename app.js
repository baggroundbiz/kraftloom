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
  updateCartCount();
  
  const page = window.location.pathname.split('/').pop().replace('.html', '') || 'index';
  
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
  if(hamburger) {
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

// Data Fetching (Stale-while-revalidate)
async function fetchProducts(page) {
  const cached = localStorage.getItem('kraftloom_products');
  if (cached) {
    products = JSON.parse(cached);
    routePageLogic(page);
    fetchDataSilently(page); 
  } else {
    await fetchDataSilently(page);
  }
}

async function fetchDataSilently(page) {
  try {
    const res = await fetch(CONFIG.SHEET_API_URL);
    const data = await res.json();
    products = data.filter(p => p.Status === 'Active');
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

// Render Functions
function renderHome() {
  const featuredContainer = document.getElementById('featured-products');
  if (!featuredContainer) return;
  const featured = products.filter(p => p.Featured === true || p.Featured === "TRUE").slice(0, 4);
  featuredContainer.innerHTML = featured.map(p => createProductCard(p)).join('');
}

function renderShop() {
  const grid = document.getElementById('product-grid');
  if (!grid) return;
  
  // URL Params parsing
  const params = new URLSearchParams(window.location.search);
  const category = params.get('category');
  const sort = params.get('sort');
  const query = params.get('q');
  
  let filtered = [...products];
  
  if (category) filtered = filtered.filter(p => p.Category.toLowerCase() === category.toLowerCase());
  if (query) filtered = filtered.filter(p => p.Name.toLowerCase().includes(query.toLowerCase()));
  
  if (sort === 'price-asc') filtered.sort((a, b) => a.Price - b.Price);
  if (sort === 'price-desc') filtered.sort((a, b) => b.Price - a.Price);
  if (sort === 'newest') filtered.sort((a, b) => new Date(b.DateAdded) - new Date(a.DateAdded));

  if (filtered.length === 0) {
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 3rem;">
      <h3>No products found</h3>
      <p>Try adjusting your filters or search term.</p>
    </div>`;
  } else {
    grid.innerHTML = filtered.map(p => createProductCard(p)).join('');
  }
}

function createProductCard(p) {
  const priceDisplay = p.SalePrice 
    ? `<span class="strike">₹${p.Price}</span> ₹${p.SalePrice}` 
    : `₹${p.Price}`;
  const badge = p.SalePrice ? `<span class="badge">SALE</span>` : '';
  const imgUrl = formatImageUrl(p.Image1);

  return `
    <a href="product.html?slug=${p.Slug}" class="product-card">
      ${badge}
      <img src="${imgUrl}" alt="${p.Name}" loading="lazy">
      <h3>${p.Name}</h3>
      <p class="price">${priceDisplay}</p>
    </a>
  `;
}

function formatImageUrl(url) {
  if (!url) return 'assets/logo.png';
  if (url.includes('drive.google.com/file/d/')) {
    const id = url.split('/d/')[1].split('/')[0];
    return `https://drive.google.com/thumbnail?id=${id}&sz=w1000`;
  }
  return url;
}

function renderProductPage() {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('slug');
  const product = products.find(p => p.Slug === slug);
  if (!product) {
    window.location.href = '404.html';
    return;
  }

  document.title = `${product.Name} | Kraftloom, HSR Layout Bengaluru`;
  document.getElementById('p-name').textContent = product.Name;
  document.getElementById('p-price').innerHTML = product.SalePrice ? `<span class="strike">₹${product.Price}</span> ₹${product.SalePrice}` : `₹${product.Price}`;
  document.getElementById('p-desc').textContent = product.Description;
  
  const mainImg = document.getElementById('main-img');
  mainImg.src = formatImageUrl(product.Image1);
  
  // Breadcrumbs & Status
  document.getElementById('breadcrumb').innerHTML = `<a href="index.html">Home</a> / <a href="shop.html?category=${product.Category}">${product.Category}</a> / ${product.Name}`;
  document.getElementById('p-status').textContent = product.Availability;

  // Order Handlers
  document.getElementById('btn-wa').onclick = () => orderViaWhatsApp(product);
  document.getElementById('btn-ig').onclick = () => orderViaInstagram(product);
  document.getElementById('btn-cart').onclick = () => addToCart(product);
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
    cartDrawer.classList.toggle('open');
    overlay.classList.toggle('show');
    renderCartItems();
  };

  if(cartBtn) cartBtn.addEventListener('click', toggleCart);
  if(closeCart) closeCart.addEventListener('click', toggleCart);
  if(overlay) overlay.addEventListener('click', toggleCart);

  document.getElementById('checkout-wa').addEventListener('click', sendCartWhatsApp);
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
  document.getElementById('cart-total').textContent = `Total: ₹${total}`;
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
    if (form.honeypot.value) return; // Spam check
    
    const btn = form.querySelector('button[type="submit"]');
    btn.textContent = 'Submitting...';
    btn.disabled = true;

    // Handle images (compress to base64) - simplified for demo
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());
    
    try {
      const res = await fetch(CONFIG.SHEET_API_URL, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      document.getElementById('form-success').style.display = 'block';
      form.style.display = 'none';
      
      // Setup continue button
      document.getElementById('continue-wa').onclick = () => {
        const msg = encodeURIComponent(`Hi, I just submitted a custom order request for: ${payload.orderType}. Name: ${payload.name}`);
        window.open(`https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${msg}`, '_blank');
      };
    } catch(err) {
      showToast('Error submitting form. Please try again.');
      btn.textContent = 'Submit Request';
      btn.disabled = false;
    }
  });
}
