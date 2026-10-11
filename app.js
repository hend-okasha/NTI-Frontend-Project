"use strict";
const PAYPAL_CLIENT_ID = "";
const RETURN_DAYS = 14;

const $ = (s, root = document) => root.querySelector(s);
const app = $("#app");
$("#year").textContent = new Date().getFullYear();
const esc = (t) =>
  String(t ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const money = (n) => "$" + Number(n).toFixed(2);
const stars = (n) => "★".repeat(Math.round(n)) + "☆".repeat(5 - Math.round(n));
const img = (src, css = "") => `<img src="${esc(src)}" class="${css}" alt="">`;
const pic = (emoji, hue) =>
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300'><rect width='400' height='300' fill='hsl(${hue},70%,92%)'/>` +
      `<text x='50%' y='54%' font-size='110' text-anchor='middle' dominant-baseline='middle'>${emoji}</text></svg>`,
  );
const COLORS = {
  pending: "warning",
  confirmed: "success",
  rejected: "danger",
  return_requested: "info",
  returned: "secondary",
  return_rejected: "dark",
};
const badge = (s) =>
  `<span class="badge text-bg-${COLORS[s]}">${s.replace("_", " ")}</span>`;
const empty = (title, text) =>
  `<div class="text-center text-muted py-5"><h5>${title}</h5><p>${text}</p></div>`;
const table = (
  heads,
  rows,
) => `<div class="box p-0 table-responsive"><table class="table align-middle mb-0">
  <thead><tr>${heads.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div>`;

function toast(message, type = "success") {
  const el = document.createElement("div");
  el.className = `alert alert-${type} shadow-sm py-2 mb-2`;
  el.textContent = message;
  $("#toasts").append(el);
  setTimeout(() => el.remove(), 3500);
}

const KEY = "kartly_db";
const nextId = (list) => Math.max(0, ...list.map((x) => x.id)) + 1;
const hash = (email, pw) => {
  let h = 0;
  for (const c of email + pw) h = (h * 31 + c.charCodeAt(0)) | 0;
  return String(h);
}; // demo only

function seed() {
  const categories = ["Electronics", "Fashion", "Home", "Sports"].map(
    (name, i) => ({ id: i + 1, name }),
  );
  const items = [
    ["Wireless Headphones", 1, 89.99, 25, "🎧", 230],
    ["Smart Watch", 1, 149, 15, "⌚", 200],
    ["Denim Jacket", 2, 64, 30, "🧥", 210],
    ["Running Sneakers", 2, 95, 22, "👟", 345],
    ["Desk Lamp", 3, 42, 35, "💡", 50],
    ["Coffee Mug Set", 3, 34.9, 50, "☕", 25],
    ["Yoga Mat", 4, 24.99, 70, "🧘", 150],
    ["Dumbbells", 4, 110, 10, "🏋️", 190],
  ];
  const products = items.map(([name, categoryId, price, stock, e, hue], i) => ({
    id: i + 1,
    name,
    categoryId,
    price,
    stock,
    image: pic(e, hue),
    description: `Quality ${name.toLowerCase()} for everyday use.`,
  }));
  const admin = {
    id: 1,
    name: "Super Admin",
    email: "admin@kartly.com",
    phone: "",
    role: "admin",
    password: hash("admin@kartly.com", "Admin@123"),
  };
  return {
    users: [admin],
    categories,
    products,
    orders: [],
    reviews: [],
    carts: {},
    wishlists: {},
  };
}
function getDB() {
  let db = JSON.parse(localStorage.getItem(KEY) || "null");
  if (!db) {
    db = seed();
    saveDB(db);
  }
  return db;
}
function saveDB(db) {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
    return true;
  } catch {
    toast("Browser storage is full.", "danger");
    return false;
  }
}

const getUser = () => JSON.parse(localStorage.getItem("user") || "null");
const setUser = ({ password, ...user }) =>
  localStorage.setItem("user", JSON.stringify(user));
const userList = (name) => {
  const u = getUser();
  return u ? getDB()[name][u.id] || [] : [];
}; // name: 'carts' | 'wishlists'
const saveUserList = (name, list) => {
  const db = getDB();
  db[name][getUser().id] = list;
  saveDB(db);
};
const ratingOf = (db, id) => {
  const list = db.reviews.filter((r) => r.productId === id);
  return list.length
    ? {
        count: list.length,
        avg: list.reduce((s, r) => s + r.rating, 0) / list.length,
      }
    : null;
};

const V = {
  text: (label, min, max) => (v) =>
    !v
      ? `${label} is required.`
      : v.length < min || v.length > max
        ? `${label} must be ${min} to ${max} characters.`
        : "",
  name: (v) =>
    !v
      ? "Full name is required."
      : !/^[\p{L} .'-]{3,40}$/u.test(v)
        ? "Full name must be 3 to 40 letters."
        : "",
  email: (v) =>
    !v
      ? "Email is required."
      : !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)
        ? "Enter a valid email, e.g. name@example.com."
        : "",
  phone: (v) =>
    !v
      ? "Phone number is required."
      : !/^\+?\d{10,15}$/.test(v)
        ? "Phone must be 10 to 15 digits."
        : "",
  password: (v) =>
    !v
      ? "Password is required."
      : !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(v)
        ? "Password needs 8+ characters with uppercase, lowercase and a number."
        : "",
  confirm: (v, form) =>
    v !== form.elements.password.value ? "Passwords do not match." : "",
  number: (label, min, max, whole) => (v) =>
    v === "" || isNaN(v)
      ? `${label} must be a number.`
      : v < min || v > max
        ? `${label} must be between ${min} and ${max}.`
        : whole && !Number.isInteger(+v)
          ? `${label} must be a whole number.`
          : "",
};
const RULES = {
  login: {
    email: V.email,
    password: (v) => (v ? "" : "Password is required."),
  },
  register: {
    name: V.name,
    email: V.email,
    phone: V.phone,
    password: V.password,
    confirm: V.confirm,
  },
  admin: {
    name: V.name,
    email: V.email,
    password: V.password,
    confirm: V.confirm,
  },
  checkout: {
    fullName: V.name,
    phone: V.phone,
    city: V.text("City", 2, 40),
    address: V.text("Address", 8, 150),
  },
  review: {
    rating: (v) => (v ? "" : "Please choose a rating."),
    comment: V.text("Feedback", 5, 300),
  },
  category: { name: V.text("Category name", 2, 30) },
  product: {
    name: V.text("Product name", 3, 60),
    categoryId: (v) => (v ? "" : "Please choose a category."),
    price: V.number("Price", 0.01, 1000000),
    stock: V.number("Stock quantity", 0, 100000, true),
    image: (v, form) =>
      v || form.elements.oldImage.value
        ? v && !/^https?:\/\/\S+$/i.test(v)
          ? "Image URL must start with http:// or https://"
          : ""
        : "Image URL is required.",
    description: V.text("Description", 10, 500),
  },
};

function validate(form, rules) {
  let ok = true;
  for (const name in rules) {
    const input = form.elements[name];
    const message = rules[name](
      input.type === "password" ? input.value : input.value.trim(),
      form,
    );
    input.classList.toggle("is-invalid", !!message);
    $(`[data-error="${name}"]`, form).textContent = message;
    if (message) ok = false;
  }
  return ok;
}
const formError = (form, message) => {
  $("[data-alert]", form).innerHTML =
    `<div class="alert alert-danger py-2">${esc(message)}</div>`;
};
function values(form) {
  const result = {};
  for (const el of form.elements)
    if (el.name)
      result[el.name] = el.type === "password" ? el.value : el.value.trim();
  return result;
}
function field(name, label, { type = "text", value = "", options = "" } = {}) {
  const control =
    type === "textarea"
      ? `<textarea class="form-control" name="${name}" rows="3">${esc(value)}</textarea>`
      : type === "select"
        ? `<select class="form-select" name="${name}">${options}</select>`
        : `<input class="form-control" type="${type}" name="${name}" value="${esc(value)}">`;
  return `<label class="d-block mb-3"><span class="form-label d-block">${label}</span>${control}<div class="invalid-feedback" data-error="${name}"></div></label>`;
}
const formPage = (title, form, fields, button, footer = "") => {
  app.innerHTML = `<div class="box auth-box"><h1 class="h3">${title}</h1><form data-form="${form}" novalidate><div data-alert></div>
    ${fields}<button class="btn btn-primary w-100">${button}</button></form>${footer}</div>`;
};

function renderNav() {
  const user = getUser();
  const count = (n) =>
    n ? ` <span class="badge bg-primary rounded-pill">${n}</span>` : "";
  const logout =
    '<button class="btn btn-outline-secondary btn-sm" data-action="logout">Log out</button>';
  const links = !user
    ? '<a href="#/login">Log in</a><a class="btn btn-primary btn-sm" href="#/register">Sign up</a>'
    : user.role === "admin"
      ? `<span>${esc(user.name)} (admin)</span>${logout}`
      : `<a href="#/orders">My orders</a><a href="#/wishlist">Wishlist${count(userList("wishlists").length)}</a>
       <a href="#/cart">Cart${count(userList("carts").reduce((s, i) => s + i.qty, 0))}</a>${logout}`;
  $("#navbar").innerHTML =
    `<nav class="site-nav"><div class="container d-flex flex-wrap justify-content-between align-items-center gap-2 py-2">
    <a class="brand" href="#/">Kartly</a><div class="d-flex flex-wrap align-items-center gap-3">${links}</div></div></nav>`;
}

const filters = { search: "", category: "", max: "", stock: false };

function homePage() {
  const db = getDB();
  const options = db.categories
    .map(
      (c) =>
        `<option value="${c.id}" ${String(c.id) === filters.category ? "selected" : ""}>${esc(c.name)}</option>`,
    )
    .join("");
  app.innerHTML = `<div class="hero"><h1>Good things for everyday living</h1></div>
    <div class="box mb-4"><div class="row g-2 align-items-center">
      <div class="col-md-4"><input class="form-control" data-filter="search" placeholder="Search products..." value="${esc(filters.search)}"></div>
      <div class="col-md-3"><select class="form-select" data-filter="category"><option value="">All categories</option>${options}</select></div>
      <div class="col-md-3"><input class="form-control" type="number" min="0" data-filter="max" placeholder="Max price" value="${filters.max}"></div>
      <div class="col-md-2"><label><input type="checkbox" data-filter="stock" ${filters.stock ? "checked" : ""}> In stock</label></div>
    </div></div><div class="row g-3" id="grid"></div>`;
  drawProducts();
}

function drawProducts() {
  const db = getDB(),
    wishlist = userList("wishlists");
  const list = db.products.filter(
    (p) =>
      (!filters.search ||
        p.name.toLowerCase().includes(filters.search.toLowerCase())) &&
      (!filters.category || String(p.categoryId) === filters.category) &&
      (filters.max === "" || p.price <= Number(filters.max)) &&
      (!filters.stock || p.stock > 0),
  );
  $("#grid").innerHTML = list.length
    ? list.map((p) => productCard(p, db, wishlist.includes(p.id))).join("")
    : `<div class="col-12">${empty("No products found", "Try a different search or clear the filters.")}</div>`;
}

function productCard(p, db, wished) {
  const rating = ratingOf(db, p.id);
  return `<div class="col-6 col-md-4 col-lg-3"><div class="card product-card h-100 position-relative">
    <a href="#/product/${p.id}">${img(p.image, "card-img-top")}</a>
    <button class="wish" data-action="wish" data-id="${p.id}">${wished ? "♥" : "♡"}</button>
    <div class="card-body d-flex flex-column">
      <a class="fw-bold text-decoration-none text-dark" href="#/product/${p.id}">${esc(p.name)}</a>
      <small>${rating ? `<span class="text-warning">${stars(rating.avg)}</span> (${rating.count})` : '<span class="text-muted">No reviews yet</span>'}</small>
      <div class="d-flex justify-content-between align-items-center mt-auto pt-2"><b>${money(p.price)}</b>
        <button class="btn btn-primary btn-sm" data-action="addCart" data-id="${p.id}" ${p.stock < 1 ? "disabled" : ""}>${p.stock < 1 ? "Out of stock" : "Add"}</button>
      </div></div></div></div>`;
}

function productPage(id) {
  const db = getDB(),
    user = getUser(),
    p = db.products.find((x) => x.id === Number(id));
  if (!p) {
    app.innerHTML = empty("Product not found", "It may have been removed.");
    return;
  }
  const rating = ratingOf(db, p.id);
  const reviews = db.reviews.filter((r) => r.productId === p.id).reverse();
  const mine = user && reviews.find((r) => r.userId === user.id);
  const ratingOptions =
    '<option value="">Choose...</option>' +
    [5, 4, 3, 2, 1]
      .map(
        (n) =>
          `<option value="${n}" ${mine && mine.rating === n ? "selected" : ""}>${"★".repeat(n)}</option>`,
      )
      .join("");
  const reviewForm =
    user && user.role === "customer"
      ? `<form data-form="review" data-product="${p.id}" novalidate><div data-alert></div>${field("rating", "Your rating", { type: "select", options: ratingOptions })}
       ${field("comment", "Your feedback", { type: "textarea", value: mine ? mine.comment : "" })}<button class="btn btn-primary w-100">Save review</button></form>`
      : '<p class="text-muted mb-0">Log in as a customer to rate this product.</p>';
  app.innerHTML = `<div class="row g-4">
    <div class="col-md-6">${img(p.image, "img-fluid rounded-4 w-100")}</div>
    <div class="col-md-6"><h1 class="h2">${esc(p.name)}</h1>
      <div class="mb-2">${rating ? `<span class="text-warning">${stars(rating.avg)}</span> ${rating.avg.toFixed(1)} (${rating.count})` : "No reviews yet"}</div>
      <div class="display-6 fw-bold mb-3">${money(p.price)}</div><p>${esc(p.description)}</p>
      <p class="fw-semibold ${p.stock < 1 ? "text-danger" : "text-success"}">${p.stock < 1 ? "Out of stock" : `In stock (${p.stock})`}</p>
      <div class="d-flex gap-2"><input id="qty" type="number" class="form-control" style="width:90px" min="1" value="1">
        <button class="btn btn-primary" data-action="addCartQty" data-id="${p.id}" ${p.stock < 1 ? "disabled" : ""}>Add to cart</button>
        <button class="btn btn-outline-danger" data-action="wish" data-id="${p.id}">♥</button></div></div></div>
    <hr class="my-4"><div class="row g-4">
      <div class="col-lg-7"><h2 class="h5">Reviews</h2>${
        reviews.length
          ? reviews
              .map(
                (
                  r,
                ) => `<div class="border-bottom py-2"><b>${esc(r.userName)}</b>
        <span class="text-warning">${stars(r.rating)}</span><div>${esc(r.comment)}</div></div>`,
              )
              .join("")
          : '<p class="text-muted">No reviews yet.</p>'
      }</div>
      <div class="col-lg-5"><div class="box"><h2 class="h5">Your review</h2>${reviewForm}</div></div></div>`;
}

const loginPage = () =>
  formPage(
    "Log in",
    "login",
    field("email", "Email", { type: "email" }) +
      field("password", "Password", { type: "password" }),
    "Log in",
    '<p class="text-center mt-3 mb-1">New here? <a href="#/register">Create an account</a></p><p class="small text-muted text-center mb-0">Demo admin: admin@kartly.com / Admin@123</p>',
  );

const registerPage = () =>
  formPage(
    "Create account",
    "register",
    field("name", "Full name") +
      field("email", "Email", { type: "email" }) +
      field("phone", "Phone number", { type: "tel" }) +
      field("password", "Password", { type: "password" }) +
      field("confirm", "Confirm password", { type: "password" }),
    "Create account",
    '<p class="text-center mt-3 mb-0">Already registered? <a href="#/login">Log in</a></p>',
  );

function wishlistPage() {
  const db = getDB(),
    ids = userList("wishlists");
  const list = db.products.filter((p) => ids.includes(p.id));
  app.innerHTML =
    '<h1 class="h3 mb-4">My wishlist</h1>' +
    (list.length
      ? `<div class="row g-3">${list.map((p) => productCard(p, db, true)).join("")}</div>`
      : empty(
          "Your wishlist is empty",
          "Tap the heart on a product to save it.",
        ));
}

function cartItems() {
  const db = getDB();
  return userList("carts")
    .map((i) => ({ ...i, p: db.products.find((p) => p.id === i.id) }))
    .filter((i) => i.p);
}
const cartTotal = () =>
  cartItems().reduce((sum, i) => sum + i.p.price * i.qty, 0);

function cartPage() {
  const items = cartItems(),
    user = getUser();
  if (!items.length) {
    app.innerHTML =
      '<h1 class="h3 mb-4">Shopping cart</h1>' +
      empty("Your cart is empty", "Add something you like.");
    return;
  }
  app.innerHTML = `<h1 class="h3 mb-4">Shopping cart</h1><div class="row g-4">
    <div class="col-lg-7"><div class="box py-0">${items
      .map(
        ({
          p,
          qty,
        }) => `<div class="d-flex align-items-center gap-3 py-3 border-bottom">${img(p.image, "thumb")}
      <div class="flex-grow-1"><b>${esc(p.name)}</b><div class="small text-muted">${money(p.price)} each</div>
        ${qty > p.stock ? `<div class="small text-danger">Only ${p.stock} in stock. Reduce the quantity.</div>` : ""}
        <button class="btn btn-outline-secondary btn-sm" data-action="qty" data-id="${p.id}" data-d="-1">-</button><b class="mx-2">${qty}</b>
        <button class="btn btn-outline-secondary btn-sm" data-action="qty" data-id="${p.id}" data-d="1">+</button></div>
      <div class="text-end"><b>${money(p.price * qty)}</b><br><button class="btn btn-link btn-sm text-danger p-0" data-action="removeCart" data-id="${p.id}">Remove</button></div>
    </div>`,
      )
      .join("")}</div></div>
    <div class="col-lg-5"><div class="box"><h2 class="h5">Checkout</h2>
      <div class="d-flex justify-content-between fs-5 fw-bold mb-3"><span>Total</span><span>${money(cartTotal())}</span></div>
      <form id="checkoutForm" data-form="checkout" novalidate><div data-alert></div>
        ${field("fullName", "Full name", { value: user.name })}${field("phone", "Phone number", { type: "tel", value: user.phone })}
        ${field("city", "City")}${field("address", "Street address", { type: "textarea" })}
        <label class="d-block"><input type="radio" name="method" value="cod" checked> Pay on delivery</label>
        <label class="d-block mb-3"><input type="radio" name="method" value="paypal"> PayPal (sandbox)</label>
        <div id="paypalBox" class="mb-3 d-none"></div>
        <button class="btn btn-primary w-100" id="placeBtn">Place order</button>
        <p class="small text-muted mt-2 mb-0">Your order stays pending until an admin confirms it.</p></form></div></div></div>`;
}

function showPayPal() {
  const box = $("#paypalBox");
  if (!PAYPAL_CLIENT_ID) {
    box.innerHTML =
      '<button type="button" class="btn btn-warning w-100" data-action="simPay">Pay with PayPal (simulation)</button>';
    return;
  }
  const draw = () => {
    box.innerHTML = "";
    paypal
      .Buttons({
        onClick: (d, a) =>
          validate($("#checkoutForm"), RULES.checkout)
            ? a.resolve()
            : a.reject(),
        createOrder: (d, a) =>
          a.order.create({
            purchase_units: [{ amount: { value: cartTotal().toFixed(2) } }],
          }),
        onApprove: async (d, a) => {
          await a.order.capture();
          placeOrder("paypal", "paid");
        },
      })
      .render("#paypalBox");
  };
  if (window.paypal) return draw();
  const script = document.createElement("script");
  script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(PAYPAL_CLIENT_ID)}&currency=USD`;
  script.onload = draw;
  document.head.append(script);
}

function placeOrder(method, paymentStatus) {
  const v = values($("#checkoutForm")),
    user = getUser(),
    db = getDB(),
    lines = [];
  for (const item of db.carts[user.id] || []) {
    const p = db.products.find((x) => x.id === item.id);
    if (!p) continue;
    if (item.qty > p.stock)
      return toast(`Only ${p.stock} left of "${p.name}".`, "danger");
    lines.push({
      productId: p.id,
      name: p.name,
      image: p.image,
      price: p.price,
      qty: item.qty,
    });
  }
  if (!lines.length) return toast("Your cart is empty.", "warning");
  lines.forEach((l) => {
    db.products.find((p) => p.id === l.productId).stock -= l.qty;
  }); // reserve stock
  const now = new Date().toISOString();
  db.orders.push({
    id: 1001 + db.orders.length,
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    items: lines,
    total:
      Math.round(lines.reduce((s, l) => s + l.price * l.qty, 0) * 100) / 100,
    shipping: {
      fullName: v.fullName,
      phone: v.phone,
      city: v.city,
      address: v.address,
    },
    payment: { method, status: paymentStatus },
    status: "pending",
    returnReason: "",
    createdAt: now,
    updatedAt: now,
  });
  db.carts[user.id] = [];
  if (!saveDB(db)) return;
  toast("Order placed! Waiting for admin confirmation.");
  location.hash = "#/orders";
}

function ordersPage() {
  const orders = getDB()
    .orders.filter((o) => o.userId === getUser().id)
    .reverse();
  app.innerHTML =
    '<h1 class="h3 mb-4">My orders</h1>' +
    (orders.length
      ? orders
          .map((o) => {
            const canReturn =
              o.status === "confirmed" &&
              (Date.now() - new Date(o.updatedAt)) / 864e5 <= RETURN_DAYS;
            return `<div class="box mb-3"><div class="d-flex justify-content-between"><div><b>Order #${o.id}</b>
      <div class="small text-muted">${new Date(o.createdAt).toLocaleDateString("en-GB")}</div></div><div class="text-end">${badge(o.status)}<div class="fw-bold">${money(o.total)}</div></div></div>
      ${o.items
        .map(
          (
            l,
          ) => `<div class="d-flex align-items-center gap-3 mt-2">${img(l.image, "thumb")}<div class="small"><a href="#/product/${l.productId}">${esc(l.name)}</a>
        <div class="text-muted">${money(l.price)} x ${l.qty}</div></div></div>`,
        )
        .join("")}
      <div class="small text-muted mt-2">Payment: ${o.payment.method === "paypal" ? "PayPal" : "Pay on delivery"} (${o.payment.status})</div>
      ${o.status === "return_requested" ? `<div class="small mt-1">Return reason: ${esc(o.returnReason)}</div>` : ""}
      ${canReturn ? `<button class="btn btn-outline-danger btn-sm mt-2" data-action="returnOrder" data-id="${o.id}">Return this order</button>` : ""}</div>`;
          })
          .join("")
      : empty(
          "No orders yet",
          "When you place an order, you can track it here.",
        ));
}

/* ===== Admin page ===== */
let adminTab = "products";
const editing = { product: null, category: null }; // id of the item being edited

function adminPage() {
  const tabs = {
    products: tabProducts,
    categories: tabCategories,
    orders: tabOrders,
    admins: tabAdmins,
  };
  app.innerHTML = `<ul class="nav nav-pills mb-4">${Object.keys(tabs)
    .map(
      (key) =>
        `<li class="nav-item"><button class="nav-link text-capitalize ${adminTab === key ? "active" : ""}" data-action="tab" data-tab="${key}">${key}</button></li>`,
    )
    .join("")}</ul>${tabs[adminTab]()}`;
}
const editButtons = (
  name,
  id,
) => `<td class="text-nowrap"><button class="btn btn-sm btn-outline-secondary" data-action="edit${name}" data-id="${id}">Edit</button>
  <button class="btn btn-sm btn-outline-danger" data-action="delete${name}" data-id="${id}">Delete</button></td>`;
const saveButtons = (
  editingId,
) => `<button class="btn btn-primary">${editingId ? "Save changes" : "Add"}</button>
  ${editingId ? '<button type="button" class="btn btn-light" data-action="cancelEdit">Cancel</button>' : ""}`;

function tabProducts() {
  const db = getDB(),
    p = db.products.find((x) => x.id === editing.product) || {};
  const options =
    '<option value="">Choose...</option>' +
    db.categories
      .map(
        (c) =>
          `<option value="${c.id}" ${p.categoryId === c.id ? "selected" : ""}>${esc(c.name)}</option>`,
      )
      .join("");
  const rows = db.products
    .map(
      (x) => `<tr><td>${img(x.image, "thumb")}</td><td>${esc(x.name)}</td>
    <td>${esc((db.categories.find((c) => c.id === x.categoryId) || {}).name || "-")}</td><td>${money(x.price)}</td><td>${x.stock}</td>${editButtons("Product", x.id)}</tr>`,
    )
    .join("");
  return `<div class="box mb-4"><h2 class="h5">${p.id ? "Edit product" : "Add product"}</h2><form data-form="product" novalidate><div data-alert></div>
    <input type="hidden" name="oldImage" value="${esc(p.image || "")}"><div class="row">
    <div class="col-md-6">${field("name", "Name", { value: p.name })}</div><div class="col-md-6">${field("categoryId", "Category", { type: "select", options })}</div>
    <div class="col-md-4">${field("price", "Price", { type: "number", value: p.price })}</div><div class="col-md-4">${field("stock", "Stock quantity", { type: "number", value: p.stock })}</div>
    <div class="col-md-4">${field("image", p.id ? "Image URL (empty = keep current)" : "Image URL", { value: p.image && p.image.startsWith("http") ? p.image : "" })}</div></div>
    ${field("description", "Description", { type: "textarea", value: p.description })}${saveButtons(p.id)}</form></div>
    ${table(["Image", "Name", "Category", "Price", "Stock", ""], rows)}`;
}

function tabCategories() {
  const db = getDB(),
    c = db.categories.find((x) => x.id === editing.category) || {};
  const rows = db.categories
    .map(
      (x) =>
        `<tr><td>${esc(x.name)}</td><td>${db.products.filter((p) => p.categoryId === x.id).length}</td>${editButtons("Category", x.id)}</tr>`,
    )
    .join("");
  return `<div class="box mb-4"><h2 class="h5">${c.id ? "Edit category" : "Add category"}</h2><form data-form="category" novalidate><div data-alert></div>
    ${field("name", "Category name", { value: c.name })}${saveButtons(c.id)}</form></div>${table(["Name", "Products", ""], rows)}`;
}

function tabOrders() {
  const orders = getDB().orders.slice().reverse();
  const btn = (action, id, result, text, css) =>
    `<button class="btn btn-${css} btn-sm" data-action="${action}" data-id="${id}" data-result="${result}">${text}</button>`;
  return orders.length
    ? orders
        .map(
          (
            o,
          ) => `<div class="box mb-3"><div class="d-flex justify-content-between"><div><b>Order #${o.id}</b> ${badge(o.status)}
    <div class="small text-muted">${esc(o.userName)} (${esc(o.userEmail)})</div></div><b>${money(o.total)}</b></div>
    <div class="small">${o.items.map((l) => `${esc(l.name)} x ${l.qty}`).join(", ")}</div>
    <div class="small text-muted">${esc(o.shipping.fullName)}, ${esc(o.shipping.phone)}, ${esc(o.shipping.address)}, ${esc(o.shipping.city)} &middot;
      ${o.payment.method === "paypal" ? "PayPal" : "Pay on delivery"} (${o.payment.status})</div>
    ${o.status === "return_requested" ? `<div class="small mt-1">Return reason: ${esc(o.returnReason)}</div>` : ""}
    ${o.status === "pending" ? `<div class="mt-2">${btn("decideOrder", o.id, "confirmed", "Confirm", "success")} ${btn("decideOrder", o.id, "rejected", "Reject", "outline-danger")}</div>` : ""}
    ${o.status === "return_requested" ? `<div class="mt-2">${btn("decideReturn", o.id, "returned", "Approve return", "success")} ${btn("decideReturn", o.id, "return_rejected", "Decline return", "outline-danger")}</div>` : ""}
  </div>`,
        )
        .join("")
    : empty("No orders yet", "Customer orders will appear here.");
}

function tabAdmins() {
  const rows = getDB()
    .users.filter((u) => u.role === "admin")
    .map((a) => `<tr><td>${esc(a.name)}</td><td>${esc(a.email)}</td></tr>`)
    .join("");
  return `<div class="row g-3"><div class="col-lg-7">${table(["Name", "Email"], rows)}</div><div class="col-lg-5"><div class="box"><h2 class="h5">Add another admin</h2>
    <form data-form="admin" novalidate><div data-alert></div>${field("name", "Full name")}${field("email", "Email", { type: "email" })}
    ${field("password", "Password", { type: "password" })}${field("confirm", "Confirm password", { type: "password" })}<button class="btn btn-primary w-100">Add admin</button></form></div></div></div>`;
}

/* ===== Form handlers (one per form) ===== */
function createUser(db, v, role) {
  const email = v.email.toLowerCase();
  const user = {
    id: nextId(db.users),
    name: v.name,
    email,
    phone: v.phone || "",
    role,
    password: hash(email, v.password),
  };
  db.users.push(user);
  return user;
}
const emailTaken = (db, v) =>
  db.users.some((u) => u.email === v.email.toLowerCase());

const forms = {
  login(form) {
    if (!validate(form, RULES.login)) return;
    const email = form.elements.email.value.trim().toLowerCase();
    const user = getDB().users.find((u) => u.email === email);
    if (!user)
      return formError(
        form,
        "No account found with this email. Please register first.",
      );
    if (user.password !== hash(email, form.elements.password.value))
      return formError(form, "Incorrect password. Please try again.");
    setUser(user);
    toast(`Welcome back, ${user.name.split(" ")[0]}!`);
    location.hash = user.role === "admin" ? "#/admin" : "#/";
  },
  register(form) {
    if (!validate(form, RULES.register)) return;
    const db = getDB(),
      v = values(form);
    if (emailTaken(db, v))
      return formError(form, "An account with this email already exists.");
    const user = createUser(db, v, "customer");
    if (!saveDB(db)) return;
    setUser(user);
    toast("Account created. Welcome!");
    location.hash = "#/";
  },
  admin(form) {
    if (!validate(form, RULES.admin)) return;
    const db = getDB(),
      v = values(form);
    if (emailTaken(db, v))
      return formError(form, "This email is already registered.");
    createUser(db, v, "admin");
    if (saveDB(db)) {
      toast("New admin added.");
      render(false);
    }
  },
  checkout(form) {
    if (
      form.elements.method.value !== "paypal" &&
      validate(form, RULES.checkout)
    )
      placeOrder("cod", "unpaid");
  },
  review(form) {
    if (!validate(form, RULES.review)) return;
    const user = getUser(),
      db = getDB(),
      v = values(form),
      productId = Number(form.dataset.product);
    db.reviews = db.reviews.filter(
      (r) => !(r.productId === productId && r.userId === user.id),
    ); // one review per customer
    db.reviews.push({
      id: nextId(db.reviews),
      productId,
      userId: user.id,
      userName: user.name,
      rating: Number(v.rating),
      comment: v.comment,
    });
    if (saveDB(db)) {
      toast("Thanks! Your review is saved.");
      render(false);
    }
  },
  category(form) {
    if (!validate(form, RULES.category)) return;
    const db = getDB(),
      name = form.elements.name.value.trim();
    if (
      db.categories.some(
        (c) =>
          c.id !== editing.category &&
          c.name.toLowerCase() === name.toLowerCase(),
      )
    )
      return formError(form, `A category named "${name}" already exists.`);
    if (editing.category)
      db.categories.find((c) => c.id === editing.category).name = name;
    else db.categories.push({ id: nextId(db.categories), name });
    if (!saveDB(db)) return;
    toast("Category saved.");
    editing.category = null;
    render(false);
  },
  product(form) {
    if (!validate(form, RULES.product)) return;
    const db = getDB(),
      v = values(form);
    const data = {
      name: v.name,
      categoryId: Number(v.categoryId),
      price: Math.round(v.price * 100) / 100,
      stock: Number(v.stock),
      image: v.image || v.oldImage,
      description: v.description,
    };
    if (editing.product) {
      const i = db.products.findIndex((p) => p.id === editing.product);
      db.products[i] = { ...db.products[i], ...data };
    } else db.products.push({ id: nextId(db.products), ...data });
    if (!saveDB(db)) return;
    toast("Product saved.");
    editing.product = null;
    render(false);
  },
};

/* ===== Button actions (every button has data-action) ===== */
function addToCart(productId, qty) {
  const user = getUser();
  if (!user) {
    toast("Please log in first.", "info");
    location.hash = "#/login";
    return;
  }
  if (user.role !== "customer")
    return toast("Admin accounts cannot shop.", "warning");
  const p = getDB().products.find((x) => x.id === productId);
  if (!p || p.stock < 1)
    return toast("Sorry, this product is out of stock.", "danger");
  const cart = userList("carts"),
    existing = cart.find((i) => i.id === productId),
    already = existing ? existing.qty : 0;
  if (already + qty > p.stock)
    return toast(
      `Only ${p.stock} in stock. You already have ${already} in your cart.`,
      "warning",
    );
  if (existing) existing.qty += qty;
  else cart.push({ id: productId, qty });
  saveUserList("carts", cart);
  toast(`"${p.name}" added to your cart.`);
  renderNav();
}

// Gives the items of a rejected/returned order back to the stock
function restock(db, order) {
  order.items.forEach((l) => {
    const p = db.products.find((x) => x.id === l.productId);
    if (p) p.stock += l.qty;
  });
  if (order.payment.status === "paid") order.payment.status = "refunded";
}

function decide(id, result, fromStatus, afterSave) {
  const db = getDB(),
    order = db.orders.find((o) => o.id === Number(id));
  if (order.status !== fromStatus)
    return toast("This order was already handled.", "danger");
  order.status = result;
  order.updatedAt = new Date().toISOString();
  afterSave(db, order);
  saveDB(db);
  render(false);
}

const actions = {
  logout() {
    localStorage.removeItem("user");
    toast("You have been logged out.", "info");
    if (location.hash === "#/login") render();
    else location.hash = "#/login";
  },
  addCart: ({ id }) => addToCart(Number(id), 1),
  addCartQty({ id }) {
    const qty = parseInt($("#qty").value, 10);
    qty > 0
      ? addToCart(Number(id), qty)
      : toast("Quantity must be at least 1.", "warning");
  },
  wish({ id }) {
    const user = getUser(),
      pid = Number(id);
    if (!user) {
      toast("Please log in first.", "info");
      location.hash = "#/login";
      return;
    }
    if (user.role !== "customer")
      return toast("Admin accounts cannot use a wishlist.", "warning");
    const list = userList("wishlists");
    saveUserList(
      "wishlists",
      list.includes(pid) ? list.filter((x) => x !== pid) : [...list, pid],
    );
    render(false);
  },
  qty({ id, d }) {
    const cart = userList("carts"),
      item = cart.find((i) => i.id === Number(id)),
      p = getDB().products.find((x) => x.id === Number(id));
    const newQty = item.qty + Number(d);
    if (newQty < 1) return;
    if (newQty > p.stock) return toast(`Only ${p.stock} in stock.`, "warning");
    item.qty = newQty;
    saveUserList("carts", cart);
    render(false);
  },
  removeCart({ id }) {
    saveUserList(
      "carts",
      userList("carts").filter((i) => i.id !== Number(id)),
    );
    render(false);
  },
  simPay() {
    if (
      validate($("#checkoutForm"), RULES.checkout) &&
      confirm(
        `Approve a sandbox payment of ${money(cartTotal())}? No real money is moved.`,
      )
    )
      placeOrder("paypal", "paid");
  },
  returnOrder({ id }) {
    const reason = (
      prompt(
        `Why do you want to return order #${id}? (at least 10 characters)`,
      ) || ""
    ).trim();
    if (!reason) return;
    if (reason.length < 10)
      return toast("Please write a clearer reason (10+ characters).", "danger");
    const db = getDB();
    Object.assign(
      db.orders.find((o) => o.id === Number(id)),
      {
        status: "return_requested",
        returnReason: reason,
        updatedAt: new Date().toISOString(),
      },
    );
    saveDB(db);
    toast("Return requested.");
    render(false);
  },

  tab({ tab }) {
    adminTab = tab;
    editing.product = editing.category = null;
    adminPage();
  },
  cancelEdit() {
    editing.product = editing.category = null;
    adminPage();
  },
  editProduct({ id }) {
    editing.product = Number(id);
    adminPage();
    window.scrollTo(0, 0);
  },
  editCategory({ id }) {
    editing.category = Number(id);
    adminPage();
  },
  deleteProduct({ id }) {
    if (
      !confirm(
        "Delete this product? It will also be removed from carts and wishlists.",
      )
    )
      return;
    const db = getDB(),
      pid = Number(id);
    db.products = db.products.filter((p) => p.id !== pid);
    for (const u in db.carts)
      db.carts[u] = db.carts[u].filter((i) => i.id !== pid);
    for (const u in db.wishlists)
      db.wishlists[u] = db.wishlists[u].filter((x) => x !== pid);
    saveDB(db);
    render(false);
  },
  deleteCategory({ id }) {
    const db = getDB(),
      count = db.products.filter((p) => p.categoryId === Number(id)).length;
    if (count)
      return toast(
        `This category still has ${count} product(s). Move or delete them first.`,
        "danger",
      );
    if (!confirm("Delete this category?")) return;
    db.categories = db.categories.filter((c) => c.id !== Number(id));
    saveDB(db);
    render(false);
  },
  decideOrder({ id, result }) {
    if (
      result === "rejected" &&
      !confirm(
        "Reject this order? Stock is returned and any payment is refunded.",
      )
    )
      return;
    decide(id, result, "pending", (db, order) => {
      if (result === "rejected") restock(db, order);
    });
  },
  decideReturn({ id, result }) {
    if (
      !confirm(
        result === "returned"
          ? "Approve this return? Stock is restored and payment refunded."
          : "Decline this return request?",
      )
    )
      return;
    decide(id, result, "return_requested", (db, order) => {
      if (result === "returned") restock(db, order);
    });
  },
};

/* ===== Page events ===== */
document.addEventListener("click", (e) => {
  const button = e.target.closest("[data-action]");
  if (button && actions[button.dataset.action])
    actions[button.dataset.action](button.dataset);
});
document.addEventListener("submit", (e) => {
  const handler = forms[e.target.dataset.form];
  if (handler) {
    e.preventDefault();
    handler(e.target);
  }
});
document.addEventListener("input", (e) => {
  const input = e.target,
    key = input.dataset.filter;
  if (key) {
    // home page filters
    filters[key] =
      input.type === "checkbox" ? input.checked : input.value.trim();
    drawProducts();
  } else if (input.form && input.classList.contains("is-invalid")) {
    // re-check a field once the user edits it
    const rules = RULES[input.form.dataset.form];
    if (rules && rules[input.name])
      validate(input.form, { [input.name]: rules[input.name] });
  }
});
document.addEventListener("change", (e) => {
  // show the PayPal area when "PayPal" is selected
  if (e.target.name !== "method") return;
  const usePaypal = e.target.form.elements.method.value === "paypal";
  $("#paypalBox").classList.toggle("d-none", !usePaypal);
  $("#placeBtn").classList.toggle("d-none", usePaypal);
  if (usePaypal) showPayPal();
});

/* ===== Router (the part of the URL after #) ===== */
function render(scrollToTop = true) {
  const [, route = "", param] = location.hash.slice(1).split("/");
  const user = getUser(),
    customerOnly = ["cart", "wishlist", "orders"];
  const redirect = (hash) => {
    location.hash = hash;
  };

  if (customerOnly.includes(route) && !user) {
    toast("Please log in to continue.", "info");
    return redirect("#/login");
  }
  if (customerOnly.includes(route) && user.role === "admin")
    return redirect("#/admin");
  if (route === "admin" && (!user || user.role !== "admin")) {
    toast("That area is for admins only.", "danger");
    return redirect(user ? "#/" : "#/login");
  }
  if (["login", "register"].includes(route) && user)
    return redirect(user.role === "admin" ? "#/admin" : "#/");
  if (route === "" && user && user.role === "admin") return redirect("#/admin");

  const pages = {
    "": homePage,
    product: () => productPage(param),
    login: loginPage,
    register: registerPage,
    cart: cartPage,
    wishlist: wishlistPage,
    orders: ordersPage,
    admin: adminPage,
  };
  renderNav();
  if (pages[route]) pages[route]();
  else app.innerHTML = empty("Page not found", "This page does not exist.");
  if (scrollToTop) window.scrollTo(0, 0);
}
window.addEventListener("hashchange", () => render());
render();
