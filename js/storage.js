const STORAGE_KEYS = {
  products: "vs_products",
  cart: "vs_cart",
  orders: "vs_orders"
};

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch (error) {
    console.warn(`Virtual Shop: не удалось прочитать ${key}`, error);
    return fallback;
  }
}

export function loadState(defaultProducts) {
  const products = readJSON(STORAGE_KEYS.products, defaultProducts);
  const cart = readJSON(STORAGE_KEYS.cart, []);
  const orders = readJSON(STORAGE_KEYS.orders, []);

  return {
    products: Array.isArray(products) ? products : defaultProducts,
    cart: Array.isArray(cart) ? cart : [],
    orders: Array.isArray(orders) ? orders : []
  };
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEYS.products, JSON.stringify(state.products));
    localStorage.setItem(STORAGE_KEYS.cart, JSON.stringify(state.cart));
    localStorage.setItem(STORAGE_KEYS.orders, JSON.stringify(state.orders));
    return true;
  } catch (error) {
    console.error("Virtual Shop: не удалось сохранить данные", error);
    return false;
  }
}

export function loadPreference(key, fallback = "") {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch (error) {
    console.warn(`Virtual Shop: не удалось прочитать настройку ${key}`, error);
    return fallback;
  }
}

export function savePreference(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.error(`Virtual Shop: не удалось сохранить настройку ${key}`, error);
    return false;
  }
}
