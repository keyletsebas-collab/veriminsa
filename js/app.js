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
    
    // Render promo codes list on boot
    renderPromoCodes();
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
    }, 12000);
}

function copyToClipboard(text) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            showToast('📋 Código copiado al portapapeles: ' + text, 'success');
        });
    } else {
        // Fallback for older browsers
        showToast('📋 Código generado: ' + text, 'success');
    }
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
    
    // Check if it's a SHA-256 hash (64 hex characters)
    if (encoded.length === 64 && /^[0-9a-f]{64}$/i.test(encoded)) {
        return '🔒 PROTEGIDA (SHA-256)';
    }

    try {
        const decoded = atob(encoded);
        // Ensure it's mostly printable characters to prevent binary gibberish
        if (/^[\x20-\x7E]*$/.test(decoded)) {
            return decoded;
        }
        return '🔒 PROTEGIDA';
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
        
        // Parse serialized name if present
        const parts = (acc.name || '').split(' | ');
        const cleanName = parts[0] || 'Usuario';
        let subPlan = 'none';
        let subExp = 'N/A';
        let isExpired = false;
        
        parts.forEach(p => {
            if (p.startsWith('SUB:')) subPlan = p.substring(4);
            if (p.startsWith('EXP:')) {
                const expVal = p.substring(4);
                if (expVal === 'lifetime') {
                    subExp = 'De por vida';
                } else {
                    const t = parseInt(expVal);
                    if (isNaN(t) || t === 0) {
                        subExp = 'Expirado';
                        isExpired = true;
                    } else {
                        subExp = new Date(t).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
                        if (t < Date.now()) {
                            isExpired = true;
                            subExp = 'Expirado (' + subExp + ')';
                        }
                    }
                }
            }
        });

        const planTranslations = {
            mensual: 'Mensual 30d',
            anual: 'Anual 1 año',
            lifetime: 'De Por Vida',
            trial_10d: 'Prueba 10d',
            none: 'Ninguno'
        };
        const translatedPlan = planTranslations[subPlan] || subPlan;

        const tr = document.createElement('tr');
        tr.id = `row-${acc.id}`;
        
        tr.innerHTML = `
            <td>
                <div class="user-profile">
                    <div class="user-avatar">${cleanName[0].toUpperCase()}</div>
                    <div class="user-info">
                        <div class="user-name-wrapper" style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                            <span class="user-name">${cleanName}</span>
                            <span class="user-plan-badge user-plan-badge--${subPlan}">${translatedPlan}</span>
                            <span class="user-exp-badge ${isExpired ? 'user-exp-badge--expired' : ''}">📅 ${subExp}</span>
                        </div>
                        <div class="user-id">ID: ${acc.id}</div>
                    </div>
                </div>
            </td>
            <td>
                <span class="user-email">${acc.email || 'sin-correo@app.com'}</span>
            </td>
            <td>
                <div class="password-cell">
                    <span class="password-text" id="pw-text-${acc.id}" style="color: #38bdf8; font-weight: bold;">${decodedPw}</span>
                    <button class="btn-toggle-pw" onclick="togglePasswordVisibility('${acc.id}', '${encodeURIComponent(decodedPw)}')" title="Revelar/Ocultar Contraseña">
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
                    <button class="btn-action btn-delete-permanently" onclick="deleteUserPermanently('${acc.id}', '${acc.name || acc.email}')">
                        ❌ Eliminar Permanentemente
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Toggle password visibility (reveal plain-text)
function togglePasswordVisibility(userId, encodedPassword) {
    const pwTextEl = document.getElementById(`pw-text-${userId}`);
    if (!pwTextEl) return;

    const realPassword = decodeURIComponent(encodedPassword);
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

// Delete account permanently from Supabase
async function deleteUserPermanently(userId, userLabel) {
    const confirmation = confirm(`¿Estás seguro de que deseas ELIMINAR PERMANENTEMENTE la cuenta de "${userLabel}"?\n\n` +
        "Esta acción es irreversible y eliminará por completo al usuario de la autenticación de Supabase y de los perfiles."
    );

    if (!confirmation) return;

    try {
        const { error } = await supabaseClient
            .from('profiles')
            .delete()
            .eq('id', userId);

        if (error) throw error;

        // Remove from local cache
        globalAccounts = globalAccounts.filter(acc => acc.id !== userId);

        updateMetrics();
        renderAccounts();

        showToast(`✅ Cuenta de ${userLabel} eliminada permanentemente.`, 'success');
    } catch (err) {
        console.error('Error deleting account permanently:', err);
        const errMsg = err.message || err.details || JSON.stringify(err);
        showToast(`❌ Error: ${errMsg}`, 'error');
    }
}

// ==========================================================================
// PROMO CODES MANAGEMENT (DISCOUNTS & TRIALS)
// ==========================================================================

function toggleCodeTypeFields() {
    const type = document.getElementById('code-type-select').value;
    const discountGroup = document.getElementById('code-discount-group');

    if (type === 'discount') {
        discountGroup.style.display = 'flex';
    } else {
        discountGroup.style.display = 'none';
    }
}

function getPromoCodes() {
    const local = localStorage.getItem('recim_promo_codes');
    if (local) return JSON.parse(local);

    // Default built-in codes
    const defaults = [
        { id: 'c1', code: 'PROMO-DEFAULT-30', type: 'trial', value: 30, used: false, maxUses: 1 },
        { id: 'c2', code: 'PROMO-DEFAULT-50', type: 'discount', value: 50, used: false, maxUses: 1 },
        { id: 'c3', code: 'PROMO-LIFE-100', type: 'trial', value: 99999, used: false, maxUses: 1 }
    ];
    localStorage.setItem('recim_promo_codes', JSON.stringify(defaults));
    return defaults;
}

function savePromoCodes(codes) {
    localStorage.setItem('recim_promo_codes', JSON.stringify(codes));
}

function renderPromoCodes() {
    const tbody = document.getElementById('codes-tbody');
    if (!tbody) return;

    const codes = getPromoCodes();
    if (codes.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align:center; color:var(--text-muted); padding: 20px 0;">
                    Sin códigos promocionales creados.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = '';
    codes.forEach(c => {
        const badgeClass = c.type === 'trial' ? 'code-badge--trial' : 'code-badge--discount';
        const typeLabel = c.type === 'trial' ? 'Prueba' : 'Descuento';
        const valLabel = c.type === 'trial' 
            ? (c.value >= 9999 ? 'De Por Vida' : `${c.value} Días`) 
            : `${c.value}%`;

        // Normalize used property in case of older codes
        const isUsed = c.used === true;
        const statusLabel = isUsed ? '<span style="color:#ef4444; font-weight:bold; font-size: 10px;">🔴 USADO</span>' : '<span style="color:#10b981; font-weight:bold; font-size: 10px;">🟢 DISPONIBLE</span>';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div style="font-family:monospace; font-weight:700; color:white; font-size:14px; letter-spacing:1px; cursor: pointer; transition: 0.2s; display:inline-block;" onclick="copyToClipboard('${c.code}')" title="Haz clic para copiar">${c.code} 📋</div>
                <div style="margin-top: 4px;">${statusLabel}</div>
            </td>
            <td><span class="code-badge ${badgeClass}">${typeLabel}</span></td>
            <td><strong>${valLabel}</strong></td>
            <td>
                <button class="btn-delete-code" onclick="deletePromoCode('${c.id}', '${c.code}')" title="Eliminar Código">
                    🗑️
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function generatePromoCode() {
    const typeSelect = document.getElementById('code-type-select');
    const discountInput = document.getElementById('code-discount-input');

    const typeSelection = typeSelect.value;
    let actualType = 'trial';
    let value = null;
    let prefix = 'CODE';

    if (typeSelection === 'discount') {
        actualType = 'discount';
        value = parseInt(discountInput.value);
        if (isNaN(value) || value <= 0 || value > 100) {
            showToast('❌ Por favor introduce un porcentaje de descuento válido (1-100).', 'error');
            return;
        }
        prefix = `DESC${value}`;
    } else if (typeSelection === 'trial30') {
        actualType = 'trial';
        value = 30;
        prefix = 'FREE30';
    } else if (typeSelection === 'lifetime') {
        actualType = 'trial';
        value = 99999;
        prefix = 'LIFE';
    }

    // Generate secure random string
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let randomString = '';
    for(let i = 0; i < 8; i++) {
        randomString += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const rawCode = `${prefix}-${randomString}`;

    const codes = getPromoCodes();

    const newCode = {
        id: `code-${Date.now()}`,
        code: rawCode,
        type: actualType,
        value: value,
        used: false,
        maxUses: 1
    };

    codes.push(newCode);
    savePromoCodes(codes);
    renderPromoCodes();

    showToast(`✅ Código ${rawCode} generado con éxito.`, 'success');
}

function deletePromoCode(id, code) {
    const confirmation = confirm(`¿Estás seguro de que deseas eliminar el código "${code}"?`);
    if (!confirmation) return;

    let codes = getPromoCodes();
    codes = codes.filter(c => c.id !== id);
    savePromoCodes(codes);
    renderPromoCodes();

    showToast(`🗑️ Código ${code} eliminado.`, 'error');
}
