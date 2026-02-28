
import { supabase } from './supabaseClient.js'

export async function signUp(email, password, fullName, whatsapp, username) {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name: fullName,
                username: username,
                whatsapp: whatsapp
            }
        }
    })

    if (error) throw error
    return data
}

export async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    })

    if (error) throw error
    return data
}

export async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
}

export async function getCurrentUser() {
    const { data, error } = await supabase.auth.getUser()
    if (error || !data || !data.user) return null
    const user = data.user


    // Fetch profile
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

    if (profileError) {
        console.error('Error fetching profile:', profileError)
        return null
    }

    startTrackingInactivity();

    return { ...user, profile }
}

export async function checkAdmin() {
    const user = await getCurrentUser()
    return user?.profile?.role === 'admin'
}

// Inactivity timeout logic
let inactivityTimer = null;
const INACTIVITY_TIME_MS = 10 * 60 * 1000; // 10 minutes

function resetInactivityTimer() {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(async () => {
        console.log('[AUTH] Inactivity timeout reached. Logging out...');
        alert('Sesión cerrada por inactividad.');
        await signOut();
        window.location.href = '/login.html';
    }, INACTIVITY_TIME_MS);
}

function startTrackingInactivity() {
    if (window._inactivityTrackingStarted) return;
    window._inactivityTrackingStarted = true;

    // Listen to user interactions
    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll', 'click'];
    events.forEach(eventName => {
        window.addEventListener(eventName, resetInactivityTimer, { passive: true });
    });

    // Start initial timer
    resetInactivityTimer();
}
