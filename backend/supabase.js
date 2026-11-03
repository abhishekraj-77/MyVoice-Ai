import { createClient } from "@supabase/supabase-js";

function createSupabaseClient(token) {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_PUBLISHABLE_KEY,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    }
  );
}

// Verify the logged-in user
export async function authenticateUser(token) {
  try {
    const supabase = createSupabaseClient(token);

    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      return null;
    }

    return data.user;
  } catch (error) {
    console.error("Authentication error:", error.message);
    return null;
  }
}

// Access the database as the authenticated user
export function getUserSupabaseClient(token) {
  return createSupabaseClient(token);
}