/*=========================================================
    APP.JS
    Прокат игрушек — Админ-панель с Firebase
    Версия 8.0 (цены всегда отображаются для всех статусов)
=========================================================*/

"use strict";

const firebaseConfig = {
  apiKey: "AIzaSyCGVN_aD4WL-3eTX8GM2vPgGsFhwcd3ZX4",
  authDomain: "igrushki-6a93c.firebaseapp.com",
  projectId: "igrushki-6a93c",
  storageBucket: "igrushki-6a93c.firebasestorage.app",
  messagingSenderId: "1085039924771",
  appId: "1:1085039924771:web:a6334a46ad4dffa1ba4396"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

/*=========================================================
    STORAGE KEYS
=========================================================*/

const LOGIN_KEY = "toy_admin";

/*=========================================================
    DATA
=========================================================*/

let catalog = [];
let selectedFile = null;
let editId = null;

/*=========================================================
    SHORTCUT
=========================================================*/

const $ = id => document.getElementById(id);

/*=========================================================
    DOM REFERENCES
=========================================================*/

const ui = {
    login          : $("loginSection"),
    admin          : $("adminSection"),
    loginBtn       : $("loginBtn"),
    logoutBtn      : $("logoutBtn"),
    loginInput     : $("loginInput"),
    passwordInput  : $("passwordInput"),
    form           : $("addForm"),
    fileInput      : $("mediaFile"),
    chooseBtn      : $("chooseFile"),
    uploadArea     : $("uploadArea"),
    preview        : $("previewMedia"),
    previewBox     : $("previewBox"),
    search         : $("searchInput"),
    filter         : $("filterStatus"),
    sort           : $("sortItems"),
    list           : $("adminList"),
    toast          : $("toast"),
    total          : $("totalItems"),
    available      : $("availableItems"),
    rented         : $("rentedItems"),
    soon           : $("soonItems"),
    count          : $("catalogCount"),
    editModal      : $("editModal"),
    editForm       : $("editForm"),
    editName       : $("editName"),
    editStatus     : $("editStatus"),
    editDescription: $("editDescription"),
    editFile       : $("editFile"),
    editRentPrice14: $("editRentPrice14"),
    editRentPrice30: $("editRentPrice30"),
    closeEdit      : $("closeEdit"),
    rentPrice14    : $("rentPrice14"),
    rentPrice30    : $("rentPrice30"),
    itemDescription: $("itemDescription"),
    itemStatus     : $("itemStatus")
};

/*=========================================================
    TOAST NOTIFICATION
=========================================================*/

function toast(text) {
    if (!ui.toast) return;
    ui.toast.textContent = text;
    ui.toast.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => {
        ui.toast.classList.remove("show");
    }, 2500);
}

/*=========================================================
    AUTHENTICATION (Firebase)
=========================================================*/

function isLogged() {
    return localStorage.getItem(LOGIN_KEY) === "1";
}

function refreshLoginUI() {
    ui.login.classList.toggle("hidden", isLogged());
    ui.admin.classList.toggle("hidden", !isLogged());
}

async function login() {
    const email = ui.loginInput.value.trim();
    const password = ui.passwordInput.value.trim();

    if (!email || !password) {
        toast("Введите email и пароль");
        return;
    }

    try {
        await auth.signInWithEmailAndPassword(email, password);
        localStorage.setItem(LOGIN_KEY, "1");
        refreshLoginUI();
        ui.loginInput.value = "";
        ui.passwordInput.value = "";
        toast("Добро пожаловать!");
        loadCatalog();
    } catch (error) {
        console.error("Ошибка входа:", error);
        toast("Неверный email или пароль");
        ui.passwordInput.value = "";
    }
}

async function logout() {
    try {
        await auth.signOut();
        localStorage.removeItem(LOGIN_KEY);
        refreshLoginUI();
        toast("Вы вышли");
        catalog = [];
        render();
    } catch (error) {
        console.error("Ошибка выхода:", error);
    }
}

auth.onAuthStateChanged((user) => {
    if (user) {
        localStorage.setItem(LOGIN_KEY, "1");
    } else {
        localStorage.removeItem(LOGIN_KEY);
    }
    refreshLoginUI();
    if (user) {
        loadCatalog();
    }
});

/*=========================================================
    HELPERS
=========================================================*/

function generateId() {
    return Date.now() + Math.floor(Math.random() * 1000000);
}

const statusName = {
    available: "В наличии",
    rented: "В прокате",
    soon: "Скоро"
};

const statusClass = {
    available: "status-available",
    rented: "status-rented",
    soon: "status-soon"
};

function truncateText(text, maxLength) {
    if (!text) return "";
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + "...";
}

function formatPrice(price) {
    if (!price || price === 0) return "—";
    return price + " ₽";
}

/*=========================================================
    FILE HANDLING
=========================================================*/

function toBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function showPreview(file) {
    selectedFile = file;
    ui.previewBox.classList.remove("hidden");
    const url = URL.createObjectURL(file);
    if (file.type.startsWith("video")) {
        ui.preview.innerHTML = `<video src="${url}" controls muted playsinline></video>`;
    } else {
        ui.preview.innerHTML = `<img src="${url}" alt="Предпросмотр">`;
    }
    if (window._lastObjectURL) URL.revokeObjectURL(window._lastObjectURL);
    window._lastObjectURL = url;
}

function clearPreview() {
    if (window._lastObjectURL) {
        URL.revokeObjectURL(window._lastObjectURL);
        window._lastObjectURL = null;
    }
    ui.preview.innerHTML = "";
    ui.previewBox.classList.add("hidden");
    selectedFile = null;
}

/*=========================================================
    UPLOAD AREA EVENTS
=========================================================*/

ui.chooseBtn.onclick = () => ui.fileInput.click();

ui.fileInput.onchange = () => {
    if (ui.fileInput.files.length) {
        showPreview(ui.fileInput.files[0]);
    }
};

["dragenter", "dragover"].forEach(event => {
    ui.uploadArea.addEventListener(event, e => {
        e.preventDefault();
        ui.uploadArea.classList.add("drag");
    });
});

["dragleave", "drop"].forEach(event => {
    ui.uploadArea.addEventListener(event, e => {
        e.preventDefault();
        ui.uploadArea.classList.remove("drag");
    });
});

ui.uploadArea.addEventListener("drop", e => {
    if (!e.dataTransfer.files.length) return;
    showPreview(e.dataTransfer.files[0]);
});

/*=========================================================
    CRUD OPERATIONS (Firebase)
=========================================================*/

function loadCatalog() {
    db.collection("catalog")
      .orderBy("createdAt", "desc")
      .onSnapshot((snapshot) => {
          catalog = [];
          snapshot.forEach((doc) => {
              catalog.push({ 
                  firebaseId: doc.id, 
                  id: generateId(),
                  ...doc.data() 
              });
          });
          render();
          updateStats();
      }, (error) => {
          console.error("Ошибка загрузки:", error);
          toast("Ошибка загрузки каталога");
      });
}

async function addItem(e) {
    e.preventDefault();
    const name = $("itemName").value.trim();
    if (!name) {
        toast("Введите название товара");
        return;
    }
    if (!selectedFile) {
        toast("Выберите файл (изображение или видео)");
        return;
    }

    const status = ui.itemStatus.value;
    const description = ui.itemDescription.value.trim();
    const price14 = parseInt(ui.rentPrice14.value) || 0;
    const price30 = parseInt(ui.rentPrice30.value) || 0;

    if (price14 === 0 && price30 === 0) {
        toast("Укажите цену хотя бы для одного варианта аренды");
        return;
    }

    const newItem = {
        name: name,
        description: description || "",
        status: status,
        rentPrice14: price14,
        rentPrice30: price30,
        media: await toBase64(selectedFile),
        mediaType: selectedFile.type.startsWith("video") ? "video" : "image",
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        await db.collection("catalog").add(newItem);
        ui.form.reset();
        clearPreview();
        ui.itemDescription.value = "";
        ui.rentPrice14.value = "";
        ui.rentPrice30.value = "";
        toast("Товар добавлен");
    } catch (error) {
        console.error("Ошибка добавления:", error);
        toast("Ошибка добавления товара");
    }
}

ui.form.addEventListener("submit", addItem);

async function deleteItem(firebaseId) {
    const item = getItemByFirebaseId(firebaseId);
    if (!item) return;
    if (!confirm(`Удалить "${item.name}"?`)) return;
    
    try {
        await db.collection("catalog").doc(firebaseId).delete();
        toast("Товар удалён");
    } catch (error) {
        console.error("Ошибка удаления:", error);
        toast("Ошибка удаления товара");
    }
}

async function updateItem(firebaseId, data) {
    try {
        await db.collection("catalog").doc(firebaseId).update(data);
        toast("Изменения сохранены");
    } catch (error) {
        console.error("Ошибка обновления:", error);
        toast("Ошибка сохранения изменений");
    }
}

async function copyItem(firebaseId) {
    const item = getItemByFirebaseId(firebaseId);
    if (!item) return;
    
    const copy = { 
        name: item.name + " (копия)",
        description: item.description || "",
        status: item.status,
        rentPrice14: item.rentPrice14 || 0,
        rentPrice30: item.rentPrice30 || 0,
        media: item.media,
        mediaType: item.mediaType || "image",
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    try {
        await db.collection("catalog").add(copy);
        toast("Копия создана");
    } catch (error) {
        console.error("Ошибка копирования:", error);
        toast("Ошибка создания копии");
    }
}

/*=========================================================
    FILTERING & SORTING
=========================================================*/

function getItemByFirebaseId(firebaseId) {
    return catalog.find(item => item.firebaseId === firebaseId);
}

function getVisibleItems() {
    let arr = [...catalog];

    const searchText = ui.search.value.trim().toLowerCase();
    if (searchText) {
        arr = arr.filter(item => 
            item.name.toLowerCase().includes(searchText) ||
            (item.description && item.description.toLowerCase().includes(searchText))
        );
    }

    const filterVal = ui.filter.value;
    if (filterVal !== "all") {
        arr = arr.filter(item => item.status === filterVal);
    }

    switch (ui.sort.value) {
        case "name":
            arr.sort((a, b) => a.name.localeCompare(b.name));
            break;
        case "old":
            arr.sort((a, b) => a.id - b.id);
            break;
        default:
            arr.sort((a, b) => b.id - a.id);
    }

    return arr;
}

/*=========================================================
    RENDER
=========================================================*/

function createCard(item) {
    const mediaHtml = item.mediaType === "video"
        ? `<video class="admin-card__media" src="${item.media}" controls preload="metadata"></video>`
        : `<img class="admin-card__media" src="${item.media}" alt="${item.name}" loading="lazy">`;

    // Цены отображаются всегда, независимо от статуса
    const price14 = item.rentPrice14 || 0;
    const price30 = item.rentPrice30 || 0;
    
    let priceHtml = "";
    if (price14 > 0 || price30 > 0) {
        priceHtml = `<div class="admin-card__price">`;
        if (price14 > 0) {
            priceHtml += `2 недели: ${price14} ₽ `;
        }
        if (price30 > 0) {
            priceHtml += `1 месяц: ${price30} ₽`;
        }
        priceHtml += `</div>`;
    }

    const descriptionHtml = item.description 
        ? `<div class="admin-card__description">${truncateText(item.description, 100)}</div>`
        : "";

    return `
        <div class="admin-card">
            ${mediaHtml}
            <div class="admin-card__body">
                <h3 class="admin-card__title">${item.name}</h3>
                ${descriptionHtml}
                <p class="${statusClass[item.status]}">${statusName[item.status]}</p>
                ${priceHtml}
                <div class="admin-actions" style="margin-top: 12px;">
                    <button class="editBtn" data-firebase-id="${item.firebaseId}">✏️ Редактировать</button>
                    <button class="copyBtn" data-firebase-id="${item.firebaseId}">📄 Копировать</button>
                    <button class="deleteBtn" data-firebase-id="${item.firebaseId}">🗑 Удалить</button>
                </div>
            </div>
        </div>
    `;
}

function render() {
    const items = getVisibleItems();
    if (!items.length) {
        ui.list.innerHTML = `
            <div class="empty">
                <h2>Каталог пуст</h2>
                <p>Добавьте первый товар через форму выше.</p>
            </div>
        `;
        return;
    }
    ui.list.innerHTML = items.map(createCard).join("");
}

function updateStats() {
    ui.total.textContent = catalog.length;
    ui.available.textContent = catalog.filter(x => x.status === "available").length;
    ui.rented.textContent   = catalog.filter(x => x.status === "rented").length;
    ui.soon.textContent     = catalog.filter(x => x.status === "soon").length;
    ui.count.textContent    = catalog.length + " товаров";
}

/*=========================================================
    EVENT DELEGATION
=========================================================*/

ui.list.addEventListener("click", e => {
    const button = e.target.closest("button");
    if (!button) return;
    const firebaseId = button.dataset.firebaseId;

    if (button.classList.contains("editBtn")) {
        openEditor(firebaseId);
        return;
    }
    if (button.classList.contains("copyBtn")) {
        copyItem(firebaseId);
        return;
    }
    if (button.classList.contains("deleteBtn")) {
        deleteItem(firebaseId);
        return;
    }
});

/*=========================================================
    SEARCH / FILTER / SORT
=========================================================*/

ui.search.addEventListener("input", render);
ui.filter.addEventListener("change", render);
ui.sort.addEventListener("change", render);

/*=========================================================
    EDITOR
=========================================================*/

function openEditor(firebaseId) {
    const item = getItemByFirebaseId(firebaseId);
    if (!item) return;
    
    editId = firebaseId;
    
    ui.editName.value = item.name;
    ui.editStatus.value = item.status;
    ui.editDescription.value = item.description || "";
    ui.editRentPrice14.value = item.rentPrice14 || "";
    ui.editRentPrice30.value = item.rentPrice30 || "";
    ui.editFile.value = "";

    ui.editModal.classList.add("show");
}

function closeEditor() {
    editId = null;
    ui.editModal.classList.remove("show");
}

ui.closeEdit.onclick = closeEditor;

ui.editModal.addEventListener("click", e => {
    if (e.target === ui.editModal) closeEditor();
});

ui.editForm.addEventListener("submit", async e => {
    e.preventDefault();
    if (!editId) {
        toast("Ошибка: товар не выбран");
        return;
    }

    const price14 = parseInt(ui.editRentPrice14.value) || 0;
    const price30 = parseInt(ui.editRentPrice30.value) || 0;
    
    if (price14 === 0 && price30 === 0) {
        toast("Укажите цену хотя бы для одного варианта аренды");
        return;
    }

    const data = {
        name: ui.editName.value.trim(),
        description: ui.editDescription.value.trim() || "",
        status: ui.editStatus.value,
        rentPrice14: price14,
        rentPrice30: price30
    };

    if (ui.editFile.files.length) {
        const file = ui.editFile.files[0];
        data.media = await toBase64(file);
        data.mediaType = file.type.startsWith("video") ? "video" : "image";
    }

    await updateItem(editId, data);
    closeEditor();
});

/*=========================================================
    KEYBOARD SHORTCUTS
=========================================================*/

[ui.loginInput, ui.passwordInput].forEach(input => {
    input.addEventListener("keydown", e => {
        if (e.key === "Enter") login();
    });
});

document.addEventListener("keydown", e => {
    if (e.key === "Escape") closeEditor();
});

/*=========================================================
    LOGIN / LOGOUT BUTTONS
=========================================================*/

ui.loginBtn.onclick = login;
ui.logoutBtn.onclick = logout;

/*=========================================================
    INITIALIZATION
=========================================================*/

auth.onAuthStateChanged((user) => {
    if (user) {
        localStorage.setItem(LOGIN_KEY, "1");
    } else {
        localStorage.removeItem(LOGIN_KEY);
    }
    refreshLoginUI();
    if (user) {
        loadCatalog();
    }
});

if (isLogged()) {
    loadCatalog();
}

toast("Админ-панель готова");