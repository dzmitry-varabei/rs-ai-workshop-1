// Test setup file for Vitest
import 'dotenv/config';

// Mock environment variables for tests
process.env.TELEGRAM_BOT_TOKEN = 'test_token';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test_key';
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce noise in tests