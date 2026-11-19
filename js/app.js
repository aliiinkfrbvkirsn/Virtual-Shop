import { defaultProducts, translations } from "./data.js";
import { loadState, saveState, loadPreference, savePreference } from "./storage.js";

const stored = loadState(defaultProducts);
let lang = loadPreference("vs_lang", "ru");
if (!Object.prototype.hasOwnProperty.call(translations, lang)) lang = "ru";
let products = stored.products;
let cart = stored.cart;
let orders = stored.orders;
let activeCategory = "all";
let toastTimer;
const money = n => `${Number(n).toLocaleString("ru-RU")} сом`;
const t = key => translations[lang][key] || translations.ru[key];
function save(){saveState({products,cart,orders});}
function notify(msg){const el=$("#toast");el.textContent=msg;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2300)}
function applyLanguage(){
 document.documentElement.lang=lang;
 document.querySelectorAll("[data-i18n]").forEach(el=>{const key=el.dataset.i18n;if(t(key))el.innerHTML=t(key)});
 $("#langBtn").textContent=lang==="ru"?"KG":"RU";
 $("#searchInput").placeholder=t("search");
 renderCategories();renderProducts();renderCart();renderAdmin();
}
function renderCategories(){
 const names=lang==="ru"?["Все","Техника","Одежда","Дом","Аксессуары"]:translations.kg.categories;
 const keys=["all","Техника","Одежда","Дом","Аксессуары"];
 $("#categories").innerHTML=names.map((name,i)=>`<button class="category-btn ${activeCategory===keys[i]?"active":""}" data-category="${keys[i]}">${name}</button>`).join("");
 document.querySelectorAll(".category-btn").forEach(btn=>btn.addEventListener("click",()=>{activeCategory=btn.dataset.category;renderCategories();renderProducts()}));
}
function renderProducts(){
 const q=$("#searchInput").value.trim().toLowerCase();
 const filtered=products.filter(p=>(activeCategory==="all"||p.category===activeCategory)&&(`${p.name} ${p.category}`).toLowerCase().includes(q));
 $("#productGrid").innerHTML=filtered.length?filtered.map((p,i)=>`<article class="product-card" style="animation-delay:${i*45}ms"><div class="product-image">${p.image?`<img src="${escapeAttr(p.image)}" alt="${escapeAttr(p.name)}" onerror="this.remove()">`:`<span class="product-placeholder">${escapeHtml(p.category.slice(0,1))}</span>`}${p.tag?`<span class="product-tag">${escapeHtml(p.tag)}</span>`:""}</div><div class="product-info"><div class="product-category">${escapeHtml(categoryName(p.category))}</div><h3>${escapeHtml(p.name)}</h3><div class="product-bottom"><span class="product-price">${money(p.price)}</span><button class="add-btn" data-add="${p.id}" aria-label="Добавить в корзину">+</button></div><div class="stock-note">${t("stock")}: ${p.stock}</div></div></article>`).join(""):`<div class="empty-state">${t("noProducts")}</div>`;
 document.querySelectorAll("[data-add]").forEach(btn=>btn.addEventListener("click",()=>addToCart(Number(btn.dataset.add))));
}
function categoryName(c){if(lang==="ru")return c;return ({Техника:"Техника",Одежда:"Кийим",Дом:"Үй",Аксессуары:"Аксессуарлар"})[c]||c}
function addToCart(id){const p=products.find(x=>x.id===id);if(!p||p.stock<1){notify("Нет товара в наличии");return}const row=cart.find(x=>x.id===id);if(row)row.qty=Math.min(row.qty+1,p.stock);else cart.push({id,qty:1});save();renderCart();renderAdmin();notify(t("added"))}
function changeQty(id,delta){const row=cart.find(x=>x.id===id),p=products.find(x=>x.id===id);if(!row)return;row.qty+=delta;if(row.qty<1)cart=cart.filter(x=>x.id!==id);if(p&&row.qty>p.stock)row.qty=p.stock;save();renderCart()}
function renderCart(){
 const count=cart.reduce((s,x)=>s+x.qty,0);$("#cartCount").textContent=count;
 const rows=cart.map(row=>{const p=products.find(x=>x.id===row.id);return p?`<div class="cart-row"><div><b>${escapeHtml(p.name)}</b><small>${money(p.price)} × ${row.qty}</small></div><div class="quantity"><button data-minus="${p.id}">−</button><b>${row.qty}</b><button data-plus="${p.id}">+</button></div></div>`:""}).join("");
 $("#cartItems").innerHTML=rows||`<div class="empty-state">${t("emptyCart")}</div>`;
 $("#cartTotal").textContent=money(cart.reduce((sum,row)=>{const p=products.find(x=>x.id===row.id);return sum+(p?p.price*row.qty:0)},0));
 document.querySelectorAll("[data-minus]").forEach(b=>b.onclick=()=>changeQty(Number(b.dataset.minus),-1));
 document.querySelectorAll("[data-plus]").forEach(b=>b.onclick=()=>changeQty(Number(b.dataset.plus),1));
}
function openCart(open){$("#cartDrawer").classList.toggle("open",open);$("#backdrop").classList.toggle("open",open)}
function renderAdmin(){
 $("#statProducts").textContent=products.length;
 $("#statOrders").textContent=orders.length;
 $("#statRevenue").textContent=money(orders.reduce((s,o)=>s+o.total,0));
 $("#statStock").textContent=products.reduce((s,p)=>s+p.stock,0);
 $("#inventoryList").innerHTML=products.map(p=>`<div class="inventory-row"><b>${escapeHtml(p.name)}</b><small>${escapeHtml(categoryName(p.category))}</small><strong>${p.stock} шт.</strong><button class="delete-btn" data-delete="${p.id}" aria-label="${t("remove")}">×</button></div>`).join("")||`<div class="empty-state">${t("noProducts")}</div>`;
 document.querySelectorAll("[data-delete]").forEach(b=>b.onclick=()=>{if(!confirm("Удалить этот товар?"))return;const id=Number(b.dataset.delete);products=products.filter(p=>p.id!==id);cart=cart.filter(x=>x.id!==id);save();renderProducts();renderCart();renderAdmin();notify(t("deleted"))});
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function escapeAttr(s){return escapeHtml(s)}
$("#searchInput").addEventListener("input",renderProducts);
$("#langBtn").onclick=()=>{lang=lang==="ru"?"kg":"ru";savePreference("vs_lang",lang);applyLanguage()};
$("#cartBtn").onclick=()=>openCart(true);$("#closeCart").onclick=()=>openCart(false);$("#backdrop").onclick=()=>openCart(false);
$("#shopNow").onclick=()=>$("#catalog").scrollIntoView({behavior:"smooth"});
$("#allProducts").onclick=()=>{activeCategory="all";$("#searchInput").value="";renderCategories();renderProducts()};
$("#productForm").addEventListener("submit",e=>{e.preventDefault();const name=$("#productName").value.trim(),price=Number($("#productPrice").value),stock=Number($("#productStock").value),category=$("#productCategory").value,image=$("#productImage").value.trim();if(!name||price<1||stock<0)return;products.unshift({id:Date.now(),name,price,stock,category,image,tag:"NEW"});save();e.target.reset();renderProducts();renderAdmin();notify("Товар добавлен")});
$("#checkoutBtn").onclick=()=>{if(!cart.length){notify(t("emptyCart"));return}const lines=cart.map(row=>{const p=products.find(x=>x.id===row.id);return p?{id:p.id,name:p.name,price:p.price,qty:row.qty}:null}).filter(Boolean);for(const line of lines){const p=products.find(x=>x.id===line.id);if(!p||p.stock<line.qty){notify("Недостаточно товара на складе");return}}lines.forEach(line=>{products.find(p=>p.id===line.id).stock-=line.qty});orders.unshift({id:Date.now(),date:new Date().toISOString(),items:lines,total:lines.reduce((s,x)=>s+x.price*x.qty,0)});cart=[];save();renderCart();renderProducts();renderAdmin();openCart(false);notify(t("ordered"))};
$("#accountBtn").onclick=()=>$("#accountModal").classList.add("open");$("#closeAccount").onclick=()=>$("#accountModal").classList.remove("open");$("#accountModal").onclick=e=>{if(e.target.id==="accountModal")$("#accountModal").classList.remove("open")};
$("#saveAccount").onclick=()=>{savePreference("vs_customer",$("#customerName").value.trim());$("#accountModal").classList.remove("open");notify(t("saved"))};
$("#customerName").value=loadPreference("vs_customer","");
applyLanguage();
