import { createClient } from '@supabase/supabase-js'
import 'dotenv/config' // Add this line to load .env variables

const supabaseUrl = process.env.PROJECT_URL_SUPABASE as string
const supabaseKey = process.env.API_KEY_SUPABASE as string

const supabase = createClient(supabaseUrl, supabaseKey)

export default supabase