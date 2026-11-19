import { createClient } from "https://esm.sh/@supabase/supabase-js@2.119.1";

const SUPABASE_URL = "https://qmtyidlsoeotjfyhnghj.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_oVfg8lt1cr-yy0biWYsRng_T-yfROHC";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

export function initAuth({ notify = () => {} } = {}) {
  const $ = selector => document.querySelector(selector);
  const modal = $("#accountModal");
  const form = $("#authForm");
  const message = $("#authMessage");
  const tabs = $("#authTabs");
  const nameField = $("#authNameField");
  const nameInput = $("#authName");
  const emailInput = $("#authEmail");
  const passwordInput = $("#authPassword");
  const submit = $("#authSubmit");
  const signedIn = $("#authSignedIn");
  const authSwitch = $("#authSwitch");
  const signOut = $("#authSignOut");
  const adminPanel = $("#adminPanel");
  let mode = "login";
  let session = null;

  const setMessage = (text, type = "") => {
    message.textContent = text;
    message.className = "auth-message" + (type ? " " + type : "");
  };

  const setMode = nextMode => {
    mode = nextMode;
    const signup = mode === "signup";
    nameField.hidden = !signup;
    nameInput.required = signup;
    passwordInput.autocomplete = signup ? "new-password" : "current-password";
    $("#authTitle").textContent = signup ? "Создать аккаунт" : "Войти в аккаунт";
    $("#authDescription").textContent = signup
      ? "Укажите почту и придумайте пароль. Мы отправим письмо для подтверждения адреса."
      : "Введите почту и пароль, чтобы открыть личный кабинет.";
    submit.innerHTML = signup ? "Зарегистрироваться <span>↗</span>" : "Войти <span>↗</span>";
    tabs.querySelectorAll("[data-auth-mode]").forEach(button => {
      button.classList.toggle("active", button.dataset.authMode === mode);
    });
    authSwitch.textContent = signup ? "Уже есть аккаунт? Войти" : "Нет аккаунта? Зарегистрироваться";
    setMessage("");
  };

  const openModal = () => {
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    if (session) renderSession(session);
    else setMode(mode);
  };
  const closeModal = () => {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
  };

  async function syncProfile(user) {
    if (!user?.id) return;
    const fullName = String(user.user_metadata?.full_name || "").trim().slice(0, 80);
    const { error } = await supabase.from("profiles").upsert(
      { id: user.id, full_name: fullName },
      { onConflict: "id" }
    );
    if (error) console.warn("Virtual Shop: профиль пока не синхронизирован", error.message);
    const { data: profile } = await supabase.from("profiles")
      .select("role, full_name").eq("id", user.id).maybeSingle();
    const role = profile?.role || "customer";
    if (adminPanel) adminPanel.hidden = !["seller", "admin"].includes(role);
  }

  function renderSession(currentSession) {
    session = currentSession;
    const user = session?.user;
    const accountButton = $("#accountBtn");
    if (accountButton) {
      accountButton.textContent = user ? (user.email || "A").charAt(0).toUpperCase() : "A";
      accountButton.title = user ? user.email : "Личный кабинет";
      accountButton.setAttribute("aria-label", user ? "Аккаунт " + user.email : "Войти или зарегистрироваться");
    }
    if (user) {
      tabs.hidden = true;
      form.hidden = true;
      authSwitch.hidden = true;
      signedIn.hidden = false;
      $("#authTitle").textContent = "Личный кабинет";
      $("#authDescription").textContent = "Вы вошли в Virtual Shop.";
      $("#authUserEmail").textContent = user.email || "";
      $("#authUserMark").textContent = (user.email || "A").charAt(0).toUpperCase();
      setMessage("Аккаунт успешно подключён.", "success");
      void syncProfile(user);
    } else {
      tabs.hidden = false;
      form.hidden = false;
      authSwitch.hidden = false;
      signedIn.hidden = true;
      if (adminPanel) adminPanel.hidden = true;
    }
  }

  $("#accountBtn").addEventListener("click", openModal);
  $("#closeAccount").addEventListener("click", closeModal);
  modal.addEventListener("click", event => {
    if (event.target === modal) closeModal();
  });
  tabs.querySelectorAll("[data-auth-mode]").forEach(button => {
    button.addEventListener("click", () => setMode(button.dataset.authMode));
  });
  authSwitch.addEventListener("click", () => setMode(mode === "login" ? "signup" : "login"));

  form.addEventListener("submit", async event => {
    event.preventDefault();
    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value;
    const fullName = nameInput.value.trim();
    if (!email || !password || (mode === "signup" && !fullName)) {
      setMessage("Заполните все обязательные поля.", "error");
      return;
    }
    if (mode === "signup" && password.length < 8) {
      setMessage("Пароль должен содержать не менее 8 символов.", "error");
      return;
    }
    submit.disabled = true;
    submit.textContent = mode === "signup" ? "Создаём аккаунт…" : "Входим…";
    setMessage("");
    try {
      if (mode === "signup") {
        const emailRedirectTo = new URL("./", window.location.href).href;
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo
          }
        });
        if (error) throw error;
        if (data.session) {
          setMessage("Аккаунт создан. Вы вошли в систему.", "success");
          notify("Регистрация завершена");
        } else {
          setMessage("Письмо отправлено на " + email + ". Откройте его и нажмите кнопку подтверждения, затем вернитесь на сайт.", "success");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setMessage("Вход выполнен.", "success");
        notify("Вы вошли в аккаунт");
      }
    } catch (error) {
      const raw = String(error?.message || "");
      const friendly = /invalid login credentials/i.test(raw)
        ? "Неверная почта или пароль. Если вы только зарегистрировались, сначала подтвердите почту."
        : /email not confirmed/i.test(raw)
          ? "Сначала подтвердите почту по ссылке из письма."
          : /already registered|user already registered/i.test(raw)
            ? "Этот адрес уже зарегистрирован. Переключитесь на вход."
            : raw || "Не удалось выполнить запрос. Попробуйте ещё раз.";
      setMessage(friendly, "error");
    } finally {
      submit.disabled = false;
      submit.innerHTML = mode === "signup" ? "Зарегистрироваться <span>↗</span>" : "Войти <span>↗</span>";
    }
  });

  signOut.addEventListener("click", async () => {
    signOut.disabled = true;
    const { error } = await supabase.auth.signOut();
    signOut.disabled = false;
    if (error) {
      setMessage("Не удалось выйти: " + error.message, "error");
      return;
    }
    setMode("login");
    notify("Вы вышли из аккаунта");
  });

  supabase.auth.onAuthStateChange((_event, nextSession) => {
    renderSession(nextSession);
  });

  supabase.auth.getSession().then(({ data, error }) => {
    if (error) {
      console.warn("Virtual Shop: не удалось восстановить сессию", error.message);
      return;
    }
    renderSession(data.session);
  });

  setMode("login");
}
