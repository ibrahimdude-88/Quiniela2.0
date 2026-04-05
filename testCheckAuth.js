import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ocrtkgcitqxgbwgtzhwd.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jcnRrZ2NpdHF4Z2J3Z3R6aHdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3NTA5MjksImV4cCI6MjA4NjMyNjkyOX0.dAkppuXJptgk4YZQ6wrvbEigrtHX9FEgk9o6t8OP4kQ'

const supabase = createClient(supabaseUrl, supabaseKey)

async function testSignIn() {
    console.log("Attempting sign in...");
    const { data, error } = await supabase.auth.signInWithPassword({
        email: 'zippo0189@gmail.com',
        password: 'password123' // Fake password just to see the error type
    });
    
    if (error) {
        console.log("Error:", error);
    } else {
        console.log("Success:", data);
    }
}
testSignIn();
