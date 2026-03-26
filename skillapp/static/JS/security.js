// ═══════════════════════════════════════════════════
//  SECURITY TAB — OTP FLOW FOR PASSWORD & PASSKEY
// ═══════════════════════════════════════════════════

var securityOtpVerified = { password: false, passkey: false };

// ── Send OTP ──────────────────────────────────────────────────
async function sendSecurityOtp(type) {
    const btnId = type === 'password' ? 'sendPwOtpBtn' : 'sendPkOtpBtn';
    const msgId = type === 'password' ? 'pw-otp-msg' : 'pk-otp-msg';
    const step1 = type === 'password' ? 'pw-step1' : 'pk-step1';
    const step2 = type === 'password' ? 'pw-step2' : 'pk-step2';

    const btn = document.getElementById(btnId);
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

    showSecMsg(msgId, 'Sending OTP...', 'loading');

    try {
        const csrf = getSecCsrf();
        const resp = await fetch('/send-otp/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrf,
            },
            body: JSON.stringify({ method: 'email' }),   // No need to send email anymore
        });

        const data = await resp.json();

        if (data.success) {
            showSecMsg(msgId, 'OTP sent successfully!', 'success');
            setTimeout(() => {
                document.getElementById(step1).classList.add('hidden');
                document.getElementById(step2).classList.remove('hidden');
                const first = type === 'password' ? 'pw_o1' : 'pk_o1';
                document.getElementById(first).focus();
            }, 700);
        } else {
            showSecMsg(msgId, data.error || 'Failed to send OTP', 'error');
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send OTP to Email';
        }
    } catch (err) {
        showSecMsg(msgId, 'Network error. Please try again.', 'error');
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send OTP to Email';
    }
}

// ── Verify OTP ────────────────────────────────────────────────
async function verifySecurityOtp(type) {
    const prefix = type === 'password' ? 'pw_o' : 'pk_o';
    const msgId  = type === 'password' ? 'pw-verify-msg' : 'pk-verify-msg';
    const step2  = type === 'password' ? 'pw-step2' : 'pk-step2';
    const step3  = type === 'password' ? 'pw-step3' : 'pk-step3';

    let otp = '';
    for (let i = 1; i <= 6; i++) {
        const cell = document.getElementById(prefix + i);
        if (cell) otp += cell.value;
    }

    if (otp.length !== 6) {
        showSecMsg(msgId, 'Please enter all 6 digits.', 'error');
        shakeOtpRow(type);
        return;
    }

    showSecMsg(msgId, 'Verifying OTP...', 'loading');

    try {
        const csrf = getSecCsrf();
        const resp = await fetch('/verify-otp-only/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrf,
            },
            body: JSON.stringify({ otp: otp }),
        });

        const data = await resp.json();

        if (data.success) {
            securityOtpVerified[type] = true;
            showSecMsg(msgId, 'OTP Verified Successfully!', 'success');

            setTimeout(() => {
                document.getElementById(step2).classList.add('hidden');
                document.getElementById(step3).classList.remove('hidden');
                if (type === 'password') {
                    document.getElementById('newPassword').focus();
                } else {
                    document.getElementById('pk_n1').focus();
                }
            }, 600);
        } else {
            showSecMsg(msgId, data.error || 'Invalid OTP.', 'error');
            shakeOtpRow(type);
            clearOtpCells(type);
        }
    } catch (err) {
        showSecMsg(msgId, 'Network error.', 'error');
    }
}

// ── Resend OTP ────────────────────────────────────────────────
async function resendSecurityOtp(type) {
    var msgId = type === 'password' ? 'pw-verify-msg' : 'pk-verify-msg';
    clearOtpCells(type);
    showSecMsg(msgId, 'Resending OTP...', 'loading');

    try {
        var csrf = getSecCsrf();
        var resp = await fetch('/send-otp/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrf,
            },
            body: JSON.stringify({ method: 'email', value: '{{ user.email }}' }),
        });

        var data = await resp.json();
        if (data.success) {
            showSecMsg(msgId, 'New OTP sent!', 'success');
            var prefix = type === 'password' ? 'pw_o1' : 'pk_o1';
            var el = document.getElementById(prefix);
            if (el) el.focus();
        } else {
            showSecMsg(msgId, data.error || 'Failed to resend.', 'error');
        }
    } catch (err) {
        showSecMsg(msgId, 'Network error.', 'error');
    }
}

// ── Save new passkey ──────────────────────────────────────────
async function saveNewPasskey() {
    const newCode = [1,2,3,4].map(i => {
        const el = document.getElementById('pk_n' + i);
        return el ? el.value : '';
    }).join('');

    const confirmCode = [1,2,3,4].map(i => {
        const el = document.getElementById('pk_c' + i);
        return el ? el.value : '';
    }).join('');

    const msgId = 'pk-set-msg';

    if (newCode.length !== 4 || confirmCode.length !== 4) {
        showSecMsg(msgId, 'Please enter all 4 digits.', 'error');
        return;
    }

    if (newCode !== confirmCode) {
        showSecMsg(msgId, 'Passkeys do not match!', 'error');
        return;
    }

    showSecMsg(msgId, 'Saving new passkey...', 'loading');

    try {
        const csrf = getSecCsrf();
        const resp = await fetch('/profile/', {   // Submit to same profile view
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-CSRFToken': csrf,
            },
            body: new URLSearchParams({
                'action': 'change_passkey',
                'passkey': newCode
            })
        });

        // Since it's a full page POST, we can just reload after success
        if (resp.ok) {
            showSecMsg(msgId, 'Passkey updated successfully!', 'success');
            setTimeout(() => {
                window.location.reload();   // Refresh to show updated badge
            }, 1500);
        } else {
            showSecMsg(msgId, 'Failed to save passkey.', 'error');
        }
    } catch (err) {
        showSecMsg(msgId, 'Network error.', 'error');
    }
}

// ── Reset step back to step 1 ─────────────────────────────────
function resetStep(type) {
    if (type === 'password') {
        document.getElementById('pw-step1').classList.remove('hidden');
        document.getElementById('pw-step2').classList.add('hidden');
        document.getElementById('pw-step3').classList.add('hidden');
        clearOtpCells('password');
        showSecMsg('pw-otp-msg', '', '');
        showSecMsg('pw-verify-msg', '', '');
        var btn = document.getElementById('sendPwOtpBtn');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send OTP to Email';
        }
    } else {
        document.getElementById('pk-step1').classList.remove('hidden');
        document.getElementById('pk-step2').classList.add('hidden');
        document.getElementById('pk-step3').classList.add('hidden');
        clearOtpCells('passkey');
        clearPasskeyCells();
        showSecMsg('pk-otp-msg', '', '');
        showSecMsg('pk-verify-msg', '', '');
        showSecMsg('pk-set-msg', '', '');
        var btn = document.getElementById('sendPkOtpBtn');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send OTP to Email';
        }
    }
    securityOtpVerified[type] = false;
}

// ── OTP cell input handlers ───────────────────────────────────
function secOtpIn(el, prevId, nextId) {
    el.value = el.value.replace(/[^0-9]/g, '');
    el.classList.toggle('filled', el.value !== '');
    if (el.value && nextId) {
        var next = document.getElementById(nextId);
        if (next) next.focus();
    }
}

function secOtpBack(e, el, prevId, nextId) {
    if (e.key === 'Backspace' && !el.value && prevId) {
        var prev = document.getElementById(prevId);
        if (prev) prev.focus();
    }
    el.classList.toggle('filled', el.value !== '');
}

// ── Passkey cell input handlers ───────────────────────────────
function pkIn(el, prevId, nextId) {
    el.value = el.value.replace(/[^0-9]/g, '');
    el.classList.toggle('filled', el.value !== '');
    if (el.value && nextId) {
        var next = document.getElementById(nextId);
        if (next) next.focus();
    }
}

function pkBack(e, el, prevId, nextId) {
    if (e.key === 'Backspace' && !el.value && prevId) {
        var prev = document.getElementById(prevId);
        if (prev) prev.focus();
    }
    el.classList.toggle('filled', el.value !== '');
}

// ── Helper: clear OTP cells ───────────────────────────────────
function clearOtpCells(type) {
    var prefix = type === 'password' ? 'pw_o' : 'pk_o';
    [1,2,3,4,5,6].forEach(function(i) {
        var el = document.getElementById(prefix + i);
        if (el) { el.value = ''; el.classList.remove('filled'); }
    });
}

function clearPasskeyCells() {
    ['pk_n1','pk_n2','pk_n3','pk_n4','pk_c1','pk_c2','pk_c3','pk_c4']
    .forEach(function(id) {
        var el = document.getElementById(id);
        if (el) { el.value = ''; el.classList.remove('filled'); }
    });
}

// ── Helper: shake OTP row ─────────────────────────────────────
function shakeOtpRow(type) {
    var row = document.querySelector(
        type === 'password'
            ? '#pw-step2 .sec-otp-row'
            : '#pk-step2 .sec-otp-row'
    );
    if (!row) return;
    row.classList.add('shake');
    setTimeout(function() { row.classList.remove('shake'); }, 400);
}

// ── Helper: show message ──────────────────────────────────────
function showSecMsg(id, text, type) {
    var el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.className   = 'sec-msg';
    if (type) el.classList.add('msg-' + type);
}

// ── Helper: get CSRF ──────────────────────────────────────────
function getSecCsrf() {
    var c = document.cookie.split(';');
    for (var i = 0; i < c.length; i++) {
        var x = c[i].trim();
        if (x.startsWith('csrftoken='))
            return decodeURIComponent(x.substring(10));
    }
    var el = document.querySelector('[name=csrfmiddlewaretoken]');
    return el ? el.value : '';

}

// ═══════════════════════════════════════
//  2FA TOGGLE — Security Tab
// ═══════════════════════════════════════

function handle2FAToggle(checkbox) {
    if (checkbox.checked) {
        // User wants to ENABLE — send OTP first to confirm
        checkbox.checked = false; // revert until OTP confirmed
        enable2FA();
    } else {
        // User wants to DISABLE — no OTP needed
        disable2FA();
    }
}

async function enable2FA() {
    showSecMsg('twoFaMsg', 'Sending OTP to your phone...', 'loading');

    const csrf = getSecCsrf();
    try {
        const res  = await fetch('/2fa/toggle/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf },
            body: JSON.stringify({ enable: true }),
        });
        const data = await res.json();

        if (data.success && data.otp_sent) {
            // Show OTP confirmation box
            document.getElementById('twoFaOtpBox').classList.remove('hidden');
            document.getElementById('twoFaOtpHint').textContent =
                `OTP sent to number ending in ${data.phone_hint}. Enter it to confirm.`;
            showSecMsg('twoFaMsg', data.message, 'success');
            document.getElementById('ta_o1').focus();
        } else {
            showSecMsg('twoFaMsg', data.message || data.error, 'error');

            // If no phone — redirect to Profile tab
            if (data.error === 'no_phone') {
                setTimeout(() => {
                    document.querySelectorAll('.tab')[0].click(); // Profile tab
                    showToast('Please add your phone number first', 'warning');
                }, 1500);
            }
        }
    } catch (e) {
        showSecMsg('twoFaMsg', 'Network error. Please try again.', 'error');
    }
}

async function confirm2FA() {
    const otp = ['ta_o1','ta_o2','ta_o3','ta_o4','ta_o5','ta_o6']
        .map(id => document.getElementById(id).value).join('');

    if (otp.length !== 6) {
        showSecMsg('twoFaMsg', 'Please enter all 6 digits.', 'error');
        return;
    }

    showSecMsg('twoFaMsg', 'Verifying OTP...', 'loading');

    const csrf = getSecCsrf();
    try {
        const res  = await fetch('/2fa/confirm/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf },
            body: JSON.stringify({ otp }),
        });
        const data = await res.json();

        if (data.success) {
            // Update UI to show 2FA enabled
            document.getElementById('twoFaToggle').checked = true;
            document.getElementById('twoFaStatus').textContent = '2FA Enabled';
            document.getElementById('twoFaStatus').style.color = '#16a34a';
            document.getElementById('twoFaBadge').innerHTML =
                '<i class="fas fa-lock"></i> Enabled';
            document.getElementById('twoFaOtpBox').classList.add('hidden');
            showSecMsg('twoFaMsg', '', '');
            if (typeof showToast === 'function')
                showToast('🔐 2FA enabled successfully!', 'success');
        } else {
            showSecMsg('twoFaMsg', data.error || 'Invalid OTP.', 'error');
            // Clear OTP cells
            ['ta_o1','ta_o2','ta_o3','ta_o4','ta_o5','ta_o6'].forEach(id => {
                const el = document.getElementById(id);
                if (el) { el.value = ''; el.classList.remove('filled'); }
            });
        }
    } catch (e) {
        showSecMsg('twoFaMsg', 'Network error. Please try again.', 'error');
    }
}

async function disable2FA() {
    showSecMsg('twoFaMsg', 'Disabling 2FA...', 'loading');
    const csrf = getSecCsrf();
    try {
        const res  = await fetch('/2fa/toggle/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf },
            body: JSON.stringify({ enable: false }),
        });
        const data = await res.json();

        if (data.success) {
            document.getElementById('twoFaToggle').checked = false;
            document.getElementById('twoFaStatus').textContent = '2FA Disabled';
            document.getElementById('twoFaStatus').style.color = '#374151';
            document.getElementById('twoFaBadge').innerHTML =
                '<i class="fas fa-lock-open"></i> Disabled';
            document.getElementById('twoFaOtpBox').classList.add('hidden');
            showSecMsg('twoFaMsg', '', '');
            if (typeof showToast === 'function')
                showToast('2FA disabled.', 'info');
        } else {
            showSecMsg('twoFaMsg', data.error, 'error');
            document.getElementById('twoFaToggle').checked = true; // revert
        }
    } catch (e) {
        showSecMsg('twoFaMsg', 'Network error.', 'error');
        document.getElementById('twoFaToggle').checked = true; // revert
    }
}

function cancel2FA() {
    document.getElementById('twoFaOtpBox').classList.add('hidden');
    document.getElementById('twoFaToggle').checked = false;
    showSecMsg('twoFaMsg', '', '');
    ['ta_o1','ta_o2','ta_o3','ta_o4','ta_o5','ta_o6'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.value = ''; el.classList.remove('filled'); }
    });
}