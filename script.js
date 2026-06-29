document.addEventListener("DOMContentLoaded", () => {
    loadSettings();
    renderInventory(); 
    setInvoiceDefaults();
    ensureTrailingEmptyRow(); 
    renderHistory();
});

function toggleTheme() {
    const body = document.body;
    if (body.getAttribute('data-theme') === 'dark') {
        body.removeAttribute('data-theme');
    } else {
        body.setAttribute('data-theme', 'dark');
    }
}

// --- Validation & Actions ---
function cleanEmptyRows() {
    const rows = document.querySelectorAll('#itemsBody tr');
    rows.forEach(row => {
        const desc = row.querySelector('.item-desc').value.trim();
        const price = parseFloat(row.querySelector('.item-price').value) || 0;
        
        if (desc === '' && price === 0) {
            row.remove();
        }
    });
}

function isInvoiceValid() {
    cleanEmptyRows(); 
    
    const tbody = document.getElementById('itemsBody');
    if (tbody.children.length === 0) {
        alert("Please add at least one item to the invoice.");
        ensureTrailingEmptyRow(); 
        return false;
    }

    const form = document.getElementById('invoiceForm');
    const isValid = form.reportValidity(); 
    
    if (!isValid) ensureTrailingEmptyRow(); 
    
    return isValid;
}

function validateAndPrint() {
    if (isInvoiceValid()) {
        saveCurrentInvoice(); // Automatically saves/updates the history silently
        window.print();
        ensureTrailingEmptyRow(); 
    }
}

function startNewInvoice() {
    if(confirm("Start a new invoice? Any unsaved changes on the screen will be lost.")) {
        setInvoiceDefaults();
        document.getElementById('clientInfo').value = '';
        document.getElementById('discountPercent').value = '0';
        document.getElementById('itemsBody').innerHTML = '';
        ensureTrailingEmptyRow();
        calculateTotals();
    }
}

// --- Settings & Inventory Logic ---
function saveSettings() {
    const bizData = {
        name: document.getElementById('bizName').value,
        address: document.getElementById('bizAddress').value,
        contact: document.getElementById('bizContact').value
    };
    localStorage.setItem('businessInfo', JSON.stringify(bizData));
    loadSettings();
    alert("Business details saved!");
}

function loadSettings() {
    const savedData = JSON.parse(localStorage.getItem('businessInfo'));
    if (savedData) {
        document.getElementById('bizName').value = savedData.name || '';
        document.getElementById('bizAddress').value = savedData.address || '';
        document.getElementById('bizContact').value = savedData.contact || '';
        
        document.getElementById('displayBizName').innerText = savedData.name || "Your Business Name";
        document.getElementById('displayBizAddress').innerText = savedData.address || "Your Address";
        document.getElementById('displayBizContact').innerText = savedData.contact || "Your Contact";
    }
}

function getProducts() { return JSON.parse(localStorage.getItem('products')) || []; }

function saveProduct() {
    const name = document.getElementById('prodName').value.trim();
    const price = document.getElementById('prodPrice').value;
    const unit = document.getElementById('prodUnit').value;

    if (!name || !price) { alert("Please enter product name and price."); return; }

    let products = getProducts();
    const existingIndex = products.findIndex(p => p.name.toLowerCase() === name.toLowerCase());
    
    if (existingIndex >= 0) products[existingIndex] = { name, price, unit };
    else products.push({ name, price, unit });

    localStorage.setItem('products', JSON.stringify(products));
    document.getElementById('prodName').value = '';
    document.getElementById('prodPrice').value = '';
    renderInventory();
}

function deleteProduct(name) {
    let products = getProducts().filter(p => p.name !== name);
    localStorage.setItem('products', JSON.stringify(products));
    renderInventory();
}

function renderInventory() {
    const products = getProducts();
    const tbody = document.getElementById('inventoryBody');
    const datalist = document.getElementById('saved-products-list');
    
    tbody.innerHTML = ''; datalist.innerHTML = ''; 

    products.forEach(p => {
        tbody.innerHTML += `
            <tr>
                <td><strong>${p.name}</strong></td>
                <td style="color:var(--text-muted);">₹${p.price}/${p.unit}</td>
                <td class="text-right no-print">
                    <button class="btn-ghost" onclick="deleteProduct('${p.name}')" title="Delete">❌</button>
                </td>
            </tr>
        `;
        datalist.innerHTML += `<option value="${p.name}">`;
    });
}

function setInvoiceDefaults() {
    document.getElementById('invoiceDate').innerText = new Date().toLocaleDateString();
    document.getElementById('invoiceNum').innerText = "INV-" + Math.floor(Math.random() * 10000);
}

// --- Smart Row Generation Engine ---
function handleItemInput(elem) {
    if (elem.classList.contains('item-desc')) autoFillProduct(elem);
    calculateTotals();
    ensureTrailingEmptyRow(); 
}

function ensureTrailingEmptyRow() {
    const tbody = document.getElementById('itemsBody');
    const rows = tbody.querySelectorAll('tr');
    
    if (rows.length === 0) {
        addInvoiceItem();
        return;
    }

    const lastRow = rows[rows.length - 1];
    const desc = lastRow.querySelector('.item-desc').value.trim();
    const price = parseFloat(lastRow.querySelector('.item-price').value) || 0;

    if (desc !== '' || price !== 0) addInvoiceItem();
}

function addInvoiceItem() {
    const tbody = document.getElementById('itemsBody');
    const tr = document.createElement('tr');

    tr.innerHTML = `
        <td><input type="text" list="saved-products-list" placeholder="Type item name..." class="item-desc" oninput="handleItemInput(this)" required></td>
        <td><input type="number" value="1" min="1" class="item-qty" oninput="handleItemInput(this)" required></td>
        <td><span class="item-unit" style="color:#64748B; font-size:0.9rem;">pcs</span></td>
        <td><input type="number" value="0" min="0" class="item-price" oninput="handleItemInput(this)" required></td>
        <td class="item-total" style="font-weight:500;">₹0.00</td>
        <td class="no-print"><button type="button" class="btn-remove" onclick="removeRow(this)" title="Remove Row">×</button></td>
    `;
    tbody.appendChild(tr);
}

function autoFillProduct(inputElem) {
    const products = getProducts();
    const selectedProduct = products.find(p => p.name === inputElem.value);
    const row = inputElem.closest('tr');

    if (selectedProduct) {
        row.querySelector('.item-price').value = selectedProduct.price;
        row.querySelector('.item-unit').innerText = selectedProduct.unit;
        calculateTotals();
    }
}

function removeRow(btn) {
    btn.closest('tr').remove();
    calculateTotals();
    ensureTrailingEmptyRow(); 
}

function calculateTotals() {
    const rows = document.querySelectorAll('#itemsBody tr');
    let subtotal = 0;

    rows.forEach(row => {
        const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
        const price = parseFloat(row.querySelector('.item-price').value) || 0;
        const total = qty * price;
        
        row.querySelector('.item-total').innerText = `₹${total.toFixed(2)}`;
        subtotal += total;
    });

    const discountPercent = parseFloat(document.getElementById('discountPercent').value) || 0;
    const discountAmount = subtotal * (discountPercent / 100);
    const discountedSubtotal = subtotal - discountAmount;

    const tax = discountedSubtotal * 0.10; 
    const grandTotal = discountedSubtotal + tax;

    document.getElementById('subtotal').innerText = subtotal.toFixed(2);
    document.getElementById('discountAmount').innerText = discountAmount.toFixed(2);
    document.getElementById('tax').innerText = tax.toFixed(2);
    document.getElementById('grandTotal').innerText = grandTotal.toFixed(2);
}

// --- NEW: Refined Invoice History Logic ---
function saveCurrentInvoice() {
    const invNum = document.getElementById('invoiceNum').innerText;
    const date = document.getElementById('invoiceDate').innerText;
    const client = document.getElementById('clientInfo').value.split('\n'); 
    const total = document.getElementById('grandTotal').innerText;

    const invoiceData = { invNum, date, client, total };
    let history = JSON.parse(localStorage.getItem('invoiceHistory')) || [];
    
    // Check if this invoice is already saved. If yes, UPDATE it. If no, ADD it.
    const existingIndex = history.findIndex(inv => inv.invNum === invNum);
    
    if (existingIndex >= 0) {
        history[existingIndex] = invoiceData; // Update
    } else {
        history.unshift(invoiceData); // Add as new to the top
    }

    localStorage.setItem('invoiceHistory', JSON.stringify(history));
    renderHistory();
}

function renderHistory() {
    const history = JSON.parse(localStorage.getItem('invoiceHistory')) || [];
    const tbody = document.getElementById('historyBody');
    tbody.innerHTML = '';

    if (history.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: var(--text-muted);">No past invoices found.</td></tr>`;
        return;
    }

    history.forEach(inv => {
        tbody.innerHTML += `
            <tr>
                <td><strong>${inv.invNum}</strong></td>
                <td>${inv.date}</td>
                <td>${inv.client}</td>
                <td><strong>₹${inv.total}</strong></td>
                <td class="text-right">
                    <button class="btn-ghost" onclick="deleteInvoice('${inv.invNum}')" title="Delete Invoice">🗑️</button>
                </td>
            </tr>
        `;
    });
}

function deleteInvoice(invNum) {
    if(confirm(`Are you sure you want to delete invoice ${invNum}?`)) {
        let history = JSON.parse(localStorage.getItem('invoiceHistory')) || [];
        // Filter out the specific invoice
        history = history.filter(inv => inv.invNum !== invNum);
        localStorage.setItem('invoiceHistory', JSON.stringify(history));
        renderHistory();
    }
}

function clearHistory() {
    if(confirm("Are you sure you want to delete ALL invoice history? This cannot be undone.")) {
        localStorage.removeItem('invoiceHistory');
        renderHistory();
    }
}