
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabaseUrl = 'https://ocrtkgcitqxgbwgtzhwd.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jcnRrZ2NpdHF4Z2J3Z3R6aHdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3NTA5MjksImV4cCI6MjA4NjMyNjkyOX0.dAkppuXJptgk4YZQ6wrvbEigrtHX9FEgk9o6t8OP4kQ'

export const supabase = createClient(supabaseUrl, supabaseKey)
