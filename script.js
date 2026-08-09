
const STORAGE_KEY = 'stockbite_transactions';

const CATEGORIES = {
    income: ['การขาย', 'รายรับอื่น', 'คืนเงิน', 'อื่น ๆ'],
    expense: ['วัตถุดิบ', 'เครื่องดื่ม', 'ขนส่ง', 'ค่าอุปกรณ์', 'ค่าแรง', 'ค่าน้ำ/ค่าไฟ', 'ค่าใช้จ่ายอื่น'],
};

const DAY_LABELS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];

let transactions = [];
let dashRange = 'today';
let addType = 'income';
let pendingDeleteId = null;

function pad(n) { return String(n).padStart(2, '0'); }

function toISODate(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function todayISO() { return toISODate(new Date()); }

function daysAgoISO(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return toISODate(d);
}

function formatBaht(n) {
    return new Intl.NumberFormat('th-TH').format(Math.round(n)) + ' ฿';
}

function formatDateLabel(iso) {
    const [y, m, d] = iso.split('-');
    const dt = new Date(Number(y), Number(m) - 1, Number(d));
    if (iso === todayISO()) return 'วันนี้';
    if (iso === daysAgoISO(1)) return 'เมื่อวาน';
    return `${d}/${m}`;
}

function loadTransactions() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed;
        }
    } catch (e) {
        console.warn('โหลดข้อมูลไม่สำเร็จ', e);
    }
    return null;
}

function saveTransactions() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    } catch (e) {
        console.warn('บันทึกข้อมูลไม่สำเร็จ', e);
    }
}

function makeId() {
    return 'tx_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function sampleData() {
    const rows = [
        [0, 'income', 850, 'การขาย', 'ขายขนมช่วงเช้า', '08:45'],
        [0, 'income', 1200, 'การขาย', 'ขายเครื่องดื่มปั่น', '10:20'],
        [0, 'expense', 480, 'วัตถุดิบ', 'ซื้อแป้งและน้ำตาล', '07:30'],
        [0, 'income', 640, 'การขาย', 'ขายสินค้าหน้าร้าน', '12:15'],
        [0, 'expense', 120, 'เครื่องดื่ม', 'ซื้อนมสด', '09:10'],
        [1, 'income', 1500, 'การขาย', 'ออเดอร์จัดเลี้ยง', '14:00'],
        [1, 'expense', 900, 'วัตถุดิบ', 'ผักและผลไม้', '06:50'],
        [1, 'income', 320, 'การขาย', 'ขายน้ำผลไม้', '16:30'],
        [1, 'expense', 250, 'ขนส่ง', 'ค่าส่งของ', '11:00'],
        [2, 'income', 1080, 'การขาย', 'ขายขนมเบเกอรี่', '09:40'],
        [2, 'expense', 1350, 'ค่าอุปกรณ์', 'ซื้อเครื่องปั่นใหม่', '13:20'],
        [3, 'income', 560, 'การขาย', 'ขายเครื่องดื่ม', '10:05'],
        [3, 'expense', 300, 'ค่าน้ำ/ค่าไฟ', 'ค่าไฟประจำสัปดาห์', '15:45'],
        [4, 'income', 1750, 'การขาย', 'ขายดีวันหยุด', '11:30'],
        [4, 'expense', 600, 'ค่าแรง', 'ค่าจ้างพนักงานพาร์ทไทม์', '18:00'],
        [5, 'income', 430, 'รายรับอื่น', 'เงินทอนคืนจากซัพพลายเออร์', '09:00'],
        [5, 'expense', 720, 'วัตถุดิบ', 'ซื้อวัตถุดิบเพิ่ม', '07:15'],
        [6, 'income', 980, 'การขาย', 'ขายขนมและกาแฟ', '08:20'],
        [6, 'expense', 180, 'เครื่องดื่ม', 'ซื้อกาแฟบด', '08:00'],
    ];
    return rows.map(([off, type, amount, category, description, time]) => ({
        id: makeId(),
        type,
        amount,
        category,
        description,
        date: daysAgoISO(off),
        time,
    }));
}

function rangeStartISO(range) {
    if (range === 'today') return todayISO();
    if (range === '7d') return daysAgoISO(6);
    if (range === 'month') {
        const d = new Date();
        return toISODate(new Date(d.getFullYear(), d.getMonth(), 1));
    }
    return '0000-00-00';
}

function filterByRange(range) {
    const start = rangeStartISO(range);
    const end = todayISO();
    return transactions.filter(t => t.date >= start && t.date <= end);
}

function sortByDateDesc(list) {
    return [...list].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
}

function totals(list) {
    let income = 0, expense = 0;
    list.forEach(t => {
        if (t.type === 'income') income += t.amount;
        else expense += t.amount;
    });
    return { income, expense, profit: income - expense, count: list.length };
}

function renderSummaryCards(el, list) {
    const t = totals(list);
    const profitSign = t.profit < 0 ? '-' : '';
    el.innerHTML = `
        <div class="stat-card c-income">
            <div class="stat-top"><span class="stat-label">รายรับทั้งหมด</span></div>
            <div class="stat-value">${formatBaht(t.income)}</div>
        </div>
        <div class="stat-card c-expense">
            <div class="stat-top"><span class="stat-label">รายจ่ายทั้งหมด</span></div>
            <div class="stat-value">${formatBaht(t.expense)}</div>
        </div>
        <div class="stat-card c-profit">
            <div class="stat-top"><span class="stat-label">กำไรสุทธิ</span></div>
            <div class="stat-value">${profitSign}${formatBaht(Math.abs(t.profit))}</div>
        </div>
        <div class="stat-card c-count">
            <div class="stat-top"><span class="stat-label">จำนวนรายการ</span></div>
            <div class="stat-value">${t.count} <small>รายการ</small></div>
        </div>`;
}

function renderBarChart(el) {
    const days = [];
    for (let i = 6; i >= 0; i--) {
        const iso = daysAgoISO(i);
        const dayTx = transactions.filter(t => t.date === iso);
        const t = totals(dayTx);
        const dow = new Date(iso + 'T00:00:00').getDay();
        days.push({ iso, income: t.income, expense: t.expense, label: DAY_LABELS[dow] });
    }
    const max = Math.max(1, ...days.map(d => Math.max(d.income, d.expense)));

    el.innerHTML = days.map(d => {
        const ih = Math.round((d.income / max) * 100);
        const eh = Math.round((d.expense / max) * 100);
        const inTitle = `${formatBaht(d.income)}`;
        const exTitle = `${formatBaht(d.expense)}`;
        return `
        <div class="chart-col">
            <div class="chart-bars">
                <div class="bar bar-income" style="height:${ih}%" title="รายรับ ${inTitle}"></div>
                <div class="bar bar-expense" style="height:${eh}%" title="รายจ่าย ${exTitle}"></div>
            </div>
            <span class="chart-day">${d.label}</span>
        </div>`;
    }).join('');
}

function renderCategoryBreakdown(el, list) {
    const expenses = list.filter(t => t.type === 'expense');
    if (expenses.length === 0) {
        el.innerHTML = `<p class="empty-msg" style="text-align:center;color:var(--ink-soft)">ยังไม่มีรายจ่ายในช่วงนี้</p>`;
        return;
    }
    const byCat = {};
    expenses.forEach(t => { byCat[t.category] = (byCat[t.category] || 0) + t.amount; });
    const entries = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
    const max = entries[0][1];

    el.innerHTML = entries.map(([cat, amt]) => {
        const w = Math.round((amt / max) * 100);
        return `
        <div class="cat-row">
            <div class="cat-top">
                <span class="cat-name">${cat}</span>
                <span class="cat-amt">${formatBaht(amt)}</span>
            </div>
            <div class="cat-track"><div class="cat-fill" style="width:${w}%"></div></div>
        </div>`;
    }).join('');
}

function txItemHTML(t) {
    const sign = t.type === 'income' ? '+' : '-';
    return `
    <div class="tx-item">
        <div class="tx-mid">
            <div class="tx-name">${escapeHTML(t.description)}</div>
            <div class="tx-meta">
                <span class="tx-badge">${t.category}</span>
                <span>${formatDateLabel(t.date)} · ${t.time}</span>
            </div>
        </div>
        <div class="tx-right">
            <span class="tx-amt ${t.type}">${sign}${formatBaht(t.amount)}</span>
            <button class="tx-del" data-del="${t.id}" aria-label="ลบรายการ" title="ลบรายการ">ลบ</button>
        </div>
    </div>`;
}

function renderTransactions(el, list, emptyMsg) {
    if (list.length === 0) {
        el.innerHTML = `
        <div class="empty">
            <p class="empty-msg">${emptyMsg}</p>
            <button class="btn-primary" data-action="open-add">เพิ่มรายการ</button>
        </div>`;
        return;
    }
    el.innerHTML = sortByDateDesc(list).map(txItemHTML).join('');
}

function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, c => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
}

function renderDashboard() {
    const list = filterByRange(dashRange);
    const t = totals(list);

    document.getElementById('hero-income').textContent = formatBaht(t.income);
    document.getElementById('hero-expense').textContent = formatBaht(t.expense);
    const profitEl = document.getElementById('hero-profit');
    const profitSign = t.profit < 0 ? '-' : '';
    profitEl.textContent = profitSign + formatBaht(Math.abs(t.profit));
    profitEl.style.color = t.profit < 0 ? 'var(--expense-text)' : '';

    const rangeText = { today: 'วันนี้', '7d': '7 วันล่าสุด', month: 'เดือนนี้' }[dashRange];
    document.getElementById('filter-hint').textContent = `${t.count} รายการ`;

    renderBarChart(document.getElementById('bar-chart'));
    renderCategoryBreakdown(document.getElementById('category-breakdown'), list);
    document.getElementById('dash-tx-count').textContent = `${list.length} รายการ · ${rangeText}`;
    renderTransactions(
        document.getElementById('dash-transactions'),
        list,
        dashRange === 'today' ? 'ยังไม่มีรายการวันนี้' : 'ยังไม่มีรายการในช่วงนี้'
    );
}

function getReportFilters() {
    return {
        from: document.getElementById('report-from').value,
        to: document.getElementById('report-to').value,
        type: document.getElementById('report-type').value,
        category: document.getElementById('report-category').value,
    };
}

function renderReport() {
    const f = getReportFilters();
    let list = transactions.filter(t => {
        if (f.from && t.date < f.from) return false;
        if (f.to && t.date > f.to) return false;
        if (f.type !== 'all' && t.type !== f.type) return false;
        if (f.category && f.category !== 'all' && t.category !== f.category) return false;
        return true;
    });

    renderSummaryCards(document.getElementById('report-cards'), list);
    document.getElementById('report-tx-count').textContent = `${list.length} รายการ`;
    renderTransactions(
        document.getElementById('report-transactions'),
        list,
        'ไม่พบรายการตามเงื่อนไข'
    );
}

function populateReportCategoryFilter() {
    const sel = document.getElementById('report-category');
    const all = ['all', ...CATEGORIES.income, ...CATEGORIES.expense];
    sel.innerHTML = all.map(c =>
        `<option value="${c}">${c === 'all' ? 'ทุกหมวดหมู่' : c}</option>`
    ).join('');
}

function renderMore() {
    document.getElementById('more-total-count').textContent = `${transactions.length} รายการ`;
    const email = localStorage.getItem('stockbite_email') || '—';
    document.getElementById('more-email').textContent = email;
}

function navigate(view) {
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    const target = document.getElementById('view-' + view);
    if (target) target.classList.remove('hidden');

    document.querySelectorAll('.nav-item').forEach(n =>
        n.classList.toggle('is-active', n.dataset.view === view));
    document.querySelectorAll('.bn-item[data-view]').forEach(n =>
        n.classList.toggle('is-active', n.dataset.view === view));

    if (view === 'dashboard') renderDashboard();
    if (view === 'report') renderReport();
    if (view === 'more') renderMore();

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showApp() {
    document.getElementById('login-page').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    navigate('dashboard');
}

function logout() {
    document.getElementById('app').classList.add('hidden');
    document.getElementById('login-page').classList.remove('hidden');
    window.scrollTo({ top: 0 });
}

function openAddModal() {
    document.getElementById('add-date').value = todayISO();
    const now = new Date();
    document.getElementById('add-time').value = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    document.getElementById('add-amount').value = '';
    document.getElementById('add-description').value = '';
    setAddType('income');
    document.getElementById('add-modal').classList.remove('hidden');
    document.getElementById('add-amount').focus();
}

function closeAddModal() {
    document.getElementById('add-modal').classList.add('hidden');
}

function setAddType(type) {
    addType = type;
    document.querySelectorAll('.type-btn').forEach(b =>
        b.classList.toggle('is-active', b.dataset.type === type));
    const sel = document.getElementById('add-category');
    sel.innerHTML = CATEGORIES[type].map(c => `<option value="${c}">${c}</option>`).join('');
}

function handleAddSubmit(e) {
    e.preventDefault();
    const amount = parseFloat(document.getElementById('add-amount').value);
    if (!amount || amount <= 0) {
        alert('กรุณากรอกจำนวนเงินให้ถูกต้อง');
        return;
    }
    const tx = {
        id: makeId(),
        type: addType,
        amount,
        category: document.getElementById('add-category').value,
        description: document.getElementById('add-description').value.trim() || document.getElementById('add-category').value,
        date: document.getElementById('add-date').value || todayISO(),
        time: document.getElementById('add-time').value || '00:00',
    };
    transactions.push(tx);
    saveTransactions();
    closeAddModal();

    const activeView = document.querySelector('.view:not(.hidden)').id.replace('view-', '');
    navigate(activeView);
}

function openDeleteModal(id) {
    pendingDeleteId = id;
    document.getElementById('delete-modal').classList.remove('hidden');
}

function closeDeleteModal() {
    pendingDeleteId = null;
    document.getElementById('delete-modal').classList.add('hidden');
}

function confirmDeleteTransaction() {
    if (!pendingDeleteId) return;
    transactions = transactions.filter(t => t.id !== pendingDeleteId);
    saveTransactions();
    closeDeleteModal();
    const activeView = document.querySelector('.view:not(.hidden)').id.replace('view-', '');
    navigate(activeView);
}

function resetData() {
    if (!confirm('รีเซ็ตเป็นข้อมูลตัวอย่างใหม่? ข้อมูลปัจจุบันจะถูกลบ')) return;
    transactions = sampleData();
    saveTransactions();
    navigate('dashboard');
}

function initEvents() {
    // Login
    document.getElementById('login-form').addEventListener('submit', e => {
        e.preventDefault();
        const email = document.getElementById('login-email').value.trim();
        if (email) localStorage.setItem('stockbite_email', email);
        showApp();
    });

    document.querySelectorAll('[data-view]').forEach(btn => {
        btn.addEventListener('click', () => navigate(btn.dataset.view));
    });

    document.getElementById('dash-filter').addEventListener('click', e => {
        const btn = e.target.closest('.seg');
        if (!btn) return;
        dashRange = btn.dataset.range;
        document.querySelectorAll('#dash-filter .seg').forEach(s =>
            s.classList.toggle('is-active', s === btn));
        renderDashboard();
    });

    ['report-from', 'report-to', 'report-type', 'report-category'].forEach(id => {
        document.getElementById(id).addEventListener('change', renderReport);
    });

    document.querySelectorAll('.type-btn').forEach(b => {
        b.addEventListener('click', () => setAddType(b.dataset.type));
    });

    document.getElementById('add-form').addEventListener('submit', handleAddSubmit);

    document.body.addEventListener('click', e => {
        const actionEl = e.target.closest('[data-action]');
        if (actionEl) {
            const action = actionEl.dataset.action;
            if (action === 'open-add') openAddModal();
            else if (action === 'close-add') closeAddModal();
            else if (action === 'close-delete') closeDeleteModal();
            else if (action === 'confirm-delete') confirmDeleteTransaction();
            else if (action === 'logout') logout();
            else if (action === 'reset-data') resetData();
            return;
        }
        const delEl = e.target.closest('[data-del]');
        if (delEl) openDeleteModal(delEl.dataset.del);
    });

    document.getElementById('add-modal').addEventListener('click', e => {
        if (e.target.id === 'add-modal') closeAddModal();
    });
    document.getElementById('delete-modal').addEventListener('click', e => {
        if (e.target.id === 'delete-modal') closeDeleteModal();
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            closeAddModal();
            closeDeleteModal();
        }
    });
}

function init() {
    const loaded = loadTransactions();
    if (loaded && loaded.length) {
        transactions = loaded;
    } else {
        transactions = sampleData();
        saveTransactions();
    }
    populateReportCategoryFilter();
    
    document.getElementById('report-from').value = daysAgoISO(6);
    document.getElementById('report-to').value = todayISO();
    document.getElementById('report-category').value = 'all';

    setAddType('income');
    initEvents();
}

document.addEventListener('DOMContentLoaded', init);