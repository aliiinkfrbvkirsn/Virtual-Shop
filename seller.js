const $ = selector => document.querySelector(selector);
const money = value => `${Number(value || 0).toLocaleString("ru-RU")} сом`;
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const supabaseUrl = "https://qmtyidlsoeotjfyhnghj.supabase.co";
const supabaseKey = "sb_publishable_oVfg8lt1cr-yy0biWYsRng_T-yfROHC";
let supabase;
let currentUser;
let products = [];
let orders = [];
let editingProductId = null;
let analyticsRange = "30";

function notify(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2600);
}
function showSellerView(view) {
  document.querySelectorAll("[data-seller-panel]").forEach(panel => panel.hidden = panel.dataset.sellerPanel !== view);
  document.querySelectorAll("[data-seller-view]").forEach(button => button.classList.toggle("active", button.dataset.sellerView === view));
  if (view === "analytics") renderAnalytics();
}
function productRow(product) {
  return `<div class="seller-item">
    <div class="seller-item-main"><div class="seller-item-thumb">${product.image_url ? `<img src="${escapeHtml(product.image_url)}" alt="">` : escapeHtml(String(product.category || "Т").slice(0,1))}</div>
    <div><b>${escapeHtml(product.name)}</b><small>${escapeHtml(product.category || "Другое")} · Остаток: ${Number(product.stock || 0)}</small></div></div>
    <span class="seller-item-price">${money(product.price)}</span>
    <div class="seller-item-actions"><button type="button" data-edit="${product.id}">Изменить</button><button type="button" class="danger" data-delete="${product.id}">Удалить</button></div></div>`;
}
function localDateKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function getAnalyticsData() {
  const now = new Date();
  const days = analyticsRange === "all" ? null : Number(analyticsRange);
  const start = days ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - days + 1) : null;
  const filteredOrders = orders.filter(order => {
    if (order.status === "cancelled") return false;
    return !start || new Date(order.date) >= start;
  });
  const revenue = filteredOrders.reduce((sum, order) => sum + order.total, 0);
  const itemCount = filteredOrders.reduce((sum, order) => sum + order.items.reduce((n, item) => n + item.qty, 0), 0);
  const average = filteredOrders.length ? revenue / filteredOrders.length : 0;
  return { filteredOrders, revenue, itemCount, average };
}
function renderAnalytics() {
  const host = $("#analyticsContent");
  if (!host) return;
  const { filteredOrders, revenue, itemCount, average } = getAnalyticsData();
  const rangeDays = analyticsRange === "all" ? 365 : Number(analyticsRange);
  const now = new Date();
  const start = analyticsRange === "all"
    ? new Date(now.getFullYear(), now.getMonth() - 11, 1)
    : new Date(now.getFullYear(), now.getMonth(), now.getDate() - rangeDays + 1);
  const buckets = [];
  if (analyticsRange === "all") {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({ key: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`, label: d.toLocaleDateString("ru-RU",{month:"short"}), total: 0 });
    }
  } else {
    for (let i = 0; i < rangeDays; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      buckets.push({ key: localDateKey(d), label: rangeDays === 7 ? d.toLocaleDateString("ru-RU",{weekday:"short"}) : d.toLocaleDateString("ru-RU",{day:"2-digit",month:"2-digit"}), total: 0 });
    }
  }
  const bucketMap = new Map(buckets.map(bucket => [bucket.key,bucket]));
  for (const order of filteredOrders) {
    const d = new Date(order.date);
    const key = analyticsRange === "all" ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}` : localDateKey(d);
    const bucket = bucketMap.get(key);
    if (bucket) bucket.total += order.total;
  }
  const max = Math.max(1, ...buckets.map(bucket => bucket.total));
  const chart = buckets.map(bucket => `<div class="analytics-bar-col" title="${escapeHtml(bucket.label)}: ${money(bucket.total)}"><div class="analytics-bar-track"><div class="analytics-bar" style="height:${Math.max(bucket.total ? 5 : 0, bucket.total / max * 100)}%"></div></div><small>${escapeHtml(bucket.label)}</small></div>`).join("");
  const bestProducts = new Map();
  const categories = new Map();
  for (const order of filteredOrders) for (const item of order.items) {
    const product = bestProducts.get(item.name) || { qty: 0, total: 0 };
    product.qty += item.qty; product.total += item.qty * item.price;
    bestProducts.set(item.name, product);
    const category = item.category || "Другое";
    categories.set(category, (categories.get(category) || 0) + item.qty * item.price);
  }
  const top = [...bestProducts.entries()].sort((a,b)=>b[1].qty-a[1].qty).slice(0,5);
  const categoryRows = [...categories.entries()].sort((a,b)=>b[1]-a[1]);
  const categoryMax = Math.max(1, ...categoryRows.map(item=>item[1]));
  const lowStock = products.filter(product => Number(product.stock || 0) <= 5).sort((a,b)=>Number(a.stock||0)-Number(b.stock||0)).slice(0,5);
  host.innerHTML = `
    <div class="analytics-kpis">
      <article class="analytics-kpi"><span>Оборот заказов</span><strong>${money(revenue)}</strong><small>Без отменённых заказов</small></article>
      <article class="analytics-kpi"><span>Заказы</span><strong>${filteredOrders.length}</strong><small>За выбранный период</small></article>
      <article class="analytics-kpi"><span>Средний чек</span><strong>${money(average)}</strong><small>На один заказ</small></article>
      <article class="analytics-kpi"><span>Продано единиц</span><strong>${itemCount}</strong><small>Количество товаров</small></article>
    </div>
    <div class="analytics-card analytics-chart-card"><div class="analytics-card-head"><div><h4>Динамика продаж</h4><p>Сумма заказов по дням или месяцам</p></div><span class="analytics-chart-total">${money(revenue)}</span></div>
      ${filteredOrders.length ? `<div class="analytics-chart">${chart}</div>` : '<div class="analytics-empty">За выбранный период заказов пока нет. График заполнится автоматически после оформления покупок.</div>'}
    </div>
    <div class="analytics-two-col">
      <div class="analytics-card"><div class="analytics-card-head"><div><h4>Популярные товары</h4><p>По количеству проданных единиц</p></div></div>
        ${top.length ? top.map(([name,data],index)=>`<div class="analytics-rank"><span class="analytics-rank-number">${index+1}</span><div class="analytics-rank-info"><b>${escapeHtml(name)}</b><small>${data.qty} шт. · ${money(data.total)}</small></div></div>`).join("") : '<div class="analytics-empty compact">Пока недостаточно данных о продажах.</div>'}
      </div>
      <div class="analytics-card"><div class="analytics-card-head"><div><h4>Продажи по категориям</h4><p>Распределение оборота</p></div></div>
        ${categoryRows.length ? categoryRows.map(([name,total])=>`<div class="analytics-category"><div><b>${escapeHtml(name)}</b><strong>${money(total)}</strong></div><div class="analytics-progress"><i style="width:${total/categoryMax*100}%"></i></div></div>`).join("") : '<div class="analytics-empty compact">Категории появятся после первых заказов.</div>'}
      </div>
    </div>
    <div class="analytics-card"><div class="analytics-card-head"><div><h4>Низкие остатки</h4><p>Товары, которые стоит пополнить</p></div><span class="seller-count">${products.filter(product=>Number(product.stock||0)<=5).length} позиций</span></div>
      ${lowStock.length ? lowStock.map(product=>`<div class="analytics-low-stock"><b>${escapeHtml(product.name)}</b><span>${Number(product.stock||0)} шт.</span></div>`).join("") : '<div class="analytics-empty compact">Нет товаров с критически низким остатком.</div>'}
    </div>
    <p class="analytics-footnote">Показатели рассчитаны по позициям заказов в Supabase. Отменённые заказы исключены; данные о прибыли и расходах пока не учитываются.</p>`;
}
function render() {
  const totalStock = products.reduce((sum, product) => sum + Number(product.stock || 0), 0);
  const revenue = orders.filter(order=>order.status!=="cancelled").reduce((sum, order) => sum + order.total, 0);
  $("#statProducts").textContent = products.length;
  $("#statOrders").textContent = orders.filter(order=>order.status!=="cancelled").length;
  $("#statRevenue").textContent = money(revenue);
  $("#statStock").textContent = totalStock;
  $("#sellerProductCount").textContent = products.length + " позиций";
  $("#sellerProductCount2").textContent = products.length + " позиций";
  $("#inventoryList").innerHTML = products.map(productRow).join("") || '<div class="empty-state">Пока нет товаров. Добавьте первую позицию.</div>';
  $("#overviewProducts").innerHTML = products.slice(0,4).map(product => `<div class="seller-item"><div class="seller-item-main"><div class="seller-item-thumb">${product.image_url ? `<img src="${escapeHtml(product.image_url)}" alt="">` : escapeHtml(String(product.category || "Т").slice(0,1))}</div><div><b>${escapeHtml(product.name)}</b><small>${escapeHtml(product.category || "Другое")}</small></div></div><span class="seller-item-price">${money(product.price)}</span></div>`).join("") || '<div class="empty-state">Добавьте первый товар в каталог.</div>';
  $("#sellerOrders").innerHTML = orders.map(order => `<div class="seller-order"><div><b>Заказ #${escapeHtml(order.id.slice(-6))}</b><small>${new Date(order.date).toLocaleString("ru-RU")} · ${order.items.length} поз. · ${escapeHtml(order.status)}</small><small>${order.items.map(item => escapeHtml(item.name) + " × " + item.qty).join(", ")}</small></div><strong>${money(order.total)}</strong></div>`).join("") || '<div class="empty-state">Заказов пока нет.</div>';
  const lowStockProducts = products.filter(product => Number(product.stock || 0) <= 5).sort((a,b) => Number(a.stock || 0) - Number(b.stock || 0));
  $("#stockTotal").textContent = totalStock;
  $("#stockLow").textContent = lowStockProducts.length;
  $("#quickStockTotal").textContent = totalStock;
  $("#quickStockLow").textContent = lowStockProducts.length;
  $("#warehouseQuickText").textContent = lowStockProducts.length ? "Есть товары, которые скоро закончатся." : "Все товары сейчас в достаточном количестве.";
  $("#warehouseQuickList").innerHTML = lowStockProducts.slice(0,3).map(product => `<span class="warehouse-quick-chip"><i></i>${escapeHtml(product.name)} <b>${Number(product.stock || 0)} шт.</b></span>`).join("") || '<span class="warehouse-quick-chip">Критичных остатков нет</span>';
  $("#sellerStockList").innerHTML = products.map(product => {
    const low = Number(product.stock || 0) <= 5;
    const image = product.image_url ? `<img src="${escapeHtml(product.image_url)}" alt="">` : escapeHtml(String(product.category || "Т").slice(0,1));
    return `<article class="warehouse-stock-card ${low ? "low" : ""}">
      <div class="warehouse-stock-icon">${image}</div>
      <div class="warehouse-stock-info"><b>${escapeHtml(product.name)}</b><small>${escapeHtml(product.category || "Другое")}</small></div>
      <div class="warehouse-stock-bottom"><strong class="warehouse-stock-qty">${Number(product.stock || 0)} шт.</strong><span class="warehouse-stock-status">${low ? "Мало" : "В наличии"}</span></div>
    </article>`;
  }).join("") || '<div class="warehouse-stock-empty">Склад пока пуст. Добавьте товары в каталог.</div>';
  document.querySelectorAll("[data-delete]").forEach(button => button.onclick = () => deleteProduct(button.dataset.delete));
  document.querySelectorAll("[data-edit]").forEach(button => button.onclick = () => editProduct(button.dataset.edit));
  renderAnalytics();
}
async function loadData() {
  const { data: productRows, error: productsError } = await supabase.from("products")
    .select("id,name,category,price,stock,image_url,tag,is_active,created_at")
    .eq("seller_id", currentUser.id).eq("is_active", true).order("created_at", { ascending: false });
  if (productsError) throw productsError;
  products = productRows || [];

  const { data: itemRows, error: ordersError } = await supabase.from("order_items")
    .select("order_id,product_name,unit_price,quantity,created_at,product_id,products(category),orders!inner(status,created_at)")
    .eq("seller_id", currentUser.id).order("created_at", { ascending: false });
  if (ordersError) throw ordersError;
  const grouped = new Map();
  for (const item of itemRows || []) {
    const parent = Array.isArray(item.orders) ? item.orders[0] : item.orders;
    const date = parent?.created_at || item.created_at;
    const status = parent?.status || "pending";
    if (!grouped.has(item.order_id)) grouped.set(item.order_id, { id: item.order_id, date, status, items: [], total: 0 });
    const order = grouped.get(item.order_id);
    order.items.push({ name: item.product_name, qty: Number(item.quantity || 0), price: Number(item.unit_price || 0), category: item.products?.category || "Другое" });
    order.total += Number(item.unit_price || 0) * Number(item.quantity || 0);
  }
  orders = [...grouped.values()];
  render();
}
async function deleteProduct(id) {
  if (!confirm("Удалить этот товар?")) return;
  const button = document.querySelector(`[data-delete="${CSS.escape(String(id))}"]`);
  if (button) button.disabled = true;
  try {
    const { data: deletedRows, error } = await supabase.from("products")
      .update({ is_active: false }).eq("id", id).eq("seller_id", currentUser.id).eq("is_active", true).select("id");
    if (error) throw error;
    if (!deletedRows?.length) {
      notify("Товар не удалён: запись не найдена или нет прав");
      await loadData();
      return;
    }
    products = products.filter(product => String(product.id) !== String(id));
    await loadData();
    notify("Товар удалён");
  } catch (error) {
    notify("Не удалось удалить товар: " + (error.message || "ошибка"));
    try { await loadData(); } catch (reloadError) { console.error("Reload after delete:", reloadError); }
  }
}
function editProduct(id) {
  const product = products.find(item => item.id === id);
  if (!product) return;
  editingProductId = id;
  $("#productName").value = product.name || "";
  $("#productPrice").value = product.price || "";
  $("#productStock").value = product.stock ?? 0;
  $("#productCategory").value = product.category || "Другое";
  $("#productImage").value = product.image_url || "";
  $("#sellerFormTitle").textContent = "Редактировать товар";
  $("#productSubmit").textContent = "Сохранить изменения";
  $("#cancelProductEdit").hidden = false;
  showSellerView("products");
  $("#productName").focus();
}
function resetProductForm() {
  editingProductId = null;
  $("#productForm").reset();
  $("#sellerFormTitle").textContent = "Добавить новый товар";
  $("#productSubmit").textContent = "Добавить товар";
  $("#cancelProductEdit").hidden = true;
}
$("#productForm").addEventListener("submit", async event => {
  event.preventDefault();
  const name = $("#productName").value.trim();
  const price = Number($("#productPrice").value);
  const stock = Number($("#productStock").value);
  const category = $("#productCategory").value;
  const image_url = $("#productImage").value.trim() || null;
  if (!name || !Number.isFinite(price) || price < 1 || !Number.isInteger(stock) || stock < 0) {
    notify("Проверьте название, цену и остаток"); return;
  }
  const submit = $("#productSubmit");
  const wasEditing = editingProductId !== null;
  submit.disabled = true;
  try {
    const payload = { name, price, stock, category, image_url, is_active: true };
    const result = editingProductId
      ? await supabase.from("products").update(payload).eq("id", editingProductId).eq("seller_id", currentUser.id)
      : await supabase.from("products").insert({ ...payload, seller_id: currentUser.id });
    if (result.error) throw result.error;
    resetProductForm();
    await loadData();
    notify(wasEditing ? "Товар обновлён" : "Товар добавлен");
  } catch (error) {
    notify("Не удалось сохранить товар: " + (error.message || "ошибка"));
  } finally {
    submit.disabled = false;
  }
});
$("#cancelProductEdit").onclick = resetProductForm;
document.querySelectorAll("[data-seller-view]").forEach(button => button.addEventListener("click", () => showSellerView(button.dataset.sellerView)));
document.querySelectorAll("[data-seller-go]").forEach(button => button.addEventListener("click", () => showSellerView(button.dataset.sellerGo)));
document.querySelectorAll("[data-analytics-range]").forEach(button => button.addEventListener("click", () => {
  analyticsRange = button.dataset.analyticsRange;
  document.querySelectorAll("[data-analytics-range]").forEach(item => item.classList.toggle("active", item === button));
  renderAnalytics();
}));

async function boot() {
  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.119.1");
    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!session?.user) { window.location.replace("./?login=1"); return; }
    currentUser = session.user;
    const { data: profile, error: profileError } = await supabase.from("profiles")
      .select("role").eq("id", currentUser.id).maybeSingle();
    if (profileError) throw profileError;
    if (!["seller", "admin"].includes(profile?.role)) {
      $("#sellerAccessMessage").textContent = "У этого аккаунта пока нет доступа продавца. Войдите под аккаунтом продавца.";
      return;
    }
    await loadData();
    $("#sellerAccessMessage").hidden = true;
    $("#sellerWorkspace").hidden = false;
    supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!nextSession) window.location.replace("./?login=1");
    });
    $("#sellerLogout").onclick = async () => {
      $("#sellerLogout").disabled = true;
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        $("#sellerLogout").disabled = false;
        notify("Не удалось выйти: " + signOutError.message);
        return;
      }
      window.location.replace("./?login=1");
    };
  } catch (error) {
    console.error("Seller workspace:", error);
    $("#sellerAccessMessage").textContent = "Не удалось загрузить кабинет: " + (error.message || "проверьте интернет и доступ к базе");
    $("#sellerAccessMessage").hidden = false;
    $("#sellerWorkspace").hidden = true;
  }
}
boot();
