// Global JavaScript for PGET Portal - Authentication & Admin Management
document.addEventListener('DOMContentLoaded', () => {
    // Detección dinámica de entorno (Local vs Producción en Vercel)
    const isLocal = window.location.hostname === 'localhost' || 
                    window.location.hostname === '127.0.0.1' || 
                    window.location.protocol === 'file:';
    // En Vercel la API corre en el mismo dominio bajo /api:
    const PROD_API_URL = `${window.location.origin}/api`;
    const LOCAL_API_URL = 'http://127.0.0.1:8000/api';
    const API_URL = isLocal ? LOCAL_API_URL : (window.PGET_API_URL || localStorage.getItem('PGET_API_URL') || PROD_API_URL);
    let currentToken = null;
    let currentUser = null;
    let allUsersCache = [];
    let editingUsername = null;
    let currentCondicionFilter = ''; // '' (Todos), 'FIJO', 'CONTRATADO', 'JUBILADO'

    const defaultCargosInitial = [
        'ADMINISTRADOR DEL SISTEMA',
        'ADMINISTRADOR PROFESIONAL I',
        'ANALISTA CENTRAL DE COMPUTACIÓN Y SISTEMAS',
        'AUDITOR JEFE',
        'ABOGADO I',
        'ABOGADO II',
        'ABOGADO III',
        'ASISTENTE ADMINISTRATIVO',
        'ASISTENTE JURÍDICO',
        'DIRECTOR GENERAL',
        'DIRECTOR DE LÍNEA',
        'DIRECTORA (E) DE RECURSOS HUMANOS',
        'ESPECIALISTA EN BIENES Y SERVICIOS',
        'SECRETARIA EJECUTIVA',
        'CHOFER',
        'OBRERO'
    ];
    let allCargosCache = [...defaultCargosInitial];

    // Helpers para formateo de fechas entre Input Date (YYYY-MM-DD) y formato institucional (DD/MM/AAAA)
    function toInputDateValue(dateStr) {
        if (!dateStr) return '';
        const clean = String(dateStr).trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
        if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(clean)) {
            const parts = clean.split(/[\/\-]/);
            const day = parts[0].padStart(2, '0');
            const month = parts[1].padStart(2, '0');
            const year = parts[2];
            return `${year}-${month}-${day}`;
        }
        return '';
    }

    function toDisplayDateValue(dateStr) {
        if (!dateStr) return '';
        const clean = String(dateStr).trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
            const parts = clean.split('-');
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        return clean;
    }

    // Helpers para Salario con prefijo Bs. fijo (no borrable)
    function cleanSalarioAmount(salarioStr) {
        if (!salarioStr) return '1.000,00';
        return String(salarioStr).replace(/^[bB][sS]\.?\s*/, '').trim() || '1.000,00';
    }

    function formatSalarioBs(amountStr) {
        if (!amountStr) return 'Bs. 1.000,00';
        const clean = String(amountStr).replace(/^[bB][sS]\.?\s*/, '').trim();
        return clean ? `Bs. ${clean}` : 'Bs. 1.000,00';
    }

    async function loadCargosCatalog() {
        try {
            const local = localStorage.getItem('pget_custom_cargos');
            if (local) {
                const parsed = JSON.parse(local);
                if (Array.isArray(parsed)) {
                    parsed.forEach(c => {
                        const norm = String(c).trim().toUpperCase();
                        if (norm && !allCargosCache.includes(norm)) allCargosCache.push(norm);
                    });
                }
            }
        } catch (e) {}

        try {
            const res = await fetch(`${API_URL}/cargos`);
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data)) {
                    data.forEach(c => {
                        const norm = String(c).trim().toUpperCase();
                        if (norm && !allCargosCache.includes(norm)) allCargosCache.push(norm);
                    });
                    localStorage.setItem('pget_custom_cargos', JSON.stringify(allCargosCache));
                }
            }
        } catch (err) {
            console.warn('API cargos offline, utilizando catalogo local');
        }
        allCargosCache.sort();
    }

    loadCargosCatalog();

    // Helper para dividir nombres y apellidos si vienen en un solo campo
    function splitNombreApellidos(nombreCompleto) {
        if (!nombreCompleto) return { nombres: '', apellidos: '' };
        const parts = nombreCompleto.trim().split(/\s+/);
        if (parts.length <= 1) return { nombres: parts[0] || '', apellidos: '' };
        if (parts.length === 2) return { nombres: parts[0], apellidos: parts[1] };
        const mid = Math.floor(parts.length / 2);
        return {
            nombres: parts.slice(0, mid).join(' '),
            apellidos: parts.slice(mid).join(' ')
        };
    }

    // Helper de seguridad contra XSS (Cross-Site Scripting)
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // Helper para obtener las iniciales del trabajador (ej. VICTORIA CARMONA -> VC)
    function getWorkerInitials(user) {
        if (!user) return 'XX';
        const cleanStr = (str) => {
            if (!str) return '';
            return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
        };
        const stripPrefix = (str) => {
            return cleanStr(str)
                .replace(/^(ABOG\.|ABOGADA|ABOGADO|ING\.|INGENIERO|INGENIERA|LIC\.|LICENCIADO|LICENCIADA|T\.S\.U\.|TSU|PROF\.|PROFESOR|PROFESORA|DRA?\.|DOCTOR|DOCTORA)\s+/i, '')
                .trim();
        };

        const n = stripPrefix(user.nombres || '');
        const a = stripPrefix(user.apellidos || '');

        if (n && a) {
            const firstN = n.split(/\s+/)[0];
            const firstA = a.split(/\s+/)[0];
            const initN = firstN ? firstN[0] : '';
            const initA = firstA ? firstA[0] : '';
            if (initN && initA) {
                return `${initN}${initA}`;
            }
        }

        const fullName = stripPrefix(user.nombre || '');
        if (fullName) {
            const split = splitNombreApellidos(fullName);
            const sn = stripPrefix(split.nombres);
            const sa = stripPrefix(split.apellidos);
            if (sn && sa) {
                const partN = sn.split(/\s+/)[0];
                const partA = sa.split(/\s+/)[0];
                if (partN && partA) {
                    return `${partN[0]}${partA[0]}`;
                }
            }
            const parts = fullName.split(/\s+/).filter(Boolean);
            if (parts.length >= 2) {
                return `${parts[0][0]}${parts[1][0]}`;
            } else if (parts.length === 1) {
                return `${parts[0][0]}X`;
            }
        }

        return 'XX';
    }

    // Cuentas institucionales oficiales predefinidas para respaldo y modelos de constancias
    const defaultAccounts = [
        {
            username: 'admin@pget.gob.ve',
            password: 'admin123',
            role: 'admin',
            nombres: 'ADMINISTRADOR GENERAL',
            apellidos: 'PGET',
            nombre: 'ADMINISTRADOR GENERAL PGET',
            profesion: 'Ingeniero',
            genero: 'masculino',
            cedula: '12345678',
            cargo: 'ADMINISTRADOR DEL SISTEMA',
            condicion: 'FIJO',
            salario: 'Bs. 1.500,00',
            dependencia: 'PROCURADURÍA GENERAL DEL ESTADO TRUJILLO',
            direccion: 'DESPACHO DEL PROCURADOR GENERAL',
            fecha_ingreso: '01/01/2020',
            anos_servicio: '6'
        },
        {
            username: 'victoria@pget.gob.ve',
            password: 'password123',
            role: 'trabajador',
            nombres: 'VICTORIA ALEJANDRA',
            apellidos: 'CARMONA TORRES',
            nombre: 'VICTORIA ALEJANDRA CARMONA TORRES',
            profesion: 'Abogada',
            genero: 'femenino',
            cedula: '27251622',
            cargo: 'ADMINISTRADOR PROFESIONAL I',
            condicion: 'FIJO',
            salario: 'Bs. 1.000,00',
            dependencia: 'PROCURADURÍA GENERAL DEL ESTADO TRUJILLO',
            direccion: 'DIRECCIÓN DE RECURSOS HUMANOS',
            fecha_ingreso: '01/04/2024',
            anos_servicio: '2'
        },
        {
            username: 'lorenzo@pget.gob.ve',
            password: 'password123',
            role: 'trabajador',
            nombres: 'LORENZO FABIÁN',
            apellidos: 'ÁVILA GONZÁLEZ',
            nombre: 'ÁVILA GONZÁLEZ LORENZO FABIÁN',
            profesion: 'Ingeniero',
            genero: 'masculino',
            cedula: '25006611',
            cargo: 'ANALISTA CENTRAL DE COMPUTACIÓN Y SISTEMAS',
            condicion: 'CONTRATADO',
            salario: 'Bs. 1.000,00',
            dependencia: 'PROCURADURÍA GENERAL DEL ESTADO TRUJILLO',
            direccion: 'DIRECCIÓN DE BIENES Y SERVICIOS',
            fecha_ingreso: '21/11/2022',
            anos_servicio: '4'
        },
        {
            username: 'mario@pget.gob.ve',
            password: 'password123',
            role: 'trabajador',
            nombres: 'MARIO ANTONIO',
            apellidos: 'MAZZEY CASTELLANOS',
            nombre: 'MAZZEY CASTELLANOS MARIO ANTONIO',
            profesion: 'Licenciado',
            genero: 'masculino',
            cedula: '9019850',
            cargo: 'AUDITOR JEFE',
            condicion: 'JUBILADO',
            salario: 'Bs. 142,00',
            dependencia: 'PROCURADURÍA GENERAL DEL ESTADO TRUJILLO',
            direccion: 'UNIDAD DE AUDITORÍA INTERNA',
            fecha_ingreso: '15/03/1998',
            anos_servicio: '25'
        }
    ];

    function checkOfflineAuth(username, password) {
        const cleanUser = String(username).toLowerCase().trim();
        for (const acc of defaultAccounts) {
            const aliasMatch = (cleanUser === 'admin' && acc.username === 'admin@pget.gob.ve') ||
                               (cleanUser === 'trabajador1' && acc.username === 'victoria@pget.gob.ve') ||
                               (cleanUser === acc.username.toLowerCase());
            if (aliasMatch && acc.password === password) {
                const userCopy = { ...acc };
                delete userCopy.password;
                return userCopy;
            }
        }
        return null;
    }

    // Helper para cálculo automático de años de servicio según la fecha de ingreso
    function calculateYearsOfService(dateStr) {
        if (!dateStr || typeof dateStr !== 'string') return 0;
        const cleanStr = dateStr.trim();
        if (!cleanStr) return 0;

        let day = 1, month = 0, year = 2000;
        if (/^\d{4}-\d{2}-\d{2}$/.test(cleanStr)) {
            const parts = cleanStr.split('-');
            year = parseInt(parts[0], 10);
            month = parseInt(parts[1], 10) - 1;
            day = parseInt(parts[2], 10);
        } else if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(cleanStr)) {
            const parts = cleanStr.split(/[\/\-]/);
            day = parseInt(parts[0], 10);
            month = parseInt(parts[1], 10) - 1;
            year = parseInt(parts[2], 10);
        } else {
            const parsed = new Date(cleanStr);
            if (!isNaN(parsed.getTime())) {
                day = parsed.getDate();
                month = parsed.getMonth();
                year = parsed.getFullYear();
            } else {
                return 0;
            }
        }

        const entryDate = new Date(year, month, day);
        if (isNaN(entryDate.getTime())) return 0;

        const today = new Date();
        let years = today.getFullYear() - entryDate.getFullYear();
        const monthDiff = today.getMonth() - entryDate.getMonth();
        const dayDiff = today.getDate() - entryDate.getDate();

        if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
            years--;
        }
        return Math.max(0, years);
    }

    // Helper para garantizar el formato estricto oficial de cédula: V- 12.345.678
    function formatCedulaOficial(cedula) {
        if (!cedula) return '';
        const clean = String(cedula).replace(/[^0-9]/g, '');
        if (!clean) return String(cedula);
        const withDots = clean.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        return `V- ${withDots}`;
    }

    // Helper para limpiar la cédula y extraer únicamente los dígitos numéricos
    function cleanCedula(val) {
        if (!val) return '';
        return String(val).replace(/[^0-9]/g, '').trim();
    }

    // Helper para formatear la profesión según el género (sin arrobas @)
    function formatProfessionByGender(prof, gender) {
        if (!prof) return '';
        const isFem = String(gender).toLowerCase() === 'femenino';
        let p = String(prof).trim();
        if (p.includes('@')) {
            p = p.replace(/@/g, isFem ? 'a' : 'o');
        }
        const lower = p.toLowerCase();
        if (lower.startsWith('abog')) return isFem ? 'Abogada' : 'Abogado';
        if (lower.startsWith('ing')) return isFem ? 'Ingeniera' : 'Ingeniero';
        if (lower.startsWith('lic')) return isFem ? 'Licenciada' : 'Licenciado';
        if (lower.startsWith('prof')) return isFem ? 'Profesora' : 'Profesor';
        if (lower.startsWith('dr') || lower.startsWith('doct')) return isFem ? 'Doctora' : 'Doctor';
        if (lower.includes('tecnic') || lower.includes('t.s.u') || lower.includes('tsu')) return isFem ? 'Técnica Superior' : 'Técnico Superior';
        return p;
    }

    // Helper para obtener el prefijo según la profesión y género del trabajador
    function getProfessionPrefix(prof, gender) {
        if (!prof) return '';
        const p = String(prof).toLowerCase();
        const isFem = String(gender).toLowerCase() === 'femenino';
        if (p.includes('abog')) return 'Abog. ';
        if (p.includes('ing')) return 'Ing. ';
        if (p.includes('tecnic') || p.includes('t.s.u') || p.includes('tsu')) return 'T.S.U. ';
        if (p.includes('lic')) return 'Lic. ';
        if (p.includes('prof')) return isFem ? 'Profa. ' : 'Prof. ';
        if (p.includes('dr') || p.includes('doct')) return isFem ? 'Dra. ' : 'Dr. ';
        return '';
    }

    // Helper para formatear nombre completo con su título profesional
    function formatFullNameWithTitle(nombre, prof, gender) {
        if (!nombre) return '';
        const prefix = getProfessionPrefix(prof, gender);
        if (!prefix) return nombre;
        if (nombre.toLowerCase().startsWith(prefix.toLowerCase().trim())) {
            return nombre;
        }
        return `${prefix}${nombre}`;
    }

    // Actualiza dinámicamente las opciones del desplegable de profesión según el género seleccionado
    function updateFormProfesionOptions(gender, currentVal) {
        const modal = document.getElementById('loginModal');
        if (!modal) return;
        const select = modal.querySelector('#formProfesion');
        if (!select) return;
        const isFem = String(gender).toLowerCase() === 'femenino';
        const options = [
            { val: isFem ? 'Abogada' : 'Abogado', label: `${isFem ? 'Abogada' : 'Abogado'} (Prefijo: Abog. Nombre)` },
            { val: isFem ? 'Ingeniera' : 'Ingeniero', label: `${isFem ? 'Ingeniera' : 'Ingeniero'} (Prefijo: Ing. Nombre)` },
            { val: isFem ? 'Licenciada' : 'Licenciado', label: `${isFem ? 'Licenciada' : 'Licenciado'} (Prefijo: Lic. Nombre)` },
            { val: isFem ? 'Técnica Superior' : 'Técnico Superior', label: `${isFem ? 'Técnica Superior' : 'Técnico Superior'} (Prefijo: T.S.U. Nombre)` },
            { val: isFem ? 'Profesora' : 'Profesor', label: `${isFem ? 'Profesora' : 'Profesor'} (Prefijo: ${isFem ? 'Profa.' : 'Prof.'} Nombre)` },
            { val: isFem ? 'Doctora' : 'Doctor', label: `${isFem ? 'Doctora' : 'Doctor'} (Prefijo: ${isFem ? 'Dra.' : 'Dr.'} Nombre)` },
            { val: 'Bachiller', label: 'Bachiller (Sin prefijo)' },
            { val: 'Otro', label: 'Otro' }
        ];

        const normalizedVal = formatProfessionByGender(currentVal, isFem ? 'femenino' : 'masculino');
        select.innerHTML = options.map(opt => `<option value="${opt.val}">${opt.label}</option>`).join('');

        if (normalizedVal) {
            select.value = normalizedVal;
            if (!select.value) {
                for (const opt of options) {
                    if (opt.val.toLowerCase().slice(0, 4) === normalizedVal.toLowerCase().slice(0, 4)) {
                        select.value = opt.val;
                        break;
                    }
                }
            }
        }
    }

    // Helper para obtener el género seleccionado mediante los radio buttons
    function getFormGender() {
        const modal = document.getElementById('loginModal');
        const checked = modal ? modal.querySelector('input[name="formGenero"]:checked') : null;
        return checked ? checked.value : 'masculino';
    }

    // Helper para marcar el radio button del género
    function setFormGender(genderVal) {
        const modal = document.getElementById('loginModal');
        if (!modal) return;
        const val = String(genderVal || 'masculino').toLowerCase();
        const radioM = modal.querySelector('#formGeneroMasculino');
        const radioF = modal.querySelector('#formGeneroFemenino');
        if (val === 'femenino') {
            if (radioF) radioF.checked = true;
        } else {
            if (radioM) radioM.checked = true;
        }
    }

    // Toggle minimalista con icono de ojo para ver/ocultar contraseñas
    window.togglePasswordVisibility = (inputId, btn) => {
        const input = document.getElementById(inputId);
        if (!input) return;
        const icon = btn.querySelector('i');
        if (input.type === 'password') {
            input.type = 'text';
            if (icon) icon.className = 'fas fa-eye-slash';
            btn.style.color = '#6A0D25';
        } else {
            input.type = 'password';
            if (icon) icon.className = 'fas fa-eye';
            btn.style.color = '#94a3b8';
        }
    };

    // Botón para alternar sección de cambio de contraseña en modo edición
    window.toggleChangePasswordSection = () => {
        const modal = document.getElementById('loginModal');
        if (!modal) return;
        const container = modal.querySelector('#passwordFieldsContainer');
        const btn = modal.querySelector('#btnToggleChangePass');
        if (!container || !btn) return;
        const isHidden = container.style.display === 'none';
        if (isHidden) {
            container.style.display = 'grid';
            btn.innerHTML = '<i class="fas fa-times" style="color: #dc2626;"></i> Cancelar cambio de contraseña';
            btn.style.background = '#fef2f2';
            btn.style.borderColor = '#fecaca';
            const p1 = modal.querySelector('#formPassword');
            if (p1) p1.focus();
        } else {
            container.style.display = 'none';
            btn.innerHTML = '<i class="fas fa-key" style="color: #D4AF37;"></i> Cambiar Contraseña';
            btn.style.background = '#f1f5f9';
            btn.style.borderColor = '#cbd5e1';
            const p1 = modal.querySelector('#formPassword');
            const p2 = modal.querySelector('#formPasswordConfirm');
            if (p1) p1.value = '';
            if (p2) p2.value = '';
        }
    };

    // =========================================================================
    // SISTEMA DE VENTANA FLOTANTE CENTRAL DE NOTIFICACIONES Y CONFIRMACIÓN PGET
    // =========================================================================
    function showFloatingDialog({
        title = 'Procuraduría General del Estado Trujillo',
        message = '',
        type = 'info', // 'info', 'success', 'danger', 'delete', 'warning'
        confirmText = 'Aceptar',
        cancelText = null,
        isConfirm = false
    } = {}) {
        return new Promise((resolve) => {
            const oldDialog = document.getElementById('pgetFloatingDialogOverlay');
            if (oldDialog) oldDialog.remove();

            const isDanger = type === 'danger' || type === 'delete';
            const hasCancel = isConfirm || !!cancelText;

            let iconBadgeClass = type;
            let badgeIconHtml = '<i class="fas fa-info-circle"></i>';
            let defaultTitle = 'Notificación Institucional';

            if (type === 'success') {
                badgeIconHtml = '<i class="fas fa-check-circle"></i>';
                defaultTitle = 'Operación Exitosa';
            } else if (isDanger) {
                badgeIconHtml = '<i class="fas fa-trash-alt"></i>';
                defaultTitle = 'Confirmar Eliminación';
            } else if (type === 'warning') {
                badgeIconHtml = '<i class="fas fa-exclamation-triangle"></i>';
                defaultTitle = 'Atención';
            }

            const finalTitle = title || defaultTitle;

            const overlay = document.createElement('div');
            overlay.id = 'pgetFloatingDialogOverlay';
            overlay.className = 'pget-dialog-overlay';

            overlay.innerHTML = `
                <div class="pget-dialog-card" role="dialog" aria-modal="true">
                    <div class="pget-dialog-header">
                        <h3 class="pget-dialog-title">
                            <i class="fas fa-shield-alt" style="color: #D4AF37;"></i>
                            <span>${escapeHtml(finalTitle)}</span>
                        </h3>
                        <button type="button" class="pget-dialog-close" id="pgetDialogCloseBtn" aria-label="Cerrar">&times;</button>
                    </div>
                    <div class="pget-dialog-body">
                        <div class="pget-dialog-icon-badge ${iconBadgeClass}">
                            ${badgeIconHtml}
                        </div>
                        <div style="font-size: 1.02rem; color: #1e293b; line-height: 1.55; white-space: pre-line;">
                            ${escapeHtml(message)}
                        </div>
                    </div>
                    <div class="pget-dialog-footer">
                        ${hasCancel ? `
                            <button type="button" class="pget-dialog-btn-cancel" id="pgetDialogCancelBtn">
                                ${escapeHtml(cancelText || 'Cancelar')}
                            </button>
                        ` : ''}
                        <button type="button" class="pget-dialog-btn-confirm ${isDanger ? 'danger' : ''}" id="pgetDialogConfirmBtn">
                            ${escapeHtml(confirmText || 'Aceptar')}
                        </button>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);

            requestAnimationFrame(() => {
                overlay.classList.add('active');
            });

            const confirmBtn = overlay.querySelector('#pgetDialogConfirmBtn');
            const cancelBtn = overlay.querySelector('#pgetDialogCancelBtn');
            const closeBtn = overlay.querySelector('#pgetDialogCloseBtn');

            const cleanup = (result) => {
                overlay.classList.remove('active');
                document.removeEventListener('keydown', handleKeyDown);
                setTimeout(() => {
                    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                }, 240);
                resolve(result);
            };

            const handleKeyDown = (e) => {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    cleanup(false);
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    cleanup(true);
                }
            };

            document.addEventListener('keydown', handleKeyDown);

            if (confirmBtn) {
                confirmBtn.onclick = () => cleanup(true);
                confirmBtn.focus();
            }
            if (cancelBtn) {
                cancelBtn.onclick = () => cleanup(false);
            }
            if (closeBtn) {
                closeBtn.onclick = () => cleanup(false);
            }
        });
    }

    window.showFloatingDialog = showFloatingDialog;

    window.pgetAlert = (message, title = 'Notificación Institucional', type = 'info') => {
        return showFloatingDialog({
            title,
            message,
            type,
            confirmText: 'Aceptar',
            isConfirm: false
        });
    };

    window.pgetConfirm = (message, title = 'Confirmar Acción', confirmText = 'Aceptar', cancelText = 'Cancelar', type = 'warning') => {
        return showFloatingDialog({
            title,
            message,
            type,
            confirmText,
            cancelText,
            isConfirm: true
        });
    };

    // Redirigir alert estándar a la ventana flotante central
    window.alert = function(msg) {
        return window.pgetAlert(msg);
    };

    // =========================================================================
    // GESTIÓN Y CATÁLOGO DE CARGOS INSTITUCIONALES PGET
    // =========================================================================
    async function addCargoToCatalog(nombre) {
        const clean = String(nombre || '').trim().toUpperCase();
        if (!clean) return false;
        if (!allCargosCache.includes(clean)) {
            allCargosCache.push(clean);
            allCargosCache.sort();
        }
        localStorage.setItem('pget_custom_cargos', JSON.stringify(allCargosCache));

        try {
            await fetch(`${API_URL}/cargos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre: clean })
            });
        } catch (e) {
            console.warn('API cargos offline, guardado en cache local');
        }
        return true;
    }

    async function deleteCargoFromCatalog(nombre) {
        const clean = String(nombre || '').trim().toUpperCase();
        allCargosCache = allCargosCache.filter(c => c !== clean);
        localStorage.setItem('pget_custom_cargos', JSON.stringify(allCargosCache));

        try {
            await fetch(`${API_URL}/cargos/${encodeURIComponent(clean)}`, {
                method: 'DELETE'
            });
        } catch (e) {
            console.warn('API cargos offline, eliminado localmente');
        }
    }

    window.quickAddCargoFromInput = async (nombre) => {
        const clean = String(nombre || '').trim().toUpperCase();
        if (!clean) return;
        await addCargoToCatalog(clean);
        const input = document.getElementById('formCargo');
        if (input) input.value = clean;
        const dropdown = document.getElementById('cargoDropdownList');
        if (dropdown) dropdown.style.display = 'none';
        window.pgetAlert(`El cargo "${clean}" ha sido añadido al catálogo y seleccionado.`, 'Cargo Registrado', 'success');
    };

    window.openManageCargosModal = (prefill = '') => {
        const existing = document.getElementById('pgetManageCargosOverlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'pgetManageCargosOverlay';
        overlay.className = 'pget-dialog-overlay';

        overlay.innerHTML = `
            <div class="pget-dialog-card" style="max-width: 580px; width: 95%; max-height: 90vh; display: flex; flex-direction: column;" role="dialog" aria-modal="true">
                <div class="pget-dialog-header">
                    <h3 class="pget-dialog-title">
                        <i class="fas fa-briefcase" style="color: #D4AF37;"></i>
                        <span>Catálogo de Cargos Institucionales</span>
                    </h3>
                    <button type="button" class="pget-dialog-close" id="closeManageCargosBtn" aria-label="Cerrar">&times;</button>
                </div>
                
                <div style="padding: 22px 24px; flex: 1; overflow-y: auto;">
                    <p style="color: #64748b; font-size: 0.88rem; margin-top: 0; margin-bottom: 16px;">
                        Añada nuevos cargos al sistema o consulte los cargos disponibles. Los nuevos cargos se guardan en la base de datos y estarán disponibles de inmediato para asignar a cualquier trabajador.
                    </p>

                    <!-- Formulario Añadir Nuevo Cargo -->
                    <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; margin-bottom: 20px;">
                        <label style="display: block; font-weight: 700; font-size: 0.85rem; color: #1e293b; margin-bottom: 6px;">
                            <i class="fas fa-plus-circle" style="color: #6A0D25;"></i> Registrar Nuevo Cargo:
                        </label>
                        <div style="display: flex; gap: 8px;">
                            <input type="text" id="newCargoInputModal" placeholder="Ej. ASISTENTE LEGAL II, JEFE DE SECCIÓN..." value="${escapeHtml(prefill)}" style="flex: 1; padding: 10px 14px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.90rem; text-transform: uppercase;">
                            <button type="button" id="submitNewCargoBtnModal" style="background: linear-gradient(135deg, #6A0D25, #83122F); color: white; border: 1.5px solid #D4AF37; padding: 10px 18px; border-radius: 8px; font-weight: 700; font-size: 0.88rem; cursor: pointer; display: flex; align-items: center; gap: 6px; white-space: nowrap; box-shadow: 0 2px 6px rgba(106,13,37,0.25);">
                                <i class="fas fa-save"></i> Guardar
                            </button>
                        </div>
                        <div id="newCargoErrorModal" style="display: none; color: #dc2626; font-size: 0.82rem; margin-top: 6px; font-weight: 600;"></div>
                    </div>

                    <!-- Buscador de cargos existentes -->
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <span id="cargosCountBadge" style="font-size: 0.84rem; font-weight: 700; color: #6A0D25; background: #fdf2f4; padding: 4px 10px; border-radius: 6px; border: 1px solid #fecdd3;">
                            ${allCargosCache.length} Cargos Registrados
                        </span>
                        <input type="text" id="filterCargosInputModal" placeholder="Filtrar catálogo..." style="padding: 6px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.82rem; width: 180px;">
                    </div>

                    <!-- Lista de Cargos -->
                    <div id="cargosListContainerModal" style="max-height: 240px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px; background: #fafafa;">
                    </div>
                </div>

                <div style="padding: 12px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end;">
                    <button type="button" id="closeManageCargosFooterBtn" style="background: #e2e8f0; border: none; padding: 9px 20px; border-radius: 8px; font-weight: 600; font-size: 0.90rem; cursor: pointer; color: #475569;">
                        Cerrar
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('active'));

        const renderCargosList = (q = '') => {
            const container = overlay.querySelector('#cargosListContainerModal');
            const countBadge = overlay.querySelector('#cargosCountBadge');
            const filterStr = q.trim().toUpperCase();
            const filtered = allCargosCache.filter(c => !filterStr || c.includes(filterStr));

            if (countBadge) countBadge.textContent = `${allCargosCache.length} Cargos Registrados`;

            if (filtered.length === 0) {
                container.innerHTML = `<div style="text-align: center; padding: 20px; color: #94a3b8; font-size: 0.88rem;">No hay cargos que coincidan con "${escapeHtml(filterStr)}"</div>`;
                return;
            }

            container.innerHTML = filtered.map(c => {
                const isDefault = defaultCargosInitial.includes(c);
                return `
                    <div class="cargo-manage-row">
                        <span style="display: flex; align-items: center; gap: 8px;">
                            <i class="fas fa-briefcase" style="color: #D4AF37;"></i>
                            <span>${escapeHtml(c)}</span>
                        </span>
                        <div style="display: flex; gap: 6px; align-items: center;">
                            ${!isDefault ? `
                                <button type="button" class="btn-del-cargo" data-cargo="${escapeHtml(c)}" style="background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; padding: 5px 9px; border-radius: 6px; font-size: 0.8rem; cursor: pointer; transition: all 0.2s;" title="Eliminar cargo del catálogo">
                                    <i class="fas fa-trash-alt"></i>
                                </button>
                            ` : `
                                <span style="font-size: 0.75rem; color: #64748b; background: #f1f5f9; padding: 3px 8px; border-radius: 4px; font-weight: 600;">
                                    Institucional
                                </span>
                            `}
                        </div>
                    </div>
                `;
            }).join('');

            container.querySelectorAll('.btn-del-cargo').forEach(btn => {
                btn.onclick = async () => {
                    const cargoName = btn.getAttribute('data-cargo');
                    const ok = await window.showFloatingDialog({
                        title: 'Eliminar Cargo',
                        message: `¿Desea eliminar el cargo personalizado "${cargoName}" del catálogo?`,
                        type: 'delete',
                        confirmText: 'Sí, Eliminar',
                        cancelText: 'Cancelar',
                        isConfirm: true
                    });
                    if (ok) {
                        await deleteCargoFromCatalog(cargoName);
                        renderCargosList(overlay.querySelector('#filterCargosInputModal').value);
                    }
                };
            });
        };

        renderCargosList();

        const filterInput = overlay.querySelector('#filterCargosInputModal');
        if (filterInput) {
            filterInput.addEventListener('input', () => renderCargosList(filterInput.value));
        }

        const inputNew = overlay.querySelector('#newCargoInputModal');
        const submitBtn = overlay.querySelector('#submitNewCargoBtnModal');
        const errDiv = overlay.querySelector('#newCargoErrorModal');

        const handleSaveNewCargo = async () => {
            const val = inputNew.value.trim().toUpperCase();
            if (!val) {
                errDiv.style.display = 'block';
                errDiv.textContent = 'Por favor escriba el nombre del cargo.';
                return;
            }
            errDiv.style.display = 'none';
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

            await addCargoToCatalog(val);

            const formCargoInput = document.getElementById('formCargo');
            if (formCargoInput) formCargoInput.value = val;

            inputNew.value = '';
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-save"></i> Guardar';
            renderCargosList(filterInput ? filterInput.value : '');
        };

        submitBtn.onclick = handleSaveNewCargo;
        inputNew.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSaveNewCargo();
            }
        });

        const closeModal = () => {
            overlay.classList.remove('active');
            setTimeout(() => overlay.remove(), 240);
        };

        overlay.querySelector('#closeManageCargosBtn').onclick = closeModal;
        overlay.querySelector('#closeManageCargosFooterBtn').onclick = closeModal;
    };

    function setupCargoSearchableDropdown(modal) {
        const cargoInput = modal.querySelector('#formCargo');
        const toggleBtn = modal.querySelector('#toggleCargoDropdownBtn');
        const dropdown = modal.querySelector('#cargoDropdownList');
        if (!cargoInput || !dropdown) return;

        const renderCargoOptions = (filter = '') => {
            const q = filter.trim().toUpperCase();
            const matches = allCargosCache.filter(c => !q || c.includes(q));

            let html = '';
            if (matches.length > 0) {
                html = matches.map(c => `
                    <div class="cargo-option-item" data-value="${escapeHtml(c)}">
                        <i class="fas fa-briefcase"></i>
                        <span>${escapeHtml(c)}</span>
                    </div>
                `).join('');
            } else {
                html = `
                    <div style="padding: 12px; text-align: center; color: #64748b; font-size: 0.85rem;">
                        No se encontró "<strong>${escapeHtml(q)}</strong>"<br>
                        <button type="button" onclick="window.quickAddCargoFromInput('${escapeHtml(q)}')" style="display: inline-block; margin-top: 8px; background: linear-gradient(135deg, #6A0D25, #83122F); color: white; border: none; padding: 6px 14px; border-radius: 6px; font-size: 0.82rem; font-weight: 700; cursor: pointer;">
                            <i class="fas fa-plus"></i> Registrar este cargo
                        </button>
                    </div>
                `;
            }

            html += `
                <div style="padding: 9px 12px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
                    <button type="button" onclick="window.openManageCargosModal()" style="background: none; border: none; color: #0284c7; font-weight: 700; font-size: 0.83rem; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;">
                        <i class="fas fa-cog"></i> Administrar catálogo de cargos
                    </button>
                </div>
            `;

            dropdown.innerHTML = html;

            dropdown.querySelectorAll('.cargo-option-item').forEach(el => {
                el.onclick = () => {
                    const val = el.getAttribute('data-value');
                    if (val) {
                        cargoInput.value = val;
                        dropdown.style.display = 'none';
                    }
                };
            });
        };

        cargoInput.addEventListener('focus', () => {
            renderCargoOptions(cargoInput.value);
            dropdown.style.display = 'block';
        });

        cargoInput.addEventListener('input', () => {
            renderCargoOptions(cargoInput.value);
            dropdown.style.display = 'block';
        });

        if (toggleBtn) {
            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (dropdown.style.display === 'block') {
                    dropdown.style.display = 'none';
                } else {
                    renderCargoOptions(cargoInput.value);
                    dropdown.style.display = 'block';
                    cargoInput.focus();
                }
            });
        }

        document.addEventListener('click', (e) => {
            if (!cargoInput.contains(e.target) && !dropdown.contains(e.target) && !(toggleBtn && toggleBtn.contains(e.target))) {
                dropdown.style.display = 'none';
            }
        });
    }

    // Helper to ensure Login & Management Modal exists in the document with all views
    function ensureLoginModal() {
        let modal = document.getElementById('loginModal');
        if (!modal || !modal.querySelector('#adminView')) {
            if (modal) modal.remove();
            const modalHTML = `
            <div id="loginModal" class="modal">
                <div class="modal-content" id="mainModalContent">
                    <span class="close-btn" id="modalCloseBtn" style="position: absolute; right: 18px; top: 16px; z-index: 20; cursor: pointer; font-size: 1.6rem; color: #64748b;">&times;</span>
                    
                    <!-- 1. VISTA DE LOGIN -->
                    <div id="loginView" style="padding: 35px 30px;">
                        <div style="text-align: center; margin-bottom: 25px;">
                            <img src="assets/logo.png" alt="Logo PGET" style="height: 70px;" onerror="this.src='https://via.placeholder.com/60?text=PGET'">
                            <h2 style="margin-top: 15px; color: #6A0D25; font-size: 1.8rem;">Iniciar Sesión</h2>
                            <p style="color: #64748b; font-size: 0.95rem;">Ingresa tus credenciales institucionales</p>
                        </div>
                        
                        <form id="loginForm">
                            <div class="input-group" style="margin-bottom: 18px;">
                                <label for="username" style="display: block; font-weight: 700; margin-bottom: 8px; color: #334155;">Correo Electrónico / Usuario</label>
                                <div class="input-icon" style="position: relative;">
                                    <i class="fas fa-envelope" style="position: absolute; left: 15px; top: 50%; transform: translateY(-50%); color: #94a3b8;"></i>
                                    <input type="text" id="username" placeholder="admin@pget.gob.ve o usuario" required style="width: 100%; padding: 12px 15px 12px 42px; border: 1.5px solid #D4AF37; border-radius: 8px; outline: none; font-size: 0.95rem; box-sizing: border-box;">
                                </div>
                            </div>
                            
                            <div class="input-group" style="margin-bottom: 18px;">
                                <label for="password" style="display: block; font-weight: 700; margin-bottom: 8px; color: #334155;">Contraseña</label>
                                <div class="input-icon" style="position: relative;">
                                    <i class="fas fa-lock" style="position: absolute; left: 15px; top: 50%; transform: translateY(-50%); color: #94a3b8;"></i>
                                    <input type="password" id="password" placeholder="Ingresa tu contraseña" required style="width: 100%; padding: 12px 40px; border: 1px solid #e2e8f0; border-radius: 8px; outline: none; font-size: 0.95rem; box-sizing: border-box;">
                                    <i class="fas fa-eye toggle-password" id="togglePassword" style="position: absolute; right: 15px; top: 50%; transform: translateY(-50%); color: #94a3b8; cursor: pointer;"></i>
                                </div>
                            </div>
                            
                            <div style="margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between;">
                                <label style="display: flex; align-items: center; gap: 8px; color: #64748b; font-size: 0.9rem; cursor: pointer;">
                                    <input type="checkbox" id="remember" style="accent-color: #6A0D25;">
                                    Recordarme
                                </label>
                                <span style="font-size: 0.82rem; color: #0284c7; cursor: pointer;" title="Admin: admin@pget.gob.ve / admin123 | Trabajador: victoria@pget.gob.ve / password123">
                                    <i class="fas fa-info-circle"></i> Cuentas del sistema
                                </span>
                            </div>

                            <div id="loginError" class="error-msg" style="display:none; color: #dc2626; background: #fef2f2; border: 1px solid #fecaca; padding: 10px; border-radius: 6px; margin-bottom: 15px; text-align: center; font-size: 0.9rem;"></div>
                            
                            <button type="submit" id="submitLoginBtn" style="width: 100%; background: linear-gradient(135deg, #6A0D25, #83122F); color: white; border: 1.5px solid #D4AF37; padding: 13px; border-radius: 8px; font-weight: 700; font-size: 1rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; transition: all 0.2s; box-shadow: 0 4px 12px rgba(106, 13, 37, 0.25);">
                                <i class="fas fa-sign-in-alt"></i> Iniciar Sesión
                            </button>
                        </form>
                    </div>

                    <!-- 2. VISTA DE TRABAJADOR (PANTALLA COMPLETA - PUEDE GENERAR CONSTANCIAS) -->
                    <div id="workerView" style="display: none; background: #f8fafc; height: 100%; flex-direction: column;">
                        <div style="background: linear-gradient(135deg, #6A0D25, #450614); border-bottom: 2px solid #D4AF37; color: white; padding: 18px 30px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 10px rgba(0,0,0,0.15);">
                            <div>
                                <h3 style="margin: 0; font-size: 1.3rem;"><i class="fas fa-user-circle"></i> Portal del Trabajador</h3>
                                <span style="font-size: 0.85rem; opacity: 0.9;">Procuraduría General del Estado Trujillo &bull; Trámites y Perfil</span>
                            </div>
                            <div style="display: flex; gap: 10px;">
                                <button onclick="window.pgetLogout()" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 8px 16px; border-radius: 6px; font-size: 0.88rem; cursor: pointer; font-weight: 600;">
                                    <i class="fas fa-sign-out-alt"></i> Cerrar Sesión
                                </button>
                                <button onclick="document.getElementById('loginModal').classList.remove('show')" style="background: rgba(255,255,255,0.25); border: none; color: white; padding: 8px 16px; border-radius: 6px; font-size: 0.88rem; cursor: pointer; font-weight: 600;">
                                    <i class="fas fa-times"></i> Volver al Portal Web
                                </button>
                            </div>
                        </div>
                        
                        <div style="flex: 1; overflow-y: auto; padding: 35px 25px;">
                            <div style="max-width: 950px; margin: 0 auto;">
                                <div style="background: white; border: 1px solid #e2e8f0; border-radius: 16px; padding: 30px; margin-bottom: 30px; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
                                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 20px;">
                                        <h4 style="color: #6A0D25; font-size: 1.15rem; margin: 0;">
                                            <i class="fas fa-id-card"></i> Datos Personales y Laborales del Trabajador
                                        </h4>
                                        <span id="workerCondicionBadge" class="condicion-badge fijo" style="font-size: 0.85rem; padding: 6px 14px;">
                                            FIJO
                                        </span>
                                    </div>
                                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; font-size: 0.95rem;">
                                        <div>
                                            <span style="color: #64748b; font-size: 0.82rem; display: block; margin-bottom: 3px;">Nombres y Apellidos (con Título):</span>
                                            <strong id="workerName" style="color: #1e293b; font-size: 1.1rem;">-</strong>
                                        </div>
                                        <div>
                                            <span style="color: #64748b; font-size: 0.82rem; display: block; margin-bottom: 3px;">Cédula de Identidad:</span>
                                            <strong id="workerCedula" style="color: #1e293b; font-size: 1.05rem;">-</strong>
                                        </div>
                                        <div>
                                            <span style="color: #64748b; font-size: 0.82rem; display: block; margin-bottom: 3px;">Profesión / Titulación:</span>
                                            <strong id="workerProfesion" style="color: #0369a1; font-size: 1rem;">-</strong>
                                        </div>
                                        <div>
                                            <span style="color: #64748b; font-size: 0.82rem; display: block; margin-bottom: 3px;">Condición Laboral:</span>
                                            <strong id="workerCondicionText" style="color: #6A0D25; font-size: 1rem;">PERSONAL FIJO</strong>
                                        </div>
                                        <div>
                                            <span style="color: #64748b; font-size: 0.82rem; display: block; margin-bottom: 3px;">Cargo Institucional:</span>
                                            <strong id="workerCargo" style="color: #6A0D25; font-size: 1rem;">-</strong>
                                        </div>
                                        <div>
                                            <span style="color: #64748b; font-size: 0.82rem; display: block; margin-bottom: 3px;">Fecha de Ingreso:</span>
                                            <strong id="workerFechaIngreso" style="color: #1e293b; font-size: 1rem;">-</strong>
                                        </div>
                                        <div>
                                            <span style="color: #64748b; font-size: 0.82rem; display: block; margin-bottom: 3px;">Salario / Remuneración Mensual:</span>
                                            <strong id="workerSalario" style="color: #83122F; font-size: 1.05rem;">Bs. 1.000,00</strong>
                                        </div>
                                        <div>
                                            <span style="color: #64748b; font-size: 0.82rem; display: block; margin-bottom: 3px;">Años de Servicio:</span>
                                            <strong id="workerYears" style="color: #1e293b; font-size: 1.05rem;">-</strong>
                                        </div>
                                        <div style="grid-column: span 2;">
                                            <span style="color: #64748b; font-size: 0.82rem; display: block; margin-bottom: 3px;">Dependencia Administrativa:</span>
                                            <strong id="workerDep" style="color: #1e293b;">-</strong>
                                        </div>
                                        <div style="grid-column: span 2;">
                                            <span style="color: #64748b; font-size: 0.82rem; display: block; margin-bottom: 3px;">Dirección / Oficina Adscrita:</span>
                                            <strong id="workerDireccion" style="color: #6A0D25; font-size: 1.02rem;">-</strong>
                                        </div>
                                    </div>
                                </div>

                                <!-- Generador de Constancia (Solo para trabajadores) -->
                                <div style="background: white; border: 2px dashed #D4AF37; border-radius: 16px; padding: 30px; box-shadow: 0 4px 15px rgba(106,13,37,0.06);">
                                    <h4 id="workerCertHeader" style="color: #6A0D25; font-size: 1.15rem; margin-bottom: 8px; display: flex; align-items: center; gap: 10px;">
                                        <i class="fas fa-file-invoice" style="color: #D4AF37;"></i> Generar Constancia Oficial (<span id="workerCertModelBadge">Personal Fijo</span>)
                                    </h4>
                                    <p id="workerCertDesc" style="font-size: 0.92rem; color: #64748b; margin-bottom: 20px;">
                                        Modelo oficial adaptado automáticamente a su condición laboral.
                                    </p>
                                    
                                    <div style="margin-bottom: 20px;">
                                        <label style="display: block; font-weight: 700; font-size: 0.88rem; color: #334155; margin-bottom: 8px;">
                                            <i class="fas fa-coins" style="color: #D4AF37;"></i> Modalidad Salarial:
                                        </label>
                                        <select id="conSalarioSelect" style="width: 100%; padding: 12px 14px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.95rem; outline: none; background: #f8fafc; font-weight: 600; color: #1e293b;">
                                            <option value="true">Con Salario (Refleja Asignación Mensual en letras y números)</option>
                                            <option value="false">Sin Salario (Solo cargo, dependencia y tiempo de servicio)</option>
                                        </select>
                                    </div>

                                    <button id="requestCertBtn" style="width: 100%; background: linear-gradient(135deg, #6A0D25, #83122F); border: 1.5px solid #D4AF37; color: white; padding: 14px; border-radius: 8px; font-weight: 700; font-size: 1rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; transition: all 0.2s; box-shadow: 0 4px 12px rgba(106,13,37,0.25);">
                                        <i class="fas fa-file-alt"></i> Generar y Ver Constancia Oficial
                                    </button>
                                    <div id="certMessage" style="margin-top: 15px; font-size: 0.95rem; text-align: center; font-weight: 600;"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 3. VISTA DE ADMINISTRADOR (PANTALLA COMPLETA - GESTIÓN TOTAL DE PERSONAL) -->
                    <div id="adminView" style="display: none; background: #f8fafc; height: 100%; flex: 1; min-height: 0; flex-direction: column;">
                        <div class="admin-header">
                            <div>
                                <h3 style="margin: 0; font-size: 1.3rem;"><i class="fas fa-user-shield"></i> Panel de Administración PGET</h3>
                                <span style="font-size: 0.85rem; opacity: 0.9;">Control y Gestión General de Usuarios y Personal</span>
                            </div>
                            <div style="display: flex; gap: 10px;">
                                <button onclick="window.pgetLogout()" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 8px 16px; border-radius: 6px; font-size: 0.88rem; cursor: pointer; font-weight: 600;">
                                    <i class="fas fa-sign-out-alt"></i> Cerrar Sesión
                                </button>
                                <button onclick="document.getElementById('loginModal').classList.remove('show')" style="background: rgba(255,255,255,0.25); border: none; color: white; padding: 8px 16px; border-radius: 6px; font-size: 0.88rem; cursor: pointer; font-weight: 600;">
                                    <i class="fas fa-times"></i> Volver al Portal Web
                                </button>
                            </div>
                        </div>

                        <!-- Barra de herramientas Admin -->
                        <div class="admin-toolbar" style="padding: 15px 30px; background: white; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px;">
                            <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                                <span id="adminUsersCount" style="font-size: 0.92rem; font-weight: 700; color: #1e293b; background: #e2e8f0; padding: 7px 16px; border-radius: 20px;">
                                    0 Usuarios Registrados
                                </span>
                                <input type="text" id="adminUserFilter" placeholder="Buscar por nombre, cargo, cédula, dirección..." onkeyup="window.filterAdminUsers()" style="padding: 9px 14px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.9rem; outline: none; width: 280px;">
                                
                                <!-- Filtro por Condición Laboral: Fijos, Contratados, Jubilados -->
                                <div id="condFilterGroup" style="display: flex; gap: 4px; align-items: center; background: #f1f5f9; padding: 4px; border-radius: 8px; border: 1px solid #cbd5e1;">
                                    <button type="button" class="cond-filter-btn active" data-cond="" onclick="window.setCondicionFilter('')" style="border: 1px solid #D4AF37; background: #6A0D25; color: white; padding: 6px 13px; border-radius: 6px; font-size: 0.83rem; font-weight: 700; cursor: pointer; transition: all 0.2s;">
                                        Todos
                                    </button>
                                    <button type="button" class="cond-filter-btn" data-cond="FIJO" onclick="window.setCondicionFilter('FIJO')" style="border: none; background: transparent; color: #6A0D25; padding: 6px 13px; border-radius: 6px; font-size: 0.83rem; font-weight: 700; cursor: pointer; transition: all 0.2s;">
                                        Fijos
                                    </button>
                                    <button type="button" class="cond-filter-btn" data-cond="CONTRATADO" onclick="window.setCondicionFilter('CONTRATADO')" style="border: none; background: transparent; color: #0284c7; padding: 6px 13px; border-radius: 6px; font-size: 0.83rem; font-weight: 700; cursor: pointer; transition: all 0.2s;">
                                        Contratados
                                    </button>
                                    <button type="button" class="cond-filter-btn" data-cond="JUBILADO" onclick="window.setCondicionFilter('JUBILADO')" style="border: none; background: transparent; color: #7e22ce; padding: 6px 13px; border-radius: 6px; font-size: 0.83rem; font-weight: 700; cursor: pointer; transition: all 0.2s;">
                                        Jubilados
                                    </button>
                                </div>
                            </div>
                            <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                                <button type="button" onclick="window.openManageCargosModal()" style="background: #ffffff; border: 1.5px solid #cbd5e1; color: #1e293b; padding: 10px 16px; border-radius: 8px; font-weight: 700; font-size: 0.9rem; cursor: pointer; display: flex; align-items: center; gap: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.04); transition: all 0.2s;">
                                    <i class="fas fa-briefcase" style="color: #6A0D25;"></i> Añadir / Gestionar Cargos
                                </button>
                                <button onclick="window.openCreateUserForm()" style="background: linear-gradient(135deg, #6A0D25, #83122F); border: 1.5px solid #D4AF37; color: white; padding: 10px 20px; border-radius: 8px; font-weight: 700; font-size: 0.92rem; cursor: pointer; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 10px rgba(106,13,37,0.25);">
                                    <i class="fas fa-user-plus"></i> + Registrar Nuevo Usuario
                                </button>
                            </div>
                        </div>

                        <!-- Tabla de Usuarios (Aprovecha 100% de la altura disponible) -->
                        <div class="admin-table-container" style="flex: 1; min-height: 0; overflow-y: auto; padding: 20px 30px;">
                            <table class="admin-users-table" id="adminUsersTable">
                                <thead>
                                    <tr>
                                        <th>Nombre y Cédula</th>
                                        <th>Correo / Usuario</th>
                                        <th>Cargo, Dependencia y Dirección</th>
                                        <th>Rol</th>
                                        <th style="text-align: right;">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody id="adminUsersListBody">
                                    <tr>
                                        <td colspan="5" style="text-align: center; padding: 25px; color: #64748b;">
                                             <i class="fas fa-spinner fa-spin"></i> Cargando usuarios...
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <!-- Aviso Legal Administrador (Barra Compacta Elegante) -->
                        <div style="background: #f1f5f9; border-top: 1px solid #cbd5e1; padding: 9px 30px; font-size: 0.8rem; color: #475569; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
                            <span><i class="fas fa-lock"></i> Modo Administrador activo: El administrador gestiona el personal y no emite constancias individuales.</span>
                            <span style="font-weight: 700; color: #6A0D25;">Procuraduría General del Estado Trujillo</span>
                        </div>
                    </div>

                    <!-- 4. VISTA / FORMULARIO CREAR Y EDITAR USUARIO (PANTALLA COMPLETA) -->
                    <div id="userFormView" style="display: none; background: #f8fafc; height: 100%; flex-direction: column;">
                        <div style="background: linear-gradient(135deg, #6A0D25, #450614); border-bottom: 2px solid #D4AF37; color: white; padding: 18px 30px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 10px rgba(0,0,0,0.15);">
                            <h3 id="userFormTitle" style="margin: 0; font-size: 1.25rem;"><i class="fas fa-user-edit"></i> Registrar Nuevo Usuario</h3>
                            <button type="button" onclick="window.backToAdminView()" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 8px 18px; border-radius: 6px; cursor: pointer; font-weight: 600; display: flex; align-items: center; gap: 8px;">
                                <i class="fas fa-arrow-left"></i> Volver al Panel
                            </button>
                        </div>

                        <div style="flex: 1; overflow-y: auto; padding: 30px 20px;">
                            <form id="saveUserForm" style="max-width: 1050px; margin: 0 auto; background: white; padding: 35px 40px; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px;">
                                    
                                    <div style="grid-column: span 2;">
                                        <h4 style="color: #6A0D25; font-size: 1.05rem; margin-bottom: 8px; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px;">
                                            <i class="fas fa-key"></i> 1. Credenciales de Acceso
                                        </h4>
                                    </div>
                                    
                                    <div>
                                        <label style="display: block; font-weight: 700; font-size: 0.85rem; color: #334155; margin-bottom: 5px;">Correo Electrónico *</label>
                                        <input type="email" id="formUsername" required placeholder="ejemplo@pget.gob.ve" style="width: 100%; padding: 11px 14px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.92rem; box-sizing: border-box;">
                                    </div>

                                    <div>
                                        <label style="display: block; font-weight: 700; font-size: 0.85rem; color: #334155; margin-bottom: 5px;">Rol del Usuario *</label>
                                        <select id="formRole" required style="width: 100%; padding: 11px 14px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.92rem; box-sizing: border-box; background: white;">
                                            <option value="trabajador">Trabajador (Puede generar y descargar constancias)</option>
                                            <option value="admin">Administrador (Gestión total de personal y sistema)</option>
                                        </select>
                                    </div>

                                    <!-- Botón para Cambiar Contraseña (Solo en Modo Edición) -->
                                    <div id="changePasswordBtnWrapper" style="grid-column: span 2; display: none; margin: 4px 0 6px 0;">
                                        <button type="button" id="btnToggleChangePass" onclick="window.toggleChangePasswordSection()" style="background: #f1f5f9; color: #1e293b; border: 1px solid #cbd5e1; padding: 10px 18px; border-radius: 8px; font-weight: 700; font-size: 0.9rem; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: all 0.2s;">
                                            <i class="fas fa-key" style="color: #D4AF37;"></i> Cambiar Contraseña
                                        </button>
                                        <span style="font-size: 0.82rem; color: #64748b; margin-left: 12px;">(Pulse este botón si desea asignar una nueva contraseña a este usuario)</span>
                                    </div>

                                    <!-- Contenedor de Contraseña y Confirmación con ojitos minimalistas -->
                                    <div id="passwordFieldsContainer" style="grid-column: span 2; display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                                        <div>
                                            <label style="display: block; font-weight: 700; font-size: 0.85rem; color: #334155; margin-bottom: 5px;">
                                                <span id="formPassLabel">Contraseña *</span>
                                            </label>
                                            <div style="position: relative;">
                                                <input type="password" id="formPassword" placeholder="Contraseña segura" style="width: 100%; padding: 11px 42px 11px 14px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.92rem; box-sizing: border-box;">
                                                <button type="button" onclick="window.togglePasswordVisibility('formPassword', this)" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: transparent; border: none; cursor: pointer; color: #94a3b8; font-size: 0.9rem; padding: 6px; display: flex; align-items: center; justify-content: center; outline: none;" title="Mostrar / Ocultar">
                                                    <i class="fas fa-eye"></i>
                                                </button>
                                            </div>
                                        </div>

                                        <div>
                                            <label style="display: block; font-weight: 700; font-size: 0.85rem; color: #334155; margin-bottom: 5px;">
                                                <span id="formPassConfirmLabel">Confirmar Contraseña *</span>
                                            </label>
                                            <div style="position: relative;">
                                                <input type="password" id="formPasswordConfirm" placeholder="Confirme la contraseña" style="width: 100%; padding: 11px 42px 11px 14px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.92rem; box-sizing: border-box;">
                                                <button type="button" onclick="window.togglePasswordVisibility('formPasswordConfirm', this)" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: transparent; border: none; cursor: pointer; color: #94a3b8; font-size: 0.9rem; padding: 6px; display: flex; align-items: center; justify-content: center; outline: none;" title="Mostrar / Ocultar">
                                                    <i class="fas fa-eye"></i>
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div style="grid-column: span 2; margin-top: 15px;">
                                        <h4 style="color: #6A0D25; font-size: 1.05rem; margin-bottom: 8px; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px;">
                                            <i class="fas fa-address-card"></i> 2. Datos Personales
                                        </h4>
                                    </div>

                                    <div>
                                        <label style="display: block; font-weight: 700; font-size: 0.85rem; color: #334155; margin-bottom: 5px;">Nombres *</label>
                                        <input type="text" id="formNombres" required placeholder="ej. VICTORIA ALEJANDRA" style="width: 100%; padding: 11px 14px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.92rem; box-sizing: border-box;">
                                    </div>

                                    <div>
                                        <label style="display: block; font-weight: 700; font-size: 0.85rem; color: #334155; margin-bottom: 5px;">Apellidos *</label>
                                        <input type="text" id="formApellidos" required placeholder="ej. CARMONA TORRES" style="width: 100%; padding: 11px 14px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.92rem; box-sizing: border-box;">
                                    </div>

                                    <div>
                                        <label style="display: block; font-weight: 700; font-size: 0.85rem; color: #334155; margin-bottom: 5px;">
                                            Cédula de Identidad * <span style="font-weight: 400; color: #6A0D25; font-size: 0.8rem;">(Solo números)</span>
                                        </label>
                                        <input type="text" id="formCedula" required inputmode="numeric" pattern="[0-9]*" maxlength="10" placeholder="Solo números (ej. 12345678)" oninput="this.value = this.value.replace(/[^0-9]/g, '')" style="width: 100%; padding: 11px 14px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.92rem; box-sizing: border-box;">
                                    </div>

                                    <div>
                                        <label style="display: block; font-weight: 700; font-size: 0.85rem; color: #334155; margin-bottom: 5px;">Género *</label>
                                        <div style="display: flex; gap: 24px; align-items: center; padding: 10px 14px; background: white; border: 1px solid #cbd5e1; border-radius: 8px; min-height: 44px; box-sizing: border-box;">
                                            <label style="display: inline-flex; align-items: center; gap: 8px; cursor: pointer; font-size: 0.92rem; font-weight: 600; color: #1e293b; margin: 0;">
                                                <input type="radio" name="formGenero" id="formGeneroMasculino" value="masculino" checked style="width: 18px; height: 18px; accent-color: #6A0D25; cursor: pointer;">
                                                <span>Masculino</span>
                                            </label>
                                            <label style="display: inline-flex; align-items: center; gap: 8px; cursor: pointer; font-size: 0.92rem; font-weight: 600; color: #1e293b; margin: 0;">
                                                <input type="radio" name="formGenero" id="formGeneroFemenino" value="femenino" style="width: 18px; height: 18px; accent-color: #6A0D25; cursor: pointer;">
                                                <span>Femenino</span>
                                            </label>
                                        </div>
                                    </div>

                                    <div style="grid-column: span 2;">
                                        <label style="display: block; font-weight: 700; font-size: 0.85rem; color: #334155; margin-bottom: 5px;">
                                            Profesión / Título Académico * <span style="font-weight: 400; color: #6A0D25; font-size: 0.8rem;">(Prefijo: Abog., Ing., T.S.U., Lic.)</span>
                                        </label>
                                        <select id="formProfesion" required style="width: 100%; padding: 11px 14px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.92rem; box-sizing: border-box; background: white;">
                                            <option value="Abogado">Abogado (Prefijo: Abog. Nombre)</option>
                                            <option value="Ingeniero">Ingeniero (Prefijo: Ing. Nombre)</option>
                                            <option value="Licenciado">Licenciado (Prefijo: Lic. Nombre)</option>
                                            <option value="Técnico Superior">Técnico Superior (Prefijo: T.S.U. Nombre)</option>
                                            <option value="Profesor">Profesor (Prefijo: Prof. Nombre)</option>
                                            <option value="Doctor">Doctor (Prefijo: Dr. Nombre)</option>
                                            <option value="Bachiller">Bachiller (Sin prefijo)</option>
                                            <option value="Otro">Otro</option>
                                        </select>
                                    </div>

                                    <div style="grid-column: span 2; margin-top: 15px;">
                                        <h4 style="color: #6A0D25; font-size: 1.05rem; margin-bottom: 8px; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px;">
                                            <i class="fas fa-briefcase"></i> 3. Datos Laborales y Administrativos
                                        </h4>
                                    </div>

                                    <!-- Cargo Institucional con Buscador y Desplegable -->
                                    <div>
                                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                                            <label style="font-weight: 700; font-size: 0.85rem; color: #334155; margin: 0;">Cargo Institucional *</label>
                                            <button type="button" onclick="window.openManageCargosModal()" style="background: none; border: none; color: #0284c7; font-size: 0.8rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; padding: 0;">
                                                <i class="fas fa-plus-circle"></i> Gestionar Cargos
                                            </button>
                                        </div>
                                        <div style="position: relative;">
                                            <input type="text" id="formCargo" required autocomplete="off" placeholder="Escriba para buscar o seleccione un cargo..." style="width: 100%; padding: 11px 36px 11px 14px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.92rem; box-sizing: border-box; text-transform: uppercase;">
                                            <button type="button" id="toggleCargoDropdownBtn" style="position: absolute; right: 0; top: 0; bottom: 0; width: 36px; background: transparent; border: none; cursor: pointer; color: #64748b; font-size: 0.85rem; display: flex; align-items: center; justify-content: center;" title="Ver todos los cargos">
                                                <i class="fas fa-chevron-down"></i>
                                            </button>
                                            <div id="cargoDropdownList" class="cargo-dropdown-list"></div>
                                        </div>
                                        <small style="color: #64748b; font-size: 0.78rem;">Escriba para buscar o use la flecha para ver el listado de cargos</small>
                                    </div>

                                    <div>
                                        <label style="display: block; font-weight: 700; font-size: 0.85rem; color: #334155; margin-bottom: 5px;">
                                            Condición Laboral * <span style="font-weight: 400; color: #6A0D25; font-size: 0.8rem;">(Define su modelo de constancia)</span>
                                        </label>
                                        <select id="formCondicion" required style="width: 100%; padding: 11px 14px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.92rem; box-sizing: border-box; background: white; font-weight: 600;">
                                            <option value="FIJO">FIJO (Constancia de Trabajo - Personal Fijo)</option>
                                            <option value="CONTRATADO">CONTRATADO (Constancia de Trabajo - Personal Contratado)</option>
                                            <option value="JUBILADO">JUBILADO (Constancia de Jubilación - Personal Jubilado)</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label style="display: block; font-weight: 700; font-size: 0.85rem; color: #334155; margin-bottom: 5px;">
                                            Salario / Remuneración Mensual * <span style="font-weight: 400; color: #64748b; font-size: 0.8rem;">(Ej. 1.000,00)</span>
                                        </label>
                                        <div style="display: flex; align-items: stretch; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; background: white; box-shadow: inset 0 1px 2px rgba(0,0,0,0.02);">
                                            <span style="background: #f1f5f9; color: #6A0D25; font-weight: 700; font-size: 0.92rem; padding: 11px 14px; border-right: 1px solid #cbd5e1; display: flex; align-items: center; user-select: none;">
                                                Bs.
                                            </span>
                                            <input type="text" id="formSalario" required placeholder="1.000,00" value="1.000,00" style="flex: 1; border: none; padding: 11px 14px; font-size: 0.92rem; outline: none; box-sizing: border-box; color: #1e293b; font-weight: 600;">
                                        </div>
                                        <small style="color: #64748b; font-size: 0.78rem;">El prefijo "Bs." es fijo e inamovible; escriba únicamente el monto numérico.</small>
                                    </div>

                                    <!-- Fecha de Ingreso con Selector Calendario Interactivo -->
                                    <div>
                                        <label style="display: block; font-weight: 700; font-size: 0.85rem; color: #334155; margin-bottom: 5px;">
                                            <i class="fas fa-calendar-alt" style="color: #6A0D25;"></i> Fecha de Ingreso * <span style="font-weight: 400; color: #64748b; font-size: 0.8rem;">(Seleccionar en el calendario)</span>
                                        </label>
                                        <input type="date" id="formFechaIngreso" required style="width: 100%; padding: 11px 14px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.92rem; box-sizing: border-box; background: white; color: #1e293b; cursor: pointer;">
                                        <small style="color: #64748b; font-size: 0.78rem;">Haga clic para abrir el calendario y seleccionar la fecha exacta</small>
                                    </div>

                                    <div style="grid-column: span 2;">
                                        <label style="display: block; font-weight: 700; font-size: 0.85rem; color: #334155; margin-bottom: 5px;">Años de Servicio <span style="font-weight: 400; color: #6A0D25; font-size: 0.8rem;">(Cálculo Automático)</span></label>
                                        <input type="text" id="formAnos" readonly style="width: 100%; padding: 11px 14px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.92rem; box-sizing: border-box; background: #f1f5f9; color: #6A0D25; font-weight: 700; cursor: not-allowed;" placeholder="0">
                                        <small style="color: #83122F; font-size: 0.78rem; font-weight: 600; display: block; margin-top: 2px;"><i class="fas fa-calculator"></i> Se calcula automáticamente según la fecha de ingreso</small>
                                    </div>

                                    <!-- Dependencia Administrativa como Ventana Desplegable con Valor Fijo -->
                                    <div style="grid-column: span 2;">
                                        <label style="display: block; font-weight: 700; font-size: 0.85rem; color: #334155; margin-bottom: 5px;">
                                            <i class="fas fa-landmark" style="color: #6A0D25;"></i> Dependencia Administrativa *
                                        </label>
                                        <select id="formDependencia" required style="width: 100%; padding: 11px 14px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.92rem; box-sizing: border-box; background: white; font-weight: 600; color: #1e293b; cursor: pointer;">
                                            <option value="PROCURADURÍA GENERAL DEL ESTADO TRUJILLO" selected>PROCURADURÍA GENERAL DEL ESTADO TRUJILLO</option>
                                        </select>
                                    </div>

                                    <div style="grid-column: span 2;">
                                        <label style="display: block; font-weight: 700; font-size: 0.85rem; color: #334155; margin-bottom: 5px;">Dirección / Oficina Adscrita *</label>
                                        <select id="formDireccion" required style="width: 100%; padding: 11px 14px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.92rem; box-sizing: border-box; background: white;">
                                            <option value="DESPACHO DEL PROCURADOR GENERAL">Despacho del Procurador o Procuradora General</option>
                                            <option value="DIRECCIÓN GENERAL">Dirección General</option>
                                            <option value="DIRECCIÓN DE RECURSOS HUMANOS">Dirección de Recursos Humanos</option>
                                            <option value="DIRECCIÓN DE ASUNTOS JURÍDICOS">Dirección de Asuntos Jurídicos</option>
                                            <option value="DIRECCIÓN DE ADMINISTRACIÓN">Dirección de Administración</option>
                                            <option value="DIRECCIÓN DE BIENES Y SERVICIOS">Dirección de Bienes y Servicios</option>
                                            <option value="UNIDAD DE AUDITORÍA INTERNA">Unidad de Auditoría Interna</option>
                                            <option value="OFICINA DE ATENCIÓN AL CIUDADANO">Oficina de Atención al Ciudadano</option>
                                        </select>
                                    </div>

                                </div>

                                <div id="formUserError" style="display: none; color: #dc2626; background: #fef2f2; border: 1px solid #fecaca; padding: 12px; border-radius: 8px; margin-bottom: 18px; font-size: 0.9rem; text-align: center;"></div>

                                <div style="display: flex; justify-content: flex-end; gap: 15px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
                                    <button type="button" onclick="window.backToAdminView()" style="background: #e2e8f0; border: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 0.95rem; cursor: pointer; color: #475569;">
                                        Cancelar
                                    </button>
                                    <button type="submit" id="saveUserSubmitBtn" style="background: linear-gradient(135deg, #6A0D25, #83122F); border: 1.5px solid #D4AF37; color: white; padding: 12px 30px; border-radius: 8px; font-weight: 700; font-size: 0.95rem; cursor: pointer; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 10px rgba(106,13,37,0.3);">
                                        <i class="fas fa-save"></i> Guardar Usuario
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>

                </div>
            </div>`;
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            modal = document.getElementById('loginModal');
            attachModalEvents(modal);
        }

        // Si no hay sesión activa, garantizar que sólo se muestre el formulario de login
        if (!currentUser && modal) {
            const mainContent = modal.querySelector('#mainModalContent');
            if (mainContent) {
                mainContent.classList.remove('portal-fullscreen');
                mainContent.classList.remove('admin-modal-size');
            }
            const lv = modal.querySelector('#loginView');
            const wv = modal.querySelector('#workerView');
            const av = modal.querySelector('#adminView');
            const uf = modal.querySelector('#userFormView');
            if (lv) lv.style.display = 'block';
            if (wv) wv.style.display = 'none';
            if (av) av.style.display = 'none';
            if (uf) uf.style.display = 'none';
        }
        return modal;
    }

    // Attach interaction events
    function attachModalEvents(modal) {
        if (!modal) return;
        const closeBtn = modal.querySelector('#modalCloseBtn') || modal.querySelector('.close-btn');
        if (closeBtn) {
            closeBtn.onclick = () => modal.classList.remove('show');
        }

        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.classList.remove('show');
            }
        };

        const fechaInput = modal.querySelector('#formFechaIngreso');
        const anosInput = modal.querySelector('#formAnos');
        if (fechaInput && anosInput) {
            const handleDateCalc = () => {
                anosInput.value = calculateYearsOfService(fechaInput.value).toString();
            };
            fechaInput.addEventListener('input', handleDateCalc);
            fechaInput.addEventListener('change', handleDateCalc);
        }

        // Inicializar dropdown interactivo y buscador de cargos
        setupCargoSearchableDropdown(modal);

        const genderRadios = modal.querySelectorAll('input[name="formGenero"]');
        const formProf = modal.querySelector('#formProfesion');
        genderRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                if (radio.checked && formProf) {
                    updateFormProfesionOptions(radio.value, formProf.value);
                }
            });
        });

        const cedulaInput = modal.querySelector('#formCedula');
        if (cedulaInput) {
            cedulaInput.addEventListener('input', () => {
                cedulaInput.value = cedulaInput.value.replace(/[^0-9]/g, '');
            });
        }

        const salarioInput = modal.querySelector('#formSalario');
        if (salarioInput) {
            salarioInput.addEventListener('input', () => {
                const cleaned = salarioInput.value.replace(/^[bB][sS]\.?\s*/, '');
                if (cleaned !== salarioInput.value) {
                    salarioInput.value = cleaned;
                }
            });
        }

        const togglePassword = modal.querySelector('#togglePassword');
        const passwordInput = modal.querySelector('#password');
        if (togglePassword && passwordInput) {
            togglePassword.onclick = () => {
                const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
                passwordInput.setAttribute('type', type);
                if (type === 'text') {
                    togglePassword.classList.remove('fa-eye');
                    togglePassword.classList.add('fa-eye-slash');
                } else {
                    togglePassword.classList.remove('fa-eye-slash');
                    togglePassword.classList.add('fa-eye');
                }
            };
        }

        // Login Form Handler
        const loginForm = modal.querySelector('#loginForm');
        const errorMsg = modal.querySelector('#loginError');
        const submitBtn = modal.querySelector('#submitLoginBtn');

        if (loginForm) {
            loginForm.onsubmit = async (e) => {
                e.preventDefault();
                const username = modal.querySelector('#username').value.trim();
                const password = passwordInput ? passwordInput.value.trim() : '';

                try {
                    if (submitBtn) {
                        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Validando credenciales...';
                        submitBtn.disabled = true;
                    }
                    if (errorMsg) {
                        errorMsg.style.display = 'none';
                        errorMsg.textContent = '';
                    }

                    // Petición al backend
                    const response = await fetch(`${API_URL}/login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username, password })
                    });
                    const data = await response.json();

                    if (response.ok) {
                        currentToken = data.token;
                        currentUser = data.user;
                        handlePostLogin(currentUser);
                    } else {
                        // Fallback offline en caso de que el backend no esté encendido
                        // Fallback offline en caso de que el backend no esté encendido
                        const offlineMatch = checkOfflineAuth(username, password);
                        if (offlineMatch) {
                            currentToken = `offline-token-${offlineMatch.username}`;
                            currentUser = offlineMatch;
                            handlePostLogin(currentUser);
                        } else {
                            if (errorMsg) {
                                errorMsg.style.display = 'block';
                                errorMsg.textContent = data.detail || 'Usuario o contraseña incorrectos.';
                            }
                        }
                    }
                } catch (error) {
                    // Fallback offline cuando el servidor FastAPI no está corriendo
                    const offlineMatch = checkOfflineAuth(username, password);
                    if (offlineMatch) {
                        currentToken = `offline-token-${offlineMatch.username}`;
                        currentUser = offlineMatch;
                        handlePostLogin(currentUser);
                    } else {
                        if (errorMsg) {
                            errorMsg.style.display = 'block';
                            errorMsg.textContent = 'Error de conexión con el servidor. Verifica las credenciales.';
                        }
                    }
                } finally {
                    if (submitBtn) {
                        submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Iniciar Sesión';
                        submitBtn.disabled = false;
                    }
                }
            };
        }

        // Formulario Guardar Usuario (Crear / Editar)
        const saveForm = modal.querySelector('#saveUserForm');
        if (saveForm) {
            saveForm.onsubmit = async (e) => {
                e.preventDefault();
                await handleSaveUser();
            };
        }

        // Generar Constancia (Trabajador)
        const certBtn = modal.querySelector('#requestCertBtn');
        if (certBtn) {
            certBtn.onclick = async () => {
                await handleRequestCert();
            };
        }
    }

    // Navegación post-login según el rol (Modo Pantalla Completa)
    function handlePostLogin(user) {
        const modal = document.getElementById('loginModal');
        const mainContent = document.getElementById('mainModalContent');
        const loginView = modal.querySelector('#loginView');
        const workerView = modal.querySelector('#workerView');
        const adminView = modal.querySelector('#adminView');
        const userFormView = modal.querySelector('#userFormView');
        const loginBtn = document.getElementById('loginBtn');

        if (loginView) loginView.style.display = 'none';
        if (userFormView) userFormView.style.display = 'none';

        if (loginBtn) {
            loginBtn.innerHTML = `<i class="fas fa-user-circle"></i> ${user.nombre ? user.nombre.split(' ')[0] : user.username}`;
        }

        const closeBtn = modal.querySelector('#modalCloseBtn');
        if (closeBtn) closeBtn.style.display = 'none';

        if (mainContent) {
            mainContent.classList.add('portal-fullscreen');
        }

        if (user.role === 'admin') {
            // MOSTRAR PANEL ADMINISTRADOR
            if (mainContent) mainContent.classList.add('admin-modal-size');
            if (workerView) workerView.style.display = 'none';
            if (adminView) adminView.style.display = 'flex';
            loadAdminUsers();
        } else {
            // MOSTRAR VISTA TRABAJADOR
            if (mainContent) mainContent.classList.remove('admin-modal-size');
            if (adminView) adminView.style.display = 'none';
            if (workerView) workerView.style.display = 'flex';
            populateWorkerData(user);
        }
    }

    function populateWorkerData(user) {
        const modal = document.getElementById('loginModal');
        const cond = (user.condicion || 'FIJO').toUpperCase();
        const genero = (user.genero || 'masculino').toLowerCase();
        const prof = formatProfessionByGender(user.profesion || '', genero);
        
        modal.querySelector('#workerName').textContent = formatFullNameWithTitle(user.nombre, prof, genero) || 'No registrado';
        modal.querySelector('#workerCedula').textContent = formatCedulaOficial(user.cedula) || 'No registrada';
        
        const profEl = modal.querySelector('#workerProfesion');
        if (profEl) profEl.textContent = prof || 'No especificada';

        const condTextEl = modal.querySelector('#workerCondicionText');
        if (condTextEl) condTextEl.textContent = `PERSONAL ${cond}`;

        const condBadgeEl = modal.querySelector('#workerCondicionBadge');
        if (condBadgeEl) {
            condBadgeEl.textContent = cond;
            condBadgeEl.className = `condicion-badge ${cond.toLowerCase()}`;
        }

        modal.querySelector('#workerCargo').textContent = user.cargo || 'No registrado';
        
        const fechaIngresoEl = modal.querySelector('#workerFechaIngreso');
        if (fechaIngresoEl) fechaIngresoEl.textContent = user.fecha_ingreso || 'No registrada';

        const salarioEl = modal.querySelector('#workerSalario');
        if (salarioEl) salarioEl.textContent = user.salario || 'Bs. 1.000,00';

        const autoYears = calculateYearsOfService(user.fecha_ingreso || '') || user.anos_servicio || '0';
        modal.querySelector('#workerYears').textContent = autoYears + ' años';

        modal.querySelector('#workerDep').textContent = user.dependencia || 'PROCURADURÍA GENERAL DEL ESTADO TRUJILLO';
        
        const dirEl = modal.querySelector('#workerDireccion');
        if (dirEl) {
            dirEl.textContent = user.direccion || 'DIRECCIÓN GENERAL';
        }
        
        // Adaptar encabezado y descripción de la constancia según la condición
        const certBadge = modal.querySelector('#workerCertModelBadge');
        const certDesc = modal.querySelector('#workerCertDesc');
        if (certBadge && certDesc) {
            if (cond === 'JUBILADO') {
                certBadge.textContent = 'Personal Jubilado';
                certDesc.textContent = 'Modelo oficial de Constancia de Jubilación asignado conforme a su condición de personal jubilado.';
            } else if (cond === 'CONTRATADO') {
                certBadge.textContent = 'Personal Contratado';
                certDesc.textContent = 'Modelo oficial de Constancia de Trabajo asignado conforme a su modalidad de contrato de servicios.';
            } else {
                certBadge.textContent = 'Personal Fijo';
                certDesc.textContent = 'Modelo oficial de Constancia de Trabajo asignado conforme a su condición de personal fijo / ordinario.';
            }
        }

        const certMsg = modal.querySelector('#certMessage');
        if (certMsg) certMsg.textContent = '';
    }

    // Cargar Usuarios en el Panel de Administrador
    async function loadAdminUsers() {
        const tbody = document.getElementById('adminUsersListBody');
        const countBadge = document.getElementById('adminUsersCount');
        
        try {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;"><i class="fas fa-spinner fa-spin"></i> Cargando usuarios desde la base de datos...</td></tr>';
            
            let users = null;
            try {
                const res = await fetch(`${API_URL}/users`);
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data)) {
                        users = data.filter(u => u.username.toLowerCase() !== 'admin' && u.username.toLowerCase() !== 'trabajador1');
                        localStorage.setItem('pget_cached_users', JSON.stringify(users));
                    }
                }
            } catch (err) {
                console.warn('API warning al cargar usuarios:', err);
            }

            // Si la API no respondió por fallo de red, usar el cache persistente local
            if (!users) {
                const cached = localStorage.getItem('pget_cached_users');
                if (cached) {
                    try {
                        users = JSON.parse(cached);
                    } catch (e) {}
                }
            }

            // Fallback de inicialización exclusiva si no hay datos en BD ni en caché
            if (!users || users.length === 0) {
                users = defaultAccounts.filter(a => a.username === 'admin@pget.gob.ve').map(a => {
                    const c = { ...a };
                    delete c.password;
                    return c;
                });
            }

            // Garantizar siempre que no aparezca el duplicado 'admin' o 'trabajador1'
            users = users.filter(u => u.username.toLowerCase() !== 'admin' && u.username.toLowerCase() !== 'trabajador1');

            allUsersCache = users;
            renderAdminUsersTable(users);

        } catch (error) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:#dc2626;">Error al cargar la lista de usuarios.</td></tr>';
        }
    }

    function renderAdminUsersTable(users) {
        const tbody = document.getElementById('adminUsersListBody');
        const countBadge = document.getElementById('adminUsersCount');
        const condLabel = currentCondicionFilter ? ` (${currentCondicionFilter})` : '';
        countBadge.textContent = `${users.length} Usuarios Registrados${condLabel}`;

        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:25px; color:#64748b;">No hay usuarios registrados bajo el filtro seleccionado.</td></tr>';
            return;
        }

        tbody.innerHTML = users.map(u => {
            const cond = (u.condicion || 'FIJO').toUpperCase();
            const gen = (u.genero || 'masculino').toLowerCase();
            const prof = formatProfessionByGender(u.profesion, gen);
            const fullNameWithTitle = formatFullNameWithTitle(u.nombre, prof, gen);
            const cedulaOficial = formatCedulaOficial(u.cedula);
            const safeUsername = escapeHtml(u.username);
            const safeFullName = escapeHtml(fullNameWithTitle || 'Sin nombre');
            const safeCargo = escapeHtml(u.cargo || 'Sin cargo asignado');
            const safeDireccion = escapeHtml(u.direccion || 'DIRECCIÓN GENERAL');
            const safeSalario = escapeHtml(u.salario || 'Bs. 1.000,00');
            const safeCedula = escapeHtml(cedulaOficial || 'N/A');
            const safeCond = escapeHtml(cond);
            const safeNameRaw = escapeHtml(u.nombre || u.username);

            return `
            <tr>
                <td>
                    <strong style="color: #1e293b; display: block; font-size: 0.95rem;">${safeFullName}</strong>
                    <div style="display: flex; gap: 8px; align-items: center; margin-top: 4px; flex-wrap: wrap;">
                        <span style="color: #64748b; font-size: 0.82rem; font-weight: 600;"><i class="fas fa-id-card"></i> ${safeCedula}</span>
                        <span class="condicion-badge ${safeCond.toLowerCase()}">${safeCond}</span>
                        <span style="font-size: 0.78rem; color: #475569; background: #e2e8f0; padding: 2px 7px; border-radius: 4px; font-weight: 600;">
                            <i class="fas ${gen === 'femenino' ? 'fa-venus' : 'fa-mars'}" style="color: ${gen === 'femenino' ? '#db2777' : '#0284c7'};"></i> ${gen === 'femenino' ? 'Femenino' : 'Masculino'}
                        </span>
                    </div>
                </td>
                <td>
                    <span style="color: #0369a1; font-weight: 600;">${safeUsername}</span>
                </td>
                <td>
                    <strong style="color: #6A0D25; display: block;">${safeCargo}</strong>
                    <span style="color: #1e293b; font-size: 0.82rem; font-weight: 600; display: block;">${safeDireccion}</span>
                    <span style="color: #83122F; font-size: 0.82rem; font-weight: 700; display: block;">${safeSalario}</span>
                </td>
                <td>
                    <span class="role-badge ${u.role === 'admin' ? 'admin' : 'trabajador'}">
                        ${u.role === 'admin' ? '<i class="fas fa-shield-alt"></i> Admin' : '<i class="fas fa-user"></i> Trabajador'}
                    </span>
                </td>
                <td style="text-align: right; white-space: nowrap;">
                    <button class="btn-action edit" data-user="${safeUsername}" title="Editar Cargo e Información">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    ${u.username !== 'admin@pget.gob.ve' && u.username !== 'admin' ? `
                    <button class="btn-action delete" data-user="${safeUsername}" data-name="${safeNameRaw}" title="Eliminar Usuario">
                        <i class="fas fa-trash"></i> Eliminar
                    </button>
                    ` : '<span style="color:#94a3b8; font-size:0.75rem; padding: 0 5px;">Protegido</span>'}
                </td>
            </tr>
            `;
        }).join('');

        // Delegación de eventos segura (previene inyección en atributos onclick)
        tbody.onclick = (e) => {
            const editBtn = e.target.closest('.btn-action.edit');
            if (editBtn) {
                const u = editBtn.getAttribute('data-user');
                if (u) window.openEditUserForm(u);
                return;
            }
            const delBtn = e.target.closest('.btn-action.delete');
            if (delBtn) {
                const u = delBtn.getAttribute('data-user');
                const n = delBtn.getAttribute('data-name');
                if (u) window.confirmDeleteUser(u, n);
                return;
            }
        };
    }

    // Activar filtro rápido por condición (Fijos, Contratados, Jubilados, Todos)
    window.setCondicionFilter = (cond) => {
        currentCondicionFilter = cond ? cond.toUpperCase() : '';
        const buttons = document.querySelectorAll('.cond-filter-btn');
        buttons.forEach(btn => {
            const btnCond = btn.getAttribute('data-cond') || '';
            if (btnCond === currentCondicionFilter) {
                btn.classList.add('active');
                if (btnCond === 'FIJO') {
                    btn.style.background = '#6A0D25';
                    btn.style.color = 'white';
                    btn.style.border = '1px solid #D4AF37';
                } else if (btnCond === 'CONTRATADO') {
                    btn.style.background = '#0284c7';
                    btn.style.color = 'white';
                    btn.style.border = '1px solid #38bdf8';
                } else if (btnCond === 'JUBILADO') {
                    btn.style.background = '#7e22ce';
                    btn.style.color = 'white';
                    btn.style.border = '1px solid #c084fc';
                } else {
                    btn.style.background = '#6A0D25';
                    btn.style.color = 'white';
                    btn.style.border = '1px solid #D4AF37';
                }
            } else {
                btn.classList.remove('active');
                btn.style.background = 'transparent';
                btn.style.border = 'none';
                if (btnCond === 'FIJO') btn.style.color = '#6A0D25';
                else if (btnCond === 'CONTRATADO') btn.style.color = '#0284c7';
                else if (btnCond === 'JUBILADO') btn.style.color = '#7e22ce';
                else btn.style.color = '#475569';
            }
        });
        window.filterAdminUsers();
    };

    // Filtrar usuarios en la tabla admin por texto y condición laboral
    window.filterAdminUsers = () => {
        const queryEl = document.getElementById('adminUserFilter');
        const query = queryEl ? queryEl.value.toLowerCase().trim() : '';

        const filtered = allUsersCache.filter(u => {
            const cond = (u.condicion || 'FIJO').toUpperCase();
            if (currentCondicionFilter && cond !== currentCondicionFilter) {
                return false;
            }
            if (!query) return true;

            return (
                (u.nombre && u.nombre.toLowerCase().includes(query)) ||
                (u.nombres && u.nombres.toLowerCase().includes(query)) ||
                (u.apellidos && u.apellidos.toLowerCase().includes(query)) ||
                (u.username && u.username.toLowerCase().includes(query)) ||
                (u.cargo && u.cargo.toLowerCase().includes(query)) ||
                (u.cedula && cleanCedula(u.cedula).toLowerCase().includes(query)) ||
                (u.direccion && u.direccion.toLowerCase().includes(query)) ||
                (u.dependencia && u.dependencia.toLowerCase().includes(query)) ||
                (u.condicion && u.condicion.toLowerCase().includes(query)) ||
                (u.profesion && u.profesion.toLowerCase().includes(query)) ||
                (u.genero && u.genero.toLowerCase().includes(query)) ||
                (u.salario && u.salario.toLowerCase().includes(query))
            );
        });
        renderAdminUsersTable(filtered);
    };

    // Abrir Formulario para Crear Usuario (Pantalla Completa)
    window.openCreateUserForm = () => {
        editingUsername = null;
        const modal = document.getElementById('loginModal');
        const mainContent = document.getElementById('mainModalContent');
        const closeBtn = modal.querySelector('#modalCloseBtn');
        if (closeBtn) closeBtn.style.display = 'none';
        if (mainContent) mainContent.classList.add('portal-fullscreen');

        modal.querySelector('#adminView').style.display = 'none';
        const userForm = modal.querySelector('#userFormView');
        userForm.style.display = 'flex';

        modal.querySelector('#userFormTitle').innerHTML = '<i class="fas fa-user-plus"></i> Registrar Nuevo Usuario / Trabajador';
        modal.querySelector('#formUsername').disabled = false;
        modal.querySelector('#formUsername').value = '';

        // Contraseñas para nuevo usuario (siempre visibles y obligatorias)
        const passBtnWrapper = modal.querySelector('#changePasswordBtnWrapper');
        if (passBtnWrapper) passBtnWrapper.style.display = 'none';
        const passContainer = modal.querySelector('#passwordFieldsContainer');
        if (passContainer) passContainer.style.display = 'grid';
        modal.querySelector('#formPassLabel').textContent = 'Contraseña *';
        modal.querySelector('#formPassConfirmLabel').textContent = 'Confirmar Contraseña *';
        modal.querySelector('#formPassword').value = '';
        modal.querySelector('#formPassword').placeholder = 'Contraseña para el nuevo usuario';
        modal.querySelector('#formPasswordConfirm').value = '';
        modal.querySelector('#formPasswordConfirm').placeholder = 'Repita la contraseña para confirmar';

        modal.querySelector('#formRole').value = 'trabajador';
        modal.querySelector('#formNombres').value = '';
        modal.querySelector('#formApellidos').value = '';
        setFormGender('masculino');
        updateFormProfesionOptions('masculino', 'Abogado');
        modal.querySelector('#formCedula').value = '';
        modal.querySelector('#formCargo').value = '';
        modal.querySelector('#formCondicion').value = 'FIJO';
        modal.querySelector('#formSalario').value = '1.000,00';
        modal.querySelector('#formDependencia').value = 'PROCURADURÍA GENERAL DEL ESTADO TRUJILLO';
        modal.querySelector('#formDireccion').value = 'DIRECCIÓN DE RECURSOS HUMANOS';
        modal.querySelector('#formFechaIngreso').value = '';
        modal.querySelector('#formAnos').value = '0';
        
        const err = modal.querySelector('#formUserError');
        if (err) err.style.display = 'none';
    };

    // Abrir Formulario para Editar Usuario (Pantalla Completa)
    window.openEditUserForm = (username) => {
        const user = allUsersCache.find(u => u.username.toLowerCase() === username.toLowerCase());
        if (!user) return;

        editingUsername = username;
        const modal = document.getElementById('loginModal');
        const mainContent = document.getElementById('mainModalContent');
        const closeBtn = modal.querySelector('#modalCloseBtn');
        if (closeBtn) closeBtn.style.display = 'none';
        if (mainContent) mainContent.classList.add('portal-fullscreen');

        modal.querySelector('#adminView').style.display = 'none';
        const userForm = modal.querySelector('#userFormView');
        userForm.style.display = 'flex';

        const gen = (user.genero || 'masculino').toLowerCase();
        modal.querySelector('#userFormTitle').innerHTML = `<i class="fas fa-user-edit"></i> Modificar Datos: ${user.nombre || username}`;
        modal.querySelector('#formUsername').value = user.username;
        modal.querySelector('#formUsername').disabled = true;

        // Botón Cambiar Contraseña en edición (oculto por defecto hasta pulsar botón)
        const passBtnWrapper = modal.querySelector('#changePasswordBtnWrapper');
        if (passBtnWrapper) passBtnWrapper.style.display = 'inline-flex';
        const passBtn = modal.querySelector('#btnToggleChangePass');
        if (passBtn) {
            passBtn.innerHTML = '<i class="fas fa-key" style="color: #D4AF37;"></i> Cambiar Contraseña';
            passBtn.style.background = '#f1f5f9';
            passBtn.style.borderColor = '#cbd5e1';
        }
        const passContainer = modal.querySelector('#passwordFieldsContainer');
        if (passContainer) passContainer.style.display = 'none';
        modal.querySelector('#formPassLabel').textContent = 'Nueva Contraseña *';
        modal.querySelector('#formPassConfirmLabel').textContent = 'Confirmar Nueva Contraseña *';
        modal.querySelector('#formPassword').value = '';
        modal.querySelector('#formPassword').placeholder = 'Escriba la nueva contraseña';
        modal.querySelector('#formPasswordConfirm').value = '';
        modal.querySelector('#formPasswordConfirm').placeholder = 'Confirme la nueva contraseña';

        modal.querySelector('#formRole').value = user.role || 'trabajador';
        
        // Cargar nombres y apellidos por separado
        const userNombres = user.nombres || '';
        const userApellidos = user.apellidos || '';
        if (!userNombres && !userApellidos && user.nombre) {
            const split = splitNombreApellidos(user.nombre);
            modal.querySelector('#formNombres').value = split.nombres;
            modal.querySelector('#formApellidos').value = split.apellidos;
        } else {
            modal.querySelector('#formNombres').value = userNombres;
            modal.querySelector('#formApellidos').value = userApellidos;
        }

        setFormGender(gen);
        updateFormProfesionOptions(gen, user.profesion || 'Abogado');
        modal.querySelector('#formCedula').value = cleanCedula(user.cedula);
        modal.querySelector('#formCargo').value = user.cargo || '';
        modal.querySelector('#formCondicion').value = (user.condicion || 'FIJO').toUpperCase();
        modal.querySelector('#formSalario').value = cleanSalarioAmount(user.salario);
        modal.querySelector('#formDependencia').value = user.dependencia || 'PROCURADURÍA GENERAL DEL ESTADO TRUJILLO';
        modal.querySelector('#formDireccion').value = user.direccion || 'DIRECCIÓN DE RECURSOS HUMANOS';
        modal.querySelector('#formFechaIngreso').value = toInputDateValue(user.fecha_ingreso);
        
        // Auto-calcular años de servicio al abrir
        const autoYears = calculateYearsOfService(user.fecha_ingreso || '') || user.anos_servicio || '0';
        modal.querySelector('#formAnos').value = autoYears.toString();

        const err = modal.querySelector('#formUserError');
        if (err) err.style.display = 'none';
    };

    window.backToAdminView = () => {
        const modal = document.getElementById('loginModal');
        const mainContent = document.getElementById('mainModalContent');
        const closeBtn = modal.querySelector('#modalCloseBtn');
        if (closeBtn) closeBtn.style.display = 'none';
        if (mainContent) {
            mainContent.classList.add('portal-fullscreen');
            mainContent.classList.add('admin-modal-size');
        }
        modal.querySelector('#userFormView').style.display = 'none';
        modal.querySelector('#adminView').style.display = 'flex';
    };

    // Guardar Usuario (Crear o Editar)
    async function handleSaveUser() {
        const modal = document.getElementById('loginModal');
        const errDiv = modal.querySelector('#formUserError');
        const submitBtn = modal.querySelector('#saveUserSubmitBtn');

        const rawFechaIng = modal.querySelector('#formFechaIngreso').value.trim();
        const fechaIng = toDisplayDateValue(rawFechaIng);
        const autoYears = calculateYearsOfService(rawFechaIng || fechaIng).toString();
        modal.querySelector('#formAnos').value = autoYears;
        const gen = getFormGender();
        const profVal = modal.querySelector('#formProfesion').value;
        const profNormalized = formatProfessionByGender(profVal, gen);

        const username = modal.querySelector('#formUsername').value.trim().toLowerCase();
        const role = modal.querySelector('#formRole').value;
        const nombres = modal.querySelector('#formNombres').value.trim().toUpperCase();
        const apellidos = modal.querySelector('#formApellidos').value.trim().toUpperCase();
        const cedula = cleanCedula(modal.querySelector('#formCedula').value);
        const cargo = modal.querySelector('#formCargo').value.trim().toUpperCase();
        const condicion = modal.querySelector('#formCondicion').value;
        const salario = formatSalarioBs(modal.querySelector('#formSalario').value);
        const dependencia = (modal.querySelector('#formDependencia').value || 'PROCURADURÍA GENERAL DEL ESTADO TRUJILLO').trim().toUpperCase();
        const direccion = modal.querySelector('#formDireccion').value;

        if (cargo) {
            addCargoToCatalog(cargo);
        }

        // Validación: Todos los campos deben ser obligatorios
        if (!username || !nombres || !apellidos || !cedula || !cargo || !condicion || !salario || !fechaIng || !dependencia || !direccion || !profVal) {
            errDiv.style.display = 'block';
            errDiv.textContent = 'Todos los campos son obligatorios. Por favor complete toda la información requerida.';
            return;
        }

        // Validación de cédula: admite solo números
        if (!/^\d+$/.test(cedula)) {
            errDiv.style.display = 'block';
            errDiv.textContent = 'La cédula de identidad debe contener solo números.';
            return;
        }

        const nombreCompleto = `${nombres} ${apellidos}`.trim();

        const userData = {
            username: username,
            role: role,
            nombres: nombres,
            apellidos: apellidos,
            nombre: nombreCompleto,
            genero: gen,
            profesion: profNormalized,
            cedula: cedula,
            cargo: cargo,
            condicion: condicion,
            salario: salario || 'Bs. 1.000,00',
            dependencia: dependencia,
            direccion: direccion,
            fecha_ingreso: fechaIng,
            anos_servicio: autoYears
        };

        // Validación de Contraseña
        const pass = modal.querySelector('#formPassword').value.trim();
        const passConfirm = modal.querySelector('#formPasswordConfirm').value.trim();

        if (!editingUsername) {
            // Al crear nuevo usuario, la contraseña y confirmación son obligatorias
            if (!pass || !passConfirm) {
                errDiv.style.display = 'block';
                errDiv.textContent = 'Todos los campos son obligatorios: ingrese y confirme la contraseña.';
                return;
            }
            if (pass !== passConfirm) {
                errDiv.style.display = 'block';
                errDiv.textContent = 'Las contraseñas no coinciden. Por favor verifique.';
                return;
            }
            userData.password = pass;
        } else {
            // Al editar usuario existente
            const passContainer = modal.querySelector('#passwordFieldsContainer');
            const isChangingPass = passContainer && passContainer.style.display !== 'none';
            if (isChangingPass || pass || passConfirm) {
                if (!pass || !passConfirm) {
                    errDiv.style.display = 'block';
                    errDiv.textContent = 'Para cambiar la contraseña debe ingresar la nueva clave y confirmarla.';
                    return;
                }
                if (pass !== passConfirm) {
                    errDiv.style.display = 'block';
                    errDiv.textContent = 'Las contraseñas no coinciden. Por favor verifique.';
                    return;
                }
                userData.password = pass;
            }
        }

        try {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
            errDiv.style.display = 'none';

            let response;
            if (editingUsername) {
                // Actualizar usuario existente: enviar a /users/update con username en payload
                try {
                    response = await fetch(`${API_URL}/users/update`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ...userData, username: editingUsername })
                    });
                } catch (e) {
                    response = null;
                }

                // Fallback 1: POST /users/{username}/update
                if (!response || !response.ok) {
                    try {
                        const fallbackRes = await fetch(`${API_URL}/users/${encodeURIComponent(editingUsername)}/update`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ ...userData, username: editingUsername })
                        });
                        if (fallbackRes.ok || !response) response = fallbackRes;
                    } catch (e2) {}
                }

                // Fallback 2: PUT /users/{username}
                if (!response || !response.ok) {
                    try {
                        const fallbackRes2 = await fetch(`${API_URL}/users/${encodeURIComponent(editingUsername)}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(userData)
                        });
                        if (fallbackRes2.ok || !response) response = fallbackRes2;
                    } catch (e3) {}
                }
            } else {
                // Crear nuevo usuario
                response = await fetch(`${API_URL}/users`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(userData)
                });
            }

            if (response && response.ok) {
                const successMsg = editingUsername ? '¡Usuario actualizado exitosamente!' : '¡Usuario creado exitosamente!';
                if (editingUsername) {
                    const idx = allUsersCache.findIndex(u => u.username.toLowerCase() === editingUsername.toLowerCase());
                    if (idx !== -1) {
                        allUsersCache[idx] = { ...allUsersCache[idx], ...userData };
                    }
                } else {
                    allUsersCache.push(userData);
                }
                localStorage.setItem('pget_cached_users', JSON.stringify(allUsersCache));
                window.backToAdminView();
                renderAdminUsersTable(allUsersCache);
                await window.showFloatingDialog({
                    title: editingUsername ? 'Usuario Modificado' : 'Usuario Registrado',
                    message: successMsg,
                    type: 'success',
                    confirmText: 'Aceptar'
                });
                loadAdminUsers();
            } else {
                const data = response ? await response.json().catch(() => ({})) : {};
                errDiv.style.display = 'block';
                errDiv.textContent = data.detail || 'Error al guardar los datos del usuario en el servidor.';
                await window.showFloatingDialog({
                    title: 'Error al Guardar',
                    message: data.detail || 'Error al guardar los datos del usuario en el servidor.',
                    type: 'danger',
                    confirmText: 'Aceptar'
                });
            }
        } catch (error) {
            // Guardado en memoria si la API estuviera offline
            if (editingUsername) {
                const idx = allUsersCache.findIndex(u => u.username.toLowerCase() === editingUsername.toLowerCase());
                if (idx !== -1) {
                    allUsersCache[idx] = { ...allUsersCache[idx], ...userData };
                }
            } else {
                allUsersCache.push(userData);
            }
            localStorage.setItem('pget_cached_users', JSON.stringify(allUsersCache));
            window.backToAdminView();
            renderAdminUsersTable(allUsersCache);
            await window.showFloatingDialog({
                title: 'Almacenamiento Local',
                message: '¡Usuario guardado localmente!',
                type: 'warning',
                confirmText: 'Aceptar'
            });
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-save"></i> Guardar Usuario';
        }
    }

    // Eliminar Usuario con Ventana Flotante Centrada
    window.confirmDeleteUser = async (username, nombre) => {
        const confirmed = await window.showFloatingDialog({
            title: 'Confirmar Eliminación de Usuario',
            message: `¿Está seguro de que desea eliminar al usuario "${nombre || username}"?\n\nEsta acción no se puede deshacer y removerá permanentemente al trabajador del sistema.`,
            type: 'delete',
            confirmText: 'Sí, Eliminar Usuario',
            cancelText: 'Cancelar',
            isConfirm: true
        });

        if (!confirmed) {
            return;
        }

        try {
            let res;
            try {
                res = await fetch(`${API_URL}/users/delete`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: username })
                });
            } catch (e) {
                res = null;
            }

            // Fallback 1: POST /users/{username}/delete
            if (!res || !res.ok) {
                try {
                    const fallbackRes = await fetch(`${API_URL}/users/${encodeURIComponent(username)}/delete`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username: username })
                    });
                    if (fallbackRes.ok || !res) res = fallbackRes;
                } catch (e2) {}
            }

            // Fallback 2: DELETE /users/{username}
            if (!res || !res.ok) {
                try {
                    const fallbackRes2 = await fetch(`${API_URL}/users/${encodeURIComponent(username)}`, {
                        method: 'DELETE'
                    });
                    if (fallbackRes2.ok || !res) res = fallbackRes2;
                } catch (e3) {}
            }

            if (res && res.ok) {
                allUsersCache = allUsersCache.filter(u => u.username.toLowerCase() !== username.toLowerCase());
                localStorage.setItem('pget_cached_users', JSON.stringify(allUsersCache));
                renderAdminUsersTable(allUsersCache);
                await window.showFloatingDialog({
                    title: 'Usuario Eliminado',
                    message: `El usuario ${username} ha sido eliminado exitosamente del sistema.`,
                    type: 'success',
                    confirmText: 'Aceptar'
                });
                loadAdminUsers();
            } else {
                const data = res ? await res.json().catch(() => ({})) : {};
                await window.showFloatingDialog({
                    title: 'Error al Eliminar',
                    message: data.detail || 'No se pudo eliminar el usuario en el servidor.',
                    type: 'danger',
                    confirmText: 'Aceptar'
                });
            }
        } catch (error) {
            // Eliminar de cache local
            allUsersCache = allUsersCache.filter(u => u.username.toLowerCase() !== username.toLowerCase());
            localStorage.setItem('pget_cached_users', JSON.stringify(allUsersCache));
            renderAdminUsersTable(allUsersCache);
            await window.showFloatingDialog({
                title: 'Eliminación Local',
                message: `El usuario ${username} ha sido eliminado localmente.`,
                type: 'warning',
                confirmText: 'Aceptar'
            });
        }
    };

    // Funciones auxiliares para formato en cliente (Cédula, Salario en Letras, Fecha en Letras)
    function formatCedulaConPuntos(val) {
        if (!val) return '';
        const clean = String(val).replace(/[^0-9]/g, '');
        if (!clean) return String(val);
        return Number(clean).toLocaleString('es-VE').replace(/,/g, '.');
    }

    function _seccionCentenasJS(n) {
        if (n === 0) return '';
        if (n === 100) return 'CIEN';
        const centenas = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];
        const decenas = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
        const diezY = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
        const veinti = ['VEINTE', 'VEINTIÚN', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE'];
        const unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];

        const c = Math.floor(n / 100);
        const resto = n % 100;
        const txtC = centenas[c] || '';
        if (resto === 0) return txtC;
        let txtD = '';
        if (resto < 10) txtD = unidades[resto];
        else if (resto < 20) txtD = diezY[resto - 10];
        else if (resto < 30) txtD = veinti[resto - 20];
        else {
            const d = Math.floor(resto / 10);
            const u = resto % 10;
            txtD = decenas[d] + (u > 0 ? ` Y ${unidades[u]}` : '');
        }
        return `${txtC} ${txtD}`.trim();
    }

    function numeroALetrasEnteroJS(n) {
        if (n === 0) return 'CERO';
        const millones = Math.floor(n / 1000000);
        const restoM = n % 1000000;
        const miles = Math.floor(restoM / 1000);
        const unidades = restoM % 1000;
        const partes = [];
        if (millones === 1) partes.push('UN MILLÓN');
        else if (millones > 1) partes.push(`${_seccionCentenasJS(millones)} MILLONES`);
        if (miles === 1) partes.push('UN MIL');
        else if (miles > 1) partes.push(`${_seccionCentenasJS(miles)} MIL`);
        if (unidades > 0) partes.push(_seccionCentenasJS(unidades));
        return partes.join(' ').trim();
    }

    function formatearSalarioLetrasJS(salarioRaw) {
        let clean = String(salarioRaw || '1000').replace(/Bs\.?/g, '').trim();
        clean = clean.replace(/\./g, '').replace(/,/g, '.');
        let val = parseFloat(clean);
        if (isNaN(val)) val = 1000.0;
        const entero = Math.floor(val);
        const centimos = Math.round((val - entero) * 100);
        const letrasEntero = numeroALetrasEnteroJS(entero);
        const letrasCentimos = numeroALetrasEnteroJS(centimos);
        const textoCompleto = centimos === 0 ? `${letrasEntero} CON CERO CÉNTIMOS` : `${letrasEntero} CON ${letrasCentimos} CÉNTIMOS`;
        const formatoNum = `Bs. ${entero.toLocaleString('es-VE').replace(/,/g, '.')},${String(centimos).padStart(2, '0')}`;
        return { textoCompleto, formatoNum };
    }

    function fechaALetrasExpedicionJS(dt) {
        const diasLetras = {
            1: 'un (1)', 2: 'dos (2)', 3: 'tres (3)', 4: 'cuatro (4)', 5: 'cinco (5)',
            6: 'seis (6)', 7: 'siete (7)', 8: 'ocho (8)', 9: 'nueve (9)', 10: 'diez (10)',
            11: 'once (11)', 12: 'doce (12)', 13: 'trece (13)', 14: 'catorce (14)', 15: 'quince (15)',
            16: 'dieciséis (16)', 17: 'diecisiete (17)', 18: 'dieciocho (18)', 19: 'diecinueve (19)',
            20: 'veinte (20)', 21: 'veintiún (21)', 22: 'veintidós (22)', 23: 'veintitrés (23)',
            24: 'veinticuatro (24)', 25: 'veinticinco (25)', 26: 'veintiséis (26)', 27: 'veintisiete (27)',
            28: 'veintiocho (28)', 29: 'veintinueve (29)', 30: 'treinta (30)', 31: 'treinta y un (31)'
        };
        const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
        const anosLetras = {
            2024: 'dos mil veinticuatro (2024)',
            2025: 'dos mil veinticinco (2025)',
            2026: 'dos mil veintiséis (2026)',
            2027: 'dos mil veintisiete (2027)',
            2028: 'dos mil veintiocho (2028)'
        };
        const dia = dt.getDate();
        const diaTxt = diasLetras[dia] || `${dia} (${dia})`;
        const mesTxt = meses[dt.getMonth()];
        const ano = dt.getFullYear();
        const anoTxt = anosLetras[ano] || `dos mil veintiséis (${ano})`;
        return `los ${diaTxt} días del mes de ${mesTxt} del año ${anoTxt}`;
    }

    // Helper para construir la constancia en el cliente (idéntico a las 3 imágenes reales)
    function buildClientCertificate(user, conSalario = true) {
        const cond = (user.condicion || 'FIJO').toUpperCase();
        const genero = (user.genero || 'masculino').toLowerCase();
        const esFemenino = genero === 'femenino';
        const prof = formatProfessionByGender(user.profesion || '', genero);
        const nombreConTitulo = formatFullNameWithTitle(user.nombre, prof, genero);
        const cedulaOficial = formatCedulaOficial(user.cedula);
        const cargo = user.cargo || 'FUNCIONARIO';
        const dir = user.direccion || 'DIRECCIÓN GENERAL';
        const fIngreso = user.fecha_ingreso || 'N/D';
        const anos = calculateYearsOfService(fIngreso) || user.anos_servicio || '0';
        const incluirSalario = conSalario === true || conSalario === 'true' || conSalario === 1;
        const { textoCompleto: salarioLetras, formatoNum: salarioBs } = formatearSalarioLetrasJS(user.salario || 'Bs. 1.000,00');

        const now = new Date();
        const fechaExpedicion = fechaALetrasExpedicionJS(now);
        const correlativo = `PGET  ${now.getFullYear()} Nº S/N`;

        const tratamiento = esFemenino ? 'la ciudadana:' : 'el ciudadano:';
        const nacionalidad = esFemenino ? 'venezolana' : 'venezolano';
        const adscritoTxt = esFemenino ? 'adscrita' : 'adscrito';
        const jubiladoTxt = esFemenino ? 'jubilada' : 'jubilado';

        let cuerpo = '';
        if (cond === 'JUBILADO') {
            const clausulaSal = incluirSalario ? `, devengando una asignación mensual por jubilación de Bolívares **${salarioLetras} (${salarioBs})**.` : '.';
            cuerpo = `Quien suscribe, **Abog. ELVIMAR CAROLINA LÓPEZ ARAUJO**, venezolana, mayor de edad, titular de la cédula de identidad Nº. **V- 14.780.947**, en mi condición de **DIRECTORA (E) DE RECURSOS HUMANOS DE LA PROCURADURÍA GENERAL DEL ESTADO TRUJILLO**, por medio de la presente hago constar que ${tratamiento} **${nombreConTitulo}**, ${nacionalidad}, mayor de edad, titular de la Cédula de Identidad Nº. **${cedulaOficial}**, prestó sus servicios en la **PROCURADURÍA GENERAL DEL ESTADO TRUJILLO** actualmente es ${jubiladoTxt} de este organismo${clausulaSal}\n\nConstancia que se expide a instancia de parte interesada en la ciudad de Trujillo, a ${fechaExpedicion}.`;
        } else if (cond === 'CONTRATADO') {
            const clausulaSal = incluirSalario ? `, con una Asignación Mensual de Bolívares **${salarioLetras} (${salarioBs})**.` : '.';
            cuerpo = `Quien suscribe, **Abog. ELVIMAR CAROLINA LÓPEZ ARAUJO**, venezolana, mayor de edad, titular de la cédula de identidad Nº. **V- 14.780.947**, en mi condición de **DIRECTORA (E) DE RECURSOS HUMANOS DE LA PROCURADURÍA GENERAL DEL ESTADO TRUJILLO**, por medio de la presente hago constar que ${tratamiento} **${nombreConTitulo}**, ${nacionalidad}, mayor de edad, titular de la cédula de Identidad Nº. **${cedulaOficial}**, presta sus servicios en la **PROCURADURÍA GENERAL DEL ESTADO TRUJILLO** desde el **${fIngreso}**, desempeñándose en la actualidad como **${cargo} (CONTRATADO)**, ${adscritoTxt} a la ${dir} de la Procuraduría General del Estado Trujillo${clausulaSal}\n\nConstancia que se expide a instancia de parte interesada en la ciudad de Trujillo, a ${fechaExpedicion}.`;
        } else { // FIJO
            const clausulaSal = incluirSalario ? `, con una Asignación Mensual de Bolívares **${salarioLetras} (${salarioBs})**.` : '.';
            cuerpo = `Quien suscribe, **Abog. ELVIMAR CAROLINA LÓPEZ ARAUJO**, venezolana, mayor de edad, titular de la cédula de identidad Nº. **V- 14.780.947**, en mi condición de **DIRECTORA (E) DE RECURSOS HUMANOS DE LA PROCURADURÍA GENERAL DEL ESTADO TRUJILLO**, por medio de la presente hago constar que ${tratamiento} **${nombreConTitulo}**, ${nacionalidad}, mayor de edad, titular de la Cédula de Identidad Nº. **${cedulaOficial}** presta sus servicios en la **PROCURADURÍA GENERAL DEL ESTADO TRUJILLO**, desde el **${fIngreso}** desempeñándose como **${cargo}**, ${adscritoTxt} a la ${dir} P.G.E.T.${clausulaSal}\n\nConstancia que se expide a instancia de parte interesada en la ciudad de Trujillo, a ${fechaExpedicion}.`;
        }

        const inicialesSuscribe = 'EL';
        const inicialesTrabajador = getWorkerInitials(user);
        const iniciales = `${inicialesSuscribe}/${inicialesTrabajador}`;

        return {
            titulo: 'C O N S T A N C I A .',
            correlativo,
            cuerpo,
            beneficiario: nombreConTitulo,
            cedula: cedulaOficial,
            cargo,
            condicion: cond,
            direccion: dir,
            dependencia: user.dependencia || 'PROCURADURÍA GENERAL DEL ESTADO TRUJILLO',
            con_salario: incluirSalario,
            salario: incluirSalario ? salarioBs : null,
            salario_en_letras: incluirSalario ? salarioLetras : null,
            fecha_emision: fechaExpedicion,
            rif: 'G-20000417-7',
            firmante_nombre: 'ABG. ELVIMAR CAROLINA LÓPEZ ARAUJO.',
            firmante_cargo: 'DIRECTORA (E) DE RECURSOS HUMANOS DE LA\nPROCURADURÍA GENERAL DEL ESTADO TRUJILLO.',
            iniciales: iniciales
        };
    }

    // Modal oficial para visualización e impresión de la constancia (100% fiel a las imágenes oficiales)
    window.showConstanciaDocument = (cert) => {
        let modal = document.getElementById('constanciaPrintModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'constanciaPrintModal';
            modal.className = 'constancia-modal-backdrop';
            document.body.appendChild(modal);
        }
        
        const paragraphs = (cert.cuerpo || '').split('\n\n').filter(p => p.trim());
        const cuerpoHTML = paragraphs.map(p => `
            <p style="margin-bottom: 26px; text-align: justify; text-justify: inter-word; font-family: Arial, sans-serif; font-size: 1.02rem; line-height: 1.85; color: #000; text-indent: 40px;">
                ${p.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}
            </p>
        `).join('');

        modal.innerHTML = `
            <div class="constancia-paper" id="constanciaPaperSheet">
                <!-- Barra superior de control (no imprimible) -->
                <div class="no-print" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px; margin-bottom: 30px; font-family: sans-serif;">
                    <span style="font-size: 0.92rem; color: #1e293b; font-weight: 700;">
                        <i class="fas fa-file-contract" style="color: #6A0D25;"></i> Constancia Oficial Generada Exitosamente
                    </span>
                    <div style="display: flex; gap: 10px;">
                        <button onclick="window.print()" style="background: linear-gradient(135deg, #6A0D25, #83122F); border: 1.5px solid #D4AF37; color: white; padding: 10px 20px; border-radius: 6px; font-weight: 700; font-size: 0.92rem; cursor: pointer; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 10px rgba(106,13,37,0.25);">
                            <i class="fas fa-print"></i> Imprimir / Guardar como PDF
                        </button>
                        <button onclick="document.getElementById('constanciaPrintModal').style.display='none'" style="background: #e2e8f0; color: #475569; border: none; padding: 10px 18px; border-radius: 6px; font-weight: 700; font-size: 0.92rem; cursor: pointer;">
                            <i class="fas fa-times"></i> Cerrar
                        </button>
                    </div>
                </div>

                <!-- 1. Encabezado Oficial: Escudo Centrado y RIF debajo -->
                <div style="text-align: center; margin-bottom: 25px;">
                    <img src="assets/logo.png" alt="Escudo Oficial PGET" style="height: 95px; margin: 0 auto; display: block;" onerror="this.src='https://via.placeholder.com/95?text=PGET'">
                    <div style="font-weight: 800; font-size: 0.98rem; color: #000; margin-top: 6px; letter-spacing: 0.5px;">G-20000417-7</div>
                </div>

                <!-- 2. Correlativo Oficial al margen izquierdo -->
                <div style="text-align: left; font-weight: 800; font-size: 0.95rem; color: #000; margin-bottom: 25px; font-family: Arial, sans-serif;">
                    ${cert.correlativo || ('PGET  ' + new Date().getFullYear() + ' Nº S/N')}
                </div>

                <!-- 3. Título Centrado Oficial con Espaciado -->
                <div style="text-align: center; margin-bottom: 35px;">
                    <h2 style="font-size: 1.15rem; font-weight: 900; color: #000; margin: 0; letter-spacing: 6px; font-family: Arial, sans-serif;">
                        C O N S T A N C I A .
                    </h2>
                </div>

                <!-- 4. Cuerpo de la Constancia Justificado con Indentación -->
                <div style="margin-bottom: 55px;">
                    ${cuerpoHTML}
                </div>

                <!-- 5. Bloque de Firma Centrado Oficial -->
                <div style="text-align: center; margin-top: 60px; margin-bottom: 50px; font-family: Arial, sans-serif; font-size: 0.95rem; line-height: 1.35; color: #000;">
                    <strong>ABG. ELVIMAR CAROLINA LÓPEZ ARAUJO.</strong><br>
                    <strong>DIRECTORA (E) DE RECURSOS HUMANOS DE LA</strong><br>
                    <strong>PROCURADURÍA GENERAL DEL ESTADO TRUJILLO.</strong>
                </div>

                <!-- 6. Iniciales de Transcripción al margen izquierdo (EL/XX: Quien suscribe / Trabajador) -->
                <div style="font-size: 0.82rem; font-weight: 800; color: #000; margin-bottom: 10px; font-family: Arial, sans-serif;">
                    ${cert.iniciales || 'EL/XX'}
                </div>

                <!-- 7. Línea divisoria horizontal -->
                <hr style="border: none; border-top: 1px solid #000; margin: 0 0 8px 0;">

                <!-- 8. Pie de Página Oficial PGET con Ley Contra la Corrupción -->
                <div style="font-family: Arial, sans-serif; font-size: 0.64rem; line-height: 1.35; color: #334155;">
                    <div style="text-align: center; margin-bottom: 4px;">
                        Av. Independencia frente a la Plaza Bolívar, Palacio de Gobierno, 2do piso, Trujillo, edo. Trujillo<br>
                        TELEFAX. (0272) 2365126, CORREO ELECTRÓNICO: procuraduríageneraltrujillo@gmail.com
                    </div>
                    <div style="text-align: justify; margin-top: 4px;">
                        <strong>Documentación Oficial de Uso Restringido:</strong><br>
                        <strong>Ley Contra la Corrupción: Art. 66:</strong> El funcionario público que utilice, para sí o para otro, informaciones o datos de carácter reservado de los cuales tenga conocimiento en razón de su cargo, será penado con prisión de uno (1) a seis (6) años y multa de hasta el cincuenta por ciento (50%) del beneficio perseguido u obtenido, siempre que el hecho no constituya otro delito. Si del hecho resultare algún perjuicio a la Administración Pública, la pena será aumentada de un tercio (1/3) a la mitad (1/2).
                    </div>
                </div>
            </div>
        `;
        modal.style.display = 'flex';
    };

    // Solicitar Constancia (Solo Trabajador)
    async function handleRequestCert() {
        const modal = document.getElementById('loginModal');
        const certBtn = modal.querySelector('#requestCertBtn');
        const certMsg = modal.querySelector('#certMessage');
        const conSalarioSelect = modal.querySelector('#conSalarioSelect');
        const conSalarioVal = conSalarioSelect ? conSalarioSelect.value : 'true';

        if (currentUser && currentUser.role === 'admin') {
            certMsg.style.color = '#dc2626';
            certMsg.innerHTML = '<i class="fas fa-ban"></i> Los administradores gestionan el personal y no emiten constancias de trabajo personales.';
            return;
        }

        try {
            certBtn.disabled = true;
            certBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando documento oficial...';

            let certData = null;
            try {
                const response = await fetch(`${API_URL}/constancia?token=${currentToken}&username=${currentUser ? currentUser.username : ''}&con_salario=${encodeURIComponent(conSalarioVal)}`);
                if (response.ok) {
                    certData = await response.json();
                }
            } catch (apiErr) {
                console.warn('API constancia offline, utilizando generador local:', apiErr);
            }

            if (!certData) {
                // Fallback cliente garantizado
                certData = buildClientCertificate(currentUser, conSalarioVal);
            }

            certMsg.style.color = '#6A0D25';
            certMsg.innerHTML = `<i class="fas fa-check-circle" style="color: #D4AF37;"></i> ¡Constancia generada exitosamente! Se ha abierto el documento oficial.`;
            
            // Abrir documento para previsualización e impresión
            window.showConstanciaDocument(certData);

        } catch (error) {
            certMsg.style.color = '#dc2626';
            certMsg.innerHTML = '<i class="fas fa-times-circle"></i> Ocurrió un error al generar la constancia.';
        } finally {
            certBtn.disabled = false;
            certBtn.innerHTML = '<i class="fas fa-file-alt"></i> Generar y Ver Constancia Oficial';
        }
    }

    // Salir / Logout
    window.pgetLogout = () => {
        currentToken = null;
        currentUser = null;
        const modal = document.getElementById('loginModal');
        const mainContent = document.getElementById('mainModalContent');
        if (mainContent) {
            mainContent.classList.remove('portal-fullscreen');
            mainContent.classList.remove('admin-modal-size');
        }

        const closeBtn = modal.querySelector('#modalCloseBtn');
        if (closeBtn) closeBtn.style.display = 'block';
        
        modal.querySelector('#loginView').style.display = 'block';
        modal.querySelector('#workerView').style.display = 'none';
        modal.querySelector('#adminView').style.display = 'none';
        modal.querySelector('#userFormView').style.display = 'none';
        
        const loginBtn = document.getElementById('loginBtn');
        if (loginBtn) {
            loginBtn.innerHTML = '<i class="fas fa-user"></i> Iniciar Sesión';
        }

        const loginForm = modal.querySelector('#loginForm');
        if (loginForm) loginForm.reset();
    };

    // Attach to existing modal if already in HTML
    const initialModal = document.getElementById('loginModal');
    if (initialModal) {
        attachModalEvents(initialModal);
    }

    // Abrir Modal de Inicio de Sesión de forma limpia y confiable
    window.openLoginModal = () => {
        const modal = ensureLoginModal();
        if (!modal) return;
        const mainContent = document.getElementById('mainModalContent');
        const closeBtn = modal.querySelector('#modalCloseBtn');

        if (!currentUser) {
            if (closeBtn) closeBtn.style.display = 'block';
            if (mainContent) {
                mainContent.classList.remove('portal-fullscreen');
                mainContent.classList.remove('admin-modal-size');
            }
            const lv = modal.querySelector('#loginView');
            const wv = modal.querySelector('#workerView');
            const av = modal.querySelector('#adminView');
            const uf = modal.querySelector('#userFormView');
            if (lv) lv.style.display = 'block';
            if (wv) wv.style.display = 'none';
            if (av) av.style.display = 'none';
            if (uf) uf.style.display = 'none';
            const errDiv = modal.querySelector('#loginError');
            if (errDiv) {
                errDiv.style.display = 'none';
                errDiv.textContent = '';
            }
        } else {
            if (closeBtn) closeBtn.style.display = 'none';
            handlePostLogin(currentUser);
        }
        modal.classList.add('show');
    };

    // Attach to loginBtn in navbar
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
        loginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.openLoginModal();
        });
    }

    // Navbar scroll effect
    window.addEventListener('scroll', () => {
        const navbar = document.querySelector('.navbar');
        if (navbar) {
            if (window.scrollY > 50) {
                navbar.style.padding = '8px 0';
                navbar.style.background = 'rgba(32, 34, 38, 0.96)';
            } else {
                navbar.style.padding = '12px 0';
                navbar.style.background = 'rgba(38, 41, 46, 0.90)';
            }
        }
    });

    // Sistema Automático de Menú Móvil Responsive para todas las páginas
    function setupResponsiveMobileNav() {
        const navContainer = document.querySelector('.nav-container');
        if (!navContainer) return;

        // 1. Crear e insertar botón Hamburguesa si no existe
        if (!document.getElementById('mobileMenuBtn')) {
            const btn = document.createElement('button');
            btn.id = 'mobileMenuBtn';
            btn.className = 'mobile-menu-btn';
            btn.setAttribute('aria-label', 'Abrir Menú de Navegación');
            btn.innerHTML = '<i class="fas fa-bars"></i>';
            navContainer.appendChild(btn);
        }

        // 2. Crear Drawer y Overlay si no existen
        if (!document.getElementById('mobileNavDrawer')) {
            const overlay = document.createElement('div');
            overlay.id = 'mobileNavOverlay';
            overlay.className = 'mobile-nav-overlay';
            document.body.appendChild(overlay);

            const drawer = document.createElement('div');
            drawer.id = 'mobileNavDrawer';
            drawer.className = 'mobile-nav-drawer';

            const currentPath = window.location.pathname.split('/').pop() || 'index.html';

            drawer.innerHTML = `
                <div class="mobile-drawer-header">
                    <div class="mobile-drawer-logo">
                        <img src="assets/logo.png" alt="Logo PGET" onerror="this.src='https://via.placeholder.com/40?text=PGET'">
                        <div class="mobile-drawer-logo-text">
                            <h3>PROCURADURÍA GENERAL</h3>
                            <span>ESTADO TRUJILLO</span>
                        </div>
                    </div>
                    <button id="mobileDrawerCloseBtn" class="mobile-drawer-close" aria-label="Cerrar Menú">
                        <i class="fas fa-times"></i>
                    </button>
                </div>

                <div class="mobile-drawer-links">
                    <a href="index.html" class="mobile-drawer-link ${currentPath === 'index.html' || currentPath === '' ? 'active' : ''}">
                        <span><i class="fas fa-home" style="margin-right: 8px; color: #D4AF37;"></i> Inicio</span>
                        <i class="fas fa-chevron-right"></i>
                    </a>
                    
                    <a href="quienes-somos.html" class="mobile-drawer-link ${currentPath === 'quienes-somos.html' ? 'active' : ''}">
                        <span><i class="fas fa-landmark" style="margin-right: 8px; color: #D4AF37;"></i> ¿Quiénes Somos?</span>
                        <i class="fas fa-chevron-right"></i>
                    </a>

                    <!-- Submenú Filosofía -->
                    <div class="mobile-submenu-group">
                        <div class="mobile-submenu-header" id="subFilosofiaHeader">
                            <span><i class="fas fa-book-open" style="margin-right: 8px; color: #D4AF37;"></i> Filosofía Institucional</span>
                            <i class="fas fa-chevron-down"></i>
                        </div>
                        <div class="mobile-submenu-items" id="subFilosofiaItems">
                            <a href="mision-vision.html" class="mobile-submenu-item ${currentPath === 'mision-vision.html' ? 'active' : ''}">
                                &bull; Misión y Visión
                            </a>
                            <a href="valores.html" class="mobile-submenu-item ${currentPath === 'valores.html' ? 'active' : ''}">
                                &bull; Valores y Principios
                            </a>
                        </div>
                    </div>

                    <!-- Submenú Organización -->
                    <div class="mobile-submenu-group">
                        <div class="mobile-submenu-header" id="subOrgHeader">
                            <span><i class="fas fa-sitemap" style="margin-right: 8px; color: #D4AF37;"></i> Organización</span>
                            <i class="fas fa-chevron-down"></i>
                        </div>
                        <div class="mobile-submenu-items" id="subOrgItems">
                            <a href="organigrama.html" class="mobile-submenu-item ${currentPath === 'organigrama.html' ? 'active' : ''}">
                                &bull; Organigrama Oficial
                            </a>
                            <a href="direcciones.html" class="mobile-submenu-item ${currentPath === 'direcciones.html' ? 'active' : ''}">
                                &bull; Direcciones y Unidades
                            </a>
                        </div>
                    </div>

                    <a href="bases-juridicas.html" class="mobile-drawer-link ${currentPath === 'bases-juridicas.html' ? 'active' : ''}">
                        <span><i class="fas fa-balance-scale" style="margin-right: 8px; color: #D4AF37;"></i> Bases Jurídicas</span>
                        <i class="fas fa-chevron-right"></i>
                    </a>

                    <a href="contacto.html" class="mobile-drawer-link ${currentPath === 'contacto.html' ? 'active' : ''}">
                        <span><i class="fas fa-map-marker-alt" style="margin-right: 8px; color: #D4AF37;"></i> Contacto y Ubicación</span>
                        <i class="fas fa-chevron-right"></i>
                    </a>
                </div>

                <div class="mobile-drawer-footer">
                    <button id="mobileDrawerLoginBtn" class="mobile-drawer-login-btn">
                        <i class="fas fa-user-shield"></i> Acceso al Sistema PGET
                    </button>
                </div>
            `;
            document.body.appendChild(drawer);

            // Toggle eventos
            const menuBtn = document.getElementById('mobileMenuBtn');
            const closeBtn = document.getElementById('mobileDrawerCloseBtn');
            const drawerEl = document.getElementById('mobileNavDrawer');
            const overlayEl = document.getElementById('mobileNavOverlay');

            const openDrawer = () => {
                drawerEl.classList.add('active');
                overlayEl.classList.add('active');
                document.body.style.overflow = 'hidden';
            };

            const closeDrawer = () => {
                drawerEl.classList.remove('active');
                overlayEl.classList.remove('active');
                document.body.style.overflow = '';
            };

            if (menuBtn) menuBtn.addEventListener('click', openDrawer);
            if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
            if (overlayEl) overlayEl.addEventListener('click', closeDrawer);

            // Submenú Toggles
            const toggleSubmenu = (headerId, itemsId) => {
                const header = document.getElementById(headerId);
                const items = document.getElementById(itemsId);
                if (header && items) {
                    header.addEventListener('click', () => {
                        header.classList.toggle('active');
                        items.classList.toggle('active');
                    });
                }
            };
            toggleSubmenu('subFilosofiaHeader', 'subFilosofiaItems');
            toggleSubmenu('subOrgHeader', 'subOrgItems');

            // Botón de login en el drawer
            const drawerLoginBtn = document.getElementById('mobileDrawerLoginBtn');
            if (drawerLoginBtn) {
                drawerLoginBtn.addEventListener('click', () => {
                    closeDrawer();
                    window.openLoginModal();
                });
            }
        }
    }

    setupResponsiveMobileNav();
});
