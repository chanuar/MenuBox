type SupabaseEnvironment = {
  url: string;
  publishableKey: string;
  configured: boolean;
};

function readSupabaseEnvironment(env: ImportMetaEnv = import.meta.env): SupabaseEnvironment {
  const url = env.VITE_SUPABASE_URL?.trim() ?? '';
  const publishableKey =
    (env.VITE_SUPABASE_PUBLISHABLE_KEY ?? env.VITE_SUPABASE_ANON_KEY)?.trim() ?? '';
  return {
    url: url.replace(/\/+$/, ''),
    publishableKey,
    configured: Boolean(url && publishableKey),
  };
}

export const supabaseEnvironment = readSupabaseEnvironment();
