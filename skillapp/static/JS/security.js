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