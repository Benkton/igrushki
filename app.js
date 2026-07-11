/*=========================================================
    APP.JS
    Прокат игрушек — Админ-панель
    Версия 3.0 (с управлением сроками аренды)
=========================================================*/

"use strict";

/*=========================================================
    STORAGE KEYS
=========================================================*/

const STORAGE_KEY = "toy_catalog";
const LOGIN_KEY   = "toy_admin";

/*=========================================================
    🔐 КОНФИГУРАЦИЯ АДМИНА (измените здесь)
=========================================================*/

// ⚠️ ВНИМАНИЕ: Здесь хранятся логин и пароль для входа в админку
// Вы можете изменить их на свои!
const ADMIN_CREDENTIALS = {
    login: "admin",      // ← Измените логин
    password: "admin"    // ← Измените пароль
};

/*=========================================================
    DATA
=========================================================*/

let catalog      = [];
let selectedFile = null;
let editId       = null;

/*=========================================================
    SHORTCUT
=========================================================*/

const $ = id => document.getElementById(id);

/*=========================================================
    DOM REFERENCES
=========================================================*/

const ui = {
    login        : $("loginSection"),
    admin        : $("adminSection"),
    loginBtn     : $("loginBtn"),
    logoutBtn    : $("logoutBtn"),
    loginInput   : $("loginInput"),
    passwordInput: $("passwordInput"),
    form         : $("addForm"),
    fileInput    : $("mediaFile"),
    chooseBtn    : $("chooseFile"),
    uploadArea   : $("uploadArea"),
    preview      : $("previewMedia"),
    previewBox   : $("previewBox"),
    search       : $("searchInput"),
    filter       : $("filterStatus"),
    sort         : $("sortItems"),
    list         : $("adminList"),
    toast        : $("toast"),
    total        : $("totalItems"),
    available    : $("availableItems"),
    rented       : $("rentedItems"),
    soon         : $("soonItems"),
    count        : $("catalogCount"),
    editModal    : $("editModal"),
    editForm     : $("editForm"),
    editName     : $("editName"),
    editStatus   : $("editStatus"),
    editFile     : $("editFile"),
    editRentStart: $("editRentStart"),
    editRentEnd  : $("editRentEnd"),
    closeEdit    : $("closeEdit"),
    rentStart    : $("rentStart"),
    rentEnd      : $("rentEnd"),
    rentedWrap   : $("rentedWrap")
};

/*=========================================================
    STORAGE OPERATIONS
=========================================================*/

function load() {
    catalog = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
}

function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(catalog));
}

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
    LOGIN / LOGOUT (использует ADMIN_CREDENTIALS)
=========================================================*/

function isLogged() {
    return localStorage.getItem(LOGIN_KEY) === "1";
}

function refreshLoginUI() {
    ui.login.classList.toggle("hidden", isLogged());
    ui.admin.classList.toggle("hidden", !isLogged());
}

function login() {
    // Проверка логина и пароля из конфигурации
    if (ui.loginInput.value === ADMIN_CREDENTIALS.login && 
        ui.passwordInput.value === ADMIN_CREDENTIALS.password) {
        localStorage.setItem(LOGIN_KEY, "1");
        refreshLoginUI();
        ui.loginInput.value = "";
        ui.passwordInput.value = "";
        toast("Добро пожаловать!");
    } else {
        toast("Неверный логин или пароль");
        ui.passwordInput.value = "";
    }
}

function logout() {
    localStorage.removeItem(LOGIN_KEY);
    refreshLoginUI();
    toast("Вы вышли");
}

/*=========================================================
    HELPERS
=========================================================*/

const createId = () => Date.now() + Math.floor(Math.random() * 1000000);

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

// Форматирование даты для отображения
function formatDate(dateStr) {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length === 3) {
        return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }
    return dateStr;
}

// Расчет количества дней аренды
function getRentalDays(startDate, endDate) {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
}

function getDaysWord(days) {
    const lastDigit = days % 10;
    const lastTwo = days % 100;
    if (lastTwo >= 11 && lastTwo <= 14) return "дней";
    if (lastDigit === 1) return "день";
    if (lastDigit >= 2 && lastDigit <= 4) return "дня";
    return "дней";
}

/*=========================================================
    STATISTICS
=========================================================*/

function updateStats() {
    ui.total.textContent = catalog.length;
    ui.available.textContent = catalog.filter(x => x.status === "available").length;
    ui.rented.textContent   = catalog.filter(x => x.status === "rented").length;
    ui.soon.textContent     = catalog.filter(x => x.status === "soon").length;
    ui.count.textContent    = catalog.length + " товаров";
}

/*=========================================================
    TOGGLE RENT DATES
=========================================================*/

function toggleRentDates(status) {
    if (status === "rented") {
        ui.rentedWrap.classList.remove("hidden");
    } else {
        ui.rentedWrap.classList.add("hidden");
        ui.rentStart.value = "";
        ui.rentEnd.value = "";
    }
}

// Следим за изменением статуса в форме добавления
$("itemStatus").addEventListener("change", function() {
    toggleRentDates(this.value);
});

// Следим за изменением статуса в форме редактирования
ui.editStatus.addEventListener("change", function() {
    const wrap = document.getElementById("editRentWrap");
    if (this.value === "rented") {
        wrap.classList.remove("hidden");
    } else {
        wrap.classList.add("hidden");
        ui.editRentStart.value = "";
        ui.editRentEnd.value = "";
    }
});

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
    ADD ITEM
=========================================================*/

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

    const status = $("itemStatus").value;
    const rentStart = ui.rentStart.value;
    const rentEnd = ui.rentEnd.value;

    // Проверка дат для аренды
    if (status === "rented") {
        if (!rentStart || !rentEnd) {
            toast("Укажите даты начала и окончания аренды");
            return;
        }
        const start = new Date(rentStart);
        const end = new Date(rentEnd);
        if (start >= end) {
            toast("Дата окончания должна быть позже даты начала");
            return;
        }
    }

    catalog.unshift({
        id: createId(),
        name: name,
        status: status,
        rentStart: status === "rented" ? rentStart : "",
        rentEnd: status === "rented" ? rentEnd : "",
        media: await toBase64(selectedFile),
        mediaType: selectedFile.type.startsWith("video") ? "video" : "image"
    });

    save();
    render();
    ui.form.reset();
    clearPreview();
    ui.rentedWrap.classList.add("hidden");
    toast("Товар добавлен");
}

ui.form.addEventListener("submit", addItem);

/*=========================================================
    FILTERING & SORTING
=========================================================*/

function getVisibleItems() {
    let arr = [...catalog];

    const searchText = ui.search.value.trim().toLowerCase();
    if (searchText) {
        arr = arr.filter(item => item.name.toLowerCase().includes(searchText));
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
        case "rentEnd":
            arr.sort((a, b) => {
                if (!a.rentEnd && !b.rentEnd) return 0;
                if (!a.rentEnd) return 1;
                if (!b.rentEnd) return -1;
                return a.rentEnd.localeCompare(b.rentEnd);
            });
            break;
        default:
            arr.sort((a, b) => b.id - a.id);
    }

    return arr;
}

/*=========================================================
    RENDER CATALOG CARDS
=========================================================*/

function createCard(item) {
    const mediaHtml = item.mediaType === "video"
        ? `<video class="admin-card__media" src="${item.media}" controls preload="metadata"></video>`
        : `<img class="admin-card__media" src="${item.media}" alt="${item.name}" loading="lazy">`;

    let rentInfo = "";
    if (item.status === "rented" && item.rentStart && item.rentEnd) {
        const days = getRentalDays(item.rentStart, item.rentEnd);
        rentInfo = `
            <div style="margin-top: 8px; font-size: 13px; color: #555;">
                <div>📅 ${formatDate(item.rentStart)} → ${formatDate(item.rentEnd)}</div>
                <div style="font-weight: 600; color: var(--accent2);">${days} ${getDaysWord(days)}</div>
            </div>
        `;
    }

    return `
        <div class="admin-card">
            ${mediaHtml}
            <div class="admin-card__body">
                <h3 class="admin-card__title">${item.name}</h3>
                <p class="${statusClass[item.status]}">${statusName[item.status]}</p>
                ${rentInfo}
                <div class="admin-actions" style="margin-top: 12px;">
                    <button class="editBtn" data-id="${item.id}">✏️ Редактировать</button>
                    <button class="copyBtn" data-id="${item.id}">📄 Копировать</button>
                    <button class="deleteBtn" data-id="${item.id}">🗑 Удалить</button>
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
        updateStats();
        return;
    }
    ui.list.innerHTML = items.map(createCard).join("");
    updateStats();
}

/*=========================================================
    EVENT DELEGATION (Edit / Copy / Delete)
=========================================================*/

ui.list.addEventListener("click", e => {
    const button = e.target.closest("button");
    if (!button) return;
    const id = Number(button.dataset.id);

    if (button.classList.contains("editBtn")) {
        openEditor(id);
        return;
    }
    if (button.classList.contains("copyBtn")) {
        copyItem(id);
        return;
    }
    if (button.classList.contains("deleteBtn")) {
        deleteItem(id);
        return;
    }
});

/*=========================================================
    SEARCH / FILTER / SORT LISTENERS
=========================================================*/

ui.search.addEventListener("input", render);
ui.filter.addEventListener("change", render);
ui.sort.addEventListener("change", render);

/*=========================================================
    EDITOR
=========================================================*/

function getItem(id) {
    return catalog.find(item => item.id === id);
}

function openEditor(id) {
    const item = getItem(id);
    if (!item) return;
    editId = id;
    ui.editName.value = item.name;
    ui.editStatus.value = item.status;
    ui.editRentStart.value = item.rentStart || "";
    ui.editRentEnd.value = item.rentEnd || "";
    ui.editFile.value = "";

    // Показываем/скрываем поля дат аренды
    const wrap = document.getElementById("editRentWrap");
    if (item.status === "rented") {
        wrap.classList.remove("hidden");
    } else {
        wrap.classList.add("hidden");
    }

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
    const item = getItem(editId);
    if (!item) return;

    item.name = ui.editName.value.trim();
    item.status = ui.editStatus.value;

    // Обновляем даты аренды
    if (item.status === "rented") {
        const start = ui.editRentStart.value;
        const end = ui.editRentEnd.value;
        if (!start || !end) {
            toast("Укажите даты начала и окончания аренды");
            return;
        }
        if (new Date(start) >= new Date(end)) {
            toast("Дата окончания должна быть позже даты начала");
            return;
        }
        item.rentStart = start;
        item.rentEnd = end;
    } else {
        item.rentStart = "";
        item.rentEnd = "";
    }

    if (ui.editFile.files.length) {
        const file = ui.editFile.files[0];
        item.media = await toBase64(file);
        item.mediaType = file.type.startsWith("video") ? "video" : "image";
    }

    save();
    render();
    closeEditor();
    toast("Изменения сохранены");
});

/*=========================================================
    DELETE
=========================================================*/

function deleteItem(id) {
    const item = getItem(id);
    if (!item) return;
    if (!confirm(`Удалить "${item.name}"?`)) return;
    catalog = catalog.filter(x => x.id !== id);
    save();
    render();
    toast("Товар удалён");
}

/*=========================================================
    COPY
=========================================================*/

function copyItem(id) {
    const item = getItem(id);
    if (!item) return;
    const copy = structuredClone(item);
    copy.id = createId();
    copy.name = item.name + " (копия)";
    catalog.unshift(copy);
    save();
    render();
    toast("Копия создана");
}

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

load();
refreshLoginUI();
render();
toast("Админ-панель готова");

// Сохраняем состояние при закрытии страницы
window.addEventListener("beforeunload", save);