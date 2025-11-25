import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://gvdoqgbwrkbyaxsyspje.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2ZG9xZ2J3cmtieWF4c3lzcGplIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5ODk2OTgsImV4cCI6MjA3OTU2NTY5OH0.75ivUGmTV8dyR6kkjoAyKAVU4oadA0NvOj0-ErGXow4'

export const supabase = createClient(supabaseUrl, supabaseKey)