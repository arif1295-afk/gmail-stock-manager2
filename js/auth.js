function showNotif(msg, type = "error") {
    const notif = document.getElementById('notif');
    notif.innerHTML = `<div class="notification${type === "success" ? " success" : ""}">${msg}</div>`;
}

function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Register
if (document.getElementById('registerForm')) {
    document.getElementById('registerForm').onsubmit = async function(e) {
        e.preventDefault();
        const growid = document.getElementById('regGrowID').value.trim();
        const password = document.getElementById('regPassword').value;
        const gmail = document.getElementById('regGmail').value.trim();

        if (!growid || !password || !gmail) return showNotif("Semua field wajib diisi!");
        if (password.length < 6) return showNotif("Password minimal 6 karakter!");
        if (!validateEmail(gmail)) return showNotif("Gmail tidak valid!");

        // Cek GrowID unik
        let { data: existing, error: err1 } = await supabase
            .from('users')
            .select('id')
            .eq('growid', growid)
            .maybeSingle();
        if (existing) return showNotif('GrowID sudah terdaftar!');

        // Simpan user baru
        let { error } = await supabase
            .from('users')
            .insert([{ growid, password, gmail, is_admin: false }]);
        if (error) return showNotif(error.message);

        showNotif("Registrasi berhasil! Silakan login.", "success");
        setTimeout(() => window.location = "login.html", 1200);
    };
}

// Login
if (document.getElementById('loginForm')) {
    document.getElementById('loginForm').onsubmit = async function(e) {
        e.preventDefault();
        const growid = document.getElementById('loginGrowID').value.trim();
        const password = document.getElementById('loginPassword').value;

        let { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('growid', growid)
            .eq('password', password)
            .maybeSingle();
        if (error || !user) return showNotif('GrowID atau password salah!');

        localStorage.setItem('gt_session', JSON.stringify({ growid: user.growid, isAdmin: !!user.is_admin }));
        showNotif("Login berhasil!", "success");
        setTimeout(() => {
            if (user.is_admin) window.location = "index.html";
            else window.location = "user.html";
        }, 1000);
    };
}