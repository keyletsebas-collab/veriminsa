/* ==========================================================================
   VERIMINSA – ADMINISTRATIVE DASHBOARD CORE LOGIC
   ========================================================================== */

let globalAccounts = [];
let currentFilter = 'all';
let searchQuery = '';

// Initialize on DOM load
window.addEventListener('DOMContentLoaded', () => {
    // Check if Supabase SDK is ready, otherwise wait for it
    if (typeof supabaseClient !== 'undefined' && supabaseClient) {
        fetchAccounts();
    } else {
        const checkInterval = setInterval(() => {
            if (typeof supabaseClient !== 'undefined' && supabaseClient) {
                clearInterval(checkInterval);
                fetchAccounts();
            }
        }, 200);
    }
});

// Toast system for administrative feedback
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 4000);
}

// Fetch all registered user profiles from Supabase profiles table
async function fetchAccounts() {
    const tbody = document.getElementById('accounts-tbody');
    if (!tbody) return;

    // Show loading spinner initially
    tbody.innerHTML = `
        <tr>
            <td colspan="6">
                <div class="table-state-wrapper">
                    <div class="loader-spinner"></div>
                    <p>Conectando con Supabase y obteniendo datos de cuentas...</p>
                </div>
            </td>
        </tr>
    `;

    try {
        if (!isSupabaseActive || !supabaseClient) {
            throw new Error("El cliente de Supabase no está listo o no tiene conexión a internet.");
        }

        const { data, error } = await supabaseClient
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        globalAccounts = data || [];
        updateMetrics();
        renderAccounts();
        showToast('📊 Cuentas actualizadas con éxito.', 'success');
    } catch (err) {
        console.error('Error fetching accounts:', err);
        tbody.innerHTML = `
            <tr>
                <td colspan="6">
                    <div class="table-state-wrapper">
                        <div class="empty-icon">⚠️</div>
                        <p style="color: #f87171;">Error al cargar perfiles: ${err.message || err}</p>
                        <button class="btn btn-primary" style="margin-top: 15px; padding: 6px 12px; font-size:12px;" onclick="fetchAccounts()">Reintentar Conexión</button>
                    </div>
                </td>
            </tr>
        `;
        showToast('❌ Error al actualizar perfiles de la base de datos.', 'error');
    }
}

// Compute statistics and update metrics cards
function updateMetrics() {
    const totalCount = globalAccounts.length;
    const blockedCount = globalAccounts.filter(acc => acc.family_id === 'BLOCKED').length;
    const activeCount = totalCount - blockedCount;

    document.getElementById('metric-total').textContent = totalCount;
    document.getElementById('metric-active').textContent = activeCount;
    document.getElementById('metric-blocked').textContent = blockedCount;
}

// Safe Base64 decoding with graceful fallback
function decodePassword(encoded) {
    if (!encoded) return 'Sin clave';
    try {
        return atob(encoded);
    } catch (e) {
        // If it's not base64 or failed to decode, display original raw string
        return encoded;
    }
}

// Format timestamp beautifully
function formatDate(timestamp) {
    if (!timestamp) return 'No registrada';
    try {
        const date = new Date(timestamp);
        const options = { 
            day: '2-digit', 
            month: 'short', 
            year: 'numeric',
            hour: '2-digit', 
            minute: '2-digit' 
        };
        return date.toLocaleDateString('es-ES', options);
    } catch (e) {
        return timestamp;
    }
}

// Render dynamic filtered accounts into table rows
function renderAccounts() {
    const tbody = document.getElementById('accounts-tbody');
    if (!tbody) return;

    // Apply Filter and Search queries
    let filtered = globalAccounts;

    // 1. Apply status filter
    if (currentFilter === 'active') {
        filtered = filtered.filter(acc => acc.family_id !== 'BLOCKED');
    } else if (currentFilter === 'blocked') {
        filtered = filtered.filter(acc => acc.family_id === 'BLOCKED');
    }

    // 2. Apply text search query
    if (searchQuery) {
        const query = searchQuery.toLowerCase().trim();
        filtered = filtered.filter(acc => 
            (acc.name && acc.name.toLowerCase().includes(query)) ||
            (acc.email && acc.email.toLowerCase().includes(query)) ||
            (acc.id && acc.id.toLowerCase().includes(query))
        );
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6">
                    <div class="table-state-wrapper">
                        <div class="empty-icon">📂</div>
                        <p>No se encontraron cuentas que coincidan con la búsqueda o el filtro.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    // Render table rows
    tbody.innerHTML = '';
    filtered.forEach(acc => {
        const isBlocked = acc.family_id === 'BLOCKED';
        const decodedPw = decodePassword(acc.password);
        const maskedPw = '•'.repeat(Math.max(6, decodedPw.length));
        
        const tr = document.createElement('tr');
        tr.id = `row-${acc.id}`;
        
        tr.innerHTML = `
            <td>
                <div class="user-profile">
                    <div class="user-avatar">${(acc.name || 'U')[0].toUpperCase()}</div>
                    <div class="user-info">
                        <div class="user-name">${acc.name || 'Usuario'}</div>
                        <div class="user-id">ID: ${acc.id}</div>
                    </div>
                </div>
            </td>
            <td>
                <span class="user-email">${acc.email || 'sin-correo@app.com'}</span>
            </td>
            <td>
                <div class="password-cell">
                    <span class="password-text" id="pw-text-${acc.id}">${maskedPw}</span>
                    <button class="btn-toggle-pw" onclick="togglePasswordVisibility('${acc.id}', '${btoa(decodedPw)}')" title="Revelar Contraseña">
                        👁️
                    </button>
                </div>
            </td>
            <td>
                <span class="status-badge ${isBlocked ? 'status-badge--blocked' : 'status-badge--active'}">
                    ${isBlocked ? 'Bloqueado' : 'Activo'}
                </span>
            </td>
            <td>
                <span class="date-text">${formatDate(acc.created_at)}</span>
            </td>
            <td>
                <div class="action-buttons">
                    <button class="btn-action ${isBlocked ? 'btn-unblock-toggle' : 'btn-block-toggle'}" onclick="toggleUserBlock('${acc.id}', ${isBlocked}, '${acc.name || acc.email}')">
                        ${isBlocked ? '🟢 Reactivar' : '🔴 Bloquear'}
                    </button>
                    <button class="btn-action btn-remove-access" onclick="deleteUserAccess('${acc.id}', '${acc.name || acc.email}')">
                        🗑️ Quitar Acceso
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Toggle password visibility (reveal plain-text)
function togglePasswordVisibility(userId, base64Password) {
    const pwTextEl = document.getElementById(`pw-text-${userId}`);
    if (!pwTextEl) return;

    const realPassword = atob(base64Password);
    const isMasked = pwTextEl.textContent.includes('•');

    if (isMasked) {
        pwTextEl.textContent = realPassword;
        pwTextEl.style.fontFamily = 'monospace';
        pwTextEl.style.color = '#38bdf8'; // Electric blue highlight when visible
        pwTextEl.style.fontWeight = 'bold';
    } else {
        pwTextEl.textContent = '•'.repeat(Math.max(6, realPassword.length));
        pwTextEl.style.fontFamily = 'monospace';
        pwTextEl.style.color = ''; // Restore design system default
        pwTextEl.style.fontWeight = '';
    }
}

// Toggle block account status in Supabase profiles (sets family_id = 'BLOCKED' or null)
async function toggleUserBlock(userId, isCurrentlyBlocked, userLabel) {
    const actionText = isCurrentlyBlocked ? 'REACTIVAR' : 'BLOQUEAR';
    const confirmation = confirm(`¿Estás seguro de que deseas ${actionText.toLowerCase()} la cuenta de "${userLabel}"?\n\n` + 
        (isCurrentlyBlocked 
            ? "El usuario podrá iniciar sesión e ingresar a Reciminsa App nuevamente." 
            : "Si el usuario está usando la app, su sesión activa se cerrará y se le denegará el acceso al instante.")
    );

    if (!confirmation) return;

    try {
        const nextFamilyId = isCurrentlyBlocked ? null : 'BLOCKED';

        const { error } = await supabaseClient
            .from('profiles')
            .update({ family_id: nextFamilyId })
            .eq('id', userId);

        if (error) throw error;

        // Update local cache
        const index = globalAccounts.findIndex(acc => acc.id === userId);
        if (index !== -1) {
            globalAccounts[index].family_id = nextFamilyId;
        }

        updateMetrics();
        renderAccounts();
        
        showToast(
            isCurrentlyBlocked 
                ? `✅ Cuenta de ${userLabel} reactivada.` 
                : `🔴 Cuenta de ${userLabel} bloqueada. Acceso revocado en caliente.`,
            isCurrentlyBlocked ? 'success' : 'error'
        );
    } catch (err) {
        console.error('Error toggling block status:', err);
        showToast('❌ Error al actualizar estado en Supabase.', 'error');
    }
}

// Remove access by deactivating/blocking the user so they can be reactivated later
async function deleteUserAccess(userId, userLabel) {
    const confirmation = confirm(`¿Estás seguro de que deseas QUITAR EL ACCESO a "${userLabel}"?\n\n` +
        "La cuenta quedará inactiva y no podrá ingresar a la aplicación. Podrás reactivar al usuario en cualquier momento desde este panel."
    );

    if (!confirmation) return;

    try {
        const { error } = await supabaseClient
            .from('profiles')
            .update({ family_id: 'BLOCKED' })
            .eq('id', userId);

        if (error) throw error;

        // Update local cache
        const index = globalAccounts.findIndex(acc => acc.id === userId);
        if (index !== -1) {
            globalAccounts[index].family_id = 'BLOCKED';
        }

        updateMetrics();
        renderAccounts();

        showToast(`🗑️ Se ha quitado el acceso a ${userLabel}. La cuenta está inactiva y puede ser reactivada.`, 'error');
    } catch (err) {
        console.error('Error removing access:', err);
        showToast('❌ Error al quitar el acceso en Supabase.', 'error');
    }
}

// Handle search query updates reactively
function handleSearchFilter() {
    const input = document.getElementById('search-input');
    if (input) {
        searchQuery = input.value;
        renderAccounts();
    }
}

// Switch between metric filter tabs (All, Active, Blocked)
function setFilter(filter) {
    currentFilter = filter;
    
    // Update active class in UI tabs
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.classList.remove('filter-tab--active');
    });

    const activeTab = document.getElementById(`filter-${filter}`);
    if (activeTab) {
        activeTab.classList.add('filter-tab--active');
    }

    renderAccounts();
}
