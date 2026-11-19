import { loadState, saveState } from "./js/storage.js";
import { defaultProducts } from "./js/data.js";

const $ = selector => document.querySelector(selector);
const money = n => `${Number(n || 0).toLocaleString("ru-RU")} сом`;
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const escapeAttr = escapeHtml;
let { products, orders } = loadState(defaultProducts);
let editingProductId = null;
const supabaseUrl = "https://qmtyidlsoeotjfyhnghj.supabase.co";
const supabaseKey = "sb_publishable_oVfg8lt1cr-yy0biWYsRng_T-yfROHC";

function notify(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2300);
}
function save() { saveState({ products, orders, cart: loadState(defaultProducts).cart }); }
function categoryName(category) { return category || "Другое"; }
function showSellerView(view) {
  document.querySelectorAll("[data-seller-panel]").forEach(panel => panel.hidden = panel.dataset.sellerPanel !== view);
  document.querySelectorAll("[data-seller-view]").forEach(button => button.classList.toggle("active", button.dataset.sellerView === view));
}
function render() {
  $("#statProducts").textContent = products.length;
  $("#statOrders").textContent = orders.length;
  $("#statRevenue").textContent = money(orders.reduce((sum, order) => sum + Number(order.total || 0), 0));
  $("#statStock").textContent = products.reduce((sum, product) => sum + Number(product.stock || 0), 0);
  $("#sellerProductCount").textContent = products.length + " позиций";
  $("#sellerProductCount2").textContent = products.length + " позиций";
  const productRow = product => `<div class="seller-item">
    <div class="seller-item-main"><div class="seller-item-thumb">${product.image ? `<img src="${escapeAttr(product.image)}" alt="">` : escapeHtml(String(product.category || "Т").slice(0,1))}</div>
    <div><b>${escapeHtml(product.name)}</b><small>${escapeHtml(categoryName(product.category))} · Остаток: ${Number(product.stock || 0)}</small></div></div>
    <span class="seller-item-price">${money(product.price)}</span>
    <div class="seller-item-actions"><button type="button" data-edit="${product.id}">Изменить</button><button type="button" class="danger" data-delete="${product.id}">Удалить</button></div></div>`;
  $("#inventoryList").innerHTML = products.map(productRow).join("") || '<div class="empty-state">Пока нет товаров. Добавьте первую позицию.</div>';
  $("#overviewProducts").innerHTML = products.slice(0,4).map(product => `<div class="seller-item"><div class="seller-item-main"><div class="seller-item-thumb">${product.image ? `<img src="${escapeAttr(product.image)}" alt="">` : escapeHtml(String(product.category || "Т").slice(0,1))}</div><div><b>${escapeHtml(product.name)}</b><small>${escapeHtml(categoryName(product.category))}</small></div></div><span class="seller-item-price">${money(product.price)}</span></div>`).join("") || '<div class="empty-state">Добавьте первый товар в каталог.</div>';
  $("#sellerOrders").innerHTML = orders.map(order => `<div class="seller-order"><div><b>Заказ #${String(order.id).slice(-6)}</b><small>${order.date ? new Date(order.date).toLocaleString("ru-RU") : "Дата не указана"} · ${(order.items || []).length} поз.</small><small>${(order.items || []).map(item => escapeHtml(item.name) + " × " + Number(item.qty || 0)).join(", ")}</small></div><strong>${money(order.total)}</strong></div>`).join("") || '<div class="empty-state">Заказов пока нет.</div>';
  $("#stockTotal").textContent = products.reduce((sum, product) => sum + Number(product.stock || 0), 0);
  $("#stockLow").textContent = products.filter(product => Number(product.stock || 0) <= 5).length;
  $("#sellerStockList").innerHTML = products.map(product => `<div class="seller-item"><div class="seller-item-main"><div class="seller-item-thumb">${escapeHtml(String(product.category || "Т").slice(0,1))}</div><div><b>${escapeHtml(product.name)}</b><small>${escapeHtml(categoryName(product.category))}</small></div></div><span class="seller-item-price">${Number(product.stock || 0)} шт.</span><span class="seller-count">${Number(product.stock || 0) <= 5 ? "Мало" : "В наличии"}</span></div>`).join("") || '<div class="empty-state">Склад пуст.</div>';
  document.querySelectorAll("[data-delete]").forEach(button => button.onclick = () => {
    if (!confirm("Удалить этот товар?")) return;
    const id = Number(button.dataset.delete);
    products = products.filter(product => Number(product.id) !== id);
    save(); render(); notify("Товар удалён");
  });
  document.querySelectorAll("[data-edit]").forEach(button => button.onclick = () => {
    const product = products.find(item => Number(item.id) === Number(button.dataset.edit));
    if (!product) return;
    editingProductId = product.id;
    $("#productName").value = product.name || "";
    $("#productPrice").value = product.price || "";
    $("#productStock").value = product.stock ?? 0;
    $("#productCategory").value = product.category || "Другое";
    $("#productImage").value = product.image || "";
    $("#sellerFormTitle").textContent = "Редактировать товар";
    $("#productSubmit").textContent = "Сохранить изменения";
    $("#cancelProductEdit").hidden = false;
    showSellerView("products");
    $("#productName").focus();
  });
}
$("#productForm").addEventListener("submit", event => {
  event.preventDefault();
  const name = $("#productName").value.trim();
  const price = Number($("#productPrice").value);
  const stock = Number($("#productStock").value);
  const category = $("#productCategory").value;
  const image = $("#productImage").value.trim();
  if (!name || !Number.isFinite(price) || price < 1 || !Number.isInteger(stock) || stock < 0) {
    notify("Проверьте название, цену и остаток"); return;
  }
  if (editingProductId !== null) {
    const product = products.find(item => item.id === editingProductId);
    if (product) Object.assign(product, { name, price, stock, category, image });
    notify("Изменения сохранены");
  } else {
    products.unshift({ id: Date.now(), name, price, stock, category, image, tag: "NEW" });
    notify("Товар добавлен");
  }
  editingProductId = null;
  event.target.reset();
  $("#sellerFormTitle").textContent = "Добавить новый товар";
  $("#productSubmit").textContent = "Добавить товар";
  $("#cancelProductEdit").hidden = true;
  save(); render();
});
$("#cancelProductEdit").onclick = () => {
  editingProductId = null; $("#productForm").reset();
  $("#sellerFormTitle").textContent = "Добавить новый товар";
  $("#productSubmit").textContent = "Добавить товар";
  $("#cancelProductEdit").hidden = true;
};
document.querySelectorAll("[data-seller-view]").forEach(button => button.addEventListener("click", () => showSellerView(button.dataset.sellerView)));
document.querySelectorAll("[data-seller-go]").forEach(button => button.addEventListener("click", () => showSellerView(button.dataset.sellerGo)));

async function boot() {
  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.119.1");
    const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!session?.user) { window.location.replace("./"); return; }
    const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", session.user.id).maybeSingle();
    if (profileError) throw profileError;
    if (!["seller", "admin"].includes(profile?.role)) {
      $("#sellerAccessMessage").textContent = "У этого аккаунта пока нет доступа продавца.";
      $("#sellerAccessMessage").hidden = false;
      $("#sellerWorkspace").hidden = true;
      return;
    }
    $("#sellerAccessMessage").hidden = true;
    $("#sellerWorkspace").hidden = false;
    $("#sellerUserEmail").textContent = session.user.email || "Аккаунт продавца";
    render();
    supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!nextSession) window.location.replace("./");
    });
    $("#sellerLogout").onclick = async () => { await supabase.auth.signOut(); window.location.replace("./"); };
  } catch (error) {
    console.error("Seller workspace:", error);
    $("#sellerAccessMessage").textContent = "Не удалось проверить доступ. Проверьте интернет и войдите в аккаунт заново.";
    $("#sellerAccessMessage").hidden = false;
    $("#sellerWorkspace").hidden = true;
  }
}
boot();
