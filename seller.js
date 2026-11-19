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

function notify(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2600);
}
function showSellerView(view) {
  document.querySelectorAll("[data-seller-panel]").forEach(panel => panel.hidden = panel.dataset.sellerPanel !== view);
  document.querySelectorAll("[data-seller-view]").forEach(button => button.classList.toggle("active", button.dataset.sellerView === view));
}
function productRow(product) {
  return `<div class="seller-item">
    <div class="seller-item-main"><div class="seller-item-thumb">${product.image_url ? `<img src="${escapeHtml(product.image_url)}" alt="">` : escapeHtml(String(product.category || "Т").slice(0,1))}</div>
    <div><b>${escapeHtml(product.name)}</b><small>${escapeHtml(product.category || "Другое")} · Остаток: ${Number(product.stock || 0)}</small></div></div>
    <span class="seller-item-price">${money(product.price)}</span>
    <div class="seller-item-actions"><button type="button" data-edit="${product.id}">Изменить</button><button type="button" class="danger" data-delete="${product.id}">Удалить</button></div></div>`;
}
function render() {
  const totalStock = products.reduce((sum, product) => sum + Number(product.stock || 0), 0);
  const revenue = orders.reduce((sum, order) => sum + order.total, 0);
  $("#statProducts").textContent = products.length;
  $("#statOrders").textContent = orders.length;
  $("#statRevenue").textContent = money(revenue);
  $("#statStock").textContent = totalStock;
  $("#sellerProductCount").textContent = products.length + " позиций";
  $("#sellerProductCount2").textContent = products.length + " позиций";
  $("#inventoryList").innerHTML = products.map(productRow).join("") || '<div class="empty-state">Пока нет товаров. Добавьте первую позицию.</div>';
  $("#overviewProducts").innerHTML = products.slice(0,4).map(product => `<div class="seller-item"><div class="seller-item-main"><div class="seller-item-thumb">${product.image_url ? `<img src="${escapeHtml(product.image_url)}" alt="">` : escapeHtml(String(product.category || "Т").slice(0,1))}</div><div><b>${escapeHtml(product.name)}</b><small>${escapeHtml(product.category || "Другое")}</small></div></div><span class="seller-item-price">${money(product.price)}</span></div>`).join("") || '<div class="empty-state">Добавьте первый товар в каталог.</div>';
  $("#sellerOrders").innerHTML = orders.map(order => `<div class="seller-order"><div><b>Заказ #${escapeHtml(order.id.slice(-6))}</b><small>${new Date(order.date).toLocaleString("ru-RU")} · ${order.items.length} поз.</small><small>${order.items.map(item => escapeHtml(item.name) + " × " + item.qty).join(", ")}</small></div><strong>${money(order.total)}</strong></div>`).join("") || '<div class="empty-state">Заказов пока нет.</div>';
  $("#stockTotal").textContent = totalStock;
  $("#stockLow").textContent = products.filter(product => Number(product.stock || 0) <= 5).length;
  $("#sellerStockList").innerHTML = products.map(product => `<div class="seller-item"><div class="seller-item-main"><div class="seller-item-thumb">${escapeHtml(String(product.category || "Т").slice(0,1))}</div><div><b>${escapeHtml(product.name)}</b><small>${escapeHtml(product.category || "Другое")}</small></div></div><span class="seller-item-price">${Number(product.stock || 0)} шт.</span><span class="seller-count">${Number(product.stock || 0) <= 5 ? "Мало" : "В наличии"}</span></div>`).join("") || '<div class="empty-state">Склад пуст.</div>';
  document.querySelectorAll("[data-delete]").forEach(button => button.onclick = () => deleteProduct(button.dataset.delete));
  document.querySelectorAll("[data-edit]").forEach(button => button.onclick = () => editProduct(button.dataset.edit));
}
async function loadData() {
  const { data: productRows, error: productsError } = await supabase.from("products")
    .select("id,name,category,price,stock,image_url,tag,is_active,created_at")
    .eq("seller_id", currentUser.id).order("created_at", { ascending: false });
  if (productsError) throw productsError;
  products = productRows || [];

  const { data: itemRows, error: ordersError } = await supabase.from("order_items")
    .select("order_id,product_name,unit_price,quantity,created_at")
    .eq("seller_id", currentUser.id).order("created_at", { ascending: false });
  if (ordersError) throw ordersError;
  const grouped = new Map();
  for (const item of itemRows || []) {
    if (!grouped.has(item.order_id)) grouped.set(item.order_id, { id: item.order_id, date: item.created_at, items: [], total: 0 });
    const order = grouped.get(item.order_id);
    order.items.push({ name: item.product_name, qty: Number(item.quantity || 0) });
    order.total += Number(item.unit_price || 0) * Number(item.quantity || 0);
  }
  orders = [...grouped.values()];
  render();
}
async function deleteProduct(id) {
  if (!confirm("Удалить этот товар?")) return;
  const { error } = await supabase.from("products").delete().eq("id", id).eq("seller_id", currentUser.id);
  if (error) { notify("Не удалось удалить товар: " + error.message); return; }
  await loadData();
  notify("Товар удалён");
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
