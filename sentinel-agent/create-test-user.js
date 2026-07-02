import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function createTestUser() {
  console.log('🛡️ Creating test user in Supabase...');
  
  const email = 'admin@sentinel.com';
  const password = 'Password123!';

  // Use the admin API to create the user bypassing sign-up restrictions
  const { data, error } = await supabase.auth.admin.createUser({
    email: email,
    password: password,
    email_confirm: true
  });

  if (error) {
    if (error.message.includes('already been registered')) {
       console.log('✅ User already exists! Wait for server to start and login with:');
       console.log(`📧 Email: ${email}\n🔑 Password: ${password}`);
    } else {
       console.error('❌ Error creating user:', error.message);
    }
    return;
  }

  console.log('✅ Test user successfully created!');
  console.log(`📧 Email: ${email}`);
  console.log(`🔑 Password: ${password}`);
  console.log('You can now log into the Dashboard and Extension using these credentials.');
}

createTestUser();
