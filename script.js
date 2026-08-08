// ===== 상태 =====
const STORAGE_KEY = "todos";

const today = new Date();
const state = {
  viewYear: today.getFullYear(),
  viewMonth: today.getMonth(), // 0~11
  selectedDate: formatDateStr(today.getFullYear(), today.getMonth(), today.getDate()),
  todos: loadTodos(), // { id, title, category, startDate, endDate, startTime, endTime, memo, completed, createdAt }
  detailForm: { mode: null, editingId: null }, // mode: null | "add" | "edit"
  categoryFilter: "전체", // "전체" | 카테고리 이름 중 하나
};

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

// ===== 카테고리 관리 =====
// { id, name, color } 형태로 저장되며, 기존 todos.category(문자열)와는 별개의 데이터다.
const CATEGORIES_STORAGE_KEY = "categories";

const CATEGORY_PALETTE = [
  "#4A90D9",
  "#5CB85C",
  "#9B59B6",
  "#E67E22",
  "#E74C3C",
  "#F1C40F",
  "#1ABC9C",
  "#34495E",
  "#EC407A",
  "#95A5A6",
];

const DEFAULT_CATEGORIES = [
  { id: "cat-1", name: "개인", color: "#4A90D9" },
  { id: "cat-2", name: "자기개발", color: "#5CB85C" },
  { id: "cat-3", name: "교회", color: "#9B59B6" },
  { id: "cat-default", name: "미분류", color: "#95A5A6" },
];

function getCategories() {
  try {
    const raw = localStorage.getItem(CATEGORIES_STORAGE_KEY);
    if (!raw) {
      saveCategories(DEFAULT_CATEGORIES);
      return DEFAULT_CATEGORIES;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      saveCategories(DEFAULT_CATEGORIES);
      return DEFAULT_CATEGORIES;
    }
    return parsed;
  } catch (error) {
    console.error("카테고리 데이터를 불러오지 못했습니다:", error);
    return DEFAULT_CATEGORIES;
  }
}

function saveCategories(categories) {
  try {
    localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(categories));
  } catch (error) {
    console.error("카테고리 데이터를 저장하지 못했습니다:", error);
  }
}

// 이름으로 카테고리를 찾는다. 삭제 등으로 못 찾으면 "미분류"로, 그마저 없으면 첫 번째 카테고리로 대체한다.
function findCategoryByName(categories, name) {
  return (
    categories.find((c) => c.name === name) ||
    categories.find((c) => c.id === "cat-default") ||
    categories[0]
  );
}

function hexToRgb(hex) {
  const normalized = hex.replace("#", "");
  const value = parseInt(normalized, 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

// 배경색(hex)에 대비되는 텍스트 색상을 밝기 기준으로 판단한다.
function getReadableTextColor(hex) {
  const { r, g, b } = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#222" : "#fff";
}

// ===== 카테고리 설정 모달 =====
function generateCategoryId() {
  return `cat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

let editingCategoryId = null;

function openCategoryModal() {
  editingCategoryId = null;
  renderCategoryList();
  renderCategoryAddForm();
  document.getElementById("category-modal-overlay").classList.remove("hidden");
}

function closeCategoryModal() {
  document.getElementById("category-modal-overlay").classList.add("hidden");
}

// 카테고리 추가/수정/삭제 후 모달 내부 UI와 할 일 폼/필터/목록/캘린더를 한 번에 재렌더링
function syncCategoryViews() {
  renderCategoryList();
  renderCategoryAddForm();
  renderCalendar();
  renderDetail();
}

function buildCategoryListItemHtml(category, isEditing) {
  const isDefault = category.id === "cat-default";

  if (isEditing) {
    const colorCirclesHtml = CATEGORY_PALETTE.map(
      (color) =>
        `<button type="button" class="color-circle ${color === category.color ? "selected" : ""}" data-color="${color}" style="background-color: ${color};" aria-label="색상 선택"></button>`
    ).join("");

    return `
      <li class="category-list-item category-list-item-editing" data-id="${category.id}">
        <form class="category-edit-form" data-id="${category.id}">
          <label>
            이름
            <input type="text" class="category-edit-name-input" value="${escapeHtml(category.name)}" />
          </label>
          <label>
            색상
            <div class="color-circle-list">${colorCirclesHtml}</div>
          </label>
          <p class="form-error category-edit-error"></p>
          <div class="form-actions">
            <button type="button" class="secondary-btn cancel-edit-category-btn" data-id="${category.id}">취소</button>
            <button type="submit" class="primary-btn">저장</button>
          </div>
        </form>
      </li>
    `;
  }

  return `
    <li class="category-list-item" data-id="${category.id}">
      <span class="category-color-chip" style="background-color: ${category.color};"></span>
      <span class="category-name">${escapeHtml(category.name)}</span>
      <div class="category-item-actions">
        <button class="edit-category-btn secondary-btn" type="button" data-id="${category.id}">수정</button>
        <button class="delete-category-btn secondary-btn" type="button" data-id="${category.id}" ${isDefault ? "disabled" : ""}>삭제</button>
      </div>
    </li>
  `;
}

function getSortedCategories() {
  const categories = getCategories();
  return [...categories].sort((a, b) => {
    if (a.id === "cat-default") return -1;
    if (b.id === "cat-default") return 1;
    return a.name.localeCompare(b.name, "ko");
  });
}

function renderCategoryList() {
  const container = document.getElementById("category-list");
  const categories = getSortedCategories();
  container.innerHTML = categories.length
    ? `<ul class="category-list">${categories
        .map((category) => buildCategoryListItemHtml(category, category.id === editingCategoryId))
        .join("")}</ul>`
    : '<p class="empty-message">등록된 카테고리가 없습니다.</p>';

  attachCategoryListEvents();
}

function attachCategoryListEvents() {
  document.querySelectorAll(".edit-category-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      editingCategoryId = btn.dataset.id;
      renderCategoryList();
    });
  });

  document.querySelectorAll(".cancel-edit-category-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      editingCategoryId = null;
      renderCategoryList();
    });
  });

  document.querySelectorAll(".delete-category-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      deleteCategory(btn.dataset.id);
    });
  });

  document.querySelectorAll(".category-edit-form").forEach((form) => {
    form.querySelectorAll(".color-circle").forEach((circle) => {
      circle.addEventListener("click", () => {
        form.querySelectorAll(".color-circle").forEach((c) => c.classList.remove("selected"));
        circle.classList.add("selected");
      });
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      handleCategoryEditSubmit(form);
    });
  });
}

function handleCategoryEditSubmit(form) {
  const id = form.dataset.id;
  const nameInput = form.querySelector(".category-edit-name-input");
  const errorEl = form.querySelector(".category-edit-error");
  const selectedCircle = form.querySelector(".color-circle.selected");
  const newName = nameInput.value.trim();
  const newColor = selectedCircle ? selectedCircle.dataset.color : CATEGORY_PALETTE[0];

  errorEl.textContent = "";

  if (!newName) {
    errorEl.textContent = "이름을 입력해주세요.";
    return;
  }

  const categories = getCategories();
  const target = categories.find((c) => c.id === id);
  if (!target) {
    return;
  }

  const isDuplicate = categories.some((c) => c.id !== id && c.name === newName);
  if (isDuplicate) {
    errorEl.textContent = "이미 존재하는 카테고리 이름입니다.";
    return;
  }

  const oldName = target.name;
  target.name = newName;
  target.color = newColor;
  saveCategories(categories);

  if (oldName !== newName) {
    state.todos.forEach((todo) => {
      if (todo.category === oldName) {
        todo.category = newName;
      }
    });
    saveTodos();

    if (state.categoryFilter === oldName) {
      state.categoryFilter = newName;
    }
  }

  editingCategoryId = null;
  syncCategoryViews();
}

function deleteCategory(id) {
  if (id === "cat-default") {
    return;
  }

  const categories = getCategories();
  const target = categories.find((c) => c.id === id);
  if (!target) {
    return;
  }

  const confirmed = confirm("이 카테고리를 사용하는 할 일은 '미분류'로 이동됩니다. 삭제하시겠습니까?");
  if (!confirmed) {
    return;
  }

  const defaultCategory = categories.find((c) => c.id === "cat-default");
  const fallbackName = defaultCategory ? defaultCategory.name : "미분류";

  const remaining = categories.filter((c) => c.id !== id);
  saveCategories(remaining);

  let todosChanged = false;
  state.todos.forEach((todo) => {
    if (todo.category === target.name) {
      todo.category = fallbackName;
      todosChanged = true;
    }
  });
  if (todosChanged) {
    saveTodos();
  }

  if (state.categoryFilter === target.name) {
    state.categoryFilter = "전체";
  }

  if (editingCategoryId === id) {
    editingCategoryId = null;
  }
  syncCategoryViews();
}

const MAX_CATEGORY_COUNT = CATEGORY_PALETTE.length;

function renderCategoryAddForm() {
  const container = document.getElementById("category-add-form");

  if (getCategories().length >= MAX_CATEGORY_COUNT) {
    container.innerHTML = `<p class="form-error">카테고리는 최대 ${MAX_CATEGORY_COUNT}개까지 만들 수 있습니다.</p>`;
    return;
  }

  const colorCirclesHtml = CATEGORY_PALETTE.map(
    (color, index) =>
      `<button type="button" class="color-circle ${index === 0 ? "selected" : ""}" data-color="${color}" style="background-color: ${color};" aria-label="색상 선택"></button>`
  ).join("");

  container.innerHTML = `
    <form id="category-add-form-el" class="category-add-form">
      <label>
        이름
        <input type="text" name="name" id="category-name-input" placeholder="새 카테고리 이름" />
      </label>
      <div class="color-circle-list">${colorCirclesHtml}</div>
      <p id="category-add-error" class="form-error"></p>
      <div class="form-actions">
        <button type="submit" class="primary-btn">추가하기</button>
      </div>
    </form>
  `;

  let selectedColor = CATEGORY_PALETTE[0];

  container.querySelectorAll(".color-circle").forEach((circle) => {
    circle.addEventListener("click", () => {
      selectedColor = circle.dataset.color;
      container.querySelectorAll(".color-circle").forEach((c) => c.classList.remove("selected"));
      circle.classList.add("selected");
    });
  });

  document.getElementById("category-add-form-el").addEventListener("submit", (event) => {
    event.preventDefault();

    const nameInput = document.getElementById("category-name-input");
    const errorEl = document.getElementById("category-add-error");
    const name = nameInput.value.trim();

    errorEl.textContent = "";

    const categories = getCategories();

    if (categories.length >= MAX_CATEGORY_COUNT) {
      errorEl.textContent = `카테고리는 최대 ${MAX_CATEGORY_COUNT}개까지 만들 수 있습니다.`;
      renderCategoryAddForm();
      return;
    }

    if (!name) {
      errorEl.textContent = "이름을 입력해주세요.";
      return;
    }

    if (categories.some((c) => c.name === name)) {
      errorEl.textContent = "이미 존재하는 카테고리 이름입니다.";
      return;
    }

    categories.push({ id: generateCategoryId(), name, color: selectedColor });
    saveCategories(categories);

    syncCategoryViews();
  });
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

// dateStr("YYYY-MM-DD")이 startDate~endDate 범위(양 끝 포함)에 속하는지 확인한다.
function isDateInRange(dateStr, startDate, endDate) {
  return dateStr >= startDate && dateStr <= endDate;
}

function maxDateStr(a, b) {
  return a > b ? a : b;
}

function minDateStr(a, b) {
  return a < b ? a : b;
}

// "YYYY-MM-DD" 문자열 두 개 사이의 일수 차이(to - from)를 구한다.
function daysBetween(fromDateStr, toDateStr) {
  return Math.round((new Date(toDateStr) - new Date(fromDateStr)) / 86400000);
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
// 기존 date 단일 필드 구조를 startDate/endDate/startTime/endTime 구조로 변환한다.
// 이미 startDate가 있는 항목은 변환 대상이 아니므로 그대로 반환한다(중복 변환 방지).
function migrateTodo(todo) {
  if (todo.startDate) {
    return { todo, changed: false };
  }

  const { date, ...rest } = todo;
  return {
    todo: {
      ...rest,
      startDate: date,
      endDate: date,
      startTime: null,
      endTime: null,
    },
    changed: true,
  };
}

function migrateTodos(rawTodos) {
  let migratedCount = 0;

  const migrated = rawTodos.map((todo) => {
    const result = migrateTodo(todo);
    if (result.changed) {
      migratedCount += 1;
    }
    return result.todo;
  });

  if (migratedCount > 0) {
    console.log(
      `[마이그레이션] date 필드만 있던 할 일 ${migratedCount}건을 startDate/endDate/startTime/endTime 구조로 변환했습니다.`,
      migrated
    );
  } else {
    console.log("[마이그레이션] 변환이 필요한 데이터가 없습니다. 기존 구조를 그대로 사용합니다.");
  }

  return { migrated, changed: migratedCount > 0 };
}

function loadTodos() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    const { migrated, changed } = migrateTodos(parsed);
    if (changed) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      console.log("[마이그레이션] 변환된 데이터를 localStorage에 다시 저장했습니다.");
    }

    return migrated;
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

const MAX_VISIBLE_LANES = 3;

// 기간이 겹치는 할 일(여러 날짜에 걸친 연속 예약)끼리는 서로 다른 레인(세로 위치)에 배치되도록
// 그리디 구간 채색을 수행한다. 캘린더에 표시되는 모든 주에 걸쳐 동일한 할 일은 항상 같은 레인을
// 사용해 막대가 자연스럽게 이어져 보인다.
function assignTodoLanes(todos, rangeStart, rangeEnd) {
  const laneLastEndDates = [];
  const todoLanes = new Map();

  const sorted = [...todos].sort(
    (a, b) => a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id)
  );

  sorted.forEach((todo) => {
    const clippedStart = maxDateStr(todo.startDate, rangeStart);
    const clippedEnd = minDateStr(todo.endDate, rangeEnd);

    let lane = laneLastEndDates.findIndex((lastEnd) => lastEnd < clippedStart);
    if (lane === -1) {
      lane = laneLastEndDates.length;
    }
    laneLastEndDates[lane] = clippedEnd;
    todoLanes.set(todo.id, lane);
  });

  return todoLanes;
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

  const categories = getSortedCategories();
  const cellsWithDate = cells.map((cell) => ({
    ...cell,
    dateStr: formatDateStr(cell.year, cell.month, cell.day),
  }));

  const rangeStart = cellsWithDate[0].dateStr;
  const rangeEnd = cellsWithDate[cellsWithDate.length - 1].dateStr;

  // 캘린더에 표시된 기간과 겹치는 할 일만 렌더링 대상으로 삼는다.
  const todosInRange = state.todos.filter(
    (t) => t.endDate >= rangeStart && t.startDate <= rangeEnd
  );
  // 여러 날짜에 걸친 연속 예약만 막대로 표시하고, 레인도 이들끼리만 계산한다.
  const continuousTodosInRange = todosInRange.filter((t) => t.startDate !== t.endDate);
  const todoLanes = assignTodoLanes(continuousTodosInRange, rangeStart, rangeEnd);

  for (let row = 0; row * 7 < cellsWithDate.length; row += 1) {
    const weekCells = cellsWithDate.slice(row * 7, row * 7 + 7);
    const weekEl = document.createElement("div");
    weekEl.className = "calendar-week";
    weekEl.innerHTML = buildWeekHtml(weekCells, todosInRange, todoLanes, categories);
    grid.appendChild(weekEl);

    weekCells.forEach(({ dateStr }) => {
      const dayEl = weekEl.querySelector(`.calendar-day[data-date="${dateStr}"]`);
      dayEl.addEventListener("click", () => onDateClick(dateStr));
    });

    weekEl.querySelectorAll(".calendar-bar").forEach((barEl) => {
      barEl.addEventListener("click", (event) => {
        event.stopPropagation();
        onBarClick(barEl.dataset.id);
      });
    });
  }
}

function buildWeekHtml(weekCells, todosInRange, todoLanes, categories) {
  const rowStart = weekCells[0].dateStr;
  const rowEnd = weekCells[weekCells.length - 1].dateStr;

  const daysHtml = weekCells
    .map(({ day, dateStr, otherMonth }) => {
      const classes = ["calendar-day"];
      if (otherMonth) classes.push("other-month");
      if (isSameDate(today.getFullYear(), today.getMonth(), today.getDate(), dateStr)) {
        classes.push("today");
      }
      if (dateStr === state.selectedDate) classes.push("selected");

      // 연속된 예약(여러 날짜에 걸친 할 일)이 아닌 하루짜리 일정은 막대 대신 점으로 표시한다.
      const categoryNamesForDate = new Set(
        todosInRange
          .filter((t) => t.startDate === t.endDate && t.startDate === dateStr)
          .map((t) => t.category)
      );
      const dotsHtml = categories
        .filter((c) => categoryNamesForDate.has(c.name))
        .map((c) => `<span class="day-dot" style="background-color: ${c.color};"></span>`)
        .join("");

      return `
        <div class="${classes.join(" ")}" data-date="${dateStr}">
          <span class="day-number">${day}</span>
          <span class="day-dots">${dotsHtml}</span>
        </div>
      `;
    })
    .join("");

  // 레인이 배정된, 즉 여러 날짜에 걸친 연속 예약만 막대로 그린다.
  const continuousTodos = todosInRange.filter((todo) => todoLanes.has(todo.id));

  const segments = continuousTodos
    .map((todo) => {
      const segStart = maxDateStr(todo.startDate, rowStart);
      const segEnd = minDateStr(todo.endDate, rowEnd);
      if (segStart > segEnd) {
        return null;
      }
      return {
        todo,
        lane: todoLanes.get(todo.id),
        colStart: daysBetween(rowStart, segStart),
        colEnd: daysBetween(rowStart, segEnd),
        continuesLeft: todo.startDate < segStart,
        continuesRight: todo.endDate > segEnd,
      };
    })
    .filter(Boolean);

  const visibleSegments = segments.filter((s) => s.lane < MAX_VISIBLE_LANES);
  const hiddenCount = segments.length - visibleSegments.length;

  const barsHtml = visibleSegments
    .map((seg) => {
      const category = findCategoryByName(categories, seg.todo.category);
      const textColor = getReadableTextColor(category.color);
      const roundClasses = [
        !seg.continuesLeft ? "bar-round-left" : "",
        !seg.continuesRight ? "bar-round-right" : "",
        seg.todo.completed ? "bar-completed" : "",
      ]
        .filter(Boolean)
        .join(" ");

      return `
        <div
          class="calendar-bar ${roundClasses}"
          data-id="${seg.todo.id}"
          title="${escapeHtml(seg.todo.title)}"
          style="grid-column: ${seg.colStart + 1} / ${seg.colEnd + 2}; grid-row: ${seg.lane + 1}; background-color: ${category.color}; color: ${textColor};"
        >${escapeHtml(seg.todo.title)}</div>
      `;
    })
    .join("");

  const moreHtml =
    hiddenCount > 0
      ? `<div class="calendar-bar-more" style="grid-row: ${MAX_VISIBLE_LANES + 1};">+${hiddenCount}개 더보기</div>`
      : "";

  const barsAreaHtml =
    barsHtml || moreHtml ? `<div class="calendar-week-bars">${barsHtml}${moreHtml}</div>` : "";

  return `
    <div class="calendar-week-days">${daysHtml}</div>
    ${barsAreaHtml}
  `;
}

function onBarClick(todoId) {
  const todo = state.todos.find((t) => t.id === todoId);
  if (!todo) {
    return;
  }
  state.selectedDate = todo.startDate;
  state.detailForm = { mode: "edit", editingId: todo.id };
  renderCalendar();
  renderDetail();
}

// ===== 상세 영역 렌더링 =====
function buildFormHtml(editingTodo, categories, defaultDate) {
  const isEdit = editingTodo !== null;
  const titleValue = isEdit ? escapeHtml(editingTodo.title) : "";
  const memoValue = isEdit ? escapeHtml(editingTodo.memo) : "";
  const startDateValue = isEdit ? editingTodo.startDate : defaultDate;
  const endDateValue = isEdit ? editingTodo.endDate : defaultDate;
  const startTimeValue = isEdit && editingTodo.startTime ? editingTodo.startTime : "";
  const endTimeValue = isEdit && editingTodo.endTime ? editingTodo.endTime : "";
  const optionsHtml = categories
    .map((cat) => {
      const selected = isEdit && editingTodo.category === cat.name ? "selected" : "";
      return `<option value="${escapeHtml(cat.name)}" ${selected}>${escapeHtml(cat.name)}</option>`;
    })
    .join("");

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
      <div class="date-range-fields">
        <label>
          시작일
          <input type="date" name="startDate" value="${startDateValue}" required />
        </label>
        <label>
          종료일
          <input type="date" name="endDate" value="${endDateValue}" required />
        </label>
      </div>
      <div class="time-range-fields">
        <label>
          시작 시간
          <input type="time" name="startTime" value="${startTimeValue}" />
        </label>
        <label>
          종료 시간
          <input type="time" name="endTime" value="${endTimeValue}" />
        </label>
        <p class="form-hint">시간을 비워두면 종일 일정으로 등록됩니다.</p>
      </div>
      <label>
        메모
        <textarea name="memo">${memoValue}</textarea>
      </label>
      <p class="form-error todo-form-error"></p>
      <div class="form-actions">
        <button type="button" id="cancel-form-btn" class="secondary-btn">취소</button>
        <button type="submit" class="primary-btn">저장</button>
      </div>
    </form>
  `;
}

// 종료일이 시작일보다 빠르거나, 같은 날짜에서 종료 시간이 시작 시간보다 빠르면 오류 메시지를 반환한다.
function validateTodoFormDates({ startDate, endDate, startTime, endTime }) {
  if (endDate < startDate) {
    return "종료일은 시작일보다 빠를 수 없습니다";
  }

  if (startTime && endTime && startDate === endDate && endTime < startTime) {
    return "종료 시간은 시작 시간보다 빠를 수 없습니다";
  }

  return null;
}

// 시간이 있으면 "14:00" 형태의 시작 시간을, 없으면 "종일"을 반환한다.
function getTodoTimeLabel(todo) {
  return todo.startTime || "종일";
}

// 여러 날에 걸친 할 일이면 "(3일차/5일)" 형태의 진행 표시를, 하루짜리면 빈 문자열을 반환한다.
function getTodoDayProgressLabel(todo, selectedDate) {
  if (todo.startDate === todo.endDate) {
    return "";
  }
  const totalDays = daysBetween(todo.startDate, todo.endDate) + 1;
  const currentDay = daysBetween(todo.startDate, selectedDate) + 1;
  return ` (${currentDay}일차/${totalDays}일)`;
}

// 상세 목록 정렬: 종일 일정을 먼저, 그 다음 시간이 있는 일정을 시작 시간 순으로 배치한다.
function sortTodosByTime(todos) {
  return [...todos].sort((a, b) => {
    if (!a.startTime !== !b.startTime) {
      return a.startTime ? 1 : -1;
    }
    if (a.startTime && b.startTime) {
      return a.startTime.localeCompare(b.startTime);
    }
    return 0;
  });
}

function buildTodoItemHtml(todo, categories, selectedDate) {
  const category = findCategoryByName(categories, todo.category);
  const textColor = getReadableTextColor(category.color);
  const timeLabel = getTodoTimeLabel(todo);
  const dayProgressLabel = getTodoDayProgressLabel(todo, selectedDate);
  return `
    <li class="todo-item ${todo.completed ? "completed" : ""}" data-id="${todo.id}" style="border-left-color: ${category.color};">
      <label class="todo-check">
        <input type="checkbox" class="todo-complete-checkbox" data-id="${todo.id}" ${todo.completed ? "checked" : ""} />
      </label>
      <div class="todo-main">
        <div class="todo-title-row">
          <span class="todo-category-badge" style="background-color: ${category.color}; color: ${textColor};">${escapeHtml(todo.category)}</span>
          <span class="todo-time-badge">${timeLabel}</span>
          <span class="todo-title">${escapeHtml(todo.title)}${dayProgressLabel}</span>
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

function buildCategoryFilterHtml(categories) {
  const options = ["전체", ...categories.map((c) => c.name)];
  return `
    <div class="category-filter">
      ${options
        .map(
          (opt) =>
            `<button type="button" class="filter-btn ${state.categoryFilter === opt ? "active" : ""}" data-filter="${escapeHtml(opt)}">${escapeHtml(opt)}</button>`
        )
        .join("")}
    </div>
  `;
}

function renderDetail() {
  const container = document.getElementById("detail-content");
  const categories = getSortedCategories();

  const [y, m, d] = state.selectedDate.split("-").map(Number);
  const dateObj = new Date(y, m - 1, d);
  const weekdayLabel = `${WEEKDAY_LABELS[dateObj.getDay()]}요일`;
  const dateLabel = `${y}년 ${m}월 ${d}일 ${weekdayLabel}`;

  const todosForDate = sortTodosByTime(
    state.todos.filter(
      (t) =>
        isDateInRange(state.selectedDate, t.startDate, t.endDate) &&
        (state.categoryFilter === "전체" || t.category === state.categoryFilter)
    )
  );

  const { mode, editingId } = state.detailForm;
  let formHtml = "";
  if (mode === "add") {
    formHtml = buildFormHtml(null, categories, state.selectedDate);
  } else if (mode === "edit") {
    const editingTodo = state.todos.find((t) => t.id === editingId) || null;
    formHtml = buildFormHtml(editingTodo, categories, state.selectedDate);
  }

  const listHtml = todosForDate.length
    ? todosForDate.map((todo) => buildTodoItemHtml(todo, categories, state.selectedDate)).join("")
    : '<p class="empty-message">등록된 할 일이 없습니다.</p>';

  container.innerHTML = `
    <div class="detail-header">
      <h2>${dateLabel}</h2>
      <div class="detail-header-actions">
        ${mode === null ? '<button id="add-todo-btn" class="primary-btn" type="button">+ 할 일 추가</button>' : ""}
        <button id="category-settings-btn" class="secondary-btn" type="button">카테고리 설정</button>
      </div>
    </div>
    ${buildCategoryFilterHtml(categories)}
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

  const categorySettingsBtn = document.getElementById("category-settings-btn");
  if (categorySettingsBtn) {
    categorySettingsBtn.addEventListener("click", openCategoryModal);
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
  const formValues = {
    title: form.title.value.trim(),
    category: form.category.value,
    startDate: form.startDate.value,
    endDate: form.endDate.value,
    startTime: form.startTime.value || null,
    endTime: form.endTime.value || null,
    memo: form.memo.value.trim(),
  };
  const errorEl = form.querySelector(".todo-form-error");

  if (!formValues.title) {
    return;
  }

  const errorMessage = validateTodoFormDates(formValues);
  if (errorMessage) {
    errorEl.textContent = errorMessage;
    return;
  }
  errorEl.textContent = "";

  if (state.detailForm.mode === "add") {
    state.todos.push({
      id: generateId(),
      ...formValues,
      completed: false,
      createdAt: new Date().toISOString(),
    });
  } else if (state.detailForm.mode === "edit") {
    const todo = state.todos.find((t) => t.id === state.detailForm.editingId);
    if (todo) {
      Object.assign(todo, formValues);
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

const categoryModalOverlay = document.getElementById("category-modal-overlay");
categoryModalOverlay.addEventListener("click", (event) => {
  if (event.target === categoryModalOverlay) {
    closeCategoryModal();
  }
});
document.getElementById("category-modal-close-btn").addEventListener("click", closeCategoryModal);

renderWeekdayHeader();
renderCalendar();
renderDetail();

console.log("카테고리 목록:", getCategories());
