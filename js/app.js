const API_BASE = '/.netlify/functions';

class GmailStockManager {
    constructor() {
        this.stock = [];
        this.activities = [];
        this.price = this.getPrice();
        this.init();
    }

    async init() {
        await this.refresh();
        this.setupEventListeners();
        this.renderPrice();
    }

    setupEventListeners() {
        document.getElementById('add-btn').onclick = () => this.handleAddGmail();
        document.getElementById('export-btn').onclick = () => this.exportStock();
        document.getElementById('refresh-btn').onclick = () => this.refresh();
        document.getElementById('backup-btn').onclick = () => this.backupData();
        document.getElementById('clear-sold-btn').onclick = () => this.clearSoldItems();
        document.getElementById('clear-all-btn').onclick = () => this.confirmClearAll();
        document.getElementById('confirm-action-btn').onclick = () => this.confirmAction();
        document.getElementById('cancel-modal-btn').onclick = () => this.closeModal();
        document.getElementById('set-price-btn').onclick = () => this.setPrice();

        document.getElementById('newPassword').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleAddGmail();
        });
        document.getElementById('price-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.setPrice();
        });
    }

    async refresh() {
        await Promise.all([
            this.loadStock(),
            this.loadActivities(),
            this.updateStats()
        ]);
        this.renderStock();
        this.renderActivities();
    }

    async loadStock() {
        try {
            const response = await fetch(`${API_BASE}/stock`);
            const result = await response.json();
            if (result.success) {
                this.stock = result.data;
            } else {
                this.stock = [];
            }
        } catch (error) {
            this.stock = [];
            this.showNotification('Failed to load stock', 'error');
        }
    }

    async loadActivities() {
        try {
            const response = await fetch(`${API_BASE}/activities`);
            const result = await response.json();
            if (result.success) {
                this.activities = result.data;
            } else {
                this.activities = [];
            }
        } catch (error) {
            this.activities = [];
            this.showNotification('Failed to load activities', 'error');
        }
    }

    async updateStats() {
        try {
            const response = await fetch(`${API_BASE}/stats`);
            const result = await response.json();
            if (result.success) {
                document.getElementById('totalStock') && (document.getElementById('totalStock').textContent = result.data.totalStock || 0);
                document.getElementById('availableStock') && (document.getElementById('availableStock').textContent = result.data.availableStock || 0);
                document.getElementById('soldCount') && (document.getElementById('soldCount').textContent = result.data.soldCount || 0);
                document.getElementById('revenue') && (document.getElementById('revenue').textContent = `${result.data.soldCount * this.price} WL`);
            }
        } catch (error) {
            this.showNotification('Failed to load stats', 'error');
        }
    }

    async handleAddGmail() {
        const email = document.getElementById('newEmail').value.trim();
        const password = document.getElementById('newPassword').value.trim();
        if (!email || !password) {
            this.showNotification('Please enter both email and password!', 'error');
            return;
        }
        const success = await this.addGmail(email, password);
        if (success) {
            document.getElementById('newEmail').value = '';
            document.getElementById('newPassword').value = '';
        }
    }

    async addGmail(email, password) {
        try {
            const response = await fetch(`${API_BASE}/stock`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'add', email, password })
            });
            const result = await response.json();
            if (result.success) {
                await this.refresh();
                this.showNotification('Gmail account added!', 'success');
                return true;
            } else {
                this.showNotification(result.error || 'Failed to add Gmail', 'error');
                return false;
            }
        } catch (error) {
            this.showNotification('Error adding Gmail account', 'error');
            return false;
        }
    }

    confirmRemove(id) {
        this.pendingRemoveId = id;
        this.pendingAction = 'remove';
        document.getElementById('modalTitle').textContent = 'Remove Gmail Account';
        document.getElementById('modalMessage').textContent = 'Are you sure you want to remove this Gmail account?';
        document.getElementById('confirmModal').style.display = 'block';
    }

    confirmClearAll() {
        this.pendingAction = 'clearAll';
        document.getElementById('modalTitle').textContent = 'Clear All Stock';
        document.getElementById('modalMessage').textContent = 'Are you sure you want to remove ALL Gmail stock?';
        document.getElementById('confirmModal').style.display = 'block';
    }

    async confirmAction() {
        if (this.pendingAction === 'remove' && this.pendingRemoveId) {
            await this.removeGmail(this.pendingRemoveId);
            this.pendingRemoveId = null;
        } else if (this.pendingAction === 'clearAll') {
            await this.clearAllStock();
        }
        this.pendingAction = null;
        this.closeModal();
    }

    closeModal() {
        document.getElementById('confirmModal').style.display = 'none';
    }

    async removeGmail(id) {
        try {
            const response = await fetch(`${API_BASE}/stock`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            const result = await response.json();
            if (result.success) {
                await this.refresh();
                this.showNotification('Gmail account removed!', 'success');
            } else {
                this.showNotification(result.error || 'Failed to remove Gmail', 'error');
            }
        } catch (error) {
            this.showNotification('Error removing Gmail account', 'error');
        }
    }

    async clearSoldItems() {
        const soldIds = this.stock.filter(item => item.status === 'sold').map(item => item.id);
        if (!soldIds.length) {
            this.showNotification('No sold items to clear!', 'error');
            return;
        }
        let successCount = 0;
        for (const id of soldIds) {
            const response = await fetch(`${API_BASE}/stock`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            const result = await response.json();
            if (result.success) successCount++;
        }
        await this.refresh();
        this.showNotification(`Cleared ${successCount} sold items!`, 'success');
    }

    async clearAllStock() {
        const allIds = this.stock.map(item => item.id);
        if (!allIds.length) {
            this.showNotification('No stock to clear!', 'error');
            return;
        }
        let successCount = 0;
        for (const id of allIds) {
            const response = await fetch(`${API_BASE}/stock`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            const result = await response.json();
            if (result.success) successCount++;
        }
        await this.refresh();
        this.showNotification(`Cleared all stock (${successCount} items)!`, 'success');
    }

    exportStock() {
        if (!this.stock.length) {
            this.showNotification('No stock to export!', 'error');
            return;
        }
        const csvContent = "data:text/csv;charset=utf-8,Email,Password,Status,Added Date\n" +
            this.stock.map(item =>
                `${item.email},${item.password},${item.status},${item.added_date || item.addedDate || ''}`
            ).join("\n");

        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(csvContent));
        link.setAttribute("download", `gmail_stock_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        this.showNotification('Stock exported!', 'success');
    }

    backupData() {
        const backupData = {
            stock: this.stock,
            activities: this.activities,
            backupDate: new Date().toISOString()
        };
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
        const link = document.createElement("a");
        link.setAttribute("href", dataStr);
        link.setAttribute("download", `gmail_backup_${new Date().toISOString().split('T')[0]}.json`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        this.showNotification('Backup created!', 'success');
    }

    renderStock() {
        const container = document.getElementById('stockTableContent');
        container.innerHTML = '';
        if (!this.stock.length) {
            container.innerHTML = '<div style="text-align: center; color: #718096; padding: 40px;">Belum ada Gmail stock</div>';
            return;
        }
        container.innerHTML = this.stock.map(item => {
            const stockClass = item.status === 'sold' ? 'stock-sold' : 'stock-available';
            const stockText = item.status === 'sold' ? 'Sold' : 'Available';
            return `
                <div class="gmail-item">
                    <div class="gmail-info">
                        <div class="gmail-email">${item.email}</div>
                        <div class="gmail-details">
                            Password: <span style="font-family:monospace">${item.password}</span> | 
                            <span class="stock-badge ${stockClass}">${stockText}</span> | 
                            Ditambah: ${new Date(item.added_date || item.addedDate).toLocaleDateString()}
                        </div>
                    </div>
                    <div class="gmail-actions">
                        <button class="delete-btn" onclick="stockManager.confirmRemove('${item.id}')">🗑️ Hapus</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderActivities() {
        const container = document.getElementById('activityLog');
        const recentActivities = (this.activities || []).slice(-10).reverse();
        container.innerHTML = recentActivities.map(activity => `
            <div class="gmail-item" style="padding:10px 15px; margin-bottom:10px; background:#f7fafc;">
                <span style="color:#764ba2; font-weight:bold;">[${activity.timestamp ? new Date(activity.timestamp).toLocaleTimeString() : ''}]</span>
                <span style="margin-left:8px;">${activity.user || activity.user_name}: ${activity.action}</span>
            </div>
        `).join('');
    }

    // Harga jual
    getPrice() {
        return parseInt(localStorage.getItem('gmail_price') || '5', 10);
    }
    setPrice() {
        const priceInput = document.getElementById('price-input');
        const value = parseInt(priceInput.value, 10);
        if (!value || value < 1) {
            this.showNotification('Masukkan harga yang valid!', 'error');
            return;
        }
        localStorage.setItem('gmail_price', value);
        this.price = value;
        this.renderPrice();
        this.updateStats();
        this.showNotification('Harga berhasil diubah!', 'success');
    }
    renderPrice() {
        document.getElementById('price-input').value = this.price;
    }

    showNotification(message, type = 'info') {
        const existing = document.querySelector('.notification');
        if (existing) existing.remove();
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }
}

const stockManager = new GmailStockManager();
window.stockManager = stockManager;