
// Initialize Admin Panel
async function init() {
    console.log('[ADMIN] Initializing...');

    // Check Auth
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
        return;
    }

    // Check Role
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

    if (!profile || profile.role !== 'admin') {
        alert('Acceso Denegado');
        window.location.href = 'index.html';
        return;
    }

    // Load Data
    await loadSettings();
    await loadUsers();
    await loadMatches(); // This will trigger calculateStandings & renderQualified

    // Setup tabs
    setupTabs();

    console.log('[ADMIN] Ready');
}

function setupTabs() {
    // Already handled by loadMatches rendering tabs, but we can add global listeners here if needed
}
