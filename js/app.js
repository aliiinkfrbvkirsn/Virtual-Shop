const $ = selector => document.querySelector(selector);
import { defaultProducts, translations } from "./data.js";
import { loadState, saveState, loadPreference, savePreference } from "./storage.js";
import { initAuth } from "./auth.js";

const stored = loadState(defaultProducts);
let lang = loadPreference("vs_lang", "ru");
if (!Object.prototype.hasOwnProperty.call(translations, lang)) lang = "ru";
let products = stored.products;
let cart = stored.cart;
let orders = stored.orders;
let activeCategory = "all";
let toastTimer;
let editingProductId = null;
let activeSuggestionIndex = -1;
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
function normalizeSearch(value){return String(value||"").toLocaleLowerCase("ru").replace(/ё/g,"е").replace(/[^\p{L}\p{N}]+/gu," ").trim()}
function searchTokenMatches(queryToken, productToken){
 if(!queryToken||!productToken)return false;
 if(productToken.startsWith(queryToken)||queryToken.startsWith(productToken))return true;
 let common=0;
 while(common<queryToken.length&&common<productToken.length&&queryToken[common]===productToken[common])common++;
 return common>=Math.min(4,queryToken.length,productToken.length);
}
function productMatchesQuery(product,query){
 const q=normalizeSearch(query);
 if(!q)return true;
 const queryTokens=q.split(/\s+/).filter(Boolean);
 const productTokens=normalizeSearch(product.name+" "+categoryName(product.category)).split(/\s+/).filter(Boolean);
 return queryTokens.every(token=>productTokens.some(candidate=>searchTokenMatches(token,candidate)));
}
function getSearchSuggestions(query){
 const q=normalizeSearch(query);
 if(q.length<2)return [];
 return products.map(product=>{
   if(!productMatchesQuery(product,q))return null;
   const name=normalizeSearch(product.name);
   const score=name.startsWith(q)?0:name.includes(q)?1:2;
   return {product,score};
 }).filter(Boolean).sort((a,b)=>a.score-b.score||a.product.name.localeCompare(b.product.name,"ru")).slice(0,6).map(row=>row.product);
}
function hideSearchSuggestions(){
 const list=$("#searchSuggestions");
 if(!list)return;
 list.hidden=true;list.innerHTML="";activeSuggestionIndex=-1;
 $("#searchInput").setAttribute("aria-expanded","false");
}
function chooseSearchSuggestion(name){
 $("#searchInput").value=name;
 activeCategory="all";
 renderCategories();
 renderProducts();
 hideSearchSuggestions();
 $("#searchInput").focus();
 $("#catalog").scrollIntoView({behavior:"smooth",block:"start"});
}
function renderSearchSuggestions(){
 const input=$("#searchInput"),list=$("#searchSuggestions");
 if(!input||!list)return;
 const query=input.value.trim();
 if(!query){hideSearchSuggestions();return}
 const matches=getSearchSuggestions(query);
 if(!matches.length){
   list.innerHTML='<div class="search-suggestion-empty">Ничего похожего не найдено</div>';
 }else{
   list.innerHTML=matches.map((product,index)=>`<button type="button" class="search-suggestion" role="option" aria-selected="${index===activeSuggestionIndex}" data-suggestion-index="${index}">
     <span class="suggestion-icon">${product.image?`<img src="${escapeAttr(product.image)}" alt="">`:escapeHtml(String(product.category||"Т").slice(0,1))}</span>
     <span class="suggestion-copy"><b>${escapeHtml(product.name)}</b><small>${escapeHtml(categoryName(product.category))}</small></span>
     <span class="suggestion-price">${money(product.price)}</span>
   </button>`).join("");
 }
 list.hidden=false;
 input.setAttribute("aria-expanded","true");
 list.querySelectorAll("[data-suggestion-index]").forEach(button=>{
   button.addEventListener("pointerdown",event=>event.preventDefault());
   button.addEventListener("click",()=>chooseSearchSuggestion(matches[Number(button.dataset.suggestionIndex)].name));
 });
}
function handleSearchKeydown(event){
 const list=$("#searchSuggestions");
 if(event.key==="Escape"){hideSearchSuggestions();return}
 if(list.hidden)return;
 const options=[...list.querySelectorAll("[data-suggestion-index]")];
 if(!options.length)return;
 if(event.key==="ArrowDown"||event.key==="ArrowUp"){
   event.preventDefault();
   activeSuggestionIndex=(activeSuggestionIndex+(event.key==="ArrowDown"?1:-1)+options.length)%options.length;
   options.forEach((option,index)=>option.setAttribute("aria-selected",String(index===activeSuggestionIndex)));
   options[activeSuggestionIndex].scrollIntoView({block:"nearest"});
 }else if(event.key==="Enter"&&activeSuggestionIndex>=0){
   event.preventDefault();
   options[activeSuggestionIndex].click();
 }
}
function renderProducts(){
 const q=$("#searchInput").value.trim();
 const filtered=products.filter(p=>(activeCategory==="all"||p.category===activeCategory)&&productMatchesQuery(p,q));
 $("#productGrid").innerHTML=filtered.length?filtered.map((p,i)=>`<article class="product-card" style="animation-delay:${i*45}ms"><div class="product-image">${p.image?`<img src="${escapeAttr(p.image)}" alt="${escapeAttr(p.name)}" onerror="this.remove()">`:`<span class="product-placeholder">${escapeHtml(String(p.category || "Т").slice(0,1))}</span>`}${p.tag?`<span class="product-tag">${escapeHtml(p.tag)}</span>`:""}</div><div class="product-info"><div class="product-category">${escapeHtml(categoryName(p.category))}</div><h3>${escapeHtml(p.name)}</h3><div class="product-bottom"><span class="product-price">${money(p.price)}</span><button class="add-btn" data-add="${p.id}" aria-label="Добавить в корзину">+</button></div><div class="stock-note">${t("stock")}: ${p.stock}</div></div></article>`).join(""):`<div class="empty-state">${t("noProducts")}</div>`;
 document.querySelectorAll("[data-add]").forEach(btn=>btn.addEventListener("click",()=>addToCart(btn.dataset.add)));
}
function categoryName(c){if(lang==="ru")return c;return ({Техника:"Техника",Одежда:"Кийим",Дом:"Үй",Аксессуары:"Аксессуарлар"})[c]||c}
function addToCart(id){const p=products.find(x=>String(x.id)===String(id));if(!p||p.stock<1){notify("Нет товара в наличии");return}const row=cart.find(x=>String(x.id)===String(id));if(row)row.qty=Math.min(row.qty+1,p.stock);else cart.push({id,qty:1});save();renderCart();renderAdmin();notify(t("added"))}
function changeQty(id,delta){const row=cart.find(x=>String(x.id)===String(id)),p=products.find(x=>String(x.id)===String(id));if(!row)return;row.qty+=delta;if(row.qty<1)cart=cart.filter(x=>x.id!==id);if(p&&row.qty>p.stock)row.qty=p.stock;save();renderCart()}
function renderCart(){
 const count=cart.reduce((s,x)=>s+x.qty,0);$("#cartCount").textContent=count;
 const rows=cart.map(row=>{const p=products.find(x=>x.id===row.id);return p?`<div class="cart-row"><div><b>${escapeHtml(p.name)}</b><small>${money(p.price)} × ${row.qty}</small></div><div class="quantity"><button data-minus="${p.id}">−</button><b>${row.qty}</b><button data-plus="${p.id}">+</button></div></div>`:""}).join("");
 $("#cartItems").innerHTML=rows||`<div class="empty-state">${t("emptyCart")}</div>`;
 $("#cartTotal").textContent=money(cart.reduce((sum,row)=>{const p=products.find(x=>x.id===row.id);return sum+(p?p.price*row.qty:0)},0));
 document.querySelectorAll("[data-minus]").forEach(b=>b.onclick=()=>changeQty(b.dataset.minus,-1));
 document.querySelectorAll("[data-plus]").forEach(b=>b.onclick=()=>changeQty(b.dataset.plus,1));
}
function openCart(open){$("#cartDrawer").classList.toggle("open",open);$("#backdrop").classList.toggle("open",open)}
function renderAdmin(){
 if (!$("#adminPanel")) return;
 $("#statProducts").textContent=products.length;
 $("#statOrders").textContent=orders.length;
 $("#statRevenue").textContent=money(orders.reduce((s,o)=>s+o.total,0));
 $("#statStock").textContent=products.reduce((s,p)=>s+p.stock,0);
 $("#sellerProductCount").textContent=products.length+" позиций";
 $("#sellerProductCount2").textContent=products.length+" позиций";
 const row=p=>`<div class="seller-item"><div class="seller-item-main"><div class="seller-item-thumb">${p.image?`<img src="${escapeAttr(p.image)}" alt="">`:escapeHtml(String(p.category || "Т").slice(0,1))}</div><div><b>${escapeHtml(p.name)}</b><small>${escapeHtml(categoryName(p.category))} · Остаток: ${p.stock}</small></div></div><span class="seller-item-price">${money(p.price)}</span><div class="seller-item-actions"><button type="button" data-edit="${p.id}">Изменить</button><button type="button" class="danger" data-delete="${p.id}">Удалить</button></div></div>`;
 $("#inventoryList").innerHTML=products.map(row).join("")||`<div class="empty-state">Пока нет товаров. Добавьте первую позицию.</div>`;
 $("#overviewProducts").innerHTML=products.slice(0,4).map(p=>`<div class="seller-item"><div class="seller-item-main"><div class="seller-item-thumb">${p.image?`<img src="${escapeAttr(p.image)}" alt="">`:escapeHtml(String(p.category || "Т").slice(0,1))}</div><div><b>${escapeHtml(p.name)}</b><small>${escapeHtml(categoryName(p.category))}</small></div></div><span class="seller-item-price">${money(p.price)}</span></div>`).join("")||`<div class="empty-state">Добавьте первый товар в каталог.</div>`;
 $("#sellerOrders").innerHTML=orders.map(o=>`<div class="seller-order"><div><b>Заказ #${String(o.id).slice(-6)}</b><small>${new Date(o.date).toLocaleString("ru-RU")} · ${(o.items||[]).length} поз.</small><small>${(o.items||[]).map(x=>escapeHtml(x.name)+" × "+x.qty).join(", ")}</small></div><strong>${money(o.total)}</strong></div>`).join("")||`<div class="empty-state">Заказов пока нет.</div>`;
 $("#stockTotal").textContent=products.reduce((s,p)=>s+p.stock,0);
 $("#stockLow").textContent=products.filter(p=>p.stock<=5).length;
 $("#sellerStockList").innerHTML=products.map(p=>`<div class="seller-item"><div class="seller-item-main"><div class="seller-item-thumb">${escapeHtml(String(p.category || "Т").slice(0,1))}</div><div><b>${escapeHtml(p.name)}</b><small>${escapeHtml(categoryName(p.category))}</small></div></div><span class="seller-item-price">${p.stock} шт.</span><span class="seller-count">${p.stock<=5?"Мало":"В наличии"}</span></div>`).join("")||`<div class="empty-state">Склад пуст.</div>`;
 document.querySelectorAll("[data-delete]").forEach(b=>b.onclick=()=>{if(!confirm("Удалить этот товар?"))return;const id=Number(b.dataset.delete);products=products.filter(p=>p.id!==id);cart=cart.filter(x=>x.id!==id);save();renderProducts();renderCart();renderAdmin();notify(t("deleted"))});
 document.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>{const p=products.find(x=>x.id===Number(b.dataset.edit));if(!p)return;editingProductId=p.id;$("#productName").value=p.name;$("#productPrice").value=p.price;$("#productStock").value=p.stock;$("#productCategory").value=p.category;$("#productImage").value=p.image||"";$("#sellerFormTitle").textContent="Редактировать товар";$("#productSubmit").innerHTML="Сохранить изменения <span>↗</span>";$("#cancelProductEdit").hidden=false;showSellerView("products");$("#productName").focus()});
}
function showSellerView(view){document.querySelectorAll("[data-seller-panel]").forEach(p=>p.hidden=p.dataset.sellerPanel!==view);document.querySelectorAll("[data-seller-view]").forEach(b=>b.classList.toggle("active",b.dataset.sellerView===view));}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function escapeAttr(s){return escapeHtml(s)}
$("#searchInput").addEventListener("input",()=>{activeSuggestionIndex=-1;renderProducts();renderSearchSuggestions()});
$("#searchInput").addEventListener("focus",()=>{if($("#searchInput").value.trim())renderSearchSuggestions()});
$("#searchInput").addEventListener("keydown",handleSearchKeydown);
document.addEventListener("click",event=>{if(!event.target.closest(".search-wrap"))hideSearchSuggestions()});
$("#langBtn").onclick=()=>{lang=lang==="ru"?"kg":"ru";savePreference("vs_lang",lang);applyLanguage()};
$("#cartBtn").onclick=()=>openCart(true);$("#closeCart").onclick=()=>openCart(false);$("#backdrop").onclick=()=>openCart(false);
$("#shopNow").onclick=()=>$("#catalog").scrollIntoView({behavior:"smooth"});
$("#allProducts").onclick=()=>{activeCategory="all";$("#searchInput").value="";hideSearchSuggestions();renderCategories();renderProducts()};
$("#checkoutBtn").onclick=()=>{if(!cart.length){notify(t("emptyCart"));return}const lines=cart.map(row=>{const p=products.find(x=>x.id===row.id);return p?{id:p.id,name:p.name,price:p.price,qty:row.qty}:null}).filter(Boolean);for(const line of lines){const p=products.find(x=>x.id===line.id);if(!p||p.stock<line.qty){notify("Недостаточно товара на складе");return}}lines.forEach(line=>{products.find(p=>p.id===line.id).stock-=line.qty});orders.unshift({id:Date.now(),date:new Date().toISOString(),items:lines,total:lines.reduce((s,x)=>s+x.price*x.qty,0)});cart=[];save();renderCart();renderProducts();renderAdmin();openCart(false);notify(t("ordered"))};
async function initPublicCatalog(){
 try{
  const {createClient}=await import("https://esm.sh/@supabase/supabase-js@2.119.1");
  const db=createClient("https://qmtyidlsoeotjfyhnghj.supabase.co","sb_publishable_oVfg8lt1cr-yy0biWYsRng_T-yfROHC",{
   auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true}
  });
  // Supabase is the single source of truth. Never recreate deleted database
  // products from an old localStorage snapshot.
  const {data:rows,error}=await db.from("products")
   .select("id,name,category,description,price,stock,image_url,tag,is_active,created_at")
   .eq("is_active",true).order("created_at",{ascending:false});
  if(error)throw error;
  if(!Array.isArray(rows))return;
  const previousProducts=products;
  const previousCart=cart;
  products=rows.map(row=>({
   id:row.id,
   name:row.name,
   category:row.category||"Другое",
   description:row.description||"",
   price:Number(row.price)||0,
   stock:Number(row.stock)||0,
   image:row.image_url||"",
   tag:row.tag||""
  }));
  // Keep only cart rows that still refer to products present in the live catalog.
  cart=previousCart.map(item=>{
   const previous=previousProducts.find(product=>String(product.id)===String(item.id));
   if(!previous)return null;
   const match=rows.find(row=>String(row.id)===String(item.id)) ||
     rows.find(row=>normalizeSearch(row.name)===normalizeSearch(previous.name));
   return match?{...item,id:match.id}:null;
  }).filter(Boolean);
  save();
  renderProducts();
  renderCart();
  renderAdmin();
 }catch(error){
  console.error("Virtual Shop: общий каталог не загрузился",error);
 }
}

applyLanguage();
initAuth({ notify });
void initPublicCatalog();
