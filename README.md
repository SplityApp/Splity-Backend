1. Install supabase cli (for development)
   `brew install supabase/tap/supabase`
2. Link supabase to project
   `supabase link`
3. Install Deno extension for VSCode
4. Create new function
   `supabase functions new my_function`
5. Run function locally
   `cd supabase/functions/my_function`
   `deno run --allow-all --watch index.ts`
6. Deploy function
   `supabase functions deploy my_function --project-ref bajqihucgsmrbpagxhvv`

# Tutorials

https://supabase.com/docs/guides/functions/local-development
https://www.youtube.com/watch?v=lFhU3L8VoSQ
