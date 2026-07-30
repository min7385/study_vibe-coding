// ===== 상태 =====
const STORAGE_KEY = "todos";

const today = new Date();
const state = {
  viewYear: today.getFullYear(),
  viewMonth: today.getMonth(), // 0~11
  selectedDate: formatDateStr(today.getFullYear(), today.getMonth(), today.getDate()),
  todos: loadTodos(), // { id, title, category, date, memo, completed, createdAt }
  detailForm: { mode: null, editingId: null }, // mode: null | "add" | "edit"
  categoryFilter: "전체", // "전체" | CATEGORIES 중 하나
};

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
const CATEGORIES = ["개인", "자기개발", "교회"];
const CATEGORY_META = {
  개인: { slug: "personal" },
  자기개발: { slug: "growth" },
  교회: { slug: "church" },
};

function categorySlug(category) {
  return CATEGORY_META[category] ? CATEGORY_META[category].slug : "etc";
}

// ===== 유틸 =====
function formatDateStr(year, month, day) {
  const mm = String(month + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

function isSameDate(y1, m1, d1, dateStr) {
  return formatDateStr(y1, m1, d1) === dateStr;
}

function generateId() {
  return `todo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ===== localStorage 연동 =====
function loadTodos() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("할 일 데이터를 불러오지 못했습니다:", error);
    return [];
  }
}

function saveTodos() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.todos));
  } catch (error) {
    console.error("할 일 데이터를 저장하지 못했습니다:", error);
  }
}

// ===== 렌더링 =====
function renderWeekdayHeader() {
  const container = document.getElementById("calendar-weekdays");
  container.innerHTML = WEEKDAY_LABELS.map((label) => `<span>${label}</span>`).join("");
}

function renderCalendar() {
  const { viewYear, viewMonth } = state;

  document.getElementById("current-year-month").textContent = `${viewYear}년 ${viewMonth + 1}월`;

  const grid = document.getElementById("calendar-grid");
  grid.innerHTML = "";

  const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
  const startWeekday = firstDayOfMonth.getDay(); // 0(일)~6(토)
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  const cells = [];

  // 이전 달 채우기
  for (let i = startWeekday - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    const prevMonthDate = new Date(viewYear, viewMonth - 1, day);
    cells.push({
      day,
      year: prevMonthDate.getFullYear(),
      month: prevMonthDate.getMonth(),
      otherMonth: true,
    });
  }

  // 이번 달
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ day, year: viewYear, month: viewMonth, otherMonth: false });
  }

  // 다음 달 채우기 (그리드를 7의 배수로 맞춤)
  const remainder = cells.length % 7;
  if (remainder !== 0) {
    const trailing = 7 - remainder;
    for (let day = 1; day <= trailing; day++) {
      const nextMonthDate = new Date(viewYear, viewMonth + 1, day);
      cells.push({
        day,
        year: nextMonthDate.getFullYear(),
        month: nextMonthDate.getMonth(),
        otherMonth: true,
      });
    }
  }

  cells.forEach(({ day, year, month, otherMonth }) => {
    const dateStr = formatDateStr(year, month, day);
    const cellEl = document.createElement("div");
    cellEl.className = "calendar-day";
    cellEl.dataset.date = dateStr;

    if (otherMonth) {
      cellEl.classList.add("other-month");
    }
    if (isSameDate(today.getFullYear(), today.getMonth(), today.getDate(), dateStr)) {
      cellEl.classList.add("today");
    }
    if (dateStr === state.selectedDate) {
      cellEl.classList.add("selected");
    }

    const categoriesForDate = CATEGORIES.filter((cat) =>
      state.todos.some((t) => t.date === dateStr && t.category === cat)
    );
    const dotsHtml = categoriesForDate
      .map((cat) => `<span class="day-dot category-${categorySlug(cat)}"></span>`)
      .join("");

    cellEl.innerHTML = `
      <span class="day-number">${day}</span>
      <span class="day-dots">${dotsHtml}</span>
    `;

    cellEl.addEventListener("click", () => onDateClick(dateStr));

    grid.appendChild(cellEl);
  });
}

// ===== 상세 영역 렌더링 =====
function buildFormHtml(editingTodo) {
  const isEdit = editingTodo !== null;
  const titleValue = isEdit ? escapeHtml(editingTodo.title) : "";
  const memoValue = isEdit ? escapeHtml(editingTodo.memo) : "";
  const optionsHtml = CATEGORIES.map((cat) => {
    const selected = isEdit && editingTodo.category === cat ? "selected" : "";
    return `<option value="${cat}" ${selected}>${cat}</option>`;
  }).join("");

  return `
    <form id="todo-form" class="todo-form">
      <label>
        제목
        <input type="text" name="title" value="${titleValue}" required />
      </label>
      <label>
        카테고리
        <select name="category">${optionsHtml}</select>
      </label>
      <label>
        메모
        <textarea name="memo">${memoValue}</textarea>
      </label>
      <div class="form-actions">
        <button type="button" id="cancel-form-btn" class="secondary-btn">취소</button>
        <button type="submit" class="primary-btn">저장</button>
      </div>
    </form>
  `;
}

function buildTodoItemHtml(todo) {
  const slug = categorySlug(todo.category);
  return `
    <li class="todo-item category-${slug} ${todo.completed ? "completed" : ""}" data-id="${todo.id}">
      <label class="todo-check">
        <input type="checkbox" class="todo-complete-checkbox" data-id="${todo.id}" ${todo.completed ? "checked" : ""} />
      </label>
      <div class="todo-main">
        <div class="todo-title-row">
          <span class="todo-category-badge category-${slug}">${escapeHtml(todo.category)}</span>
          <span class="todo-title">${escapeHtml(todo.title)}</span>
        </div>
        ${todo.memo ? `<p class="todo-memo">${escapeHtml(todo.memo)}</p>` : ""}
      </div>
      <div class="todo-actions">
        <button class="edit-todo-btn" data-id="${todo.id}" type="button">수정</button>
        <button class="delete-todo-btn" data-id="${todo.id}" type="button">삭제</button>
      </div>
    </li>
  `;
}

function buildCategoryFilterHtml() {
  const options = ["전체", ...CATEGORIES];
  return `
    <div class="category-filter">
      ${options
        .map(
          (opt) =>
            `<button type="button" class="filter-btn ${state.categoryFilter === opt ? "active" : ""}" data-filter="${opt}">${opt}</button>`
        )
        .join("")}
    </div>
  `;
}

function renderDetail() {
  const container = document.getElementById("detail-content");

  const [y, m, d] = state.selectedDate.split("-").map(Number);
  const dateObj = new Date(y, m - 1, d);
  const weekdayLabel = `${WEEKDAY_LABELS[dateObj.getDay()]}요일`;
  const dateLabel = `${y}년 ${m}월 ${d}일 ${weekdayLabel}`;

  const todosForDate = state.todos.filter(
    (t) =>
      t.date === state.selectedDate &&
      (state.categoryFilter === "전체" || t.category === state.categoryFilter)
  );

  const { mode, editingId } = state.detailForm;
  let formHtml = "";
  if (mode === "add") {
    formHtml = buildFormHtml(null);
  } else if (mode === "edit") {
    const editingTodo = state.todos.find((t) => t.id === editingId) || null;
    formHtml = buildFormHtml(editingTodo);
  }

  const listHtml = todosForDate.length
    ? todosForDate.map(buildTodoItemHtml).join("")
    : '<p class="empty-message">등록된 할 일이 없습니다.</p>';

  container.innerHTML = `
    <div class="detail-header">
      <h2>${dateLabel}</h2>
      ${mode === null ? '<button id="add-todo-btn" class="primary-btn" type="button">+ 할 일 추가</button>' : ""}
    </div>
    ${buildCategoryFilterHtml()}
    ${formHtml}
    <ul class="todo-list">${listHtml}</ul>
  `;

  attachDetailEvents();
}

function attachDetailEvents() {
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.categoryFilter = btn.dataset.filter;
      renderDetail();
    });
  });

  const addBtn = document.getElementById("add-todo-btn");
  if (addBtn) {
    addBtn.addEventListener("click", () => {
      state.detailForm = { mode: "add", editingId: null };
      renderDetail();
    });
  }

  const form = document.getElementById("todo-form");
  if (form) {
    form.addEventListener("submit", handleFormSubmit);
  }

  const cancelBtn = document.getElementById("cancel-form-btn");
  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      state.detailForm = { mode: null, editingId: null };
      renderDetail();
    });
  }

  document.querySelectorAll(".edit-todo-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.detailForm = { mode: "edit", editingId: btn.dataset.id };
      renderDetail();
    });
  });

  document.querySelectorAll(".delete-todo-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      deleteTodo(btn.dataset.id);
    });
  });

  document.querySelectorAll(".todo-complete-checkbox").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      toggleCompleted(checkbox.dataset.id);
    });
  });
}

function handleFormSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const title = form.title.value.trim();
  const category = form.category.value;
  const memo = form.memo.value.trim();

  if (!title) {
    return;
  }

  if (state.detailForm.mode === "add") {
    state.todos.push({
      id: generateId(),
      title,
      category,
      date: state.selectedDate,
      memo,
      completed: false,
      createdAt: new Date().toISOString(),
    });
  } else if (state.detailForm.mode === "edit") {
    const todo = state.todos.find((t) => t.id === state.detailForm.editingId);
    if (todo) {
      todo.title = title;
      todo.category = category;
      todo.memo = memo;
    }
  }

  state.detailForm = { mode: null, editingId: null };
  syncTodos();
}

function deleteTodo(id) {
  state.todos = state.todos.filter((t) => t.id !== id);
  syncTodos();
}

function toggleCompleted(id) {
  const todo = state.todos.find((t) => t.id === id);
  if (todo) {
    todo.completed = !todo.completed;
  }
  syncTodos();
}

// 할 일 데이터 변경 후 저장 + 캘린더/상세 영역 재렌더링을 한 번에 처리
function syncTodos() {
  saveTodos();
  renderCalendar();
  renderDetail();
}

// ===== 이벤트 핸들러 =====
function onDateClick(dateStr) {
  state.selectedDate = dateStr;
  state.detailForm = { mode: null, editingId: null };
  console.log("선택된 날짜:", dateStr);
  renderCalendar();
  renderDetail();
}

function goToPrevMonth() {
  state.viewMonth -= 1;
  if (state.viewMonth < 0) {
    state.viewMonth = 11;
    state.viewYear -= 1;
  }
  renderCalendar();
}

function goToNextMonth() {
  state.viewMonth += 1;
  if (state.viewMonth > 11) {
    state.viewMonth = 0;
    state.viewYear += 1;
  }
  renderCalendar();
}

// ===== 초기화 =====
document.getElementById("prev-month-btn").addEventListener("click", goToPrevMonth);
document.getElementById("next-month-btn").addEventListener("click", goToNextMonth);

renderWeekdayHeader();
renderCalendar();
renderDetail();
